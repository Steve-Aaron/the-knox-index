/**
 * data/partyUtils.ts
 * -------------------
 * Shared party-key lookup extracted so both the transformer and the posts
 * API route can use it without circular imports.
 */
import type { PartyKey } from '@/theme/colors';

const PARTY_MAP: Record<string, PartyKey> = {
  'labour':                    'labour',
  'conservative':              'conservative',
  'conservatives':             'conservative',
  'conservative party':        'conservative',
  'conservative and unionist': 'conservative',
  'tory':                      'conservative',
  'tories':                    'conservative',
  'con':                       'conservative',
  'liberal democrat':           'libdem',
  'liberal democrats':          'libdem',
  'liberal democrat party':     'libdem',
  'lib dem':                    'libdem',
  'lib dems':                   'libdem',
  'libdem':                     'libdem',
  'libdems':                    'libdem',
  'ld':                         'libdem',
  'snp':                       'snp',
  'scottish national party':   'snp',
  'green':                     'green',
  'green party':               'green',
  'greens':                    'green',
  'the greens':                'green',
  'reform':                    'reform',
  'reform uk':                 'reform',
  'plaid cymru':               'plaid',
  'dup':                       'dup',
  'democratic unionist party': 'dup',
  'sinn fein':                 'sinnfein',
  'sinn féin':                 'sinnfein',
  'alliance':                  'alliance',
  'alliance party':            'alliance',
  'sdlp':                      'sdlp',
  'social democratic and labour party': 'sdlp',
  'uup':                       'uup',
  'ulster unionist party':     'uup',
  'tuv':                       'tuv',
  'traditional unionist voice': 'tuv',
  'workers party gb':          'workers',
  'workers party':             'workers',
  'workers party of britain':  'workers',
  'advance uk':                'advance',
  'advance':                   'advance',
  'restore britain':           'restore',
  'your party':                'yourparty',
  'independent':               'independent',
};

export function toPartyKeyPublic(raw: string | null | undefined): PartyKey {
  if (!raw) return 'unknown';
  // Normalise to the map's spelling: lowercase, trim, and convert snake_case /
  // kebab-case to spaces so BigQuery values like 'liberal_democrats' or
  // 'reform_uk' match the space-separated keys above.
  const norm = raw.toLowerCase().trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return PARTY_MAP[norm] ?? 'unknown';
}

/**
 * Reverse of toPartyKeyPublic: every normalised raw spelling that maps to the
 * given party key. Used to filter the post table server-side by party — the DB
 * stores raw `a.party` strings, so we match the normalised value against this
 * set. Returns [] for unknown/unmapped keys (caller should then skip the filter).
 */
export function partyKeyToRawNames(key: string): string[] {
  return Object.keys(PARTY_MAP).filter(name => PARTY_MAP[name] === key);
}
