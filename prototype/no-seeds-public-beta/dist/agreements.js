// Explicit agreement acceptance. The server owns identity, versions and timestamps.
export const AGREEMENT_VERSION = "2026-10-16.1";
export const ELIGIBILITY = {
  black: "I am joining a community built for Black singles.",
  noChildren: "I have no children of any age.",
  neverChildren: "I never want biological, adopted or step-children.",
  noStepParent: "I am not looking for a parent or step-parent role.",
  honest: "I will be honest about my history and childfree choice.",
  respect: "I will not pressure anyone to change their choice.",
};

export async function ensureAgreements(client, root, { userId, url, key }) {
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  if (!userId || data.session?.user.id !== userId) return false;
  // Pin the initiating bearer token: switching accounts cannot record consent for the new account.
  const bearer = data.session.access_token;
  const controller = new AbortController();
  let cancelled = false;
  let finish;
  const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
    if (session?.user.id !== userId) { cancelled = true; controller.abort(); finish?.(false); }
  });
  const rpc = async (name, payload = {}) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(payload), cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not save agreements. Sign in again and retry.");
    return result;
  };
  try {
    const status = await rpc("agreement_status");
    if (cancelled) return false;
    if (status?.accepted === true && status.version === AGREEMENT_VERSION) return true;
    return await new Promise((resolve) => {
    finish = resolve;
    root.innerHTML = `<main class="screen auth-journey"><form id="agreement-consent" class="account-screen ns-step ns-pledge-step ns-agree">
      <h1>One last <em>promise</em></h1>
      <p class="account-tagline">Before the founder reviews your profile, confirm your answers once more and accept our agreements. Your account keeps a record of the version and the date.</p>
      <div class="clause-stack">
        <section class="pledge-group" aria-label="Your answers">
          <p>Your answers</p>
          ${Object.entries(ELIGIBILITY).map(([key, label]) => `<label class="clause-card"><input type="checkbox" name="${key}" required><span>${label}</span></label>`).join("")}
        </section>
        <section class="pledge-group" aria-label="Our agreements">
          <p>Our agreements</p>
          <label class="clause-card"><input type="checkbox" name="terms" required><span>I agree to the <a href="./terms.html" target="_blank" rel="noopener">Terms of Service</a> (October 14, 2026), including the Community Pledge above.</span></label>
          <label class="clause-card"><input type="checkbox" name="privacy" required><span>I acknowledge the <a href="./privacy.html" target="_blank" rel="noopener">Privacy Policy</a> (October 14, 2026).</span></label>
          <label class="clause-card pledge-card"><input type="checkbox" name="pledge" required><span>I accept the Community Pledge and confirm that my six answers above are true.</span></label>
        </section>
      </div>
      <p role="alert" id="agreement-error" class="ns-agree-error"></p>
      <button class="ns-btn-primary" type="submit">Accept and submit</button>
      <button type="button" id="agreement-cancel" class="ns-btn-quiet">Go back</button>
    </form></main>`;
    root.querySelector("#agreement-cancel").addEventListener("click", () => resolve(false));
    root.querySelector("#agreement-consent").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      root.querySelector("#agreement-cancel").disabled = true;
      try {
        if (cancelled) return resolve(false);
        await rpc("accept_agreements", {
          p_version: AGREEMENT_VERSION,
          p_answers: Object.fromEntries(Object.keys(ELIGIBILITY).map((key) => [key, values.get(key) === "on"])),
          p_terms: values.get("terms") === "on", p_privacy: values.get("privacy") === "on", p_pledge: values.get("pledge") === "on",
        });
        resolve(!cancelled);
      } catch (error) {
        if (cancelled) return resolve(false);
        form.querySelector("#agreement-error").textContent = error.message || "Could not save your acceptance. Try again.";
        button.disabled = false;
        root.querySelector("#agreement-cancel").disabled = false;
      }
    });
    });
  } catch (error) {
    if (cancelled) return false;
    throw error;
  } finally { listener.subscription.unsubscribe(); }
}
