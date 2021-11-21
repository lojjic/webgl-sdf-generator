precision highp float;
uniform vec4 uGlyphBounds;
attribute vec2 aUV;
attribute float aCommand;
attribute vec4 aEndPoints;
attribute vec4 aCtrlPoints;
varying float vCommand;
varying vec4 vEndPoints;
varying vec4 vCtrlPoints;
varying vec2 vGlyphXY;

void main() {
  vCommand = aCommand;
  vEndPoints = aEndPoints;
  vCtrlPoints = aCtrlPoints;
  vGlyphXY = mix(uGlyphBounds.xy, uGlyphBounds.zw, aUV);
  gl_Position = vec4(mix(vec2(-1.0), vec2(1.0), aUV), 0.0, 1.0);
}
