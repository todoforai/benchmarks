// Ground truth for MILKCROWN, measured from a real high-speed milk-drop film.
// Source: "Milk Drop Crown in Ultra Slow Motion", Beyond 1000FPS
//   https://www.youtube.com/watch?v=Wb8Q7Hhdrb0
// Extraction: frames at 24fps, liquid = luminance > 110, the crown is the largest
// connected component (so airborne droplets are excluded from the wall).
// Scale comes from the drop itself, so everything below is dimensionless:
//   D_eq = 182.2px (oblate spheroid (w^2 h)^(1/3)), impact V = 8.99px/frame from a
//   quadratic fit to the free fall, contact at frame 65.5, still surface row 519.
//   tau = t V / D, H = crown height / D, r = crown base radius / D.
// Caveat: a stock production film, not a lab run. Absolute sigma/mu are unknown and
// the slow-motion rate is assumed uniform; the dimensionless shape survives both.
window.TRUTH = {
  tau: [0.00, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00, 5.25, 5.50, 5.75, 6.00, 6.25, 6.50, 6.75, 7.00],
  H:   [0.687, 0.377, 0.256, 0.228, 0.199, 0.170, 0.170, 0.258, 0.776, 1.315, 1.628, 1.682, 1.585, 1.611, 1.657, 1.783, 1.899, 1.978, 2.015, 2.005, 1.951, 1.367, 1.081, 0.809, 0.524, 0.478, 0.478, 0.478, 0.478],
  r:   [0.566, 0.794, 0.952, 1.102, 1.216, 1.315, 1.426, 1.507, 1.577, 1.657, 1.735, 1.778, 1.798, 1.810, 1.817, 1.827, 1.872, 1.956, 2.049, 2.137, 2.213, 2.363, 2.578, 2.684, 2.678, 2.687, 2.687, 2.687, 2.687],
  peakH: 2.015, peakTau: 4.50,
  // visible front-rim jets counted at the wall crest, x pi/2 for the full azimuth
  fingers: 36,
};
