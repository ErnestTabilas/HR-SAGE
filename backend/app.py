import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from googleapiclient.discovery import build
from google.oauth2 import service_account

# ---- Setup ----
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)

# ---- Paths & Credentials ----
current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly"
]
SPREADSHEET_FOLDER_ID = "1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK"

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)
sheets_service = build("sheets", "v4", credentials=credentials)

# ---- Helpers ----
def list_sheet_files():
    try:
        result = drive_service.files().list(
            q=f"'{SPREADSHEET_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet'",
            fields="files(id, name)",
            pageSize=1000
        ).execute()
        files = result.get('files', [])
        logging.info(f"Found {len(files)} spreadsheet(s) in folder.")
        return files
    except Exception as e:
        logging.error(f"Error listing spreadsheet files: {e}")
        return []

def batch_fetch_sheet_data(sheet_files):
    points = []
    for file in sheet_files:
        sheet_id = file['id']
        try:
            # Try to fetch values from the Sheet
            resp = sheets_service.spreadsheets().values().get(
                spreadsheetId=sheet_id,
                range="A2:E",
                majorDimension="ROWS"
            ).execute()

            if not resp:
                logging.warning(f"Empty response for sheet {sheet_id}, skipping.")
                continue

            rows = resp.get('values', [])
            if not rows:
                logging.warning(f"No rows in sheet {sheet_id}, skipping.")
                continue

            for row in rows:
                try:
                    lat = float(row[0]) if len(row) > 0 else None
                    lng = float(row[1]) if len(row) > 1 else None
                    n_tallmonths = int(row[2]) if len(row) > 2 and row[2].isdigit() else 0
                    ndvi = float(row[3]) if len(row) > 3 and row[3] else None
                    growth_stage = row[4] if len(row) > 4 else "Unknown"

                    if lat is not None and lng is not None:
                        points.append({
                            "lat": lat,
                            "lng": lng,
                            "n_tallmonths": n_tallmonths,
                            "ndvi": ndvi,
                            "growth_stage": growth_stage
                        })
                except Exception as parse_err:
                    logging.warning(f"Skipping bad row {row}: {parse_err}")
        except Exception as fetch_err:
            logging.error(f"Error fetching or reading sheet {sheet_id}: {fetch_err}")
            continue
    return points

# ---- API ----
@app.route("/sugarcane-locations", methods=["GET"])
def sugarcane_locations():
    sheet_files = list_sheet_files()
    if not sheet_files:
        return jsonify({"error": "No spreadsheets found."}), 500

    points = batch_fetch_sheet_data(sheet_files)
    logging.info(f"Returning {len(points)} sugarcane points.")
    return jsonify({"points": points})

if __name__ == "__main__":
    app.run(debug=True)
