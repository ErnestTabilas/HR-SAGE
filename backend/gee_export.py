import ee
ee.Initialize()

def make_grid(region, scale):
    lonlat = ee.Image.pixelLonLat().reproject('EPSG:4326', None, scale)
    lon_grid = lonlat.select('longitude').divide(scale / 111320).floor()
    lat_grid = lonlat.select('latitude').divide(scale / 110540).floor()
    grid = lon_grid.multiply(1e5).add(lat_grid).toInt64().rename('grid_id')
    return grid.reduceToVectors(
        geometry=region,
        geometryType='polygon',
        scale=scale,
        geometryInNativeProjection=False,
        maxPixels=1e8
    )

start = '2024-01-01'
end = '2024-12-31'

tiles = ee.ImageCollection("projects/lobell-lab/gedi_sugarcane/maps/imgColl_10m_ESAESRIGLAD") \
    .filterBounds(ee.Geometry.BBox(116.9, 4.6, 126.6, 21.3))

s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
    .filterDate(start, end) \
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
    .map(lambda img: img.addBands(img.normalizedDifference(['B8', 'B4']).rename('NDVI')))

ndvi_median = s2.select('NDVI').median()

def process_tile(tile, index):
    geom = tile.geometry()
    band_names = tile.bandNames()
    has_ntm = band_names.contains('n_tallmonths')

    n_tallmonths = ee.Image(ee.Algorithms.If(
        has_ntm,
        tile.select('n_tallmonths'),
        ee.Image.constant(0).rename('n_tallmonths').updateMask(ee.Image(0))
    ))

    sugar_mask = n_tallmonths.gte(1).selfMask()
    ndvi_masked = ndvi_median.updateMask(sugar_mask)
    combined = ndvi_masked.addBands(n_tallmonths)

    grids = make_grid(geom, 1000)  # 1km sub-grids

    grid_list = grids.toList(grids.size())
    num_grids = grid_list.size().getInfo()

    for i in range(num_grids):
        region = ee.Feature(grid_list.get(i)).geometry()
        sample = combined.sample(
            region=region,
            scale=10,
            projection='EPSG:4326',
            geometries=True,
            seed=i,
            dropNulls=True
        ).limit(1000)

        task = ee.batch.Export.table.toDrive(
            collection=sample,
            description=f"tile_{index}_grid_{i}",
            fileNamePrefix=f"tile_{index}_grid_{i}",
            folder='HR-SAGE Data', 
            fileFormat='CSV'
        )
        task.start()
        print(f"Started export for tile {index} grid {i}")

tile_list = tiles.toList(tiles.size())
num_tiles = tile_list.size().getInfo()

for i in range(num_tiles):
    tile = ee.Image(tile_list.get(i))
    process_tile(tile, i)
