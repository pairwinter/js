/* Copyright (c) 2006-2013 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the 2-clause BSD license.
 * See license.txt in the OpenLayers distribution or repository for the
 * full text of the license. */


/**
 * @requires OpenLayers/Handler/Point.js
 * @requires OpenLayers/Geometry/Point.js
 * @requires OpenLayers/Geometry/LineString.js
 */

/**
 * Class: OpenLayers.Handler.Path
 * Handler to draw a path on the map.  Path is displayed on mouse down,
 * moves on mouse move, and is finished on mouse up.
 *
 * Inherits from:
 *  - <OpenLayers.Handler.Point>
 */
OpenLayers.Handler.Paintbrush = OpenLayers.Class(OpenLayers.Handler.Point, {

    /**
     * Property: line
     * {<OpenLayers.Feature.Vector>}
     */
    line: null,
    radius : 2,
    wipe:false,
    /**
     * APIProperty: maxVertices
     * {Number} The maximum number of vertices which can be drawn by this
     * handler. When the number of vertices reaches maxVertices, the
     * geometry is automatically finalized. Default is null.
     */
    maxVertices: null,

    /**
     * Property: doubleTouchTolerance
     * {Number} Maximum number of pixels between two touches for
     *     the gesture to be considered a "finalize feature" action.
     *     Default is 20.
     */
    doubleTouchTolerance: 20,

    /**
     * Property: freehand
     * {Boolean} In freehand mode, the handler starts the path on mouse down,
     * adds a point for every mouse move, and finishes the path on mouse up.
     * Outside of freehand mode, a point is added to the path on every mouse
     * click and double-click finishes the path.
     */
    freehand: false,

    /**
     * Property: freehandToggle
     * {String} If set, freehandToggle is checked on mouse events and will set
     * the freehand mode to the opposite of this.freehand.  To disallow
     * toggling between freehand and non-freehand mode, set freehandToggle to
     * null.  Acceptable toggle values are 'shiftKey', 'ctrlKey', and 'altKey'.
     */
    freehandToggle: 'shiftKey',

    /**
     * Property: timerId
     * {Integer} The timer used to test the double touch.
     */
    timerId: null,

    /**
     * Property: redoStack
     * {Array} Stack containing points removed with <undo>.
     */
    redoStack: null,

    /**
     * Constructor: OpenLayers.Handler.Path
     * Create a new path hander
     *
     * Parameters:
     * control - {<OpenLayers.Control>} The control that owns this handler
     * callbacks - {Object} An object with a properties whose values are
     *     functions.  Various callbacks described below.
     * options - {Object} An optional object with properties to be set on the
     *           handler
     *
     * Named callbacks:
     * create - Called when a sketch is first created.  Callback called with
     *     the creation point geometry and sketch feature.
     * modify - Called with each move of a vertex with the vertex (point)
     *     geometry and the sketch feature.
     * point - Called as each point is added.  Receives the new point geometry.
     * done - Called when the point drawing is finished.  The callback will
     *     recieve a single argument, the linestring geometry.
     * cancel - Called when the handler is deactivated while drawing.  The
     *     cancel callback will receive a geometry.
     */

    /**
     * Method: createFeature
     * Add temporary geometries
     *
     * Parameters:
     * pixel - {<OpenLayers.Pixel>} The initial pixel location for the new
     *     feature.
     */
    createFeature: function(pixel) {
        var lonlat = this.layer.getLonLatFromViewPortPx(pixel);
        var geometry = new OpenLayers.Geometry.Point(
            lonlat.lon, lonlat.lat
        );
        this.point = new OpenLayers.Feature.Vector(geometry);
        this.circle =null;
        this.line = new OpenLayers.Feature.Vector(
            new OpenLayers.Geometry.LineString([this.point.geometry])
        );
        this.upPoints=[];
        this.downPoints = [];
        this.callback("create", [this.point.geometry, this.getSketch()]);
        this.point.geometry.clearBounds();
        this.layer.addFeatures([this.line, this.point], {silent: true});
    },

    /**
     * Method: destroyFeature
     * Destroy temporary geometries
     *
     * Parameters:
     * force - {Boolean} Destroy even if persist is true.
     */
    destroyFeature: function(force) {
        OpenLayers.Handler.Point.prototype.destroyFeature.call(
            this, force);
        this.line = null;
        this.circle = null;
    },

    /**
     * Method: destroyPersistedFeature
     * Destroy the persisted feature.
     */
    destroyPersistedFeature: function() {
        var layer = this.layer;
        if(layer && layer.features.length > 2) {
            this.layer.features[0].destroy();
        }
    },

    /**
     * Method: removePoint
     * Destroy the temporary point.
     */
    removePoint: function() {
        if(this.point) {
            this.layer.removeFeatures([this.point]);
        }
    },

    /**
     * Method: addPoint
     * Add point to geometry.  Send the point index to override
     * the behavior of LinearRing that disregards adding duplicate points.
     *
     * Parameters:
     * pixel - {<OpenLayers.Pixel>} The pixel location for the new point.
     */
    addPoint: function(pixel) {
        this.layer.removeFeatures([this.point]);
        var lonlat = this.layer.getLonLatFromViewPortPx(pixel);
        this.point = new OpenLayers.Feature.Vector(
            new OpenLayers.Geometry.Point(lonlat.lon, lonlat.lat)
        );
        this.line.geometry.addComponent(
            this.point.geometry, this.line.geometry.components.length
        );
//        this._usePathAndCircle(lonlat);
        this._buffer(this.line.geometry,10);
        this.layer.addFeatures([this.point]);
        this.callback("point", [this.point.geometry, this.getGeometry()]);
        this.callback("modify", [this.point.geometry, this.getSketch()]);
        this.drawFeature();
        delete this.redoStack;
    },

    _buffer:function(jsts_geomA,radius){
        if(this.circle){
            this.layer.removeFeatures([this.circle]);
        }
        radius = radius*this.layer.map.resolution;
        var olFromJsts = this.olFromJsts = this.olFromJsts || new jsts.io.OpenLayersParser();
        jsts_geomA = olFromJsts.read(jsts_geomA.clone());
        var jsts_result_geom = jsts_geomA.buffer(radius);
        jsts_result_geom   = olFromJsts.write(jsts_result_geom);
        this.circle = new OpenLayers.Feature.Vector(jsts_result_geom);
    },

    _usePathAndCircle:function(lonlat){
        if(this.circle){
            this.layer.removeFeatures([this.circle]);
        }
        var radius = this.radius, zoom = this.layer.map.getZoom() || 1;
        radius = this.radius/zoom;
        radius = 10*this.layer.map.resolution;
        var wings = this.countCurrentPointAndPreviousPointWings(radius);
        var circleFeature = this._createCircleFeature(lonlat,radius);
        if(!wings){
            this.circle = circleFeature;
        }else{
            var points = [wings.currentPointWings.up,wings.previousPointWings.up,wings.previousPointWings.down,wings.currentPointWings.down,wings.currentPointWings.up];
            var pointsFeature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Polygon([ new OpenLayers.Geometry.LinearRing(points)]));
            this.circle = this._merge([pointsFeature,circleFeature,this.circle]);
        }
    },
    _createCircleFeature:function(lonlat,radius){
        var circleFeature;
        var circle= OpenLayers.Geometry.Polygon.createRegularPolygon(new OpenLayers.Geometry.Point(lonlat.lon,lonlat.lat),radius,40,0);
        circleFeature = new OpenLayers.Feature.Vector(circle);
        return circleFeature;
    },

    _merge: function(polygonFeatures) {
        var jstsFromWkt = this.jstsFromWkt = this.jstsFromWkt || new jsts.io.WKTReader();
        var wktFromOl = this.wktFromOl = this.wktFromOl || new OpenLayers.Format.WKT();
        var olFromJsts = this.olFromJsts = this.olFromJsts || new jsts.io.OpenLayersParser();
        var union = false;
        var attributes = {};
        for(var i = 0; i < polygonFeatures.length; i++) {
            if(!union) {
                union = jstsFromWkt.read(wktFromOl.write(polygonFeatures[i]));
                attributes = polygonFeatures[i].attributes;
            } else {
                var polygon = jstsFromWkt.read(wktFromOl.write(polygonFeatures[i]));
                union = union.union(polygon);
                for(var key in polygonFeatures[i].attributes) {
                    if (!attributes[key]) { // test if element has attribute - take from first geometry
                        attributes[key] = polygonFeatures[i].attributes[key];
                    }
                }
            }
        }
        var feature = new OpenLayers.Feature.Vector(olFromJsts.write(union));
        feature.state = OpenLayers.State.INSERT;
        feature.attributes = attributes;
        this.layer.removeFeatures(polygonFeatures);
        return feature;
    },
    _disjoint:function(beDisjointedFeature,usedFeature){
        var jstsFromWkt = this.jstsFromWkt = this.jstsFromWkt || new jsts.io.WKTReader();
        var wktFromOl = this.wktFromOl = this.wktFromOl || new OpenLayers.Format.WKT();
        var olFromJsts = this.olFromJsts = this.olFromJsts || new jsts.io.OpenLayersParser();
        var beDisjointedPolygon = jstsFromWkt.read(wktFromOl.write(beDisjointedFeature));
        var usedPolygon = jstsFromWkt.read(wktFromOl.write(usedFeature));
        var result = beDisjointedPolygon.disjoint(usedPolygon);
        var feature = new OpenLayers.Feature.Vector(olFromJsts.write(result));
        feature.state = OpenLayers.State.Update;
        this.layer.removeFeatures([beDisjointedFeature,usedFeature]);
        return feature;
    },

    /**
     * Method: insertXY
     * Insert a point in the current sketch given x & y coordinates.  The new
     *     point is inserted immediately before the most recently drawn point.
     *
     * Parameters:
     * x - {Number} The x-coordinate of the point.
     * y - {Number} The y-coordinate of the point.
     */
    insertXY: function(x, y) {
        if(!this.points){
            this.points=[];
        }
        var point = new OpenLayers.Geometry.Point(x, y);
      return point;
    },

    /**
     * Method: insertDeltaXY
     * Insert a point given offsets from the previously inserted point.
     *
     * Parameters:
     * dx - {Number} The x-coordinate offset of the point.
     * dy - {Number} The y-coordinate offset of the point.
     */
    insertDeltaXY: function(dx, dy, pi) {
        var previousIndex = pi || this.getCurrentPointIndex() - 1;
        var p0 = this.line.geometry.components[previousIndex];
        if (p0 && !isNaN(p0.x) && !isNaN(p0.y)) {
            return this.insertXY(p0.x + dx, p0.y + dy);
        }
    },


    /**
     * Method: insertDirectionLength
     * Insert a point in the current sketch given a direction and a length.
     *
     * Parameters:
     * direction - {Number} Degrees clockwise from the positive x-axis.
     * length - {Number} Distance from the previously drawn point.
     */
    insertDirectionLength: function(direction, length, pi) {
        direction *= Math.PI / 180;
        var dx = length * Math.cos(direction);
        var dy = length * Math.sin(direction);
        return this.insertDeltaXY(dx, dy, pi);
    },

    /**
     * Method: insertDeflectionLength
     * Insert a point in the current sketch given a deflection and a length.
     *     The deflection should be degrees clockwise from the previously
     *     digitized segment.
     *
     * Parameters:
     * deflection - {Number} Degrees clockwise from the previous segment.
     * length - {Number} Distance from the previously drawn point.
     */
    insertDeflectionLength: function(deflection, length) {
        var previousIndex = this.getCurrentPointIndex() - 1;
        if (previousIndex > 0) {
            var p1 = this.line.geometry.components[previousIndex];
            var p0 = this.line.geometry.components[previousIndex-1];
            var theta = Math.atan2(p1.y - p0.y, p1.x - p0.x);
            this.insertDirectionLength(
                (theta * 180 / Math.PI) + deflection, length
            );
        }
    },
    countCurrentPointAndPreviousPointWings : function(length){
        var currentIndex =  this.getCurrentPointIndex()
        var previousIndex = currentIndex - 1;
        if (previousIndex > 0) {
            var wings = {currentPointWings:null,previousPointWings :null};
            var currentPoint = this.line.geometry.components[currentIndex];
            var previousPoint = this.line.geometry.components[previousIndex-1];
            var theta = Math.atan2(currentPoint.y - previousPoint.y, currentPoint.x - previousPoint.x);
            var direction = (theta * 180 / Math.PI);
            //count the wingPoings of current point
            wings.currentPointWings = {p:currentPoint},wings.previousPointWings = {p:previousPoint};
            wings.currentPointWings.up = this.insertDirectionLength( direction+90, length,currentIndex);
            wings.currentPointWings.down = this.insertDirectionLength( direction-90, length,currentIndex);
            wings.previousPointWings.up = this.insertDirectionLength( direction+90, length,previousIndex);
            wings.previousPointWings.down = this.insertDirectionLength( direction-90, length,previousIndex);
            return  wings;
        }
        return null;
    },
    /**
     * Method: getCurrentPointIndex
     *
     * Returns:
     * {Number} The index of the most recently drawn point.
     */
    getCurrentPointIndex: function() {
        return this.line.geometry.components.length - 1;
    },


    /**
     * Method: undo
     * Remove the most recently added point in the sketch geometry.
     *
     * Returns:
     * {Boolean} A point was removed.
     */
    undo: function() {
        var geometry = this.line.geometry;
        var components = geometry.components;
        var index = this.getCurrentPointIndex() - 1;
        var target = components[index];
        var undone = geometry.removeComponent(target);
        if (undone) {
            // On touch devices, set the current ("mouse location") point to
            // match the last digitized point.
            if (this.touch && index > 0) {
                components = geometry.components; // safety
                var lastpt = components[index - 1];
                var curptidx = this.getCurrentPointIndex();
                var curpt = components[curptidx];
                curpt.x = lastpt.x;
                curpt.y = lastpt.y;
            }
            if (!this.redoStack) {
                this.redoStack = [];
            }
            this.redoStack.push(target);
            this.drawFeature();
        }
        return undone;
    },

    /**
     * Method: redo
     * Reinsert the most recently removed point resulting from an <undo> call.
     *     The undo stack is deleted whenever a point is added by other means.
     *
     * Returns:
     * {Boolean} A point was added.
     */
    redo: function() {
        var target = this.redoStack && this.redoStack.pop();
        if (target) {
            this.line.geometry.addComponent(target, this.getCurrentPointIndex());
            this.drawFeature();
        }
        return !!target;
    },

    /**
     * Method: freehandMode
     * Determine whether to behave in freehand mode or not.
     *
     * Returns:
     * {Boolean}
     */
    freehandMode: function(evt) {
        return (this.freehandToggle && evt[this.freehandToggle]) ?
            !this.freehand : this.freehand;
    },

    /**
     * Method: modifyFeature
     * Modify the existing geometry given the new point
     *
     * Parameters:
     * pixel - {<OpenLayers.Pixel>} The updated pixel location for the latest
     *     point.
     * drawing - {Boolean} Indicate if we're currently drawing.
     */
    modifyFeature: function(pixel, drawing) {
        if(!this.line) {
            this.createFeature(pixel);
        }
        var lonlat = this.layer.getLonLatFromViewPortPx(pixel);
        this.point.geometry.x = lonlat.lon;
        this.point.geometry.y = lonlat.lat;
        this.callback("modify", [this.point.geometry, this.getSketch(), drawing]);
        this.point.geometry.clearBounds();
        this.drawFeature();
    },

    /**
     * Method: drawFeature
     * Render geometries on the temporary layer.
     */
    drawFeature: function() {
//        this.layer.drawFeature(this.line, this.style);
        this.layer.drawFeature(this.point, this.style);
        this.circle && this.layer.drawFeature(this.circle, this.style);
    },

    /**
     * Method: getSketch
     * Return the sketch feature.
     *
     * Returns:
     * {<OpenLayers.Feature.Vector>}
     */
    getSketch: function() {
//        return this.line;
        return this.circle;
    },

    /**
     * Method: getGeometry
     * Return the sketch geometry.  If <multi> is true, this will return
     *     a multi-part geometry.
     *
     * Returns:
     * {<OpenLayers.Geometry.LineString>}
     */
    getGeometry: function() {
        var geometry = this.circle && this.circle.geometry;
        if(geometry && this.multi) {
            geometry = new OpenLayers.Geometry.MultiPolygon([geometry]);
        }
        return geometry;
    },

    /**
     * method: touchstart
     * handle touchstart.
     *
     * parameters:
     * evt - {event} the browser event
     *
     * returns:
     * {boolean} allow event propagation
     */
    touchstart: function(evt) {
        if (this.timerId &&
            this.passesTolerance(this.lastTouchPx, evt.xy,
                this.doubleTouchTolerance)) {
            // double-tap, finalize the geometry
            this.finishGeometry();
            window.clearTimeout(this.timerId);
            this.timerId = null;
            return false;
        } else {
            if (this.timerId) {
                window.clearTimeout(this.timerId);
                this.timerId = null;
            }
            this.timerId = window.setTimeout(
                OpenLayers.Function.bind(function() {
                    this.timerId = null;
                }, this), 300);
            return OpenLayers.Handler.Point.prototype.touchstart.call(this, evt);
        }
    },

    /**
     * Method: down
     * Handle mousedown and touchstart.  Add a new point to the geometry and
     * render it. Return determines whether to propagate the event on the map.
     *
     * Parameters:
     * evt - {Event} The browser event
     *
     * Returns:
     * {Boolean} Allow event propagation
     */
    down: function(evt) {
        var stopDown = this.stopDown;
        if(this.freehandMode(evt)) {
            stopDown = true;
            if (this.touch) {
                this.modifyFeature(evt.xy, !!this.lastUp);
                OpenLayers.Event.stop(evt);
            }
        }
        if (!this.touch && (!this.lastDown ||
            !this.passesTolerance(this.lastDown, evt.xy,
                this.pixelTolerance))) {
            this.modifyFeature(evt.xy, !!this.lastUp);
        }
        this.mouseDown = true;
        this.lastDown = evt.xy;
        this.stoppedDown = stopDown;
        return !stopDown;
    },

    /**
     * Method: move
     * Handle mousemove and touchmove.  Adjust the geometry and redraw.
     * Return determines whether to propagate the event on the map.
     *
     * Parameters:
     * evt - {Event} The browser event
     *
     * Returns:
     * {Boolean} Allow event propagation
     */
    move: function (evt) {
        if(this.stoppedDown && this.freehandMode(evt)) {
            if(this.persist) {
                this.destroyPersistedFeature();
            }
            if(this.maxVertices && this.line &&
                this.line.geometry.components.length === this.maxVertices) {
                this.removePoint();
                this.finalize();
            } else {
                this.addPoint(evt.xy);
            }
            return false;
        }
        if (!this.touch && (!this.mouseDown || this.stoppedDown)) {
            this.modifyFeature(evt.xy, !!this.lastUp);
        }
        return true;
    },

    /**
     * Method: up
     * Handle mouseup and touchend.  Send the latest point in the geometry to
     * the control. Return determines whether to propagate the event on the map.
     *
     * Parameters:
     * evt - {Event} The browser event
     *
     * Returns:
     * {Boolean} Allow event propagation
     */
    up: function (evt) {
        if (this.mouseDown && (!this.lastUp || !this.lastUp.equals(evt.xy))) {
            if(this.stoppedDown && this.freehandMode(evt)) {
                if (this.persist) {
                    this.destroyPersistedFeature();
                }
                this.removePoint();
                this.finalize();
            } else {
                if (this.passesTolerance(this.lastDown, evt.xy,
                    this.pixelTolerance)) {
                    if (this.touch) {
                        this.modifyFeature(evt.xy);
                    }
                    if(this.lastUp == null && this.persist) {
                        this.destroyPersistedFeature();
                    }
                    this.addPoint(evt.xy);
                    this.lastUp = evt.xy;
                    if(this.line.geometry.components.length === this.maxVertices + 1) {
                        this.finishGeometry();
                    }
                }
            }
        }
        this.stoppedDown = this.stopDown;
        this.mouseDown = false;
        return !this.stopUp;
    },

    /**
     * APIMethod: finishGeometry
     * Finish the geometry and send it back to the control.
     */
    finishGeometry: function() {
        var index = this.line.geometry.components.length - 1;
        this.line.geometry.removeComponent(this.line.geometry.components[index]);
        this.removePoint();
        this.finalize();
    },

    /**
     * Method: dblclick
     * Handle double-clicks.
     *
     * Parameters:
     * evt - {Event} The browser event
     *
     * Returns:
     * {Boolean} Allow event propagation
     */
    dblclick: function(evt) {
        if(!this.freehandMode(evt)) {
            this.finishGeometry();
        }
        return false;
    },

    CLASS_NAME: "OpenLayers.Handler.Paintbrush"
});
