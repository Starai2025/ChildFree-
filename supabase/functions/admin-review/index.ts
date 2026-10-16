// Founder-only review: verified JWT + confirmed Auth user + live database role/session/TOTP gate.
// No shared-passcode fallback. Browser-visible keys cannot grant founder privileges.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(origin: string | null): Record<string, string> {
  const allow = origin && allowedOrigins.includes(origin) ? origin : "";
  return {
    ...(allow ? { "Access-Control-Allow-Origin": allow, Vary: "Origin" } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  };
}

function reply(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(origin) } });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Use POST." }, origin);
  if (origin && !allowedOrigins.includes(origin)) return reply(403, { error: "Origin not allowed." }, origin);
  const authorization = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
  if (!token) return reply(401, { error: "Founder sign-in required." }, origin);
  const member = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // getClaims verifies the JWT signature; getUser also checks the current Auth account.
  const { data: claims, error: claimsError } = await member.auth.getClaims(token);
  if (claimsError || claims?.claims?.role !== "authenticated" || claims.claims.aal !== "aal2") {
    return reply(401, { error: "Founder sign-in with MFA required." }, origin);
  }
  const { data: identity, error: userError } = await member.auth.getUser(token);
  if (userError || !identity?.user?.email_confirmed_at || identity.user.id !== claims.claims.sub) {
    return reply(401, { error: "Confirmed founder sign-in required." }, origin);
  }
  const { data: access, error: accessError } = await member.rpc("founder_access");
  if (accessError || access?.founder !== true || access?.mfa !== true) {
    return reply(403, { error: "Founder access and an active MFA session are required." }, origin);
  }

  let body: { action?: string; profile_id?: string; decision?: string; note?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Send JSON." }, origin); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, { error: "Send a JSON object." }, origin);
  const actions = new Set(["queue", "reports", "member_photos", "decide", "resolve_report", "remove_photo", "invitations", "invite", "revoke_invite"]);
  if (!body.action || !actions.has(body.action)) return reply(400, { error: "Unknown action." }, origin);
  // Every action rechecks the database authorization and records the verified actor.
  const rpcAction = body.action === "remove_photo" ? "authorize_photo_removal" : body.action;
  const { data: authorized, error: actionError } = await member.rpc("founder_action", { p_action: rpcAction, p_payload: body });
  if (actionError) return reply(actionError.code === "42501" ? 403 : 409, { error: actionError.message }, origin);
  if (["decide", "resolve_report", "invitations", "invite", "revoke_invite"].includes(body.action)) return reply(200, authorized, origin);

  if (body.action === "queue") {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("*, profile_photos(id, storage_path, position)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(50);
    if (error) return reply(500, { error: error.message }, origin);
    const paths = profiles.flatMap((p) => p.profile_photos.map((ph: { storage_path: string }) => ph.storage_path));
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed, error: signError } = await admin.storage.from("profile-photos").createSignedUrls(paths, 3600);
      if (signError) return reply(500, { error: signError.message }, origin);
      signed.forEach((s) => { if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl); });
    }
    return reply(200, {
      profiles: profiles.map((p) => ({
        ...p,
        profile_photos: p.profile_photos
          .sort((x: { position: number }, y: { position: number }) => x.position - y.position)
          .map((ph: { id: string; storage_path: string; position: number }) => ({ id: ph.id, position: ph.position, url: urls.get(ph.storage_path) ?? null })),
      })),
    }, origin);
  }

  if (body.action === "reports") {
    const { data, error } = await admin
      .from("reports")
      .select("id, reason, details, created_at, match_id, reporter:profiles!reports_reporter_id_fkey(id, first_name), reported:profiles!reports_reported_id_fkey(id, first_name, status)")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) return reply(500, { error: error.message }, origin);
    return reply(200, { reports: data }, origin);
  }

  if (body.action === "member_photos") {
    if (!body.profile_id || !UUID.test(body.profile_id)) return reply(400, { error: "profile_id must be a UUID." }, origin);
    const { data: photos, error } = await admin.from("profile_photos").select("id, storage_path, position").eq("profile_id", body.profile_id).order("position");
    if (error) return reply(500, { error: error.message }, origin);
    const signed = photos.length ? (await admin.storage.from("profile-photos").createSignedUrls(photos.map((ph) => ph.storage_path), 3600)).data ?? [] : [];
    const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return reply(200, { photos: photos.map((ph) => ({ id: ph.id, position: ph.position, url: urls.get(ph.storage_path) ?? null })) }, origin);
  }

  if (body.action === "remove_photo") {
    const { photo_id } = body as { photo_id?: string };
    if (!photo_id || !UUID.test(photo_id)) return reply(400, { error: "photo_id must be a UUID." }, origin);
    if (!authorized?.storage_path) return reply(404, { error: "That photo is already gone." }, origin);
    const { error: storageError } = await admin.storage.from("profile-photos").remove([authorized.storage_path]);
    if (storageError) return reply(500, { error: storageError.message }, origin);
    const { error: rowError } = await member.rpc("founder_action", { p_action: "finish_photo_removal", p_payload: { photo_id } });
    if (rowError) return reply(500, { error: rowError.message }, origin);
    return reply(200, { ok: true }, origin);
  }

  return reply(400, { error: "Unknown action." }, origin);
});
