/**
 * Copyright (c) 2008-2011 The Open Planning Project
 * 
 * Published under the GPL license.
 * See https://github.com/opengeo/gxp/raw/master/license.txt for the full text
 * of the license.
 */



/** api: (define)
 *  module = gxp.plugins
 *  class = WMSGetAndSetFeatureInfo
 */

/** api: (extends)
 *  plugins/Tool.js
 */
Ext.namespace("gxp.plugins");

/** api: constructor
 *  .. class:: WMSGetAndSetFeatureInfo(config)
 *
 *    This plugins provides an action which, when active, will issue a
 *    GetFeatureInfo request to the WMS of all layers on the map. The output
 *    will be displayed in a popup.
 *    The user may modify some information, and process a write request to the server
 *    (URL for writing must have been given to the plugin)
 */
gxp.plugins.WMSGetAndSetFeatureInfo = Ext.extend(gxp.plugins.Tool, {
    
    /** api: ptype = gxp_wmsgetfeatureinfo */
    ptype: "gxp_wmsgetandsetfeatureinfo",
    
    /** api: config[outputTarget]
     *  ``String`` Popups created by this tool are added to the map by default.
     */
    outputTarget: "map",

    /** api: config[infoActionTip]
     *  ``String``
     *  Text for feature info action tooltip (i18n).
     */
    infoActionTip: "Get Feature Info",

    /** api: config[format]
     *  ``String`` Either "html" or "grid". If set to "grid", GML will be
     *  requested from the server and displayed in an Ext.PropertyGrid.
     *  Otherwise, the html output from the server will be displayed as-is.
     *  Default is "html".
     */
    format: "html",

    /** api: config[urlWriteFeature]
     *  ``String`` URL for writting feature modifications
     */
    urlWriteFeature: "",

    /** api: config[urlAssociatedFeatures]
     *  ``String`` URL for getting associated features to load
     */
    urlAssociatedFeatures: "",

    /** api: config[urlMainFeatures]
     *  ``String`` URL for getting main features attributes instead of those retreive by WMS
     */
    urlMainFeatures: "",
    
    
    /** api: config[lastPointClicked]
     *  ``String`` Last point clicked
     */
    lastPointClicked: "",
    
    /** api: config[vendorParams]
     *  ``Object``
     *  Optional object with properties to be serialized as vendor specific
     *  parameters in the requests (e.g. {buffer: 10}).
     */
    
    /** api: config[layerParams]
     *  ``Array`` List of param names that should be taken from the layer and
     *  added to the GetFeatureInfo request (e.g. ["CQL_FILTER"]).
     */
     
    /** api: config[itemConfig]
     *  ``Object`` A configuration object overriding options for the items that
     *  get added to the popup for each server response or feature. By default,
     *  each item will be configured with the following options:
     *
     *  .. code-block:: javascript
     *
     *      xtype: "propertygrid", // only for "grid" format
     *      title: feature.fid ? feature.fid : title, // just title for "html" format
     *      source: feature.attributes, // only for "grid" format
     *      html: text, // responseText from server - only for "html" format
     */

    /** api: method[addActions]
     */
    addActions: function() {
        app.featureCache = new Array;

        var actions = gxp.plugins.WMSGetAndSetFeatureInfo.superclass.addActions.call(this, [{
            tooltip: this.infoActionTip,
            iconCls: "gxp-icon-getfeatureinfo",
            toggleGroup: this.toggleGroup,
            enableToggle: true,
            allowDepress: true,
            toggleHandler: function(button, pressed) {
                for (var i = 0, len = info.controls.length; i < len; i++){
                    if (pressed) {
                        app.featuresPanel.expand();
                        info.controls[i].activate();
                    } else {
                        app.featuresPanel.collapse();
                        info.controls[i].deactivate();
                    }
                }
             }
        }]);
        var infoButton = this.actions[0].items[0];

        var info = {controls: []};
        var updateInfo = function() {
            var queryableLayers = this.target.mapPanel.layers.queryBy(function(x){
                return x.get("queryable");
            });

            var map = this.target.mapPanel.map;
            var control;
            for (var i = 0, len = info.controls.length; i < len; i++){
                control = info.controls[i];
                control.deactivate();  // TODO: remove when http://trac.openlayers.org/ticket/2130 is closed
                control.destroy();
            }

            info.controls = [];
            queryableLayers.each(function(x){
                var layer = x.getLayer();
                var vendorParams = Ext.apply({}, this.vendorParams), param;
                if (this.layerParams) {
                    for (var i=this.layerParams.length-1; i>=0; --i) {
                        param = this.layerParams[i].toUpperCase();
                        vendorParams[param] = layer.params[param];
                    }
                }
                var infoFormat = x.get("infoFormat");
                if (infoFormat === undefined) {
                    // TODO: check if chosen format exists in infoFormats array
                    // TODO: this will not work for WMS 1.3 (text/xml instead for GML)
                    infoFormat = this.format == "html" ? "text/html" : "application/vnd.ogc.gml";
                }
                var control = new OpenLayers.Control.WMSGetFeatureInfo(Ext.applyIf({
                    url: layer.url,
                    queryVisible: true,
                    layers: [layer],
                    infoFormat: infoFormat,
                    vendorParams: vendorParams,
                    eventListeners: {
                        getfeatureinfo: function(evt) {
                            var title = x.get("title") || x.get("name");

                            var pointClicked = evt.xy.x + "." + evt.xy.y;
                            if(this.lastPointClicked != pointClicked) {
                                // If another point is clicked, then reset all results
                                app.featuresTabPanel.removeAll();
                                delete app.featureCache;				
                                this.lastPointClicked = pointClicked;
                            }

                            // Get main feature (instead of those retreive by WMS)
                            var features = evt.features;
                            if (features) {
                                var feature;
                                for (var i=0, ii=features.length; i<ii; ++i) {
                                    feature = features[i];
                                    Ext.Ajax.request({
                                        url: this.urlMainFeatures,
                                        method: 'POST',
                                        scope: this,
                                        params: { object_name :feature.gml.featureType, object_id: feature.fid,
                                                map_projection: this.target.mapPanel.map.projection.replace("EPSG:","")},
                                        success: function(response, options) {
                                        var features = eval('(' + response.responseText + ')');
                                        this.displayInfos(features, false, '', title);
                                        },
                                        failure: function(response, options) {
                                        Ext.Msg.alert('Error', 'Could not retreive feature\'s attributes.');
                                        }
                                    });
                                }
                            }

                            /*if (infoFormat == "text/html") {
                                var match = evt.text.match(/<body[^>]*>([\s\S]*)<\/body>/);
                                if (match && !match[1].match(/^\s*$/)) {
                                    this.displayInfos(evt, false, title, match[1]);
                                }
                            } else if (infoFormat == "text/plain") {
                                this.displayInfos(evt, false, '', title, '<pre>' + evt.text + '</pre>');
                            } else {
                                this.displayInfos(evt, false, '', title);
                            }*/

                            // Get associated feature if needed
                            if(this.urlAssociatedFeatures != "") {
                                var features = evt.features;
                                if (features) {
                                    var feature;
                                    for (var i=0, ii=features.length; i<ii; ++i) {
                                        feature = features[i];
                                        //var id_parent = feature.gml.featureType + feature.fid;
                                        var id_parent = feature.gml.featureType + feature.fid.replace(feature.gml.featureType+".","");
                                        Ext.Ajax.request({
                                            url: this.urlAssociatedFeatures,
                                            method: 'POST',
                                            scope: this,
                                            params: { object_name :feature.gml.featureType, object_id: feature.fid, 
                                                    map_projection: this.target.mapPanel.map.projection.replace("EPSG:","")},
                                            success: function(response, options) {
                                                var features = eval('(' + response.responseText + ')');
                                                this.displayInfos(features, true, id_parent);
                                            },
                                            failure: function(response, options) {
                                                Ext.Msg.alert('Error', 'Could not retreive associated features.');
                                            }
                                        });
                                    }
                                }
                            }
                        },
                        scope: this
                    }
                }, this.controlOptions));
                map.addControl(control);
                info.controls.push(control);
                if(infoButton.pressed) {
                    control.activate();
                }
            }, this);

        };

        this.target.mapPanel.layers.on("update", updateInfo, this);
        this.target.mapPanel.layers.on("add", updateInfo, this);
        this.target.mapPanel.layers.on("remove", updateInfo, this);

        return actions;
    },

    /** private: method[displayInfos]
     * :arg evt: the event object from a 
     *     :class:`OpenLayers.Control.GetFeatureInfo` control
     * :arg associated: indicate if we are displaying request feature, or associated features
     * :arg parentKey: for associated objects, parent id for inserting infos in the right tab
     * :arg title: a String to use for the title of the results section 
     *     reporting the info to the user
     * :arg text: ``String`` Body text.
     */
    displayInfos: function(features, associated, parentKey, title, text) {

        // Add feature attributes to cache
        if(!app.featureCache)
            app.featureCache = new Array();

        var config = [];
        if (!text && features) {
            var feature;
            for (var i=0,ii=features.length; i<ii; ++i) {
                feature = features[i];
                item = Ext.apply({
                    xtype: "propertygrid",
                    height: 150,
                    title: feature.fid ? feature.fid : title,
                    source: feature.attributes
                }, this.itemConfig);
                config.push(item);
                   
                // if associated, data grid must be inserted in the right tab
                if(associated) {
                    // Search for the good tab
                    app.featuresTabPanel.getItem(parentKey).add(item);
                    app.featuresTabPanel.doLayout();
                }

                // if main object , create a new tab in the tabPanel
                if(!associated) {
                    key = feature.table_name + feature.fid;   
                    newTab = {
                        title: key,
                        id: key,
                        layout: "accordion",
                        autoScroll:true,
                        items: [item]
                     };
                    app.featuresTabPanel.add(newTab);
                    app.featuresTabPanel.activate(key);

                    // Highlight feature
                    this.highLightFeatures(feature.geom);
                }
            }
        } else if (text) {
            config.push(Ext.apply({
                title: title,
                html: text
            }, this.itemConfig));
        }

        var attributes;
        for (var i=0,ii=features.length; i<ii; ++i) {
            feature = features[i];
            if(feature.fid) {
                var attributes = feature.attributes;
                attributes.fid = feature.fid;
                attributes.table_name = feature.table_name;
                app.featureCache.push(attributes);
            }
        }
    },
    
    /** private: method[highLightFeatures]
     * :arg geometry: the geometry to draw on an overlay layer
     */
    highLightFeatures: function(geometry) {
        if(geometry != "") {
            var map = this.target.mapPanel.map;
            // Set the layer for highlight
            var styleHighLight = new OpenLayers.StyleMap({
                "default": new OpenLayers.Style({
                    pointRadius: 6,
                    strokeColor: "#00FF00",
                    strokeWidth: 6,
                    graphicZIndex: 1
                })
            });
            highLightLayers = map.getLayersByName("highLightLayer");
            if(highLightLayers.length == 0) {
                highLightLayer = new OpenLayers.Layer.Vector("highLightLayer", {styleMap: styleHighLight});
                map.addLayer(highLightLayer);
            }
            else {
                highLightLayer = highLightLayers[0];
                highLightLayer.removeAllFeatures();
            }
    
            // Add features
            var wkt = new OpenLayers.Format.WKT();
            var wktData = geometry;
            var features = wkt.read(wktData);
            if(features) {
                if(features.constructor != Array) {
                    features = [features];
                }
                var bounds;
                for(var i = 0; i < features.length; ++i) {
                    if (!bounds) {
                        bounds = features[i].geometry.getBounds();
                    } else {
                        bounds.extend(features[i].geometry.getBounds());
                    }
                }
                highLightLayer.addFeatures(features);
            }
        }
    }

});

Ext.preg(gxp.plugins.WMSGetAndSetFeatureInfo.prototype.ptype, gxp.plugins.WMSGetAndSetFeatureInfo);