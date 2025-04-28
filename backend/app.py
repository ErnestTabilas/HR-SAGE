import os
import logging
import time
from flask import Flask, jsonify
from flask_cors import CORS
from googleapiclient.discovery import build
from google.oauth2 import service_account
from google.auth.transport.requests import Request

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

# ---- Authentication ----
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)
sheets_service = build("sheets", "v4", credentials=credentials)

def refresh_services():
    global drive_service, sheets_service
    credentials.refresh(Request())
    drive_service = build("drive", "v3", credentials=credentials)
    sheets_service = build("sheets", "v4", credentials=credentials)
    logging.info("Google API clients refreshed.")

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

MAX_RETRIES = 5  # realistic retry limit
INITIAL_BACKOFF = 3  # seconds to wait initially

def fetch_with_retry(sheet_id):
    retries = 0
    backoff = INITIAL_BACKOFF

    while retries < MAX_RETRIES:
        try:
            resp = sheets_service.spreadsheets().values().get(
                spreadsheetId=sheet_id,
                range="A2:E",
                majorDimension="ROWS"
            ).execute()

            if not resp:
                logging.warning(f"Empty response for sheet {sheet_id}, skipping.")
                return []

            rows = resp.get('values', [])
            if not rows:
                logging.warning(f"No rows in sheet {sheet_id}, skipping.")
                return []

            points = []
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

            return points

        except Exception as fetch_err:
            retries += 1
            logging.error(f"Error fetching sheet {sheet_id} (attempt {retries}/{MAX_RETRIES}): {fetch_err}")

            if retries >= MAX_RETRIES:
                logging.error(f"Max retries reached for sheet {sheet_id}. Skipping this sheet.")
                return []

            if "SSL" in str(fetch_err) or "decryption" in str(fetch_err):
                logging.warning("SSL error detected. Refreshing Google API clients...")
                refresh_services()

            # Exponential backoff
            time.sleep(backoff)
            backoff *= 2  # double wait time for next retry

# ---- Batch Fetch ----
def batch_fetch_sheet_data(sheet_files):
    points = []
    for file in sheet_files:
        sheet_id = file['id']
        points.extend(fetch_with_retry(sheet_id))
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
