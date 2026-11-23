import type { BriefsApiResponse } from './types';

/**
 * data/placeholderBrief.ts
 * -------------------------
 * Stand-in briefing for dashboards the briefing pipeline does not cover yet
 * (World Leaders). Fills the SummaryPanel's narrative and 'top narratives'
 * slots so the layout is reviewed at its real size.
 *
 * Deliberately says nothing about real people or numbers: it is layout copy,
 * shown with a 'SAMPLE' badge, and must never be mistaken for analysis.
 */
export const PLACEHOLDER_BRIEF: BriefsApiResponse = {
  isToday: true,
  brief: {
    briefDate: new Date().toISOString().slice(0, 10),
    briefDailySummary:
      'Sample briefing. Yesterday’s summary of how world leaders performed on TikTok and X will appear here once the briefing pipeline covers this dashboard: who led, which posts broke through, and what changed since the day before.',
    briefWeeklySummary:
      'Sample briefing. This week’s summary of how world leaders performed on TikTok and X will appear here once the briefing pipeline covers this dashboard: who led each platform, which regions gained ground, and the posts that defined the week.',
    topNarrativesThisWeek: [
      { headline: 'Narrative headline one', body: 'A two-line summary of the first narrative of the week, with the leaders and posts that carried it.' },
      { headline: 'Narrative headline two', body: 'A two-line summary of the second narrative, noting where it ran on TikTok, on X, or both.' },
      { headline: 'Narrative headline three', body: 'A two-line summary of the third narrative and the region it centred on.' },
    ],
  },
};
