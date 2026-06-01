import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MotiView } from 'moti';
import { party, neutral, knox } from '@/theme/colors';
import type { PartyKey } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Kicker } from '@/components/ui/Kicker';
import type { Politician } from '@/data/types';

/**
 * HeroChart — Live UK pulse map
 * ------------------------------
 * Stylised UK silhouette with four nation-level pulses sitting on top:
 *
 *   Scotland · Northern Ireland · Wales · England
 *
 * Each pulse:
 *   ▸ takes its colour from the dominant party in that nation
 *     (highest aggregate Knox factor among that nation's politicians)
 *   ▸ animates two staggered expanding rings (a slow heartbeat)
 *   ▸ maximum ring scale is proportional to the nation's aggregate Knox
 *     factor — louder nations pulse bigger
 *
 * Implementation note: react-native-svg <Circle> elements don't accept
 * MotiView animations directly, so we render the silhouette inside a
 * <Svg>, then position the pulses as absolutely-placed <MotiView>s over
 * the same container. The wrapper enforces the silhouette's aspect ratio
 * so percentage-based pulse positions stay aligned to the SVG viewBox.
 *
 * One job: a brand-coloured, party-driven 'we are live across the UK'
 * signature for the hero RHS.
 */

interface Props {
  politicians: Politician[];
}

// ── SVG viewBox + UK outline ─────────────────────────────────────────────────
const VIEW_W = 360;
const VIEW_H = 480;

const UK_PATH = [
  // Great Britain — clockwise from NE Scotland
  'M 230 55',
  'L 240 78  L 250 108 L 248 140 L 270 175 L 282 215 L 290 258',
  'L 305 285 L 302 310 L 292 335 L 296 358 L 280 372 L 252 380',
  'L 220 386 L 188 390 L 158 388 L 132 380 L 112 372 L 96 365',
  'L 82 360  L 75 348  L 92 338  L 112 348 L 128 358 L 144 368',
  'L 158 360 L 168 348 L 158 332 L 142 318 L 128 302 L 118 286',
  'L 108 274 L 96 264  L 108 252 L 128 248 L 138 232 L 152 215',
  'L 162 195 L 156 175 L 150 155 L 156 132 L 142 112 L 126 92',
  'L 118 70  L 132 58  L 158 50 L 188 48 L 218 52 L 230 55',
  'Z',
  // Northern Ireland — offshore island to the west
  'M 35 218',
  'L 52 212 L 72 222 L 82 240 L 78 258 L 64 268 L 42 264',
  'L 28 248 L 26 228',
  'Z',
].join(' ');

// ── Nation centroids inside the viewBox ──────────────────────────────────────
type NationId = 'scotland' | 'ni' | 'wales' | 'england';

interface NationDef {
  id:      NationId;
  label:   string;
  cx:      number;
  cy:      number;
  parties: PartyKey[];
}

const NATIONS: NationDef[] = [
  { id: 'scotland', label: 'SCOTLAND',  cx: 195, cy: 120, parties: ['snp'] },
  { id: 'ni',       label: 'N IRELAND', cx: 55,  cy: 240, parties: ['dup', 'sinnfein'] },
  { id: 'wales',    label: 'WALES',     cx: 130, cy: 330, parties: ['plaid'] },
  { id: 'england',  label: 'ENGLAND',   cx: 225, cy: 285, parties: ['labour', 'conservative', 'libdem', 'green', 'reform', 'independent', 'unknown'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the party with the highest aggregate Knox factor among a slice. */
function dominantPartyFor(politicians: Politician[], allowed: PartyKey[]): PartyKey | null {
  const totals = new Map<PartyKey, number>();
  for (const p of politicians) {
    if (!allowed.includes(p.partyKey)) continue;
    totals.set(p.partyKey, (totals.get(p.partyKey) ?? 0) + p.scores.knoxFactor);
  }
  let bestParty: PartyKey | null = null;
  let bestScore = -1;
  for (const [k, v] of totals) {
    if (v > bestScore) { bestScore = v; bestParty = k; }
  }
  return bestParty;
}

/** Sum of Knox factor across politicians from a given set of parties. */
function aggregateKnox(politicians: Politician[], allowed: PartyKey[]): number {
  let s = 0;
  for (const p of politicians) {
    if (allowed.includes(p.partyKey)) s += p.scores.knoxFactor;
  }
  return s;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HeroChart({ politicians }: Props) {
  const pulses = useMemo(() => {
    if (politicians.length === 0) return [];

    const aggregates = NATIONS.map(n => aggregateKnox(politicians, n.parties));
    const maxAgg     = Math.max(1, ...aggregates);

    return NATIONS.map((n, i) => {
      const dom    = dominantPartyFor(politicians, n.parties);
      // Fall back to Knox brand pink when a nation has no tracked politicians
      const colour = dom ? party[dom] : { base: knox.primaryPink, glow: knox.primaryPink };
      // Normalised intensity 0–1 → max ring scale 1.4 – 3.4
      const intensity = aggregates[i] / maxAgg;
      return {
        id:        n.id,
        label:     n.label,
        leftPct:   (n.cx / VIEW_W) * 100,
        topPct:    (n.cy / VIEW_H) * 100,
        baseHex:   colour.base,
        glowHex:   colour.glow,
        maxScale:  1.4 + intensity * 2.0,
        dominant:  dom,
        knox:      aggregates[i],
      };
    });
  }, [politicians]);

  return (
    <View style={styles.wrap}>
      <DevLabel name="HeroChart" />
      <Kicker style={{ fontSize: 11, color: knox.primaryPink, letterSpacing: 2 }}>LIVE UK PULSE · BY NATION</Kicker>

      <View style={styles.mapWrap}>
        {/* Silhouette layer */}
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Path
            d={UK_PATH}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
            fillRule="evenodd"
          />
        </Svg>

        {/* Pulse layer — absolutely positioned on top of the SVG */}
        {pulses.map((p, idx) => (
          <NationPulse
            key={p.id}
            leftPct={p.leftPct}
            topPct={p.topPct}
            baseHex={p.baseHex}
            glowHex={p.glowHex}
            maxScale={p.maxScale}
            label={p.label}
            // Stagger ring start times so the four nations don't beat in unison
            delayMs={idx * 240}
          />
        ))}
      </View>
    </View>
  );
}

// ── NationPulse — a single nation hotspot ────────────────────────────────────

interface NationPulseProps {
  leftPct:  number;
  topPct:   number;
  baseHex:  string;
  glowHex:  string;
  maxScale: number;
  label:    string;
  delayMs:  number;
}

const PULSE_DURATION_MS = 1800;
const CORE_SIZE         = 14;
const RING_SIZE         = 16;

function NationPulse({ leftPct, topPct, baseHex, glowHex, maxScale, label, delayMs }: NationPulseProps) {
  return (
    <View
      style={[
        styles.pulseAnchor,
        // Anchor the centre of the pulse on the centroid
        { left: `${leftPct}%`, top: `${topPct}%` },
      ]}
      pointerEvents="none"
    >
      {/* Expanding ring 1 — fades out as it grows */}
      <MotiView
        from={{ scale: 1,    opacity: 0.6 }}
        animate={{ scale: maxScale, opacity: 0 }}
        transition={{
          type:          'timing',
          duration:       PULSE_DURATION_MS,
          loop:           true,
          repeatReverse:  false,
          delay:          delayMs,
        }}
        style={[
          styles.pulseRing,
          { borderColor: glowHex, width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 },
        ]}
      />
      {/* Expanding ring 2 — same animation, half-cycle offset for a continuous beat */}
      <MotiView
        from={{ scale: 1,    opacity: 0.5 }}
        animate={{ scale: maxScale, opacity: 0 }}
        transition={{
          type:          'timing',
          duration:       PULSE_DURATION_MS,
          loop:           true,
          repeatReverse:  false,
          delay:          delayMs + PULSE_DURATION_MS / 2,
        }}
        style={[
          styles.pulseRing,
          { borderColor: glowHex, width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 },
        ]}
      />
      {/* Solid core */}
      <View
        style={[
          styles.pulseCore,
          { backgroundColor: baseHex, width: CORE_SIZE, height: CORE_SIZE, borderRadius: CORE_SIZE / 2 },
        ]}
      />
      {/* Nation label */}
      <Text style={styles.pulseLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap:   spacing.sm,
  },
  // The map container holds the SVG and absolutely-positioned pulses on top.
  // aspectRatio matches the SVG viewBox so percentage positions stay aligned.
  mapWrap: {
    width:       '100%',
    aspectRatio: VIEW_W / VIEW_H,
    position:    'relative',
    ...Platform.select({
      web:     { maxHeight: 380 } as any,
      default: {},
    }),
  },

  pulseAnchor: {
    position:       'absolute',
    width:          0,
    height:         0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position:    'absolute',
    borderWidth: 1.5,
    // Centre on the anchor — width/height are set inline per-instance.
    marginLeft:  -8,
    marginTop:   -8,
  },
  pulseCore: {
    position: 'absolute',
    // Centre the core dot exactly on the anchor.
    marginLeft: -7,
    marginTop:  -7,
    ...Platform.select({
      web: {
        boxShadow: '0 0 12px rgba(232,60,145,0.4)',
      } as any,
      default: {},
    }),
  },
  pulseLabel: {
    position:      'absolute',
    top:           12,
    left:          14,
    fontFamily:    font.bold,
    fontWeight:    '700',
    fontSize:      9,
    color:         neutral.textDim,
    letterSpacing: 1.2,
  },
});
