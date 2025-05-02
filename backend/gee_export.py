import os
import ee
import google.auth
import logging
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Authenticate Earth Engine with service account
service_account_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
credentials, _ = google.auth.load_credentials_from_file(
    service_account_path,
    scopes=[
        'https://www.googleapis.com/auth/earthengine',
        'https://www.googleapis.com/auth/cloud-platform'
    ]
)
ee.Initialize(credentials)
drive_service = build('drive', 'v3', credentials=credentials)

# Load GEDI-Sentinel sugarcane dataset
collection = ee.ImageCollection('projects/lobell-lab/gedi_sugarcane/maps/imgColl_10m_ESAESRIGLAD')

# Filter to all tiles in the Philippines
ph_tiles = collection.filter(ee.Filter.eq('country', 'philippines'))

# Load Sentinel-2 surface reflectance for NDVI computation
s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
    .filterDate('2024-01-01', '2024-12-31') \
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))

def delete_old_exports(prefix):
    try:
        logging.info(f"Searching for existing files with prefix '{prefix}'...")
        query = f"name contains '{prefix}' and mimeType='text/csv'"
        response = drive_service.files().list(q=query).execute()

        files = response.get('files', [])
        if not files:
            logging.info("No matching files found.")
            return

        for f in files:
            file_id = f['id']
            file_name = f['name']
            try:
                drive_service.files().delete(fileId=file_id).execute()
                logging.info(f"Deleted file: {file_name}")
            except HttpError as del_err:
                logging.error(f"Failed to delete {file_name}: {del_err}")
    except HttpError as err:
        logging.error(f"Drive API error: {err}")

delete_old_exports("tile_")

# Function to classify growth stage
def classify_growth_stage(n_tall, ndvi):
    return ee.Algorithms.If(
        n_tall,
        ee.Algorithms.If(
            ndvi.gte(0.6).And(n_tall.gte(10)), 'Grand Growth',
            ee.Algorithms.If(
                ndvi.gte(0.5).And(n_tall.gte(6)), 'Ripening',
                ee.Algorithms.If(
                    ndvi.gte(0.4).And(n_tall.gte(3)), 'Tillering',
                    ee.Algorithms.If(
                        ndvi.gte(0.3).And(n_tall.gte(1)), 'Germination',
                        'No Sugarcane'
                    )
                )
            )
        ),
        'Unknown'
    )

# Get list of tile IDs
tile_ids = ph_tiles.aggregate_array('system:id').getInfo()

# Process each tile
for idx, tile_id in enumerate(tile_ids):
    tile_number = idx + 1
    tile_image = ee.Image(tile_id)

    # Create combined crop mask
    esa = tile_image.select('ESA').eq(1).unmask(0)
    esri = tile_image.select('ESRI').eq(1).unmask(0)
    glad = tile_image.select('GLAD').eq(1).unmask(0)
    combined_mask = esa.Or(esri).Or(glad)

    # Mask sugarcane band and add as new band
    sugarcane = tile_image.select('sugarcane').eq(1).updateMask(combined_mask)
    masked_tile = tile_image.addBands(sugarcane.rename('sugarcane_mask'))

    # Vectorize sugarcane pixels to centroids
    vectors = masked_tile.select('sugarcane_mask').selfMask().reduceToVectors(
        geometryType='centroid',
        reducer=ee.Reducer.countEvery(),
        scale=10,
        maxPixels=1e9
    )

    # Annotate each feature with properties
    def annotate_feature(feature):
        coords = feature.geometry().coordinates()
        lat = coords.get(1)
        lon = coords.get(0)

        point = feature.geometry()
        reducer = ee.Reducer.first()

        region_props = masked_tile.reduceRegion(
            reducer=reducer,
            geometry=point,
            scale=10,
            bestEffort=True
        )

        n_tall = region_props.get('n_tallmonths')

        ndvi_at_point = s2.map(lambda img: img.normalizedDifference(['B8', 'B4']).rename('NDVI')) \
            .mean() \
            .reduceRegion(
                reducer=ee.Reducer.first(),
                geometry=point,
                scale=10,
                bestEffort=True
            ).get('NDVI')

        stage = classify_growth_stage(ee.Number(n_tall), ee.Number(ndvi_at_point))

        return feature.set({
            'lat': lat,
            'lng': lon,
            'n_tallmonths': n_tall,
            'ndvi': ndvi_at_point,
            'growth_stage': stage
        })

    annotated = vectors.map(annotate_feature)

    # Export annotated features directly to Drive (no client-side getInfo)
    print(f'Starting export for tile {tile_number}...')
    task = ee.batch.Export.table.toDrive(
        collection=annotated,
        description=f'ndvi_tile_{tile_number}',
        fileNamePrefix=f'tile_{tile_number}',
        fileFormat='CSV',
        selectors=['lat', 'lng', 'n_tallmonths', 'ndvi', 'growth_stage']
    )
    task.start()
    print(f'Task started for tile {tile_number}.')
