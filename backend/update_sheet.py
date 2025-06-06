import os
import io
import json
import pandas as pd
from datetime import datetime
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2 import service_account
from supabase import create_client, Client

# --- Configurations ---
DRIVE_FOLDER_ID = '1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK'
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TABLE_NAME = 'sugarcane_data'
TRACKING_FILE = 'uploaded_files.json'

# --- Authentication ---
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Write sa.json from environment variable if not already written
if not os.path.exists("sa.json"):
    creds_json = os.environ.get("GOOGLE_DRIVE_CREDENTIALS_JSON")
    if creds_json:
        with open("sa.json", "w") as f:
            json.dump(json.loads(creds_json), f)

credentials = service_account.Credentials.from_service_account_file(
    "sa.json", scopes=SCOPES
)

drive_service = build("drive", "v3", credentials=credentials)

# --- Supabase Client ---
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Helper functions ---
def load_uploaded_files():
    if os.path.exists(TRACKING_FILE):
        with open(TRACKING_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_uploaded_files(uploaded_files):
    with open(TRACKING_FILE, 'w') as f:
        json.dump(uploaded_files, f, indent=2)

def list_csv_files_sorted(folder_id):
    query = f"'{folder_id}' in parents and mimeType='text/csv'"
    results = drive_service.files().list(q=query, pageSize=1000, fields="files(id, name, modifiedTime)").execute()
    files = results.get('files', [])
    return sorted(files, key=lambda x: x['modifiedTime'], reverse=True)

def download_csv_file(file_id):
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    fh.seek(0)
    return pd.read_csv(fh)

def get_existing_lat_lng_records():
    # Retrieve existing lat-lng records from Supabase for comparison
    existing_records = supabase.table(TABLE_NAME).select('lat', 'lng').execute()
    return {(rec['lat'], rec['lng']) for rec in existing_records.data}

def update_ndvi_for_existing_records(df, existing_lat_lng):
    # Update only the NDVI values for records already present in Supabase
    rows_to_update = df[df[['lat', 'lng']].apply(lambda row: (row['lat'], row['lng']) in existing_lat_lng, axis=1)]
    for _, row in rows_to_update.iterrows():
        try:
            # Update NDVI for existing lat, lng pair
            response = supabase.table(TABLE_NAME).upsert({
                'lat': row['lat'],
                'lng': row['lng'],
                'ndvi': row['ndvi']
            }).execute()
            print(f"Updated NDVI for lat: {row['lat']}, lon: {row['lng']}")
        except Exception as e:
            print(f"Error updating lat: {row['lat']}, lon: {row['lng']}: {e}")

def insert_new_records(df, existing_lat_lng):
    # Insert new records that don't exist in the database
    new_rows = df[~df[['lat', 'lng']].apply(lambda row: (row['lat'], row['lng']) in existing_lat_lng, axis=1)]
    rows = new_rows.to_dict(orient='records')
    for i in range(0, len(rows), 100):
        batch = rows[i:i + 100]
        try:
            response = supabase.table(TABLE_NAME).insert(batch).execute()
            print(f"Inserted batch of {len(batch)} records.")
        except Exception as e:
            print(f"Error inserting batch starting at row {i}: {e}")

# --- Main logic ---
def main():
    print("Fetching CSVs from Drive...")
    files = list_csv_files_sorted(DRIVE_FOLDER_ID)
    print(f"Found {len(files)} CSVs.")

    uploaded_files = load_uploaded_files()
    new_dataframes = []

    for file in files:
        file_id = file['id']
        file_name = file['name']
        mod_time = file['modifiedTime']

        if uploaded_files.get(file_id) == mod_time:
            print(f"Skipping already uploaded file: {file_name}")
            continue

        print(f"Downloading new or updated file: {file_name}")
        df = download_csv_file(file_id)
        new_dataframes.append(df)
        uploaded_files[file_id] = mod_time

    if not new_dataframes:
        print("No new data to upload.")
        return

    merged_df = pd.concat(new_dataframes, ignore_index=True).drop_duplicates()
    print(f"Merged {len(merged_df)} rows.")

    # Retrieve existing lat-lng records from Supabase
    existing_lat_lng = get_existing_lat_lng_records()

    # Update NDVI for existing records and insert new records
    print("Updating existing records and inserting new data into Supabase...")
    update_ndvi_for_existing_records(merged_df, existing_lat_lng)
    insert_new_records(merged_df, existing_lat_lng)

    # Save tracking info for uploaded files
    save_uploaded_files(uploaded_files)
    print("Done updating Supabase.")

if __name__ == '__main__':
    main()
    print("Script executed successfully.")