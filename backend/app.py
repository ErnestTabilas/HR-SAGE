import json
import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime

# ---- Setup -----
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
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TABLE_NAME = "backup" 

if not SUPABASE_URL or not SUPABASE_KEY:
    logging.error("Supabase URL or Key not set in environment variables")
    raise RuntimeError("Missing Supabase credentials")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---- API ----
# ---- Pagination Parameters ----

def classify_growth_stage_v2(ndvi, n_tallmonths):
    if ndvi < 0.25:
        return None
    elif 0.25 <= ndvi < 0.35 and n_tallmonths == 0:
        return "Germination"
    elif 0.35 <= ndvi < 0.55 and n_tallmonths == 0:
        return "Tillering"
    elif 0.55 <= ndvi < 1.0 and 4 <= n_tallmonths <= 7:
        return "Ripening"
    elif 0.55 <= ndvi <= 0.7 and 8 <= n_tallmonths <= 11:
        return "Grand Growth"
    return None


@app.route("/sugarcane-locations", methods=["GET"])
def sugarcane_locations():
    has_more = True
    try:
        # --- Parse query params ---
        page = int(request.args.get("page", 0))
        page_size = int(request.args.get("page_size", 50000))
        offset = page * page_size

        response = supabase\
            .table(TABLE_NAME)\
            .select("lat, lng, ndvi, n_tallmonths")\
            .gt("ndvi", 0)\
            .gt("n_tallmonths", 0)\
            .order("lat")\
            .range(offset, offset + page_size - 1)\
            .execute()
        
        results = []
        if len(response.data) == 0:
            has_more = False
        else:
            for row in response.data:
                lat, lng = row.get("lat"), row.get("lng")
                ndvi = row.get("ndvi")
                n_tallmonths = row.get("n_tallmonths")

                # Sanity check
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    continue

                stage = classify_growth_stage(ndvi, n_tallmonths)
                if stage:
                    results.append({
                        "lat": lat,
                        "lng": lng,
                        "ndvi": ndvi,
                        "n_tallmonths": n_tallmonths,
                        "growth_stage": stage
                    })

        return jsonify({
            "page": page,
            "page_size": page_size,
            "has_more": has_more,
            "points": results
        })

    except Exception as e:
        logging.error(f"Error fetching sugarcane data: {e}")
        return jsonify({"error": "Failed to fetch data"}), 500

# def get_latest_csv_modified_date():
#     credentials = service_account.Credentials.from_service_account_file(
#         SERVICE_ACCOUNT_FILE, scopes=SCOPES
#     )

#     service = build('drive', 'v3', credentials=credentials)

#     # Query CSV files in the specified folder
#     query = f"'{FOLDER_ID}' in parents and mimeType='text/csv' and trashed=false"
#     results = service.files().list(
#         q=query,
#         pageSize=100,
#         fields="files(id, name, modifiedTime)"
#     ).execute()

#     files = results.get('files', [])

#     if not files:
#         return None

#     # Get the most recently modified file
#     latest_file = max(files, key=lambda x: x['modifiedTime'])
#     latest_date = latest_file['modifiedTime'][:10]  # "YYYY-MM-DD"

#     return latest_date

# @app.route('/api/last-update', methods=["GET"])
# def last_update():
#     try:
#         last_updated = get_latest_csv_modified_date()
#         if not last_updated:
#             return jsonify({"error": "No CSV files found"}), 404
#         readable_date = datetime.strptime(last_updated, "%Y-%m-%d").strftime("%B %d, %Y")
#         logging.info("Successfully fetched last updated data time.")
#         return jsonify({"last_updated": last_updated, "readable": readable_date})
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))  # Render provides PORT env var
    app.run(host='0.0.0.0', port=port)
    logging.info(f"Server running on port {port}")