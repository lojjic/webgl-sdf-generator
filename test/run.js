require('./polyfill/OffscreenCanvas.js')
const createSDFGenerator = require('../dist/webgl-sdf-generator.js')
const assert = require('assert')

const { generateSDFWithJS, generateSDFWithWebGL, supportsWebGLGeneration } = createSDFGenerator()

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

const tests = [
  function webglSupport () {
    assert(supportsWebGLGeneration())
  },
  function webglGeneration () {
    for (const {expected, path, size, exponent, spread, viewBox} of captures) {
      const result = generateSDFWithWebGL(size, size, path, viewBox, spread, exponent)
      assert.deepEqual([...result], expected)
    }
  },
  function jsGeneration () {
    for (const {expected, path, size, exponent, spread, viewBox} of captures) {
      const result = generateSDFWithJS(size, size, path, viewBox, spread, exponent)
      assert.deepEqual([...result], expected)
    }
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
