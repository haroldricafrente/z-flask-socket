from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash, Response
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_mail import Mail, Message
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload  
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import requests
from werkzeug.utils import secure_filename
import logging
import time
import cv2
import psutil 
import json
import os

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit


# Secure Configuration
app.config["REMEMBER_COOKIE_DURATION"] = timedelta(days=30)
app.secret_key = os.getenv("SECRET_KEY", "default_secret_key")  # Fallback for missing .env
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,  # Set to True only in production (HTTPS required)
    SESSION_COOKIE_SAMESITE="Lax",
)


logging.basicConfig(level=logging.DEBUG)
logging.getLogger("pymongo").setLevel(logging.WARNING)

# MongoDB Setup
mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    raise ValueError("MONGO_URI is not set in the .env file!")

client = MongoClient(mongo_uri)
db = client['sensor_data']
users_collection = db["users"]

# Initialize Extensions
bcrypt = Bcrypt(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', transports=["polling", "websocket"])

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = "Please log in to access this page."

# Flask-Mail Configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')  # Use environment variable
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')  # Use environment variable
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

mail = Mail(app)

# User Model
class User(UserMixin):
    def __init__(self, user_id, username):
        self.id = user_id
        self.username = username

@login_manager.user_loader
def load_user(user_id):
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    return User(str(user["_id"]), user["username"]) if user else None

@socketio.on("connect")
def handle_connect():
    print("Client connected!")

@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected!")


# ---------------- AUTHENTICATION ROUTES ----------------

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        if users_collection.find_one({"username": username}):
            flash("Username already exists!", "danger")
            return redirect(url_for("register"))

        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
        users_collection.insert_one({"username": username, "password": hashed_password})
        flash("Account created successfully. Please log in.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        remember = "remember" in request.form

        user = users_collection.find_one({"username": username})
        if user and bcrypt.check_password_hash(user["password"], password):
            login_user(User(str(user["_id"]), username), remember=remember)
            return redirect(url_for("index"))

        flash("Invalid username or password!", "danger")

    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for("login"))

# ---------------- PROTECTED ROUTES ----------------
@app.route("/")
@login_required
def index():
    return render_template("index.html")

@app.route('/info_chestnut')
def chestnut_info():
    return render_template('info_chestnut.html')  

@app.route('/info_milkymushroom')
def milkymushroom_info():
    return render_template('info_milkymushroom.html') 
 
@app.route('/info_reishi')
def reishi_info():
    return render_template('info_reishi.html')  
 
@app.route('/info_shiitake')
def shiitake_info():
    return render_template('info_shiitake.html')  
 
@app.route('/info_whiteoyster')
def whiteoyster_info():
    return render_template('info_whiteoyster.html')  


@app.route("/users")
@login_required
def view_users():
    if current_user.username != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    users = list(users_collection.find({}, {"_id": 0, "username": 1}))
    return jsonify(users)

# Dynamic Mushroom Dashboard Route
@app.route("/dashboard/<mushroom_type>")
@login_required
def mushroom_dashboard(mushroom_type):
     # Normalize mushroom_type
    normalized_type = mushroom_type.lower().replace("-", "_")

    # Dictionary storing optimal conditions and Google Drive folder IDs
    mushrooms = {
        "chestnut": {
            "optimal_conditions": {
                "temperature": "18-22°C",
                "humidity": "85-95%",
                "soilMoisture": "60-80%",
                "lightIntensity": "500-1000 lux",
                "ECO2": "Below 1000 ppm",
            },
            "folder_id": os.getenv("OUTPUT_CHESTNUT_FOLDER_ID"),
        },
        "milky_mushroom": {
            "optimal_conditions": {
                "temperature": "24-30°C",
                "humidity": "80-90%",
                "soilMoisture": "60-80%",
                "lightIntensity": "500-1000 lux",
                "ECO2": "Below 1000 ppm",
            },
            "folder_id": os.getenv("OUTPUT_MILKY_MUSHROOM_FOLDER_ID"),
        },
        "reishi": {
            "optimal_conditions": {
                "temperature": "24-28°C",
                "humidity": "85-95%",
                "soilMoisture": "60-80%",
                "lightIntensity": "1000-1500 lux",
                "ECO2": "Below 800 ppm",
            },
            "folder_id": os.getenv("OUTPUT_REISHI_FOLDER_ID"),
        },
        "shiitake": {
            "optimal_conditions": {
                "temperature": "10-20°C",
                "humidity": "85-95%",
                "soilMoisture": "50-70%",
                "lightIntensity": "500-1000 lux",
                "ECO2": "Below 1200 ppm",
            },
            "folder_id": os.getenv("OUTPUT_SHIITAKE_FOLDER_ID"),
        },
        "white_oyster": {
            "optimal_conditions": {
                "temperature": "18-25°C",
                "humidity": "85-95%",
                "soilMoisture": "60-80%",
                "lightIntensity": "500-1000 lux",
                "ECO2": "Below 1000 ppm",
            },
            "folder_id": os.getenv("OUTPUT_WHITE_OYSTER_FOLDER_ID"),
        },
    }

    mushroom_data = mushrooms.get(normalized_type)
    print(f"Requested: {mushroom_type}, Normalized: {normalized_type}, Data Found: {mushroom_data}")

    if not mushroom_data:
        flash("Invalid mushroom type!", "danger")
        return redirect(url_for("index"))

    return render_template(
        "dashboard.html",
        mushroom_type=normalized_type.replace("_", " ").title(),
        optimal_conditions=mushroom_data["optimal_conditions"],
        drive_url=f"https://drive.google.com/drive/folders/{mushroom_data['folder_id']}"
    )

@app.route("/live")
@login_required
def live():
    return render_template("live.html")


# ---------------- SENSOR DATA ENDPOINT ----------------

API_KEY = os.getenv("ESP32_API_KEY")
if not API_KEY:
    raise ValueError("ESP32_API_KEY is not set in the .env file!")

@app.route("/data", methods=["POST"])
def receive_data():
    api_key = request.headers.get("X-API-KEY")
    if not api_key:
        return jsonify({"error": "Missing API key"}), 400

    if api_key != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid JSON payload"}), 400

        print("Received data:", data)

        data["timestamp"] = datetime.now(timezone.utc)

        collection_name = f"{data.get('sensor_type', 'unknown')}_sensor_readings"
        collection = db[collection_name]
        collection.insert_one(data)

        socketio.emit(f"{data['sensor_type']}_update", {
            "sensor_type": data.get("sensor_type"),
            "temperature": data.get("temperature"),
            "humidity": data.get("humidity"),
            "soilMoisture": data.get("soilMoisture"),
            "lightIntensity": data.get("lightIntensity"),
            "ECO2": data.get("ECO2"),
            "timestamp": data["timestamp"].isoformat() + "Z"
        })
        
        
        return jsonify({"status": "success"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
# ---------------- Google Drive Setup ---------------- #
SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_PATH")

drive_service = None
if SERVICE_ACCOUNT_FILE:
    try:
        creds = Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=["https://www.googleapis.com/auth/drive.file"]
        )
        drive_service = build("drive", "v3", credentials=creds)
        print("✅ Google Drive API initialized successfully.")
    except Exception as e:
        print(f"❌ Google Drive API Error: {e}")
else:
    print("❌ GOOGLE_SERVICE_ACCOUNT_PATH not found in .env!")

# ---------------- Mushroom Folder IDs ---------------- #
CHESTNUT_FOLDER_ID = os.getenv("CHESTNUT_FOLDER_ID")
MILKY_FOLDER_ID = os.getenv("MILKY_FOLDER_ID")
REISHI_FOLDER_ID = os.getenv("REISHI_FOLDER_ID")
SHIITAKE_FOLDER_ID = os.getenv("SHIITAKE_FOLDER_ID")
WHITE_OYSTER_FOLDER_ID = os.getenv("WHITE_OYSTER_FOLDER_ID")

# ---------------- Ensure Upload Directory Exists ---------------- #
UPLOADS_DIR = os.path.abspath("uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# ---------------- File Deletion Function ---------------- #
def release_file_and_delete(file_path, max_retries=5, wait_time=3):
    """Attempts to release and delete a file safely."""
    for attempt in range(max_retries):
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"✅ File deleted successfully: {file_path}")
                return
        except PermissionError:
            print(f"⚠️ File in use, retrying in {wait_time} seconds... ({attempt+1}/{max_retries})")
            time.sleep(wait_time)
    print(f"❌ Final delete attempt failed: {file_path}")

# ---------------- Upload Function ---------------- #
def upload_to_drive(file_path, file_name, folder_id):
    """Uploads a file to Google Drive and deletes it afterward."""
    if not drive_service:
        return "❌ Google Drive API not initialized. Check credentials."
    if not folder_id:
        return "❌ Folder ID is missing! Set the environment variable."

    try:
        file_metadata = {"name": file_name, "parents": [folder_id]}
        media = MediaFileUpload(file_path, mimetype="image/jpeg", resumable=False)

        file = drive_service.files().create(body=file_metadata, media_body=media, fields="id").execute()
        file_id = file.get("id")

        print(f"✅ Image uploaded successfully: {file_name} (File ID: {file_id})")

        # 🔴 Close media upload stream to release file handle
        del media  
        time.sleep(5)  # Wait before deletion

        # ✅ Ensure file deletion
        release_file_and_delete(file_path)

        return f"✅ Uploaded Successfully: {file_id}"
    except Exception as e:
        print(f"❌ Upload Failed: {repr(e)}")
        return f"❌ Upload Failed: {str(e)}"

# -------- image upalod route ----------
@app.route("/upload", methods=["POST"])
def upload_image():
    # Get Mushroom-Type from headers
    mushroom_type = request.headers.get('Mushroom-Type')
    if not mushroom_type:
        return jsonify({"error": "❌ Mushroom-Type header missing"}), 400

    # Validate the mushroom type
    mushroom = " ".join(word.capitalize() for word in mushroom_type.split())
    
    folder_map = {
        "Chestnut": CHESTNUT_FOLDER_ID,
        "Milky": MILKY_FOLDER_ID,
        "Reishi": REISHI_FOLDER_ID,
        "Shiitake": SHIITAKE_FOLDER_ID,
        "White Oyster": WHITE_OYSTER_FOLDER_ID,
    }

    folder_id = folder_map.get(mushroom)
    if not folder_id:
        return jsonify({"error": f"❌ No folder found for {mushroom}"}), 400

    # Handle the uploaded file
    if "file" not in request.files:
        return jsonify({"error": "❌ No file received"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "❌ No selected file"}), 400

    # ✅ Secure Filename
    filename = secure_filename(f"{mushroom.lower()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
    file_path = os.path.join(UPLOADS_DIR, filename)

    try:
        with open(file_path, "wb") as f:
            f.write(file.read())

        print(f"✅ File saved: {file_path}")
        time.sleep(5)  # 🔴 Give OS time to release file

        upload_status = upload_to_drive(file_path, filename, folder_id)

        status_code = 200 if "✅" in upload_status else 500
        return jsonify({"message": upload_status}), status_code

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ---------------- Capture Image from ESP32-CAM ---------------- #
# Unified Camera IP Mapping
CAMERA_IPS = {
    "chestnut": "192.168.100.192",
    "milky": "192.168.100.190",
    "reishi": "192.168.100.191",
    "shiitake": "192.168.100.189",
    "white_oyster": "192.168.100.193"
}

#------------ Stream Route-----------
def generate_frames(esp32_url):
    cap = cv2.VideoCapture(esp32_url)
    
    while True:
        success, frame = cap.read()
        if not success:
            break
        
        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        # Yield frame bytes for MJPEG streaming
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

# Streaming Relay Route
@app.route('/stream')
def stream():
    camera_id = request.args.get('camera_id')
    if not camera_id or camera_id not in CAMERA_IPS:
        return jsonify({"error": "Camera ID not found"}), 404

    esp32_ip = CAMERA_IPS[camera_id]
    esp32_stream_url = f"http://{esp32_ip}/stream_{camera_id}"
    
    return Response(generate_frames(esp32_stream_url), mimetype='multipart/x-mixed-replace; boundary=frame')

# Capture Image Route
@app.route("/capture_image/<mushroom_type>", methods=["GET"])  # Changed to GET
def capture_image(mushroom_type):
    if mushroom_type not in CAMERA_IPS:
        return jsonify({"error": "Invalid mushroom type"}), 400

    try:
        esp32_cam_url = f"http://{CAMERA_IPS[mushroom_type]}/capture_{mushroom_type}"
        response = requests.get(esp32_cam_url, timeout=10)

        if response.status_code == 200:
            filename = secure_filename(f"{mushroom_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
            image_path = os.path.join(UPLOADS_DIR, filename)

            # ✅ Ensure Uploads Directory Exists
            os.makedirs(UPLOADS_DIR, exist_ok=True)

            # Save the captured image
            with open(image_path, "wb") as f:
                f.write(response.content)

            # Map mushroom types to folder IDs
            folder_map = {
                "chestnut": CHESTNUT_FOLDER_ID,
                "milky": MILKY_FOLDER_ID,
                "reishi": REISHI_FOLDER_ID,
                "shiitake": SHIITAKE_FOLDER_ID,
                "white_oyster": WHITE_OYSTER_FOLDER_ID,
            }
            folder_id = folder_map.get(mushroom_type)
            if not folder_id:
                return jsonify({"error": "❌ Folder ID missing!"}), 500

            # Upload to Google Drive
            upload_status = upload_to_drive(image_path, filename, folder_id)
            return jsonify({"message": upload_status}), 200
        else:
            return jsonify({"error": "❌ Failed to capture image"}), 500

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"❌ ESP32-CAM Error: {str(e)}"}), 500



# ---------------- Support Ticket System ---------------- #
@app.route("/support", methods=['GET', 'POST'])
@login_required
def support():
    return render_template("support.html")

@app.route('/send_email', methods=['POST'])
@login_required
def send_email():
    # Get form data and validate inputs
    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    issue_type = request.form.get('issue_type', '').strip()
    description = request.form.get('description', '').strip()

    if not name or not email or not issue_type or not description:
        flash('All fields are required.', 'danger')
        return redirect(url_for('support'))

    subject = f"Support Ticket: {issue_type}"
    body = f"Name: {name}\nEmail: {email}\nIssue Type: {issue_type}\n\nDescription:\n{description}"

    msg = Message(subject, recipients=['ricafrenteharold1@gmail.com'], cc=[email])
    msg.body = body

    try:
        mail.send(msg)
        flash('Support ticket submitted successfully. A copy has been sent to your email.', 'success')
    except Exception as e:
        flash(f'Error sending email: {str(e)}', 'danger')

    return redirect(url_for('support'))




# ---------------- RUN APP ----------------

# if __name__ == "__main__":
#     socketio.run(app, host="0.0.0.0", port=5000, debug=True)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)