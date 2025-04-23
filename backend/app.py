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
DRIVE_FOLDER_ID = "1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK"

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)

# ---- Classification Logic ----
def classify_growth_stage(ndvi, evi):
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
    csv_ids = list_csv_file_ids()
    if not csv_ids:
        return jsonify({"error": "No CSV exports found in Drive."}), 500

    points = []
    summary = {
        "Germination": 0,
        "Tillering": 0,
        "Grand Growth": 0,
        "Ripening": 0
    }

    for fid in csv_ids:
        bio = download_file_to_memory(fid)
        if not bio:
            continue

        text = bio.getvalue().decode('utf-8')
        reader = csv.DictReader(io.StringIO(text))

        for row in reader:
            try:
                geo = json.loads(row[".geo"])
                lon, lat = geo["coordinates"]

                ndvi = float(row.get("NDVI", 0))
                evi = float(row.get("EVI", 0)) if "EVI" in row else ndvi  # fallback if EVI missing
                stage = row.get("growth_stage", "").strip()

                if not stage or stage == "No Sugarcane":
                    stage, color = classify_growth_stage(ndvi, evi)
                    if stage == "No Sugarcane":
                        continue
                else:
                    color_map = {
                        "Germination": "red",
                        "Tillering": "orange",
                        "Grand Growth": "yellow",
                        "Ripening": "green"
                    }
                    color = color_map.get(stage, "gray")

                points.append({
                    "lat": lat,
                    "lng": lon,
                    "stage": stage,
                    "color": color
                })
                summary[stage] += 1

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
