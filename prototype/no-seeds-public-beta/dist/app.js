import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { profilePatch, startAccount, startGoogle, saveDraftToServer, submitProfile, mergeDrafts, hasUnsavedAnswers, resumeStep, friendlyAuthError } from "./onboarding-sync.js";

const SUPABASE_URL = "https://btnrophnyfuwnqzwiooh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7bUb95CMiZ7AVoXqJWsE5Q_TZZDlxBw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = document.querySelector("#app");
const urlParams = new URLSearchParams(window.location.search);

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
  ["photos", "STEP 10 OF 10", "Preview and submit.", "Photos are optional for this beta, but your profile must be complete."],
];

const state = {
  session: null,
  user: null,
  profile: null,
  publicProfile: loadPublicDraft(),
  publicGateOpen: hasPublicDraft(),
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
  plannerOpen: false,
  chatChannel: null,
  chatChannelMatch: null,
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

function loadPublicDraft() {
  try {
    return { ...emptyPublicProfile(), ...(JSON.parse(localStorage.getItem("noSeedsPublicDraft") || localStorage.getItem("freeMidnightPublicDraft") || "{}")) };
  } catch {
    return emptyPublicProfile();
  }
}

function hasPublicDraft() {
  const draft = loadPublicDraft();
  return Boolean(draft.email || draft.first_name || draft.city || draft.birth_date);
}

function savePublicDraft() {
  localStorage.setItem("noSeedsPublicDraft", JSON.stringify(state.publicProfile || emptyPublicProfile()));
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
  // Members who have not submitted yet continue the onboarding steps where they left off.
  if (state.profile && ["draft", "changes_requested"].includes(state.profile.status)) {
    await resumeOnboarding();
    renderAuth();
    return;
  }
  renderApp();
}

// Bring answers typed on this phone before sign-in onto the account, then reopen the right step.
async function resumeOnboarding() {
  const merged = mergeDrafts(state.profile, loadPublicDraft());
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
  const local = loadPublicDraft();
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
    state.saving = true;
    renderAuth();
    const error = await submitProfile(supabase, state.user.id, state.publicProfile);
    state.saving = false;
    if (error) {
      state.error = error.message;
      renderAuth();
      return;
    }
    localStorage.removeItem("noSeedsPublicDraft");
    localStorage.removeItem("freeMidnightPublicDraft");
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

async function uploadPhoto(file) {
  if (!file || !state.user) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    state.error = "Use a JPEG, PNG, or WebP photo.";
    renderApp();
    return;
  }
  if (state.photos.length >= 6) {
    state.error = "You can add up to 6 photos.";
    renderApp();
    return;
  }
  state.saving = true;
  state.error = "";
  renderApp();
  const position = Math.min(state.photos.length, 5);
  let prepared;
  try {
    prepared = await reencodeImage(file);
  } catch (error) {
    state.saving = false;
    state.error = error.message;
    renderApp();
    return;
  }
  if (prepared.size > 5 * 1024 * 1024) {
    state.saving = false;
    state.error = "Photos must be under 5 MB after processing.";
    renderApp();
    return;
  }
  const path = `${state.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
  const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, prepared, { upsert: false, contentType: "image/jpeg" });
  if (uploadError) {
    state.error = uploadError.message;
  } else {
    const { error: rowError } = await supabase.from("profile_photos").insert({
      profile_id: state.user.id,
      storage_path: path,
      position,
    });
    if (rowError) state.error = rowError.message;
    else state.message = "Photo added.";
  }
  state.saving = false;
  await loadProfile();
  renderApp();
}

async function removePhoto(photo) {
  state.saving = true;
  state.error = "";
  renderApp();
  await supabase.from("profile_photos").delete().eq("id", photo.id);
  await supabase.storage.from("profile-photos").remove([photo.storage_path]);
  state.saving = false;
  state.message = "Photo removed.";
  await loadProfile();
  renderApp();
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
  await loadPlan(match);
  state.loadingArea = "";
  watchChat(match);
  renderApp();
}

// The match's date plan with its options and who picked each one.
async function loadPlan(match) {
  const { data } = await supabase
    .from("date_plans")
    .select("*, date_plan_options(*, date_plan_picks(member_id))")
    .eq("match_id", match.match_id)
    .neq("status", "cancelled")
    .maybeSingle();
  if (state.selectedMatch?.match_id === match.match_id) state.plan = data || null;
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
  state.chatChannel = supabase
    .channel(`match-${match.match_id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${match.match_id}` }, ({ new: message }) => {
      if (state.selectedMatch?.match_id !== match.match_id || (state.messages || []).some((m) => m.id === message.id)) return;
      state.messages = [...(state.messages || []), message];
      state.matches = null;
      rerenderChat();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "date_plans", filter: `match_id=eq.${match.match_id}` }, planEvent)
    .on("postgres_changes", { event: "*", schema: "public", table: "date_plan_options" }, planEvent)
    .on("postgres_changes", { event: "*", schema: "public", table: "date_plan_picks" }, planEvent)
    .subscribe();
}

function stopWatchingChat() {
  if (state.chatChannel) void supabase.removeChannel(state.chatChannel);
  state.chatChannel = null;
  state.chatChannelMatch = null;
}

// Redraw the chat without losing what the member is typing.
function rerenderChat() {
  const box = document.querySelector(".ns-composer textarea, .ns-plan-custom input:focus");
  const draft = document.querySelector(".ns-composer textarea")?.value || "";
  const focused = document.activeElement === box;
  renderApp();
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
    state.cards = (state.cards || []).filter((card) => card.id !== targetId);
    state.viewing = null;
    state.viewingMatch = null;
    state.likes = null;
    state.matches = null;
    state.message = matched ? "It's a match. Say hello when you're ready." : (kind === "like" ? "Like sent." : "Passed.");
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
  document.querySelector("[data-public-back]")?.addEventListener("click", () => {
    state.publicStep = Math.max(0, state.publicStep - 1);
    state.error = "";
    state.message = "";
    renderAuth();
  });
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
    const email = state.publicProfile?.email || window.prompt("Enter your email for a sign-in link:");
    if (email) signIn(email);
  });
  setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 0);
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
    state.publicGateOpen = true;
    state.agreementOpen = false;
    state.message = "";
    state.error = "";
    renderAuth();
  });
}

function renderAgreement() {
  app.innerHTML = `
    <main class="screen gate-screen">
      <section class="gate-hero">
        ${renderLockup()}
        <h1>Let's be clear…</h1>
        <p class="gate-line">Black. Single.<br>Absolutely No Seeds.</p>
        <ul class="pledge-list">
          <li class="pledge-item"><span aria-hidden="true">✓</span><p>I do not have children of any age.</p></li>
          <li class="pledge-item"><span aria-hidden="true">✓</span><p>I never want biological, adopted, or step children.</p></li>
          <li class="pledge-item"><span aria-hidden="true">✓</span><p>I understand fence-sitters and parents are removed immediately.</p></li>
        </ul>
        ${notice()}
        <button class="ns-btn-primary gate-cta" type="button" id="open-public-application">I Agree, Let's Go</button>
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
    state.publicGateOpen = true;
    state.agreementOpen = false;
    state.message = "";
    state.error = "";
    renderAuth();
  });
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
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue</button>
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
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue</button>
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
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue</button>
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
          ${clauseChoice("black", "I identify as Black, including multiracial Black.", p)}
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
        <button class="ns-btn-primary" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue</button>
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
  return `
    <form id="intake-form" class="account-screen ns-step ns-review-step">
      ${renderStepTop()}
      <h1>${escapeHtml(title.replace(/[.]$/, ""))}</h1>
      <p class="account-tagline">This is how members will see you once you're approved.</p>
      ${notice()}
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
      <p class="ns-review-note">Photos are optional for this beta and open after sign-in, so private images stay protected.</p>
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
        <button class="ns-btn-primary" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue</button>
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
        <button class="ns-btn-primary" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue</button>
        <button class="ns-btn-quiet" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>Save and finish later</button>
      </div>
    </form>
  `;
}

// Shared top of every application step: back, the one small logo, step count, progress.
function renderStepTop() {
  const step = state.publicStep + 1;
  const back = state.publicStep > 0
    ? `<button class="ns-back" type="button" data-public-back aria-label="Back" ${state.saving ? "disabled" : ""}><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
    : `<span class="ns-back-space"></span>`;
  return `
    <header class="ns-step-top">
      ${back}
      <img class="ns-step-emblem" src="./assets/no-seeds-emblem.png" alt="No Seeds Dating" />
      <span class="ns-step-count">${step} of ${PROFILE_STEPS.length}</span>
    </header>
    <div class="ns-progress" aria-hidden="true"><span style="width:${(step / PROFILE_STEPS.length) * 100}%"></span></div>
  `;
}

const GOOGLE_G = `<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

function renderAccountStep(p) {
  const signedIn = Boolean(state.user);
  return `
    <form id="intake-form" class="account-screen ns-step">
      ${renderStepTop()}
      <h1>Create your account</h1>
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
      <button class="ns-btn-primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue</button>
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
  if (!state.profile) {
    app.innerHTML = `<main class="screen"><section class="hero"><h1>Profile loading issue</h1><p>${escapeHtml(state.error || "Try signing out and back in.")}</p><button class="btn primary" id="signout">Sign out</button></section></main>`;
    document.querySelector("#signout")?.addEventListener("click", signOut);
    return;
  }
  if (state.viewing) {
    app.innerHTML = renderMemberProfile(state.viewing);
    bindAppEvents();
    return;
  }
  app.innerHTML = `
    <main class="screen">
      ${["matches", "discover", "chat"].includes(state.tab) ? "" : renderHero()}
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
  if (p.status === "approved") return "Approved. Discover, matches, and chat are live when the matching SQL is installed.";
  if (p.status === "changes_requested") return `Changes requested: ${p.review_note || "Please update your profile."}`;
  if (p.status === "removed") return "This profile has been removed.";
  return "Save your full dating profile. Submit when the required fields are complete.";
}

function renderProfileForm() {
  const p = state.profile;
  state.profileStep = Math.max(0, Math.min(state.profileStep, PROFILE_STEPS.length - 1));
  const [key, eyebrow, title, subtitle] = PROFILE_STEPS[state.profileStep];
  const finalStep = state.profileStep === PROFILE_STEPS.length - 1;
  return `
    <form id="profile-form" class="panel">
      <div class="step-kicker">${eyebrow}</div>
      <h2>${title}</h2>
      <p class="copy">${subtitle}</p>
      ${renderStepDots()}
      ${notice()}
      ${renderProfileStep(key, p)}

      <div class="btn-row">
        ${state.profileStep > 0 ? `<button class="btn secondary" type="button" data-step-back ${state.saving ? "disabled" : ""}>Back</button>` : ""}
        <button class="btn secondary" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>Save</button>
        <button class="btn primary" type="submit" data-action="${finalStep ? "submit" : "next"}" ${state.saving ? "disabled" : ""}>${finalStep ? "Submit for review" : "Continue"}</button>
      </div>
      <p class="copy">${finalStep ? `Missing: ${missingFields().length ? escapeHtml(missingFields().join(", ")) : "Ready to submit."}` : "Your answers save when you continue."}</p>
    </form>
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
      <div class="grid-2">
        ${field("city", "City", p.city || "", "text", "Atlanta")}
        ${field("zip", "ZIP code", p.zip || "", "text", "30308")}
      </div>
      <div class="grid-2">
        ${field("age_min", "Min age", p.age_min || 25, "number")}
        ${field("age_max", "Max age", p.age_max || 70, "number")}
      </div>
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
      ${clauseCheck("black", "I identify as Black, including multiracial Black.", p)}
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
              ${card.city ? `<small>${escapeHtml(card.city)}</small>` : ""}
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
    `<div class="ns-pv-tags"><span>No kids</span><span>No step-parent role</span>${card.relationship_goal ? `<span>${escapeHtml(card.relationship_goal)}</span>` : ""}</div>${card.bio ? `<p class="ns-pv-bio">${escapeHtml(card.bio)}</p>` : ""}`,
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
        ${match
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
  const open = plan.status === "open";
  const who = (option) => {
    const picks = option.date_plan_picks || [];
    const me = picks.some((pk) => pk.member_id === state.user.id);
    const them = picks.some((pk) => pk.member_id !== state.user.id);
    return `<span class="ns-plan-who">${me ? `<i class="is-me">You</i>` : ""}${them ? `<i>${name}</i>` : ""}</span>`;
  };
  const mine = (option) => (option.date_plan_picks || []).some((pk) => pk.member_id === state.user.id);
  const places = planOptions("place");
  const times = planOptions("time");
  return `
    <div class="ns-planner">
      ${notice()}
      <h2>Plan your date</h2>
      <p class="ns-planner-sub">${plan.midpoint_label ? `Halfway between you, near <strong>${escapeHtml(plan.midpoint_label)}</strong>.` : "Pick a public spot that's easy for you both to reach."} Tap everything that works for you. When you both pick the same place and time, it's set.</p>
      ${plan.status === "confirmed" ? renderPlanCard(match) : ""}
      <h3>Where</h3>
      <div class="ns-plan-places">
        ${places.map((o) => `
          <div class="ns-plan-place ${mine(o) ? "is-picked" : ""}">
            <button type="button" data-pick="${o.id}" ${open ? "" : "disabled"} aria-pressed="${mine(o)}">
              <span class="ns-plan-check" aria-hidden="true"></span>
              <span class="ns-plan-text">
                <strong>${escapeHtml(o.label)}</strong>
                <small>${[o.rating ? `★ ${o.rating}` : "", o.detail ? escapeHtml(o.detail) : (o.created_by ? `Suggested by ${o.created_by === state.user.id ? "you" : name}` : "")].filter(Boolean).join(" · ")}</small>
                ${o.reason ? `<em>${escapeHtml(o.reason)}</em>` : ""}
              </span>
            </button>
            <div class="ns-plan-foot">${who(o)}${o.maps_url ? `<a href="${escapeHtml(o.maps_url)}" target="_blank" rel="noopener noreferrer">Map</a>` : ""}</div>
          </div>`).join("") || `<p class="ns-plan-empty">No suggestions yet. Add a spot you'd both enjoy.</p>`}
      </div>
      ${open ? `
        <form class="ns-plan-custom" data-custom="place">
          <input name="label" maxlength="120" placeholder="Suggest your own place" aria-label="Suggest your own place" />
          <button type="submit" ${state.saving ? "disabled" : ""}>Add</button>
        </form>` : ""}
      <h3>When</h3>
      <div class="ns-plan-times">
        ${times.map((o) => `
          <button type="button" class="ns-plan-time ${mine(o) ? "is-picked" : ""}" data-pick="${o.id}" ${open ? "" : "disabled"} aria-pressed="${mine(o)}">
            <strong>${escapeHtml(o.label)}</strong>
            ${who(o)}
          </button>`).join("")}
      </div>
      ${open ? `
        <form class="ns-plan-custom" data-custom="time">
          <input name="when" type="datetime-local" aria-label="Suggest your own day and time" />
          <button type="submit" ${state.saving ? "disabled" : ""}>Add</button>
        </form>` : ""}
      <p class="ns-plan-safety">Always meet somewhere public, get there on your own, and tell a friend where you'll be.</p>
      <button class="ns-btn-primary ns-planner-done" type="button" data-planner-close>Back to chat</button>
    </div>
  `;
}

function renderMessage(message) {
  const mine = message.sender_id === state.user.id;
  return `<div class="ns-bubble ${mine ? "is-mine" : ""}"><p>${escapeHtml(message.body)}</p><time>${new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>`;
}

function renderStatus() {
  const p = state.profile;
  return `
    <section class="panel">
      <h2>Review status</h2>
      <div class="status ${p.status === "changes_requested" ? "error" : "gold"}">${escapeHtml(statusLine())}</div>
      <div class="profile-card" style="margin-top:14px">
        <div class="profile-photo">${state.photos[0]?.url ? `<img src="${state.photos[0].url}" alt="Your profile preview" />` : "Preview"}</div>
        <div class="body">
          <strong>${escapeHtml(p.first_name || "Your profile")}${p.birth_date ? `, ${ageFromBirthDate(p.birth_date)}` : ""}</strong>
          <p class="copy">${escapeHtml([p.city, p.relationship_goal].filter(Boolean).join(" · "))}</p>
          <div class="chips"><span class="chip">Clause Clear</span><span class="chip">No step-parent role</span></div>
          <p>${escapeHtml(p.bio || "Your bio will show here.")}</p>
        </div>
      </div>
      <div class="btn-row"><button class="btn secondary" data-tab="profile">Edit profile</button></div>
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
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    const action = submitter?.dataset?.action;
    saveProfile(form, { submit: action === "submit", advance: action === "next" });
  });
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

init();
