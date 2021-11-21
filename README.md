# webgl-sdf-generator

This is a signed distance field (SDF) image generator for 2D paths such as font glyphs, for use in Web environments. It utilizes WebGL when possible for GPU-accelerated SDF generation.

## Usage

### Install it from npm:

```shell
npm install webgl-sdf-generator
```

[![NPM](https://nodei.co/npm/webgl-sdf-generator.png?compact=true)](https://npmjs.org/package/webgl-sdf-generator)

### Import and initialize:

```js
import initSDFGenerator from 'webgl-sdf-generator'
// or: const initSDFGenerator = require('webgl-sdf-generator')

const generator = initSDFGenerator()
```

The `webgl-sdf-generator` package's only export is a factory function which you _must invoke_ to return an object which holds various methods for performing the generation.

> _Why a factory function?_ The main reason is to ensure the entire module's code is wrapped within a single self-contained function with no closure dependencies. This enables that function to be stringified and passed into a web worker, for example.

Note that each factory call will result in its own internal WebGL context, which may be useful in some rare cases, but usually you'll just want to call it once and share that single generator object.

### Generate your SDF:

```js
const sdfImageData = generator.generate(
  64,                  // width
  64,                  // height
  'M0,0L50,25L25,50Z', // path 
  [-5, -5, 55, 55],    // viewBox
  25,                  // maxDistance
  1                    // exponent
)
```

Let's break down those arguments...

- **`width/height`** - The dimensions of the resulting image.

- **`path`** - An SVG-like [path string](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d#path_commands). Only the following path commands are currently supported: `M`, `L`, `Q`, `C`, and `Z`.

- **`viewBox`** - The rectangle in the `path`'s coordinate system that will be covered by the output image. Specified as an array of `[left, top, right, bottom]`. You'll want to account for padding around the path shape in this rectangle.

- **`maxDistance`** - The maximum distance that will be encoded in the distance field; this is the distance from the path's edge at which the SDF value will be `0` or `255`.

- **`exponent`** - An optional exponent to apply to the SDF distance values as they get farther from the path's edge. This can be useful when `maxDistance` is large, to allow more precision near the path edge where it's more important and decreasing precision far away ([visualized here](https://www.desmos.com/calculator/uiaq5aqiam)). Whatever uses the SDF later on will need to invert the transformation to get useful distance values. Defaults to `1` for no curve.

The return value is a `Uint8Array` of SDF image pixel values (single channel), where 127.5 is the "zero distance" aligning with path edges. Values below that are outside the path and values above it are inside the path.

When you call `generator.generate(...)`, it will first attempt to build the SDF using WebGL; this is super fast because it is GPU-acclerated. This should work in most browsers, but if for whatever reason the proper WebGL support is not available or fails due to context loss then it will fall back to a slower JavaScript-based implementation.

If you want more control over this fallback behavior, you can access the individual implementations directly:

```js
// Same arguments as the main generate():
const resultFromGL = generator.webgl.generate(...args)
const resultFromJS = generator.javascript.generate(...args)
```

The WebGL implementation also provides method to detect support if you want to test it beforehand:

```js
const webglSupported = generator.webgl.isSupported()
```


