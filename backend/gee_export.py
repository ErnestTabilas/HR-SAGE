import ee
ee.Initialize()

# 1. Load GEDI-Sentinel sugarcane tiles
tiles = ee.ImageCollection("projects/lobell-lab/gedi_sugarcane/maps/imgColl_10m_ESAESRIGLAD") \
    .filterBounds(ee.Geometry.BBox(116.9, 4.6, 126.6, 21.3))

# 2. Load Sentinel-2 NDVI composite for 2024
start = '2024-01-01'
end = '2024-12-31'

s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
    .filterDate(start, end) \
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
    .map(lambda img: img.addBands(img.normalizedDifference(['B8', 'B4']).rename('NDVI')))

ndvi_median = s2.select('NDVI').median()

# 3. Function to export a tile safely
def process_tile(tile_img, index):
    geom = tile_img.geometry()
    band_names = tile_img.bandNames()
    has_n_tallmonths = band_names.contains('n_tallmonths')

    n_tallmonths = ee.Image(ee.Algorithms.If(
        has_n_tallmonths,
        tile_img.select('n_tallmonths'),
        ee.Image.constant(0).rename('n_tallmonths').updateMask(ee.Image(0))
    ))

    sugarcane_mask = n_tallmonths.gte(1).selfMask()
    ndvi_masked = ndvi_median.updateMask(sugarcane_mask)
    combined = ndvi_masked.addBands(n_tallmonths)

    points = combined.sample(
        region=geom,
        scale=10,
        projection='EPSG:4326',
        geometries=True,
        seed=42
    )

    task = ee.batch.Export.table.toDrive(
        collection=points,
        description=f"tile_{index}",
        fileNamePrefix=f"tile_{index}",
        fileFormat='CSV'
    )
    task.start()
    print(f"Export task started for tile {index}")

# 4. Get the list of tiles and run export
tile_list = tiles.toList(tiles.size())
num_tiles = tile_list.size().getInfo()

for i in range(num_tiles):
    tile = ee.Image(tile_list.get(i))
    process_tile(tile, i)
