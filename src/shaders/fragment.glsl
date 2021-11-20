precision highp float;
uniform vec4 uGlyphBounds;
uniform float uMaxDistance;
uniform float uExponent;
varying vec4 vLineSegment;
varying vec2 vGlyphXY;
varying vec2 vUV;

float absDistToSegment(vec2 point, vec2 lineA, vec2 lineB) {
  vec2 lineDir = lineB - lineA;
  float lenSq = dot(lineDir, lineDir);
  float t = lenSq == 0.0 ? 0.0 : clamp(dot(point - lineA, lineDir) / lenSq, 0.0, 1.0);
  vec2 linePt = lineA + t * lineDir;
  return distance(point, linePt);
}

bool isCrossing(vec2 point, vec2 lineA, vec2 lineB) {
  return (lineA.y > point.y != lineB.y > point.y) &&
  (point.x < (lineB.x - lineA.x) * (point.y - lineA.y) / (lineB.y - lineA.y) + lineA.x);
}

void main() {
  float dist = absDistToSegment(vGlyphXY, vLineSegment.xy, vLineSegment.zw);
  float val = pow(1.0 - clamp(dist / uMaxDistance, 0.0, 1.0), uExponent) * 0.5;
  bool crossing = isCrossing(vGlyphXY, vLineSegment.xy, vLineSegment.zw);
  gl_FragColor = vec4(val, 0.0, 0.0, crossing ? 1.0 / 256.0 : 0.0);
}
