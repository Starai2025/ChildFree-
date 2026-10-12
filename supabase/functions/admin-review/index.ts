// Founder review for the public web beta. The service-role key and ADMIN_PASSCODE stay in
// Supabase secrets; the browser only ever sends the passcode in a header over HTTPS.
//
// POST { "action": "queue" }                                         -> submitted profiles + signed photo URLs
// POST { "action": "decide", "profile_id": "...", "decision": "approved" | "changes_requested" | "removed", "note": "..." }
// POST { "action": "reports" }                                       -> open safety reports (after migration 0003)
// POST { "action": "resolve_report", "report_id": "...", "status": "reviewed" | "actioned", "note": "..." }
// Header: x-admin-passcode: <ADMIN_PASSCODE>
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const passcode = Deno.env.get("ADMIN_PASSCODE") ?? "";
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const DECISIONS = new Set(["approved", "changes_requested", "removed"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(origin: string | null): Record<string, string> {
  const allow = origin && allowedOrigins.includes(origin) ? origin : "";
  return {
    ...(allow ? { "Access-Control-Allow-Origin": allow, Vary: "Origin" } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-admin-passcode",
  };
}

// Constant-time comparison so response timing does not reveal how much of a guess was right.
function samePasscode(given: string): boolean {
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(passcode);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return passcode.length >= 24 && diff === 0;
}

function reply(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Use POST." }, origin);
  if (!samePasscode(req.headers.get("x-admin-passcode") ?? "")) return reply(401, { error: "Not authorized." }, origin);

  let body: { action?: string; profile_id?: string; decision?: string; note?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Send JSON." }, origin); }

  if (body.action === "queue") {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("*, profile_photos(storage_path, position)")
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
          .map((ph: { storage_path: string; position: number }) => ({ position: ph.position, url: urls.get(ph.storage_path) ?? null })),
      })),
    }, origin);
  }

  if (body.action === "decide") {
    if (!body.profile_id || !UUID.test(body.profile_id)) return reply(400, { error: "profile_id must be a UUID." }, origin);
    if (!body.decision || !DECISIONS.has(body.decision)) return reply(400, { error: "decision must be approved, changes_requested or removed." }, origin);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null;
    if (body.decision === "changes_requested" && !note) return reply(400, { error: "Say what needs to change." }, origin);
    // One insert; the admin_reviews trigger applies the decision to the profile in the same transaction.
    const { error } = await admin.from("admin_reviews").insert({ profile_id: body.profile_id, decision: body.decision, note });
    if (error) return reply(409, { error: error.message }, origin);
    return reply(200, { ok: true }, origin);
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

  if (body.action === "resolve_report") {
    const { report_id, status, note } = body as { report_id?: string; status?: string; note?: string };
    if (!report_id || !UUID.test(report_id)) return reply(400, { error: "report_id must be a UUID." }, origin);
    if (status !== "reviewed" && status !== "actioned") return reply(400, { error: "status must be reviewed or actioned." }, origin);
    const { error } = await admin.from("reports")
      .update({ status, resolved_at: new Date().toISOString(), resolution_note: typeof note === "string" ? note.trim().slice(0, 1000) : null })
      .eq("id", report_id);
    if (error) return reply(409, { error: error.message }, origin);
    return reply(200, { ok: true }, origin);
  }

  return reply(400, { error: "Unknown action." }, origin);
});
