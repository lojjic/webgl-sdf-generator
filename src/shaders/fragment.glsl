precision highp float;
uniform vec4 uGlyphBounds;
uniform float uMaxDistance;
uniform float uExponent;
varying float vCommand;
varying vec4 vEndPoints;
varying vec4 vCtrlPoints;
varying vec2 vGlyphXY;

float absDistToSegment(vec2 point, vec4 seg) {
  vec2 lineDir = seg.zw - seg.xy;
  float lenSq = dot(lineDir, lineDir);
  float t = lenSq == 0.0 ? 0.0 : clamp(dot(point - seg.xy, lineDir) / lenSq, 0.0, 1.0);
  vec2 linePt = seg.xy + t * lineDir;
  return distance(point, linePt);
}

bool isCrossing(vec2 point, vec4 seg) {
  return (seg.y > point.y != seg.w > point.y) &&
  (point.x < (seg.z - seg.x) * (point.y - seg.y) / (seg.w - seg.y) + seg.x);
}

vec2 pointOnQuadraticBezier (vec4 ends, vec2 ctrl, float t) {
  float t2 = 1.0 - t;
  return vec2(
    t2 * t2 * ends.x + 2.0 * t2 * t * ctrl.x + t * t * ends.z,
    t2 * t2 * ends.y + 2.0 * t2 * t * ctrl.y + t * t * ends.w
  );
}

vec2 pointOnCubicBezier (vec4 ends, vec4 ctrl, float t) {
  float t2 = 1.0 - t;
  return vec2(
    t2 * t2 * t2 * ends.x + 3.0 * t2 * t2 * t * ctrl.x + 3.0 * t2 * t * t * ctrl.z + t * t * t * ends.z,
    t2 * t2 * t2 * ends.y + 3.0 * t2 * t2 * t * ctrl.y + 3.0 * t2 * t * t * ctrl.w + t * t * t * ends.w
  );
}

void evalLineSegment(vec4 seg) {
  float dist = absDistToSegment(vGlyphXY, seg);
  float val = pow(1.0 - clamp(dist / uMaxDistance, 0.0, 1.0), uExponent) * 0.5;
  gl_FragColor.r = max(gl_FragColor.r, val);
  gl_FragColor.a += isCrossing(vGlyphXY, seg) ? 1.0 / 256.0 : 0.0;
}

void main() {
  float distVal = 0.0;
  float crossingVal = 0.0;
  if (vCommand == 0.0) { // L
    evalLineSegment(vEndPoints);
  }
  else if (vCommand == 1.0) { // Q
    vec2 prevPt;
    for (int i = 0; i <= 16; i++) {
      vec2 nextPt = pointOnQuadraticBezier(vEndPoints, vec2(vCtrlPoints), float(i) / 16.0);
      if (i > 0) {
        evalLineSegment(vec4(prevPt, nextPt));
      }
      prevPt = nextPt;
    }
  }
  else if (vCommand == 2.0) { // C
    vec2 prevPt;
    for (int i = 0; i <= 16; i++) {
      vec2 nextPt = pointOnCubicBezier(vEndPoints, vCtrlPoints, float(i) / 16.0);
      if (i > 0) {
        evalLineSegment(vec4(prevPt, nextPt));
      }
      prevPt = nextPt;
    }
  }
}
