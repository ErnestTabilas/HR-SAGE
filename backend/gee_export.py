import ee
import time
import os
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Setup logging
logging.basicConfig(level=logging.INFO)

# Directory and service account file setup
current_dir = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
KEY_FILE = os.path.join(current_dir, '..', 'data', 'service-account.json')
TARGET_FOLDER_ID = '1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK'  # your Drive folder ID

# Initialize Earth Engine using service account
SERVICE_ACCOUNT_EMAIL = 'hr-sage-service-account@ee-eltabilas.iam.gserviceaccount.com'
 
credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT_EMAIL, KEY_FILE)
ee.Initialize(credentials)


# ---- Google Drive API for file cleanup ----
def clear_existing_csv_files():
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=['https://www.googleapis.com/auth/drive'])
    service = build('drive', 'v3', credentials=creds)

    results = service.files().list(
        q=f"'{TARGET_FOLDER_ID}' in parents and mimeType='text/csv' and trashed=false",
        fields="files(id, name)"
    ).execute()

    files = results.get('files', [])
    for file in files:
        file_id = file['id']
        logging.info(f"Deleting existing file: {file['name']}")
        service.files().delete(fileId=file_id).execute()

# ---- Export Sugarcane Data ----
def export_sugarcane_csv():
    logging.info("Skipping actual GEE export (testing only).")
    return


# ---- Main Execution ----
if __name__ == "__main__":
    # logging.info("Cleaning old files in Drive folder...") 
    # clear_existing_csv_files()

    logging.info("Running GEE export...")
    export_sugarcane_csv()
    logging.info("Export completed.")