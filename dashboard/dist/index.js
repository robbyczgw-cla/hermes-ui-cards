// HUI+ Cards has no web dashboard page: its cards live in Hermes Desktop and the Webapp.
// The dashboard loads this file for every plugin with a dashboard/manifest.json (this one
// exists for the backend routes in plugin_api.py), so register an empty, hidden page.
;(function () {
  var registry = window.__HERMES_PLUGINS__
  if (registry && typeof registry.register === 'function') {
    registry.register('hermes-ui-cards', function HuiCardsBackendOnly() {
      return null
    })
  }
})()
