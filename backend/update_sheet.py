import os
import io
import pandas as pd
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2 import service_account
from supabase import create_client, Client

# --- Configurations ---
DRIVE_FOLDER_ID = '1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK'
SCOPES = ['https://www.googleapis.com/auth/drive']
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TABLE_NAME = 'test'  # Change as needed

# --- Google Drive Authentication ---
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

# --- Supabase Client ---
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Functions ---
def list_csv_files_in_folder(folder_id):
    query = f"'{folder_id}' in parents and mimeType='text/csv'"
    results = drive_service.files().list(q=query, pageSize=1000).execute()
    return results.get('files', [])

def download_csv_file(file_id):
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    fh.seek(0)
    return pd.read_csv(fh)

def insert_to_supabase(df):
    # Replace 'inf' and '-inf' values with valid numbers (0 in this case)
    df = df.replace([float('inf'), float('-inf')], 0)
    
    # Replace NaN with a valid default (0 for numbers, "" for strings)
    for column in df.columns:
        if df[column].dtype == 'object':  # For text columns (strings)
            df[column] = df[column].fillna('')  # Replace NaN in text columns with an empty string
        else:  # For numerical columns
            df[column] = df[column].fillna(0)  # Replace NaN in numeric columns with 0

    # Now convert to dictionary format
    rows = df.to_dict(orient='records')

    # Insert in batches
    for i in range(0, len(rows), 100):
        batch = rows[i:i + 100]
        try:
            response = supabase.table(TABLE_NAME).insert(batch).execute()
            print(f"Inserted batch of {len(batch)} records, response: {response.data}")
        except Exception as e:
            print(f"Error inserting batch starting at row {i}: {e}")


# --- Main Logic ---
def main():
    print("Fetching CSVs from Drive...")
    files = list_csv_files_in_folder(DRIVE_FOLDER_ID)
    print(f"Found {len(files)} CSVs.")

    all_dataframes = []
    for file in files:
        print(f"Downloading {file['name']}...")
        df = download_csv_file(file['id'])
        all_dataframes.append(df)

    if not all_dataframes:
        print("No data to upload.")
        return

    merged_df = pd.concat(all_dataframes, ignore_index=True).drop_duplicates()
    print(f"Merged total of {len(merged_df)} rows. Inserting to Supabase...")
    insert_to_supabase(merged_df)
    print("Done uploading to Supabase.")

if __name__ == '__main__':
    main()
