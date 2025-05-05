import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime

# ---- Setup ----
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)

current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly"
]
FOLDER_ID = "1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK"  # Google Drive folder ID

# ---- Supabase Config ----
PAGE_SIZE = 10000  # Define how many rows to fetch per request
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TABLE_NAME = "sugarcane_data" 

if not SUPABASE_URL or not SUPABASE_KEY:
    logging.error("Supabase URL or Key not set in environment variables")
    raise RuntimeError("Missing Supabase credentials")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---- API ----
# ---- Pagination Parameters ----

def fetch_sugarcane_data_from_supabase():
    try:
        all_data = []
        page_size = 100000  # Number of rows per page, adjust based on your needs
        offset = 0  # Starting point for pagination

        while True:
            # Fetch the next page of data
            response = supabase\
                .table(TABLE_NAME)\
                .select("*")\
                .range(offset, offset + page_size - 1)\
                .execute()
            
            # Check if the response contains data
            if response.data:
                all_data.extend(response.data)  # Add this page's data to the overall list
                logging.info(f"Fetched {len(response.data)} rows, total: {len(all_data)}.")
                
                # If fewer rows than the page size are returned, we've reached the end
                if len(response.data) < page_size:
                    logging.info("End of data reached.")
                    break

                # Move to the next page
                offset += page_size
            else:
                logging.warning("No data returned for this page.")
                break
        
        return all_data
    
    except Exception as e:
        logging.error(f"Error fetching data from Supabase: {e}")
        return []


@app.route("/sugarcane-locations", methods=["GET"])
def sugarcane_locations():
    try:
        points = fetch_sugarcane_data_from_supabase()
        logging.info(f"Returning {len(points)} sugarcane points from Supabase.")
        return jsonify({"points": points})
    except Exception as e:
        logging.error(f"Error during data fetching: {e}")
        return jsonify({"error": "Error fetching sugarcane locations"}), 500

def get_latest_csv_modified_date():
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )

    service = build('drive', 'v3', credentials=credentials)

    # Query CSV files in the specified folder
    query = f"'{FOLDER_ID}' in parents and mimeType='text/csv' and trashed=false"
    results = service.files().list(
        q=query,
        pageSize=100,
        fields="files(id, name, modifiedTime)"
    ).execute()

    files = results.get('files', [])

    if not files:
        return None

    # Get the most recently modified file
    latest_file = max(files, key=lambda x: x['modifiedTime'])
    latest_date = latest_file['modifiedTime'][:10]  # "YYYY-MM-DD"

    return latest_date

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
    
if __name__ == "__main__":
    app.run(debug=True)
    
