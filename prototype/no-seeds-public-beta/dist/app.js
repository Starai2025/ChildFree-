import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { startAccount, saveDraftToServer, submitProfile, mergeDrafts, hasUnsavedAnswers, resumeStep, friendlyAuthError } from "./onboarding-sync.js";

const SUPABASE_URL = "https://btnrophnyfuwnqzwiooh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7bUb95CMiZ7AVoXqJWsE5Q_TZZDlxBw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = document.querySelector("#app");

const PROMPTS = [
  ["ordinary_sunday", "An ordinary Sunday with me looks like..."],
  ["partnership", "A strong partnership means..."],
  ["life_together", "A life together without parenthood would include..."],
  ["culture", "A part of my culture I'd love to share is..."],
  ["joy", "Something that always brings me joy is..."],
  ["building", "The life I want to build with someone is..."],
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
  ["life", "STEP 9 OF 10", "Describe the life you'd share.", "A few compatibility signals for grown dating."],
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
  state.error = "";
  state.message = "";
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
  const { data, error } = await supabase
    .from("profiles")
    .select("*, profile_photos(*)")
    .eq("id", state.user.id)
    .maybeSingle();
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
    payload.interests = String(data.get("interests") || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 6);
  }
  ["faith", "spendingStyle", "lifestylePace"].forEach((key) => {
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
  state.selectedMatch = match;
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
  state.loadingArea = "";
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
    state.likes = null;
    state.matches = null;
    state.message = matched ? "It's a match. Say hello when you're ready." : (kind === "like" ? "Like sent." : "Passed.");
  }
  state.saving = false;
  renderApp();
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
  if (state.tab === "matches" && (state.likes === null || state.matches === null)) void loadMatches();
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
  document.querySelector("#account-google")?.addEventListener("click", () => {
    state.error = "Google sign-up is coming. Use email for this beta.";
    state.message = "";
    renderAuth();
  });
  document.querySelector("#account-signin")?.addEventListener("click", () => {
    const email = state.publicProfile?.email || window.prompt("Enter your email for a sign-in link:");
    if (email) signIn(email);
  });
  setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 0);
}

function renderWelcome() {
  app.innerHTML = `
    <main class="screen welcome-screen">
      <img class="welcome-art" src="./assets/no-seeds-welcome.png" alt="No Seeds Dating. Black Singles. No Kids. Not Now. Not Ever." />
      <button class="welcome-join" type="button" id="welcome-join" aria-label="Join No Seeds"></button>
      <button class="welcome-signin" type="button" id="welcome-signin" aria-label="Sign in"></button>
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
        <div class="agreement-logo-wrap">
          <img class="agreement-logo" src="./assets/no-seeds-logo.png" alt="No Seeds Dating" />
        </div>
        <h1>Let's be clear...</h1>
        <p class="gate-line">Black. Single.<br>Absolutely No Seeds.</p>
        <div class="pledge-list">
          <div class="pledge-item"><span>✓</span><p>I do not have children of any age.</p></div>
          <div class="pledge-item"><span>✓</span><p>I never want biological, adopted, or step children.</p></div>
          <div class="pledge-item"><span>✓</span><p>I understand fence-sitters and parents are removed immediately.</p></div>
        </div>
        ${notice()}
        <button class="btn primary gate-cta" type="button" id="open-public-application">I Agree, Let's Go →</button>
        <button class="link-btn" type="button" id="show-signin">Already a member? Sign in</button>
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
    <form id="intake-form" class="account-screen choice-screen">
      <div class="account-logo-wrap"><img class="account-logo" src="./assets/no-seeds-logo.png" alt="No Seeds Dating" /></div>
      <p class="step-kicker choice-kicker">STEP 2 OF 10</p>
      <h1>Gender &<br>Looking For</h1>
      <p class="account-tagline">Tell us who you are and who you want to meet.</p>
      ${notice()}
      <div class="choice-group">
        <label>My gender</label>
        <div class="choice-grid">
          ${["Woman", "Man", "Non-binary"].map((item) => choiceRadio("gender", item, p.gender)).join("")}
        </div>
      </div>
      <div class="choice-group">
        <label>I'm looking for</label>
        <div class="choice-grid">
          ${["Woman", "Man", "Non-binary"].map((item) => choiceCheck("seeking", item, p.seeking)).join("")}
        </div>
      </div>
      <button class="btn primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue →</button>
      <button class="link-btn choice-back" type="button" data-public-back ${state.saving ? "disabled" : ""}>Back</button>
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
    <form id="intake-form" class="account-screen choice-screen location-screen">
      <div class="account-logo-wrap"><img class="account-logo" src="./assets/no-seeds-logo.png" alt="No Seeds Dating" /></div>
      <p class="step-kicker choice-kicker">STEP 3 OF 10</p>
      <h1>Location &<br>Age</h1>
      <p class="account-tagline">Set where and who you want to meet.</p>
      ${notice()}
      <div class="field account-field">
        <label for="city">City</label>
        <input id="city" name="city" type="text" autocomplete="address-level2" required value="${escapeHtml(p.city || "")}" placeholder="Atlanta" />
      </div>
      <div class="field account-field">
        <label for="zip">ZIP Code</label>
        <input id="zip" name="zip" type="text" inputmode="numeric" autocomplete="postal-code" required maxlength="10" value="${escapeHtml(p.zip || "")}" placeholder="30308" />
      </div>
      <div class="choice-group">
        <label>Show me ages</label>
        <div class="age-row">
          ${ageSelect("age_min", "Minimum", p.age_min || 25)}
          ${ageSelect("age_max", "Maximum", p.age_max || 70)}
        </div>
      </div>
      <button class="btn primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue →</button>
      <button class="link-btn choice-back" type="button" data-public-back ${state.saving ? "disabled" : ""}>Back</button>
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
    <form id="intake-form" class="account-screen choice-screen intent-screen">
      <div class="account-logo-wrap"><img class="account-logo" src="./assets/no-seeds-logo.png" alt="No Seeds Dating" /></div>
      <p class="step-kicker choice-kicker">STEP 4 OF 10</p>
      <h1>Relationship<br>Intentions</h1>
      <p class="account-tagline">Be clear about what you are actually open to.</p>
      ${notice()}
      ${intentSelect("relationship_goal", "Relationship goal", p.relationship_goal, ["Committed relationship", "Marriage-minded", "Long-term partnership", "Intentional dating"])}
      ${intentSelect("marriage_view", "Marriage view", p.marriage_view, ["Open to marriage", "Want marriage", "Partnership without marriage", "Unsure"])}
      <button class="btn primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue →</button>
      <button class="link-btn choice-back" type="button" data-public-back ${state.saving ? "disabled" : ""}>Back</button>
    </form>
  `;
}

function intentSelect(name, label, value, options) {
  return `
    <div class="field account-field intent-field">
      <label for="${name}">${label}</label>
      <select id="${name}" name="${name}" required>
        <option value="">Choose</option>
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </div>
  `;
}

function renderNoKidsClauseStep(p) {
  return `
    <form id="intake-form" class="account-screen choice-screen clause-screen">
      <div class="account-logo-wrap"><img class="account-logo" src="./assets/no-seeds-logo.png" alt="No Seeds Dating" /></div>
      <p class="step-kicker choice-kicker">STEP 5 OF 10</p>
      <h1>The No Seeds<br>Pledge</h1>
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
      <button class="btn primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>I Agree →</button>
      <button class="link-btn choice-back" type="button" data-public-back ${state.saving ? "disabled" : ""}>Back</button>
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
  const [, eyebrow, title, subtitle] = PROFILE_STEPS[state.publicStep];
  return `
    <form id="intake-form" class="prompt-screen">
      <div class="prompt-logo-wrap"><img class="prompt-logo" src="./assets/no-seeds-logo.png" alt="No Seeds Dating" /></div>
      <section class="prompt-card">
        <p class="prompt-kicker">PUBLIC APPLICATION · ${eyebrow}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="prompt-copy">${escapeHtml(subtitle)}</p>
        ${renderPromptBars()}
        <div class="prompt-field">
          <label for="prompt_${index}_id">PROMPT ${index + 1}</label>
          <select id="prompt_${index}_id" name="prompt_${index}_id">
            ${PROMPTS.map(([id, text]) => `<option value="${id}" ${prompt.id === id ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
          </select>
        </div>
        <div class="prompt-field">
          <textarea name="prompt_${index}_answer" placeholder="Answer in your voice.">${escapeHtml(prompt.answer || "")}</textarea>
        </div>
        ${notice()}
        <div class="prompt-actions">
          <button class="prompt-btn prompt-back" type="button" data-public-back ${state.saving ? "disabled" : ""}>Back</button>
          <button class="prompt-btn prompt-save" type="submit" data-action="save" ${state.saving ? "disabled" : ""}>Save draft</button>
          <button class="prompt-btn prompt-next" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue</button>
        </div>
        <p class="prompt-footnote">Your answers save on this phone as you continue.</p>
      </section>
    </form>
  `;
}

function renderPromptBars() {
  return `<div class="prompt-bars" aria-label="Application step progress">${PROFILE_STEPS.map((step, index) => `<span class="${index < state.publicStep ? "done" : ""} ${index === state.publicStep ? "active" : ""}"></span>`).join("")}</div>`;
}

function renderAccountStep(p) {
  return `
    <form id="intake-form" class="account-screen">
      <div class="account-logo-wrap"><img class="account-logo" src="./assets/no-seeds-logo.png" alt="No Seeds Dating" /></div>
      <h1>Create your account</h1>
      <p class="account-tagline">Black Singles - No Kids. Not Now. Not Ever.</p>
      ${notice()}
      ${field("first_name", "First Name", p.first_name || "", "text", "Enter your first name")}
      <div class="field account-field">
        <label for="intake_email">Email Address</label>
        <input id="intake_email" name="intake_email" type="email" autocomplete="email" required value="${escapeHtml(p.email || "")}" placeholder="Enter your email" />
      </div>
      <div class="field account-field">
        <label for="birth_date">Date of Birth</label>
        <input id="birth_date" name="birth_date" type="date" required value="${escapeHtml(p.birth_date || "")}" />
      </div>
      <button class="btn primary account-continue" type="submit" data-action="next" ${state.saving ? "disabled" : ""}>Continue →</button>
      <div class="account-divider"><span></span><em>or</em><span></span></div>
      <button class="btn account-google" type="button" id="account-google">G&nbsp; Sign up with Google</button>
      <p class="account-signin">Already have an account? <button type="button" id="account-signin">Sign in here</button></p>
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
  app.innerHTML = `
    <main class="screen">
      ${renderHero()}
      ${state.tab === "discover" ? renderDiscover() : ""}
      ${state.tab === "matches" ? renderMatches() : ""}
      ${state.tab === "chat" ? renderChat() : ""}
      ${state.tab === "profile" ? renderProfileForm() : ""}
      ${state.tab === "status" ? renderStatus() : ""}
      ${renderTabs()}
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
      ${select("relationship_goal", "Relationship goal", p.relationship_goal, ["Committed relationship", "Marriage-minded", "Long-term partnership", "Intentional dating"])}
      ${select("marriage_view", "Marriage view", p.marriage_view, ["Open to marriage", "Want marriage", "Partnership without marriage", "Unsure"])}
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
      ${field("faith", "Faith / worldview", p.basics?.faith || "", "text", "Grounded, spiritual, church-going, nonreligious...")}
      ${field("lifestylePace", "Lifestyle pace", p.basics?.lifestylePace || "", "text", "Quiet homebody, social weekends, travel-ready...")}
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
  if (!approved) {
    return `<section class="panel"><h2>Discover</h2><p class="copy">Discover unlocks after founder approval.</p>${notice()}<button class="btn secondary" data-tab="status" type="button">Check review status</button></section>`;
  }
  const cards = state.cards || [];
  const loading = state.loadingArea === "discover";
  return `
    <section class="panel">
      <h2>Discover</h2>
      <p class="copy">Approved members who fit your age and gender preferences appear here.</p>
      ${notice()}
      ${loading ? `<div class="status gold">Loading members...</div>` : ""}
      ${!loading && !cards.length ? `<div class="status gold">No new approved members are available right now. Check back after more beta approvals.</div>` : ""}
      <div class="card-list">${cards.map(renderMemberCard).join("")}</div>
      <div class="btn-row"><button class="btn secondary" data-refresh-discover type="button">Refresh</button></div>
    </section>
  `;
}

function renderMatches() {
  if (state.profile.status !== "approved") {
    return `<section class="panel"><h2>Matches</h2><p class="copy">Matches unlock after founder approval.</p>${notice()}</section>`;
  }
  const likes = state.likes || [];
  const matches = state.matches || [];
  const loading = state.loadingArea === "matches";
  return `
    <section class="panel">
      <h2>Matches</h2>
      <p class="copy">Likes waiting for you and mutual matches live here.</p>
      ${notice()}
      ${loading ? `<div class="status gold">Loading matches...</div>` : ""}
      ${likes.length ? `<h2 class="section-title">Likes you</h2><div class="card-list">${likes.map(renderMemberCard).join("")}</div>` : ""}
      <h2 class="section-title">Conversations</h2>
      ${matches.length ? `<div class="card-list">${matches.map(renderMatchRow).join("")}</div>` : `<div class="status gold">No mutual matches yet.</div>`}
      <div class="btn-row"><button class="btn secondary" data-refresh-matches type="button">Refresh</button></div>
    </section>
  `;
}

function renderChat() {
  if (state.profile.status !== "approved") {
    return `<section class="panel"><h2>Chat</h2><p class="copy">Chat unlocks after founder approval.</p>${notice()}</section>`;
  }
  if (!state.selectedMatch) {
    return `<section class="panel"><h2>Chat</h2><p class="copy">Open a mutual match to start chatting.</p>${notice()}<button class="btn primary" data-tab="matches" type="button">Go to matches</button></section>`;
  }
  const messages = state.messages || [];
  const other = state.selectedMatch.other_first_name || "Match";
  return `
    <section class="panel">
      <div class="chat-head">
        <button class="pill dark-pill" data-tab="matches" type="button">Back</button>
        <div><h2>${escapeHtml(other)}</h2><p class="copy">${escapeHtml(state.selectedMatch.other_city || "")}</p></div>
      </div>
      ${notice()}
      ${state.loadingArea === "chat" ? `<div class="status gold">Loading chat...</div>` : ""}
      <div class="messages">${messages.length ? messages.map(renderMessage).join("") : `<div class="status gold">No messages yet. Send the first one.</div>`}</div>
      <form id="message-form" class="message-form">
        <textarea name="message" maxlength="2000" placeholder="Write a thoughtful message..." ${state.saving ? "disabled" : ""}></textarea>
        <button class="btn primary" type="submit" ${state.saving ? "disabled" : ""}>Send</button>
      </form>
      <div class="btn-row">
        <button class="btn secondary" data-report type="button">Report</button>
        <button class="btn secondary" data-unmatch type="button">Unmatch</button>
        <button class="btn secondary danger" data-block type="button">Block</button>
      </div>
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
  return `
    <button class="match-row" type="button" data-open-match="${match.match_id}">
      <div class="match-avatar">${match.other_photo_url ? `<img src="${match.other_photo_url}" alt="" />` : "NS"}</div>
      <div>
        <strong>${escapeHtml(match.other_first_name || "Match")}${match.other_age ? `, ${match.other_age}` : ""}</strong>
        <p class="copy">${escapeHtml(match.last_message || "Say hello.")}</p>
      </div>
    </button>
  `;
}

function renderMessage(message) {
  const mine = message.sender_id === state.user.id;
  return `<div class="message ${mine ? "mine" : ""}"><p>${escapeHtml(message.body)}</p><span>${new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>`;
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
  return `<nav class="tabs" aria-label="Main tabs">${[
    ["discover", "Discover"],
    ["matches", "Matches"],
    ["chat", "Chat"],
    ["profile", "Profile"],
  ].map(([key, label]) => `<button class="tab ${state.tab === key ? "active" : ""}" data-tab="${key}" type="button">${label}</button>`).join("")}</nav>`;
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
        state.selectedMatch = null;
        state.messages = null;
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
  document.querySelectorAll("[data-react]").forEach((button) => {
    button.addEventListener("click", () => reactToProfile(button.dataset.target, button.dataset.react));
  });
  document.querySelectorAll("[data-open-match]").forEach((button) => {
    button.addEventListener("click", () => {
      const match = (state.matches || []).find((item) => item.match_id === button.dataset.openMatch);
      if (match) loadMessages(match);
    });
  });
  document.querySelector("#message-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(event.currentTarget);
  });
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
