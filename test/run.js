require('./polyfill/OffscreenCanvas.js')
const createSDFGenerator = require('../dist/webgl-sdf-generator.js')
const assert = require('assert')

const { javascript, webgl, generate, generateIntoCanvas } = createSDFGenerator()

const captures = [
  {
    expected: [128, 105, 82, 60, 143, 128, 105, 82, 143, 150, 128, 105, 143, 143, 143, 128],
    path: 'M0,0 L64,64 L0,64 Z',
    size: 4,
    viewBox: [0, 0, 64, 64],
    spread: 64,
    exponent: 1
  },
  {
    expected: [51, 80, 89, 80, 51, 80, 123, 140, 123, 80, 89, 140, 191, 140, 89, 80, 123, 140, 123, 80, 51, 80, 89, 80, 51],
    path: 'M2,0 Q4,0,4,2 Q4,4,2,4 Q0,4,0,2 Q0,0,2,0',
    size: 5,
    viewBox: [-2, -2, 6, 6],
    spread: 4,
    exponent: 1
  },
]

const canvasTestParams = [
  {
    canvasCols: 1,
    square: 0,
    channel: 0
  },
  {
    canvasCols: 1,
    square: 0,
    channel: 2
  },
  {
    canvasCols: 3,
    square: 4,
    channel: 0,
  },
  {
    canvasCols: 3,
    square: 5,
    channel: 3,
  }
]

captures.forEach((capture) => {
  // Turn 'expected' single-channel data into rgba arrays for various canvas tests
  capture.expectedForCanvas = canvasTestParams.map(({canvasCols, square, channel}) => {
    const canvasSize = canvasCols * capture.size
    const expected = new Uint8Array(Math.pow(canvasCols * capture.size, 2) * 4)
    const x = (square % canvasCols) * capture.size
    const y = Math.floor(square / canvasCols) * capture.size
    const baseStartIndex = y * canvasSize * 4 //full rows
      + x * 4 //partial row
      + channel
    for (let y = 0; y < capture.size; y++) {
      const srcStartIndex = y * capture.size
      const rowStartIndex = baseStartIndex + (y * canvasSize * 4)
      for (let x = 0; x < capture.size; x++) {
        expected[rowStartIndex + x * 4] = capture.expected[srcStartIndex + x]
      }
    }
    return { canvasSize, x, y, channel, expected }
  })
})

function testGenerateMethod(generatorFunc) {
  for (const {expected, path, size, exponent, spread, viewBox} of captures) {
    const result = generatorFunc(size, size, path, viewBox, spread, exponent)
    assert.deepEqual([...result], expected)
  }
}

function testGenerateIntoCanvasMethod (generatorFunc) {
  for (const {expectedForCanvas, path, size, exponent, spread, viewBox} of captures) {
    for (const {canvasSize, x, y, channel, expected} of expectedForCanvas) {
      const canvas = new OffscreenCanvas(canvasSize, canvasSize)
      generatorFunc(size, size, path, viewBox, spread, exponent, canvas, x, y, channel)
      const result = new Uint8Array(canvasSize * canvasSize * 4)
      const gl = canvas.getContext('webgl')
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.readPixels(0, 0, canvasSize, canvasSize, gl.RGBA, gl.UNSIGNED_BYTE, result)
      assert.deepEqual(result, expected)
    }
  }
}

const tests = [
  function webgl_isSupported () {
    assert(webgl.isSupported())
  },
  function webgl_generate () {
    testGenerateMethod(webgl.generate)
  },
  function webgl_generateIntoCanvas () {
    testGenerateIntoCanvasMethod(webgl.generateIntoCanvas)
  },
  function javascript_generate () {
    testGenerateMethod(javascript.generate)
  },
  function javascript_generateIntoCanvas () {
    testGenerateIntoCanvasMethod(javascript.generateIntoCanvas)
  },
  function combined_generate () {
    testGenerateMethod(generate)
  },
  function combined_generateIntoCanvas () {
    testGenerateIntoCanvasMethod(generateIntoCanvas)
  },
]

const testResults = tests.map(test => {
  try {
    return test() || 0
  } catch (e) {
    console.error(`Test ${test.name} failed`, e)
    return 1
  }
})

const overallCode = Math.max(...testResults)
if (overallCode === 0) {
  console.log('All tests passed.')
}

process.exit(overallCode)
