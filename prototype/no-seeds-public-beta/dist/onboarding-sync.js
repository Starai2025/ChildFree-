// No Seeds onboarding ↔ Supabase. Logic only: no markup, no styles.
// app.js calls these so every onboarding step is saved on the phone immediately and on the
// member's own `profiles` row whenever they are signed in. Public key only; RLS does the rest.

export const SITE_URL = "https://free-midnight-beta.thegiftedbystarr.chatgpt.site";

const ELIGIBILITY_KEYS = ["black", "noChildren", "neverChildren", "noStepParent", "honest", "respect"];
const SCALARS = ["first_name", "birth_date", "gender", "city", "zip", "relationship_goal", "marriage_view", "bio", "pledge_accepted_at"];
const OBJECTS = ["basics", "compatibility", "eligibility"];

const filled = (value) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
const text = (value, max) => {
  const clean = String(value ?? "").trim();
  return clean ? clean.slice(0, max) : null;
};
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
};
const age = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(99, Math.max(18, n)) : null;
};

// Only the columns a member may write, cleaned so a half-finished draft never trips a database rule.
export function profilePatch(draft = {}) {
  let ageMin = age(draft.age_min) ?? 25, ageMax = age(draft.age_max) ?? 70;
  if (ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  const zip = String(draft.zip ?? "").replace(/\D/g, "").slice(0, 5);
  return {
    first_name: text(draft.first_name, 40),
    birth_date: validDate(draft.birth_date),
    gender: ["Woman", "Man", "Non-binary"].includes(draft.gender) ? draft.gender : null,
    seeking: (Array.isArray(draft.seeking) ? draft.seeking : []).filter((g) => ["Woman", "Man", "Non-binary"].includes(g)),
    age_min: ageMin,
    age_max: ageMax,
    city: text(draft.city, 60),
    zip: zip.length === 5 ? zip : null,
    relationship_goal: text(draft.relationship_goal, 60),
    marriage_view: text(draft.marriage_view, 60),
    bio: text(draft.bio, 500),
    prompts: (Array.isArray(draft.prompts) ? draft.prompts : [])
      .filter((p) => p?.id && String(p.answer ?? "").trim())
      .slice(0, 4)
      .map((p) => ({ id: String(p.id), answer: String(p.answer).trim().slice(0, 500) })),
    basics: { ...(draft.basics || {}) },
    interests: (Array.isArray(draft.interests) ? draft.interests : []).map((i) => String(i).trim()).filter(Boolean).slice(0, 6),
    compatibility: { ...(draft.compatibility || {}) },
    eligibility: { ...(draft.eligibility || {}) },
    pledge_accepted_at: draft.pledge_accepted_at || null,
  };
}

// Combine the saved profile with answers typed on this phone before signing in.
// Anything already saved on the account wins; the phone only fills gaps.
export function mergeDrafts(server = {}, local = {}) {
  const merged = { ...local, ...server };
  for (const key of SCALARS) merged[key] = filled(server[key]) ? server[key] : (filled(local[key]) ? local[key] : null);
  for (const key of ["seeking", "interests"]) merged[key] = filled(server[key]) ? server[key] : (local[key] || []);
  merged.prompts = (server.prompts || []).some((p) => p?.answer) ? server.prompts : (local.prompts || []);
  for (const key of OBJECTS) {
    const fromServer = Object.fromEntries(Object.entries(server[key] || {}).filter(([, v]) => filled(v) && v !== false));
    merged[key] = { ...(local[key] || {}), ...fromServer };
  }
  // A new account starts with the database's default range (25-60); a range picked on the phone replaces it.
  const serverUntouched = !filled(server.age_min) || (Number(server.age_min) === 25 && Number(server.age_max) === 60);
  if (serverUntouched && filled(local.age_min) && filled(local.age_max)) {
    merged.age_min = local.age_min;
    merged.age_max = local.age_max;
  }
  return merged;
}

// True when the phone has answers the account does not have yet.
export function hasUnsavedAnswers(server, merged) {
  return JSON.stringify(profilePatch(server)) !== JSON.stringify(profilePatch(merged));
}

// Where a returning member should continue: the first unfinished required step.
// Step indexes match PROFILE_STEPS in app.js.
export function resumeStep(p = {}) {
  const prompt = (i) => String(p.prompts?.[i]?.answer ?? "").trim();
  const required = [
    filled(p.first_name) && validDate(p.birth_date),
    filled(p.gender) && filled(p.seeking),
    filled(p.city) && String(p.zip ?? "").replace(/\D/g, "").length >= 5,
    filled(p.relationship_goal),
    ELIGIBILITY_KEYS.every((key) => p.eligibility?.[key] === true) && filled(p.pledge_accepted_at),
    prompt(0),
    prompt(1),
  ];
  const firstOpen = required.findIndex((done) => !done);
  if (firstOpen !== -1) return firstOpen;
  return filled(p.bio) ? 9 : 7;
}

// Authentication selects an account landing page; opening the editor is a separate action.
export function accountLanding(status) {
  if (status === "draft" || status === "changes_requested") return "setup";
  if (status === "approved") return "discover";
  return "status";
}

// Phone answers belong to one account, or to the matching email before sign-up.
export function draftForAccount(draft = {}, user) {
  if (!user?.id) return {};
  if (draft._accountId) return draft._accountId === user.id ? draft : {};
  const email = String(draft.email || "").trim().toLowerCase();
  return !email || email === String(user.email || "").trim().toLowerCase() ? draft : {};
}

// Create the account (first time) or sign in (returning) with an emailed link.
// first_name and birth_date travel as sign-up metadata so the draft profile has them immediately.
export function startAccount(supabase, { email, first_name, birth_date }, redirectTo = SITE_URL) {
  return supabase.auth.signInWithOtp({
    email: String(email || "").trim().toLowerCase(),
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
      data: { first_name: text(first_name, 40), birth_date: validDate(birth_date) },
    },
  });
}

// Sign up or sign in with Google. The browser leaves for Google and comes back signed in;
// answers already typed stay on the phone and move to the account on return.
export function startGoogle(supabase, redirectTo = SITE_URL) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
}

// Save the current draft to the signed-in member's own profile row.
export async function saveDraftToServer(supabase, userId, draft) {
  const { error } = await supabase.from("profiles").update(profilePatch(draft)).eq("id", userId);
  return error || null;
}

// Submit for founder review. The database refuses incomplete profiles and explains what is missing.
export async function submitProfile(supabase, userId, draft) {
  const { error } = await supabase.from("profiles").update({ ...profilePatch(draft), status: "submitted" }).eq("id", userId);
  return error || null;
}

export function friendlyAuthError(error) {
  const message = String(error?.message || error || "");
  if (/rate limit/i.test(message)) return "Too many sign-in emails were sent in a short time. Wait a little, then tap Continue again. Your answers are saved on this phone.";
  if (/invalid.*email|email.*invalid/i.test(message)) return "That email address doesn't look right. Check it and try again.";
  if (/provider is not enabled|unsupported provider/i.test(message)) return "Google sign-in isn't switched on yet. Use email for now. Your answers are saved on this phone.";
  return message || "Something went wrong sending your sign-in link. Your answers are saved on this phone.";
}
