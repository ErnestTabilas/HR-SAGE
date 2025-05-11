import ee

# Initialize the Earth Engine API
ee.Initialize()

# 1. Load GEDI-Sentinel sugarcane tiles (Philippines only)
gedi_tiles = ee.ImageCollection("projects/lobell-lab/gedi_sugarcane/maps/imgColl_10m_ESAESRIGLAD") \
    .filterBounds(ee.Geometry.BBox(116.9, 4.6, 126.6, 21.3))  # Philippines

# 2. Load Sentinel-2 NDVI composite (2024)
start_date = '2024-01-01'
end_date = '2024-12-31'

s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
    .filterDate(start_date, end_date) \
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
    .map(lambda img: img.addBands(img.normalizedDifference(['B8', 'B4']).rename('NDVI')))

ndvi_composite = s2.select('NDVI').median()

# 3. Function to process each tile
def process_tile(tile_image, index):
    tile_geom = tile_image.geometry()

    n_tallmonths = tile_image.select('n_tallmonths')
    sugarcane_mask = n_tallmonths.gte(1).selfMask()  # Mask only where sugarcane is detected

    ndvi_masked = ndvi_composite.updateMask(sugarcane_mask)

    sampled_points = ndvi_masked.addBands(n_tallmonths).sample(
        region=tile_geom,
        scale=10,
        projection='EPSG:4326',
        geometries=True,
        seed=42
    )

    file_name = f"tile_{index}"

    task = ee.batch.Export.table.toDrive(
        collection=sampled_points,
        description=file_name,
        fileNamePrefix=file_name,
        fileFormat='CSV'
    )
    task.start()
    print(f"Export task started: {file_name}")

# 4. Trigger export for each tile
tile_list = gedi_tiles.toList(gedi_tiles.size())

for i in range(gedi_tiles.size().getInfo()):
    tile = ee.Image(tile_list.get(i))
    process_tile(tile, i)
