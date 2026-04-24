/**
 * Motion tokens. Springs default — easing only for glow pulses.
 * Keep these central so the whole app feels like the same instrument.
 */

export const spring = {
  // Card lift, flip, sort-change
  snappy: { damping: 18, stiffness: 220, mass: 0.9 },
  // Parallax tilt tracking
  tilt: { damping: 14, stiffness: 150, mass: 0.8 },
  // Subtle entrances
  gentle: { damping: 22, stiffness: 140, mass: 1 },
};

export const timing = {
  fast: 180,
  base: 280,
  slow: 520,
  glow: 2200,
};

export const tilt = {
  maxDeg: 8,       // max tilt in either axis
  perspective: 1000,
};
