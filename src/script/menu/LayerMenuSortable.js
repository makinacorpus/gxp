/**
 * Copyright (c) 2008-2011 The Open Planning Project
 * 
 * Published under the GPL license.
 * See https://github.com/opengeo/gxp/raw/master/license.txt for the full text
 * of the license.
 */

/** api: (define)
 *  module = gxp.menu
 *  class = LayerMenuSortable
 *  base_link = `Ext.menu.Menu <http://extjs.com/deploy/dev/docs/?class=Ext.menu.Menu>`_
 */
Ext.namespace("gxp.menu");

/** api: constructor
 *  .. class:: LayerMenuSortable(config)
 *
 *    A menu to control layer visibility.
 */   
gxp.menu.LayerMenuSortable = Ext.extend(Ext.menu.Menu, {
    
    /** api: config[layerText]
     *  ``String``
     *  Text for added layer (i18n).
     */
    layerText: "Layer",
    
    /** api: config[layers]
     *  ``GeoExt.data.LayerStore``
     *  The store containing layer records to be viewed in this menu.
     */
    layers: null,
    
    /** api: config[map]
     *  ``OpenLayers map object``
     */
    map: null,
    
    
    /** 
     *  Translation strings
     */
    upText: "Up",
    downText: "Down",
    
    
    /** private: method[initComponent]
     *  Private method called to initialize the component.
     */
    initComponent: function() {
        gxp.menu.LayerMenuSortable.superclass.initComponent.apply(this, arguments);
        this.layers.on("add", this.onLayerAdd, this);
        this.onLayerAdd();
    },

    /** private: method[onRender]
     *  Private method called during the render sequence.
     */
    onRender : function(ct, position) {
        gxp.menu.LayerMenuSortable.superclass.onRender.apply(this, arguments);
    },

    /** private: method[beforeDestroy]
     *  Private method called during the destroy sequence.
     */
    beforeDestroy: function() {
        if (this.layers && this.layers.on) {
            this.layers.un("add", this.onLayerAdd, this);
        }
        delete this.layers;
        gxp.menu.LayerMenuSortable.superclass.beforeDestroy.apply(this, arguments);
    },
    
    /** private: method[onLayerAdd]
     *  Listener called when records are added to the layer store.
     */
    onLayerAdd: function() {
        this.removeAll();
        // this.getEl().addClass("gxp-layer-menu");
        // this.getEl().applyStyles({
        //     width: '',
        //     height: ''
        // });
        this.add(
            {
                iconCls: "gxp-layer-visibility",
                text: this.layerText,
                canActivate: false
            },
            "-"
        );
        this.layers.each(function(record) {
            var layer = record.getLayer();
            if(layer.displayInLayerSwitcher) {
                //
                var subMenu = new Ext.menu.Menu({
                    id: 'sort_menu_' + record.get("title"),
                    items: [
                        new Ext.menu.Item({
                            text: this.upText,
                            handler: this.levelUp,
                            scope: this
                        }),
                        new Ext.menu.Item({
                            text: this.downText,
                            handler: this.levelDown,
                            scope: this
                        })
                    ]
                });
                //
                var item = new Ext.menu.CheckItem({
                    text: record.get("title"),
                    checked: record.getLayer().getVisibility(),
                    group: record.get("group"),
                    menu: subMenu,
                    listeners: {
                        checkchange: function(item, checked) {
                            record.getLayer().setVisibility(checked);
                        }
                    }
                });
                if (this.items.getCount() > 2) {
                    this.insert(2, item);
                } else {
                    this.add(item);
                }
            }
        }, this);    
        this.activeItem = 0;
    },

    /** private: method[levelUp]
     *  Listener called when a up action is clicked on a submenu item
     */
    levelUp: function(item, e) {
        // Move up the menu item
        var activeItem = item.parentMenu.parentMenu.activeItem;
        for(i = 2 ; i < this.items.length ; i++) {
            var currentItem = this.items.get(i);
            if(currentItem == activeItem) {
                if(i > 2) {
                    // Move up the layer
                    this.moveLayerUpDown(activeItem.text, 1);
                }
                break;
            }
        }
    },

    /** private: method[levelUp]
     *  Listener called when a down action is clicked on a submenu item
     */
    levelDown: function(item, e) {
        // Move down the menu item
        var activeItem = item.parentMenu.parentMenu.activeItem;
        for(i = 2 ; i < this.items.length ; i++) {
            var currentItem = this.items.get(i);
            if(currentItem == activeItem) {
                if(i < this.items.length) {
                    // Move down the layer
                    this.moveLayerUpDown(activeItem.text, -1);
                }
                break;
            }
        }
    },

    /** private: method[moveLayerUpDown]
     *  Move a layer up or down called when a down action is clicked on a submenu item
     */
    moveLayerUpDown: function(layerName, upDown) {
        currentLayers = this.map.getLayersByName(layerName);
        if(currentLayers.length > 0) {
            this.map.raiseLayer(currentLayers[0], upDown);
        }
    }

});

Ext.reg('gxp_layermenusortable', gxp.menu.LayerMenuSortable);
