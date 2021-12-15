import { pathToLineSegments } from './path.js'
import { renderImageData } from './webglUtils.js'

export function generate (sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent = 1) {
  const textureData = new Uint8Array(sdfWidth * sdfHeight)

  const viewBoxWidth = viewBox[2] - viewBox[0]
  const viewBoxHeight = viewBox[3] - viewBox[1]

  // Decompose all paths into straight line segments and add them to an index
  const segments = []
  pathToLineSegments(path, (x1, y1, x2, y2) => {
    segments.push({
      x1, y1, x2, y2,
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2)
    })
  })

  // Sort segments by maxX, this will let us short-circuit some loops below
  segments.sort((a, b) => a.maxX - b.maxX)

  // For each target SDF texel, find the distance from its center to its nearest line segment,
  // map that distance to an alpha value, and write that alpha to the texel
  for (let sdfX = 0; sdfX < sdfWidth; sdfX++) {
    for (let sdfY = 0; sdfY < sdfHeight; sdfY++) {
      const signedDist = findNearestSignedDistance(
        viewBox[0] + viewBoxWidth * (sdfX + 0.5) / sdfWidth,
        viewBox[1] + viewBoxHeight * (sdfY + 0.5) / sdfHeight
      )

      // Use an exponential scale to ensure the texels very near the glyph path have adequate
      // precision, while allowing the distance field to cover the entire texture, given that
      // there are only 8 bits available. Formula visualized: https://www.desmos.com/calculator/uiaq5aqiam
      let alpha = Math.pow((1 - Math.abs(signedDist) / maxDistance), sdfExponent) / 2
      if (signedDist < 0) {
        alpha = 1 - alpha
      }

      alpha = Math.max(0, Math.min(255, Math.round(alpha * 255))) //clamp
      textureData[sdfY * sdfWidth + sdfX] = alpha
    }
  }

  return textureData

  /**
   * For a given x/y, search the index for the closest line segment and return
   * its signed distance. Negative = inside, positive = outside, zero = on edge
   * @param x
   * @param y
   * @returns {number}
   */
  function findNearestSignedDistance (x, y) {
    let closestDistSq = Infinity
    let closestDist = Infinity

    for (let i = segments.length; i--;) {
      const seg = segments[i]
      if (seg.maxX + closestDist <= x) break //sorting by maxX means no more can be closer, so we can short-circuit
      if (x + closestDist > seg.minX && y - closestDist < seg.maxY && y + closestDist > seg.minY) {
        const distSq = absSquareDistanceToLineSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2)
        if (distSq < closestDistSq) {
          closestDistSq = distSq
          closestDist = Math.sqrt(closestDistSq)
        }
      }
    }

    // Flip to negative distance if inside the poly
    if (isPointInPoly(x, y)) {
      closestDist = -closestDist
    }
    return closestDist
  }

  /**
   * Determine whether the given point lies inside or outside the glyph. Uses a simple
   * winding-number ray casting algorithm using a ray pointing east from the point.
   */
  function isPointInPoly (x, y) {
    let winding = 0
    for (let i = segments.length; i--;) {
      const seg = segments[i]
      if (seg.maxX <= x) break //sorting by maxX means no more can cross, so we can short-circuit
      const intersects = ((seg.y1 > y) !== (seg.y2 > y)) && (x < (seg.x2 - seg.x1) * (y - seg.y1) / (seg.y2 - seg.y1) + seg.x1)
      if (intersects) {
        winding += seg.y1 < seg.y2 ? 1 : -1
      }
    }
    return winding !== 0
  }
}

export function generateIntoCanvas(sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent = 1, canvas, x = 0, y = 0, channel = 0) {
  generateIntoFramebuffer(sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent, canvas, null, x, y, channel)
}

export function generateIntoFramebuffer (sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent = 1, glOrCanvas, framebuffer, x = 0, y = 0, channel = 0) {
  const data = generate(sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent)
  // Expand single-channel data to rbga
  const rgbaData = new Uint8Array(data.length * 4)
  for (let i = 0; i < data.length; i++) {
    rgbaData[i * 4 + channel] = data[i]
  }
  renderImageData(glOrCanvas, rgbaData, x, y, sdfWidth, sdfHeight, 1 << (3 - channel), framebuffer)
}

/**
 * Find the absolute distance from a point to a line segment at closest approach
 */
function absSquareDistanceToLineSegment (x, y, lineX0, lineY0, lineX1, lineY1) {
  const ldx = lineX1 - lineX0
  const ldy = lineY1 - lineY0
  const lengthSq = ldx * ldx + ldy * ldy
  const t = lengthSq ? Math.max(0, Math.min(1, ((x - lineX0) * ldx + (y - lineY0) * ldy) / lengthSq)) : 0
  const dx = x - (lineX0 + t * ldx)
  const dy = y - (lineY0 + t * ldy)
  return dx * dx + dy * dy
}
