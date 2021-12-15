import * as javascript from './javascript.js'
import * as webgl  from './webgl.js'

/**
 * Generate an SDF texture image for a 2D path.
 *
 * @param {number} sdfWidth - width of the SDF output image in pixels.
 * @param {number} sdfHeight - height of the SDF output image in pixels.
 * @param {string} path - an SVG-like path string describing the glyph; should only contain commands: M/L/Q/C/Z.
 * @param {number[]} viewBox - [minX, minY, maxX, maxY] in font units aligning with the texture's edges.
 * @param {number} maxDistance - the maximum distance from the glyph path in font units that will be encoded; defaults
 *        to half the maximum viewBox dimension.
 * @param {number} [sdfExponent] - specifies an exponent for encoding the SDF's distance values; higher exponents
 *        will give greater precision nearer the glyph's path.
 * @return {Uint8Array}
 */
export function generate(
  sdfWidth,
  sdfHeight,
  path,
  viewBox,
  maxDistance = Math.max(viewBox[2] - viewBox[0], viewBox[3] - viewBox[1]) / 2,
  sdfExponent = 1
) {
  try {
    return webgl.generate(...arguments)
  } catch(e) {
    console.info('WebGL SDF generation failed, falling back to JS', e)
    return javascript.generate(...arguments)
  }
}

/**
 * Generate an SDF texture image for a 2D path, inserting the result into a WebGL `canvas` at a given x/y position
 * and color channel. This is generally much faster than calling `generate` because it does not require reading pixels
 * back from the GPU->CPU -- the `canvas` can be used directly as a WebGL texture image, so it all stays on the GPU.
 *
 * @param {number} sdfWidth - width of the SDF output image in pixels.
 * @param {number} sdfHeight - height of the SDF output image in pixels.
 * @param {string} path - an SVG-like path string describing the glyph; should only contain commands: M/L/Q/C/Z.
 * @param {number[]} viewBox - [minX, minY, maxX, maxY] in font units aligning with the texture's edges.
 * @param {number} maxDistance - the maximum distance from the glyph path in font units that will be encoded; defaults
 *        to half the maximum viewBox dimension.
 * @param {number} [sdfExponent] - specifies an exponent for encoding the SDF's distance values; higher exponents
 *        will give greater precision nearer the glyph's path.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas - a WebGL-enabled canvas into which the SDF will be rendered.
 *        Only the relevant rect/channel will be modified, the rest will be preserved. To avoid unpredictable results
 *        due to shared GL context state, this canvas should be dedicated to use by this library alone.
 * @param {number} x - the x position at which to render the SDF.
 * @param {number} y - the y position at which to render the SDF.
 * @param {number} channel - the color channel index (0-4) into which the SDF will be rendered.
 * @return {Uint8Array}
 */
export function generateIntoCanvas(
  sdfWidth,
  sdfHeight,
  path,
  viewBox,
  maxDistance = Math.max(viewBox[2] - viewBox[0], viewBox[3] - viewBox[1]) / 2,
  sdfExponent = 1,
  canvas,
  x = 0,
  y = 0,
  channel = 0
) {
  try {
    return webgl.generateIntoCanvas(...arguments)
  } catch(e) {
    console.info('WebGL SDF generation failed, falling back to JS', e)
    return javascript.generateIntoCanvas(...arguments)
  }
}
