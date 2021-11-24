import { pathToLineSegments } from './path.js'
import vertexShader from './shaders/main.vertex.glsl'
import fragmentShader from './shaders/main.fragment.glsl'

// Single triangle covering viewport
const viewportUVs = new Float32Array([0, 0, 2, 0, 0, 2])

const programSources = {
  main: [vertexShader, fragmentShader]
}

let canvas
let gl
let instancingExtension
let blendMinMaxExtension
let programs = {}
let lastWidth
let lastHeight
let supported = null
let isTestingSupport = false

function handleContextLoss () {
  instancingExtension = blendMinMaxExtension = lastWidth = lastHeight = undefined
  programs = {}
}

function compileShader (gl, src, type) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (!status && !gl.isContextLost()) {
    throw new Error(gl.getShaderInfoLog(shader).trim())
  }
  return shader
}

function Program(gl, vert, frag) {
  const attributes = {}
  const uniforms = {}
  const program = gl.createProgram()
  gl.attachShader(program, compileShader(gl, vert, gl.VERTEX_SHADER))
  gl.attachShader(program, compileShader(gl, frag, gl.FRAGMENT_SHADER))
  gl.linkProgram(program)

  return {
    use() {
      gl.useProgram(program)
    },

    setUniform(type, name, ...values) {
      if (!uniforms[name]) {
        uniforms[name] = gl.getUniformLocation(program, name)
      }
      gl[`uniform${type}`](uniforms[name], ...values)
    },

    setAttribute(name, size, usage, instancingDivisor, data) {
      let attr = attributes[name]
      if (!attr) {
        attr = attributes[name] = {
          buf: gl.createBuffer(),
          loc: gl.getAttribLocation(program, name)
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, attr.buf)
      gl.vertexAttribPointer(attr.loc, size, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(attr.loc)
      instancingExtension.vertexAttribDivisorANGLE(attr.loc, instancingDivisor)
      gl.bufferData(gl.ARRAY_BUFFER, data, usage)
    }
  }
}

function useProgram(name) {
  let program = programs[name]
  if (!program) {
    program = programs[name] = new Program(gl, programSources[name][0], programSources[name][1])
  }
  program.use()
  return program
}

export function generate (sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent = 1) {
  // Verify support
  if (!isTestingSupport && !isSupported()) {
    throw new Error('WebGL generation not supported')
  }

  // Compute path segments
  let lineSegmentCoords = []
  pathToLineSegments(path, (x1, y1, x2, y2) => {
    lineSegmentCoords.push(x1, y1, x2, y2)
  })
  lineSegmentCoords = new Float32Array(lineSegmentCoords)

  // Init canvas
  if (!canvas) {
    canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(1, 1)
      : typeof document !== 'undefined'
        ? document.createElement('canvas')
        : null
    if (!canvas) {
      throw new Error('OffscreenCanvas or DOM canvas not supported')
    }
    canvas.addEventListener('webglcontextlost', e => {
      handleContextLoss()
      e.preventDefault()
    }, false)
  }

  // Init WebGL context
  if (!gl) {
    gl = canvas.getContext('webgl', {
      antialias: false,
      depth: false
    })
  }

  // Init extensions
  instancingExtension = instancingExtension || gl.getExtension('ANGLE_instanced_arrays')
  if (!instancingExtension) {
    throw new Error('ANGLE_instanced_arrays not supported')
  }
  blendMinMaxExtension = blendMinMaxExtension || gl.getExtension('EXT_blend_minmax')
  if (!blendMinMaxExtension) {
    throw new Error('EXT_blend_minmax not supported')
  }

  // Update dimensions
  if (sdfWidth !== lastWidth || sdfHeight !== lastHeight) {
    lastWidth = canvas.width = sdfWidth
    lastHeight = canvas.height = sdfHeight
    gl.viewport(0, 0, sdfWidth, sdfHeight)
  }

  // Init shader program
  let program = useProgram('main')

  // Init/update attributes
  program.setAttribute('aUV', 2, gl.STATIC_DRAW, 0, viewportUVs)
  program.setAttribute('aLineSegment', 4, gl.DYNAMIC_DRAW, 1, lineSegmentCoords)

  // Init/update uniforms
  program.setUniform('4f', 'uGlyphBounds', ...viewBox)
  program.setUniform('1f', 'uMaxDistance', maxDistance)
  program.setUniform('1f', 'uExponent', sdfExponent)

  // Draw
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE)
  gl.blendEquationSeparate(blendMinMaxExtension.MAX_EXT, gl.FUNC_ADD) //r = closest distance, a = +1 for every ray cross
  instancingExtension.drawArraysInstancedANGLE(
    gl.TRIANGLES,
    0,
    3,
    lineSegmentCoords.length / 4
  )

  // Read results
  const rgbaData = new Uint8Array(sdfWidth * sdfHeight * 4) //not Uint8ClampedArray, cuz Safari
  gl.readPixels(0, 0, sdfWidth, sdfHeight, gl.RGBA, gl.UNSIGNED_BYTE, rgbaData)

  // Handle context loss occurring during any of the above calls
  if (gl.isContextLost()) {
    handleContextLoss()
    throw new Error('webgl context lost')
  }

  // Use even/odd value in alpha channel, representing glyph interior/exterior,
  // to flip the red channel's value across the sdf midpoint
  const data = new Uint8Array(sdfWidth * sdfHeight)
  for (let i = 0, j = 0; i < rgbaData.length; i += 4) {
    data[j++] = rgbaData[i + 3] % 2 ? 255 - rgbaData[i] : rgbaData[i]
  }

  return data
}

export function isSupported () {
  if (supported === null) {
    isTestingSupport = true
    let failReason = null
    try {
      // Since we can't detect all failure modes up front, let's just do a trial run of a
      // simple path and compare what we get back to the correct expected result.
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
        1
      )
      supported = testResult && expectedResult.length === testResult.length &&
        testResult.every((val, i) => val === expectedResult[i])
      if (!supported) {
        failReason = 'bad trial run results'
      }
    } catch (err) {
      // TODO if it threw due to webgl context loss, should we maybe leave isSupported as null and try again later?
      supported = false
      failReason = err
    }
    if (failReason) {
      console.info('WebGL SDF generation not supported:', failReason)
    }
    isTestingSupport = false
  }
  return supported
}
