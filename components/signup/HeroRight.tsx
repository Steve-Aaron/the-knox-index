import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { neutral, glass, accent, brand } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * HeroRight
 * ----------
 * Right column of the hero. Shows a phone-frame mockup of the Knox Index
 * app. Replace the placeholder content with a real screenshot once available.
 *
 * TO ADD A REAL SCREENSHOT:
 *   import { Image } from 'react-native';
 *   Replace <PhoneMockup /> with:
 *   <Image source={require('@/assets/images/app-screenshot.png')}
 *          style={styles.screenshotImage} resizeMode="contain" />
 */

function PhoneMockup() {
  return (
    <View style={styles.phone}>
      {/* Notch */}
      <View style={styles.notch} />

      {/* Screen content — placeholder Knox Index UI */}
      <View style={styles.screen}>
        {/* Status bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>THE KNOX INDEX</Text>
        </View>

        {/* Gradient accent bar */}
        <View style={styles.accentBar} />

        {/* Mock rank rows */}
        {['Keir Starmer', 'Kemi Badenoch', 'Ed Davey', 'Nigel Farage'].map((name, i) => (
          <View key={name} style={styles.rankRow}>
            <View style={styles.rankNum}>
              <Text style={styles.rankNumText}>{i + 1}</Text>
            </View>
            <View style={styles.rankAvatar} />
            <View style={styles.rankInfo}>
              <View style={[styles.rankBar, { width: `${88 - i * 15}%` }]} />
              <Text style={styles.rankName}>{name}</Text>
            </View>
          </View>
        ))}

        {/* Mock chart stub */}
        <View style={styles.chartStub}>
          <View style={styles.chartBars}>
            {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
              <View
                key={i}
                style={[
                  styles.chartBar,
                  { height: `${h}%`, opacity: 0.4 + i * 0.08 },
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Home indicator */}
      <View style={styles.homeIndicator} />
    </View>
  );
}

export function HeroRight() {
  return (
    <View style={styles.wrap}>
      <View style={styles.glow} />
      <PhoneMockup />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
    minHeight:      500,
  },

  // Background glow behind phone
  glow: {
    position:        'absolute',
    width:           '80%',
    height:          '60%',
    borderRadius:    999,
    backgroundColor: accent.indigo,
    opacity:         0.08,
    ...Platform.select({
      web: {
        filter: 'blur(60px)',
      } as any,
      default: {},
    }),
  },

  // Phone frame
  phone: {
    width:           '70%',      // percentage so it scales with column width
    maxWidth:        320,
    aspectRatio:     9 / 19.5,
    backgroundColor: '#111',
    borderRadius:    40,
    borderWidth:     3,
    borderColor:     neutral.strokeHi,
    overflow:        'hidden',
    alignItems:      'center',
    ...Platform.select({
      web: {
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
      } as any,
      default: {},
    }),
  },

  notch: {
    width:           80,
    height:          24,
    backgroundColor: '#111',
    borderRadius:    12,
    marginTop:       8,
    zIndex:          1,
  },

  screen: {
    flex:              1,
    width:             '100%',
    backgroundColor:   neutral.felt,
    paddingHorizontal: spacing.sm,
    paddingTop:        spacing.sm,
    gap:               spacing.sm,
  },

  statusBar: {
    alignItems: 'center',
    paddingVertical: 4,
  },

  statusText: {
    fontFamily:    font.bold,
    fontSize:      8,
    letterSpacing: 2,
    color:         neutral.textMid,
  },

  accentBar: {
    width:        '100%',
    height:       2,
    borderRadius: 1,
    // Knox brand gradient approximated as a flat colour for simplicity
    backgroundColor: accent.indigo,
    opacity:      0.6,
  },

  rankRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    paddingVertical: 4,
  },

  rankNum: {
    width:          16,
    alignItems:     'center',
  },

  rankNumText: {
    fontFamily: font.bold,
    fontSize:   9,
    color:      neutral.textMid,
  },

  rankAvatar: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: glass.fillHi,
  },

  rankInfo: {
    flex: 1,
    gap:  3,
  },

  rankBar: {
    height:          4,
    borderRadius:    2,
    backgroundColor: accent.indigo,
    opacity:         0.5,
  },

  rankName: {
    fontFamily: font.ui,
    fontSize:   8,
    color:      neutral.textMid,
  },

  chartStub: {
    flex:            1,
    borderRadius:    radius.sm,
    backgroundColor: glass.fill,
    borderWidth:     1,
    borderColor:     glass.border,
    padding:         spacing.sm,
    justifyContent:  'flex-end',
  },

  chartBars: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-around',
    height:         '100%',
  },

  chartBar: {
    width:           '10%',
    borderRadius:    2,
    backgroundColor: accent.indigo,
  },

  homeIndicator: {
    width:           80,
    height:          4,
    borderRadius:    2,
    backgroundColor: neutral.stroke,
    marginBottom:    spacing.sm,
  },
});
