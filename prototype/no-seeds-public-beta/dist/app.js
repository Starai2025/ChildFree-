import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { profilePatch, startAccount, startGoogle, saveDraftToServer, submitProfile, mergeDrafts, hasUnsavedAnswers, resumeStep, accountLanding, draftForAccount, friendlyAuthError } from "./onboarding-sync.js";
import { ensureAgreements } from "./agreements.js";

const SUPABASE_URL = "https://btnrophnyfuwnqzwiooh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7bUb95CMiZ7AVoXqJWsE5Q_TZZDlxBw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TYPING_VISIBLE_MS = 6000;
const TYPING_THROTTLE_MS = 2000;

const app = document.querySelector("#app");
const urlParams = new URLSearchParams(window.location.search);
let typingStopTimer = null;

if (urlParams.get("resetDraft") === "1") {
  localStorage.removeItem("noSeedsPublicDraft");
  localStorage.removeItem("freeMidnightPublicDraft");
}

const PROMPTS = [
  ["ordinary_sunday", "An ordinary Sunday with me looks like..."],
  ["partnership", "A strong partnership means..."],
  ["life_together", "A life together without parenthood would include..."],
  ["culture", "A part of my culture I'd love to share is..."],
  ["joy", "Something that always brings me joy is..."],
  ["building", "The life I want to build with someone is..."],
];

const GOAL_OPTIONS = ["Committed relationship", "Marriage-minded", "Long-term partnership", "Intentional dating"];
const MARRIAGE_OPTIONS = ["Open to marriage", "Want marriage", "Partnership without marriage", "Unsure"];
const FAITH_OPTIONS = ["Christian", "Muslim", "Spiritual", "Agnostic", "Atheist", "Other", "Prefer not to say"];
const PACE_OPTIONS = ["Homebody", "Balanced", "Social weekends", "Always on the go"];
const SPENDING_OPTIONS = ["Budget-minded", "Balanced", "Treat ourselves", "Investing for the future"];

const INTEREST_OPTIONS = [
  "Travel",
  "Fitness",
  "Live music",
  "Faith",
  "Business",
  "Art",
  "Quiet nights",
  "Foodie",
  "Dancing",
  "Reading",
  "Outdoors",
  "Cooking",
];

const ELIGIBILITY_KEYS = ["black", "noChildren", "neverChildren", "noStepParent", "honest", "respect"];

const PROFILE_STEPS = [
  ["basics", "STEP 1 OF 10", "Start with the basics.", "Two details, then keep moving."],
  ["identity", "STEP 2 OF 10", "Gender & Looking For", "Tell us how you identify and who you want to meet."],
  ["location", "STEP 3 OF 10", "Location & Age Preferences", "Keep matching local and age-aligned."],
  ["intention", "STEP 4 OF 10", "Name the kind of love you want.", "Keep it intentional and easy to review."],
  ["clauseA", "STEP 5 OF 10", "The No Seeds Pledge.", "Black singles, childfree by choice, and honest about it."],
  ["prompt0", "STEP 6 OF 10", "Answer one good prompt.", "One thoughtful answer beats ten shallow ones."],
  ["prompt1", "STEP 7 OF 10", "Add one more.", "This gives matches something real to respond to."],
  ["story", "STEP 8 OF 10", "Show your vibe.", "A short bio and a few interests are enough for beta."],
  ["life", "STEP 9 OF 10", "Describe the life you'd share.", "One question about the life your childfree choice makes room for."],
  ["photos", "STEP 10 OF 10", "Add your photos.", "Upload up to 6 pictures, then submit for review."],
];

const state = {
  session: null,
  user: null,
  profile: null,
  publicProfile: loadPublicDraft(),
  publicGateOpen: false,
  signInOpen: false,
  setupOverview: false,
  landingFor: null,
  agreementOpen: false,
  publicStep: 0,
  photos: [],
  tab: "profile",
  profileStep: 0,
  cards: null,
  likes: null,
  matches: null,
  messages: null,
  selectedMatch: null,
  viewing: null,
  viewingMatch: null,
  chatMenuOpen: false,
  plan: null,
  editSection: null,
  plannerOpen: false,
  chatChannel: null,
  chatChannelMatch: null,
  typing: [],
  typingUpdatedAt: 0,
  typingExpiryTimer: null,
  loadingArea: "",
  saving: false,
  message: "",
  error: "",
};

function emptyPublicProfile() {
  return {
    first_name: null,
    birth_date: null,
    gender: null,
    seeking: [],
    age_min: 25,
    age_max: 70,
    city: null,
    zip: null,
    relationship_goal: null,
    marriage_view: null,
    bio: null,
    prompts: [],
    basics: {},
    interests: [],
    compatibility: {},
    eligibility: {},
    pledge_accepted_at: null,
    email: "",
  };
}

function loadPublicDraft(user = null) {
  try {
    const own = user ? localStorage.getItem(`noSeedsAccountDraft:${user.id}`) : null;
    const draft = JSON.parse(own || localStorage.getItem("noSeedsPublicDraft") || localStorage.getItem("freeMidnightPublicDraft") || "{}");
    const visible = user ? draftForAccount(draft, user) : (draft._accountId ? {} : draft);
    return { ...emptyPublicProfile(), ...visible };
  } catch {
    return emptyPublicProfile();
  }
}

function savePublicDraft() {
  const draft = { ...(state.publicProfile || emptyPublicProfile()) };
  if (state.user) draft._accountId = state.user.id;
  const saved = JSON.stringify(draft);
  if (state.user) localStorage.setItem(`noSeedsAccountDraft:${state.user.id}`, saved);
  localStorage.setItem("noSeedsPublicDraft", saved);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ageFromBirthDate(value) {
  if (!value) return "";
  const dob = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function getPrompt(index, profile = state.profile) {
  return profile?.prompts?.[index] ?? { id: PROMPTS[index]?.[0] ?? "", answer: "" };
}

function profileProgress() {
  const p = state.profile || {};
  const checks = [
    p.first_name,
    p.birth_date,
    p.gender,
    Array.isArray(p.seeking) && p.seeking.length,
    p.city,
    p.zip,
    p.relationship_goal,
    Array.isArray(p.prompts) && p.prompts.length >= 2 && p.prompts[0]?.answer && p.prompts[1]?.answer,
    p.eligibility && ELIGIBILITY_KEYS.every((key) => p.eligibility[key] === true),
    p.pledge_accepted_at,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function missingFields() {
  const p = state.profile || {};
  const missing = [];
  if (!p.first_name) missing.push("first name");
  if (!p.birth_date) missing.push("date of birth");
  if (p.birth_date && ageFromBirthDate(p.birth_date) < 18) missing.push("18+ birthday");
  if (!p.gender) missing.push("gender");
  if (!p.seeking?.length) missing.push("who you want to meet");
  if (!p.city) missing.push("city");
  if (!p.zip) missing.push("ZIP");
  if (!p.relationship_goal) missing.push("relationship goal");
  if (!p.prompts || p.prompts.length < 2 || !p.prompts[0]?.answer || !p.prompts[1]?.answer) missing.push("two prompts");
  if (!p.eligibility || !ELIGIBILITY_KEYS.every((key) => p.eligibility[key] === true)) missing.push("No-Kids Clause");
  if (!p.pledge_accepted_at) missing.push("community pledge");
  return missing;
}

async function init() {
  startTypingExpiryTimer();
  const urlAuthError = authErrorFromUrl();
  if (urlAuthError) state.error = urlAuthError;
  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  state.user = data.session?.user ?? null;
  supabase.auth.onAuthStateChange((event, session) => {
    const sameUser = (session?.user?.id ?? null) === (state.user?.id ?? null);
    state.session = session;
    state.user = session?.user ?? null;
    // Token refreshes and tab refocus keep the same person signed in: don't redraw and wipe what they're typing.
    if (sameUser && event !== "USER_UPDATED") return;
    if (!sameUser) {
      state.saving = false;
      state.publicProfile = loadPublicDraft(state.user);
      state.publicGateOpen = false;
      state.signInOpen = false;
      state.agreementOpen = false;
      state.error = "";
      state.message = "";
      state.landingFor = null;
      state.resumedFor = null;
      state.setupOverview = false;
      state.viewing = null;
      state.viewingMatch = null;
      state.selectedMatch = null;
      state.plan = null;
      state.plannerOpen = false;
      state.chatMenuOpen = false;
      state.cards = state.matches = state.likes = state.messages = null;
    }
    // Supabase recommends leaving the auth callback before making more Supabase calls.
    setTimeout(load, 0);
  });
  await load();
}

async function load() {
  const currentError = state.error;
  state.error = "";
  state.message = "";
  if (currentError) state.error = currentError;
  if (!state.user) {
    state.profile = null;
    state.photos = [];
    renderAuth();
    return;
  }
  await loadProfile();
  const landing = accountLanding(state.profile?.status);
  const landingKey = `${state.user.id}:${state.profile?.status}`;
  const firstLanding = state.landingFor !== landingKey;
  // Show the account's status first. Members choose when to reopen their saved editor.
  if (state.profile && landing === "setup") {
    await resumeOnboarding();
    if (firstLanding) state.setupOverview = true;
    state.signInOpen = false;
    state.landingFor = landingKey;
    renderAuth();
    return;
  }
  state.setupOverview = false;
  state.signInOpen = false;
  if (firstLanding) state.tab = landing;
  state.landingFor = landingKey;
  renderApp();
}

// Bring answers typed on this phone before sign-in onto the account, then reopen the right step.
async function resumeOnboarding() {
  const merged = mergeDrafts(state.profile, loadPublicDraft(state.user));
  if (hasUnsavedAnswers(state.profile, merged)) {
    const error = await saveDraftToServer(supabase, state.user.id, merged);
    if (error) state.error = `Some answers from this phone could not be saved to your account yet: ${error.message}`;
  }
  state.publicProfile = { ...merged, email: state.user.email || merged.email || "" };
  savePublicDraft();
  state.publicGateOpen = true;
  state.agreementOpen = false;
  if (state.resumedFor !== state.user.id) {
    state.publicStep = resumeStep(merged);
    state.resumedFor = state.user.id;
  }
  if (state.profile.status === "changes_requested" && !state.error) {
    state.message = `Changes requested: ${state.profile.review_note || "Please update your profile."}`;
  }
}

async function loadProfile() {
  let { data, error } = await supabase
    .from("profiles")
    .select("*, profile_photos(*)")
    .eq("id", state.user.id)
    .maybeSingle();
  if (!error && !data) {
    const created = await createMissingProfileDraft();
    if (created.error) {
      error = created.error;
    } else {
      data = created.data;
    }
  }
  if (error) {
    state.error = error.message;
    state.profile = null;
    state.photos = [];
    return;
  }
  if (!data) {
    state.error = "Your account was created, but the profile draft is not ready yet. Refresh in a moment.";
    state.profile = null;
    state.photos = [];
    return;
  }
  state.profile = data;
  state.photos = [...(data.profile_photos || [])].sort((a, b) => a.position - b.position);
  await loadPhotoUrls();
}

function authErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const error = params.get("error_description") || hash.get("error_description") || params.get("error") || hash.get("error");
  if (!error) return "";
  const clean = String(error).replaceAll("+", " ");
  if (/provider|google/i.test(clean)) return friendlyAuthError(clean);
  return clean;
}

function googleNameFromUser() {
  const meta = state.user?.user_metadata || {};
  const raw = meta.first_name || meta.given_name || meta.full_name || meta.name || "";
  return String(raw).trim().split(/\s+/)[0]?.slice(0, 40) || null;
}

async function createMissingProfileDraft() {
  const local = loadPublicDraft(state.user);
  const draft = mergeDrafts({ first_name: googleNameFromUser() }, local);
  const { error } = await supabase.from("profiles").insert({ id: state.user.id, ...profilePatch(draft) });
  if (error && !/duplicate key|already exists/i.test(error.message || "")) return { data: null, error };
  const result = await supabase
    .from("profiles")
    .select("*, profile_photos(*)")
    .eq("id", state.user.id)
    .maybeSingle();
  return { data: result.data, error: result.error };
}

async function loadPhotoUrls() {
  if (!state.photos.length) return;
  const signed = await Promise.all(state.photos.map(async (photo) => {
    const { data } = await supabase.storage.from("profile-photos").createSignedUrl(photo.storage_path, 3600);
    return { ...photo, url: data?.signedUrl || "" };
  }));
  state.photos = signed;
}

async function signedPhotoMap(paths) {
  const unique = [...new Set((paths || []).filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase.storage.from("profile-photos").createSignedUrls(unique, 3600);
  if (error) return {};
  return Object.fromEntries((data || []).map((item) => [item.path, item.signedUrl || ""]));
}

async function hydrateCards(cards) {
  const paths = cards.flatMap((card) => card.photo_paths || []);
  const urls = await signedPhotoMap(paths);
  return cards.map((card) => ({ ...card, photo_urls: (card.photo_paths || []).map((path) => urls[path]).filter(Boolean) }));
}

async function hydrateMatches(matches) {
  const urls = await signedPhotoMap(matches.map((match) => match.other_photo_path));
  return matches.map((match) => ({ ...match, other_photo_url: urls[match.other_photo_path] || "" }));
}

function requiresApproved() {
  if (state.profile?.status === "approved") return false;
  state.error = "Discover, matches, and chat unlock after founder approval.";
  return true;
}

async function signIn(email) {
  state.signInOpen = true;
  state.error = "";
  state.message = "";
  state.saving = true;
  renderAuth();
  const redirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.signInWithOtp({
    email: String(email || "").trim(),
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  state.saving = false;
  if (error) {
    const message = error.message || "";
    state.error = message.toLowerCase().includes("rate limit")
      ? "Sign-in email is temporarily at its sending limit. The app is connected; the founder needs to enable custom SMTP in Supabase or wait for the email limit to reset."
      : message;
  }
  else state.message = "Check your email for the No Seeds sign-in link.";
  renderAuth();
}

async function signOut() {
  state.signInOpen = false;
  state.publicGateOpen = false;
  state.agreementOpen = false;
  state.publicProfile = emptyPublicProfile();
  await supabase.auth.signOut();
}

async function submitBetaApplication(form) {
  state.error = "";
  state.message = "";
  state.saving = true;
  renderAuth();
  const data = new FormData(form);
  const email = String(data.get("intake_email") || "").trim().toLowerCase();
  const firstName = String(data.get("intake_first_name") || "").trim();
  const city = String(data.get("intake_city") || "").trim();
  const promise = data.get("intake_promise") === "on";
  if (!email || !promise) {
    state.saving = false;
    state.error = "Add your email and confirm the No-Kids Clause to join the beta list.";
    renderAuth();
    return;
  }
  const payload = {
    email,
    first_name: firstName || null,
    city: city || null,
    profile: {
      first_name: firstName || null,
      city: city || null,
      no_kids_clause: true,
      source_url: window.location.href,
      captured_at: new Date().toISOString(),
    },
  };
  const { error } = await supabase.from("beta_applications").insert(payload);
  state.saving = false;
  if (error) {
    state.error = error.message.includes("beta_applications")
      ? "The beta intake table is not ready yet. Ask the founder to run the beta_applications SQL, then try again."
      : error.message;
  } else {
    form.reset();
    state.message = "You're on the No Seeds beta list. We saved your email so you do not have to start from zero later.";
  }
  renderAuth();
}

function formToProfile(form) {
  const data = new FormData(form);
  const p = state.profile || {};
  const payload = {
    first_name: p.first_name ?? null,
    birth_date: p.birth_date ?? null,
    gender: p.gender ?? null,
    seeking: Array.isArray(p.seeking) ? p.seeking : [],
    age_min: p.age_min || 25,
    age_max: p.age_max || 70,
    city: p.city ?? null,
    zip: p.zip ?? null,
    relationship_goal: p.relationship_goal ?? null,
    marriage_view: p.marriage_view ?? null,
    bio: p.bio ?? null,
    prompts: Array.isArray(p.prompts) ? [...p.prompts] : [],
    basics: {...(p.basics || {})},
    interests: Array.isArray(p.interests) ? p.interests : [],
    compatibility: {...(p.compatibility || {})},
    eligibility: {...(p.eligibility || {})},
    pledge_accepted_at: p.pledge_accepted_at ?? null,
  };
  const setText = (key) => {
    if (data.has(key)) payload[key] = String(data.get(key) || "").trim() || null;
  };
  const setRaw = (key) => {
    if (data.has(key)) payload[key] = data.get(key) || null;
  };
  const setNumber = (key, fallback) => {
    if (data.has(key)) payload[key] = Number(data.get(key) || fallback);
  };
  ["first_name", "city", "zip", "relationship_goal", "marriage_view", "bio"].forEach(setText);
  ["birth_date", "gender"].forEach(setRaw);
  setNumber("age_min", 25);
  setNumber("age_max", 70);
  if (form.querySelector('[name="seeking"]')) payload.seeking = data.getAll("seeking");
  if (data.has("interests")) {
    payload.interests = data.getAll("interests")
      .flatMap((item) => String(item || "").split(","))
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  ["faith", "spendingStyle", "lifestylePace", "travelDistance", "willingToFly"].forEach((key) => {
    if (data.has(key)) payload.basics[key] = String(data.get(key) || "").trim();
  });
  ["childfreeLife", "familyBoundaries", "idealDate"].forEach((key) => {
    if (data.has(key)) payload.compatibility[key] = String(data.get(key) || "").trim();
  });
  ELIGIBILITY_KEYS.forEach((key) => {
    if (form.querySelector(`[name="${key}"]`)) payload.eligibility[key] = data.get(key) === "on";
  });
  if (form.querySelector('[name="pledge"]')) {
    const pledged = data.get("pledge") === "on";
    payload.pledge_accepted_at = pledged ? (p.pledge_accepted_at || new Date().toISOString()) : null;
  }
  [0, 1].forEach((index) => {
    if (data.has(`prompt_${index}_id`) || data.has(`prompt_${index}_answer`)) {
      payload.prompts[index] = {
        id: String(data.get(`prompt_${index}_id`) || payload.prompts[index]?.id || PROMPTS[index][0]),
        answer: String(data.get(`prompt_${index}_answer`) || "").trim(),
      };
    }
  });
  payload.prompts = payload.prompts.filter((prompt) => prompt?.id && prompt?.answer);
  return payload;
}

async function saveProfile(form, { submit = false, advance = false } = {}) {
  if (!state.profile) return;
  if (state.profile.status === "removed") {
    state.error = "This profile has been removed and cannot be edited.";
    renderApp();
    return;
  }
  state.saving = true;
  state.error = "";
  state.message = "";
  renderApp();
  const payload = formToProfile(form);
  if (!submit && state.profile.status === "approved" && PROFILE_STEPS[state.profileStep]?.[0] === "location") {
    await updateLocationFromForm(form, { advance });
    return;
  }
  if (submit) {
    const missing = missingFieldsForPayload(payload);
    if (missing.length) {
      state.saving = false;
      state.error = `Before submitting, finish: ${missing.join(", ")}.`;
      renderApp();
      return;
    }
  }
  if (submit) payload.status = "submitted";
  const { error } = await supabase.from("profiles").update(payload).eq("id", state.user.id);
  state.saving = false;
  if (error) {
    state.error = error.message;
  } else {
    state.message = submit ? "Your profile is submitted for founder review." : "Profile saved.";
    await loadProfile();
    if (advance) state.profileStep = Math.min(PROFILE_STEPS.length - 1, state.profileStep + 1);
    if (submit && !state.error) state.tab = "status";
  }
  renderApp();
}

function locationPayloadFromForm(form) {
  const data = new FormData(form);
  return {
    city: String(data.get("city") || "").trim(),
    zip: String(data.get("zip") || "").replace(/\D/g, "").slice(0, 5),
    age_min: Number(data.get("age_min") || state.profile?.age_min || state.publicProfile?.age_min || 25),
    age_max: Number(data.get("age_max") || state.profile?.age_max || state.publicProfile?.age_max || 70),
    travelDistance: String(data.get("travelDistance") || state.profile?.basics?.travelDistance || state.publicProfile?.basics?.travelDistance || "").trim(),
    willingToFly: String(data.get("willingToFly") || state.profile?.basics?.willingToFly || state.publicProfile?.basics?.willingToFly || "").trim(),
  };
}

async function updateLocationArea(body, { publicFlow = false, advance = false } = {}) {
  if (!state.user) {
    state.error = "Sign in first, or type your city and ZIP manually.";
    publicFlow ? renderAuth() : renderApp();
    return;
  }
  state.saving = true;
  state.error = "";
  state.message = "";
  publicFlow ? renderAuth() : renderApp();
  const { data, error } = await supabase.functions.invoke("update-location", { body });
  state.saving = false;
  if (error) {
    let detail = "";
    try { detail = (await error.context?.json())?.error || ""; } catch { /* keep fallback */ }
    state.error = detail || "We could not update your dating area. Type your city and ZIP instead.";
  } else {
    const patch = {
      city: data.city,
      zip: data.zip,
      age_min: data.age_min || body.age_min || state.profile?.age_min || state.publicProfile?.age_min,
      age_max: data.age_max || body.age_max || state.profile?.age_max || state.publicProfile?.age_max,
      basics: { ...((state.profile || state.publicProfile)?.basics || {}), ...(data.basics || {}) },
    };
    if (state.profile) state.profile = { ...state.profile, ...patch };
    state.publicProfile = { ...(state.publicProfile || emptyPublicProfile()), ...patch };
    savePublicDraft();
    state.cards = null;
    state.likes = null;
    state.matches = null;
    state.message = "Dating area updated. Members only see your general city.";
    if (advance) state.profileStep = Math.min(PROFILE_STEPS.length - 1, state.profileStep + 1);
  }
  publicFlow ? renderAuth() : renderApp();
}

async function updateLocationFromForm(form, options = {}) {
  await updateLocationArea(locationPayloadFromForm(form), options);
}

function useCurrentArea({ publicFlow = false } = {}) {
  if (!navigator.geolocation) {
    state.error = "This device does not support location permission. Type your city and ZIP instead.";
    publicFlow ? renderAuth() : renderApp();
    return;
  }
  if (!state.user) {
    state.error = "Sign in first, or type your city and ZIP manually.";
    publicFlow ? renderAuth() : renderApp();
    return;
  }
  state.saving = true;
  state.error = "";
  state.message = "Asking for one-time permission. We save only your general area.";
  publicFlow ? renderAuth() : renderApp();
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const form = document.querySelector("#intake-form, #profile-form");
      const base = form ? locationPayloadFromForm(form) : {};
      void updateLocationArea({
        ...base,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city: "",
        zip: "",
      }, { publicFlow });
    },
    () => {
      state.saving = false;
      state.error = "Location permission was not completed. Type your city and ZIP instead.";
      publicFlow ? renderAuth() : renderApp();
    },
    { enableHighAccuracy: false, maximumAge: 0, timeout: 12000 }
  );
}

function missingFieldsForPayload(p) {
  const missing = [];
  if (!p.first_name) missing.push("first name");
  if (!p.birth_date) missing.push("date of birth");
  if (p.birth_date && ageFromBirthDate(p.birth_date) < 18) missing.push("18+ birthday");
  if (!p.gender) missing.push("gender");
  if (!p.seeking?.length) missing.push("who you want to meet");
  if (!p.city) missing.push("city");
  if (!p.zip) missing.push("ZIP");
  if (!p.relationship_goal) missing.push("relationship goal");
  if (!p.prompts || p.prompts.length < 2 || !p.prompts[0]?.answer || !p.prompts[1]?.answer) missing.push("two prompts");
  if (!p.eligibility || !ELIGIBILITY_KEYS.every((key) => p.eligibility[key] === true)) missing.push("No-Kids Clause");
  if (!p.pledge_accepted_at) missing.push("community pledge");
  return missing;
}

function formToPublicProfile(form) {
  const previous = state.publicProfile || emptyPublicProfile();
  const originalProfile = state.profile;
  state.profile = previous;
  const payload = formToProfile(form);
  state.profile = originalProfile;
  const data = new FormData(form);
  if (data.has("intake_email")) payload.email = String(data.get("intake_email") || "").trim().toLowerCase();
  return { ...previous, ...payload };
}

// Every step saves on this phone at once, and to the member's own profile whenever they are signed in.
async function savePublicApplication(form, { submit = false, advance = false } = {}) {
  state.error = "";
  state.message = "";
  state.publicProfile = formToPublicProfile(form);
  savePublicDraft();

  if (submit) {
    const missing = missingFieldsForPayload(state.publicProfile);
    if (missing.length) {
      state.error = `Before submitting, finish: ${missing.join(", ")}.`;
      renderAuth();
      return;
    }
    if (!state.user) {
      state.error = `Open the sign-in link we emailed to ${state.publicProfile.email || "you"} to submit. Your answers are saved on this phone.`;
      renderAuth();
      return;
    }
    const submitUserId = state.user.id;
    const submittedDraft = structuredClone(state.publicProfile);
    state.saving = true;
    renderAuth();
    try {
      const draftError = await saveDraftToServer(supabase, submitUserId, submittedDraft);
      if (draftError) throw new Error(draftError.message);
      if (state.user?.id !== submitUserId) return;
      if (!await ensureAgreements(supabase, app, { userId: submitUserId, url: SUPABASE_URL, key: SUPABASE_ANON_KEY })) {
        if (state.user?.id !== submitUserId) return;
        state.saving = false;
        renderAuth();
        return;
      }
    } catch (error) {
      if (state.user?.id !== submitUserId) return;
      state.saving = false;
      state.error = error.message;
      renderAuth();
      return;
    }
    if (state.user?.id !== submitUserId) return;
    const error = await submitProfile(supabase, submitUserId, submittedDraft);
    if (state.user?.id !== submitUserId) return;
    state.saving = false;
    if (error) {
      state.error = error.message;
      renderAuth();
      return;
    }
    localStorage.removeItem("noSeedsPublicDraft");
    localStorage.removeItem("freeMidnightPublicDraft");
    localStorage.removeItem(`noSeedsAccountDraft:${state.user.id}`);
    state.publicProfile = emptyPublicProfile();
    state.publicStep = 0;
    state.publicGateOpen = false;
    state.tab = "status";
    await load();
    return;
  }

  if (state.user) {
    state.saving = true;
    renderAuth();
    const error = await saveDraftToServer(supabase, state.user.id, state.publicProfile);
    state.saving = false;
    if (error) {
      state.error = `Saved on this phone, but not to your account yet: ${error.message}`;
      renderAuth();
      return;
    }
  } else if (state.publicStep === 0 && state.publicProfile.email && state.publicProfile.link_sent_to !== state.publicProfile.email) {
    // "Create your account": the emailed link creates the account (with first name and birthday) and signs them in.
    state.saving = true;
    renderAuth();
    const { error } = await startAccount(supabase, state.publicProfile, `${window.location.origin}/`);
    state.saving = false;
    if (error) {
      state.error = friendlyAuthError(error);
      renderAuth();
      return;
    }
    state.publicProfile.link_sent_to = state.publicProfile.email;
    savePublicDraft();
    state.message = `We emailed a sign-in link to ${state.publicProfile.email}. Keep going: your answers are saved on this phone and move to your account when you open that link.`;
  }

  if (advance) state.publicStep = Math.min(PROFILE_STEPS.length - 1, state.publicStep + 1);
  else if (state.user) {
    state.publicStep = resumeStep(state.publicProfile);
    state.setupOverview = true;
    state.message = "Your progress is saved. Continue whenever you're ready.";
  }
  renderAuth();
}

async function reencodeImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fffaf3";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("We could not prepare that photo. Try another image.");
  return blob;
}

async function uploadPhoto(file, { publicFlow = false } = {}) {
  if (!file || !state.user || state.saving) return;
  const redraw = () => publicFlow ? renderAuth() : renderApp();
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    state.error = "Use a JPEG, PNG, or WebP photo.";
    redraw();
    return;
  }
  if (state.photos.length >= 6) {
    state.error = "You can add up to 6 photos.";
    redraw();
    return;
  }
  state.saving = true;
  state.error = "";
  state.message = "";
  redraw();
  const position = [0, 1, 2, 3, 4, 5].find((slot) => !state.photos.some((photo) => photo.position === slot));
  try {
    const prepared = await reencodeImage(file);
    if (prepared.size > 5 * 1024 * 1024) throw new Error("Photos must be under 5 MB after processing.");
    const path = `${state.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
    const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, prepared, { upsert: false, contentType: "image/jpeg" });
    if (uploadError) throw uploadError;
    const { error: rowError } = await supabase.from("profile_photos").insert({
      profile_id: state.user.id,
      storage_path: path,
      position,
    });
    if (rowError) {
      try {
        const { error: cleanupError } = await supabase.storage.from("profile-photos").remove([path]);
        if (cleanupError) throw cleanupError;
      } catch {
        throw new Error("Your photo could not be added to your profile, and its stored file could not be deleted. Please contact support.");
      }
      throw rowError;
    }
    state.message = "Photo added.";
    await loadProfile();
  } catch (error) {
    state.error = error.message || "We couldn't upload that photo. Please try again.";
  } finally {
    state.saving = false;
    redraw();
  }
}

async function removePhoto(photo, { publicFlow = false } = {}) {
  if (!state.user || state.saving) return;
  const redraw = () => publicFlow ? renderAuth() : renderApp();
  state.saving = true;
  state.error = "";
  state.message = "";
  redraw();
  try {
    const { error: rowError } = await supabase.from("profile_photos").delete().eq("id", photo.id);
    if (rowError) throw rowError;
    try {
      const { error: storageError } = await supabase.storage.from("profile-photos").remove([photo.storage_path]);
      if (storageError) throw storageError;
      state.message = "Photo removed.";
    } catch {
      state.error = "Your photo was removed from your profile, but its stored file could not be deleted. Please contact support.";
    }
    await loadProfile();
  } catch (error) {
    state.error = error.message || "We couldn't remove that photo. Please try again.";
  } finally {
    state.saving = false;
    redraw();
  }
}

async function loadDiscover({ force = false } = {}) {
  if (requiresApproved() || state.loadingArea) return;
  if (!force && state.cards) return;
  state.loadingArea = "discover";
  state.error = "";
  renderApp();
  const { data, error } = await supabase.rpc("member_cards");
  if (error) state.error = error.message;
  else state.cards = await hydrateCards(data || []);
  state.loadingArea = "";
  renderApp();
}

async function loadMatches({ force = false } = {}) {
  if (requiresApproved() || state.loadingArea) return;
  if (!force && state.likes && state.matches) return;
  state.loadingArea = "matches";
  state.error = "";
  renderApp();
  const [likesResult, matchesResult] = await Promise.all([
    supabase.rpc("likes_received"),
    supabase.rpc("my_matches"),
  ]);
  if (likesResult.error) state.error = likesResult.error.message;
  else state.likes = await hydrateCards(likesResult.data || []);
  if (matchesResult.error) state.error = matchesResult.error.message;
  else state.matches = await hydrateMatches(matchesResult.data || []);
  state.loadingArea = "";
  renderApp();
}

async function loadMessages(match) {
  if (!match || requiresApproved() || state.loadingArea) return;
  if (state.selectedMatch?.match_id !== match.match_id) {
    state.plan = null;
    state.plannerOpen = false;
  }
  state.selectedMatch = match;
  state.chatMenuOpen = false;
  state.tab = "chat";
  state.loadingArea = "chat";
  state.error = "";
  renderApp();
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("match_id", match.match_id)
    .order("created_at");
  if (error) {
    state.error = error.message.includes("row-level")
      ? "This conversation has ended."
      : error.message;
    state.messages = [];
  } else {
    state.messages = data || [];
  }
  await loadTyping(match);
  await loadPlan(match);
  state.loadingArea = "";
  watchChat(match);
  renderApp();
}

async function loadTyping(match) {
  if (!match) return;
  const since = new Date(Date.now() - TYPING_VISIBLE_MS * 2).toISOString();
  const { data } = await supabase
    .from("match_typing")
    .select("member_id, updated_at")
    .eq("match_id", match.match_id)
    .gte("updated_at", since);
  if (state.selectedMatch?.match_id === match.match_id) state.typing = data || [];
}

function otherIsTyping() {
  const now = Date.now();
  return (state.typing || []).some((row) =>
    row.member_id !== state.user?.id && now - new Date(row.updated_at).getTime() < TYPING_VISIBLE_MS
  );
}

function renderTypingBubble(match) {
  if (!otherIsTyping()) return "";
  return `
    <div class="ns-typing" aria-live="polite">
      <span></span><span></span><span></span>
      <em>${escapeHtml(match.other_first_name || "Your match")} is typing...</em>
    </div>
  `;
}

async function markTyping() {
  const match = state.selectedMatch;
  if (!match || !state.user || state.plannerOpen) return;
  const now = Date.now();
  if (now - state.typingUpdatedAt < TYPING_THROTTLE_MS) return;
  state.typingUpdatedAt = now;
  await supabase.from("match_typing").upsert({
    match_id: match.match_id,
    member_id: state.user.id,
    updated_at: new Date().toISOString(),
  });
}

async function clearTyping(match = state.selectedMatch) {
  if (!match || !state.user) return;
  state.typingUpdatedAt = 0;
  state.typing = (state.typing || []).filter((row) => row.member_id !== state.user.id);
  await supabase.from("match_typing").delete().eq("match_id", match.match_id).eq("member_id", state.user.id);
}

function startTypingExpiryTimer() {
  if (state.typingExpiryTimer) clearInterval(state.typingExpiryTimer);
  state.typingExpiryTimer = setInterval(() => {
    const hasOtherTypingRows = (state.typing || []).some((row) => row.member_id !== state.user?.id);
    if (state.tab === "chat" && state.selectedMatch && hasOtherTypingRows) rerenderChat();
  }, 2000);
}

// The match's date plan with its options and who picked each one.
async function loadPlan(match) {
  const { data, error } = await supabase.functions.invoke("date-planner", {
    body: { action: "view", match_id: match.match_id },
  });
  if (state.selectedMatch?.match_id !== match.match_id) return;
  state.plan = error ? null : (data?.plan || null);
  if (error) state.error = "We couldn't load your date plan. Try again in a moment.";
}

async function refreshPlan(match) {
  await loadPlan(match);
  if (state.selectedMatch?.match_id === match.match_id) rerenderChat();
}

// Live updates for the open chat: new messages and date-plan changes appear without reopening.
function watchChat(match) {
  if (state.chatChannelMatch === match.match_id) return;
  stopWatchingChat();
  state.chatChannelMatch = match.match_id;
  const planEvent = () => { if (state.selectedMatch?.match_id === match.match_id) void refreshPlan(match); };
  const typingEvent = () => {
    if (state.selectedMatch?.match_id === match.match_id) {
      void loadTyping(match).then(rerenderChat);
    }
  };
  state.chatChannel = supabase
    .channel(`match-${match.match_id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${match.match_id}` }, ({ new: message }) => {
      if (state.selectedMatch?.match_id !== match.match_id || (state.messages || []).some((m) => m.id === message.id)) return;
      state.messages = [...(state.messages || []), message];
      state.matches = null;
      rerenderChat();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "match_typing", filter: `match_id=eq.${match.match_id}` }, typingEvent)
    .on("postgres_changes", { event: "*", schema: "public", table: "date_plans", filter: `match_id=eq.${match.match_id}` }, planEvent)
    .on("postgres_changes", { event: "*", schema: "public", table: "date_plan_options" }, planEvent)
    .on("postgres_changes", { event: "*", schema: "public", table: "date_plan_picks" }, planEvent)
    .subscribe();
}

function stopWatchingChat() {
  if (typingStopTimer) clearTimeout(typingStopTimer);
  typingStopTimer = null;
  void clearTyping();
  if (state.chatChannel) void supabase.removeChannel(state.chatChannel);
  state.chatChannel = null;
  state.chatChannelMatch = null;
  state.typing = [];
}

// Redraw the chat without losing what the member is typing.
function rerenderChat() {
  const box = document.querySelector(".ns-composer textarea, .ns-plan-custom input:focus");
  const draft = document.querySelector(".ns-composer textarea")?.value || "";
  const focused = document.activeElement === box;
  const daysScroll = document.querySelector(".ns-dp-days")?.scrollLeft || 0;
  const openAdds = [...document.querySelectorAll(".ns-dp-add")].map((d) => d.open);
  const typed = [...document.querySelectorAll(".ns-dp [data-custom] input")].map((i) => [i.name, i.value]);
  renderApp();
  const days = document.querySelector(".ns-dp-days");
  if (days) days.scrollLeft = daysScroll;
  document.querySelectorAll(".ns-dp-add").forEach((d, i) => { if (openAdds[i]) d.open = true; });
  typed.forEach(([name, value]) => { const input = document.querySelector(`.ns-dp [data-custom] input[name="${name}"]`); if (input && value) input.value = value; });
  const again = document.querySelector(".ns-composer textarea");
  if (again) {
    again.value = draft;
    if (focused) again.focus();
  }
}

// ---------- Date planner ----------
const PLAN_MIN_MESSAGES = 5;

function plannerReady() {
  const counts = {};
  (state.messages || []).forEach((m) => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1; });
  return (counts[state.user.id] || 0) >= PLAN_MIN_MESSAGES
    && (counts[state.selectedMatch?.other_id] || 0) >= PLAN_MIN_MESSAGES;
}

function planPromptHidden(match) {
  try {
    const later = Number(localStorage.getItem(`noSeedsPlanLater:${match.match_id}`) || 0);
    return later && (state.messages || []).length < later + 10;
  } catch {
    return false;
  }
}

async function startPlan() {
  const match = state.selectedMatch;
  if (!match || state.saving) return;
  state.saving = true;
  state.error = "";
  rerenderChat();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const { error } = await supabase.functions.invoke("date-planner", { body: { match_id: match.match_id, time_zone: timeZone } });
  state.saving = false;
  if (error) {
    let detail = "";
    try { detail = (await error.context?.json())?.error || ""; } catch { /* keep the generic message */ }
    state.error = detail || "We couldn't start the date planner. Try again in a moment.";
  } else {
    await loadPlan(match);
    state.plannerOpen = true;
  }
  rerenderChat();
  window.scrollTo({ top: 0 });
}

async function togglePick(optionId) {
  const plan = state.plan;
  const option = plan?.date_plan_options?.find((o) => o.id === optionId);
  if (!option || plan.status !== "open") return;
  const mine = (option.date_plan_picks || []).some((pk) => pk.member_id === state.user.id);
  // Show the change straight away; the database is the source of truth and live updates follow.
  option.date_plan_picks = mine
    ? option.date_plan_picks.filter((pk) => pk.member_id !== state.user.id)
    : [...(option.date_plan_picks || []), { member_id: state.user.id }];
  rerenderChat();
  const { error } = mine
    ? await supabase.from("date_plan_picks").delete().eq("option_id", optionId).eq("member_id", state.user.id)
    : await supabase.from("date_plan_picks").insert({ option_id: optionId, member_id: state.user.id });
  if (error) state.error = error.message;
  await refreshPlan(state.selectedMatch);
}

async function addPlanOption(kind, form) {
  const plan = state.plan;
  if (!plan || plan.status !== "open") return;
  const data = new FormData(form);
  let row;
  if (kind === "place") {
    const label = String(data.get("label") || "").trim();
    if (!label) return;
    row = { plan_id: plan.id, kind, label: label.slice(0, 120), created_by: state.user.id };
  } else {
    const when = String(data.get("when") || "");
    const at = when ? new Date(when) : null;
    if (!at || Number.isNaN(at.getTime())) return;
    if (at < new Date()) {
      state.error = "Pick a time in the future.";
      rerenderChat();
      return;
    }
    const label = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(at);
    row = { plan_id: plan.id, kind, label, starts_at: at.toISOString(), created_by: state.user.id };
  }
  // The suggestion is on its way: clear and close the box before the screen redraws.
  form.reset();
  form.closest("details")?.removeAttribute("open");
  if (kind === "time") state.planOtherTime = false;
  state.saving = true;
  state.error = "";
  rerenderChat();
  const { data: added, error } = await supabase.from("date_plan_options").insert(row).select("id").single();
  state.saving = false;
  if (error) state.error = error.message;
  else await supabase.from("date_plan_picks").insert({ option_id: added.id, member_id: state.user.id });
  await refreshPlan(state.selectedMatch);
}

// Open another member's full profile: from a like (card already loaded) or a match (fetched by id).
function openProfileCard(cardId) {
  const card = [...(state.likes || []), ...(state.cards || [])].find((item) => item.id === cardId);
  if (!card) return;
  state.viewing = card;
  state.viewingMatch = null;
  state.error = "";
  renderApp();
}

async function openMatchProfile(matchId) {
  const match = (state.matches || []).find((item) => item.match_id === matchId) || (state.selectedMatch?.match_id === matchId ? state.selectedMatch : null);
  if (!match?.other_id) return;
  state.viewingMatch = match;
  state.viewing = { id: match.other_id, first_name: match.other_first_name, age: match.other_age, city: match.other_city, photo_urls: match.other_photo_url ? [match.other_photo_url] : [], loading: true };
  renderApp();
  const { data, error } = await supabase.rpc("member_cards", { p_ids: [match.other_id] });
  if (state.viewingMatch !== match) return;
  if (error || !data?.length) {
    state.viewing = { ...state.viewing, loading: false, unavailable: true };
  } else {
    const [card] = await hydrateCards(data);
    state.viewing = card;
  }
  renderApp();
}

function closeProfile() {
  state.viewing = null;
  state.viewingMatch = null;
  renderApp();
}

async function reactToProfile(targetId, kind) {
  if (requiresApproved()) return;
  state.saving = true;
  state.error = "";
  renderApp();
  const { error } = await supabase.from("profile_reactions").upsert({
    actor_id: state.user.id,
    target_id: targetId,
    kind,
  });
  if (error) {
    state.error = error.message;
  } else {
    const matched = kind === "like" ? await findMatch(targetId) : null;
    const liked = [...(state.cards || []), ...(state.likes || [])].find((card) => card.id === targetId) || state.viewing;
    if (matched) state.matchMoment = { matchId: matched.id, card: liked };
    state.cards = (state.cards || []).filter((card) => card.id !== targetId);
    state.viewing = null;
    state.viewingMatch = null;
    state.likes = null;
    state.matches = null;
    state.message = matched ? "" : (kind === "like" ? "Like sent." : "Passed.");
  }
  state.saving = false;
  renderApp();
  window.scrollTo({ top: 0 });
}

async function findMatch(targetId) {
  const { data } = await supabase
    .from("matches")
    .select("id")
    .or(`and(user_one.eq.${state.user.id},user_two.eq.${targetId}),and(user_one.eq.${targetId},user_two.eq.${state.user.id})`)
    .eq("status", "active")
    .maybeSingle();
  return data;
}

async function sendMessage(form) {
  const body = String(new FormData(form).get("message") || "").trim();
  if (!body || !state.selectedMatch) return;
  state.saving = true;
  state.error = "";
  await clearTyping();
  renderApp();
  const { error } = await supabase.from("messages").insert({
    match_id: state.selectedMatch.match_id,
    sender_id: state.user.id,
    body,
  });
  state.saving = false;
  if (error) state.error = "This conversation has ended.";
  await loadMessages(state.selectedMatch);
  state.matches = null;
}

async function closeMatch(reason = "unmatched") {
  if (!state.selectedMatch) return;
  await clearTyping();
  state.saving = true;
  state.error = "";
  renderApp();
  const { error } = await supabase.rpc("close_match", { p_match: state.selectedMatch.match_id, p_reason: reason });
  state.saving = false;
  if (error) state.error = error.message;
  else {
    state.message = "Conversation closed.";
    stopWatchingChat();
    state.plan = null;
    state.selectedMatch = null;
    state.messages = null;
    state.matches = null;
    state.tab = "matches";
  }
  renderApp();
}

async function blockMember() {
  if (!state.selectedMatch) return;
  await clearTyping();
  state.saving = true;
  state.error = "";
  renderApp();
  const { error } = await supabase.from("blocks").insert({
    blocker_id: state.user.id,
    blocked_id: state.selectedMatch.other_id,
  });
  state.saving = false;
  if (error) state.error = error.message;
  else {
    state.message = "Member blocked and conversation closed.";
    stopWatchingChat();
    state.plan = null;
    state.selectedMatch = null;
    state.messages = null;
    state.matches = null;
    state.tab = "matches";
  }
  renderApp();
}

async function reportMember(reason, details = "") {
  if (!state.selectedMatch) return;
  state.saving = true;
  state.error = "";
  renderApp();
  const { error } = await supabase.from("reports").insert({
    reporter_id: state.user.id,
    reported_id: state.selectedMatch.other_id,
    match_id: state.selectedMatch.match_id,
    reason,
    details: details.trim() || null,
  });
  state.saving = false;
  if (error) state.error = error.message;
  else state.message = "Report sent for founder review.";
  renderApp();
}

function ensureTabData() {
  if (state.loadingArea || state.profile?.status !== "approved") return;
  if (state.tab === "discover" && state.cards === null) void loadDiscover();
  if ((state.tab === "matches" || (state.tab === "chat" && !state.selectedMatch)) && (state.likes === null || state.matches === null)) void loadMatches();
}

function renderAuth() {
  authVisible = true;
  queueMicrotask(syncBackHistory);
  if (state.user && state.setupOverview) {
    renderSetupOverview();
    return;
  }
  if (!state.user && state.signInOpen) {
    renderSignIn();
    return;
  }
  if (!state.publicGateOpen && !state.message) {
    if (state.agreementOpen) renderAgreement();
    else renderWelcome();
    return;
  }
  app.innerHTML = `
    <main class="screen auth-journey">
      ${renderPublicApplication()}
    </main>
  `;
  document.querySelector("#intake-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const action = event.submitter?.dataset?.action;
    savePublicApplication(event.currentTarget, { submit: action === "submit", advance: action === "next" });
  });
  document.querySelector("[data-public-back]")?.addEventListener("click", onboardingBack);
  document.querySelectorAll("[data-public-jump-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.publicStep = Number(button.dataset.publicJumpStep || 0);
      state.error = "";
      state.message = "";
      renderAuth();
    });
  });
  const interestBoxes = [...document.querySelectorAll('input[name="interests"]')];
  const capInterests = () => {
    const full = interestBoxes.filter((box) => box.checked).length >= 6;
    interestBoxes.forEach((box) => { box.disabled = full && !box.checked; });
  };
  interestBoxes.forEach((box) => box.addEventListener("change", capInterests));
  capInterests();
  document.querySelector("[data-use-current-location]")?.addEventListener("click", () => useCurrentArea({ publicFlow: true }));
  document.querySelector("#photo")?.addEventListener("change", (event) => {
    void uploadPhoto(event.currentTarget.files?.[0], { publicFlow: true });
    event.currentTarget.value = "";
  });
  document.querySelectorAll("[data-remove-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      const photo = state.photos.find((item) => item.id === button.dataset.removePhoto);
      if (photo) void removePhoto(photo, { publicFlow: true });
    });
  });
  document.querySelector("#account-google")?.addEventListener("click", async () => {
    // Keep anything already typed (first name, birthday) so it is there when Google sends them back.
    state.publicProfile = formToPublicProfile(document.querySelector("#intake-form"));
    savePublicDraft();
    state.error = "";
    state.message = "";
    state.saving = true;
    renderAuth();
    const { error } = await startGoogle(supabase, `${window.location.origin}/`);
    if (!error) return; // the browser is on its way to Google
    state.saving = false;
    state.error = friendlyAuthError(error);
    renderAuth();
  });
  document.querySelector("#account-signin")?.addEventListener("click", () => {
    state.publicProfile = formToPublicProfile(document.querySelector("#intake-form"));
    savePublicDraft();
    openSignIn();
  });
  document.querySelector("[data-setup-home]")?.addEventListener("click", () => {
    void savePublicApplication(document.querySelector("#intake-form"));
  });
  setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 0);
}

// Sign-up screens in order: Welcome → Let's be clear → steps 1-10 (signed in: setup summary → steps).
// Returns false on the first screen, where the phone's back should leave the site as normal.
function onboardingBack() {
  if (state.saving) return true;
  const inSteps = state.user ? !state.setupOverview : (state.publicGateOpen || Boolean(state.message));
  state.error = "";
  state.message = "";
  if (!state.user && state.signInOpen) state.signInOpen = false;
  else if (inSteps && state.publicStep > 0) state.publicStep -= 1;
  else if (inSteps && state.user) state.setupOverview = true;
  else if (inSteps) { state.publicGateOpen = false; state.agreementOpen = true; }
  else if (!state.user && state.agreementOpen) state.agreementOpen = false;
  else return false;
  renderAuth();
  window.scrollTo(0, 0);
  return true;
}

// Keep one history entry above the first screen so the phone's back gesture steps back inside sign-up.
let authVisible = false;
function syncBackHistory() {
  if (!authVisible) return;
  const atStart = state.user ? state.setupOverview : !(state.signInOpen || state.agreementOpen || state.publicGateOpen || state.message);
  if (!atStart && !history.state?.nsBack) history.pushState({ ...(history.state || {}), nsBack: true }, "");
}
window.addEventListener("popstate", () => {
  if (authVisible) onboardingBack();
});

function openSignIn() {
  state.signInOpen = true;
  state.message = "";
  state.error = "";
  renderAuth();
}

const CTA_ARROW = `<svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderSignIn() {
  app.innerHTML = `
    <main class="screen auth-journey">
      <form id="signin-form" class="ns-rt">
        <section class="ns-rt-hero">
          <button class="ns-back ns-rt-back" type="button" id="signin-back" ${state.saving ? "disabled" : ""}>${BACK_ICON}<span>Back</span></button>
          ${renderLockup()}
          <h1>Welcome <em>back</em></h1>
          <p>Sign in to pick up where you left off.</p>
        </section>
        <section class="ns-rt-sheet">
          ${notice()}
          <button class="ns-btn-google" type="button" id="signin-google" ${state.saving ? "disabled" : ""}>${GOOGLE_G}<span>Continue with Google</span></button>
          <div class="account-divider"><span></span><em>or use email</em><span></span></div>
          <div class="field account-field">
            <label for="signin-email">Email</label>
            <input id="signin-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com" value="${escapeHtml(state.publicProfile.email || "")}" ${state.saving ? "readonly" : ""} />
          </div>
          <button class="ns-btn-primary" type="submit" ${state.saving ? "disabled" : ""}><span>${state.saving ? "Sending…" : "Email me a sign-in link"}</span>${state.saving ? "" : CTA_ARROW}</button>
          <p class="ns-rt-note"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>No password needed. We'll email you a secure link.</p>
          <p class="ns-rt-switch">New to No Seeds? <button type="button" id="signin-join">Join now</button></p>
        </section>
      </form>
    </main>`;
  const keepEmail = () => {
    state.publicProfile.email = document.querySelector("#signin-email").value.trim().toLowerCase();
  };
  document.querySelector("#signin-form").addEventListener("submit", (event) => {
    event.preventDefault();
    keepEmail();
    void signIn(state.publicProfile.email);
  });
  document.querySelector("#signin-google").addEventListener("click", async () => {
    keepEmail();
    state.saving = true;
    state.error = "";
    state.message = "";
    renderAuth();
    const { error } = await startGoogle(supabase, `${window.location.origin}/`);
    if (!error) return;
    state.saving = false;
    state.error = friendlyAuthError(error);
    renderAuth();
  });
  document.querySelector("#signin-back").addEventListener("click", () => {
    state.signInOpen = false;
    state.publicGateOpen = false;
    state.agreementOpen = false;
    state.message = "";
    state.error = "";
    renderAuth();
  });
  document.querySelector("#signin-join").addEventListener("click", () => {
    keepEmail();
    state.signInOpen = false;
    state.publicGateOpen = false;
    state.agreementOpen = true;
    state.message = "";
    state.error = "";
    renderAuth();
  });
}

// Short names for the setup checklist, in PROFILE_STEPS order.
const SETUP_NAMES = ["Name & birthday", "Gender & who you're seeking", "Location & age range", "Intentions & lifestyle", "The No Seeds Pledge", "Your first prompt", "Your second prompt", "Bio & interests", "Your childfree life", "Photos"];

function renderSetupOverview() {
  const p = state.profile;
  const changesRequested = p.status === "changes_requested";
  const reviewReady = state.publicStep === 9 && state.photos.length > 0;
  const done = reviewReady ? PROFILE_STEPS.length : state.publicStep;
  const firstName = escapeHtml(p.first_name || "");
  const tick = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  app.innerHTML = `
    <main class="screen auth-journey">
      <section class="ns-rt ns-setup-home">
        <section class="ns-rt-hero">
          ${renderLockup()}
          <h1>${changesRequested ? "Update your profile" : "Finish your profile"}</h1>
          <p>${firstName ? `Welcome back, ${firstName}. ` : ""}${changesRequested ? "The founder asked for a few changes. Update your answers and send your profile back." : "Your answers are saved. Finish the last few steps and the founder will review your profile."}</p>
          <div class="ns-rt-progress" role="img" aria-label="${done} of ${PROFILE_STEPS.length} steps done">
            <div class="ns-rt-progress-top"><span>${reviewReady ? "Ready for review" : `Next: ${escapeHtml(SETUP_NAMES[state.publicStep])}`}</span><b>${done} of ${PROFILE_STEPS.length}</b></div>
            <div class="ns-rt-bar"><span style="width:${(done / PROFILE_STEPS.length) * 100}%"></span></div>
          </div>
          <button class="ns-btn-primary" type="button" id="continue-setup"><span>${reviewReady ? "Review and submit" : "Continue setup"}</span>${CTA_ARROW}</button>
        </section>
        <section class="ns-rt-sheet">
          ${notice()}
          ${changesRequested && p.review_note ? `
            <div class="ns-rt-founder"><small>A note from the founder</small><p>${escapeHtml(p.review_note)}</p></div>` : ""}
          <h2>Your profile</h2>
          <ol class="ns-rt-steps">
            ${SETUP_NAMES.map((label, index) => {
              const isDone = index < done;
              const isNext = index === state.publicStep && !reviewReady;
              const meta = index === 9 ? `${state.photos.length} of 6 photos added` : isNext ? "Next" : "";
              return `<li class="${isDone ? "is-done" : ""} ${isNext ? "is-next" : ""}">
                <button type="button" data-setup-step="${index}" ${index <= state.publicStep ? "" : "disabled"}>
                  <span class="ns-rt-dot" aria-hidden="true">${isDone ? tick : index + 1}</span>
                  <span class="ns-rt-label">${escapeHtml(label)}</span>
                  ${meta ? `<span class="ns-rt-meta">${meta}</span>` : ""}
                </button>
              </li>`;
            }).join("")}
          </ol>
          <p class="ns-rt-hint">Tap a finished step to change it, or <button type="button" id="review-answers">review all answers</button>.</p>
          <button class="ns-rt-signout" type="button" id="setup-signout">Sign out</button>
        </section>
      </section>
    </main>`;
  document.querySelector("#continue-setup").addEventListener("click", () => {
    state.setupOverview = false;
    renderAuth();
  });
  document.querySelector("#review-answers").addEventListener("click", () => {
    state.setupOverview = false;
    state.publicStep = 0;
    renderAuth();
  });
  document.querySelectorAll("[data-setup-step]").forEach((button) => button.addEventListener("click", () => {
    state.setupOverview = false;
    state.publicStep = Number(button.dataset.setupStep);
    renderAuth();
    window.scrollTo(0, 0);
  }));
  document.querySelector("#setup-signout").addEventListener("click", signOut);
}

// The one No Seeds logo on a screen: emblem plus live-text wordmark, sharp on every phone.
function renderLockup() {
  return `
    <div class="ns-lockup" role="img" aria-label="No Seeds Dating">
      <img src="./assets/no-seeds-emblem.png" alt="" />
      <span class="ns-wordmark">No Seeds<small>DATING</small></span>
    </div>
  `;
}

function renderWelcome() {
  app.innerHTML = `
    <main class="screen ns-welcome">
      <div class="ns-welcome-photo" aria-hidden="true"></div>
      ${renderLockup()}
      <section class="ns-welcome-copy">
        <h1>Black Singles.</h1>
        <p class="ns-welcome-line">No Kids. Not Now. Not Ever.</p>
        <p class="ns-welcome-sub">Black love. Childfree by choice.</p>
        <button class="ns-btn-primary" type="button" id="welcome-join">Join No Seeds</button>
        <p class="ns-welcome-signin">Already a member? <button type="button" id="welcome-signin">Sign in</button></p>
        <p class="ns-legal-links"><a href="./terms.html" data-legal="terms">Terms</a> · <a href="./privacy.html" data-legal="privacy">Privacy</a> · <a href="./safety.html" data-legal="safety">Safety</a></p>
      </section>
    </main>
  `;
  document.querySelector("#welcome-join")?.addEventListener("click", () => {
    state.agreementOpen = true;
    state.message = "";
    state.error = "";
    renderAuth();
  });
  document.querySelector("#welcome-signin")?.addEventListener("click", () => {
    openSignIn();
  });
}

function renderAgreement() {
  app.innerHTML = `
    <main class="screen gate-screen">
      <section class="gate-hero">
        <button class="ns-back ns-gate-back" type="button" data-gate-back>${BACK_ICON}<span>Back</span></button>
        ${renderLockup()}
        <h1>Let's be <em>clear</em>…</h1>
        <p class="gate-line">Black. Single.<br>Absolutely No Seeds.</p>
        <ul class="pledge-list">
          <li class="pledge-item"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><p>I do not have children of any age.</p></li>
          <li class="pledge-item"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 20v-8M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 14.5c0-3-2.4-5-5.5-5 0 3 2.4 5 5.5 5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><p>I never want biological, adopted, or step children.</p></li>
          <li class="pledge-item"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><p>I understand fence-sitters and parents are removed immediately.</p></li>
        </ul>
        ${notice()}
        <button class="ns-btn-primary gate-cta" type="button" id="open-public-application"><span>I Agree, Let's Go</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <p class="ns-welcome-signin gate-signin">Already a member? <button type="button" id="show-signin">Sign in</button></p>
      </section>
    </main>
  `;
  document.querySelector("#open-public-application")?.addEventListener("click", () => {
    state.publicGateOpen = true;
    state.agreementOpen = false;
    state.message = "";
    state.error = "";
    renderAuth();
  });
  document.querySelector("#show-signin")?.addEventListener("click", () => {
    openSignIn();
  });
  document.querySelector("[data-gate-back]")?.addEventListener("click", onboardingBack);
}

function renderPublicApplication() {
  const p = state.publicProfile || emptyPublicProfile();
  state.publicStep = Math.max(0, Math.min(state.publicStep, PROFILE_STEPS.length - 1));
  const [key, eyebrow, title, subtitle] = PROFILE_STEPS[state.publicStep];
  const finalStep = state.publicStep === PROFILE_STEPS.length - 1;
  const missing = missingFieldsForPayload(p);
  if (!p.email) missing.unshift("email");
  if (state.publicStep === 0) return renderAccountStep(p);
  if (state.publicStep === 1) return renderGenderLookingForStep(p);
  if (state.publicStep === 2) return renderLocationAgeStep(p);
  if (state.publicStep === 3) return renderRelationshipIntentionsStep(p);
  if (state.publicStep === 4) return renderNoKidsClauseStep(p);
  if (state.publicStep === 5) return renderPromptApplicationStep(0, p);
  if (state.publicStep === 6) return renderPromptApplicationStep(1, p);
  if (state.publicStep === 7) return renderStoryApplicationStep(p);
  if (state.publicStep === 8) return renderLifeStep(p);
  if (state.publicStep === 9) return renderReviewStep(p, missing);
  return `
    <form id="intake-form" class="panel flat">
      <div class="step-kicker">PUBLIC APPLICATION · ${eyebrow}</div>
      <h2>${title}</h2>
      <p class="copy">${state.publicStep === 0 ? "No email link needed. This saves a full founder-review application in the database." : subtitle}</p>
      ${renderPublicStepDots()}
      ${renderPublicProfileStep(key, p)}
      <div class="btn-row">
        ${state.publicStep > 0 ? `<button class="btn secondary" type="button" data-public-back ${state.saving ? "disabled" : ""}>Back</button>` : ""}
        <button class="btn secondary" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>Save draft</button>
        <button class="btn dark" type="submit" data-action="${finalStep ? "submit" : "next"}" ${state.saving ? "disabled" : ""}>${finalStep ? "Submit application" : "Continue"}</button>
      </div>
      <p class="copy">${finalStep ? `Missing: ${missing.length ? escapeHtml(missing.join(", ")) : "Ready to submit."}` : "Your answers save on this phone as you continue."}</p>
    </form>
  `;
}

function renderGenderLookingForStep(p) {
  return `
    <form id="intake-form" class="account-screen ns-step ns-choice-step ns-sheet-step">
      <div class="ns-hero">
        ${renderStepTop()}
        <h1>Gender & Looking For</h1>
        <p class="account-tagline">Tell us who you are and who you want to meet.</p>
      </div>
      <div class="ns-sheet">
      ${notice()}
      <div class="choice-group">
        <label>I am a</label>
        <div class="choice-grid">
          ${["Woman", "Man", "Non-binary"].map((item) => choiceRadio("gender", item, p.gender)).join("")}
        </div>
      </div>
      <div class="choice-group">
        <label>I'm looking for <em>Choose all that apply</em></label>
        <div class="choice-grid">
          ${["Woman", "Man", "Non-binary"].map((item) => choiceCheck("seeking", item, p.seeking)).join("")}
        </div>
      </div>
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}><span>Continue</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </form>
  `;
}

function choiceRadio(name, value, selected) {
  const id = `${name}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return `<label class="choice-card" for="${id}"><input id="${id}" type="radio" name="${name}" value="${escapeHtml(value)}" ${selected === value ? "checked" : ""} required><span>${escapeHtml(value)}</span></label>`;
}

function choiceCheck(name, value, selected = []) {
  const id = `${name}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return `<label class="choice-card" for="${id}"><input id="${id}" type="checkbox" name="${name}" value="${escapeHtml(value)}" ${selected?.includes(value) ? "checked" : ""}><span>${escapeHtml(value)}</span></label>`;
}

function renderLocationAgeStep(p) {
  return `
    <form id="intake-form" class="account-screen ns-step ns-location-step">
      ${renderStepTop()}
      <h1>Location & Age</h1>
      <p class="account-tagline">Where you are and who you want to meet.</p>
      ${notice()}
      <div class="ns-location-privacy">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
        <strong>Your privacy stays protected.</strong>
        <span>Members only see your city. We never show live or exact location.</span>
      </div>
      <div class="ns-row-city">
        <div class="field account-field">
          <label for="city">City</label>
          <input id="city" name="city" type="text" autocomplete="address-level2" required value="${escapeHtml(p.city || "")}" placeholder="Atlanta" />
        </div>
        <div class="field account-field">
          <label for="zip">ZIP code</label>
          <input id="zip" name="zip" type="text" inputmode="numeric" autocomplete="postal-code" required maxlength="10" value="${escapeHtml(p.zip || "")}" placeholder="30308" />
        </div>
      </div>
      <div class="choice-group">
        <label>Show me people aged</label>
        <div class="age-row">
          ${ageSelect("age_min", "From", p.age_min || 25)}
          <span class="ns-age-dash" aria-hidden="true">to</span>
          ${ageSelect("age_max", "To", p.age_max || 70)}
        </div>
      </div>
      <div class="choice-group">
        <label>How far will you go for a date?</label>
        <div class="choice-grid ns-grid-4">
          ${["25 mi", "50 mi", "100 mi", "Anywhere"].map((item) => choiceRadio("travelDistance", item, p.basics?.travelDistance)).join("")}
        </div>
      </div>
      <div class="choice-group">
        <label>Willing to fly to meet someone?</label>
        <div class="choice-grid ns-grid-3">
          ${["Yes", "Maybe", "No"].map((item) => choiceRadio("willingToFly", item, p.basics?.willingToFly)).join("")}
        </div>
      </div>
      <button class="ns-btn-quiet ns-location-button" type="button" data-use-current-location ${state.saving ? "disabled" : ""}>Use my current area once</button>
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}><span>Continue</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </form>
  `;
}

function ageSelect(name, label, selected) {
  const options = Array.from({ length: 46 }, (_, index) => index + 25);
  return `
    <div class="field age-field">
      <label for="${name}">${label}</label>
      <select id="${name}" name="${name}" required>
        ${options.map((age) => `<option value="${age}" ${Number(selected) === age ? "selected" : ""}>${age}</option>`).join("")}
      </select>
    </div>
  `;
}

function renderRelationshipIntentionsStep(p) {
  return `
    <form id="intake-form" class="account-screen ns-step ns-intent-step">
      ${renderStepTop()}
      <h1>Intentions & Lifestyle</h1>
      <p class="account-tagline">Be clear about what you're actually open to.</p>
      ${notice()}
      ${intentSelect("relationship_goal", "Relationship goal", p.relationship_goal, GOAL_OPTIONS)}
      ${intentSelect("marriage_view", "Marriage view", p.marriage_view, MARRIAGE_OPTIONS)}
      <p class="ns-section-label">Lifestyle <em>Optional</em></p>
      <div class="ns-row-2">
        ${intentSelect("faith", "Faith", p.basics?.faith, FAITH_OPTIONS, false)}
        ${intentSelect("lifestylePace", "Pace of life", p.basics?.lifestylePace, PACE_OPTIONS, false)}
      </div>
      ${intentSelect("spendingStyle", "Spending style", p.basics?.spendingStyle, SPENDING_OPTIONS, false)}
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}><span>Continue</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </form>
  `;
}

function intentSelect(name, label, value, options, required = true) {
  return `
    <div class="field account-field intent-field">
      <label for="${name}">${label}</label>
      <select id="${name}" name="${name}" ${required ? "required" : ""}>
        <option value="">Choose</option>
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </div>
  `;
}

function renderNoKidsClauseStep(p) {
  return `
    <form id="intake-form" class="account-screen ns-step ns-pledge-step">
      ${renderStepTop()}
      <h1>The No Seeds Pledge</h1>
      <p class="account-tagline">Black. Childfree. Honest about it.</p>
      ${notice()}
      <div class="clause-stack">
        <section class="pledge-group" aria-label="Who this is for">
          <p>Who this is for</p>
          ${clauseChoice("black", "I'm joining a community built for Black singles, and I'll honor what it stands for.", p)}
          ${clauseChoice("noChildren", "I do not have children of any age.", p)}
          ${clauseChoice("neverChildren", "I never want biological, adopted, or step children.", p)}
        </section>
        <section class="pledge-group" aria-label="How we protect the room">
          <p>How we protect the room</p>
          ${clauseChoice("noStepParent", "I am not looking for a parent or step-parent role.", p)}
          ${clauseChoice("honest", "I will be honest about my relationship history and childfree choice.", p)}
          ${clauseChoice("respect", "I will not pressure anyone to change their childfree choice.", p)}
          ${pledgeChoice(p)}
        </section>
      </div>
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>I Agree</button>
    </form>
  `;
}

function clauseChoice(key, label, profile) {
  const id = `clause_${key}`;
  return `
    <label class="clause-card" for="${id}">
      <input id="${id}" type="checkbox" name="${key}" ${profile?.eligibility?.[key] ? "checked" : ""} required>
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function pledgeChoice(profile) {
  return `
    <label class="clause-card pledge-card" for="pledge">
      <input id="pledge" type="checkbox" name="pledge" ${profile?.pledge_accepted_at ? "checked" : ""} required>
      <span>I agree to the No Seeds Community Pledge.</span>
    </label>
  `;
}

function renderPromptApplicationStep(index, p) {
  const prompt = getPrompt(index, p);
  const [, , title, subtitle] = PROFILE_STEPS[state.publicStep];
  return `
    <form id="intake-form" class="account-screen ns-step ns-prompt-step">
      ${renderStepTop()}
      <h1>${escapeHtml(title.replace(/\.$/, ""))}</h1>
      <p class="account-tagline">${escapeHtml(subtitle)}</p>
      ${notice()}
      <div class="field account-field">
        <label for="prompt_${index}_id">Choose a prompt</label>
        <select id="prompt_${index}_id" name="prompt_${index}_id">
          ${PROMPTS.map(([id, text]) => `<option value="${id}" ${prompt.id === id ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
        </select>
      </div>
      <div class="field account-field">
        <label for="prompt_${index}_answer">Your answer</label>
        <textarea id="prompt_${index}_answer" name="prompt_${index}_answer" maxlength="500" placeholder="Answer in your own voice.">${escapeHtml(prompt.answer || "")}</textarea>
      </div>
      <div class="ns-actions">
        <button class="ns-btn-primary" type="submit" data-action="next" ${state.saving ? "disabled" : ""}><span>Continue</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="ns-btn-quiet" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>Save and finish later</button>
      </div>
    </form>
  `;
}

function renderPromptBars() {
  return `<div class="prompt-bars" aria-label="Application step progress">${PROFILE_STEPS.map((step, index) => `<span class="${index < state.publicStep ? "done" : ""} ${index === state.publicStep ? "active" : ""}"></span>`).join("")}</div>`;
}

function renderPhoneTemplateTop() {
  return `
    <div class="phone-status" aria-hidden="true">
      <span>9:41</span>
      <span class="status-icons"><i class="signal-icon"></i><i class="wifi-icon"></i><i class="battery-icon"></i></span>
    </div>
    <div class="prompt-logo-wrap"><img class="prompt-logo" src="./assets/no-seeds-stacked-logo.png" alt="No Seeds Dating" /></div>
  `;
}

function renderReviewStep(p, missing) {
  const [, , title] = PROFILE_STEPS[state.publicStep];
  const age = p.birth_date ? ageFromBirthDate(p.birth_date) : "";
  const initial = escapeHtml((p.first_name || "?").trim().charAt(0).toUpperCase());
  const details = [p.city, p.relationship_goal].filter(Boolean).join(" · ");
  const signedIn = Boolean(state.user);
  const photoCount = state.photos.length;
  return `
    <form id="intake-form" class="account-screen ns-step ns-review-step">
      ${renderStepTop()}
      <h1>${escapeHtml(title.replace(/[.]$/, ""))}</h1>
      <p class="account-tagline">Add up to 6 pictures. Your first photo becomes your profile cover.</p>
      ${notice()}
      <section class="ns-photo-upload" aria-label="Profile photos">
        <div class="ns-photo-upload-head">
          <div>
            <p>Profile photos</p>
            <strong>${photoCount} of 6 added</strong>
          </div>
          <span>${signedIn ? "Private upload" : "Sign in required"}</span>
        </div>
        ${renderPhotos()}
        ${signedIn ? `
          <label class="ns-photo-add" for="photo">
            <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" ${state.saving || photoCount >= 6 ? "disabled" : ""} />
            <span>${photoCount >= 6 ? "6 photos added" : "Add photo"}</span>
          </label>
          <p class="ns-photo-note">JPEG, PNG, or WebP. We re-save images before upload so exact photo data is stripped.</p>
        ` : `
          <p class="ns-review-note">Sign in with Google or your email link to upload private profile photos before submitting.</p>
          <button class="ns-btn-google" type="button" id="account-google" ${state.saving ? "disabled" : ""}>${GOOGLE_G}<span>Continue with Google</span></button>
          <p class="account-signin">Already have an account? <button type="button" id="account-signin">Sign in with email</button></p>
        `}
      </section>
      <article class="ns-preview">
        <div class="ns-preview-photo">${state.photos[0]?.url ? `<img src="${state.photos[0].url}" alt="" />` : `<span>${initial}</span>`}</div>
        <div class="ns-preview-body">
          <h2>${escapeHtml(p.first_name || "Your name")}${age ? `<span>, ${age}</span>` : ""}</h2>
          ${details ? `<p class="ns-preview-meta">${escapeHtml(details)}</p>` : ""}
          <div class="ns-preview-tags"><span>No kids</span><span>No step-parent role</span>${(p.interests || []).slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
          ${p.bio ? `<p class="ns-preview-bio">${escapeHtml(p.bio)}</p>` : ""}
        </div>
      </article>
      ${missing.length
        ? `<p class="ns-review-missing"><strong>Before you submit, finish:</strong> ${escapeHtml(missing.join(", "))}.</p>`
        : `<p class="ns-review-ready">Everything's in. The founder reviews every profile personally before it goes live.</p>`}
      <div class="ns-actions">
        <button class="ns-btn-primary" type="submit" data-action="submit" ${state.saving ? "disabled" : ""}>Submit for review</button>
        <button class="ns-btn-quiet" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>Save and finish later</button>
      </div>
    </form>
  `;
}

function renderLifeStep(p) {
  const [, , title, subtitle] = PROFILE_STEPS[state.publicStep];
  return `
    <form id="intake-form" class="account-screen ns-step ns-life-step">
      ${renderStepTop()}
      <h1>${escapeHtml(title.replace(/[.]$/, ""))}</h1>
      <p class="account-tagline">${escapeHtml(subtitle)}</p>
      ${notice()}
      <div class="field account-field">
        <label for="childfreeLife">My childfree life gives me room for…</label>
        <textarea id="childfreeLife" name="childfreeLife" maxlength="500" placeholder="Travel, business, rest, faith, fitness, art…">${escapeHtml(p.compatibility?.childfreeLife || "")}</textarea>
      </div>
      <div class="ns-actions">
        <button class="ns-btn-primary" type="submit" data-action="next" ${state.saving ? "disabled" : ""}><span>Continue</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="ns-btn-quiet" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>Save and finish later</button>
      </div>
    </form>
  `;
}

function renderStoryApplicationStep(p) {
  const [, , title, subtitle] = PROFILE_STEPS[state.publicStep];
  const chosen = p.interests || [];
  const options = [...INTEREST_OPTIONS, ...chosen.filter((item) => !INTEREST_OPTIONS.includes(item))];
  return `
    <form id="intake-form" class="account-screen ns-step ns-story-step">
      ${renderStepTop()}
      <h1>${escapeHtml(title.replace(/\.$/, ""))}</h1>
      <p class="account-tagline">${escapeHtml(subtitle)}</p>
      ${notice()}
      <div class="field account-field">
        <label for="bio">Bio</label>
        <textarea id="bio" name="bio" maxlength="280" placeholder="Tell members what dating you feels like.">${escapeHtml(p.bio || "")}</textarea>
      </div>
      <div class="choice-group">
        <label>Interests <em>Pick up to 6</em></label>
        <div class="ns-chips">
          ${options.map((item) => {
            const id = `interest_${item.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
            return `<label class="ns-chip" for="${id}"><input id="${id}" type="checkbox" name="interests" value="${escapeHtml(item)}" ${chosen.includes(item) ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`;
          }).join("")}
        </div>
      </div>
      <div class="ns-actions">
        <button class="ns-btn-primary" type="submit" data-action="next" ${state.saving ? "disabled" : ""}><span>Continue</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="ns-btn-quiet" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>Save and finish later</button>
      </div>
    </form>
  `;
}

// Shared top of every application step: back, the one small logo, step count, progress.
const BACK_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderStepTop() {
  const step = state.publicStep + 1;
  const back = `<button class="ns-back" type="button" data-public-back ${state.saving ? "disabled" : ""}>${BACK_ICON}<span>Back</span></button>`;
  return `
    <header class="ns-step-top">
      ${back}
      <img class="ns-step-emblem" src="./assets/no-seeds-emblem.png" alt="No Seeds Dating" />
      <span class="ns-step-count">${step} of ${PROFILE_STEPS.length}</span>
    </header>
    <div class="ns-progress" aria-hidden="true"><span style="width:${(step / PROFILE_STEPS.length) * 100}%"></span></div>
    ${state.user ? `<button class="ns-setup-link" type="button" data-setup-home ${state.saving ? "disabled" : ""}>Back to profile setup</button>` : ""}
  `;
}

const GOOGLE_G = `<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

function renderAccountStep(p) {
  const signedIn = Boolean(state.user);
  return `
    <form id="intake-form" class="account-screen ns-step">
      ${renderStepTop()}
      <h1>${signedIn ? "Your account details" : "Create your account"}</h1>
      <p class="account-tagline">Black singles. No kids. Not now. Not ever.</p>
      ${notice()}
      ${signedIn ? "" : `
        <button class="ns-btn-google" type="button" id="account-google" ${state.saving ? "disabled" : ""}>${GOOGLE_G}<span>Continue with Google</span></button>
        <div class="account-divider"><span></span><em>or use email</em><span></span></div>
      `}
      ${field("first_name", "First name", p.first_name || "", "text", "Your first name")}
      <div class="field account-field">
        <label for="intake_email">Email</label>
        <input id="intake_email" name="intake_email" type="email" autocomplete="email" required value="${escapeHtml(p.email || "")}" placeholder="you@example.com" ${signedIn ? "readonly" : ""} />
      </div>
      <div class="field account-field">
        <label for="birth_date">Date of birth</label>
        <input id="birth_date" name="birth_date" type="date" required value="${escapeHtml(p.birth_date || "")}" />
      </div>
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}><span>Continue</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <p class="ns-consent">By continuing, you agree to our <a href="./terms.html" data-legal="terms">Terms</a> and <a href="./privacy.html" data-legal="privacy">Privacy Policy</a>, and confirm you're 18 or older.</p>
      ${signedIn ? "" : `<p class="account-signin">Already a member? <button type="button" id="account-signin">Sign in</button></p>`}
    </form>
  `;
}

function renderPublicStepDots() {
  return `<div class="step-dots" aria-label="Application step progress">${PROFILE_STEPS.map((step, index) => `<button class="step-dot ${index === state.publicStep ? "active" : ""} ${index < state.publicStep ? "done" : ""}" type="button" data-public-jump-step="${index}" aria-label="${escapeHtml(step[1])}"></button>`).join("")}</div>`;
}

function renderPublicProfileStep(key, p) {
  if (key === "basics") {
    return `
      ${field("intake_email", "Email", p.email || "", "email", "you@example.com")}
      ${field("first_name", "First name", p.first_name || "", "text", "Jessica")}
      ${field("birth_date", "Birth date", p.birth_date || "", "date")}
    `;
  }
  if (key === "photos") {
    return `
      <div class="profile-card mini-preview">
        <div class="profile-photo">Founder Review</div>
        <div class="body">
          <strong>${escapeHtml(p.first_name || "Your profile")}${p.birth_date ? `, ${ageFromBirthDate(p.birth_date)}` : ""}</strong>
          <p class="copy">${escapeHtml([p.city, p.relationship_goal].filter(Boolean).join(" · ") || "Your details will show here.")}</p>
          <div class="chips"><span class="chip">No kids</span><span class="chip">No step-parent role</span></div>
          <p>${escapeHtml(p.bio || "Your bio will show here.")}</p>
        </div>
      </div>
      <p class="copy">Photos come after email sign-in is fully restored, so private images stay protected.</p>
    `;
  }
  return renderProfileStep(key, p);
}

function renderApp() {
  authVisible = false;
  if (!state.profile) {
    app.innerHTML = `<main class="screen"><section class="hero"><h1>Profile loading issue</h1><p>${escapeHtml(state.error || "Try signing out and back in.")}</p><button class="btn primary" id="signout">Sign out</button></section></main>`;
    document.querySelector("#signout")?.addEventListener("click", signOut);
    return;
  }
  if (state.matchMoment) {
    renderMatchMoment();
    return;
  }
  if (state.viewing) {
    app.innerHTML = renderMemberProfile(state.viewing);
    bindAppEvents();
    return;
  }
  app.innerHTML = `
    <main class="screen">
      ${["matches", "discover", "chat", "status", "profile"].includes(state.tab) ? "" : renderHero()}
      ${state.tab === "discover" ? renderDiscover() : ""}
      ${state.tab === "matches" ? renderMatches() : ""}
      ${state.tab === "chat" ? renderChat() : ""}
      ${state.tab === "profile" ? renderProfileForm() : ""}
      ${state.tab === "status" ? renderStatus() : ""}
      ${state.tab === "chat" && state.selectedMatch ? "" : renderTabs()}
    </main>
  `;
  bindAppEvents();
  setTimeout(ensureTabData, 0);
}

function renderHero() {
  const p = state.profile;
  const progress = profileProgress();
  return `
    <section class="hero">
      <div class="topbar">
        <div class="lockup"><div class="brand-mark">NS</div><span>No Seeds</span></div>
        <button class="pill" id="signout">Sign out</button>
      </div>
      <h1>${p.first_name ? `${escapeHtml(p.first_name)}'s profile` : "Build your profile"}</h1>
      <p>${statusLine()}</p>
      <div class="progress" aria-label="Profile progress"><span style="--progress:${progress}%"></span></div>
    </section>
  `;
}

function statusLine() {
  const p = state.profile;
  if (p.status === "submitted") return "Submitted for founder review. You can still view your profile.";
  if (p.status === "approved") return "You're approved. Discover, Matches and Chat are open.";
  if (p.status === "changes_requested") return `Changes requested: ${p.review_note || "Please update your profile."}`;
  if (p.status === "removed") return "This profile has been removed.";
  return "Save your full dating profile. Submit when the required fields are complete.";
}

// My profile, in priority order: you, how complete you are, photos, your profile as members
// see it (each part editable in place), then account items.
const PEN = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function profileStrength(p) {
  const prompts = (p.prompts || []).filter((x) => x?.answer).length;
  const b = p.basics || {};
  const checks = [
    [state.photos.length >= 1, "photo", "Add your main photo"],
    [Boolean(p.relationship_goal && p.city), "intention", "Add your relationship goal"],
    [state.photos.length >= 3, "photo", state.photos.length ? `Add ${3 - state.photos.length} more photo${3 - state.photos.length === 1 ? "" : "s"}` : "Add your first photo"],
    [prompts >= 2, "prompts", prompts ? "Answer your second prompt" : "Answer two prompts"],
    [Boolean(p.bio), "story", "Write a short bio"],
    [(p.interests || []).length >= 3, "story", "Pick at least 3 interests"],
    [Boolean(b.faith || b.lifestylePace || b.spendingStyle), "intention", "Add your lifestyle"],
    [Boolean(p.compatibility?.childfreeLife), "life", "Share what your childfree life makes room for"],
  ];
  const done = checks.filter(([ok]) => ok).length;
  const next = checks.find(([ok]) => !ok);
  return { percent: Math.round((done / checks.length) * 100), next };
}

function editButton(section, label) {
  return `<button class="ns-mp-pen" type="button" data-edit-section="${section}" aria-label="Edit ${label}" ${state.editSection ? "disabled" : ""}>${PEN}</button>`;
}

function sectionEditor(key, title) {
  const p = state.profile;
  return `
    <form id="profile-form" class="ns-step ns-mp-editor">
      <h3>${title}</h3>
      ${key === "prompts" ? `${renderProfileStep("prompt0", p)}${renderProfileStep("prompt1", p)}` : renderProfileStep(key, p)}
      <div class="ns-mp-editor-actions">
        <button class="ns-btn-quiet" type="button" data-edit-cancel>Cancel</button>
        <button class="ns-btn-primary" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>${state.saving ? "Saving…" : "Save"}</button>
      </div>
    </form>`;
}

function renderProfileForm() {
  const p = state.profile;
  const b = p.basics || {};
  const live = p.status === "approved";
  const age = p.birth_date ? ageFromBirthDate(p.birth_date) : "";
  const strength = profileStrength(p);
  const editing = state.editSection;
  const main = state.photos[0]?.url;
  const promptText = (id) => PROMPTS.find(([key]) => key === id)?.[1] || "";
  const prompts = (p.prompts || []).filter((x) => x?.answer);
  const pills = (items) => items.filter(([, v]) => v).map(([icon, v]) => `<li>${BASIC_ICONS[icon]}<span>${escapeHtml(v)}</span></li>`).join("");
  const group = (key, title, items, empty) => editing === key ? sectionEditor(key, title) : `
    <div class="ns-mp-group">
      <div class="ns-mp-group-head"><h4>${title}</h4>${editButton(key, title)}</div>
      ${items ? `<ul>${items}</ul>` : `<button class="ns-mp-empty" type="button" data-edit-section="${key}">+ ${empty}</button>`}
    </div>`;
  const slots = Array.from({ length: 6 }, (_, index) => state.photos[index]);

  return `
    <section class="ns-member-hero ns-mp-hero">
      <div class="ns-member-top">${renderLockup()}</div>
      <div class="ns-mp-me">
        <span class="ns-mp-avatar">${main ? `<img src="${main}" alt="" />` : escapeHtml((p.first_name || "?").charAt(0))}</span>
        <div>
          <h1>${escapeHtml(p.first_name || "My profile")}${age ? `<span>, ${age}</span>` : ""}</h1>
          <p class="ns-mp-state ${live ? "is-live" : ""}"><i></i>${live ? "Live · members can see you" : p.status === "submitted" ? "In review" : escapeHtml(statusLine())}</p>
        </div>
      </div>
    </section>

    <section class="ns-member-sheet ns-mp">
      ${notice()}

      ${strength.percent < 100 ? `
        <div class="ns-mp-strength">
          <div class="ns-mp-strength-top"><b>Profile strength</b><span>${strength.percent}%</span></div>
          <div class="ns-mp-bar"><span style="width:${strength.percent}%"></span></div>
          <p>Complete profiles get more likes. Next: ${escapeHtml(strength.next[2])}.</p>
          ${strength.next[1] === "photo"
            ? `<label class="ns-mp-next" for="photo">${escapeHtml(strength.next[2])}</label>`
            : `<button class="ns-mp-next" type="button" data-edit-section="${strength.next[1]}" ${editing ? "disabled" : ""}>${escapeHtml(strength.next[2])}</button>`}
        </div>` : ""}

      <div class="ns-section-head"><h2>Photos</h2><span class="ns-mp-count">${state.photos.length}/6</span></div>
      <div class="ns-mp-photos">
        ${slots.map((photo, index) => photo
          ? `<figure class="${index === 0 ? "is-main" : ""}">${photo.url ? `<img src="${photo.url}" alt="Your photo ${index + 1}" />` : ""}${index === 0 ? `<em>Main</em>` : ""}
              <button type="button" data-remove-photo="${photo.id}" aria-label="Remove photo ${index + 1}" ${state.saving ? "disabled" : ""}>×</button></figure>`
          : `<label class="ns-mp-add ${index === 0 ? "is-main" : ""}" for="photo" aria-label="Add a photo"><span>+</span>${index === 0 ? `<small>Add your main photo</small>` : ""}</label>`).join("")}
      </div>
      <input id="photo" class="ns-mp-file" type="file" accept="image/jpeg,image/png,image/webp" ${state.saving || state.photos.length >= 6 ? "disabled" : ""} />

      <div class="ns-section-head ns-mp-head"><h2>Your profile</h2><button type="button" class="ns-mp-link" data-preview-self>Preview</button></div>

      ${editing === "story" ? sectionEditor("story", "Bio & interests") : `
        <article class="ns-mp-card">
          <div class="ns-mp-group-head"><h4>About me</h4>${editButton("story", "bio and interests")}</div>
          ${p.bio ? `<p class="ns-mp-bio">${escapeHtml(p.bio)}</p>` : `<button class="ns-mp-empty" type="button" data-edit-section="story">+ Write a short bio</button>`}
          ${(p.interests || []).length ? `<div class="ns-pv-interests">${p.interests.map((i) => `<span>${escapeHtml(i)}</span>`).join("")}</div>` : ""}
        </article>`}

      ${editing === "prompts" ? sectionEditor("prompts", "Prompts") : [0, 1].map((i) => prompts[i] ? `
        <article class="ns-pv-prompt ns-mp-prompt">
          <div class="ns-mp-group-head"><p>${escapeHtml(promptText(prompts[i].id))}</p>${editButton("prompts", "prompts")}</div>
          <h3>${escapeHtml(prompts[i].answer)}</h3>
        </article>` : `<button class="ns-mp-empty ns-mp-empty-card" type="button" data-edit-section="prompts" ${editing ? "disabled" : ""}>+ Answer a prompt</button>`).join("")}

      <article class="ns-mp-card ns-pv-basics">
        <h2>The basics</h2>
        ${group("identity", "Who you are", pills([["heart", p.gender], ["spark", p.seeking?.length ? `Looking for ${p.seeking.join(", ")}` : ""]]), "Add who you're looking for")}
        ${group("location", "Location & travel", pills([["pin", [p.city, p.zip].filter(Boolean).join(" ")], ["clock", p.age_min && p.age_max ? `Ages ${p.age_min}–${p.age_max}` : ""], ["pin", b.travelDistance ? `Travel ${b.travelDistance}` : ""], ["plane", b.willingToFly ? `Fly: ${b.willingToFly}` : ""]]), "Add your location")}
        ${group("intention", "Intentions & lifestyle", pills([["heart", p.relationship_goal], ["ring", p.marriage_view], ["spark", b.faith], ["clock", b.lifestylePace], ["coin", b.spendingStyle]]), "Add your intentions")}
      </article>

      ${editing === "life" ? sectionEditor("life", "Childfree life") : p.compatibility?.childfreeLife ? `
        <article class="ns-pv-prompt ns-mp-prompt">
          <div class="ns-mp-group-head"><p>My childfree life gives me room for…</p>${editButton("life", "childfree life")}</div>
          <h3>${escapeHtml(p.compatibility.childfreeLife)}</h3>
        </article>` : `<button class="ns-mp-empty ns-mp-empty-card" type="button" data-edit-section="life" ${editing ? "disabled" : ""}>+ Share what your childfree life makes room for</button>`}

      <h2 class="ns-mp-account-title">Account</h2>
      <div class="ns-mp-account">
        <button type="button" data-preview-self><span>Preview as members see you</span><b>›</b></button>
        <div><span>No Seeds Pledge</span><b class="ns-mp-locked">${p.pledge_accepted_at ? "Agreed · locked" : "Not agreed"}</b></div>
        <a href="./terms.html" data-legal="terms"><span>Terms of Service</span><b>›</b></a>
        <a href="./privacy.html" data-legal="privacy"><span>Privacy Policy</span><b>›</b></a>
        <a href="./safety.html" data-legal="safety"><span>Safety</span><b>›</b></a>
        <button type="button" id="signout" class="ns-mp-signout"><span>Sign out</span></button>
      </div>
      <p class="ns-mp-help">To change your pledge or delete your account, email thegiftedbystarr@gmail.com.</p>
    </section>
  `;
}

function renderStepDots() {
  return `<div class="step-dots" aria-label="Profile step progress">${PROFILE_STEPS.map((step, index) => `<button class="step-dot ${index === state.profileStep ? "active" : ""} ${index < state.profileStep ? "done" : ""}" type="button" data-jump-step="${index}" aria-label="${escapeHtml(step[1])}"></button>`).join("")}</div>`;
}

function renderProfileStep(key, p) {
  if (key === "basics") {
    return `
      ${field("first_name", "First name", p.first_name || "", "text", "Jessica")}
      ${field("birth_date", "Birth date", p.birth_date || "", "date")}
    `;
  }
  if (key === "identity") {
    return `
      ${select("gender", "Gender", p.gender, ["Woman", "Man", "Non-binary"])}
      <div class="field">
        <label>Seeking</label>
        <div class="checks">
          ${["Woman", "Man", "Non-binary"].map((item) => `<label class="check"><input type="checkbox" name="seeking" value="${item}" ${p.seeking?.includes(item) ? "checked" : ""}> <span>${item}</span></label>`).join("")}
        </div>
      </div>
    `;
  }
  if (key === "location") {
    return `
      <div class="ns-location-privacy is-light">
        <strong>Dating area only.</strong>
        <span>Members see your city, not your ZIP or exact location. Use permission once, or type it yourself.</span>
      </div>
      <div class="grid-2">
        ${field("city", "City", p.city || "", "text", "Atlanta")}
        ${field("zip", "ZIP code", p.zip || "", "text", "30308")}
      </div>
      <div class="grid-2">
        ${field("age_min", "Min age", p.age_min || 25, "number")}
        ${field("age_max", "Max age", p.age_max || 70, "number")}
      </div>
      <div class="grid-2">
        ${select("travelDistance", "Travel distance", p.basics?.travelDistance, ["25 mi", "50 mi", "100 mi", "Anywhere"])}
        ${select("willingToFly", "Willing to fly", p.basics?.willingToFly, ["Yes", "Maybe", "No"])}
      </div>
      <button class="btn secondary ns-location-inline" type="button" data-use-current-location ${state.saving ? "disabled" : ""}>Use current area once</button>
    `;
  }
  if (key === "intention") {
    return `
      ${select("relationship_goal", "Relationship goal", p.relationship_goal, GOAL_OPTIONS)}
      ${select("marriage_view", "Marriage view", p.marriage_view, MARRIAGE_OPTIONS)}
      ${select("faith", "Faith", p.basics?.faith, FAITH_OPTIONS)}
      ${select("lifestylePace", "Pace of life", p.basics?.lifestylePace, PACE_OPTIONS)}
      ${select("spendingStyle", "Spending style", p.basics?.spendingStyle, SPENDING_OPTIONS)}
    `;
  }
  if (key === "clauseA") {
    return `<div class="checks">
      ${clauseCheck("black", "I'm joining a community built for Black singles, and I'll honor what it stands for.", p)}
      ${clauseCheck("noChildren", "I have no biological, adopted, step, or dependent children.", p)}
      ${clauseCheck("neverChildren", "I never want children, not now and not someday.", p)}
      ${clauseCheck("noStepParent", "I am not looking for a parent or step-parent role.", p)}
      ${clauseCheck("honest", "I will be honest about my relationship history and childfree choice.", p)}
      ${clauseCheck("respect", "I will not pressure anyone to change their childfree choice.", p)}
      <label class="check"><input type="checkbox" name="pledge" ${p.pledge_accepted_at ? "checked" : ""}> <span>I agree to the No Seeds Community Pledge.</span></label>
    </div>`;
  }
  if (key === "prompt0") return promptField(0, getPrompt(0, p));
  if (key === "prompt1") return promptField(1, getPrompt(1, p));
  if (key === "story") {
    return `
      ${textarea("bio", "Bio", p.bio || "", "Tell members what dating you feels like.")}
      ${field("interests", "Interests (comma-separated, up to 6)", (p.interests || []).join(", "), "text", "Jazz, travel, fitness")}
    `;
  }
  if (key === "life") {
    return `
      ${textarea("childfreeLife", "My childfree life gives me room for...", p.compatibility?.childfreeLife || "", "Travel, business, rest, faith, fitness, art...")}
    `;
  }
  return `
    ${renderPhotos()}
    <div class="field">
      <label for="photo">Add photo</label>
      <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" />
    </div>
    <div class="profile-card mini-preview">
      <div class="profile-photo">${state.photos[0]?.url ? `<img src="${state.photos[0].url}" alt="Your profile preview" />` : "Preview"}</div>
      <div class="body">
        <strong>${escapeHtml(p.first_name || "Your profile")}${p.birth_date ? `, ${ageFromBirthDate(p.birth_date)}` : ""}</strong>
        <p class="copy">${escapeHtml([p.city, p.relationship_goal].filter(Boolean).join(" · ") || "Your details will show here.")}</p>
        <p>${escapeHtml(p.bio || "Your bio will show here.")}</p>
      </div>
    </div>
  `;
}

function field(name, label, value = "", type = "text", placeholder = "") {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" /></div>`;
}

function textarea(name, label, value = "", placeholder = "") {
  return `<div class="field"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></div>`;
}

function select(name, label, value, options) {
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}"><option value="">Choose</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`;
}

function promptField(index, prompt) {
  return `
    <div class="field">
      <label for="prompt_${index}_id">Prompt ${index + 1}</label>
      <select id="prompt_${index}_id" name="prompt_${index}_id">
        ${PROMPTS.map(([id, text]) => `<option value="${id}" ${prompt.id === id ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
      </select>
      <textarea name="prompt_${index}_answer" placeholder="Answer in your voice.">${escapeHtml(prompt.answer || "")}</textarea>
    </div>
  `;
}

function clauseCheck(key, label, profile = state.profile) {
  return `<label class="check"><input type="checkbox" name="${key}" ${profile?.eligibility?.[key] ? "checked" : ""}> <span>${label}</span></label>`;
}

function renderPhotos() {
  const slots = Array.from({ length: 6 }, (_, index) => state.photos.find((photo) => photo.position === index));
  return `<div class="photo-grid">${slots.map((photo, index) => photo ? `<button class="photo-slot" type="button" data-remove-photo="${photo.id}" aria-label="Remove photo ${index + 1}"><img src="${photo.url}" alt="Profile photo ${index + 1}" /></button>` : `<div class="photo-slot">Photo ${index + 1}</div>`).join("")}</div>`;
}

function renderDiscover() {
  const approved = state.profile.status === "approved";
  const cards = state.cards || [];
  const loading = state.loadingArea === "discover";
  const card = cards[0];
  const summary = !approved
    ? "Unlocks after founder approval."
    : loading ? "Finding people for you…" : cards.length ? `${cards.length} ${cards.length === 1 ? "person" : "people"} to meet` : "You're all caught up";
  const photo = card?.photo_urls?.[0];
  return `
    <section class="ns-member-hero ns-disc-hero">
      <div class="ns-member-top">${renderLockup()}</div>
      <h1>Discover</h1>
      <p>${escapeHtml(summary)}</p>
    </section>
    <section class="ns-member-sheet ns-disc-sheet">
      ${notice()}
      ${!approved ? `
        <div class="ns-empty"><h2>Almost there</h2><p>The founder reviews every profile personally. Once you're approved, compatible members appear here.</p></div>` : ""}
      ${approved && !loading && !card ? `
        <div class="ns-empty"><h2>You're all caught up</h2><p>New approved members join every week. Check back soon.</p><button class="ns-btn-quiet ns-refresh" data-refresh-discover type="button">Refresh</button></div>` : ""}
      ${approved && card ? `
        <article class="ns-disc-card">
          <button class="ns-disc-cover" type="button" data-view-card="${card.id}" aria-label="Open ${escapeHtml(card.first_name || "member")}'s full profile">
            ${photo ? `<img src="${photo}" alt="" />` : `<span class="ns-pv-initial">${escapeHtml((card.first_name || "?").charAt(0))}</span>`}
            <span class="ns-disc-name">
              <strong>${escapeHtml(card.first_name || "Member")}${card.age ? `<em>, ${card.age}</em>` : ""}</strong>
              ${card.city ? `<small><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>${escapeHtml(card.city)}</small>` : ""}
            </span>
          </button>
          <div class="ns-pv-body ns-disc-body">${renderProfileSections(card)}</div>
        </article>
        <div class="ns-disc-actions">
          <button class="ns-round ns-disc-pass" data-react="pass" data-target="${card.id}" type="button" aria-label="Pass on ${escapeHtml(card.first_name || "member")}" ${state.saving ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          </button>
          <button class="ns-round ns-disc-like" data-react="like" data-target="${card.id}" type="button" aria-label="Like ${escapeHtml(card.first_name || "member")}" ${state.saving ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" fill="currentColor"/></svg>
          </button>
        </div>` : ""}
    </section>
  `;
}

function renderMatches() {
  const likes = state.likes || [];
  const matches = state.matches || [];
  const approved = state.profile.status === "approved";
  const loading = state.loadingArea === "matches";
  const waiting = matches.filter((m) => m.last_message && !m.last_message_mine).length;
  const summary = !approved
    ? "Unlocks after founder approval."
    : [`${matches.length} ${matches.length === 1 ? "match" : "matches"}`, likes.length ? `${likes.length} ${likes.length === 1 ? "like" : "likes"} waiting` : "", waiting ? `${waiting} your turn` : ""].filter(Boolean).join(" · ");
  return `
    <section class="ns-member-hero">
      <div class="ns-member-top">${renderLockup()}</div>
      <h1>Matches</h1>
      <p>${escapeHtml(summary)}</p>
    </section>
    <section class="ns-member-sheet">
      ${notice()}
      ${!approved ? `
        <div class="ns-empty">
          <h2>Almost there</h2>
          <p>The founder reviews every profile personally. Your matches and conversations will appear here once you're approved.</p>
        </div>` : `
        ${loading ? `<p class="ns-loading">Loading your matches…</p>` : ""}
        ${likes.length ? `
          <div class="ns-section-head"><h2>Likes you</h2><span>${likes.length}</span></div>
          <div class="ns-like-rail">${likes.map(renderLikeTile).join("")}</div>` : ""}
        <div class="ns-section-head"><h2>Conversations</h2><button type="button" data-refresh-matches>Refresh</button></div>
        ${matches.length
          ? `<div class="ns-convo-list">${matches.map(renderMatchRow).join("")}</div>`
          : `<div class="ns-empty"><h2>No matches yet</h2><p>When someone you like likes you back, your conversation starts here.</p></div>`}
      `}
    </section>
  `;
}

const BASIC_ICONS = Object.fromEntries(Object.entries({
  heart: '<path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/>',
  ring: '<circle cx="12" cy="14.5" r="5.5"/><path d="M9.5 5.5L12 3l2.5 2.5L12 8.5z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.1 0-2-.4-2.5-1.2M12 6.5v1.5M12 16v1.5"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  plane: '<path d="M10.5 13.5L4 11l1.2-1.6 7.1.9 4.2-4.5c.8-.8 2-.8 2.6-.2.6.6.6 1.8-.2 2.6l-4.5 4.2.9 7.1L13.7 21l-2.5-6.5"/>',
}).map(([key, path]) => [key, `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`]));

// Everything about a member below their cover photo; shared by Discover and the profile view.
const TICK = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderProfileSections(card) {
  const photos = card.photo_urls || [];
  const promptText = (id) => PROMPTS.find(([key]) => key === id)?.[1] || "";
  const prompts = (card.prompts || []).filter((item) => item?.answer);
  const basics = card.basics || {};
  const travel = basics.travelDistance === "Anywhere" ? "Will travel anywhere" : basics.travelDistance ? `Will travel ${basics.travelDistance}` : "";
  const fly = { Yes: "Would fly to meet", Maybe: "Might fly to meet", No: "Prefers to stay local" }[basics.willingToFly] || "";
  const pace = basics.lifestylePace === "Balanced" ? "Balanced pace" : basics.lifestylePace;
  const spending = { Balanced: "Balanced spender", "Treat ourselves": "Likes to treat" }[basics.spendingStyle] || basics.spendingStyle;
  const details = [
    ["heart", card.relationship_goal],
    ["ring", card.marriage_view],
    ["spark", basics.faith],
    ["clock", pace],
    ["coin", spending],
    ["pin", travel],
    ["plane", fly],
  ].filter(([, value]) => value);
  const promptCard = (question, answer) => `<article class="ns-pv-prompt"><p>${escapeHtml(question)}</p><h3>${escapeHtml(answer)}</h3></article>`;
  const sections = [
    `<div class="ns-pv-tags"><span>${TICK}No kids</span><span>${TICK}No step-parent role</span></div>${card.bio ? `<p class="ns-pv-bio">${escapeHtml(card.bio)}</p>` : ""}`,
    prompts[0] ? promptCard(promptText(prompts[0].id), prompts[0].answer) : "",
    details.length ? `<div class="ns-pv-basics"><h2>The basics</h2><ul>${details.map(([icon, value]) => `<li>${BASIC_ICONS[icon]}<span>${escapeHtml(value)}</span></li>`).join("")}</ul></div>` : "",
    prompts[1] ? promptCard(promptText(prompts[1].id), prompts[1].answer) : "",
    card.compatibility?.childfreeLife ? promptCard("My childfree life gives me room for…", card.compatibility.childfreeLife) : "",
    (card.interests || []).length ? `<div class="ns-pv-section"><h2>Interests</h2><div class="ns-pv-interests">${card.interests.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></div>` : "",
  ].filter(Boolean);
  // Photo 1 is the cover; photos 2-6 alternate with the sections, and any extras follow the last one.
  const morePhotos = photos.slice(1, 6).map((url) => `<figure class="ns-pv-photo"><img src="${url}" alt="" loading="lazy" /></figure>`);
  const blocks = [];
  sections.forEach((section, index) => {
    blocks.push(section);
    if (index < sections.length - 1 && morePhotos.length) blocks.push(morePhotos.shift());
  });
  return blocks.concat(morePhotos).join("\n");
}

// The moment two members like each other: a full screen, then straight into the conversation.
function renderMatchMoment() {
  const { card } = state.matchMoment;
  const name = escapeHtml(card?.first_name || "your match");
  const face = (url, letter) => url ? `<img src="${url}" alt="" />` : `<span>${escapeHtml(letter || "?")}</span>`;
  const opener = (card?.prompts || []).find((item) => item?.answer);
  const openerQuestion = opener ? PROMPTS.find(([key]) => key === opener.id)?.[1] : "";
  app.innerHTML = `
    <main class="screen ns-mm" role="dialog" aria-modal="true" aria-labelledby="mm-title">
      <div class="ns-mm-glow" aria-hidden="true"></div>
      <div class="ns-mm-top">${renderLockup()}</div>
      <div class="ns-mm-pair" aria-hidden="true">
        <figure class="is-me">${face(state.photos[0]?.url, state.profile.first_name?.charAt(0))}</figure>
        <span class="ns-mm-heart"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" fill="currentColor"/></svg></span>
        <figure class="is-them">${face(card?.photo_urls?.[0], card?.first_name?.charAt(0))}</figure>
      </div>
      <h1 id="mm-title">It's a <em>match</em></h1>
      <p class="ns-mm-line">You and ${name} like each other.</p>
      ${opener ? `
        <div class="ns-mm-idea">
          <small>${openerQuestion ? escapeHtml(openerQuestion) : `${name} shared`}</small>
          <p>“${escapeHtml(opener.answer)}”</p>
          <span>Ask ${name} about this for an easy first message.</span>
        </div>` : ""}
      <div class="ns-mm-actions">
        <button class="ns-btn-primary" type="button" data-mm-chat><span>Send ${name} a message</span><svg class="ns-cta-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="ns-mm-later" type="button" data-mm-close>Keep browsing</button>
      </div>
    </main>
  `;
  window.scrollTo(0, 0);
  document.querySelector("[data-mm-close]").addEventListener("click", () => {
    state.matchMoment = null;
    renderApp();
  });
  document.querySelector("[data-mm-chat]").addEventListener("click", async () => {
    const { matchId } = state.matchMoment;
    state.matchMoment = null;
    state.tab = "matches";
    await loadMatches({ force: true });
    const match = (state.matches || []).find((item) => item.match_id === matchId);
    if (match) loadMessages(match);
  });
}

function renderMemberProfile(card) {
  const photos = card.photo_urls || [];
  const promptText = (id) => PROMPTS.find(([key]) => key === id)?.[1] || "";
  const prompts = (card.prompts || []).filter((item) => item?.answer);
  const basics = card.basics || {};
  const travel = basics.travelDistance === "Anywhere" ? "Will travel anywhere" : basics.travelDistance ? `Will travel ${basics.travelDistance}` : "";
  const fly = { Yes: "Would fly to meet", Maybe: "Might fly to meet", No: "Prefers to stay local" }[basics.willingToFly] || "";
  const pace = basics.lifestylePace === "Balanced" ? "Balanced pace" : basics.lifestylePace;
  const spending = { Balanced: "Balanced spender", "Treat ourselves": "Likes to treat" }[basics.spendingStyle] || basics.spendingStyle;
  const details = [
    ["heart", card.relationship_goal],
    ["ring", card.marriage_view],
    ["spark", basics.faith],
    ["clock", pace],
    ["coin", spending],
    ["pin", travel],
    ["plane", fly],
  ].filter(([, value]) => value);
  const match = state.viewingMatch;
  const fromLike = !match && (state.likes || []).some((item) => item.id === card.id);
  const name = escapeHtml(card.first_name || "Member");
  const extraPhoto = (index) => photos[index] ? `<figure class="ns-pv-photo"><img src="${photos[index]}" alt="" /></figure>` : "";
  return `
    <main class="screen ns-pv">
      <header class="ns-pv-cover">
        ${photos[0] ? `<img src="${photos[0]}" alt="${name}" />` : `<span class="ns-pv-initial">${escapeHtml((card.first_name || "?").charAt(0))}</span>`}
        <button class="ns-pv-back" type="button" data-close-profile aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="ns-pv-name">
          <h1>${name}${card.age ? `<span>, ${card.age}</span>` : ""}</h1>
          ${card.city ? `<p>${escapeHtml(card.city)}</p>` : ""}
        </div>
      </header>
      <section class="ns-pv-body">
        ${notice()}
        ${card.loading ? `<p class="ns-loading">Loading profile…</p>` : ""}
        ${card.unavailable ? `<div class="ns-empty"><h2>Profile unavailable</h2><p>This member's profile can't be shown right now.</p></div>` : ""}
        ${card.loading || card.unavailable ? "" : `
          ${renderProfileSections(card)}
        `}
      </section>
      <footer class="ns-pv-actions">
        ${card.isSelf
          ? `<button class="ns-btn-primary" type="button" data-close-profile>Back to my profile</button>`
          : match
          ? `<button class="ns-btn-primary" type="button" data-open-match="${match.match_id}">Message ${name}</button>`
          : fromLike
            ? `<button class="ns-round ns-round-pass ns-pv-pass" data-react="pass" data-target="${card.id}" type="button" aria-label="Pass" ${state.saving ? "disabled" : ""}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
               <button class="ns-btn-primary" data-react="like" data-target="${card.id}" type="button" ${state.saving ? "disabled" : ""}>Like ${name} back</button>`
            : `<button class="ns-btn-primary" data-react="like" data-target="${card.id}" type="button" ${state.saving ? "disabled" : ""}>Like</button>`}
      </footer>
    </main>
  `;
}

function renderLikeTile(card) {
  const photo = card.photo_urls?.[0];
  return `
    <article class="ns-like-tile" data-card-id="${card.id}">
      <button class="ns-like-photo" type="button" data-view-card="${card.id}" aria-label="View ${escapeHtml(card.first_name || "member")}'s profile">
        ${photo ? `<img src="${photo}" alt="" />` : `<span>${escapeHtml((card.first_name || "?").charAt(0))}</span>`}
        <p><strong>${escapeHtml(card.first_name || "Member")}</strong>${card.age ? ` ${card.age}` : ""}${card.city ? `<small>${escapeHtml(card.city)}</small>` : ""}</p>
      </button>
      <div class="ns-like-actions">
        <button class="ns-round ns-round-pass" data-react="pass" data-target="${card.id}" type="button" aria-label="Pass on ${escapeHtml(card.first_name || "member")}">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
        </button>
        <button class="ns-round ns-round-like" data-react="like" data-target="${card.id}" type="button" aria-label="Like ${escapeHtml(card.first_name || "member")} back">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" fill="currentColor"/></svg>
        </button>
      </div>
    </article>
  `;
}

function timeAgo(value) {
  if (!value) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.round(minutes / 1440)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderChat() {
  const approved = state.profile.status === "approved";
  const match = state.selectedMatch;
  if (!approved || !match) {
    const matches = state.matches || [];
    return `
      <section class="ns-member-hero">
        <div class="ns-member-top">${renderLockup()}</div>
        <h1>Chats</h1>
        <p>${approved ? (matches.length ? "Pick up where you left off." : "Your conversations will live here.") : "Unlocks after founder approval."}</p>
      </section>
      <section class="ns-member-sheet">
        ${notice()}
        ${!approved
          ? `<div class="ns-empty"><h2>Almost there</h2><p>Chat opens once the founder approves your profile and you match with someone.</p></div>`
          : state.loadingArea === "matches" ? `<p class="ns-loading">Loading your chats…</p>`
          : matches.length ? `<div class="ns-convo-list">${matches.map(renderMatchRow).join("")}</div>`
          : `<div class="ns-empty"><h2>No chats yet</h2><p>When you and someone like each other, you can message them here.</p><button class="ns-btn-quiet ns-refresh" data-tab="discover" type="button">Go to Discover</button></div>`}
      </section>
    `;
  }
  const messages = state.messages || [];
  const name = escapeHtml(match.other_first_name || "Match");
  const avatar = match.other_photo_url ? `<img src="${match.other_photo_url}" alt="" />` : escapeHtml((match.other_first_name || "?").charAt(0));
  return `
    <section class="ns-chat">
      <header class="ns-chat-bar">
        <button class="ns-chat-icon" type="button" data-chat-back aria-label="Back to chats">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="ns-chat-who" type="button" data-view-match="${match.match_id}" aria-label="View ${name}'s profile">
          <span class="ns-chat-avatar">${avatar}</span>
          <span><strong>${name}${match.other_age ? `<em>, ${match.other_age}</em>` : ""}</strong><small>${escapeHtml(match.other_city || "View profile")}</small></span>
        </button>
        <button class="ns-chat-icon" type="button" data-chat-menu aria-label="Safety options" aria-expanded="${state.chatMenuOpen}">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>
        </button>
      </header>
      ${state.chatMenuOpen ? `
        <div class="ns-chat-menu">
          <p>Your safety comes first. The founder reviews every report.</p>
          <button type="button" data-report ${state.saving ? "disabled" : ""}>Report ${name}</button>
          <button type="button" data-unmatch ${state.saving ? "disabled" : ""}>Unmatch</button>
          <button type="button" class="is-danger" data-block ${state.saving ? "disabled" : ""}>Block ${name}</button>
        </div>` : ""}
      ${state.plannerOpen && state.plan ? renderPlanner(match) : `
      <div class="ns-chat-thread">
        ${notice()}
        ${state.loadingArea === "chat" ? `<p class="ns-loading">Loading messages…</p>` : ""}
        ${messages.length
          ? `<p class="ns-chat-start">You matched ${escapeHtml(timeAgo(match.matched_at) === "now" ? "just now" : `${timeAgo(match.matched_at)} ago`)}</p>${messages.map(renderMessage).join("")}`
          : state.loadingArea === "chat" ? "" : `
            <div class="ns-chat-empty">
              <span class="ns-chat-avatar is-big">${avatar}</span>
              <h2>You matched with ${name}</h2>
              <p>Say hello. A question about their profile is a great way to start.</p>
            </div>`}
        ${renderTypingBubble(match)}
        ${renderPlanCard(match)}
      </div>`}
      ${state.plannerOpen && state.plan ? "" : `<form id="message-form" class="ns-composer">
        <textarea name="message" rows="1" maxlength="2000" placeholder="Message ${name}…" aria-label="Message" ${state.saving ? "disabled" : ""}></textarea>
        <button type="submit" aria-label="Send" ${state.saving ? "disabled" : ""}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </form>`}
    </section>
  `;
}

function renderMemberCard(card) {
  const photo = card.photo_urls?.[0];
  return `
    <div class="profile-card" data-card-id="${card.id}">
      <div class="profile-photo">${photo ? `<img src="${photo}" alt="${escapeHtml(card.first_name)} profile photo" />` : "Clause Clear"}</div>
      <div class="body">
        <strong>${escapeHtml(card.first_name || "Member")}${card.age ? `, ${card.age}` : ""}</strong>
        <p class="copy">${escapeHtml([card.city, card.relationship_goal].filter(Boolean).join(" · "))}</p>
        <div class="chips">${(card.interests || []).slice(0, 3).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}<span class="chip">No kids</span></div>
        <p>${escapeHtml(card.bio || firstPromptAnswer(card) || "Approved No Seeds member.")}</p>
        <div class="btn-row">
          <button class="btn secondary" data-react="pass" data-target="${card.id}" type="button">Pass</button>
          <button class="btn primary" data-react="like" data-target="${card.id}" type="button">Like</button>
        </div>
      </div>
    </div>
  `;
}

function firstPromptAnswer(card) {
  return Array.isArray(card.prompts) ? card.prompts.find((prompt) => prompt.answer)?.answer : "";
}

function renderMatchRow(match) {
  const yourTurn = match.last_message && !match.last_message_mine;
  const preview = match.last_message
    ? `${match.last_message_mine ? "You: " : ""}${match.last_message}`
    : "New match. Say hello.";
  return `
    <div class="ns-convo ${yourTurn ? "is-your-turn" : ""} ${match.last_message ? "" : "is-new"}">
      <button class="ns-convo-avatar" type="button" data-view-match="${match.match_id}" aria-label="View ${escapeHtml(match.other_first_name || "match")}'s profile">${match.other_photo_url ? `<img src="${match.other_photo_url}" alt="" />` : escapeHtml((match.other_first_name || "?").charAt(0))}</button>
      <button class="ns-convo-main" type="button" data-open-match="${match.match_id}">
      <span class="ns-convo-text">
        <strong>${escapeHtml(match.other_first_name || "Match")}${match.other_age ? `<em>, ${match.other_age}</em>` : ""}</strong>
        <span>${escapeHtml(preview)}</span>
      </span>
      <span class="ns-convo-meta">
        <time>${escapeHtml(timeAgo(match.last_message_at || match.matched_at))}</time>
        ${yourTurn ? `<i>Your turn</i>` : ""}
      </span>
      </button>
    </div>
  `;
}

function planOptions(kind) {
  const options = (state.plan?.date_plan_options || []).filter((o) => o.kind === kind);
  return kind === "time"
    ? options.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    : options.sort((a, b) => (a.created_by ? 1 : 0) - (b.created_by ? 1 : 0) || new Date(a.created_at) - new Date(b.created_at));
}

// Google Maps Platform attribution: required wherever Google place data is shown without a Google map.
const fromGoogle = (option) => option && option.kind !== "time" && !option.created_by && Boolean(option.maps_url || option.rating != null);
const googleCredit = () => `<p class="ns-gmaps-credit" translate="no" aria-label="Google Maps">Google Maps</p>`;
// Some Google results also name third-party data providers; Google requires those to be shown too.
const placeSources = (options) => {
  const seen = new Map();
  options.filter(fromGoogle).flatMap((o) => o.attributions || []).forEach((a) => {
    const name = String(a?.provider || "").trim();
    if (name && !seen.has(name)) seen.set(name, /^https:\/\//.test(a?.providerUri || "") ? a.providerUri : "");
  });
  if (!seen.size) return "";
  return `<p class="ns-dp-sources">Data from ${[...seen].map(([name, uri]) => uri ? `<a href="${escapeHtml(uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>` : escapeHtml(name)).join(", ")}</p>`;
};

function renderPlanCard(match) {
  const plan = state.plan;
  const name = escapeHtml(match.other_first_name || "your match");
  if (plan?.status === "confirmed") {
    const place = plan.date_plan_options?.find((o) => o.id === plan.confirmed_place);
    const time = plan.date_plan_options?.find((o) => o.id === plan.confirmed_time);
    return `
      <article class="ns-plan-card is-confirmed">
        <p class="ns-plan-eyebrow">It's a date</p>
        <h3>${escapeHtml(place?.label || "Your spot")}</h3>
        <p class="ns-plan-when">${escapeHtml(time?.label || "")}</p>
        ${place?.detail ? `<p class="ns-plan-where">${escapeHtml(place.detail)}</p>` : ""}
        ${place?.maps_url ? `<a class="ns-plan-link" href="${escapeHtml(place.maps_url)}" target="_blank" rel="noopener noreferrer">Open in Maps</a>` : ""}
        ${fromGoogle(place) ? googleCredit() : ""}
        <p class="ns-plan-safety">Meet in public, get there on your own, and tell a friend where you'll be.</p>
      </article>`;
  }
  if (plan?.status === "open") {
    const picked = (plan.date_plan_options || []).filter((o) => (o.date_plan_picks || []).some((pk) => pk.member_id === state.user.id)).length;
    const theirs = (plan.date_plan_options || []).filter((o) => (o.date_plan_picks || []).some((pk) => pk.member_id !== state.user.id)).length;
    return `
      <article class="ns-plan-card">
        <p class="ns-plan-eyebrow">Date plan</p>
        <h3>Find a time and place you both like</h3>
        <p>${picked ? `You picked ${picked}` : "You haven't picked yet"} · ${theirs ? `${name} picked ${theirs}` : `${name} hasn't picked yet`}</p>
        <button class="ns-btn-primary" type="button" data-open-planner>Open the date planner</button>
      </article>`;
  }
  if (plannerReady() && !planPromptHidden(match)) {
    return `
      <article class="ns-plan-card is-invite">
        <p class="ns-plan-eyebrow">You two are clicking</p>
        <h3>Ready to meet ${name}?</h3>
        <p>We'll suggest three spots halfway between you, picked from interests you share, and a few times to choose from.</p>
        <button class="ns-btn-primary" type="button" data-start-plan ${state.saving ? "disabled" : ""}>${state.saving ? "Finding spots…" : "Plan a date"}</button>
        <button class="ns-btn-quiet" type="button" data-plan-later>Not yet</button>
      </article>`;
  }
  return "";
}

function renderPlanner(match) {
  const plan = state.plan;
  const name = escapeHtml(match.other_first_name || "Match");
  const initial = escapeHtml((match.other_first_name || "M").charAt(0));
  const open = plan.status === "open";
  const picks = (option) => option.date_plan_picks || [];
  const mine = (option) => picks(option).some((pk) => pk.member_id === state.user.id);
  const theirs = (option) => picks(option).some((pk) => pk.member_id !== state.user.id);
  const whoLabel = (option) => [mine(option) ? "you picked this" : "", theirs(option) ? `${name} picked this` : ""].filter(Boolean).join(", ");
  const places = planOptions("place");
  const times = planOptions("time");
  const tally = (test) => {
    const p = places.filter(test).length, t = times.filter(test).length;
    return p || t ? `${p} ${p === 1 ? "spot" : "spots"} · ${t} ${t === 1 ? "time" : "times"}` : "Not yet";
  };
  const tile = (o) => {
    const at = o.starts_at ? new Date(o.starts_at) : null;
    if (!at || Number.isNaN(at.getTime())) return `<strong class="ns-dp-num">${escapeHtml(o.label)}</strong>`;
    return `<small>${at.toLocaleDateString([], { weekday: "short" })}</small><strong class="ns-dp-num">${at.getDate()}</strong><small>${at.toLocaleDateString([], { month: "short" })}</small><b>${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b>`;
  };
  const bothTime = times.find((o) => mine(o) && theirs(o));
  const bothPlace = places.find((o) => mine(o) && theirs(o));
  const banner = bothTime || bothPlace ? `
    <div class="ns-dp-match" role="status">
      <span class="ns-dp-match-icons" aria-hidden="true"><i class="is-me">✓</i><i class="is-them">${initial}</i></span>
      <p><strong>${bothTime && bothPlace ? "It's a match" : "You're halfway there"}</strong>${bothTime && bothPlace ? "Locking in your date…" : bothTime ? `You both chose ${escapeHtml(bothTime.label)}. Choose the same spot to lock it in.` : `You both like ${escapeHtml(bothPlace.label)}. Choose the same time to lock it in.`}</p>
    </div>` : "";
  const pin = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>`;
  const confirmedPlace = plan.date_plan_options?.find((o) => o.id === plan.confirmed_place);
  const confirmedTime = plan.date_plan_options?.find((o) => o.id === plan.confirmed_time);
  return `
    <div class="ns-dp">
      <section class="ns-dp-hero ${plan.status === "confirmed" ? "is-set" : ""}">
        ${plan.status === "confirmed" ? `
          <p class="ns-dp-set">It's a date</p>
          <h2>${escapeHtml(confirmedPlace?.label || "Your spot")}</h2>
          <p class="ns-dp-when">${escapeHtml(confirmedTime?.label || "")}</p>
          ${confirmedPlace?.detail ? `<p class="ns-dp-mid">${pin}${escapeHtml(confirmedPlace.detail)}</p>` : ""}
          ${confirmedPlace?.maps_url ? `<a class="ns-dp-directions" href="${escapeHtml(confirmedPlace.maps_url)}" target="_blank" rel="noopener noreferrer">Get directions</a>` : ""}
          ${fromGoogle(confirmedPlace) ? googleCredit() + placeSources([confirmedPlace]) : ""}` : `
          <h2>A date with ${name}</h2>
          <p class="ns-dp-mid">${pin}${plan.midpoint_label ? `Halfway between you · ${escapeHtml(plan.midpoint_label)}` : "Somewhere easy for you both"}</p>
          <div class="ns-dp-tally">
            <p><span><i class="is-me">✓</i>You</span><b>${tally(mine)}</b></p>
            <p><span><i class="is-them">${initial}</i>${name}</span><b>${tally(theirs)}</b></p>
          </div>`}
      </section>
      ${notice()}
      ${plan.status === "confirmed" ? "" : `${banner}
      <section class="ns-dp-section">
        <header><h3>Where</h3>${open ? `<p>Choose all that work</p>` : ""}</header>
        <div class="ns-dp-list">
          ${places.map((o) => `
            <div class="ns-dp-row ${mine(o) ? "is-picked" : ""}">
              <button type="button" data-pick="${o.id}" ${open ? "" : "disabled"} aria-pressed="${mine(o)}" aria-label="${escapeHtml(o.label)}${whoLabel(o) ? `, ${whoLabel(o)}` : ""}">
                <span class="ns-dp-check" aria-hidden="true"></span>
                <span class="ns-dp-main">
                  <strong>${escapeHtml(o.label)}${theirs(o) ? ` <i class="is-them" aria-hidden="true">${initial}</i>` : ""}</strong>
                  <small>${[o.rating ? `★ ${o.rating}` : "", o.detail ? escapeHtml(o.detail) : (o.created_by ? `Suggested by ${o.created_by === state.user.id ? "you" : name}` : "")].filter(Boolean).join(" · ")}</small>
                  ${o.reason ? `<em>${escapeHtml(o.reason)}</em>` : ""}
                </span>
              </button>
              ${o.maps_url ? `<a class="ns-dp-map" href="${escapeHtml(o.maps_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(o.label)} in Google Maps">${pin}</a>` : ""}
            </div>`).join("") || `<p class="ns-dp-empty">No spots yet. Suggest one you'd both enjoy.</p>`}
          ${open ? `
            <details class="ns-dp-add">
              <summary><span aria-hidden="true">+</span>Suggest a place</summary>
              <form data-custom="place">
                <input name="label" maxlength="120" placeholder="Name of the place" aria-label="Suggest your own place" />
                <button type="submit" ${state.saving ? "disabled" : ""}>Add</button>
              </form>
            </details>` : ""}
          ${places.some(fromGoogle) ? `<div class="ns-dp-credit">${placeSources(places)}${googleCredit()}</div>` : ""}
        </div>
      </section>
      <section class="ns-dp-section">
        <header><h3>When</h3>${open ? `<p>Swipe for more days</p>` : ""}</header>
        <div class="ns-dp-days">
          ${times.map((o) => `
            <button type="button" class="ns-dp-day ${mine(o) ? "is-picked" : ""} ${mine(o) && theirs(o) ? "is-both" : ""}" data-pick="${o.id}" ${open ? "" : "disabled"} aria-pressed="${mine(o)}" aria-label="${escapeHtml(o.label)}${whoLabel(o) ? `, ${whoLabel(o)}` : ""}">
              ${tile(o)}
              <span class="ns-dp-who" aria-hidden="true">${mine(o) ? `<i class="is-me">✓</i>` : ""}${theirs(o) ? `<i class="is-them">${initial}</i>` : ""}</span>
            </button>`).join("")}
          ${open ? `<button type="button" class="ns-dp-day is-other" data-open-other-time aria-label="Suggest another day or time"><span class="ns-dp-plus">+</span><small>Other day<br>or time</small></button>` : ""}
        </div>
        ${open ? `
          <form class="ns-dp-other" data-custom="time" ${state.planOtherTime ? "" : "hidden"}>
            <input name="when" type="datetime-local" aria-label="Suggest your own day and time" />
            <button type="submit" ${state.saving ? "disabled" : ""}>Add</button>
          </form>` : ""}
      </section>`}
      <p class="ns-dp-safety"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Meet somewhere public, get there on your own, and tell a friend where you'll be.</p>
      <div class="ns-dp-foot">
        ${open ? `<p><i aria-hidden="true"></i>Saved · ${name} sees your picks live</p>` : ""}
        <button class="ns-dp-done" type="button" data-planner-close>Back to chat</button>
      </div>
    </div>
  `;
}

function renderMessage(message) {
  const mine = message.sender_id === state.user.id;
  return `<div class="ns-bubble ${mine ? "is-mine" : ""}"><p>${escapeHtml(message.body)}</p><time>${new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>`;
}

function renderStatus() {
  const p = state.profile;
  const photo = state.photos[0]?.url;
  const age = p.birth_date ? ageFromBirthDate(p.birth_date) : "";
  const copy = {
    submitted: ["You're in review", "The founder reviews every profile personally. You'll be able to meet members as soon as you're approved."],
    approved: ["You're approved", "Welcome to No Seeds. Discover, Matches and Chat are open."],
    changes_requested: ["Almost there", "The founder asked for a few changes before your profile goes live."],
    removed: ["Profile not approved", "Your profile isn't active on No Seeds. Questions? Email thegiftedbystarr@gmail.com."],
  }[p.status] || ["Your profile", "Finish your profile and submit it for review."];
  const stage = { submitted: 1, changes_requested: 1, approved: 2 }[p.status] ?? 0;
  const steps = ["Submitted", "Founder review", "Live"];
  return `
    <section class="ns-member-hero">
      <div class="ns-member-top ns-status-top">${renderLockup()}<button class="ns-status-signout" id="signout" type="button">Sign out</button></div>
      <h1>${escapeHtml(copy[0])}</h1>
      <p>${escapeHtml(copy[1])}</p>
    </section>
    <section class="ns-member-sheet">
      ${notice()}
      ${p.status === "removed" ? "" : `
        <ol class="ns-status-steps">${steps.map((label, i) => `
          <li class="${i < stage || (i === 2 && stage === 2) ? "is-done" : i === stage ? "is-now" : ""}"><span>${i < stage || (i === 2 && stage === 2) ? "✓" : i + 1}</span>${label}</li>`).join("")}
        </ol>`}
      ${p.status === "changes_requested" && p.review_note ? `<div class="ns-status-note"><b>From the founder</b><p>${escapeHtml(p.review_note)}</p></div>` : ""}
      <article class="ns-preview">
        <div class="ns-preview-photo">${photo ? `<img src="${photo}" alt="" />` : `<span>${escapeHtml((p.first_name || "?").charAt(0))}</span>`}</div>
        <div class="ns-preview-body">
          <h2>${escapeHtml(p.first_name || "Your profile")}${age ? `<span>, ${age}</span>` : ""}</h2>
          ${[p.city, p.relationship_goal].filter(Boolean).length ? `<p class="ns-preview-meta">${escapeHtml([p.city, p.relationship_goal].filter(Boolean).join(" · "))}</p>` : ""}
          <div class="ns-preview-tags"><span>No kids</span><span>No step-parent role</span>${(p.interests || []).slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
          ${p.bio ? `<p class="ns-preview-bio">${escapeHtml(p.bio)}</p>` : ""}
        </div>
      </article>
      <div class="ns-actions ns-status-actions">
        ${p.status === "approved" ? `<button class="ns-btn-primary" type="button" data-tab="discover">Start discovering</button>` : ""}
        ${p.status === "removed" ? "" : `<button class="${p.status === "approved" ? "ns-btn-quiet" : "ns-btn-primary"}" type="button" data-tab="profile">${p.status === "changes_requested" ? "Update my profile" : "View or edit my profile"}</button>`}
      </div>
      <p class="ns-legal-links ns-status-legal"><a href="./terms.html" data-legal="terms">Terms</a> · <a href="./privacy.html" data-legal="privacy">Privacy</a> · <a href="./safety.html" data-legal="safety">Safety</a></p>
    </section>
  `;
}

function renderTabs() {
  const icons = {
    discover: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    matches: '<path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
    profile: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  };
  return `<nav class="tabs" aria-label="Main tabs">${[
    ["discover", "Discover"],
    ["matches", "Matches"],
    ["chat", "Chat"],
    ["profile", "Profile"],
  ].map(([key, label]) => `<button class="tab ${state.tab === key ? "active" : ""}" data-tab="${key}" type="button"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg><span>${label}</span></button>`).join("")}</nav>`;
}

function notice() {
  if (state.error) return `<div class="status error">${escapeHtml(state.error)}</div>`;
  if (state.message) return `<div class="status">${escapeHtml(state.message)}</div>`;
  return "";
}

function bindAppEvents() {
  document.querySelector("#signout")?.addEventListener("click", signOut);
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      if (state.tab !== "chat") {
        stopWatchingChat();
        state.selectedMatch = null;
        state.messages = null;
        state.plan = null;
        state.plannerOpen = false;
      }
      state.error = "";
      state.message = "";
      renderApp();
    });
  });
  const form = document.querySelector("#profile-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    const action = submitter?.dataset?.action;
    await saveProfile(form, { submit: action === "submit", advance: action === "next" });
    if (state.editSection && !state.error) {
      state.editSection = null;
      renderApp();
    }
  });
  document.querySelectorAll("[data-edit-section]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.editSection;
    state.editSection = key;
    // The location editor saves through update-location for approved members; it keys off profileStep.
    state.profileStep = Math.max(0, PROFILE_STEPS.findIndex(([step]) => step === (key === "prompts" ? "prompt0" : key)));
    state.error = "";
    state.message = "";
    renderApp();
    document.querySelector("#profile-form")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }));
  document.querySelector("[data-edit-cancel]")?.addEventListener("click", () => {
    state.editSection = null;
    state.error = "";
    renderApp();
  });
  document.querySelectorAll("[data-preview-self]").forEach((button) => button.addEventListener("click", () => {
    const p = state.profile;
    state.viewing = { ...p, age: p.birth_date ? ageFromBirthDate(p.birth_date) : null, photo_urls: state.photos.map((photo) => photo.url).filter(Boolean), isSelf: true };
    state.viewingMatch = null;
    renderApp();
    window.scrollTo({ top: 0 });
  }));
  document.querySelector("[data-step-back]")?.addEventListener("click", () => {
    state.profileStep = Math.max(0, state.profileStep - 1);
    state.error = "";
    state.message = "";
    renderApp();
  });
  document.querySelectorAll("[data-jump-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.profileStep = Number(button.dataset.jumpStep || 0);
      state.error = "";
      state.message = "";
      renderApp();
    });
  });
  document.querySelector("#photo")?.addEventListener("change", (event) => {
    uploadPhoto(event.currentTarget.files?.[0]);
  });
  document.querySelector("[data-use-current-location]")?.addEventListener("click", () => useCurrentArea());
  document.querySelectorAll("[data-remove-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      const photo = state.photos.find((item) => item.id === button.dataset.removePhoto);
      if (photo) removePhoto(photo);
    });
  });
  document.querySelector("[data-refresh-discover]")?.addEventListener("click", () => loadDiscover({ force: true }));
  document.querySelector("[data-refresh-matches]")?.addEventListener("click", () => loadMatches({ force: true }));
  document.querySelector("[data-close-profile]")?.addEventListener("click", closeProfile);
  document.querySelectorAll("[data-view-card]").forEach((button) => {
    button.addEventListener("click", () => openProfileCard(button.dataset.viewCard));
  });
  document.querySelectorAll("[data-view-match]").forEach((button) => {
    button.addEventListener("click", () => openMatchProfile(button.dataset.viewMatch));
  });
  document.querySelectorAll("[data-react]").forEach((button) => {
    button.addEventListener("click", () => reactToProfile(button.dataset.target, button.dataset.react));
  });
  document.querySelectorAll("[data-open-match]").forEach((button) => {
    button.addEventListener("click", () => {
      const match = (state.matches || []).find((item) => item.match_id === button.dataset.openMatch);
      if (match) {
        state.viewing = null;
        state.viewingMatch = null;
        loadMessages(match);
      }
    });
  });
  document.querySelector("#message-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(event.currentTarget);
  });
  const composer = document.querySelector(".ns-composer textarea");
  composer?.addEventListener("input", () => {
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 120)}px`;
    void markTyping();
    if (typingStopTimer) clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(() => { void clearTyping(); }, 4500);
  });
  composer?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      composer.form.requestSubmit();
    }
  });
  document.querySelector("[data-start-plan]")?.addEventListener("click", startPlan);
  document.querySelector("[data-open-planner]")?.addEventListener("click", () => {
    state.plannerOpen = true;
    rerenderChat();
    window.scrollTo({ top: 0 });
  });
  document.querySelectorAll("[data-planner-close]").forEach((button) => button.addEventListener("click", () => {
    state.plannerOpen = false;
    state.error = "";
    rerenderChat();
  }));
  document.querySelector("[data-plan-later]")?.addEventListener("click", () => {
    try { localStorage.setItem(`noSeedsPlanLater:${state.selectedMatch.match_id}`, String((state.messages || []).length)); } catch { /* private mode */ }
    rerenderChat();
  });
  document.querySelectorAll("[data-pick]").forEach((button) => button.addEventListener("click", () => togglePick(button.dataset.pick)));
  document.querySelector("[data-open-other-time]")?.addEventListener("click", () => {
    state.planOtherTime = !state.planOtherTime;
    rerenderChat();
    if (state.planOtherTime) document.querySelector('.ns-dp-other input')?.focus();
  });
  document.querySelectorAll("[data-custom]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    addPlanOption(form.dataset.custom, form);
  }));
  document.querySelector("[data-chat-back]")?.addEventListener("click", () => {
    if (state.plannerOpen) {
      state.plannerOpen = false;
      rerenderChat();
      return;
    }
    stopWatchingChat();
    state.plan = null;
    state.selectedMatch = null;
    state.messages = null;
    state.chatMenuOpen = false;
    state.error = "";
    state.message = "";
    renderApp();
  });
  document.querySelector("[data-chat-menu]")?.addEventListener("click", () => {
    state.chatMenuOpen = !state.chatMenuOpen;
    renderApp();
  });
  if (state.tab === "chat" && state.selectedMatch && !state.viewing && !state.plannerOpen) {
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight }), 0);
  }
  document.querySelector("[data-unmatch]")?.addEventListener("click", () => {
    if (window.confirm("Close this match?")) closeMatch("unmatched");
  });
  document.querySelector("[data-block]")?.addEventListener("click", () => {
    if (window.confirm("Block this member and close the conversation?")) blockMember();
  });
  document.querySelector("[data-report]")?.addEventListener("click", () => {
    const details = window.prompt("What should the founder know? This sends a safety report.");
    if (details !== null) reportMember("other", details);
  });
}

// Terms, Privacy and Safety open in a pop-up sheet over the app, so members never leave their screen.
// The text lives in terms.html, privacy.html and safety.html (Google needs a public privacy address).
const LEGAL_PAGES = { terms: "./terms.html", privacy: "./privacy.html", safety: "./safety.html" };

async function openLegal(name) {
  closeLegal();
  const sheet = document.createElement("div");
  sheet.className = "ns-legal-modal";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.innerHTML = `
    <div class="ns-legal-backdrop" data-legal-close></div>
    <section class="ns-legal-panel">
      <header><h2>Loading…</h2><button type="button" data-legal-close aria-label="Close">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button></header>
      <div class="ns-legal-content"></div>
    </section>`;
  document.body.appendChild(sheet);
  document.body.classList.add("ns-legal-open");
  try {
    const html = await fetch(LEGAL_PAGES[name], { cache: "no-cache" }).then((r) => r.text());
    const page = new DOMParser().parseFromString(html, "text/html");
    page.querySelector(".ns-legal-nav")?.remove();
    sheet.querySelector("h2").textContent = page.querySelector(".ns-legal-hero h1")?.textContent || "No Seeds";
    const updated = page.querySelector(".ns-legal-hero p")?.textContent || "";
    sheet.querySelector(".ns-legal-content").innerHTML = `${updated ? `<p class="ns-legal-date">${escapeHtml(updated)}</p>` : ""}${page.querySelector(".ns-legal-sheet")?.innerHTML || ""}`;
  } catch {
    sheet.querySelector("h2").textContent = "Couldn't load this page";
    sheet.querySelector(".ns-legal-content").innerHTML = `<p>Check your connection and try again.</p>`;
  }
  sheet.querySelector(".ns-legal-panel button")?.focus();
}

function closeLegal() {
  document.querySelector(".ns-legal-modal")?.remove();
  document.body.classList.remove("ns-legal-open");
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-legal], .ns-legal-content a[href$='.html']");
  if (link) {
    const name = link.dataset.legal || Object.keys(LEGAL_PAGES).find((key) => link.getAttribute("href").endsWith(`${key}.html`));
    if (name) {
      event.preventDefault();
      openLegal(name);
      return;
    }
  }
  if (event.target.closest("[data-legal-close]")) closeLegal();
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeLegal(); });

init();
