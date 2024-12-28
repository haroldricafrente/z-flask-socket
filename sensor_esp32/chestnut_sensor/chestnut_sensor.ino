#include "WiFiCredentials.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"

#define DHTPIN 33         // GPIO where the DHT22 data pin is connected
#define DHTTYPE DHT22     // DHT 22 (AM2302)
DHT dht(DHTPIN, DHTTYPE);

#define SOIL_MOISTURE_PIN 32  // GPIO where the soil moisture sensor is connected
#define LDR_PIN 34            // GPIO where the LDR is connected
#define RELAY_PIN 25          // GPIO where the relay is connected

const char* serverURL = "http://192.168.100.25:5000/data";      // Flask server endpoint
const char* relayControlURL = "http://192.168.100.25:5000/relay";  // Flask server endpoint for relay control

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  dht.begin();

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // Ensure relay is off initially

  // Connect to Wi-Fi
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi!");
}

void loop() {
  // Read temperature and humidity from DHT22
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // Read soil moisture value (0-4095)
  int soilMoistureRaw = analogRead(SOIL_MOISTURE_PIN);
  float soilMoisturePercent = map(soilMoistureRaw, 0, 4095, 0, 100);

  // Read light intensity from LDR (0-4095)
  int ldrValue = analogRead(LDR_PIN);
  float lightIntensityPercent = map(ldrValue, 0, 4095, 0, 100);

  // Check if the sensor readings are valid
  if (!isnan(temperature) && !isnan(humidity)) {
    // Create JSON string for sensor data
    String sensorData = String("{") +
                        "\"sensor_type\":\"chestnut\"," +  // Add sensor type
                        "\"temperature\":" + temperature + "," +                        
                        "\"humidity\":" + humidity + "," +
                        "\"soilMoisture\":" + soilMoisturePercent + "," +
                        "\"lightIntensity\":" + lightIntensityPercent + "}";

    // Send data to Flask server
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverURL);
      http.addHeader("Content-Type", "application/json");

      int httpResponseCode = http.POST(sensorData);
      if (httpResponseCode > 0) {
          String response = http.getString();
          Serial.println("HTTP Response code: " + String(httpResponseCode));
          Serial.println("Response: " + response);
      } else {
          Serial.println("Error in HTTP request");
          Serial.println("HTTP Response code: " + String(httpResponseCode));
          Serial.println("Error details: " + http.errorToString(httpResponseCode));
      }
      http.end();
    } else {
      Serial.println("WiFi not connected");
    }

    Serial.println("Sensor data sent: " + sensorData);
  } else {
    Serial.println("Failed to read from DHT sensor!");
  }

  delay(5000); // Adjust delay as needed
}

// Function to handle relay control
void handleRelayControl(String relay, bool state) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(relayControlURL);
    http.addHeader("Content-Type", "application/json");

    String relayData = String("{") +
                       "\"relay\":\"" + relay + "\"," +
                       "\"state\":\"" + (state ? "ON" : "OFF") + "\"}";

    int httpResponseCode = http.POST(relayData);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("HTTP Response code: " + String(httpResponseCode));
      Serial.println("Response: " + response);
    } else {
      Serial.println("Error in HTTP request");
      Serial.println("HTTP Response code: " + String(httpResponseCode));
      Serial.println("Error details: " + http.errorToString(httpResponseCode));
    }
    http.end();
  } else {
    Serial.println("WiFi not connected");
  }
}

