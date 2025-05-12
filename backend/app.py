import json
import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime

# ---- Setup ----
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app, origins=["https://hr-sage.vercel.app", "http://localhost:3000"])

# Write sa.json from environment variable if it doesn't exist
if not os.path.exists("sa.json"):
    creds_json = os.environ.get("GOOGLE_DRIVE_CREDENTIALS_JSON")
    if creds_json:
        with open("sa.json", "w") as f:
            json.dump(json.loads(creds_json), f)

SERVICE_ACCOUNT_FILE = "sa.json"

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly"
]
FOLDER_ID = "1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK"  # Google Drive folder ID

# ---- Supabase Config ----
PAGE_SIZE = 10000  # Define how many rows to fetch per request
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TABLE_NAME = "backup" 

if not SUPABASE_URL or not SUPABASE_KEY:
    logging.error("Supabase URL or Key not set in environment variables")
    raise RuntimeError("Missing Supabase credentials")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---- API ----
# ---- Pagination Parameters ----

def classify_growth_stage(ndvi, n_tallmonths):
    if ndvi < 0.2 or n_tallmonths < 1:
        return None  # Discard noisy or sparse detections
    elif 0.2 <= ndvi < 0.4 and n_tallmonths >= 1:
        return "Germination"
    elif 0.4 <= ndvi < 0.6 and n_tallmonths >= 2:
        return "Tillering"
    elif 0.6 <= ndvi < 0.8 and n_tallmonths >= 4:
        return "Grand Growth"
    elif ndvi >= 0.8 and n_tallmonths >= 6:
        return "Ripening"
    return None  # Inconsistent combination



@app.route("/sugarcane-locations", methods=["GET"])
def sugarcane_locations():
    try:
        offset = int(request.args.get("offset", 0))
        limit = int(request.args.get("limit", 10000))
        
        all_data = []
        page_size = 100000
        offset = 0

        while True:
            response = supabase\
                .table(TABLE_NAME)\
                .select("lat, lng, ndvi, n_tallmonths")\
                .gt("ndvi", 0)\
                .gt("n_tallmonths", 0)\
                .order("lat")\
                .range(offset, offset + limit - 1)\
                .execute()


            if not response.data:
                break

            for row in response.data:
                lat, lng = row.get("lat"), row.get("lng")
                ndvi = row.get("ndvi")
                n_tallmonths = row.get("n_tallmonths")

                # sanity check for coordinates
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    continue

                stage = classify_growth_stage(ndvi, n_tallmonths)
                if stage:
                    all_data.append({
                        "lat": lat,
                        "lng": lng,
                        "ndvi": ndvi,
                        "n_tallmonths": n_tallmonths,
                        "growth_stage": stage
                    })

            if len(response.data) < page_size:
                break
            offset += page_size

        logging.info(f"Filtered total sugarcane points: {len(all_data)}")
        return all_data

    except Exception as e:
        logging.error(f"Error fetching sugarcane data: {e}")
        return []
    
@app.route('/api/last-update', methods=["GET"])
def last_update():
    try:
        last_updated = get_latest_csv_modified_date()
        if not last_updated:
            return jsonify({"error": "No CSV files found"}), 404
        readable_date = datetime.strptime(last_updated, "%Y-%m-%d").strftime("%B %d, %Y")
        logging.info("Successfully fetched last updated data time.")
        return jsonify({"last_updated": last_updated, "readable": readable_date})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))  # Render provides PORT env var
    app.run(host='0.0.0.0', port=port)
    logging.info(f"Server running on port {port}")