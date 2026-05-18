/**
 * data/profileOptions.ts
 * -----------------------
 * Shared segment and interest definitions used by both the registration
 * profiling modal (StickyUnlock) and the /preferences settings page.
 *
 * One job: be the single source of truth for user profile options.
 */

export interface SegmentOption {
  id:    string;
  label: string;
  sub:   string;
  icon:  string;
}

export interface InterestOption {
  id:   string;
  label: string;
  desc: string;
  icon: string;
}

export const SEGMENTS: SegmentOption[] = [
  { id: 'political_consultant',  label: 'Political Consultant',      sub: 'A freelancer or agency working in politics',    icon: 'briefcase'       },
  { id: 'comms_consultant',      label: 'Communications Consultant', sub: 'Work in digital media or social media',         icon: 'bullhorn'        },
  { id: 'other_consultant',      label: 'Other Consultant',          sub: 'With an interest in politics',                  icon: 'handshake'       },
  { id: 'elected_official',      label: 'Elected Official',          sub: 'MP, MSP, Councillor, or another elected role',  icon: 'landmark'        },
  { id: 'parliamentary_officer', label: 'Parliamentary Officer',     sub: 'Caseworker, Advisor, or a similar role',        icon: 'user-tie'        },
  { id: 'journalist',            label: 'Journalist',                sub: 'Working for a newspaper or another media role', icon: 'newspaper'       },
  { id: 'student',               label: 'Student',                   sub: 'At university or college',                      icon: 'graduation-cap'  },
  { id: 'other',                 label: 'Other',                     sub: 'Or a member of the general public',             icon: 'circle-question' },
];

export const INTERESTS: InterestOption[] = [
  { id: 'find_news_stories',          label: 'Find new stories',           desc: 'Unique angles on political TikTok strategy',     icon: 'magnifying-glass' },
  { id: 'track_mps',                  label: 'Track other MPs',             desc: 'See what opponents post and why it cuts through', icon: 'chess'            },
  { id: 'monitor_constituent_issues', label: 'Monitor constituent issues',  desc: 'Issues trending with your community on TikTok',  icon: 'comments'         },
  { id: 'build_daily_briefings',      label: 'Build daily briefings',       desc: 'Morning intelligence for you or your clients',   icon: 'clipboard-list'   },
  { id: 'analyse_performance_data',   label: 'Analyse performance data',    desc: 'Deep-dive engagement metrics and content trends', icon: 'chart-line'       },
  { id: 'just_for_fun',               label: 'Just for fun',                desc: 'You find UK political TikTok oddly fascinating',  icon: 'face-smile'       },
];
