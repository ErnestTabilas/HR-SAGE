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
from skimage.filters.rank import entropy
from skimage.morphology import disk
from scipy.ndimage import generic_gradient_magnitude, sobel

# Setup
logging.basicConfig(level=logging.DEBUG)
app = Flask(__name__)
CORS(app)

# Paths
current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')

# Google Drive API
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
FOLDER_ID = "1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK" 
credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build("drive", "v3", credentials=credentials)

def classify_growth_stage(ndvi_value):
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

def list_geotiff_file_ids():
    """List all GeoTIFF file IDs in the Drive folder."""
    try:
        results = drive_service.files().list(
            q=f"'{FOLDER_ID}' in parents and mimeType='image/tiff'",
            fields="files(id, name)",
            pageSize=1000
        ).execute()
        files = results.get("files", [])
        logging.info(f"Found {len(files)} GeoTIFFs in folder.")
        return [file["id"] for file in files]
    except Exception as e:
        logging.error(f"Error listing files in Drive folder: {str(e)}")
        return []

def download_geotiff_from_drive(file_id):
    """Downloads a GeoTIFF file from Google Drive."""
    try:
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            logging.debug("Download %d%%.", int(status.progress() * 100))
        fh.seek(0)
        return fh
    except Exception as e:
        logging.error(f"Failed to download GeoTIFF {file_id}: {str(e)}")
        return None

@app.route('/ndvi-data', methods=['GET'])
def get_ndvi_data():
    try:
        file_ids = list_geotiff_file_ids()
        file_data_list = [download_geotiff_from_drive(fid) for fid in file_ids if fid]
        file_data_list = [f for f in file_data_list if f]

        if not file_data_list:
            return jsonify({"error": "GeoTIFF download failed"}), 500

        datasets = [rasterio.open(f) for f in file_data_list]
        mosaic, transform = merge(datasets)

        min_lon, min_lat = rasterio.transform.xy(transform, 0, 0)
        max_lon, max_lat = rasterio.transform.xy(transform, mosaic.shape[1]-1, mosaic.shape[0]-1)

        return jsonify({
            "min_lon": min_lon,
            "min_lat": min_lat,
            "max_lon": max_lon,
            "max_lat": max_lat
        })

    except Exception as e:
        logging.error(f"/ndvi-data error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/sugarcane-locations", methods=["GET"])
def get_sugarcane_locations():
    try:
        file_ids = list_geotiff_file_ids()
        file_data_list = [download_geotiff_from_drive(fid) for fid in file_ids if fid]
        file_data_list = [f for f in file_data_list if f]

        if not file_data_list:
            return jsonify({"error": "GeoTIFF download failed"}), 500

        datasets = [rasterio.open(f) for f in file_data_list]
        mosaic, transform = merge(datasets)

        raster_data = mosaic[0]
        sugarcane_mask = (raster_data > 0.1) & (raster_data <= 1.0)

        logging.info("Applying entropy filtering...")
        ndvi_scaled = ((raster_data - np.nanmin(raster_data)) / (np.nanmax(raster_data) - np.nanmin(raster_data)) * 255).astype(np.uint8)
        entropy_filtered = entropy(ndvi_scaled, disk(2))
        entropy_mask = entropy_filtered > 2.0

        logging.info("Applying slope filtering...")
        slope_mask = generic_gradient_magnitude(raster_data, sobel) < 20

        combined_mask = sugarcane_mask & entropy_mask & slope_mask

        sugarcane_locations = []
        for row in range(combined_mask.shape[0]):
            for col in range(combined_mask.shape[1]):
                if combined_mask[row, col]:
                    lon, lat = transform * (col, row)
                    ndvi_value = raster_data[row, col]
                    stage, color = classify_growth_stage(ndvi_value)
                    sugarcane_locations.append({
                        "lat": lat,
                        "lng": lon,
                        "stage": stage,
                        "color": color
                    })

        logging.info(f"Returning {len(sugarcane_locations)} sugarcane points.")
        return jsonify(sugarcane_locations)

    except Exception as e:
        logging.error(f"/sugarcane-locations error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
