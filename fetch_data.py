import pymongo
import pandas as pd
import os

# MongoDB Connection
MONGO_URI = "mongodb+srv://mushkin123:mushkin123@cluster0.o0uof.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = pymongo.MongoClient(MONGO_URI)
db = client["sensor_data"]  # Database name

# Collections used in app.py
collections = {
    "chestnut": "chestnut_sensor_readings",
    "milky_mushroom": "milky_mushroom_sensor_readings",
    "oyster": "oyster_sensor_readings",
    "reishi": "reishi_sensor_readings",
    "shiitake": "shiitake_sensor_readings"
}

# Create folder if it doesn't exist
data_folder = "data_csv"
os.makedirs(data_folder, exist_ok=True)

# Fetch and save data for each collection
for sensor_type, collection_name in collections.items():
    collection = db[collection_name]  # Select collection
    data = list(collection.find().sort("timestamp", 1))  # Fetch sorted data

    if data:  # Check if collection is not empty
        df = pd.DataFrame(data)
        
        # Convert timestamp to datetime and drop _id
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df.drop(columns=["_id"], inplace=True)

        # Fill missing values (if any)
        df.fillna(method='ffill', inplace=True)

        # Save to CSV in data_csv folder
        csv_filename = os.path.join(data_folder, f"{sensor_type}_sensor_data.csv")
        df.to_csv(csv_filename, index=False)
        print(f"Data saved to {csv_filename}")

    else:
        print(f"No data found in {collection_name}.")

print("Data fetching complete.")
