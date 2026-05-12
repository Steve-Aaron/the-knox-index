/**
 * brand/constants.ts
 * -------------------
 * Single source of truth for all The Knox Index brand assets and copy.
 * Import from here rather than scattering strings across components.
 * Change the product name, tagline, or contact details here once.
 */

export const BRAND = {
  name:        'The Knox Index',
  nameShort:   'Knox Index',
  kicker:      'THE KNOX INDEX',
  tagline:     'UK Political Intelligence on TikTok',
  description: 'Daily intelligence on how UK politicians perform on TikTok — ranked, scored, and briefed.',

  contact: {
    email:    'steve+tki@knoxdigi.com',
    linkedin: 'https://www.linkedin.com/company/knox-digital',
    website:  'https://theknoxindex.vercel.app',
  },

  /** Segment options shown in the registration form */
  segments: [
    { value: 'consultant',  label: 'Political Communications Consultant' },
    { value: 'agency',      label: 'Digital Agency' },
    { value: 'officer',     label: 'Caseworker / Parliamentary Officer' },
    { value: 'mp',          label: 'MP / Councillor / MSP' },
    { value: 'journalist',  label: 'Journalist' },
    { value: 'student',     label: 'Student' },
    { value: 'other',       label: 'Other' },
  ],

  /** Interest options shown in the registration form */
  interests: [
    { value: 'leaderboard',   label: 'Who is performing best on TikTok' },
    { value: 'content',       label: 'What content styles work' },
    { value: 'opponent',      label: 'What my opponents are posting' },
    { value: 'constituents',  label: 'What constituents are talking about' },
    { value: 'strategy',      label: 'Building a TikTok strategy' },
    { value: 'research',      label: 'Academic / journalistic research' },
  ],
} as const;
