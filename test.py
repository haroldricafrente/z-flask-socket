from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2 import service_account

# Load credentials
SERVICE_ACCOUNT_FILE = "D:/z-flask-socket/utils/google-credentials.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]

creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build("drive", "v3", credentials=creds)

# Upload file
file_metadata = {
    "name": "info_chestnut.jpg",  # Change this to your file name
    "parents": ["10wyHwUqeItNjVEZlB_ilAvR32N9ZmvW1"],  # Replace with your folder ID (CHESTNUT_FOLDER_ID)
}

media = MediaFileUpload("info_chestnut.jpg", mimetype="image/jpeg")  # Change to your test file path

file = drive_service.files().create(body=file_metadata, media_body=media, fields="id").execute()
print(f"✅ File uploaded successfully! File ID: {file.get('id')}")
