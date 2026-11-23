/**
 * lib/brevoProfile.ts
 * --------------------
 * The 'Help us tailor your experience' answers → a Brevo contact. Shared by
 * the UK profile form (/api/preferences, after sign-in) and the World Leaders
 * waitlist (/api/tenant/access), so both write the same attributes and lists.
 *
 * Attributes: FIRSTNAME, LASTNAME, COMPANY, LINKEDIN, JOB_ROLE,
 * WHY_USE_KNOX_INDEX, the CONSENT_* flags, and SOURCE when given.
 *
 * `includeBriefing: false` (World Leaders, whose form has no briefing
 * option) leaves the briefing flags and lists untouched, so someone already
 * on the UK briefing is not taken off it by joining the waitlist.
 *
 * One job: parse the profile answers and save them to Brevo.
 */

import { upsertWithConsent, type BrevoResult, type BrevoValue } from '@/lib/brevo';

export interface ProfileAnswers {
  firstName:  string;
  lastName:   string;
  company:    string;
  linkedin:   string;
  /** A segment id from data/profileOptions.ts, or 'other:<text>'. */
  segment:    string;
  interests:  string[];
  consentKnoxUpdates:    boolean;
  consentKnoxDigital:    boolean;
  consentDailyBriefing:  boolean;
  consentWeeklyBriefing: boolean;
}

/** Trims and caps every field of a request body. */
export function readProfileAnswers(body: any): ProfileAnswers {
  const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  let daily  = !!body?.consentDailyBriefing;
  let weekly = !!body?.consentWeeklyBriefing;
  // Mutually exclusive; daily wins a tie (matches FrequencyPicker).
  if (daily && weekly) weekly = false;
  return {
    firstName: text(body?.firstName, 64),
    lastName:  text(body?.lastName, 64),
    company:   text(body?.company, 128),
    linkedin:  text(body?.linkedin, 256),
    segment:   text(body?.segment, 64),
    interests: Array.isArray(body?.interests)
      ? body.interests.map((x: unknown) => String(x).slice(0, 64)).slice(0, 10)
      : [],
    consentKnoxUpdates:    !!body?.consentKnoxUpdates,
    consentKnoxDigital:    !!body?.consentKnoxDigital,
    consentDailyBriefing:  daily,
    consentWeeklyBriefing: weekly,
  };
}

export async function saveProfileToBrevo(
  email: string,
  a: ProfileAnswers,
  options: { includeBriefing: boolean; source?: string; firebaseUid?: string },
): Promise<BrevoResult> {
  const attributes: Record<string, BrevoValue> = {};
  if (a.firstName)        attributes.FIRSTNAME          = a.firstName;
  if (a.lastName)         attributes.LASTNAME           = a.lastName;
  if (a.company)          attributes.COMPANY            = a.company;
  if (a.linkedin)         attributes.LINKEDIN           = a.linkedin;
  if (a.segment)          attributes.JOB_ROLE           = a.segment;
  if (a.interests.length) attributes.WHY_USE_KNOX_INDEX = a.interests;
  if (options.source)     attributes.SOURCE             = options.source;
  // Ties the Brevo contact to its Firestore access doc without the access
  // store holding any email. The admin panel reads back by this.
  if (options.firebaseUid) attributes.FIREBASE_UID      = options.firebaseUid;

  // Consent flags are always written, even false: they mirror list membership.
  attributes.CONSENT_KNOX_INDEX_UPDATES = a.consentKnoxUpdates;
  attributes.CONSENT_KNOX_DIGITAL       = a.consentKnoxDigital;
  const consents: Record<string, boolean> = {
    CONSENT_KNOX_INDEX_UPDATES: a.consentKnoxUpdates,
    CONSENT_KNOX_DIGITAL:       a.consentKnoxDigital,
  };
  if (options.includeBriefing) {
    attributes.CONSENT_DAILY_BRIEFING  = a.consentDailyBriefing;
    attributes.CONSENT_WEEKLY_BRIEFING = a.consentWeeklyBriefing;
    consents.CONSENT_DAILY_BRIEFING    = a.consentDailyBriefing;
    consents.CONSENT_WEEKLY_BRIEFING   = a.consentWeeklyBriefing;
  }

  return upsertWithConsent(email, attributes, consents).catch((e: any) => {
    console.error('[brevoProfile] Brevo error', e?.message ?? e);
    return { ok: false, status: 500 };
  });
}
