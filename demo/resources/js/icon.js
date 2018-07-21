

var markers = {};
var vectorSource = new ol.source.Vector({
    features: []
});

var vectorLayer = new ol.layer.Vector({
    source: vectorSource
});

var rasterLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'offlineMapTiles/{z}/{x}/{y}.png'
    })
});

//var center = ol.proj.transform([116.40389818452346,39.909371751328266], 'EPSG:4326', 'EPSG:3857');
var bounds = [12887791.086150054,4896979.403361443,13005351.235652654,4824364.2264905255];
var map = new ol.Map({
    // maxExtent: new OpenLayers.Bounds(0, 0, 4096, 4096),
    renderer: exampleNS.getRendererFromQueryString(),
    layers: [rasterLayer, vectorLayer],
    target: document.getElementById('map'),

    // projection: ol.proj.get('EPSG:3857'),
    view: new ol.View({
        center: [12957312.415865747,4852678.849354724],
        zoom: 16,
        minZoom: 10,
        maxZoom: 16
    })
});
map.getView().fitExtent(bounds, map.getSize());  
var element = document.getElementById('popup');

var popup = new ol.Overlay({
    element: element,
    positioning: 'bottom-center',
    stopEvent: false
});
map.addOverlay(popup);

// display popup on click
map.on('click', function (evt) {
    var feature = map.forEachFeatureAtPixel(evt.pixel,
        function (feature, layer) {
            return feature;
        });
    if (feature) {
        var geometry = feature.getGeometry();
        var coord = geometry.getCoordinates();
        popup.setPosition(coord);
        $(element).popover({
            'placement': 'top',
            'html': true,
            'content': feature.get('name')
        });
        $(element).popover('show');
    } else {
        $(element).popover('destroy');
        var lonlat = map.getCoordinateFromPixel(evt.pixel);
        $('#lnglat').val(lonlat);
        var lonlat1 = ol.proj.transform(lonlat, 'EPSG:900913', 'EPSG:4326');//WGS-84
        lonlat1 = GPS.gcj_encrypt(lonlat1[1], lonlat1[0]);
        $('#lnglat1').val(lonlat1.lon + ',' + lonlat1.lat);

        // var xxx = ol.proj.transform(lonlat, 'EPSG:900913', 'EPSG:4326');
        // var yyy = GPS.mercator_encrypt(xxx[1], xxx[0]);
        // $('#lnglat').val(yyy.lon + ',' + yyy.lat);
    }
});

// change mouse cursor when over marker
map.on('pointermove', function (e) {
    if (e.dragging) {
        $(element).popover('destroy');
        return;
    }
    var pixel = map.getEventPixel(e.originalEvent);
    var hit = map.hasFeatureAtPixel(pixel);
    map.getTarget().style.cursor = hit ? 'pointer' : '';
});



function buildMarker(lnglat, icon) {
    //ol.proj.transform(lnglat, 'EPSG:900913', 'EPSG:4326')
    // var lbs = x-0.0143,y+0.014
    // lnglat[0] = lnglat[0] -0.0143;
    // lnglat[1] = lnglat[1] - 0.014;
    var iconFeature = new ol.Feature({
        //geometry: new ol.geom.Point([39.93148, 116.391333]),//ol.proj.transform(lnglat, 'EPSG:4326', 'EPSG:3857')
        geometry: new ol.geom.Point(lnglat),
        name: 'Infowindow 实例',
        population: 4000,
        rainfall: 500
    });

    var iconStyle = new ol.style.Style({
        image: new ol.style.Icon(/** @type {olx.style.IconOptions} */({
            anchor: [0.5, 20],
            anchorXUnits: 'fraction',
            anchorYUnits: 'pixels',
            opacity: 0.75,
            src: './resources/image/' + icon + '.png'
        }))
    });

    iconFeature.setStyle(iconStyle);
    return iconFeature;
}

function getlnglat() {
    var lnglat = $('#lnglat').val();
    var arr = lnglat.split(',');
    return [parseFloat(arr[0]), parseFloat(arr[1])];
}

function addMarker(name) {
    var iconFeature = buildMarker(getlnglat(), name);
    markers[name] = iconFeature;
    vectorSource.addFeature(iconFeature);
    if ('icon' == name) {
        $('#bt1').attr("disabled", "false");
        $("#bt2").removeAttr("disabled");
    } else if ('fire_extinguisher') {
        $('#bt3').attr("disabled", "false");
        $("#bt4").removeAttr("disabled");
    } else {
        $('#bt5').attr("disabled", "false");
        $("#bt6").removeAttr("disabled");
    }
}

function removeMarker(name) {
    if (markers[name]) {
        vectorSource.removeFeature(markers[name]);
        if ('icon' == name) {
            $("#bt1").removeAttr("disabled");
            $('#bt2').attr("disabled", "false");
        } else if ('fire_extinguisher') {
            $("#bt3").removeAttr("disabled");
            $('#bt4').attr("disabled", "false");
        } else {
            $("#bt5").removeAttr("disabled");
            $('#bt6').attr("disabled", "false");
        }
    }
}


var GPS = {
    PI: 3.14159265358979324,
    x_pi: 3.14159265358979324 * 3000.0 / 180.0,
    delta: function (lat, lon) {
        // Krasovsky 1940
        //
        // a = 6378245.0, 1/f = 298.3
        // b = a * (1 - f)
        // ee = (a^2 - b^2) / a^2;
        var a = 6378245.0; //  a: 卫星椭球坐标投影到平面地图坐标系的投影因子。
        var ee = 0.00669342162296594323; //  ee: 椭球的偏心率。
        var dLat = this.transformLat(lon - 105.0, lat - 35.0);
        var dLon = this.transformLon(lon - 105.0, lat - 35.0);
        var radLat = lat / 180.0 * this.PI;
        var magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;
        var sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * this.PI);
        dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * this.PI);
        return { 'lat': dLat, 'lon': dLon };
    },

    //WGS-84 to GCJ-02
    gcj_encrypt: function (wgsLat, wgsLon) {
        if (this.outOfChina(wgsLat, wgsLon))
            return { 'lat': wgsLat, 'lon': wgsLon };

        var d = this.delta(wgsLat, wgsLon);
        return { 'lat': wgsLat + d.lat, 'lon': wgsLon + d.lon };
    },
    //GCJ-02 to WGS-84
    gcj_decrypt: function (gcjLat, gcjLon) {
        if (this.outOfChina(gcjLat, gcjLon))
            return { 'lat': gcjLat, 'lon': gcjLon };

        var d = this.delta(gcjLat, gcjLon);
        return { 'lat': gcjLat - d.lat, 'lon': gcjLon - d.lon };
    },
    //GCJ-02 to WGS-84 exactly
    gcj_decrypt_exact: function (gcjLat, gcjLon) {
        var initDelta = 0.01;
        var threshold = 0.000000001;
        var dLat = initDelta, dLon = initDelta;
        var mLat = gcjLat - dLat, mLon = gcjLon - dLon;
        var pLat = gcjLat + dLat, pLon = gcjLon + dLon;
        var wgsLat, wgsLon, i = 0;
        while (1) {
            wgsLat = (mLat + pLat) / 2;
            wgsLon = (mLon + pLon) / 2;
            var tmp = this.gcj_encrypt(wgsLat, wgsLon)
            dLat = tmp.lat - gcjLat;
            dLon = tmp.lon - gcjLon;
            if ((Math.abs(dLat) < threshold) && (Math.abs(dLon) < threshold))
                break;

            if (dLat > 0) pLat = wgsLat; else mLat = wgsLat;
            if (dLon > 0) pLon = wgsLon; else mLon = wgsLon;

            if (++i > 10000) break;
        }
        //console.log(i);
        return { 'lat': wgsLat, 'lon': wgsLon };
    },
    //GCJ-02 to BD-09
    bd_encrypt: function (gcjLat, gcjLon) {
        var x = gcjLon, y = gcjLat;
        var z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * this.x_pi);
        var theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * this.x_pi);
        bdLon = z * Math.cos(theta) + 0.0065;
        bdLat = z * Math.sin(theta) + 0.006;
        return { 'lat': bdLat, 'lon': bdLon };
    },
    //BD-09 to GCJ-02
    bd_decrypt: function (bdLat, bdLon) {
        var x = bdLon - 0.0065, y = bdLat - 0.006;
        var z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * this.x_pi);
        var theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * this.x_pi);
        var gcjLon = z * Math.cos(theta);
        var gcjLat = z * Math.sin(theta);
        return { 'lat': gcjLat, 'lon': gcjLon };
    },
    //WGS-84 to Web mercator
    //mercatorLat -> y mercatorLon -> x
    mercator_encrypt: function (wgsLat, wgsLon) {
        var x = wgsLon * 20037508.34 / 180.;
        var y = Math.log(Math.tan((90. + wgsLat) * this.PI / 360.)) / (this.PI / 180.);
        y = y * 20037508.34 / 180.;
        return { 'lat': y, 'lon': x };
        /*
        if ((Math.abs(wgsLon) > 180 || Math.abs(wgsLat) > 90))
        return null;
        var x = 6378137.0 * wgsLon * 0.017453292519943295;
        var a = wgsLat * 0.017453292519943295;
        var y = 3189068.5 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
        return {'lat' : y, 'lon' : x};
        //*/
    },
    // Web mercator to WGS-84
    // mercatorLat -> y mercatorLon -> x
    mercator_decrypt: function (mercatorLat, mercatorLon) {
        var x = mercatorLon / 20037508.34 * 180.;
        var y = mercatorLat / 20037508.34 * 180.;
        y = 180 / this.PI * (2 * Math.atan(Math.exp(y * this.PI / 180.)) - this.PI / 2);
        return { 'lat': y, 'lon': x };
        /*
        if (Math.abs(mercatorLon) < 180 && Math.abs(mercatorLat) < 90)
        return null;
        if ((Math.abs(mercatorLon) > 20037508.3427892) || (Math.abs(mercatorLat) > 20037508.3427892))
        return null;
        var a = mercatorLon / 6378137.0 * 57.295779513082323;
        var x = a - (Math.floor(((a + 180.0) / 360.0)) * 360.0);
        var y = (1.5707963267948966 - (2.0 * Math.atan(Math.exp((-1.0 * mercatorLat) / 6378137.0)))) * 57.295779513082323;
        return {'lat' : y, 'lon' : x};
        //*/
    },
    // two point's distance
    distance: function (latA, lonA, latB, lonB) {
        var earthR = 6371000.;
        var x = Math.cos(latA * this.PI / 180.) * Math.cos(latB * this.PI / 180.) * Math.cos((lonA - lonB) * this.PI / 180);
        var y = Math.sin(latA * this.PI / 180.) * Math.sin(latB * this.PI / 180.);
        var s = x + y;
        if (s > 1) s = 1;
        if (s < -1) s = -1;
        var alpha = Math.acos(s);
        var distance = alpha * earthR;
        return distance;
    },
    outOfChina: function (lat, lon) {
        if (lon < 72.004 || lon > 137.8347)
            return true;
        if (lat < 0.8293 || lat > 55.8271)
            return true;
        return false;
    },
    transformLat: function (x, y) {
        var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * this.PI) + 40.0 * Math.sin(y / 3.0 * this.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * this.PI) + 320 * Math.sin(y * this.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    },
    transformLon: function (x, y) {
        var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * this.PI) + 40.0 * Math.sin(x / 3.0 * this.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * this.PI) + 300.0 * Math.sin(x / 30.0 * this.PI)) * 2.0 / 3.0;
        return ret;
    }
};