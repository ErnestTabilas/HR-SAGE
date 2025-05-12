import ee
import time
import os
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Setup logging
logging.basicConfig(level=logging.INFO)

# Directory and service account file setup
current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
KEY_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
TARGET_FOLDER_ID = '1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK'  # your Drive folder ID

# Initialize Earth Engine using service account
SERVICE_ACCOUNT_EMAIL = 'hr-sage-service-account@ee-eltabilas.iam.gserviceaccount.com'
 
credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT_EMAIL, KEY_FILE)
ee.Initialize(credentials)


# ---- Google Drive API for file cleanup ----
def clear_existing_csv_files():
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=['https://www.googleapis.com/auth/drive'])
    service = build('drive', 'v3', credentials=creds)

    results = service.files().list(
        q=f"'{TARGET_FOLDER_ID}' in parents and mimeType='text/csv' and trashed=false",
        fields="files(id, name)"
    ).execute()

    files = results.get('files', [])
    for file in files:
        file_id = file['id']
        logging.info(f"Deleting existing file: {file['name']}")
        service.files().delete(fileId=file_id).execute()

# ---- Export Sugarcane Data ----
def export_sugarcane_csv():
    logging.info("Starting export...")

    # Load the full GEDI-Sentinel sugarcane dataset
    collection = ee.ImageCollection('projects/lobell-lab/gedi_sugarcane/maps/imgColl_10m_ESAESRIGLAD')

    # Filter for Philippines tiles
    ph_tiles = collection.filter(ee.Filter.eq('country', 'philippines'))

    # Load Sentinel-2 surface reflectance for NDVI computation
    s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
        .filterDate('2024-01-01', '2024-12-31') \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))

    # Annotate each feature with latitude, longitude, NDVI, and n_tallmonths
    def process_tile(tile_feature, index):
        tile_number = index + 1  # Start from 1
        tile_id = tile_feature['id']
        tile_image = ee.Image(tile_id)

        # Apply crop masks
        esa = tile_image.select('ESA').eq(1).unmask(0)
        esri = tile_image.select('ESRI').eq(1).unmask(0)
        glad = tile_image.select('GLAD').eq(1).unmask(0)

        # Combine the masks using `.or()` correctly
        combined_mask = esa.Or(esri).Or(glad)

        # Apply the combined mask to the sugarcane layer
        sugarcane = tile_image.select('sugarcane').eq(1).updateMask(combined_mask)
        masked_tile = tile_image.addBands(sugarcane.rename('sugarcane_mask'))

        # Convert sugarcane pixels to points
        vectors = masked_tile.select('sugarcane_mask').selfMask().reduceToVectors(
            geometryType='centroid',
            reducer=ee.Reducer.countEvery(),  # Apply countEvery reducer directly
            scale=10,
            maxPixels=1e9
        )

        # Annotate features with additional information
        annotated = vectors.map(lambda feature: annotate_feature(feature, s2, masked_tile))

        # Ensure the annotated collection has features before proceeding
        count = annotated.size()

        # Use getInfo() to evaluate the count and proceed
        count_value = count.getInfo()

        if count_value > 0:
            export_tile(annotated, count_value, tile_number)
        else:
            logging.info(f'Skipping tile {tile_number} (no sugarcane points detected).')


    # Annotate each feature with latitude, longitude, NDVI, and n_tallmonths
    def annotate_feature(feature, s2, masked_tile):
        coords = feature.geometry().coordinates()
        lat = coords.get(1)
        lon = coords.get(0)
        point = feature.geometry()

        # Extract n_tallmonths
        region_props = masked_tile.reduceRegion(
            reducer=ee.Reducer.first(),
            geometry=point,
            scale=10,
            bestEffort=True
        )
        n_tallmonths = region_props.get('n_tallmonths')

        # Fetch Sentinel-2 NDVI at the point
        ndvi_at_point = s2.map(lambda img: img.normalizedDifference(['B8', 'B4']).rename('NDVI')) \
            .mean().reduceRegion(
                reducer=ee.Reducer.first(),
                geometry=point,
                scale=10,
                bestEffort=True
            ).get('NDVI')

        return feature.set({
            'lat': lat,
            'lng': lon,
            'n_tallmonths': n_tallmonths,
            'ndvi': ndvi_at_point,
        })

    # Export tile data to Google Drive
    def export_tile(annotated, count_value, tile_number):
        # Export the annotated FeatureCollection to Google Drive
        if count_value > 0:
            # Set up the export task to export the FeatureCollection
            export_task = ee.batch.Export.table.toDrive(
                collection=annotated,
                description=f"sugarcane_export_tile_{tile_number}",
                fileFormat='CSV',
                folder='sugarcane_exports'  # Optional: specify a folder in Google Drive
            )
            
            # Start the export task
            export_task.start()
            logging.info(f"Exporting tile {tile_number} with {count_value} sugarcane points.")
            
            # Wait for the task to finish before proceeding to the next tile
            while export_task.active():
                logging.info(f"Waiting for export task of tile {tile_number} to finish...")
                time.sleep(10)  # Wait for 10 seconds before checking status again
            logging.info(f"Export task for tile {tile_number} completed.")
        else:
            logging.info(f"No features to export for tile {tile_number}.")

    # Evaluate all tiles and export them
    ph_tiles = ph_tiles.limit(5)

    ph_tiles_info = ph_tiles.getInfo()
    for index, tile in enumerate(ph_tiles_info['features']):
        tile_id = tile['id']
        process_tile(tile, index)

# ---- Main Execution ----
if __name__ == "__main__":
    # logging.info("Cleaning old files in Drive folder...") 
    # clear_existing_csv_files()

    logging.info("Running GEE export...")
    export_sugarcane_csv()
    logging.info("Export completed.")