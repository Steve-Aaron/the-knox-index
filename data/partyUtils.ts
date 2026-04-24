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
  'liberal democrat':          'libdem',
  'liberal democrats':         'libdem',
  'lib dem':                   'libdem',
  'libdem':                    'libdem',
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
  'independent':               'independent',
};

export function toPartyKeyPublic(raw: string | null | undefined): PartyKey {
  if (!raw) return 'unknown';
  return PARTY_MAP[raw.toLowerCase().trim()] ?? 'unknown';
}
