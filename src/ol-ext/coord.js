import GeometryType from 'ol/geom/GeometryType'
import { isEqual, round } from '../util/minilo'

export const COORD_PRECISION = -1

export function roundExtent (extent, precision = COORD_PRECISION) {
  if (!extent) return

  return extent.map(x => round(x, precision))
}

export function roundPointCoords (coordinates, precision = COORD_PRECISION) {
  if (!coordinates) return

  return coordinates.map(x => round(x, precision))
}

export function roundLineCoords (coordinates, precision = COORD_PRECISION) {
  if (!coordinates) return

  return coordinates.map(point => roundPointCoords(point, precision))
}

export function roundPolygonCoords (coordinates, precision = COORD_PRECISION) {
  if (!coordinates) return

  return coordinates.map(line => roundLineCoords(line, precision))
}

export function roundMultiPointCoords (coordinates, precision = COORD_PRECISION) {
  return roundLineCoords(coordinates, precision)
}

export function roundMultiLineCoords (coordinates, precision = COORD_PRECISION) {
  return roundPolygonCoords(coordinates, precision)
}

export function roundMultiPolygonCoords (coordinates, precision = COORD_PRECISION) {
  if (!coordinates) return

  return coordinates.map(polygon => roundPolygonCoords(polygon, precision))
}

export function roundCoords (geomType, coordinates, precision = COORD_PRECISION) {
  switch (geomType) {
    case GeometryType.POINT:
    case GeometryType.CIRCLE:
      return roundPointCoords(coordinates, precision)
    case GeometryType.LINE_STRING:
    case GeometryType.MULTI_POINT:
      return roundLineCoords(coordinates, precision)
    case GeometryType.POLYGON:
    case GeometryType.MULTI_LINE_STRING:
      return roundPolygonCoords(coordinates, precision)
    case GeometryType.MULTI_POLYGON:
      return roundMultiPolygonCoords(coordinates, precision)
  }
}

export function flatCoords (geomType, coordinates) {
  const polygonReducer = (coords, lineString) => coords.concat(lineString)

  switch (geomType) {
    case GeometryType.POINT:
      return [coordinates]
    case GeometryType.LINE_STRING:
    case GeometryType.MULTI_POINT:
      return coordinates
    case GeometryType.POLYGON:
    case GeometryType.MULTI_LINE_STRING:
      return coordinates.reduce(polygonReducer, [])
    case GeometryType.MULTI_POLYGON:
      return coordinates.reduce((coords, polygon) => coords.concat(polygon.reduce(polygonReducer, [])), [])
    default:
      // todo maybe return null?
      return []
  }
}

/**
 * @param {{coordinates: number[], extent: number[]}} a
 * @param {{coordinates: number[], extent: number[]}} b
 * @returns {boolean}
 */
export function isEqualCoord (a, b) {
  return isEqual(a.extent, b.extent)
    ? isEqual(a.coordinates, b.coordinates)
    : false
}

export function calcDistance (point1, point2, precision = COORD_PRECISION) {
  const dx = point2[0] - point1[0]
  const dy = point2[1] - point1[1]
  const squared = dx * dx + dy * dy

  return round(Math.sqrt(squared), COORD_PRECISION)
}
