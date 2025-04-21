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

# Set up basic logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)

# Paths
current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')

# Google Drive API setup
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
GEO_TIFF_FILE_IDS = [
    '1xmXw1clBj5MdNfW9iFX5x9w9mvZxRJDc', # Region 0
    '1TxEly6CEG6GRXt3z8bh-wslyl98AmyQh', # Region 1
    '1Y3dMrRX2uxN_MvkzvpQXxsy0cpdv-Ek5', # Region 2
    '11Ecy5TGYPd5ouP7Bmbb-pB2iS7dYG-zN', # Region 3
    '1BexjvZoUKlfZHDQcLRV47rfZsEN-CxMY', # Region 4
    '1EPHJdxHxzxWgFlZ1RvzWlOk7KvRmM7ae', # Region 5
    '1a-nrWiZam65NQCU9DugnlL22ovxlMybn', # Region 6
    '1RT-jUSv-gq6fDwP-KkkUVc-nVwrU7l6J', # Region 7
    '188YkSm9U3lZncgNz3a9HVxVfeJrzHJVX', # Region 8
    '1uIrsbt9eG-S4B9P4kohx1NgjjXbDRkr1', # Region 9
    '1N6kpNL37jZIs2wHw559lKaUsNNLL0GVT', # Region 10
    '125TiTyAC2FaiuZv9qvylBasQk75GaU1J', # Region 11
    '1iNpYUNFiOQkFNDX5834xPtx9CZWgpxOw', # Region 12
    '1nhKks0z_lkzFhnYesZZhAbgXMMYU8-iG', # Region 13
    '12xJ9ECic8r5u5XOEABVCJz74f6g1p_mw' # Region 14

]

# Authenticate
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

def download_geotiff_from_drive(file_id):
    try:
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            logging.debug("Download %d%%.", int(status.progress() * 100))
        fh.seek(0)
        logging.info(f"GeoTIFF {file_id} downloaded successfully.")
        return fh
    except Exception as e:
        logging.error(f"GeoTIFF download failed: {str(e)}")
        return None

@app.route('/ndvi-data', methods=['GET'])
def get_ndvi_data():
    try:
        file_data_list = [download_geotiff_from_drive(fid) for fid in GEO_TIFF_FILE_IDS]
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
        file_data_list = [download_geotiff_from_drive(fid) for fid in GEO_TIFF_FILE_IDS]
        file_data_list = [f for f in file_data_list if f]

        if not file_data_list:
            return jsonify({"error": "GeoTIFF download failed"}), 500

        datasets = [rasterio.open(f) for f in file_data_list]
        mosaic, transform = merge(datasets)

        raster_data = mosaic[0]  # NDVI values
        sugarcane_mask = (raster_data > 0.1) & (raster_data <= 1.0)

        # === Entropy Filtering ===
        logging.info("Applying entropy-based texture filtering...")
        ndvi_scaled = ((raster_data - np.nanmin(raster_data)) / (np.nanmax(raster_data) - np.nanmin(raster_data)) * 255).astype(np.uint8)
        entropy_filtered = entropy(ndvi_scaled, disk(2))
        entropy_mask = entropy_filtered > 2.0  # Empirical threshold

        # === Optional: Slope Filtering using gradient magnitude ===
        logging.info("Applying slope filtering...")
        slope_mask = generic_gradient_magnitude(raster_data, sobel) < 20  # Gentle slopes preferred

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

        logging.debug(f"Returning {len(sugarcane_locations)} sugarcane points.")
        return jsonify(sugarcane_locations)

    except Exception as e:
        logging.error(f"/sugarcane-locations error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
