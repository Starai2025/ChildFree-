// No Seeds date planner. Called by a signed-in member from an open chat:
//   POST { "match_id": "<uuid>", "time_zone": "America/New_York" }   Authorization: Bearer <member access token>
// Once both people have sent 5+ messages, it creates the match's date plan with:
//   - 3 public places near the halfway point between their ZIP codes, chosen from interests they share
//     (Google Places, key kept in the GOOGLE_MAPS_API_KEY secret; Geocoding + Places API (New) enabled), and
//   - 6 suggested date/times over the next week in the member's time zone.
// Members never receive each other's ZIP code or location. Without a Google key the plan still opens
// with times, and members add their own places.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean);
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shared interest -> what to search for near the halfway point.
const INTEREST_SEARCH: Record<string, string> = {
  "Foodie": "highly rated restaurant",
  "Live music": "live jazz music venue",
  "Dancing": "lounge with dancing",
  "Art": "art museum or gallery",
  "Outdoors": "botanical garden or park",
  "Fitness": "juice bar or smoothie cafe",
  "Travel": "rooftop bar",
  "Business": "wine bar",
  "Quiet nights": "cozy wine bar",
  "Reading": "bookstore cafe",
  "Cooking": "cooking class",
  "Faith": "coffee shop",
};
const DEFAULT_SEARCHES = ["highly rated restaurant", "coffee shop", "wine bar"];
const INTEREST_REASON: Record<string, string> = {
  "Foodie": "You're both foodies",
  "Live music": "You both love live music",
  "Dancing": "You both love to dance",
  "Art": "You both love art",
  "Outdoors": "You both love the outdoors",
  "Fitness": "You're both into fitness",
  "Travel": "You both love to travel",
  "Business": "You're both building something",
  "Quiet nights": "You both like quiet nights",
  "Reading": "You're both readers",
  "Cooking": "You both love to cook",
  "Faith": "Faith matters to you both",
};

function cors(origin: string | null): Record<string, string> {
  const allow = origin && allowedOrigins.includes(origin) ? origin : "";
  return {
    ...(allow ? { "Access-Control-Allow-Origin": allow, Vary: "Origin" } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  };
}

function reply(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
}

// ---------- Halfway point ----------
async function zipPoint(zip: string): Promise<{ lat: number; lng: number } | null> {
  if (!/^[0-9]{5}$/.test(zip ?? "")) return null;
  const { data: cached } = await admin.from("zip_locations").select("lat, lng").eq("zip", zip).maybeSingle();
  if (cached) return cached;
  if (!GOOGLE_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?components=${encodeURIComponent(`postal_code:${zip}|country:US`)}&key=${GOOGLE_KEY}`;
  const result = await fetch(url).then((r) => r.json()).catch(() => null);
  const point = result?.results?.[0]?.geometry?.location;
  if (!point) return null;
  await admin.from("zip_locations").upsert({ zip, lat: point.lat, lng: point.lng, updated_at: new Date().toISOString() });
  return { lat: point.lat, lng: point.lng };
}

// Geographic midpoint (great-circle), fine for any two US ZIP codes.
function midpoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const [lat1, lng1, lat2, lng2] = [a.lat * rad, a.lng * rad, b.lat * rad, b.lng * rad];
  const bx = Math.cos(lat2) * Math.cos(lng2 - lng1), by = Math.cos(lat2) * Math.sin(lng2 - lng1);
  const lat = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2));
  const lng = lng1 + Math.atan2(by, Math.cos(lat1) + bx);
  return { lat: lat / rad, lng: lng / rad };
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

async function areaName(point: { lat: number; lng: number }): Promise<string | null> {
  if (!GOOGLE_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${point.lat},${point.lng}&result_type=neighborhood|sublocality|locality&key=${GOOGLE_KEY}`;
  const result = await fetch(url).then((r) => r.json()).catch(() => null);
  const parts = result?.results?.[0]?.address_components ?? [];
  const pick = (type: string) => parts.find((c: { types: string[] }) => c.types.includes(type))?.long_name;
  const name = pick("neighborhood") ?? pick("sublocality") ?? pick("locality");
  const city = pick("locality");
  return name ? (city && city !== name ? `${name}, ${city}` : name) : null;
}

// ---------- Places ----------
type Place = { id: string; label: string; detail: string; reason: string; maps_url: string | null; rating: number | null; km: number };

async function searchPlaces(query: string, center: { lat: number; lng: number }, radiusM: number): Promise<Omit<Place, "reason">[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 20,
      rankPreference: "RELEVANCE",
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM } },
    }),
  }).catch(() => null);
  const data = await response?.json().catch(() => null);
  type Raw = { id: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number };
    rating?: number; userRatingCount?: number; googleMapsUri?: string; businessStatus?: string };
  // Google treats the circle as a hint, so keep only places that really are near the halfway point,
  // then prefer well-reviewed ones, with a gentle preference for the closest.
  return (data?.places ?? [])
    .filter((p: Raw) => (!p.businessStatus || p.businessStatus === "OPERATIONAL") && p.location && (p.userRatingCount ?? 0) >= 20)
    .map((p: Raw) => ({ p, km: distanceKm(center, { lat: p.location!.latitude, lng: p.location!.longitude }) }))
    .filter(({ km }: { km: number }) => km * 1000 <= radiusM)
    .sort((a: { p: Raw; km: number }, b: { p: Raw; km: number }) => {
      const score = ({ p, km }: { p: Raw; km: number }) => (p.rating ?? 0) * Math.log10((p.userRatingCount ?? 0) + 10) - km * 0.15;
      return score(b) - score(a);
    })
    .map(({ p, km }: { p: Raw; km: number }) => ({
      id: p.id,
      label: (p.displayName?.text ?? "Suggested spot").slice(0, 120),
      detail: (p.formattedAddress ?? "").slice(0, 240),
      maps_url: p.googleMapsUri?.startsWith("https://") ? p.googleMapsUri : null,
      rating: typeof p.rating === "number" ? Math.round(p.rating * 10) / 10 : null,
      km: Math.round(km * 10) / 10,
    }));
}

async function suggestPlaces(center: { lat: number; lng: number }, apartKm: number, shared: string[]): Promise<Place[]> {
  if (!GOOGLE_KEY) return [];
  // A short drive from the halfway point: about a fifth of the distance between them, 5-15 km.
  // If nothing fits, look once more a little wider.
  const searches = shared.filter((i) => INTEREST_SEARCH[i]).map((i) => ({ query: INTEREST_SEARCH[i], reason: INTEREST_REASON[i] ?? `You both like ${i.toLowerCase()}` }));
  for (const query of DEFAULT_SEARCHES) searches.push({ query, reason: "Popular near your halfway point" });
  const baseRadius = Math.min(15000, Math.max(5000, apartKm * 200));
  for (const radiusM of [baseRadius, baseRadius * 2]) {
    const chosen: Place[] = [];
    for (const search of searches) {
      if (chosen.length >= 3) break;
      const found = await searchPlaces(search.query, center, radiusM);
      const next = found.find((p) => !chosen.some((c) => c.id === p.id));
      if (next) chosen.push({ ...next, reason: search.reason });
    }
    if (chosen.length >= 3 || radiusM !== baseRadius) return chosen;
  }
  return [];
}

// ---------- Times ----------
// UTC instant for a wall-clock time in an IANA time zone.
function zonedTime(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}

// Six options over the next week: weekday evenings, Saturday brunch and evening, Sunday afternoon.
function suggestTimes(timeZone: string, now = new Date()) {
  const slots: { label: string; starts_at: string }[] = [];
  const today = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now).map((p) => [p.type, p.value]));
  for (let offset = 1; offset <= 9 && slots.length < 6; offset++) {
    const date = new Date(Date.UTC(+today.year, +today.month - 1, +today.day + offset));
    const [y, m, d, weekday] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay()];
    const hours = weekday === 6 ? [[11, 0], [19, 0]] : weekday === 0 ? [[13, 0]] : weekday === 5 ? [[19, 30]] : [[19, 0]];
    for (const [h, min] of hours) {
      if (slots.length >= 6) break;
      const at = zonedTime(y, m, d, h, min, timeZone);
      const label = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(at);
      slots.push({ label, starts_at: at.toISOString() });
    }
  }
  return slots;
}

// ---------- Founder self-test ----------
// POST { "zip_a": "30308", "zip_b": "30060", "interests": ["Live music"] }   Header: x-admin-passcode: <ADMIN_PASSCODE>
// Runs the halfway point + Google places search for two ZIP codes and returns what members would be offered.
// Writes nothing except the ZIP cache.
const passcode = Deno.env.get("ADMIN_PASSCODE") ?? "";
function samePasscode(given: string): boolean {
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(passcode);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return passcode.length >= 24 && diff === 0;
}

async function selfTest(req: Request, origin: string | null): Promise<Response> {
  if (!samePasscode(req.headers.get("x-admin-passcode") ?? "")) return reply(401, { error: "Not authorized." }, origin);
  let body: { zip_a?: string; zip_b?: string; interests?: string[] };
  try { body = await req.json(); } catch { return reply(400, { error: "Send JSON." }, origin); }
  const [pointA, pointB] = await Promise.all([zipPoint(body.zip_a ?? ""), zipPoint(body.zip_b ?? "")]);
  if (!pointA || !pointB) {
    return reply(200, { ok: false, google_key_set: Boolean(GOOGLE_KEY), error: "Could not locate one of the ZIP codes (is the Geocoding API enabled for the key?)." }, origin);
  }
  const center = midpoint(pointA, pointB);
  const apart = distanceKm(pointA, pointB);
  const [places, label] = await Promise.all([suggestPlaces(center, apart, body.interests ?? []), areaName(center)]);
  return reply(200, {
    ok: places.length > 0,
    google_key_set: Boolean(GOOGLE_KEY),
    apart_km: Math.round(apart),
    midpoint_label: label,
    places: places.map((p) => ({ label: p.label, detail: p.detail, rating: p.rating, reason: p.reason, km_from_halfway: p.km, has_map_link: Boolean(p.maps_url) })),
    times: suggestTimes("America/New_York").map((t) => t.label),
  }, origin);
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Use POST." }, origin);
  if (req.headers.has("x-admin-passcode")) return selfTest(req, origin);

  const auth = req.headers.get("authorization") ?? "";
  const member = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userData } = await member.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  const user = userData?.user;
  if (!user) return reply(401, { error: "Please sign in again." }, origin);

  let body: { match_id?: string; time_zone?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Send JSON." }, origin); }
  const matchId = body.match_id ?? "";
  if (!UUID.test(matchId)) return reply(400, { error: "match_id is required." }, origin);
  let timeZone = "America/New_York";
  try { if (body.time_zone) { new Intl.DateTimeFormat("en-US", { timeZone: body.time_zone }); timeZone = body.time_zone; } } catch { /* keep default */ }

  // The member's own permissions decide whether they may plan: in this match, both approved, not blocked, 5+ messages each.
  const { data: ready, error: readyError } = await member.rpc("date_planner_ready", { p_match: matchId });
  if (readyError) return reply(500, { error: readyError.message }, origin);
  if (!ready) return reply(403, { error: "You can plan a date once you've each sent 5 messages." }, origin);

  const { data: existing } = await admin.from("date_plans").select("id").eq("match_id", matchId).neq("status", "cancelled").maybeSingle();
  if (existing) return reply(200, { plan_id: existing.id, existing: true }, origin);

  const { data: matchRow } = await admin.from("matches").select("user_one, user_two").eq("id", matchId).single();
  const { data: people } = await admin.from("profiles").select("id, zip, interests").in("id", [matchRow!.user_one, matchRow!.user_two]);
  const [a, b] = people ?? [];
  const shared = (a?.interests ?? []).filter((i: string) => (b?.interests ?? []).includes(i));

  const [pointA, pointB] = await Promise.all([zipPoint(a?.zip), zipPoint(b?.zip)]);
  let places: Place[] = [];
  let label: string | null = null;
  if (pointA && pointB) {
    const center = midpoint(pointA, pointB);
    [places, label] = await Promise.all([suggestPlaces(center, distanceKm(pointA, pointB), shared), areaName(center)]);
  }

  const { data: plan, error: planError } = await admin.from("date_plans")
    .insert({ match_id: matchId, created_by: user.id, midpoint_label: label })
    .select("id").single();
  if (planError) {
    // Both people tapped at the same moment: return the plan the other request made.
    const { data: raced } = await admin.from("date_plans").select("id").eq("match_id", matchId).neq("status", "cancelled").maybeSingle();
    if (raced) return reply(200, { plan_id: raced.id, existing: true }, origin);
    return reply(500, { error: planError.message }, origin);
  }
  const options = [
    ...places.map((p) => ({ plan_id: plan.id, kind: "place", label: p.label, detail: p.detail || null, reason: p.reason, maps_url: p.maps_url, rating: p.rating })),
    ...suggestTimes(timeZone).map((t) => ({ plan_id: plan.id, kind: "time", label: t.label, starts_at: t.starts_at })),
  ];
  const { error: optionsError } = await admin.from("date_plan_options").insert(options);
  if (optionsError) return reply(500, { error: optionsError.message }, origin);
  return reply(200, { plan_id: plan.id, places: places.length, times: 6, places_available: Boolean(GOOGLE_KEY) }, origin);
});
