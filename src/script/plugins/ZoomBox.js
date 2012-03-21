/**
 * Copyright (c) 2008-2011 The Open Planning Project
 * 
 * Published under the GPL license.
 * See https://github.com/opengeo/gxp/raw/master/license.txt for the full text
 * of the license.
 */

/**
 * @requires plugins/Tool.js
 * @requires OpenLayers/Kinetic.js
 */

/** api: (define)
 *  module = gxp.plugins
 *  class = ZoomBox
 */

/** api: (extends)
 *  plugins/Tool.js
 */
Ext.namespace("gxp.plugins");

/** api: constructor
 *  .. class:: ZoomBox(config)
 *
 *    Provides one action for panning the map and zooming in with
 *    a box. Optionally provide mousewheel zoom support.
 */
gxp.plugins.ZoomBox = Ext.extend(gxp.plugins.Tool, {
    
    /** api: ptype = gxp_zoombox */
    ptype: "gxp_zoombox",
    
    /** api: config[menuText]
     *  ``String``
     *  Text for zoombox menu item (i18n).
     */
    menuText: "Zoom rectangle",

    /** api: config[tooltip]
     *  ``String``
     *  Text for zoombox action tooltip (i18n).
     */
    tooltip: "Zoom rectangle",

    /** private: method[constructor]
     */
    constructor: function(config) {
        gxp.plugins.ZoomBox.superclass.constructor.apply(this, arguments);
    },

    /** api: method[addActions]
     */
    addActions: function() {
        this.controlOptions = this.controlOptions || {};
        var actions = [new GeoExt.Action({
            tooltip: this.tooltip,
            menuText: this.menuText,
            iconCls: "gxp-icon-zoombox",
            enableToggle: true,
            pressed: false,
            control: new OpenLayers.Control.ZoomBox(this.controlOptions),
            map: this.target.mapPanel.map,
            toggleGroup: this.toggleGroup})];
        return gxp.plugins.ZoomBox.superclass.addActions.apply(this, [actions]);
    }
        
});

Ext.preg(gxp.plugins.ZoomBox.prototype.ptype, gxp.plugins.ZoomBox);
