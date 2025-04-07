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

# Set up basic logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)

# Get the current working directory (where app.py is located)
current_dir = os.path.dirname(os.path.abspath(__file__))

# Google Drive API setup
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Google Drive File ID of the GeoTIFF
GEO_TIFF_FILE_ID = '1FXInxzim5gjfpmv4mVWY4X63FCqZ20_E'  # Replace with your actual file ID

# Authenticate using the service account
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)

def download_geotiff_from_drive():
    """Downloads the GeoTIFF file from Google Drive and returns it as a BytesIO object."""
    try:
        request = drive_service.files().get_media(fileId=GEO_TIFF_FILE_ID)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
            logging.debug("Download %d%%.", int(status.progress() * 100))
        fh.seek(0)  # Reset the pointer to the start of the file
        logging.info("GeoTIFF file downloaded successfully from Google Drive.")
        return fh
    except Exception as e:
        logging.error("Failed to download GeoTIFF: %s", str(e))
        return None

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

@app.route('/ndvi-data', methods=['GET'])
def get_ndvi_data():
    try:
        logging.debug("Fetching GeoTIFF file from Google Drive")
        file_data = download_geotiff_from_drive()
        if not file_data:
            return jsonify({"error": "GeoTIFF download failed"}), 500
        
        # Open the GeoTIFF file from the in-memory BytesIO object
        with rasterio.open(file_data) as src:
            logging.debug("GeoTIFF file opened successfully.")
            
            # Get image bounds (min and max lat/lon)
            bounds = src.bounds
            min_lon, min_lat, max_lon, max_lat = bounds

            # Return the bounds to the frontend for map adjustment
            return jsonify({
                "min_lon": min_lon,
                "min_lat": min_lat,
                "max_lon": max_lon,
                "max_lat": max_lat
            })

    except Exception as e:
        logging.error("Error in /ndvi-data endpoint: %s", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/sugarcane-locations", methods=["GET"])
def get_sugarcane_locations():
    try:
        logging.debug("Fetching GeoTIFF file from Google Drive")
        file_data = download_geotiff_from_drive()
        if not file_data:
            return jsonify({"error": "GeoTIFF download failed"}), 500
        
        # Open the GeoTIFF file from the in-memory BytesIO object
        with rasterio.open(file_data) as src:
            logging.debug("GeoTIFF file opened successfully.")
            
            # Read the raster data into a numpy array
            raster_data = src.read(1)  # Read the first band (assuming it's a single-band raster)
            transform = src.transform

            # Ignore roads, rivers, and other non-cropland areas by applying a cropland NDVI threshold
            sugarcane_mask = (raster_data > 0.1)  # Ignore NDVI values lower than 0.1 (non-cropland)
            sugarcane_mask &= (raster_data <= 1.0)  # Ensure valid NDVI values (NDVI max is 1.0)

            # Extract the coordinates of the detected sugarcane locations
            sugarcane_locations = []
            for row in range(sugarcane_mask.shape[0]):
                for col in range(sugarcane_mask.shape[1]):
                    if sugarcane_mask[row, col]:
                        # Convert pixel coordinates (row, col) to geographical coordinates
                        lon, lat = transform * (col, row)
                        
                        # Get the NDVI value at this pixel
                        ndvi_value = raster_data[row, col]
                        
                        # Classify the sugarcane based on NDVI value
                        stage, color = classify_growth_stage(ndvi_value)
                        
                        # Append location with classification and color
                        sugarcane_locations.append({
                            "lat": lat,
                            "lng": lon,
                            "stage": stage,
                            "color": color
                        })

            logging.debug("Found %d sugarcane locations.", len(sugarcane_locations))
            return jsonify(sugarcane_locations)

    except Exception as e:
        logging.error("Error in /sugarcane-locations endpoint: %s", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
