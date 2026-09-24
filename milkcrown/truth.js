// Ground truth for MILKCROWN, measured from a real high-speed milk-drop film.
// Source: "Milk Drop Crown in Ultra Slow Motion", Beyond 1000FPS
//   https://www.youtube.com/watch?v=Wb8Q7Hhdrb0
// Extraction: frames at 24fps, liquid = luminance > 110, the splash is the largest
// connected component, so airborne droplets do not count as wall.
// H is the CROWN WALL: the central column is masked out (|x - axis| < 0.4 D), because
// after the wall collapses a Worthington jet shoots up the axis and is twice as tall
// as the crown ever was. Scoring the raw silhouette rewards the jet, not the crown.
// Scale comes from the drop itself, so everything here is dimensionless:
//   D_eq = 182.2px as (w^2 h)^(1/3), impact V = 8.99px/frame from a quadratic fit
//   to the free fall, contact at frame 65.5, still surface at row 519.
//   tau = t V / D, H = wall height / D, r = crown base radius / D.
// Caveat: a stock production film, not a lab run. Absolute sigma/mu are unknown and
// the slow-motion rate is assumed uniform; the dimensionless shape survives both.
window.TRUTH = {
  tau: [0.00, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00, 5.25, 5.50, 5.75, 6.00, 6.25, 6.50, 6.75, 7.00],
  H:   [0.506, 0.220, 0.256, 0.228, 0.193, 0.170, 0.154, 0.225, 0.749, 1.294, 1.628, 1.682, 1.585, 1.611, 1.556, 1.114, 0.977, 0.812, 0.599, 0.361, 0.417, 0.362, 0.477, 0.384, 0.383, 0.340, 0.340, 0.340, 0.340],
  r:   [0.566, 0.793, 0.952, 1.102, 1.216, 1.315, 1.426, 1.507, 1.577, 1.657, 1.735, 1.778, 1.798, 1.810, 1.817, 1.827, 1.872, 1.956, 2.049, 2.137, 2.213, 2.364, 2.578, 2.684, 2.678, 2.687, 2.687, 2.687, 2.687],
  peakH: 1.682, peakTau: 2.75,
  // visible front-rim jets counted at the wall crest, x pi/2 for the full azimuth
  fingers: 36,
};
