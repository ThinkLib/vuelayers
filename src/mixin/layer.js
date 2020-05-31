import RenderEventType from 'ol/render/EventType'
import { fromOlEvent as obsFromOlEvent } from '../rx-ext'
import { isFunction, pick } from '../util/minilo'
import mergeDescriptors from '../util/multi-merge-descriptors'
import { makeWatchers } from '../util/vue-helpers'
import baseLayer from './base-layer'
import sourceContainer from './source-container'

/**
 * Base simple layer mixin.
 */
export default {
  mixins: [
    sourceContainer,
    baseLayer,
  ],
  props: {
    // ol/layer/Layer
    /**
     * @type {function|undefined}
     */
    render: Function,
    // custom
    /**
     * @type {boolean}
     */
    overlay: {
      type: Boolean,
      default: false,
    },
  },
  watch: {
    ...makeWatchers([
      'render',
      'overlay',
    ], prop => async function () {
      if (process.env.VUELAYERS_DEBUG) {
        this.$logger.log(`${prop} changed, scheduling recreate...`)
      }

      await this.scheduleRecreate()
    }),
  },
  methods: {
    /**
     * @return {Promise<void>}
     * @protected
     */
    async mount () {
      if (this.overlay && this.$mapVm) {
        await this.setMap(this.$mapVm)
        return
      }

      return this::baseLayer.methods.mount()
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async unmount () {
      if (this.overlay) {
        await this.setMap(null)
        return
      }

      return this::baseLayer.methods.unmount()
    },
    /**
     * @returns {Object}
     * @protected
     */
    getServices () {
      return mergeDescriptors(
        this::baseLayer.methods.getServices(),
        this::sourceContainer.methods.getServices(),
      )
    },
    /**
     * @return {void}
     * @protected
     */
    subscribeAll () {
      this::baseLayer.methods.subscribeAll()
      this::subscribeToLayerEvents()
    },
    ...pick(baseLayer.methods, [
      'beforeInit',
      'init',
      'deinit',
      'beforeMount',
      'refresh',
      'scheduleRefresh',
      'remount',
      'scheduleRemount',
      'recreate',
      'scheduleRecreate',
      'resolveOlObject',
      'resolveLayer',
    ]),
    /**
     * @return {Promise<module:ol/layer/Base~BaseLayer>}
     * @protected
     */
    getSourceTarget: baseLayer.methods.resolveOlObject,
    /**
     * @returns {Promise<module:ol/renderer/Layer~LayerRenderer>}
     */
    async getRenderer () {
      await this.resolveLayer()

      return this.getRendererSync()
    },
    getRendererSync () {
      return this.$layer.getRenderer()
    },
    /**
     * @param {module:ol/Map~Map|Object|undefined} map
     * @return {Promise<void>}
     */
    async setMap (map) {
      if (map && isFunction(map.resolveOlObject)) {
        map = await map.resolveOlObject()
      }
      await this.resolveLayer()

      this.setMapSync(map)
    },
    setMapSync (map) {
      this.$layer.setMap(map)
    },
  },
}

async function subscribeToLayerEvents () {
  const renderEvents = obsFromOlEvent(this.$layer, [
    RenderEventType.PRERENDER,
    RenderEventType.POSTRENDER,
  ])
  this.subscribeTo(renderEvents, evt => {
    this.$emit(evt.type, evt)
  })
}
