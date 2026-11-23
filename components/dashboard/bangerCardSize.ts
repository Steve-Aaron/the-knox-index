/**
 * components/dashboard/bangerCardSize.ts
 * ---------------------------------------
 * One source of truth for the outer size of a Top Posts strip card, so a
 * TikTok tile (PostBangerCard) and a tweet (TweetBangerCard) render at the
 * SAME width and height whichever a given post happens to be. Change the
 * strip's card size here, once, and both card types follow.
 *
 * One job: hold the shared card dimensions.
 */

/** Shared outer width of every Top Posts strip card. */
export const BANGER_CARD_WIDTH = 320;

/** Shared outer height of every Top Posts strip card. */
export const BANGER_CARD_HEIGHT = 420;
