precision highp float;
attribute vec2 aUV;
varying vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = vec4(mix(vec2(-1.0), vec2(1.0), aUV), 0.0, 1.0);
}
