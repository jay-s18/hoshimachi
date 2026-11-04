// =====================================================================
// Hoshimachi — manual Earth Engine export (Code Editor)
// The automated equivalent is export.py in this folder; both produce the same files.
//
// 1. Set YEARS below (e.g. just the new year for a yearly update).
// 2. Paste into https://code.earthengine.google.com and click Run.
// 3. Open the "Tasks" tab and click RUN on each task.
// 4. Download the files from Google Drive folder "hoshimachi" into pipeline/data/raw/.
//    For a VIIRS refresh, also write viirs_japan_30s.json there: {"firstYear": 2014, "lastYear": <printed below>}.
// =====================================================================

var YEARS = [2025];          // one cloud export per year: era5_nights_<YEAR>.tif
var EXPORT_VIIRS = true;     // refresh the night-light composite as well
var folder = 'hoshimachi';

// Grid aligned to ERA5's native 0.25° cells (pixel centres on multiples of 0.25°)
var W = 122.375, N = 46.125, E = 146.375, S = 23.875;
var region = ee.Geometry.Rectangle([W, S, E, N], null, false);
var eraTransform  = [0.25, 0, W, 0, -0.25, N];
var viirsTransform = [1 / 120, 0, W, 0, -1 / 120, N];   // 30 arc-seconds ≈ 0.9 km

// ---------------------------------------------------------------------
// A) Night lights (VIIRS annual, Colorado School of Mines EOG)
//    rad_latest = latest annual average radiance (nW/cm2/sr), background zeroed
//    rad_slope  = linear trend since 2014 (nW/cm2/sr per year)
// ---------------------------------------------------------------------
var v21 = ee.ImageCollection('NOAA/VIIRS/DNB/ANNUAL_V21').filterDate('2014-01-01', '2022-01-01');
var v22 = ee.ImageCollection('NOAA/VIIRS/DNB/ANNUAL_V22').filterDate('2022-01-01', '2100-01-01');
var viirs = v21.merge(v22).select('average_masked').sort('system:time_start');

print('VIIRS years:', viirs.aggregate_array('system:time_start')
  .map(function (t) { return ee.Date(t).get('year'); }));

var latest = ee.Image(viirs.sort('system:time_start', false).first()).rename('rad_latest');
var slope = viirs.map(function (img) {
  var yr = ee.Number(ee.Date(img.get('system:time_start')).get('year')).subtract(2014);
  return ee.Image.constant(yr).float().rename('t').addBands(img.rename('rad').float());
}).reduce(ee.Reducer.linearFit()).select('scale').rename('rad_slope');

if (EXPORT_VIIRS) Export.image.toDrive({
  image: latest.addBands(slope).toFloat(),
  description: 'viirs_japan_30s',
  folder: folder,
  region: region,
  crs: 'EPSG:4326',
  crsTransform: viirsTransform,
  maxPixels: 1e10,
  formatOptions: {cloudOptimized: true}
});

// ---------------------------------------------------------------------
// B) Night-by-night cloud history (ERA5 hourly total cloud cover)
//    One band per night, named dYYYYMMDD = the EVENING date in Japan.
//    UTC hours 09..20 of date D  =  18:00 JST on D  ->  05:00 JST on D+1.
//    Each band is a 12-bit mask: bit k set  <=>  hour (18+k) JST had cloud < 25%.
//    One export per calendar year; the pipeline merges any number of them.
// ---------------------------------------------------------------------
var era = ee.ImageCollection('ECMWF/ERA5/HOURLY')
  .select('total_cloud_cover')
  .filter(ee.Filter.calendarRange(9, 20, 'hour'));

function nightlyMasks(startStr, endStr) {
  var start = ee.Date(startStr);
  var nDays = ee.Date(endStr).difference(start, 'day');
  var days = ee.List.sequence(0, nDays.subtract(1));
  var eraRange = era.filterDate(startStr, endStr);

  var imgs = days.map(function (d) {
    var day = start.advance(d, 'day');
    var hours = eraRange.filterDate(day, day.advance(1, 'day'));
    var bits = hours.map(function (img) {
      var h = ee.Number(ee.Date(img.get('system:time_start')).get('hour'));
      var w = ee.Number(2).pow(h.subtract(9));
      return img.lt(0.25).multiply(w).rename('m').toUint16();
    }).sum();
    return ee.Image(bits).rename('m').toUint16();
  });

  var names = days.map(function (d) {
    return ee.String('d').cat(start.advance(d, 'day').format('YYYYMMdd'));
  });

  return ee.ImageCollection.fromImages(imgs).toBands().rename(names);
}

YEARS.forEach(function (y) {
  Export.image.toDrive({
    image: nightlyMasks(y + '-01-01', (y + 1) + '-01-01'),
    description: 'era5_nights_' + y,
    folder: folder,
    region: region,
    crs: 'EPSG:4326',
    crsTransform: eraTransform,
    maxPixels: 1e10
  });
});

// Quick look in the map panel
Map.centerObject(region, 5);
Map.addLayer(latest, {min: 0, max: 30, palette: ['000000', '3b0f70', 'fe9f6d', 'fcfdbf']}, 'Night lights');
