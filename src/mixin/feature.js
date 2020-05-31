import debounce from 'debounce-promise'
import { Feature } from 'ol'
import ObjectEventType from 'ol/ObjectEventType'
import { map as mapObs, skipWhile } from 'rxjs/operators'
import { getFeatureId, getFeatureProperties, initializeFeature, setFeatureId, setFeatureProperties } from '../ol-ext'
import { fromOlEvent as obsFromOlEvent, fromVueEvent as obsFromVueEvent } from '../rx-ext'
import { assert } from '../util/assert'
import { clonePlainObject, hasProp, isEqual, pick, stubObject } from '../util/minilo'
import mergeDescriptors from '../util/multi-merge-descriptors'
import waitFor from '../util/wait-for'
import geometryContainer from './geometry-container'
import olCmp, { FRAME_TIME, OlObjectEvent } from './ol-cmp'
import projTransforms from './proj-transforms'
import stubVNode from './stub-vnode'
import styleContainer from './style-container'

/**
 * A vector object for geographic features with a geometry and other attribute properties,
 * similar to the features in vector file formats like **GeoJSON**.
 */
export default {
  mixins: [
    stubVNode,
    projTransforms,
    geometryContainer,
    styleContainer,
    olCmp,
  ],
  stubVNode: {
    empty: false,
    attrs () {
      return {
        id: this.vmId,
        class: this.vmClass,
      }
    },
  },
  props: {
    properties: {
      type: Object,
      default: stubObject,
    },
  },
  data () {
    return {
      dataProjection: null,
    }
  },
  computed: {
    currentProperties () {
      if (this.rev && this.$feature) {
        return this.getPropertiesSync()
      }

      return this.properties
    },
  },
  watch: {
    properties: {
      deep: true,
      async handler (value) {
        await this.setProperties(value)
      },
    },
    currentProperties: {
      deep: true,
      handler: debounce(function (value) {
        if (isEqual(value, this.properties)) return

        this.$emit('update:properties', clonePlainObject(value))
      }, FRAME_TIME),
    },
  },
  created () {
    this::defineServices()
  },
  methods: {
    /**
     * @return {Promise<void>}
     * @protected
     */
    async beforeInit () {
      try {
        await waitFor(
          () => this.$mapVm != null,
          obsFromVueEvent(this.$eventBus, [
            OlObjectEvent.CREATE_ERROR,
          ]).pipe(
            mapObs(([vm]) => hasProp(vm, '$map') && this.$vq.closest(vm)),
          ),
          1000,
        )
        this.dataProjection = this.$mapVm.resolvedDataProjection
        await this.$nextTickPromise()

        return this::olCmp.methods.beforeInit()
      } catch (err) {
        err.message = 'Wait for $mapVm injection: ' + err.message
        throw err
      }
    },
    /**
     * Create feature without inner style applying, feature level style
     * will be applied in the layer level style function.
     * @return {module:ol/Feature~Feature}
     * @protected
     */
    createOlObject () {
      const feature = initializeFeature(this.createFeature(), this.currentId)
      feature.setGeometry(this.$geometry)

      return feature
    },
    /**
     * @returns {Feature}
     */
    createFeature () {
      return new Feature(this.properties)
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async beforeMount () {
      try {
        await waitFor(
          () => this.$geometryVm != null,
          obsFromVueEvent(this.$eventBus, [
            ObjectEventType.CREATE_ERROR,
            ObjectEventType.MOUNT_ERROR,
          ]).pipe(
            mapObs(([vm]) => hasProp(vm, '$geometry') && this.$vq.find(vm).length),
          ),
          1000,
        )

        return this::olCmp.methods.beforeMount()
      } catch (err) {
        err.message = 'Wait for $geometry failed: ' + err.message
        throw err
      }
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async mount () {
      if (this.$featuresContainer) {
        await this.$featuresContainer.addFeature(this)
      }

      return this::olCmp.methods.mount()
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async unmount () {
      if (this.$featuresContainer) {
        await this.$featuresContainer.removeFeature(this)
      }

      return this::olCmp.methods.unmount()
    },
    /**
     * @return {void}
     * @protected
     */
    subscribeAll () {
      this::olCmp.methods.subscribeAll()
      this::subscribeToEvents()
    },
    /**
     * @return {Object}
     * @protected
     */
    getServices () {
      const vm = this

      return mergeDescriptors(
        this::olCmp.methods.getServices(),
        this::geometryContainer.methods.getServices(),
        this::styleContainer.methods.getServices(),
        {
          get featureVm () { return vm },
        },
      )
    },
    ...pick(olCmp.methods, [
      'refresh',
      'scheduleRefresh',
      'remount',
      'scheduleRemount',
      'recreate',
      'scheduleRecreate',
      'resolveOlObject',
    ]),
    ...pick(geometryContainer.methods, [
      'setGeometry',
    ]),
    ...pick(styleContainer.methods, [
      'setStyle',
    ]),
    resolveFeature: olCmp.methods.resolveOlObject,
    getGeometryTarget: olCmp.methods.resolveOlObject,
    getStyleTarget: olCmp.methods.resolveOlObject,
    /**
     * @return {string|number}
     */
    getIdSync () {
      return getFeatureId(this.$feature)
    },
    /**
     * @param {string|number} id
     * @return {void}
     */
    setIdSync (id) {
      assert(id != null && id !== '', 'Invalid feature id')

      if (id === this.getIdSync()) return

      setFeatureId(this.$feature, id)
    },
    /**
     * @return {Promise<string>}
     */
    async getGeometryName () {
      await this.resolveFeature()

      return this.getGeometryNameSync()
    },
    getGeometryNameSync () {
      return this.$feature.getGeometryName()
    },
    /**
     * @param {string} geometryName
     * @return {Promise<void>}
     */
    async setGeometryName (geometryName) {
      await this.resolveFeature()

      this.setGeometryNameSync(geometryName)
    },
    setGeometryNameSync (geometryName) {
      if (geometryName === this.getGeometryNameSync()) return

      this.$feature.setGeometryName(geometryName)
    },
    /**
     * @return {Promise<Object>}
     */
    async getProperties () {
      await this.resolveFeature()

      return this.getPropertiesSync()
    },
    getPropertiesSync () {
      return getFeatureProperties(this.$feature)
    },
    /**
     * @param {Object} properties
     * @return {Promise<void>}
     */
    async setProperties (properties) {
      await this.resolveFeature()

      this.setPropertiesSync(properties)
    },
    setPropertiesSync (properties) {
      properties = getFeatureProperties({ properties })
      if (isEqual(properties, this.getPropertiesSync())) return

      setFeatureProperties(this.$feature, properties)
    },
    /**
     * Checks if feature lies at `pixel`.
     * @param {number[]} pixel
     * @return {Promise<boolean>}
     */
    async isAtPixel (pixel) {
      await Promise.all([
        this.resolveFeature(),
        this.$layerVm.resolveLayer(),
        this.$mapVm.resolveMap(),
      ])

      return this.isAtPixelSync(pixel)
    },
    isAtPixelSync (pixel) {
      const selfFeature = this.$feature
      let layerFilter
      if (this.$layerVm) {
        const selfLayer = this.$layerVm.$layer
        layerFilter = layer => layer === selfLayer
      }

      return this.$mapVm.forEachFeatureAtPixelSync(pixel, feature => feature === selfFeature, { layerFilter })
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    $feature: {
      enumerable: true,
      get: () => this.$olObject,
    },
    $layerVm: {
      enumerable: true,
      get: () => this.$services?.layerVm,
    },
    $mapVm: {
      enumerable: true,
      get: () => this.$services?.mapVm,
    },
    $featuresContainer: {
      enumerable: true,
      get: () => this.$services?.featuresContainer,
    },
  })
}

async function subscribeToEvents () {
  const propChanges = obsFromOlEvent(
    this.$feature,
    ObjectEventType.PROPERTYCHANGE,
    ({ key }) => {
      switch (key) {
        case this.$feature.getGeometryName():
          return {
            prop: 'geometry',
            value: this.writeGeometryInDataProj(this.getGeometry()),
            compareWith: this.currentGeometryDataProj,
          }
        default:
          return {
            prop: 'properties',
            value: {
              ...this.properties,
              [key]: this.$feature.get(key),
            },
            compareWith: this.currentProperties,
          }
      }
    },
  ).pipe(
    skipWhile(({ value, compareWith }) => isEqual(value, compareWith)),
  )
  this.subscribeTo(propChanges, () => {
    ++this.rev
  })
}
