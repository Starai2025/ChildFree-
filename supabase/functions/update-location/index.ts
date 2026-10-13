// No Seeds private location update.
// Members may either enter city + ZIP manually or grant one-time browser location.
// The function stores only city, ZIP, and travel preferences on the profile. It never stores
// exact browser coordinates on a member row.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean);
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Body = {
  city?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  age_min?: number;
  age_max?: number;
  travelDistance?: string;
  willingToFly?: string;
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

function cleanText(value: unknown, max: number): string | null {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, max) : null;
}

function cleanZip(value: unknown): string | null {
  const zip = String(value ?? "").replace(/\D/g, "").slice(0, 5);
  return zip.length === 5 ? zip : null;
}

function cleanAge(value: unknown): number | null {
  const age = Math.round(Number(value));
  return Number.isFinite(age) ? Math.min(99, Math.max(18, age)) : null;
}

async function cacheZipPoint(zip: string) {
  if (!GOOGLE_KEY) return;
  const { data: cached } = await admin.from("zip_locations").select("zip").eq("zip", zip).maybeSingle();
  if (cached) return;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?components=${encodeURIComponent(`postal_code:${zip}|country:US`)}&key=${GOOGLE_KEY}`;
  const result = await fetch(url).then((r) => r.json()).catch(() => null);
  const point = result?.results?.[0]?.geometry?.location;
  if (typeof point?.lat === "number" && typeof point?.lng === "number") {
    await admin.from("zip_locations").upsert({ zip, lat: point.lat, lng: point.lng, updated_at: new Date().toISOString() });
  }
}

async function areaFromCoordinates(latitude: number, longitude: number): Promise<{ city: string; zip: string } | null> {
  if (!GOOGLE_KEY) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&result_type=postal_code|locality&key=${GOOGLE_KEY}`;
  const result = await fetch(url).then((r) => r.json()).catch(() => null);
  const results = result?.results ?? [];
  const allParts = results.flatMap((item: { address_components?: unknown[] }) => item.address_components ?? []) as { long_name?: string; short_name?: string; types?: string[] }[];
  const pick = (type: string) => allParts.find((part) => part.types?.includes(type));
  const city = cleanText(pick("locality")?.long_name ?? pick("sublocality")?.long_name ?? pick("postal_town")?.long_name, 60);
  const zip = cleanZip(pick("postal_code")?.long_name ?? pick("postal_code")?.short_name);
  return city && zip ? { city, zip } : null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Use POST." }, origin);

  const auth = req.headers.get("authorization") ?? "";
  const member = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userData } = await member.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  const user = userData?.user;
  if (!user) return reply(401, { error: "Please sign in again." }, origin);

  let body: Body;
  try { body = await req.json(); } catch { return reply(400, { error: "Send JSON." }, origin); }

  let city = cleanText(body.city, 60);
  let zip = cleanZip(body.zip);
  if (!city || !zip) {
    const area = await areaFromCoordinates(Number(body.latitude), Number(body.longitude));
    if (!area) return reply(400, { error: GOOGLE_KEY ? "We could not find your general area. Type your city and ZIP instead." : "Location lookup is not configured yet. Type your city and ZIP instead." }, origin);
    city = area.city;
    zip = area.zip;
  }

  const travelDistance = ["25 mi", "50 mi", "100 mi", "Anywhere"].includes(String(body.travelDistance ?? "")) ? body.travelDistance : null;
  const willingToFly = ["Yes", "Maybe", "No"].includes(String(body.willingToFly ?? "")) ? body.willingToFly : null;
  let ageMin = cleanAge(body.age_min);
  let ageMax = cleanAge(body.age_max);
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];

  const { data: profile, error: profileError } = await admin.from("profiles").select("basics").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return reply(404, { error: "Profile not found." }, origin);
  const basics = { ...(profile.basics ?? {}) };
  if (travelDistance) basics.travelDistance = travelDistance;
  if (willingToFly) basics.willingToFly = willingToFly;

  await cacheZipPoint(zip);
  const patch: Record<string, unknown> = { city, zip, basics };
  if (ageMin !== null) patch.age_min = ageMin;
  if (ageMax !== null) patch.age_max = ageMax;
  const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
  if (error) return reply(500, { error: error.message }, origin);
  return reply(200, { city, zip, basics, age_min: ageMin, age_max: ageMax }, origin);
});
