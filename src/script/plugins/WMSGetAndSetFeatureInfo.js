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

    /** private: property[popupCache]
     *  ``Object``
     */
    popupCache: null,

    /** private: property[featureCache]
     *  ``Object``
     */
    featureCache: null,

    /** api: config[infoActionTip]
     *  ``String``
     *  Text for feature info action tooltip (i18n).
     */
    infoActionTip: "Get Feature Info",

    /** api: config[popupTitle]
     *  ``String``
     *  Title for info popup (i18n).
     */
    popupTitle: "Feature Info",

    /** api: config[savefeatureText]
     *  ``String``
     *  Text for save feature (i18n).
     */
    saveFeatureText: "Save",

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
        this.popupCache = {};
        this.featureCache = new Array;

        var actions = gxp.plugins.WMSGetAndSetFeatureInfo.superclass.addActions.call(this, [{
            tooltip: this.infoActionTip,
            iconCls: "gxp-icon-getfeatureinfo",
            toggleGroup: this.toggleGroup,
            enableToggle: true,
            allowDepress: true,
            toggleHandler: function(button, pressed) {
                for (var i = 0, len = info.controls.length; i < len; i++){
                    if (pressed) {
                        info.controls[i].activate();
                    } else {
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
                            var popupKey = evt.xy.x + "." + evt.xy.y;
                            var title = x.get("title") || x.get("name");
                            if (infoFormat == "text/html") {
                                var match = evt.text.match(/<body[^>]*>([\s\S]*)<\/body>/);
                                if (match && !match[1].match(/^\s*$/)) {
                                    this.displayPopup(evt, false, popupKey, title, match[1]);
                                }
                            } else if (infoFormat == "text/plain") {
                                this.displayPopup(evt, false, popupKey, title, '<pre>' + evt.text + '</pre>');
                            } else {
                                this.displayPopup(evt, false, popupKey, title);
                            }

                            // Get associated feature if needed
                            if(this.urlAssociatedFeatures != "") {
                                var features = evt.features;
                                if (features) {
                                    var feature;
                                    for (var i=0, ii=features.length; i<ii; ++i) {
                                        feature = features[i];
                                        //feature.fid
                                        Ext.Ajax.request({
                                            url: this.urlAssociatedFeatures,
                                            method: 'POST',
                                            scope: this,
                                            params: { object_name :feature.attributes.table_name, object_id: feature.fid},
                                            success: function(response, options) {
                                                var features = eval('(' + response.responseText + ')');
                                                this.displayPopup(features, true, popupKey);
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

    /** private: method[displayPopup]
     * :arg evt: the event object from a 
     *     :class:`OpenLayers.Control.GetFeatureInfo` control
     * :arg associated: indicate if we are displaying request feature, or associated features
     * :arg popupKey: key of the popup
     * :arg title: a String to use for the title of the results section 
     *     reporting the info to the user
     * :arg text: ``String`` Body text.
     */
    displayPopup: function(evt, associated, popupKey, title, text) {

        if(!associated)
            var features = evt.features;
        else
            var features = evt;

        if(features && features.length == 0) {
            Ext.Msg.alert('Information', 'No informations to display.');
            return;
        }

        if(!associated) {
            var popup;
            //var popupKey = evt.xy.x + "." + evt.xy.y;

            if (!(popupKey in this.popupCache)) {
                popup = this.addOutput({
                    xtype: "gx_popup",
                    title: this.popupTitle,
                    layout: "accordion",
                    location: evt.xy,
                    map: this.target.mapPanel,
                    width: 350,
                    height: 400,
                    defaults: {
                        layout: "fit",
                        autoScroll: true,
                        autoWidth: true,
                        collapsible: true
                    },
                    listeners: {
                        close: (function(key) {
                            return function(panel){
                                delete this.popupCache[key];
                                delete this.featureCache;
                            };
                        })(popupKey),
                        scope: this
                    },
                    bbar: ["->", 
                        {
                            text: this.saveFeatureText,
                            iconCls: "gxp-icon-save",
                            handler: function() {
                                jsonDataEncode = Ext.util.JSON.encode(this.featureCache);
                                Ext.Ajax.request({
                                    url: this.urlWriteFeature,
                                    method: 'POST',
                                    params: { data :jsonDataEncode},
                                    success: function(response, options) {
                                        Ext.Msg.alert('Information', 'Save successful.');
                                    },
                                    failure: function(response, options) {
                                        Ext.Msg.alert('Error', 'Save failed.');
                                    }
                                });
                            },
                            scope: this
                        }]
                });
                this.popupCache[popupKey] = popup;
            } else {
                popup = this.popupCache[popupKey];
            }
        } else 
            popup = this.popupCache[popupKey];



        var config = [];
        if (!text && features) {
            var feature;
            for (var i=0,ii=features.length; i<ii; ++i) {
                feature = features[i];
                config.push(Ext.apply({
                    xtype: "propertygrid",
                    height: 100,
                    title: feature.fid ? feature.fid : title,
                    source: feature.attributes
                }, this.itemConfig));
            }
        } else if (text) {
            config.push(Ext.apply({
                title: title,
                html: text
            }, this.itemConfig));
        }

        // Add feature attributes to cache
        if(!this.featureCache)
            this.featureCache = new Array();

        var attributes;
        for (var i=0,ii=features.length; i<ii; ++i) {
            feature = features[i];
            if(feature.fid) {
                var attributes = feature.attributes;
                attributes.fid = feature.fid;
                if(!associated)
                    attributes.table_name = feature.gml.featureType;
                else
                    attributes.table_name = feature.table_name;
                this.featureCache.push(attributes);
            }
        }

        if(popup) {
            popup.add(config);
            popup.doLayout();
        }
    }

});

Ext.preg(gxp.plugins.WMSGetAndSetFeatureInfo.prototype.ptype, gxp.plugins.WMSGetAndSetFeatureInfo);
