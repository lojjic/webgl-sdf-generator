precision highp float;
uniform sampler2D tex;
varying vec2 vUV;

// Very simple shader that just copies a texture to output
void main() {
  gl_FragColor = texture2D(tex, vUV);
}
