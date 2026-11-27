import cytoscape from 'cytoscape'
import { MAX_ZOOM, MIN_ZOOM } from './graph-controller'
import { graphStyle } from './graph-style'

export function createCytoscape(container: HTMLElement) {
  return cytoscape({
    container,
    style: graphStyle(),
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    // Selection is owned by React so it survives layout changes.
    autounselectify: true,
    boxSelectionEnabled: false,
  })
}
