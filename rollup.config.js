import { terser } from 'rollup-plugin-terser'
import glsl from 'rollup-plugin-glsl'
import buble from '@rollup/plugin-buble'

export default [
  // First compile to an iife, and wrap the whole thing into an exported factory function.
  // This ensures all the code is self-contained within that one factory function.
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.js',
      format: 'iife',
      name: 'exports',
      banner: `export default function SDFGenerator() {`,
      footer: `return exports\n}`
    },
    plugins: [
      glsl({
        include: '**/*.glsl',
        compress: true
      }),
      // Transpile down to ES5 for all build artifacts. This helps ensure that downstream
      // transpilers won't inject references to external helpers/polyfills, which would
      // break its ability to be serialized to a web worker.
      buble()
    ]
  },
  // Then wrap that exported factory function as esm and umd
  {
    input: 'dist/index.js',
    output: [
      {
        file: 'dist/webgl-sdf-generator.mjs',
        format: 'esm'
      },
      {
        file: 'dist/webgl-sdf-generator.min.mjs',
        format: 'esm',
        plugins: [
          terser({
            ecma: 5,
            //mangle: {properties: {regex: /^_/}}
          })
        ]
      },
      {
        file: 'dist/webgl-sdf-generator.js',
        format: 'umd',
        name: 'webgl_sdf_generator'
      },
      {
        file: 'dist/webgl-sdf-generator.min.js',
        format: 'umd',
        name: 'webgl_sdf_generator',
        plugins: [
          terser({
            ecma: 5,
            //mangle: {properties: {regex: /^_/}}
          })
        ]
      }
    ]
  }
]
