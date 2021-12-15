import viewportQuadVertex from './shaders/viewportQuad.vertex.glsl'
import copyTexFragment from './shaders/copyTexture.fragment.glsl'

const cache = new WeakMap()

const glContextParams = {
  premultipliedAlpha: false,
  preserveDrawingBuffer: true,
  antialias: false,
  depth: false,
}

/**
 * This is a little helper library for WebGL. It assists with state management for a GL context.
 * It's pretty tightly wrapped to the needs of this package, not very general-purpose.
 *
 * @param { WebGLRenderingContext | HTMLCanvasElement | OffscreenCanvas } glOrCanvas - the GL context to wrap
 * @param { ({gl, getExtension, withProgram, withTexture, withTextureFramebuffer, handleContextLoss}) => void } callback
 */
export function withWebGLContext (glOrCanvas, callback) {
  const gl = glOrCanvas.getContext ? glOrCanvas.getContext('webgl', glContextParams) : glOrCanvas
  let wrapper = cache.get(gl)
  if (!wrapper) {
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
    let extensions = {}
    let programs = {}
    let textures = {}
    let textureUnit = -1
    const framebufferStack = []

    gl.canvas.addEventListener('webglcontextlost', e => {
      handleContextLoss()
      e.preventDefault()
    }, false)

    function getExtension (name) {
      let ext = extensions[name]
      if (!ext) {
        ext = extensions[name] = gl.getExtension(name)
        if (!ext) {
          throw new Error(`${name} not supported`)
        }
      }
      return ext
    }

    function compileShader (src, type) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, src)
      gl.compileShader(shader)
      // const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
      // if (!status && !gl.isContextLost()) {
      //   throw new Error(gl.getShaderInfoLog(shader).trim())
      // }
      return shader
    }

    function withProgram (name, vert, frag, func) {
      if (!programs[name]) {
        const attributes = {}
        const uniforms = {}
        const program = gl.createProgram()
        gl.attachShader(program, compileShader(vert, gl.VERTEX_SHADER))
        gl.attachShader(program, compileShader(frag, gl.FRAGMENT_SHADER))
        gl.linkProgram(program)

        programs[name] = {
          program,
          transaction (func) {
            gl.useProgram(program)
            func({
              setUniform (type, name, ...values) {
                const uniformLoc = uniforms[name] || (uniforms[name] = gl.getUniformLocation(program, name))
                gl[`uniform${type}`](uniformLoc, ...values)
              },

              setAttribute (name, size, usage, instancingDivisor, data) {
                let attr = attributes[name]
                if (!attr) {
                  attr = attributes[name] = {
                    buf: gl.createBuffer(), // TODO should we destroy our buffers?
                    loc: gl.getAttribLocation(program, name),
                    data: null
                  }
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, attr.buf)
                gl.vertexAttribPointer(attr.loc, size, gl.FLOAT, false, 0, 0)
                gl.enableVertexAttribArray(attr.loc)
                if (isWebGL2) {
                  gl.vertexAttribDivisor(attr.loc, instancingDivisor)
                } else {
                  getExtension('ANGLE_instanced_arrays').vertexAttribDivisorANGLE(attr.loc, instancingDivisor)
                }
                if (data !== attr.data) {
                  gl.bufferData(gl.ARRAY_BUFFER, data, usage)
                  attr.data = data
                }
              }
            })
          }
        }
      }

      programs[name].transaction(func)
    }

    function withTexture (name, func) {
      textureUnit++
      try {
        gl.activeTexture(gl.TEXTURE0 + textureUnit)
        let texture = textures[name]
        if (!texture) {
          texture = textures[name] = gl.createTexture()
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        }
        gl.bindTexture(gl.TEXTURE_2D, texture)
        func(texture, textureUnit)
      } finally {
        textureUnit--
      }
    }

    function withTextureFramebuffer (texture, textureUnit, func) {
      const framebuffer = gl.createFramebuffer()
      framebufferStack.push(framebuffer)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.activeTexture(gl.TEXTURE0 + textureUnit)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      try {
        func(framebuffer)
      } finally {
        gl.deleteFramebuffer(framebuffer)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferStack[--framebufferStack.length - 1] || null)
      }
    }

    function handleContextLoss () {
      extensions = {}
      programs = {}
      textures = {}
      textureUnit = -1
      framebufferStack.length = 0
    }

    cache.set(gl, wrapper = {
      gl,
      isWebGL2,
      getExtension,
      withProgram,
      withTexture,
      withTextureFramebuffer,
      handleContextLoss,
    })
  }
  callback(wrapper)
}


export function renderImageData(glOrCanvas, imageData, x, y, width, height, channels = 0b1111, framebuffer = null) {
  withWebGLContext(glOrCanvas, ({gl, withProgram, withTexture}) => {
    withTexture('copy', (tex, texUnit) => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData)
      withProgram('copy', viewportQuadVertex, copyTexFragment, ({setUniform, setAttribute}) => {
        setAttribute('aUV', 2, gl.STATIC_DRAW, 0, new Float32Array([0, 0, 2, 0, 0, 2]))
        setUniform('1i', 'image', texUnit)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer || null)
        gl.disable(gl.BLEND)
        gl.colorMask(channels & 8, channels & 4, channels & 2, channels & 1)
        gl.viewport(x, y, width, height)
        gl.scissor(x, y, width, height)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      })
    })
  })
}

/**
 * Resizing a canvas clears its contents; this utility copies the previous contents over.
 * @param canvas
 * @param newWidth
 * @param newHeight
 */
export function resizeWebGLCanvasWithoutClearing(canvas, newWidth, newHeight) {
  const {width, height} = canvas
  withWebGLContext(canvas, ({gl}) => {
    const data = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data)
    canvas.width = newWidth
    canvas.height = newHeight
    renderImageData(gl, data, 0, 0, width, height)
  })
}

