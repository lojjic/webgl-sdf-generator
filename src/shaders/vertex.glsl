precision highp float;
uniform vec4 uGlyphBounds;
attribute vec2 aUV;
attribute vec4 aLineSegment;
varying vec4 vLineSegment;
varying vec2 vGlyphXY;

void main() {
  vLineSegment = aLineSegment;
  vGlyphXY = mix(uGlyphBounds.xy, uGlyphBounds.zw, aUV);
  gl_Position = vec4(mix(vec2(-1.0), vec2(1.0), aUV), 0.0, 1.0);
}
