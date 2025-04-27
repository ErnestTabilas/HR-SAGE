import os
import io
import csv
import logging
import time
from flask import Flask, jsonify
from flask_cors import CORS
from googleapiclient.discovery import build
from google.oauth2 import service_account

# Setup
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)

# ---- Paths & Credentials ----
current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.readonly"]
SPREADSHEET_FOLDER_ID = "1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK"

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)
sheets_service = build("sheets", "v4", credentials=credentials)

# ---- Helpers ----
def list_sheet_file_ids():
    try:
        resp = drive_service.files().list(
            q=f"'{SPREADSHEET_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet'",
            fields="files(id, name)",
            pageSize=1000
        ).execute()
        files = resp.get("files", [])
        logging.info(f"Found {len(files)} Sheets in Drive folder.")
        return [f["id"] for f in files]
    except Exception as e:
        logging.error(f"Error listing Sheets: {e}")
        return []

def fetch_sheet_data(sheet_id):
    try:
        resp = sheets_service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range="A1:E"  # Columns: lat, lng, n_tallmonths, ndvi, growth_stage
        ).execute()
        values = resp.get('values', [])
        if not values or len(values) < 2:
            return []

        header = values[0]
        rows = values[1:]

        data = []
        for row in rows:
            try:
                lat = float(row[0])
                lng = float(row[1])
                n_tallmonths = int(row[2]) if row[2].isdigit() else 0
                ndvi = float(row[3]) if row[3] else None
                growth_stage = row[4] if len(row) > 4 else "Unknown"

                data.append({
                    "lat": lat,
                    "lng": lng,
                    "n_tallmonths": n_tallmonths,
                    "ndvi": ndvi,
                    "growth_stage": growth_stage
                })
            except Exception as e:
                logging.warning(f"Error parsing row: {row} -> {e}")
                continue

        return data

    except Exception as e:
        logging.error(f"Error fetching sheet {sheet_id}: {e}")
        return []

# ---- API ----
@app.route("/sugarcane-locations", methods=["GET"])
def sugarcane_locations():
    sheet_ids = list_sheet_file_ids()
    if not sheet_ids:
        return jsonify({"error": "No Sheets found."}), 500

    points = []
    for sheet_id in sheet_ids:
        points.extend(fetch_sheet_data(sheet_id))

    logging.info(f"Returning {len(points)} sugarcane points.")
    return jsonify({"points": points})

if __name__ == "__main__":
    app.run(debug=True)
