import { z } from 'zod';
import { ageOn, answersSchema, dobSchema, emptyAnswers, genderSchema, profileSchema, type EligibilityAnswers, type Profile } from './index';

export const DEMO_VERSION = 1;
export const demoPrompts = [
  {id: 'life_together', version: 1, text: 'A life together without parenthood would include…'},
  {id: 'tradition', version: 1, text: "The tradition I'd bring into our relationship is…"},
  {id: 'cared_for', version: 1, text: 'I feel most cared for when…'},
  {id: 'ordinary_sunday', version: 1, text: 'An ordinary Sunday with me looks like…'},
  {id: 'building', version: 1, text: 'The life I want to build with someone is…'},
  {id: 'culture', version: 1, text: "A part of my culture I'd love to share is…"},
  {id: 'partnership', version: 1, text: 'A strong partnership means…'},
  {id: 'joy', version: 1, text: 'Something that always brings me joy is…'},
  {id: 'auntie_asks', version: 1, text: "When Auntie asks ‘So when are y'all having kids?’ I say…"},
  {id: 'rather_raise', version: 1, text: "Things I'd rather raise than children…"},
  {id: 'cookout_dish', version: 1, text: "The cookout dish I'm trusted to bring is…"},
  {id: 'dink_vacation', version: 1, text: 'Our future DINK vacation is…'},
  {id: 'reunion_shirt', version: 1, text: "The family reunion T-shirt I'd design for us says…"},
  {id: 'college_fund', version: 1, text: "Instead of a college fund, I'm funding…"},
];
export const demoPledge = "I will be truthful about my identity, relationship history and decision not to become a parent. I will respect other members' boundaries and accept a no. I will not pressure anyone to change their childfree choice. I will not harass, threaten, discriminate, impersonate others, solicit money or send sexual content. I will use reporting when something is wrong and understand that violations can lead to removal.";
export const cities = {
  Atlanta: [33.749, -84.388], Decatur: [33.774, -84.296], Brookhaven: [33.865, -84.336],
  Savannah: [32.081, -81.091], 'New York': [40.713, -74.006],
} as const;
export const preferencesSchema = z.object({
  genders: z.array(genderSchema).min(1), ageMin: z.number().int().min(18).max(99),
  ageMax: z.number().int().min(18).max(99), radius: z.number().int().min(1).max(500),
  city: z.enum(['Atlanta', 'Decatur', 'Brookhaven', 'Savannah', 'New York']),
}).refine(p => p.ageMin <= p.ageMax, 'Minimum age must not exceed maximum age.');
export type Preferences = z.infer<typeof preferencesSchema>;
const memberSchema = z.object({
  id: z.string(), dob: dobSchema, profile: z.object({...profileSchema.shape,
    display_name: z.string().max(60),
    prompts: z.array(z.object({id: z.string(), version: z.number().int().positive(), answer: z.string().max(200)})).length(2),
  }), answers: answersSchema,
  pledged: z.boolean(), photos: z.array(z.number().int().min(0).max(5)).max(6),
  preferences: preferencesSchema, step: z.number().int().min(0).max(5),
  identity: z.enum(['not_started', 'pending', 'simulated_verified']),
  lifecycle: z.enum(['onboarding', 'pending_review', 'active', 'paused', 'changes_requested', 'suspended', 'deleted']),
  reviewed: z.boolean(), feedback: z.string(), notifications: z.boolean(),
}).refine(m => new Set(m.photos).size === m.photos.length, 'Demo photos must be distinct.');
export type DemoMember = z.infer<typeof memberSchema>;
const matchSchema = z.object({id: z.string(), users: z.tuple([z.string(), z.string()]), status: z.enum(['ready', 'closed']), createdAt: z.string(), reason: z.string()});
export type DemoMatch = z.infer<typeof matchSchema>;
const messageSchema = z.object({id: z.string(), matchId: z.string(), sender: z.string(), text: z.string(), at: z.string(), status: z.enum(['accepted', 'failed']), simulated: z.boolean()});
export type DemoMessage = z.infer<typeof messageSchema>;
export const demoStateSchema = z.object({
  version: z.literal(DEMO_VERSION), actor: z.string(), members: z.array(memberSchema),
  reactions: z.array(z.object({actor: z.string(), target: z.string(), kind: z.enum(['like', 'pass']), at: z.string()})),
  exposures: z.array(z.object({actor: z.string(), target: z.string(), day: z.string(), at: z.string()})),
  matches: z.array(matchSchema), messages: z.array(messageSchema),
  blocks: z.array(z.object({actor: z.string(), target: z.string()})),
  reports: z.array(z.object({id: z.string(), actor: z.string(), target: z.string(), category: z.string(), detail: z.string(), at: z.string(), status: z.enum(['received', 'reviewed'])})),
  audit: z.array(z.object({id: z.string(), target: z.string(), action: z.string(), at: z.string()})),
  reads: z.record(z.string(), z.string()), failNextSend: z.boolean(),
}).superRefine((state, context) => {
  const ids = new Set(state.members.map(m => m.id));
  const references = [state.actor, ...state.reactions.flatMap(r => [r.actor, r.target]), ...state.exposures.flatMap(e => [e.actor, e.target]), ...state.matches.flatMap(m => m.users), ...state.messages.map(m => m.sender), ...state.blocks.flatMap(b => [b.actor, b.target]), ...state.reports.flatMap(r => [r.actor, r.target]), ...state.audit.map(a => a.target)];
  if (ids.size !== state.members.length || references.some(id => !ids.has(id)) || state.messages.some(m => !state.matches.some(match => match.id === m.matchId))) context.addIssue({code: 'custom', message: 'Demo references are inconsistent; reset the saved fixtures.'});
});
export type DemoState = z.infer<typeof demoStateSchema>;
export class DemoError extends Error {}
export const today = (at = new Date().toISOString()) => at.slice(0, 10);
const yes: EligibilityAnswers = Object.fromEntries(Object.keys(emptyAnswers).map(k => [k, true])) as EligibilityAnswers;
const makeProfile = (name: string, gender: Profile['gender'], bio: string): Profile => ({
  display_name: name, gender, gender_description: gender === 'self_described' ? 'My own expression' : '', bio,
  prompts: [{id: 'ordinary_sunday', version: 1, answer: 'A slow morning, a good playlist, and finding a new brunch spot.'}, {id: 'building', version: 1, answer: 'A thoughtful partnership with room for adventure and everyday joy.'}],
  relationship_goal: 'serious_relationship', marriage_intent: 'open',
});
export function createDemo(at = new Date().toISOString()): DemoState {
  const members: DemoMember[] = [
    ['amara', 'Amara', 'woman', '1994-04-12', 'Atlanta', 'Design lover. Sunday market regular. Building a full life, on my own terms.', 0],
    ['malik', 'Malik', 'man', '1993-08-21', 'Decatur', 'Architecture, jazz records, and cooking something worth sharing. Here for something intentional.', 1],
    ['imani', 'Imani', 'nonbinary', '1995-02-16', 'Atlanta', 'Creative soul with a soft spot for bookstores, ceramics, and a really good conversation.', 2],
    ['theo', 'Theo', 'man', '1991-11-03', 'Brookhaven', 'A little outdoorsy. A little homebody. Always making room for the people I love.', 3],
    ['nia', 'Nia', 'woman', '1996-06-18', 'Savannah', 'Salt air, film photography, and the kind of love that feels like coming home.', 4],
    ['jordan', 'Jordan', 'man', '1980-03-02', 'New York', 'A curious mind, weekend museum visits, and a passport full of stories.', 5],
  ].map(([id, name, gender, dob, city, bio, photo]) => ({
    id: String(id), dob: String(dob), profile: makeProfile(String(name), gender as Profile['gender'], String(bio)), answers: {...yes},
    pledged: true, photos: [Number(photo), (Number(photo) + 1) % 6], preferences: {genders: ['woman', 'man', 'nonbinary', 'self_described'], ageMin: 18, ageMax: 45, radius: 50, city: city as Preferences['city']},
    step: 5, identity: 'simulated_verified', lifecycle: 'active', reviewed: true, feedback: '', notifications: true,
  }));
  members.push({id: 'new', dob: '1994-06-15', profile: makeProfile('Your demo profile', 'woman', ''), answers: {...emptyAnswers}, pledged: false, photos: [],
    preferences: {genders: ['man'], ageMin: 18, ageMax: 99, radius: 50, city: 'Atlanta'}, step: 0, identity: 'not_started', lifecycle: 'onboarding', reviewed: false, feedback: '', notifications: true});
  return {version: DEMO_VERSION, actor: 'amara', members, reactions: [{actor: 'malik', target: 'amara', kind: 'like', at}], exposures: [], matches: [], messages: [], blocks: [], reports: [], audit: [], reads: {}, failNextSend: false};
}
export function member(state: DemoState, id = state.actor): DemoMember {
  const value = state.members.find(m => m.id === id);
  if (!value) throw new DemoError('This demo member could not be found. Reset the demo.');
  return value;
}
export function eligible(m: DemoMember, at = new Date().toISOString()): boolean {
  try {return ageOn(m.dob, today(at)) >= 18 && Object.values(m.answers).every(Boolean) && m.pledged;} catch {return false;}
}
export function approved(m: DemoMember, at = new Date().toISOString()): boolean {
  return eligible(m, at) && validProfile(m) && m.reviewed && m.identity === 'simulated_verified' && m.photos.length >= 2;
}
function validProfile(m: DemoMember): boolean {return profileSchema.safeParse(m.profile).success && m.profile.prompts.every(p => demoPrompts.some(entry => entry.id === p.id && entry.version === p.version));}
export function canDiscover(m: DemoMember, at = new Date().toISOString()): boolean {return m.lifecycle === 'active' && approved(m, at);}
export function canChat(m: DemoMember, at = new Date().toISOString()): boolean {return ['active', 'paused'].includes(m.lifecycle) && approved(m, at);}
export function distance(a: DemoMember, b: DemoMember): number {
  const [lat1, lon1] = cities[a.preferences.city], [lat2, lon2] = cities[b.preferences.city];
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
export const pairId = (a: string, b: string) => [a, b].sort().join('--');
export function blocked(state: DemoState, a: string, b: string): boolean {return state.blocks.some(x => (x.actor === a && x.target === b) || (x.actor === b && x.target === a));}
export function compatible(state: DemoState, a: DemoMember, b: DemoMember, at = new Date().toISOString()): boolean {
  if (a.id === b.id || !canDiscover(a, at) || !canDiscover(b, at) || blocked(state, a.id, b.id)) return false;
  const accepts = (viewer: DemoMember, candidate: DemoMember) => {
    const age = ageOn(candidate.dob, today(at));
    return viewer.preferences.genders.includes(candidate.profile.gender) && age >= viewer.preferences.ageMin && age <= viewer.preferences.ageMax && distance(viewer, candidate) <= viewer.preferences.radius;
  };
  return accepts(a, b) && accepts(b, a);
}
export function candidates(state: DemoState, at = new Date().toISOString()): DemoMember[] {
  const viewer = member(state);
  return state.exposures.filter(x => x.actor === viewer.id).map(x => member(state, x.target))
    .filter(m => compatible(state, viewer, m, at) && !state.reactions.some(r => r.actor === viewer.id && r.target === m.id && (r.kind === 'pass' || Date.parse(at) - Date.parse(r.at) < 30 * 86400000)) && !state.matches.some(match => match.id === pairId(viewer.id, m.id)));
}
export function connections(state: DemoState, actor = state.actor, at = new Date().toISOString()): DemoMatch[] {
  return state.matches.filter(m => m.status === 'ready' && m.users.includes(actor) && m.users.every(id => canChat(member(state, id), at)) && !blocked(state, m.users[0], m.users[1]));
}
export function unreadCount(state: DemoState, match: DemoMatch): number {
  const read = state.reads[`${state.actor}/${match.id}`] ?? '';
  return state.messages.filter(m => m.matchId === match.id && m.sender !== state.actor && m.status === 'accepted' && m.at > read).length;
}
export type DemoAction =
  | {type: 'switch'; id: string}
  | {type: 'save'; patch: Partial<DemoMember>}
  | {type: 'discover'}
  | {type: 'react'; target: string; kind: 'like' | 'pass'}
  | {type: 'send'; matchId: string; text: string; id: string}
  | {type: 'retry'; id: string}
  | {type: 'reply'; matchId: string}
  | {type: 'read'; matchId: string}
  | {type: 'close'; target: string; block: boolean}
  | {type: 'unblock'; target: string}
  | {type: 'report'; target: string; category: string; detail: string; id: string}
  | {type: 'moderate'; target: string; decision: 'approve' | 'changes' | 'suspend' | 'restore'; reason: string}
  | {type: 'review_report'; id: string}
  | {type: 'submit'} | {type: 'pause'} | {type: 'delete'} | {type: 'fail_next'} | {type: 'reset'};
export function transition(previous: DemoState, action: DemoAction, at = new Date().toISOString()): DemoState {
  if (action.type === 'reset') return createDemo(at);
  const state = JSON.parse(JSON.stringify(previous)) as DemoState;
  const actor = member(state);
  const mutable = () => {if (['suspended', 'deleted'].includes(actor.lifecycle)) throw new DemoError('This demo account is restricted. Settings and deletion remain available.');};
  const ready = (id: string) => {
    const match = connections(state, actor.id, at).find(m => m.id === id);
    if (!match) throw new DemoError('This conversation is unavailable. It may be closed or restricted.');
    return match;
  };
  switch (action.type) {
    case 'switch': member(state, action.id); state.actor = action.id; break;
    case 'save': {
      mutable();
      // Only the fixture console can set simulated approval or suspension.
      const allowed = ['dob', 'profile', 'answers', 'pledged', 'photos', 'preferences', 'step', 'identity', 'notifications'];
      if (Object.keys(action.patch).some(k => !allowed.includes(k))) throw new DemoError('Use the demo review console to change review status.');
      Object.assign(actor, action.patch);
      if (action.patch.profile || action.patch.photos) {actor.reviewed = false; actor.lifecycle = 'onboarding';}
      if (!eligible(actor, at)) {actor.reviewed = false; actor.lifecycle = 'onboarding';}
      break;
    }
    case 'discover': {
      if (!canDiscover(actor, at)) break;
      const count = state.exposures.filter(x => x.actor === actor.id && x.day === today(at)).length;
      const pool = state.members.filter(m => compatible(state, actor, m, at) && !state.exposures.some(e => e.actor === actor.id && e.target === m.id) && !state.reactions.some(r => r.actor === actor.id && r.target === m.id) && !state.matches.some(match => match.id === pairId(actor.id, m.id)))
        .sort((a, b) => distance(actor, a) - distance(actor, b) || a.id.localeCompare(b.id));
      for (const target of pool.slice(0, Math.max(0, 5 - count))) state.exposures.push({actor: actor.id, target: target.id, day: today(at), at});
      break;
    }
    case 'react': {
      mutable(); const target = member(state, action.target);
      if (!compatible(state, actor, target, at)) throw new DemoError('This profile is no longer available within your preferences.');
      const old = state.reactions.find(r => r.actor === actor.id && r.target === target.id);
      if (old) {if (old.kind === action.kind) return previous; throw new DemoError('This profile has already received your decision.');}
      if (!candidates(state, at).some(m => m.id === target.id)) throw new DemoError('Choose a profile assigned to your discovery queue.');
      state.reactions.push({actor: actor.id, target: target.id, kind: action.kind, at});
      if (action.kind === 'like' && state.reactions.some(r => r.actor === target.id && r.target === actor.id && r.kind === 'like' && Date.parse(at) - Date.parse(r.at) < 30 * 86400000)) {
        const id = pairId(actor.id, target.id);
        if (!state.matches.some(m => m.id === id)) state.matches.push({id, users: [actor.id, target.id].sort() as [string, string], status: 'ready', createdAt: at, reason: ''});
      }
      break;
    }
    case 'send': {
      mutable(); ready(action.matchId); const text = action.text.trim();
      if (!text || text.length > 2000) throw new DemoError('Write a message of 1–2,000 characters.');
      if (state.messages.some(m => m.id === action.id)) return previous;
      state.messages.push({id: action.id, matchId: action.matchId, sender: actor.id, text, at, status: state.failNextSend ? 'failed' : 'accepted', simulated: false});
      state.failNextSend = false; break;
    }
    case 'retry': {
      mutable(); const message = state.messages.find(m => m.id === action.id && m.sender === actor.id);
      if (!message) throw new DemoError('This message was not found.');
      ready(message.matchId); message.status = 'accepted'; message.at = at; break;
    }
    case 'reply': {
      mutable(); const match = ready(action.matchId); const sender = match.users.find(id => id !== actor.id)!;
      state.messages.push({id: `reply-${at}-${state.messages.length}`, matchId: match.id, sender, text: 'That sounds lovely. How about a bookstore and coffee this weekend?', at, status: 'accepted', simulated: true}); break;
    }
    case 'read': ready(action.matchId); state.reads[`${actor.id}/${action.matchId}`] = at; break;
    case 'close': {
      if (actor.lifecycle === 'deleted') throw new DemoError('This demo account has been deleted.');
      if (action.target === actor.id) throw new DemoError('Choose another member.');
      member(state, action.target);
      if (action.block && !state.blocks.some(b => b.actor === actor.id && b.target === action.target)) state.blocks.push({actor: actor.id, target: action.target});
      const match = state.matches.find(m => m.id === pairId(actor.id, action.target));
      if (match) {match.status = 'closed'; match.reason = action.block ? 'blocked' : 'unmatched';}
      break;
    }
    case 'unblock': mutable(); state.blocks = state.blocks.filter(b => !(b.actor === actor.id && b.target === action.target)); break;
    case 'report': {
      if (actor.lifecycle === 'deleted' || actor.id === action.target) throw new DemoError('This report cannot be submitted.');
      member(state, action.target);
      if (!action.category || action.detail.length > 1000) throw new DemoError('Choose a category and keep details under 1,000 characters.');
      if (!state.reports.some(r => r.id === action.id)) state.reports.push({id: action.id, actor: actor.id, target: action.target, category: action.category, detail: action.detail, at, status: 'received'});
      break;
    }
    case 'moderate': {
      const target = member(state, action.target);
      if (target.lifecycle === 'deleted') throw new DemoError('Deleted demo accounts cannot be restored by review.');
      if (!action.reason.trim()) throw new DemoError('Add a reason for this simulated review.');
      if (action.decision === 'approve' || action.decision === 'restore') {
        if (!eligible(target, at) || target.photos.length < 2 || target.identity !== 'simulated_verified' || !validProfile(target)) throw new DemoError('Complete eligibility, photos, profile, and simulated identity first.');
        target.reviewed = true; target.lifecycle = 'active'; target.feedback = '';
      } else {target.reviewed = false; target.lifecycle = action.decision === 'suspend' ? 'suspended' : 'changes_requested'; target.feedback = action.reason;}
      state.audit.push({id: `audit-${at}-${state.audit.length}`, target: target.id, action: `${action.decision}: ${action.reason}`, at}); break;
    }
    case 'review_report': {const report = state.reports.find(r => r.id === action.id); if (report && report.status !== 'reviewed') {report.status = 'reviewed'; state.audit.push({id: `audit-${at}-${state.audit.length}`, target: report.target, action: 'Synthetic report reviewed', at});} break;}
    case 'submit': mutable(); if (!eligible(actor, at) || !validProfile(actor) || actor.photos.length < 2 || actor.identity !== 'simulated_verified') throw new DemoError('Complete eligibility, two photos, profile, and simulated identity first.'); actor.lifecycle = 'pending_review'; actor.reviewed = false; actor.step = 5; break;
    case 'pause': mutable(); if (!approved(actor, at)) throw new DemoError('Complete demo review before resuming.'); actor.lifecycle = actor.lifecycle === 'paused' ? 'active' : 'paused'; break;
    case 'delete': {
      actor.lifecycle = 'deleted'; actor.reviewed = false; actor.profile = makeProfile('Deleted demo member', 'nonbinary', ''); actor.photos = []; actor.answers = {...emptyAnswers}; actor.pledged = false; actor.identity = 'not_started'; actor.dob = '1994-06-15'; actor.preferences = {genders: ['man'], ageMin: 18, ageMax: 99, radius: 50, city: 'Atlanta'};
      state.messages = state.messages.filter(m => !state.matches.find(match => match.id === m.matchId)?.users.includes(actor.id));
      for (const match of state.matches.filter(m => m.users.includes(actor.id))) {match.status = 'closed'; match.reason = 'deleted';}
      state.reactions = state.reactions.filter(r => r.actor !== actor.id && r.target !== actor.id);
      state.exposures = state.exposures.filter(e => e.actor !== actor.id && e.target !== actor.id);
      state.blocks = state.blocks.filter(b => b.actor !== actor.id && b.target !== actor.id);
      break;
    }
    case 'fail_next': mutable(); state.failNextSend = true; break;
  }
  return demoStateSchema.parse(state);
}
export function exportOwnDemo(state: DemoState): string {
  return JSON.stringify({notice: 'Synthetic local demo data only. No live account export occurred.', member: member(state), messages: state.messages.filter(m => m.sender === state.actor), reports: state.reports.filter(r => r.actor === state.actor)}, null, 2);
}
