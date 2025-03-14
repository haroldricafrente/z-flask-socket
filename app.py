from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
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
from werkzeug.utils import secure_filename
import json
import os

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit

# Secure Configuration
app.config["REMEMBER_COOKIE_DURATION"] = timedelta(days=30)
app.secret_key = os.getenv("SECRET_KEY", "default_secret_key")  # Fallback for missing .env
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,  # Set to True only in production (HTTPS required)
    SESSION_COOKIE_SAMESITE="Lax",
)

# MongoDB Setup
mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    raise ValueError("MONGO_URI is not set in the .env file!")

client = MongoClient(mongo_uri)
db = client['sensor_data']
users_collection = db["users"]

# Initialize Extensions
bcrypt = Bcrypt(app)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")
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
service_account_path = os.getenv("GOOGLE_SERVICE_ACCOUNT_PATH")

if not service_account_path:
    print("GOOGLE_SERVICE_ACCOUNT_PATH is not set in the .env file!")
    drive_service = None  # Prevent errors when trying to use it
else:
    try:
        creds = Credentials.from_service_account_file(
            service_account_path, scopes=["https://www.googleapis.com/auth/drive.file"]
        )
        drive_service = build("drive", "v3", credentials=creds)
        print("✅ Google Drive API initialized successfully.")
    except Exception as e:
        print(f"❌ Failed to initialize Google Drive API: {e}")
        drive_service = None

# ---------------- Mushroom Folder IDs ---------------- #
CHESTNUT_FOLDER_ID = os.getenv("CHESTNUT_FOLDER_ID")
MILKY_FOLDER_ID = os.getenv("MILKY_FOLDER_ID")
REISHI_FOLDER_ID = os.getenv("REISHI_FOLDER_ID")
SHIITAKE_FOLDER_ID = os.getenv("SHIITAKE_FOLDER_ID")
WHITE_OYSTER_FOLDER_ID = os.getenv("WHITE_OYSTER_FOLDER_ID")

# ---------------- Upload Function ---------------- #
def upload_to_drive(file_path, file_name, folder_id):
    if not drive_service:
        return "❌ Google Drive API not initialized. Check credentials."

    try:
        file_metadata = {"name": file_name, "parents": [folder_id]}
        media = MediaFileUpload(file_path, mimetype="image/jpeg", resumable=False)  # Ensuring it's not locked

        file = drive_service.files().create(body=file_metadata, media_body=media, fields="id").execute()
        file_id = file.get("id")

        print(f"✅ Image uploaded successfully: {file_name} (File ID: {file_id})")

        # Close the file and remove it after ensuring it's no longer in use
        media = None  
        os.remove(file_path)

        return f"✅ Uploaded Successfully: {file_id}"
    except Exception as e:
        print(f"❌ Upload Failed: {str(e)}")
        return f"❌ Upload Failed: {str(e)}"










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