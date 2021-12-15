import { pathToLineSegments } from './path.js'
import { withWebGLContext } from './webglUtils.js'
import mainVertex from './shaders/main.vertex.glsl'
import mainFragment from './shaders/main.fragment.glsl'
import viewportQuadVertex from './shaders/viewportQuad.vertex.glsl'
import postFragment from './shaders/post.fragment.glsl'

// Single triangle covering viewport
const viewportUVs = new Float32Array([0, 0, 2, 0, 0, 2])

let implicitContext = null
let supported = null
let isTestingSupport = false

function validateSupport (glOrCanvas) {
  if (!isTestingSupport && !isSupported(glOrCanvas)) {
    throw new Error('WebGL generation not supported')
  }
}

export function generate (sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent = 1, glOrCanvas = null) {
  if (!glOrCanvas) {
    glOrCanvas = implicitContext
    if (!glOrCanvas) {
      const canvas = typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(1, 1)
        : typeof document !== 'undefined'
          ? document.createElement('canvas')
          : null
      if (!canvas) {
        throw new Error('OffscreenCanvas or DOM canvas not supported')
      }
      glOrCanvas = implicitContext = canvas.getContext('webgl', { depth: false })
    }
  }

  validateSupport(glOrCanvas)

  const rgbaData = new Uint8Array(sdfWidth * sdfHeight * 4) //not Uint8ClampedArray, cuz Safari

  // Render into a background texture framebuffer
  withWebGLContext(glOrCanvas, ({gl, withTexture, withTextureFramebuffer}) => {
    withTexture('readable', (texture, textureUnit) => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sdfWidth, sdfHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

      withTextureFramebuffer(texture, textureUnit, framebuffer => {
        generateIntoFramebuffer(
          sdfWidth,
          sdfHeight,
          path,
          viewBox,
          maxDistance,
          sdfExponent,
          gl,
          framebuffer,
          0,
          0,
          0 // red channel
        )
        gl.readPixels(0, 0, sdfWidth, sdfHeight, gl.RGBA, gl.UNSIGNED_BYTE, rgbaData)
      })
    })
  })

  // Throw away all but the red channel
  const data = new Uint8Array(sdfWidth * sdfHeight)
  for (let i = 0, j = 0; i < rgbaData.length; i += 4) {
    data[j++] = rgbaData[i]
  }

  return data
}

export function generateIntoCanvas(sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent = 1, canvas, x = 0, y = 0, channel = 0) {
  generateIntoFramebuffer(sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent, canvas, null, x, y, channel)
}

export function generateIntoFramebuffer (sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent = 1, glOrCanvas, framebuffer, x = 0, y = 0, channel = 0) {
  // Verify support
  validateSupport(glOrCanvas)

  // Compute path segments
  let lineSegmentCoords = []
  pathToLineSegments(path, (x1, y1, x2, y2) => {
    lineSegmentCoords.push(x1, y1, x2, y2)
  })
  lineSegmentCoords = new Float32Array(lineSegmentCoords)

  withWebGLContext(glOrCanvas, ({gl, isWebGL2, getExtension, withProgram, withTexture, withTextureFramebuffer, handleContextLoss}) => {
    withTexture('rawDistances', (intermediateTexture, intermediateTextureUnit) => {
      if (sdfWidth !== intermediateTexture._lastWidth || sdfHeight !== intermediateTexture._lastHeight) {
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA,
          intermediateTexture._lastWidth = sdfWidth,
          intermediateTexture._lastHeight = sdfHeight,
          0, gl.RGBA, gl.UNSIGNED_BYTE, null
        )
      }

      // Unsigned distance pass
      withProgram('main', mainVertex, mainFragment, ({setAttribute, setUniform}) => {
        // Init extensions
        const instancingExtension = !isWebGL2 && getExtension('ANGLE_instanced_arrays')
        const blendMinMaxExtension = !isWebGL2 && getExtension('EXT_blend_minmax')

        // Init/update attributes
        setAttribute('aUV', 2, gl.STATIC_DRAW, 0, viewportUVs)
        setAttribute('aLineSegment', 4, gl.DYNAMIC_DRAW, 1, lineSegmentCoords)

        // Init/update uniforms
        setUniform('4f', 'uGlyphBounds', ...viewBox)
        setUniform('1f', 'uMaxDistance', maxDistance)
        setUniform('1f', 'uExponent', sdfExponent)

        // Render initial unsigned distance / winding number info to a texture
        withTextureFramebuffer(intermediateTexture, intermediateTextureUnit, framebuffer => {
          gl.enable(gl.BLEND)
          gl.colorMask(true, true, true, true)
          gl.viewport(0, 0, sdfWidth, sdfHeight)
          gl.scissor(0, 0, sdfWidth, sdfHeight)
          gl.blendFunc(gl.ONE, gl.ONE)
          // Red+Green channels are incremented (FUNC_ADD) for segment-ray crossings to give a "winding number".
          // Alpha holds the closest (MAX) unsigned distance.
          gl.blendEquationSeparate(gl.FUNC_ADD, isWebGL2 ? gl.MAX : blendMinMaxExtension.MAX_EXT)
          gl.clear(gl.COLOR_BUFFER_BIT)
          if (isWebGL2) {
            gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, lineSegmentCoords.length / 4)
          } else {
            instancingExtension.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 3, lineSegmentCoords.length / 4)
          }
          // Debug
          // const debug = new Uint8Array(sdfWidth * sdfHeight * 4)
          // gl.readPixels(0, 0, sdfWidth, sdfHeight, gl.RGBA, gl.UNSIGNED_BYTE, debug)
          // console.log('intermediate texture data: ', debug)
        })
      })

      // Use the data stored in the texture to apply inside/outside and write to the output framebuffer rect+channel.
      withProgram('post', viewportQuadVertex, postFragment, program => {
        program.setAttribute('aUV', 2, gl.STATIC_DRAW, 0, viewportUVs)
        program.setUniform('1i', 'tex', intermediateTextureUnit)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
        gl.disable(gl.BLEND)
        gl.colorMask(channel === 0, channel === 1, channel === 2, channel === 3)
        gl.viewport(x, y, sdfWidth, sdfHeight)
        gl.scissor(x, y, sdfWidth, sdfHeight)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      })
    })

    // Handle context loss occurring during any of the above calls
    if (gl.isContextLost()) {
      handleContextLoss()
      throw new Error('webgl context lost')
    }
  })
}

export function isSupported (glOrCanvas) {
  if (supported === null) {
    isTestingSupport = true
    let failReason = null
    try {
      // Since we can't detect all failure modes up front, let's just do a trial run of a
      // simple path and compare what we get back to the correct expected result. This will
      // also serve to prime the shader compilation.
      const expectedResult = [
        97, 106, 97, 61,
        99, 137, 118, 80,
        80, 118, 137, 99,
        61, 97, 106, 97
      ]
      const testResult = generate(
        4,
        4,
        'M8,8L16,8L24,24L16,24Z',
        [0, 0, 32, 32],
        24,
        1,
        glOrCanvas
      )
      supported = testResult && expectedResult.length === testResult.length &&
        testResult.every((val, i) => val === expectedResult[i])
      if (!supported) {
        failReason = 'bad trial run results'
        console.info(expectedResult, testResult)
      }
    } catch (err) {
      // TODO if it threw due to webgl context loss, should we maybe leave isSupported as null and try again later?
      supported = false
      failReason = err.message
    }
    if (failReason) {
      console.warn('WebGL SDF generation not supported:', failReason)
    }
    isTestingSupport = false
  }
  return supported
}

