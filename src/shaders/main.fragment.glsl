precision highp float;
uniform vec4 uGlyphBounds;
uniform float uMaxDistance;
uniform float uExponent;
varying vec4 vLineSegment;
varying vec2 vGlyphXY;

float absDistToSegment(vec2 point, vec2 lineA, vec2 lineB) {
  vec2 lineDir = lineB - lineA;
  float lenSq = dot(lineDir, lineDir);
  float t = lenSq == 0.0 ? 0.0 : clamp(dot(point - lineA, lineDir) / lenSq, 0.0, 1.0);
  vec2 linePt = lineA + t * lineDir;
  return distance(point, linePt);
}

void main() {
  vec4 seg = vLineSegment;
  vec2 p = vGlyphXY;
  // Find unsigned distance to the segment; only the nearest will be kept
  float dist = absDistToSegment(p, seg.xy, seg.zw);
  // Apply the exponential transform
  float val = pow(1.0 - clamp(dist / uMaxDistance, 0.0, 1.0), uExponent) * 0.5;
  // Project a ray eastward and if it crosses the segment, increment either the red or green channel
  // depending on the direction of crossing. After all segments are processed this will be used as a
  // "winding number" to tell us whether we're inside or outside the glyph.
  bool crossing = (seg.y > p.y != seg.w > p.y) && (p.x < (seg.z - seg.x) * (p.y - seg.y) / (seg.w - seg.y) + seg.x);
  bool crossingUp = crossing && vLineSegment.y < vLineSegment.w;
  gl_FragColor = vec4(crossingUp ? 1.0 / 255.0 : 0.0, crossing && !crossingUp ? 1.0 / 255.0 : 0.0, 0.0, val);
}
