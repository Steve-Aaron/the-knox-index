import { accent, knox } from '@/theme/colors';
import type { SocialPlatform } from '@/data/account/types';
import type { PostPlatformGlyph } from '@/components/post/card/PostPlatformIcon';

/**
 * Presentation metadata per social platform, shared by every account widget
 * so TikTok and X keep the same name, icon and series colour everywhere.
 */
export interface PlatformMeta {
  label: string;
  /** FontAwesome6 brand icon name. */
  icon:  PostPlatformGlyph;
  /** Series colour on charts. */
  color: string;
}

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  tiktok: { label: 'TikTok', icon: 'tiktok',    color: accent.indigo },
  x:      { label: 'X',      icon: 'x-twitter', color: knox.secondaryOrange },
};

/** Stable display order. */
export const PLATFORM_ORDER: SocialPlatform[] = ['tiktok', 'x'];
