#include "Config.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"
#include <DFRobot_ENS160.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

// Pin definitions
#define SOIL_MOISTURE_PIN 13
#define DHTPIN 27
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);
#define LDR_PIN 34
#define FAN_RELAY_PIN 25
#define LIGHT_RELAY_PIN 32
#define HUMIDIFIER_RELAY_PIN 33
#define BLUE_LIGHT_RELAY_PIN 26
#define COOLER_RELAY_PIN 23

// ENS160 sensor setup
#define I2C_COMMUNICATION
#ifdef I2C_COMMUNICATION
DFRobot_ENS160_I2C ENS160(&Wire, 0x53);
#else
uint8_t csPin = D3;
DFRobot_ENS160_SPI ENS160(&SPI, csPin);
#endif

// WiFi & Time Setup
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "time.google.com", 28800, 60000);  // PHT (UTC+8)

// Humidity thresholds for Reishi mushrooms
const int HUMIDITY_HIGH_THRESHOLD = 85;
const int HUMIDITY_LOW_THRESHOLD = 90;

// Timing variables
unsigned long previousFanMillis = 0;
unsigned long previousSensorMillis = 0;
unsigned long previousWiFiCheckMillis = 0;
unsigned long currentMillis = 0;

// Timing intervals
const long fanOnDuration = 60000;
const long fanOffDuration = 360000;
const long sensorReadInterval = 5000;
const long wifiCheckInterval = 10000;

// Actuator states
bool fanState = false;
bool lightState = false;
bool humidifierState = false;
bool blueLightState = false;
bool coolerState = false;

void setup() {
  Serial.begin(115200);
  dht.begin();

  // Pin initialization
  pinMode(FAN_RELAY_PIN, OUTPUT);
  pinMode(LIGHT_RELAY_PIN, OUTPUT);
  pinMode(BLUE_LIGHT_RELAY_PIN, OUTPUT);
  pinMode(HUMIDIFIER_RELAY_PIN, OUTPUT);
  pinMode(COOLER_RELAY_PIN, OUTPUT);

  // Default states (active-low relays)
  digitalWrite(FAN_RELAY_PIN, HIGH);
  digitalWrite(LIGHT_RELAY_PIN, HIGH);
  digitalWrite(BLUE_LIGHT_RELAY_PIN, HIGH);
  digitalWrite(HUMIDIFIER_RELAY_PIN, HIGH);
  digitalWrite(COOLER_RELAY_PIN, HIGH);

  // WiFi setup
  connectWiFi();

  // Time setup
  timeClient.begin();
  ENS160.begin();
  ENS160.setPWRMode(ENS160_STANDARD_MODE);
}

void loop() {
  currentMillis = millis();

  // Check WiFi periodically
  if (currentMillis - previousWiFiCheckMillis >= wifiCheckInterval) {
    checkWiFiConnection();
    previousWiFiCheckMillis = currentMillis;
  }

  // Update time client
  timeClient.update();
  Serial.print("Synced Time: ");
  Serial.print(timeClient.getHours());
  Serial.print(":");
  Serial.println(timeClient.getMinutes());

  // Sensor readings every 5 seconds
  if (currentMillis - previousSensorMillis >= sensorReadInterval) {
    previousSensorMillis = currentMillis;

    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    int soilMoistureRaw = analogRead(SOIL_MOISTURE_PIN);
    int soilMoistureBinary = soilMoistureRaw < 2000 ? 1 : 0;
    int ldrValue = analogRead(LDR_PIN);
    uint16_t ECO2 = ENS160.getECO2();

    // Control actuators
    controlFan();
    controlLights();
    controlHumidifier(humidity);
    controlBlueLight();
    controlCooler();

    // Send data to server
    if (!isnan(temperature) && !isnan(humidity)) {
      sendToServer(temperature, humidity, soilMoistureBinary, ldrValue, ECO2);
    } else {
      Serial.println("Failed to read from sensors!");
    }
  }
}

// ======== WiFi Management ========
void connectWiFi() {
  Serial.print("Connecting to WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost. Reconnecting...");
    connectWiFi();
  }
}

// ======== Actuator Control ========
void controlFan() {
  if (fanState && (currentMillis - previousFanMillis >= fanOnDuration)) {
    digitalWrite(FAN_RELAY_PIN, HIGH);
    fanState = false;
    previousFanMillis = currentMillis;
    Serial.println("Fan OFF");
  } else if (!fanState && (currentMillis - previousFanMillis >= fanOffDuration)) {
    digitalWrite(FAN_RELAY_PIN, LOW);
    fanState = true;
    previousFanMillis = currentMillis;
    Serial.println("Fan ON");
  }
}

void controlLights() {
  int currentHour = timeClient.getHours();
  int currentMinute = timeClient.getMinutes();

  // Turn light ON at 6 AM and 7 PM for 10 minutes
  if ((currentHour == 6 && currentMinute < 10) || (currentHour == 19 && currentMinute < 10)) {
    digitalWrite(LIGHT_RELAY_PIN, LOW);  // Active-low relay: LOW = ON
    lightState = true;
  } else {
    digitalWrite(LIGHT_RELAY_PIN, HIGH);  // Active-low relay: HIGH = OFF
    lightState = false;
  }
}

void controlHumidifier(float humidity) {
  if (humidity >= HUMIDITY_HIGH_THRESHOLD) {
    digitalWrite(HUMIDIFIER_RELAY_PIN, HIGH);
    humidifierState = false;
  } else if (humidity <= HUMIDITY_LOW_THRESHOLD) {
    digitalWrite(HUMIDIFIER_RELAY_PIN, LOW);
    humidifierState = true;
  }
}

void controlBlueLight() {
  if (timeClient.getHours() >= 7 && timeClient.getHours() < 17) {
    digitalWrite(BLUE_LIGHT_RELAY_PIN, LOW);
    blueLightState = true;
  } else {
    digitalWrite(BLUE_LIGHT_RELAY_PIN, HIGH);
    blueLightState = false;
  }
}

void controlCooler() {
  if (timeClient.getHours() >= 11 && timeClient.getHours() < 14) {
    digitalWrite(COOLER_RELAY_PIN, LOW);
    coolerState = true;
  } else {
    digitalWrite(COOLER_RELAY_PIN, HIGH);
    coolerState = false;
  }
}

// ======== Send Data to Server ========
void sendToServer(float temperature, float humidity, int soilMoisture, int ldrValue, uint16_t ECO2) {
  StaticJsonDocument<256> jsonDoc;
  jsonDoc["sensor_type"] = "reishi";
  jsonDoc["temperature"] = temperature;
  jsonDoc["humidity"] = humidity;
  jsonDoc["soilMoisture"] = soilMoisture;
  jsonDoc["lightIntensity"] = ldrValue;
  jsonDoc["ECO2"] = ECO2;

  // Add actuator states
  jsonDoc["fanState"] = fanState;
  jsonDoc["lightState"] = lightState;
  jsonDoc["humidifierState"] = humidifierState;
  jsonDoc["blueLightState"] = blueLightState;
  jsonDoc["coolerState"] = coolerState;

  String jsonString;
  serializeJson(jsonDoc, jsonString);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-KEY", apiKey);

    int httpResponseCode = http.POST(jsonString);
    Serial.println("HTTP Response code: " + String(httpResponseCode));
    http.end();
  } else {
    Serial.println("WiFi not connected, data not sent");
  }

  Serial.println("Sensor data sent: " + jsonString);
}
