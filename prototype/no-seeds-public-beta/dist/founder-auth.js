import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";

export const founderClient = createClient("https://btnrophnyfuwnqzwiooh.supabase.co", "sb_publishable_7bUb95CMiZ7AVoXqJWsE5Q_TZZDlxBw");
const esc = (v = "") => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
let stopPreviousLogin = () => {};

// MFA secrets/codes stay in this page's memory, never in app storage or logs.
export function renderFounderLogin(root, initialError, onReady) {
  stopPreviousLogin();
  try { sessionStorage.removeItem("noSeedsReviewPasscode"); } catch { /* discard retired credential */ }
  let factorId = "";
  let qr = "";
  let busy = false;
  let active = true;
  let actorId = null;
  const { data: authListener } = founderClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || (actorId && session?.user.id !== actorId)) {
      active = false; factorId = ""; qr = "";
      root.innerHTML = '<section class="ns-rv-sheet"><p>Account changed. Reopen review to continue securely.</p><a href="./review.html">Reopen founder review</a></section>';
    }
  });
  stopPreviousLogin = () => { active = false; factorId = ""; qr = ""; authListener.subscription.unsubscribe(); };
  const assertActor = async () => {
    if (!active) throw new Error("Account changed. Reopen review.");
    const current = await founderClient.auth.getSession();
    if (!active || current.data.session?.user.id !== actorId) throw new Error("Account changed. Reopen review.");
  };
  const message = (text) => { const el = root.querySelector('[role="alert"]'); if (el) el.textContent = text; };
  const shell = (html) => {
    root.innerHTML = `<section class="ns-rv-hero"><h1>Founder review</h1><p>Founder account and authenticator required.</p></section><section class="ns-rv-sheet ns-rv-login">${html}<p role="alert">${esc(initialError || "")}</p><button type="button" id="founder-signout">Sign out</button></section>`;
    root.querySelector("#founder-signout").addEventListener("click", async () => {
      await founderClient.auth.signOut({ scope: "local" });
      window.location.reload();
    });
  };
  const attempt = async (fn) => {
    if (busy) return;
    busy = true; message("");
    try { if (active) await fn(); } catch (e) { if (active) message(e.message || "Could not continue. Try again."); }
    finally { busy = false; }
  };
  async function proceed() {
    const { data, error } = await founderClient.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Sign in to your founder account first.");
    if (!active) return;
    actorId = data.session.user.id;
    const access = await founderClient.rpc("founder_access");
    await assertActor();
    if (access.error) throw access.error;
    if (access.data?.founder !== true) throw new Error("This account has not been granted founder access.");
    if (access.data.mfa === true) {
      const current = await founderClient.auth.getSession();
      if (current.data.session?.user.id !== data.session.user.id) throw new Error("Account changed. Refresh and sign in again.");
      stopPreviousLogin(); await onReady(data.session.user.id); return;
    }
    const factors = await founderClient.auth.mfa.listFactors();
    await assertActor();
    if (factors.error) throw factors.error;
    const verified = factors.data.totp.find((f) => f.status === "verified");
    factorId = verified?.id || "";
    shell(`${factorId ? "<p>Enter the code from your authenticator.</p>" : '<p>Set up an authenticator app to secure founder access.</p><button type="button" id="enroll-founder">Set up authenticator</button>'}
      <div id="founder-qr"></div><form id="founder-mfa"><label>Authenticator code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button type="submit" class="ns-btn-primary">Verify and open review</button></form>`);
    root.querySelector("#enroll-founder")?.addEventListener("click", () => attempt(async () => {
      if (factorId) return;
      await assertActor();
      // Clear only this page's unfinished enrollment, never a verified factor.
      for (const pending of factors.data.totp.filter((f) => f.status === "unverified" && f.friendly_name === "No Seeds founder")) {
        const removed = await founderClient.auth.mfa.unenroll({ factorId: pending.id });
        await assertActor();
        if (removed.error) throw removed.error;
      }
      const enrolled = await founderClient.auth.mfa.enroll({ factorType: "totp", friendlyName: "No Seeds founder", issuer: "No Seeds" });
      await assertActor();
      if (enrolled.error) throw enrolled.error;
      factorId = enrolled.data.id; qr = enrolled.data.totp.qr_code;
      const img = document.createElement("img");
      img.alt = "Scan with your authenticator app. Do not share this QR code.";
      img.src = qr.startsWith("data:image/svg+xml") ? qr : `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`;
      root.querySelector("#founder-qr").replaceChildren(img);
      root.querySelector("#enroll-founder").disabled = true;
    }));
    root.querySelector("#founder-mfa").addEventListener("submit", (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const input = event.currentTarget.elements.code;
      const code = input.value; input.value = "";
      void attempt(async () => {
        if (!factorId) throw new Error("Set up your authenticator first.");
        await assertActor();
        const verified = await founderClient.auth.mfa.challengeAndVerify({ factorId, code });
        await assertActor();
        if (verified.error) throw verified.error;
        root.querySelector("#founder-qr").replaceChildren(); qr = "";
        await proceed();
      });
    });
  }
  shell(`<button id="founder-google" type="button" class="ns-btn-primary">Sign in with Google</button>
    <form id="founder-email"><label>Founder email<input name="email" type="email" autocomplete="email" required></label><button type="submit">Email sign-in link</button></form>
    <button type="button" id="founder-continue">Continue with signed-in account</button>`);
  root.querySelector("#founder-google").addEventListener("click", () => attempt(async () => {
    const { error } = await founderClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/review.html`, queryParams: { prompt: "select_account" } } });
    if (error) throw error;
  }));
  root.querySelector("#founder-email").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = event.currentTarget.elements.email.value.trim().toLowerCase();
    void attempt(async () => {
      const { error } = await founderClient.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/review.html` } });
      if (error) throw error;
      message("Open the sign-in link, then continue here. If it opens the member app, return to /review.html.");
    });
  });
  root.querySelector("#founder-continue").addEventListener("click", () => attempt(proceed));
  void attempt(async () => {
    const { data } = await founderClient.auth.getSession();
    if (data.session) await proceed();
  });
}
