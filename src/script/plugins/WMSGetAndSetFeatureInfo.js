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

    /** api: config[infoActionAddTip]
     *  ``String``
     *  Text for feature add action tooltip (i18n).
     */
    addActionTip: "Add Feature",

    
    /** api: config[]
     *  ``String``
     *  Other text msgs
     */
    errorTitle: "Error",
    errorMsgRetreiveAttributes: "Could not retreive feature's attributes.",
    errorMsgRetreiveAssociatedAttributes: "Could not retreive associated features.",
    successTitle: "Success",
    successMsgGeomSaved: "Geometry saved successfuly.",
    errorMsgGeomSaved: "Could not save geometry.",
    successMsgfeatureAdded : "Feature added successfuly.",
    errorMsgfeatureAdded: "Could not add feature.",
    confirmMsgModifGeom: "Confirm the geometric modification ( ",
    confirmMsgAddGeom: "Confirm the add",

    
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
    
    /** api: config[urlModifyGeomFeatures]
     *  ``String`` URL for saving features's geometries
     */
    urlModifyGeomFeatures: "",

    
    /** api: config[controlSelect]
     *  ``Object`` OpenLayers select feature control
     */
    controlSelect: null,
    tabControlSelect: null,

        
    /** api: config[controlAdd]
     *  ``Object`` OpenLayers add feature control
     */
    controlAdd: null,

    /** api: config[lastPointClicked]
     *  ``String`` Last point clicked
     */
    lastPointClicked: "",
        
    /** api: config[highLightLayer]
     *  ``Object` Layer for highlighting and editing features
     */
    highLightLayer: null,

     /** api: config[addLayer]
     *  ``String``  Name of the layer on which we can add features
     */
    addLayerName: "",

     /** api: config[pointLayer]
     *  ``Object``  Layer on which we can draw points
     */
    pointLayer: "",

    
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

        this.tabControlSelect = {};
        
        if (app.initialConfig.tools_enabled.indexOf("view_attr") == -1)
            actionEdit = {};
        else
            actionEdit = {
                tooltip: this.infoActionTip,
                iconCls: "gxp-icon-getfeatureinfo",
                toggleGroup: this.toggleGroup,
                enableToggle: true,
                allowDepress: true,
                toggleHandler: function(button, pressed) {
                    for (currentControl in this.tabControlSelect){
                        if (pressed) {
                            app.featuresPanel.expand();
                            this.tabControlSelect[currentControl].activate();
                        } else {
                            app.featuresPanel.collapse();
                            this.tabControlSelect[currentControl].deactivate();
                        }
                    }
                },
                scope: this
            }
        if (app.initialConfig.tools_enabled.indexOf("add_feat") == -1)
            actionAdd = {};
        else
            actionAdd = {
                tooltip: this.addActionTip,
                iconCls: "gxp-icon-add" + this.addLayerName,
                toggleGroup: this.toggleGroup,
                enableToggle: true,
                allowDepress: true,
                toggleHandler: function(button, pressed) {
                    if (pressed) {
                        this.controlAdd.activate();
                    } else {
                        this.controlAdd.deactivate();
                    }
                },
                scope: this
            }
        var actions = gxp.plugins.WMSGetAndSetFeatureInfo.superclass.addActions.call(this, [actionEdit, actionAdd]);
        var infoButton = this.actions[0].items[0];
        var addButton = this.actions[1].items[0];

        var info = {controls: []};
        var updateInfo = function() {
            var queryableLayers = this.target.mapPanel.layers.queryBy(function(x){
                return x.get("queryable");
            });

            var map = this.target.mapPanel.map;
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
                    infoFormat = this.format == "html" ? "text/html" : "application/vnd.ogc.gml";
                }
                
                if(!this.tabControlSelect[layer.name]) {
                    this.tabControlSelect[layer.name] = new OpenLayers.Control.WMSGetFeatureInfo(Ext.applyIf({
                        url: layer.url,
                        queryVisible: true,
                        layers: [layer],
                        infoFormat: infoFormat,
                        vendorParams: vendorParams,
                        eventListeners: {
                            getfeatureinfo: function(evt) {
                                var title = x.get("title") || x.get("name");

                                var clearCache = false;
                                var pointClicked = evt.xy.x + "." + evt.xy.y;
                                if(this.lastPointClicked != pointClicked) {
                                    // If another point is clicked, then reset all results
                                    clearCache = true;
                                    this.lastPointClicked = pointClicked;
                                }

                                this.getFeaturesInfos(evt.features, title, clearCache);
                            },
                            scope: this
                        }
                    }, this.controlOptions));
                    map.addControl(this.tabControlSelect[layer.name]);
                }
                if(infoButton.pressed) {
                    this.tabControlSelect[layer.name].activate();
                }
            }, this);
        };

        
        var updateAdd = function() {
            var queryableLayers = this.target.mapPanel.layers.queryBy(function(x){
                return x.get("queryable");
            });

            var map = this.target.mapPanel.map;
            queryableLayers.each(function(x){
                var layer = x.getLayer();
                if(layer.name == this.addLayerName) {
                    var drawLayerName = "Drawing layer : " + this.addLayerName;
                    pointLayers = map.getLayersByName(drawLayerName);
                    if(pointLayers.length == 0) {
                        this.pointLayer = new OpenLayers.Layer.Vector(drawLayerName);
                        map.addLayer(this.pointLayer);
                    }
                    else {
                        this.pointLayer = pointLayers[0];
                        this.pointLayer.removeAllFeatures();
                    }

                    if(!this.controlAdd) {
                        this.controlAdd = new OpenLayers.Control.DrawFeature(this.pointLayer,OpenLayers.Handler.Point);
                    
                        this.pointLayer.events.on({
                                "beforefeatureadded": function(event) {
                                    this.controlAdd.deactivate();
                                },
                                "featureadded": this.endAddFeature,
                                scope: this
                        });
    
                        map.addControl(this.controlAdd);
                    }
                    if(addButton.pressed)
                        this.controlAdd.activate();
                    else
                        this.controlAdd.deactivate();
                }
                    
            }, this);

        };

        this.target.mapPanel.layers.on("update", updateInfo, this);
        this.target.mapPanel.layers.on("add", updateInfo, this);
        this.target.mapPanel.layers.on("remove", updateInfo, this);

        this.target.mapPanel.layers.on("update", updateAdd, this);
        this.target.mapPanel.layers.on("add", updateAdd, this);
        this.target.mapPanel.layers.on("remove", updateAdd, this);

        return actions;
    },

    
    
    /** private: method[getFeaturesInfos]
     * :arg features: the features
     * :arg title: a String to use for the title of the results section 
     * :arg clearCache: Flag for cleaning cache or not
     */
    getFeaturesInfos: function(features, title, clearCache) {

        if(clearCache) {
            app.featuresTabPanel.removeAll();
            delete app.featureCache;
        }
        
        var map = this.target.mapPanel.map;
        // Get main feature (instead of those retreive by WMS)
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
                        Ext.Msg.alert(this.errorTitle, this.errorMsgRetreiveAttributes);
                    }
                });
            }
        }
        
        if(features && features.length == 0) {
            // Remove all on highLightLayer
            highLightLayers = map.getLayersByName("highLightLayer");
            if(highLightLayers.length != 0) {
                this.highLightLayer = highLightLayers[0];
                this.highLightLayer.removeAllFeatures();
            }
        }

        // Get associated feature if needed
        if(this.urlAssociatedFeatures != "") {
            if (features) {
                var feature;
                for (var i=0, ii=features.length; i<ii; ++i) {
                    feature = features[i];
                    var id_parent = feature.gml.featureType + feature.fid.replace(feature.gml.featureType+".","");
                    Ext.Ajax.request({
                        url: this.urlAssociatedFeatures,
                        method: 'POST',
                        scope: this,
                        params: { object_name :feature.gml.featureType, object_id: feature.fid, 
                                map_projection: this.target.mapPanel.map.projection.replace("EPSG:","")},
                        success: function(response, options) {
                            var features = eval('(' + response.responseText + ')');
                            
                            local_id_parent  = "tab_" + options.params.object_id.replace(".","");
                            this.displayInfos(features, true, local_id_parent);
                        },
                        failure: function(response, options) {
                            Ext.Msg.alert(this.errorTitle, this.errorMsgRetreiveAssociatedAttributes);
                        }
                    });
                }
            }
        }
    },
    
    /** private: method[displayInfos]
     * :arg features: the features
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
                // Set the style for editable / no editable fields
                var customRendererFields = new Object();
                for(var attribute in feature.attributes) {
                    var fieldValue = feature.attributes[attribute];
                    customRendererFields[attribute] = function(v){
                            return '<div class="non_editable_field">'+ v +'</div>';
                        };
                    for(var j = 0 ; j < feature.attributes_editable.length ; j++) {
                        if(feature.attributes_editable[j] == attribute) {
                            customRendererFields[attribute] = function(v){
                                    return '<div class="editable_field">'+ v +'</div>';
                                };
                        }
                    }
                }
                var className = "feature-item";
                if(associated) {
                    if(feature.sub_level == 2)
                        className = "feature-subitem-lvl1"
                    if(feature.sub_level > 2)
                        className = "feature-subitem-lvl2"
                }
                
                item = new Ext.grid.PropertyGrid(
                    {
                        xtype: "propertygrid",
                        height: 250,
                        cls: className,
                        title: feature.fid ? feature.fid : title,
                        customRenderers: customRendererFields,
                        id: feature.table_name + feature.fid,
                        collapsible:true,
                        titleCollapse: true
                    }
                );
                delete item.getStore().sortInfo; // Remove default sorting
                item.getColumnModel().getColumnById('name').sortable = false; // set sorting of first column to false
                item.setSource(feature.attributes); // Now load data

                config.push(item);

                // if associated, data grid must be inserted in the right tab
                // And in the right sub-accordion
                if(associated) {
                    // Search for the good tab
                    if(feature.sub_level == 1) {
                        app.featuresTabPanel.getItem(parentKey).add(item);
                        app.featuresTabPanel.doLayout();
                    }
                    else {
                        // Search for the good accordion, and add the subitem (for subitem level > 1)
                        var parentComponent = Ext.getCmp(feature.parent);
                        var indexParent = parentComponent.ownerCt.items.indexOf(parentComponent);
                        app.featuresTabPanel.getItem(parentKey).insert(indexParent + 1, item);
                        app.featuresTabPanel.doLayout();
                    }
                }

                // if main object , create a new tab in the tabPanel
                if(!associated) {
                    key = "tab_" + feature.table_name + feature.fid;   
                    newTab = {
                        title: feature.table_label,
                        id: key,
                        cls: 'attributes',
                        layout: "accordion",
                        autoScroll:true,
                        items: [item]
                     };
                    app.featuresTabPanel.add(newTab);
                    app.featuresTabPanel.activate(key);

                    // Highlight feature
                    this.highLightFeatures(feature.geom, feature.table_name, feature.fid);
                }
            }
        } else if (text) {
            config.push(Ext.apply({
                title: title,
                html: text
            }, this.itemConfig));
        }

        // Store the attributes for all objects
        var attributes;
        for (var i=0,ii=features.length; i<ii; ++i) {
            feature = features[i];
            if(feature.fid) {
                var attributes = feature.attributes;
                attributes.fid = feature.fid;
                attributes.table_name = feature.table_name;
                // Add the geometry (useful to check the zone rights)
                // But the geometry won't be saved in this process
                attributes.geom = feature.geom;
                app.featureCache.push(attributes);
            }
        }
    },
    
    /** private: method[highLightFeatures]
     * :arg geometry: the geometry to draw on an overlay layer
     * :arg table_name: type of feature
     * :arg id: id of the feature
     */
    highLightFeatures: function(geometry, table_name, id) {
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
                this.highLightLayer = new OpenLayers.Layer.Vector("highLightLayer", {styleMap: styleHighLight});
                map.addLayer(this.highLightLayer);
            }
            else {
                this.highLightLayer = highLightLayers[0];
                this.highLightLayer.removeAllFeatures();
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
                    features[i].attributes.id = id;
                    features[i].attributes.table_name = table_name;
                }
                this.highLightLayer.addFeatures(features);
            }
            
            if (app.initialConfig.tools_enabled.indexOf("edit_geom") != -1) {
                modifyCtrl = new OpenLayers.Control.ModifyFeature(this.highLightLayer)
                map.addControl(modifyCtrl);
                modifyCtrl.activate();
                
                this.highLightLayer.events.on({
                        "beforefeaturemodified": function(event) {
                            // Deactivate select control to prevent from deselecting feature
                            for (currentControl in this.tabControlSelect){
                                this.tabControlSelect[currentControl].deactivate();
                            }
                        },
                        "afterfeaturemodified": this.endEditFeature,
                        scope: this
                });
            }
        }
    },

    /** private: method[endEditFeature]
     * :arg event: infos on feature edited
     */    
    endEditFeature : function(event) {
        var wkt = event.feature.geometry.toString();

        var featureTab = new Array;
        var attributes = {'geom' : wkt};
        attributes.fid = event.feature.attributes.id;
        attributes.table_name = event.feature.attributes.table_name;
        featureTab.push(attributes);

        jsonDataEncode = Ext.util.JSON.encode(featureTab);
        var msg = this.confirmMsgModifGeom + event.feature.attributes.table_name + " [ "+ event.feature.attributes.id + " ] )";
        Ext.Msg.show({
            title:'Confirmation',
            msg: msg,
            buttons: Ext.Msg.YESNO,
            scope: this,
            fn: function(btn) {
                if(btn == "yes" || btn == "oui") {
                    Ext.Ajax.request({
                        url: this.urlModifyGeomFeatures,
                        method: 'POST',
                        scope: this,
                        params: { object_name :event.feature.attributes.table_name, object_id: event.feature.attributes.id, 
                                  data: jsonDataEncode, source: app.user, map_projection: this.target.mapPanel.map.projection.replace("EPSG:","")
                        },
                        success: function(response, options) {
                            var modifiedOk = true;
                            if(response.responseText) {
                                status = eval('(' + response.responseText + ')');
                                if(status.records[0].status == false) {
                                    Ext.Msg.alert('Information', status.records[0].msg);
                                    modifiedOk = false;
                                }
                            }
                            
                            if(modifiedOk) {
                                Ext.Msg.alert(this.successTitle, this.successMsgGeomSaved);
                                // Refresh layers
                                for(i = 0; i < this.target.mapPanel.map.layers.length ; i++) {
                                    currentLayer = this.target.mapPanel.map.layers[i];
                                    if(!currentLayer.isBaseLayer && currentLayer.visibility)
                                        currentLayer.redraw(true);
                                }
                                
                                // TODO : edit attributes immediatly
                            }
                        },
                        failure: function(response, options) {
                            Ext.Msg.alert(this.errorTitle, this.errorMsgGeomSaved);
                        }
                    });
                }
            }
        });
        // Reactivate select control
        for (currentControl in this.tabControlSelect){
            this.tabControlSelect[currentControl].activate();
        }


    },
    
     /** private: method[endAddFeature]
     * :arg event: processed when feature has been added
     */    
    endAddFeature : function(event) {
        var wkt = event.feature.geometry.toString();

        var featureTab = new Array;
        var attributes = {'geom' : wkt};
        attributes.table_name = this.addLayerName;
        attributes.user_name = app.user;
        featureTab.push(attributes);

        jsonDataEncode = Ext.util.JSON.encode(featureTab);
        //var msg = "Confirm the add";
        Ext.Msg.show({
            title: this.addActionTip,
            msg: this.confirmMsgAddGeom,
            buttons: Ext.Msg.YESNO,
            scope: this,
            fn: function(btn) {
                if(btn == "yes" || btn == "oui") {
                    Ext.Ajax.request({
                        url: this.urlAddGeomFeatures,
                        method: 'POST',
                        scope: this,
                        params: { object_name : this.addLayerName, source: app.user, map_projection: this.target.mapPanel.map.projection.replace("EPSG:",""),
                            data: jsonDataEncode
                        },
                        success: function(response, options) {
                            var modifiedOk = true;
                            if(response.responseText) {
                                status = eval('(' + response.responseText + ')');
                                if(status.records[0].status == false) {
                                    Ext.Msg.alert('Information', status.records[0].msg);
                                    modifiedOk = false;
                                }
                            }
                            
                            if(modifiedOk) {
                                Ext.Msg.alert(this.successTitle, this.successMsgfeatureAdded);
                                // Refresh layers
                                for(i = 0; i < this.target.mapPanel.map.layers.length ; i++) {
                                    currentLayer = this.target.mapPanel.map.layers[i];
                                    if(!currentLayer.isBaseLayer && currentLayer.visibility)
                                        currentLayer.redraw(true);
                                }
                            }
                        },
                        failure: function(response, options) {
                            Ext.Msg.alert(this.errorTitle, this.errorMsgfeatureAdded);
                        }
                    });
                }
                this.pointLayer.removeAllFeatures();
            }
        });
        // Reactivate add control
        this.controlAdd.activate();   
    }   

});

Ext.preg(gxp.plugins.WMSGetAndSetFeatureInfo.prototype.ptype, gxp.plugins.WMSGetAndSetFeatureInfo);
