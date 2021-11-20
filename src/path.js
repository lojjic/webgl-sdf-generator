/**
 * Find the point on a quadratic bezier curve at t where t is in the range [0, 1]
 */
function pointOnQuadraticBezier (x0, y0, x1, y1, x2, y2, t, pointOut) {
  const t2 = 1 - t
  pointOut.x = t2 * t2 * x0 + 2 * t2 * t * x1 + t * t * x2
  pointOut.y = t2 * t2 * y0 + 2 * t2 * t * y1 + t * t * y2
}

/**
 * Find the point on a cubic bezier curve at t where t is in the range [0, 1]
 */
function pointOnCubicBezier (x0, y0, x1, y1, x2, y2, x3, y3, t, pointOut) {
  const t2 = 1 - t
  pointOut.x = t2 * t2 * t2 * x0 + 3 * t2 * t2 * t * x1 + 3 * t2 * t * t * x2 + t * t * t * x3
  pointOut.y = t2 * t2 * t2 * y0 + 3 * t2 * t2 * t * y1 + 3 * t2 * t * t * y2 + t * t * t * y3
}

/**
 * Convert a path string to a series of straight line segments
 * @param {string} pathString - An SVG-like path string to parse; should only contain commands: M/L/Q/C/Z
 * @param {function(x1:number, y1:number, x2:number, y2:number)} segmentCallback - A callback
 *        function that will be called once for every line segment
 * @param {number} [curvePoints] - How many straight line segments to use when approximating a
 *        bezier curve in the path. Defaults to 16.
 */
export function pathToLineSegments (pathString, segmentCallback, curvePoints = 16) {
  const segmentRE = /([MLQCZ])([^MLQCZ]*)/g
  const tempPoint = { x: 0, y: 0 }
  let match, firstX, firstY, prevX, prevY
  while ((match = segmentRE.exec(pathString))) {
    const args = match[2]
      .replace(/^\s*|\s*$/g, '')
      .split(/[,\s]+/)
      .map((v) => parseFloat(v))
    switch (match[1]) {
      case 'M':
        prevX = firstX = args[0]
        prevY = firstY = args[1]
        break
      case 'L':
        if (args[0] !== prevX || args[1] !== prevY) {
          //yup, some fonts have zero-length line commands
          segmentCallback(prevX, prevY, (prevX = args[0]), (prevY = args[1]))
        }
        break
      case 'Q': {
        let prevCurveX = prevX
        let prevCurveY = prevY
        for (let i = 1; i < curvePoints; i++) {
          pointOnQuadraticBezier(
            prevX,
            prevY,
            args[0],
            args[1],
            args[2],
            args[3],
            i / (curvePoints - 1),
            tempPoint
          )
          segmentCallback(prevCurveX, prevCurveY, tempPoint.x, tempPoint.y)
          prevCurveX = tempPoint.x
          prevCurveY = tempPoint.y
        }
        prevX = args[2]
        prevY = args[3]
        break
      }
      case 'C': {
        let prevCurveX = prevX
        let prevCurveY = prevY
        for (let i = 1; i < curvePoints; i++) {
          pointOnCubicBezier(
            prevX,
            prevY,
            args[0],
            args[1],
            args[2],
            args[3],
            args[4],
            args[5],
            i / (curvePoints - 1),
            tempPoint
          )
          segmentCallback(prevCurveX, prevCurveY, tempPoint.x, tempPoint.y)
          prevCurveX = tempPoint.x
          prevCurveY = tempPoint.y
        }
        prevX = args[4]
        prevY = args[5]
        break
      }
      case 'Z':
        if (prevX !== firstX || prevY !== firstY) {
          segmentCallback(prevX, prevY, firstX, firstY)
        }
        break
    }
  }
}
