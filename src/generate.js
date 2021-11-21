import { generate as generateWithJS } from './javascript.js'
import { generate as generateWithWebGL } from './webgl.js'

/**
 * Generate an SDF texture image for a 2D path.
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
    return generateWithWebGL(sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent)
  } catch(e) {
    console.info('WebGL SDF generation failed, falling back to JS', e)
    return generateWithJS(sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent)
  }
}
