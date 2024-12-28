from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
from pymongo import MongoClient
import json
from bson import ObjectId
import os
from datetime import datetime, timezone

# Initialize Flask app and SocketIO
app = Flask(__name__)
CORS(app)  # Enable CORS for Flask
socketio = SocketIO(app, cors_allowed_origins="*")  # Enable CORS for Socket.IO

# Define the Custom JSON Encoder to handle ObjectId serialization
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)  # Convert ObjectId to string
        return super().default(obj)

# Set the custom JSON encoder for the app
app.json_encoder = CustomJSONEncoder

# Connect to MongoDB Atlas
client = MongoClient('mongodb+srv://mushkin123:mushkin123@cluster0.o0uof.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
db = client['sensor_data']
collection = db['sensor_readings']
relay_collection = db['relay_states']

# Serve the HTML page (index.html)
@app.route('/')
def index():
    return render_template('index.html')

# Serve the chestnut page
@app.route('/dashboard/chestnut')
def chestnut():
    return render_template('dashboard/chestnut.html')

# Serve the milky-mushroom page
@app.route('/dashboard/milky-mushroom')
def milky_mushroom():
    return render_template('dashboard/milky-mushroom.html')

# Serve the reishi page
@app.route('/dashboard/reishi')
def reishi():
    return render_template('dashboard/reishi.html')

# Serve the shiitake page
@app.route('/dashboard/shiitake')
def shiitake():
    return render_template('dashboard/shiitake.html')

# Serve the white-oyster page
@app.route('/dashboard/white-oyster')
def white_oyster():
    return render_template('dashboard/white-oyster.html')

# Serve the live page
@app.route('/live')
def live():
    esp32_cam_url = "http://192.168.100.181:81/stream"  # Replace with ESP32-CAM's IP
    return render_template("live.html", stream_url=esp32_cam_url)

# Define the /data route to receive data via POST
@app.route('/data', methods=['POST'])
def receive_data():
    data = request.json
    print("Received data:", data)
    
    # Add timestamp to the data
    data['timestamp'] = datetime.now(timezone.utc)  # Use timezone-aware datetime
    
    # Store data in MongoDB
    collection.insert_one(data)
    
    # Emit data to the frontend via Socket.IO
    socketio.emit('sensor_update', {
        'sensor_type': data.get('sensor_type'),
        'temperature': data.get('temperature'),
        'humidity': data.get('humidity'),
        'soilMoisture': data.get('soilMoisture'),
        'lightIntensity': data.get('lightIntensity'),
        'timestamp': data.get('timestamp').isoformat() + 'Z'  # Convert to ISO format
    })
    return jsonify({"status": "success"}), 200

# connection from mongoDB to create a chart
@app.route('/historical-data', methods=['GET'])
def get_historical_data():
    try:
        # Fetch the last 100 records (or adjust the limit as needed)
        historical_data = list(collection.find({'sensor_type': 'chestnut'}).sort('_id', -1).limit(100))
        # Convert ObjectId to string
        for data in historical_data:
            data['_id'] = str(data['_id'])
            data['timestamp'] = data['timestamp'].isoformat() + 'Z'  # Convert to ISO format
        # Return the data as JSON
        return jsonify(historical_data), 200
    except Exception as e:
        print(f"Error fetching historical data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/relay', methods=['POST'])
def control_relay():
    try:
        data = request.json
        print(f"Relay control received: {data}")
        relay_state = data.get('state')
        relay_device = data.get('relay')

        relay_collection.insert_one({'device': relay_device, 'state': relay_state})
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print("Error controlling relay:", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# Main entry point
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True)
