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

# ---- Setup ----
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)

# ---- Paths & Credentials ----
current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
FOLDER_ID = "1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK"

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)

# ---- Classification Logic ----
def classify_growth_stage(ndvi, evi):
    if ndvi >= 0.5 and evi >= 0.45:
        return "Grand Growth", "yellow"
    elif ndvi >= 0.3 and evi >= 0.3:
        return "Ripening", "green"
    elif ndvi >= 0.2 and evi >= 0.2:
        return "Tillering", "orange"
    elif ndvi >= 0.1 and evi >= 0.1:
        return "Germination", "red"
    else:
        return "No Sugarcane", "gray"

# ---- Drive Helpers ----
def list_geotiff_file_ids():
    """List all GeoTIFF IDs in the GEE export folder."""
    try:
        resp = drive_service.files().list(
            q=f"'{FOLDER_ID}' in parents and mimeType='image/tiff'",
            fields="files(id, name)",
            pageSize=1000
        ).execute()
        files = resp.get("files", [])
        logging.info(f"Found {len(files)} GeoTIFF(s) in Drive folder.")
        return [f["id"] for f in files]
    except Exception as e:
        logging.error(f"Error listing files: {e}")
        return []

def download_geotiff_from_drive(file_id):
    """Download a single GeoTIFF by ID, return BytesIO or None."""
    try:
        request = drive_service.files().get_media(fileId=file_id)
    except Exception as e:
        logging.error(f"Could not initiate download request for {file_id}: {e}")
        return None

    if request is None:
        logging.error(f"No request object for file {file_id}")
        return None

    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    try:
        while not done:
            status, done = downloader.next_chunk()
            logging.debug(f"Downloading {file_id}: {int(status.progress()*100)}%")
    except Exception as e:
        logging.error(f"Error downloading {file_id}: {e}")
        return None

    fh.seek(0)
    return fh

# ---- API Endpoint ----
@app.route("/sugarcane-locations", methods=["GET"])
def get_sugarcane_locations():
    """Merge all GeoTIFFs, read NDVI/EVI bands, classify, and return points + summary."""
    file_ids = list_geotiff_file_ids()
    file_objs = [download_geotiff_from_drive(fid) for fid in file_ids]
    file_objs = [f for f in file_objs if f]  # drop any that failed

    if not file_objs:
        return jsonify({
            "error": "No GeoTIFFs could be downloaded. The files may have expired. Please upload the required files to Google Drive and try again."
        }), 500

    # Merge into a single in-memory raster
    datasets = [rasterio.open(f) for f in file_objs]
    mosaic, transform = merge(datasets)

    # Band 0 = NDVI, Band 1 = EVI
    ndvi_band = mosaic[0]
    evi_band  = mosaic[1]

    rows, cols = ndvi_band.shape
    sugarcane_points = []
    summary = {"Germination": 0, "Tillering": 0, "Grand Growth": 0, "Ripening": 0}

    for r in range(rows):
        for c in range(cols):
            ndvi = ndvi_band[r, c]
            evi  = evi_band[r, c]
            if np.isnan(ndvi) or np.isnan(evi):
                continue

            stage, color = classify_growth_stage(ndvi, evi)
            if stage == "No Sugarcane":
                continue

            lon, lat = transform * (c, r)
            sugarcane_points.append({
                "lat": lat,
                "lng": lon,
                "stage": stage,
                "color": color
            })
            summary[stage] += 1

    logging.info(f"Classified {len(sugarcane_points)} points.")
    return jsonify({
        "points": sugarcane_points,
        "summary": summary
    })

# ---- Main ----
if __name__ == "__main__":
    app.run(debug=True)
