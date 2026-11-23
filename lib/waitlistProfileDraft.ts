/**
 * lib/waitlistProfileDraft.ts
 * ----------------------------
 * Holds the World Leaders waitlist answers in this browser while a signed-out
 * visitor confirms their email. The form is filled first; joining needs a
 * verified sign-in, so the answers wait here, then the page files the request
 * once the visitor lands back signed in (components/auth/StickyUnlock.tsx).
 *
 * Never trusted for access: the request is filed against the SESSION's uid,
 * not anything stored here. Expires after TTL_DAYS; cleared once filed.
 *
 * One job: save, read and clear the pending waitlist answers. Web only.
 */

const KEY     = 'tki_waitlist_profile_draft';
const TTL_DAYS = 7;
const TTL_MS   = TTL_DAYS * 24 * 60 * 60 * 1000;

export interface ProfileDraftAnswers {
  firstName:      string;
  lastName:       string;
  company:        string;
  linkedinHandle: string;
  segment:        string | null;
  otherText:      string;
  interests:      string[];
  consentUpdates: boolean;
  consentKnox:    boolean;
}

export interface WaitlistProfileDraft {
  answers: ProfileDraftAnswers;
  /** The address a magic link went to; null for Google, which picks its own. */
  email:   string | null;
  savedAt: number;
}

export function readProfileDraft(now: number = Date.now()): WaitlistProfileDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.savedAt !== 'number') return null;
    if (now - d.savedAt > TTL_MS || d.savedAt > now + 60_000) return null;
    const a = d.answers ?? {};
    const text = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      answers: {
        firstName:      text(a.firstName),
        lastName:       text(a.lastName),
        company:        text(a.company),
        linkedinHandle: text(a.linkedinHandle),
        segment:        typeof a.segment === 'string' ? a.segment : null,
        otherText:      text(a.otherText),
        interests:      Array.isArray(a.interests) ? a.interests.filter((x: unknown) => typeof x === 'string') : [],
        consentUpdates: !!a.consentUpdates,
        consentKnox:    !!a.consentKnox,
      },
      email:   typeof d.email === 'string' && d.email ? d.email.trim().toLowerCase() : null,
      savedAt: d.savedAt,
    };
  } catch {
    return null;
  }
}

export function saveProfileDraft(draft: Omit<WaitlistProfileDraft, 'savedAt'>): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() })); } catch { /* storage blocked */ }
}

export function clearProfileDraft(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
