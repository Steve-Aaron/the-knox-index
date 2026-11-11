import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, TextInput, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SearchField } from './SearchField';
import { SearchResultRow } from './SearchResultRow';
import { useSearchIndex } from '@/data/useSearchIndex';
import { useRegisteredFlag } from '@/hooks/useRegisteredFlag';
import { useTenant } from '@/hooks/useTenant';
import { searchIndex, type SearchHit } from '@/lib/search';
import { track } from '@/lib/analytics';
import { neutral, glass, knox } from '@/theme/colors';
import { font, weight } from '@/theme/typography';

/**
 * HeaderSearch
 * -------------
 * The global search in HeaderNav: one field for politicians and their groups
 * (parties, or regions on World Leaders), with a results dropdown that
 * overlays the page.
 *
 *   desktop — dropdown floats under the field, results grouped by type
 *   mobile  — dropdown flows under the field inside HeaderNav's overlay,
 *             one flat ranked list
 *
 * Data scope is the server's: /api/search runs the tenant guard. Guests see
 * accounts outside the leaderboard's top 5 locked, plus a register prompt.
 * Enter opens the highlighted row, else the best match.
 *
 * One job: turn a query into navigation.
 */
interface Props {
  variant:    'desktop' | 'mobile';
  autoFocus?: boolean;
  /** Called after a navigation or Escape — the mobile overlay closes on it. */
  onClose?:   () => void;
}

export function HeaderSearch({ variant, autoFocus, onClose }: Props) {
  const tenant       = useTenant();
  const isRegistered = useRegisteredFlag();
  const isMobile     = variant === 'mobile';
  const { height }   = useWindowDimensions();

  const [query, setQuery]         = useState('');
  const [open, setOpen]           = useState(!!autoFocus);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<TextInput>(null);
  const rootRef  = useRef<View>(null);

  const { index, failed, retry } = useSearchIndex(open);

  const subjects  = tenant.brand.subjectPlural;
  const groupsPl  = tenant.grouping.mode === 'region' ? 'Regions' : 'Parties';
  const placeholder = `Search ${subjects.toLowerCase()} or ${groupsPl.toLowerCase()}`;

  const hits = useMemo(() => (index ? searchIndex(index, query) : []), [index, query]);
  const people = hits.filter(h => h.type === 'person');
  const groups = hits.filter(h => h.type === 'group');
  // Grouped (desktop) lists people first; arrow keys walk the shown order.
  const shown  = isMobile ? hits : [...people, ...groups];

  const isLocked = (hit: SearchHit) => hit.type === 'person' && hit.person.locked && !isRegistered;
  const showDropdown = open && query.trim().length > 0;

  // Desktop web: close when a press lands outside the search. Not on blur —
  // pressing a result blurs the input before the press registers.
  useEffect(() => {
    if (isMobile || Platform.OS !== 'web' || !open || typeof document === 'undefined') return;
    const onDown = (e: MouseEvent) => {
      const node = rootRef.current as unknown as HTMLElement | null;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isMobile, open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    onClose?.();
  };

  const select = (hit: SearchHit, position: number) => {
    track('search_result_selected', {
      result_type:   hit.type === 'person' ? 'politician' : 'group',
      politician_id: hit.type === 'person' ? hit.person.id : null,
      group_key:     hit.type === 'group' ? hit.group.key : hit.person.groupKey,
      locked:        isLocked(hit),
      position,
      query_length:  query.trim().length,
    });

    close();
    if (isLocked(hit))           router.push('/login');
    else if (hit.type === 'person') router.push(`/account/${encodeURIComponent(hit.person.handle)}`);
    // navigate, not push: reuse the home screen if it is already in the stack.
    else                         router.navigate({ pathname: '/', params: { group: hit.group.key } });
  };

  const onRegister = () => {
    track('search_register_tapped', { query_length: query.trim().length });
    close();
    router.push('/login');
  };

  const onKey = (key: string) => {
    if (key === 'Escape') { close(); return; }
    if (!shown.length) return;
    if (key === 'ArrowDown') setHighlight(h => (h + 1) % shown.length);
    if (key === 'ArrowUp')   setHighlight(h => (h <= 0 ? shown.length - 1 : h - 1));
  };

  const onSubmit = () => {
    const hit = highlight >= 0 ? shown[highlight] : hits[0];
    if (hit) select(hit, shown.indexOf(hit) + 1);
  };

  const onChangeText = (text: string) => {
    setQuery(text);
    setHighlight(-1);
    setOpen(true);
    if (failed) retry();
  };

  const renderRow = (hit: SearchHit) => {
    const i = shown.indexOf(hit);
    return (
      <SearchResultRow
        key={hit.type === 'person' ? `p:${hit.person.id}` : `g:${hit.group.key}`}
        hit={hit}
        groupNoun={tenant.grouping.label}
        locked={isLocked(hit)}
        highlighted={i === highlight}
        onPress={() => select(hit, i + 1)}
      />
    );
  };

  const showPrompt = hits.some(isLocked);

  return (
    <View ref={rootRef} style={isMobile ? styles.rootMobile : styles.rootDesktop}>
      <SearchField
        ref={inputRef}
        value={query}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChangeText={onChangeText}
        onFocus={() => setOpen(true)}
        onClear={() => { setQuery(''); inputRef.current?.focus(); }}
        onSubmit={onSubmit}
        onKey={onKey}
      />

      {showDropdown && (
        // Scrolls on mobile, where the keyboard can cover the bottom rows.
        <ScrollView
          style={[styles.dropdown, isMobile ? { maxHeight: height * 0.5 } : styles.dropdownFloating]}
          contentContainerStyle={styles.dropdownContent}
          keyboardShouldPersistTaps="handled"
        >
          {hits.length === 0 ? (
            <Text style={styles.sectionTitle}>
              {failed ? 'Search is unavailable, try again' : index ? 'No matches' : 'Searching…'}
            </Text>
          ) : isMobile ? (
            hits.map(renderRow)
          ) : (
            <>
              {people.length > 0 && <Text style={styles.sectionTitle}>{subjects}</Text>}
              {people.map(renderRow)}
              {people.length > 0 && groups.length > 0 && <View style={styles.divider} />}
              {groups.length > 0 && <Text style={styles.sectionTitle}>{groupsPl}</Text>}
              {groups.map(renderRow)}
            </>
          )}

          {showPrompt && (
            <>
              {!isMobile && <View style={styles.divider} />}
              <View style={styles.prompt}>
                <View style={styles.promptText}>
                  <View style={styles.promptTitle}>
                    <Text style={styles.promptKicker}>LOCKED</Text>
                    <Text style={styles.promptHeadline}>Register to see all {subjects.toLowerCase()}</Text>
                  </View>
                  <Text style={styles.promptBody}>
                    Unlock full details about the {subjects.toLowerCase()} and {groupsPl.toLowerCase()}, and gain access to all posts
                  </Text>
                </View>
                <Pressable
                  onPress={onRegister}
                  accessibilityRole="link"
                  style={({ pressed }) => [styles.promptButton, pressed && { opacity: 0.75 }]}
                >
                  <Text style={styles.promptButtonText}>Continue for log in</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootDesktop: {
    position:   'relative',
    width:      400,
    flexShrink: 1,
    minWidth:   200,
  },
  rootMobile: {
    width: '100%',
    gap:   8,
  },

  dropdown: {
    borderWidth:     1,
    borderColor:     glass.border,
    backgroundColor: neutral.felt + 'F0',  // 94%
    ...Platform.select({
      web: {
        backdropFilter:       'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow:            '0 16px 24px rgba(0,0,0,0.5)',
      } as any,
      default: {
        shadowColor:   '#000',
        shadowOpacity: 0.5,
        shadowRadius:  24,
        shadowOffset:  { width: 0, height: 16 },
        elevation:     12,
      },
    }),
  },
  dropdownContent: {
    gap:     8,
    padding: 8,
  },
  dropdownFloating: {
    position: 'absolute',
    top:      40,  // 32px field + 8px gap
    left:     0,
    right:    0,
  },

  sectionTitle: {
    paddingTop:        6,
    paddingBottom:     2,
    paddingHorizontal: 12,
    fontFamily:        font.ui,
    fontWeight:        weight.semiBold,
    fontSize:          12,
    letterSpacing:     0.8,
    textTransform:     'uppercase',
    color:             neutral.textMid,
  },
  divider: {
    height:          1,
    backgroundColor: glass.border,
  },

  // ── Register prompt (guests) ────────────────────────────────────────────
  prompt: {
    alignItems:      'center',
    gap:             16,
    padding:         20,
    borderWidth:     1,
    borderColor:     knox.primaryPink,
    backgroundColor: neutral.felt + 'EB',  // 92%
    ...Platform.select({
      web: {
        backdropFilter:       'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow:            `0 16px 24px ${knox.primaryPink}47`,  // 28%
      } as any,
      default: {},
    }),
  },
  promptText:  { alignItems: 'center', gap: 10 },
  promptTitle: { alignItems: 'center', gap: 6 },
  promptKicker: {
    fontFamily:    font.ui,
    fontSize:      11,
    letterSpacing: 2,
    color:         knox.primaryPink,
  },
  promptHeadline: {
    fontFamily: font.ui,
    fontSize:   18,
    lineHeight: 22,
    color:      neutral.text,
    textAlign:  'center',
  },
  promptBody: {
    maxWidth:   298,
    fontFamily: font.ui,
    fontSize:   12,
    lineHeight: 17,
    color:      neutral.textMid,
    textAlign:  'center',
  },
  promptButton: {
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       knox.primaryPink,
    backgroundColor:   knox.primaryPink + '1F',  // 12%
  },
  promptButtonText: {
    fontFamily:    font.ui,
    fontSize:      11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color:         knox.primaryPink,
  },
});
