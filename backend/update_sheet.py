import os
import io
import pandas as pd
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2 import service_account

# Constants (replace with your actual folder ID and sheet ID)
DRIVE_FOLDER_ID = '1UwAPlOGM3HArYKTMNB_txg0N-OudHHzK'
SHEET_ID = '1fGGz1QLjM8695bphkXFW9LPRfSMy_VwM0Qj8ExVmJF8'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

# Authenticate
credentials = service_account.Credentials.from_service_account_file(
    os.getenv('GOOGLE_APPLICATION_CREDENTIALS'),
    scopes=SCOPES
)
drive_service = build('drive', 'v3', credentials=credentials)
sheets_service = build('sheets', 'v4', credentials=credentials)

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

def upload_to_sheet(df, sheet_id):
    values = [df.columns.tolist()] + df.values.tolist()
    sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range='Sheet1!A1',
        valueInputOption='RAW',
        body={'values': values}
    ).execute()

def main():
    print("Listing CSVs in Drive folder...")
    files = list_csv_files_in_folder(DRIVE_FOLDER_ID)
    print(f"Found {len(files)} CSV files.")

    all_dataframes = []
    for file in files:
        print(f"Downloading {file['name']}...")
        df = download_csv_file(file['id'])
        all_dataframes.append(df)

    if not all_dataframes:
        print("No CSVs found to merge.")
        return

    merged_df = pd.concat(all_dataframes, ignore_index=True).drop_duplicates()
    print(f"Merged {len(merged_df)} rows. Uploading to sheet...")

    upload_to_sheet(merged_df, SHEET_ID)
    print("Google Sheet updated successfully.")

if __name__ == '__main__':
    main()
