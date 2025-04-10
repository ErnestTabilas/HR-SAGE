import os
import logging
import io
import rasterio
import numpy as np
from flask import Flask, jsonify
from flask_cors import CORS
from googleapiclient.discovery import build
from google.oauth2 import service_account
from googleapiclient.http import MediaIoBaseDownload
from rasterio.merge import merge

# Set up basic logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)

# Get the current working directory (where app.py is located)
current_dir = os.path.dirname(os.path.abspath(__file__))

# Google Drive API setup
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

GEO_TIFF_FILE_IDS = [
    '1ZDiGhVDMdBSXpCotp4SE7JdHL-t7AU2',
	# '1PIF9403xplypmkUeA2ggn2APBZJQ9RRj',
	# '13jV1svFsjbx1RyBLkQ9N2Wpy5i2xNgEH',
	# '1tDmHBWlljP4nlxbzdNFn4H7MdyoFutGw',
	'19j2vmYYMF5DA0ek2zL54Z2FAczQ4T3XP',
	# '1y-blbykzzViV1oX9PLdOR_OF6qomsG4b',
	# '1iA2Z6rS61AqMZJdeIBXF6KmKHAeD4rGZ',
	# '1l1KuSJEGb8d9huIZGFbHFWwgqqvrmVaB',
	# '1BJrbi_wtt64PYoYaDy4SPIJQWxLfNDpb'
]

# Authenticate using the service account
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)

def classify_growth_stage(ndvi_value):
    """Classify the growth stage based on NDVI value."""
    if ndvi_value >= 0.5:
        return "Grand Growth", "yellow"
    elif ndvi_value >= 0.3:
        return "Ripening", "green"
    elif ndvi_value >= 0.2:
        return "Tillering", "orange"
    elif ndvi_value >= 0.1:
        return "Germination", "red"
    else:
        return "No Sugarcane", "gray"
    
def download_geotiff_from_drive(file_id):
    """Downloads the GeoTIFF file from Google Drive and returns it as a BytesIO object."""
    try:
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
            logging.debug("Download %d%%.", int(status.progress() * 100))
        fh.seek(0)  # Reset the pointer to the start of the file
        logging.info(f"GeoTIFF file with ID {file_id} downloaded successfully from Google Drive.")
        return fh
    except Exception as e:
        logging.error(f"Failed to download GeoTIFF with ID {file_id}: {str(e)}")
        return None

@app.route('/ndvi-data', methods=['GET'])
def get_ndvi_data():
    try:
        logging.debug("Fetching GeoTIFF files from Google Drive")
        file_data_list = []
        for file_id in GEO_TIFF_FILE_IDS:
            file_data = download_geotiff_from_drive(file_id)
            if file_data:
                file_data_list.append(file_data)
        
        if not file_data_list:
            return jsonify({"error": "GeoTIFF download failed"}), 500
        
        # Merge multiple GeoTIFFs into one if needed
        datasets = []
        for file_data in file_data_list:
            try:
                dataset = rasterio.open(file_data)
                datasets.append(dataset)
            except Exception as e:
                logging.error(f"Failed to open GeoTIFF file: {str(e)}")
        
        if not datasets:
            return jsonify({"error": "Failed to open GeoTIFF files"}), 500

        mosaic, transform = merge(datasets)
        
        # Get image bounds (min and max lat/lon) from the merged raster
        min_lon, min_lat = rasterio.transform.xy(transform, 0, 0)
        max_lon, max_lat = rasterio.transform.xy(transform, mosaic.shape[1]-1, mosaic.shape[0]-1)

        return jsonify({
            "min_lon": min_lon,
            "min_lat": min_lat,
            "max_lon": max_lon,
            "max_lat": max_lat
        })

    except Exception as e:
        logging.error(f"Error in /ndvi-data endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/sugarcane-locations", methods=["GET"])
def get_sugarcane_locations():
    try:
        logging.debug("Fetching GeoTIFF files from Google Drive")
        file_data_list = []
        for file_id in GEO_TIFF_FILE_IDS:
            file_data = download_geotiff_from_drive(file_id)
            if file_data:
                file_data_list.append(file_data)
        
        if not file_data_list:
            return jsonify({"error": "GeoTIFF download failed"}), 500

        datasets = []
        for file_data in file_data_list:
            try:
                dataset = rasterio.open(file_data)
                datasets.append(dataset)
            except Exception as e:
                logging.error(f"Failed to open GeoTIFF file: {str(e)}")
        
        if not datasets:
            return jsonify({"error": "Failed to open GeoTIFF files"}), 500

        mosaic, transform = merge(datasets)

        # Read the merged raster data into a numpy array
        raster_data = mosaic[0]  # Assuming it's a single-band raster
        sugarcane_mask = (raster_data > 0.1) & (raster_data <= 1.0)  # Mask for sugarcane

        sugarcane_locations = []
        for row in range(sugarcane_mask.shape[0]):
            for col in range(sugarcane_mask.shape[1]):
                if sugarcane_mask[row, col]:
                    lon, lat = transform * (col, row)
                    ndvi_value = raster_data[row, col]
                    stage, color = classify_growth_stage(ndvi_value)
                    
                    sugarcane_locations.append({
                        "lat": lat,
                        "lng": lon,
                        "stage": stage,
                        "color": color
                    })

        logging.debug(f"Found {len(sugarcane_locations)} sugarcane locations.")
        return jsonify(sugarcane_locations)

    except Exception as e:
        logging.error(f"Error in /sugarcane-locations endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
