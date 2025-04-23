import os
import io
import json
import time
import csv
import logging
import numpy as np 
from flask import Flask, jsonify
from flask_cors import CORS
from googleapiclient.discovery import build
from google.oauth2 import service_account
from googleapiclient.http import MediaIoBaseDownload

# ---- Setup ----
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)

# ---- Paths & Credentials ----
current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
DRIVE_FOLDER_ID = "1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK"  # your Drive folder

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)

# ---- Classification Logic ----
def classify_growth_stage(ndvi, evi):
    """Return (stage_name, color) given NDVI & EVI."""
    if ndvi >= 0.5 and evi >= 0.45:
        return "Grand Growth", "yellow"
    if ndvi >= 0.3 and evi >= 0.3:
        return "Ripening", "green"
    if ndvi >= 0.2 and evi >= 0.2:
        return "Tillering", "orange"
    if ndvi >= 0.1 and evi >= 0.1:
        return "Germination", "red"
    return "No Sugarcane", "gray"

# ---- Drive Helpers ----
def list_csv_file_ids():
    """List all CSV files in the designated Drive folder."""
    try:
        resp = drive_service.files().list(
            q=f"'{DRIVE_FOLDER_ID}' in parents and mimeType='text/csv'",
            fields="files(id, name)",
            pageSize=1000
        ).execute()
        files = resp.get("files", [])
        logging.info(f"Found {len(files)} CSV(s) in Drive folder.")
        return [f["id"] for f in files]
    except Exception as e:
        logging.error(f"Error listing CSV files: {e}")
        return []

def download_file_to_memory(file_id):
    """Download a Drive file to a BytesIO, with simple retry logic."""
    try:
        request = drive_service.files().get_media(fileId=file_id)
    except Exception as e:
        logging.error(f"Could not init download request for {file_id}: {e}")
        return None

    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    retries = 3
    done = False
    while not done and retries:
        try:
            while not done:
                status, done = downloader.next_chunk()
                logging.debug(f"Downloading {file_id}: {int(status.progress()*100)}%")
            fh.seek(0)
            return fh
        except Exception as e:
            retries -= 1
            logging.warning(f"Download error for {file_id}: {e} - retrying ({retries} left)")
            time.sleep(2)
    logging.error(f"Failed to download {file_id}")
    return None

# ---- API Endpoint ----
@app.route("/sugarcane-locations", methods=["GET"])
def sugarcane_locations():
    """
    Reads all exported CSVs from Drive, extracts NDVI_max, NBSI, growthStage & coordinates,
    and returns sugarcane locations with growth stage and summary counts.
    """
    csv_ids = list_csv_file_ids()
    if not csv_ids:
        return jsonify({"error": "No CSV exports found in Drive."}), 500

    # Map numeric stages to labels and colors
    stage_map = {
        "1": ("Germination", "red"),
        "2": ("Tillering", "orange"),
        "3": ("Grand Growth", "yellow"),
        "4": ("Ripening", "green")
    }

    points = []
    summary = {v[0]: 0 for v in stage_map.values()}

    for fid in csv_ids:
        bio = download_file_to_memory(fid)
        if not bio:
            continue

        text = bio.getvalue().decode('utf-8')
        reader = csv.DictReader(io.StringIO(text))

        for row in reader:
            try:
                stage_raw = row.get("growthStage")
                if stage_raw not in stage_map:
                    continue  # skip stage 0 (no sugarcane) or invalid

                geom = json.loads(row[".geo"])
                lon, lat = geom["coordinates"]
                stage_label, color = stage_map[stage_raw]

                points.append({
                    "lat": lat,
                    "lng": lon,
                    "stage": stage_label,
                    "color": color
                })
                summary[stage_label] += 1

            except Exception as e:
                logging.warning(f"Error parsing row: {e}")
                continue

    logging.info(f"Returning {len(points)} sugarcane points.")
    return jsonify({
        "points": points,
        "summary": summary
    })

if __name__ == "__main__":
    app.run(debug=True)
