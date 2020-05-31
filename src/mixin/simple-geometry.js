import debounce from 'debounce-promise'
import { boundingExtent } from 'ol/extent'
import { findPointOnSurface, flatCoords, isEqualCoord, roundCoords, roundPointCoords, transforms } from '../ol-ext'
import { clonePlainObject, isEmpty, negate, pick } from '../util/minilo'
// import { makeWatchers } from '../util/vue-helpers'
import geometry from './geometry'
import { FRAME_TIME } from './ol-cmp'

/**
 * Base simple geometry with coordinates mixin.
 */
export default {
  mixins: [
    geometry,
  ],
  props: {
    // ol/geom/SimpleGeometry
    /**
     * @type {number[]} Coordinates in map data projection
     */
    coordinates: {
      type: Array,
      required: true,
      validator: negate(isEmpty),
    },
    // todo add support of coord layout
    // /**
    //  * @type {string}
    //  */
    // layout: {
    //   type: String,
    //   default: GeometryLayout.XY,
    //   validator: value => Object.values(GeometryLayout).includes(value.toUpperCase()),
    // },
  },
  computed: {
    coordinatesDataProj () {
      return roundCoords(this.type, this.coordinates)
    },
    coordinatesViewProj () {
      return this.coordinatesToViewProj(this.coordinates)
    },
    extentDataProj () {
      return boundingExtent(flatCoords(this.type, this.coordinatesDataProj))
    },
    extentViewProj () {
      return this.extentToViewProj(this.extentDataProj)
    },
    currentCoordinatesDataProj () {
      if (this.rev && this.$geometry) {
        return this.getCoordinatesSync()
      }

      return this.coordinatesDataProj
    },
    currentCoordinatesViewProj () {
      if (this.rev && this.$geometry) {
        return this.getCoordinatesSync(true)
      }

      return this.coordinatesViewProj
    },
    currentPointDataProj () {
      if (!(this.rev && this.$geometry)) return

      return this.findPointOnSurfaceSync()
    },
    currentPointViewProj () {
      if (!(this.rev && this.$geometry)) return

      return this.findPointOnSurfaceSync(true)
    },
    // layoutUpCase () {
    //   return this.layout.toUpperCase()
    // },
  },
  watch: {
    coordinatesDataProj: {
      deep: true,
      async handler (value) {
        await this.setCoordinates(value)
      },
    },
    currentCoordinatesDataProj: {
      deep: true,
      handler: debounce(function (value) {
        if (isEqualCoord({
          coordinates: value,
          extent: boundingExtent(flatCoords(this.type, value)),
        }, {
          coordinates: this.coordinatesDataProj,
          extent: this.extentDataProj,
        })) return

        this.$emit('update:coordinates', clonePlainObject(value))
      }, FRAME_TIME),
    },
    async resolvedDataProjection () {
      await this.setCoordinates(this.coordinatesDataProj)
    },
    // ...makeWatchers([
    //   'layoutUpCase',
    // ], () => geometry.methods.scheduleRecreate),
  },
  methods: {
    ...pick(geometry.methods, [
      'beforeInit',
      'init',
      'deinit',
      'beforeMount',
      'mount',
      'unmount',
      'refresh',
      'scheduleRefresh',
      'remount',
      'scheduleRemount',
      'recreate',
      'scheduleRecreate',
      'getServices',
      'subscribeAll',
      'resolveOlObject',
      'resolveGeometry',
    ]),
    /**
     * @returns {function}
     */
    getCoordinatesTransformFunction () {
      return transforms[this.type].transform
    },
    /**
     * @param {number[]} coordinates
     * @returns {Promise<number[]>}
     */
    coordinatesToDataProj (coordinates) {
      const transform = this.getCoordinatesTransformFunction()

      return transform(coordinates, this.viewProjection, this.resolvedDataProjection)
    },
    /**
     * @param {number[]} coordinates
     * @returns {Promise<number[]>}
     */
    coordinatesToViewProj (coordinates) {
      const transform = this.getCoordinatesTransformFunction()

      return transform(coordinates, this.resolvedDataProjection, this.viewProjection)
    },
    /**
     * @param {boolean} [viewProj=false]
     * @return {Promise<number[]>}
     */
    async getCoordinates (viewProj = false) {
      await this.resolveGeometry()

      return this.getCoordinatesSync(viewProj)
    },
    getCoordinatesSync (viewProj = false) {
      if (viewProj) {
        return roundCoords(this.getTypeSync(), this.$geometry.getCoordinates())
      }

      return this.coordinatesToDataProj(this.$geometry.getCoordinates())
    },
    /**
     * @param {number[]} coordinates
     * @param {boolean} [viewProj=false]
     */
    async setCoordinates (coordinates, viewProj = false) {
      await this.resolveGeometry()

      this.setCoordinatesSync(coordinates, viewProj)
    },
    setCoordinatesSync (coordinates, viewProj = false) {
      coordinates = roundCoords(this.getTypeSync(), coordinates)
      const currentCoordinates = this.getCoordinatesSync(viewProj)

      if (isEqualCoord({
        coordinates,
        extent: boundingExtent(flatCoords(this.getTypeSync(), coordinates)),
      }, {
        coordinates: currentCoordinates,
        extent: boundingExtent(flatCoords(this.getTypeSync(), currentCoordinates)),
      })) return

      if (!viewProj) {
        coordinates = this.coordinatesToViewProj(coordinates)
      }

      this.$geometry.setCoordinates(coordinates)
    },
    /**
     * @param {boolean} [viewProj=false]
     * @returns {number[]>}
     */
    async getFirstCoordinate (viewProj = false) {
      await this.resolveGeometry()

      return this.getFirstCoordinateSync(viewProj)
    },
    getFirstCoordinateSync (viewProj = false) {
      const coordinate = this.$geometry.getFirstCoordinate()
      if (viewProj) {
        return roundPointCoords(coordinate)
      }

      return this.pointToDataProj(coordinate)
    },
    /**
     * @param {boolean} [viewProj=false]
     * @returns {Promise<number[]>}
     */
    async getLastCoordinate (viewProj = false) {
      await this.resolveGeometry()

      return this.getLastCoordinateSync(viewProj)
    },
    getLastCoordinateSync (viewProj = false) {
      const coordinate = this.$geometry.getLastCoordinate()
      if (viewProj) {
        return roundPointCoords(coordinate)
      }

      return this.pointToDataProj(coordinate)
    },
    /**
     * @returns {Promise<string>}
     */
    async getLayout () {
      await this.resolveGeometry()

      return this.getLayoutSync()
    },
    getLayoutSync () {
      return this.$geometry.getLayout()
    },
    async findPointOnSurface (viewProj = false) {
      await this.resolveGeometry()

      return this.findPointOnSurfaceSync(viewProj)
    },
    findPointOnSurfaceSync (viewProj = false) {
      return findPointOnSurface({
        type: this.$geometry.getType(),
        coordinates: this.getCoordinatesSync(viewProj),
      })
    },
  },
}
