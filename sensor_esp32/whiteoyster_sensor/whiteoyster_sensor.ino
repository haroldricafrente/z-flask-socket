#include "Config.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"
#include <DFRobot_ENS160.h>

// Pin definitions
#define SOIL_MOISTURE_PIN 32  
#define DHTPIN 33             
#define DHTTYPE DHT22         
DHT dht(DHTPIN, DHTTYPE);
#define LDR_PIN 34            
#define FAN_RELAY_PIN 25      
#define LIGHT_RELAY_PIN 26    
#define HUMIDIFIER_RELAY_PIN 27 
#define BLUE_LIGHT_RELAY_PIN 35

// ENS160 sensor setup
#define I2C_COMMUNICATION
#ifdef I2C_COMMUNICATION
  DFRobot_ENS160_I2C ENS160(&Wire, 0x53);
#else
  uint8_t csPin = D3;
  DFRobot_ENS160_SPI ENS160(&SPI, csPin);
#endif

const float HUMIDITY_THRESHOLD = 85.0;
unsigned long previousMillis = 0;
const unsigned long FAN_ON_DURATION = 6 * 60 * 1000;  
const unsigned long FAN_OFF_DURATION = 1 * 60 * 1000; 
bool isFanOn = true; 

void setup() {
  Serial.begin(115200);
  dht.begin();

  pinMode(FAN_RELAY_PIN, OUTPUT);
  pinMode(LIGHT_RELAY_PIN, OUTPUT);
  pinMode(BLUE_LIGHT_RELAY_PIN, OUTPUT);
  pinMode(HUMIDIFIER_RELAY_PIN, OUTPUT);

  digitalWrite(FAN_RELAY_PIN, LOW);
  digitalWrite(LIGHT_RELAY_PIN, LOW);
  digitalWrite(BLUE_LIGHT_RELAY_PIN, LOW);
  digitalWrite(HUMIDIFIER_RELAY_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  ENS160.begin();
  ENS160.setPWRMode(ENS160_STANDARD_MODE);

  digitalWrite(LIGHT_RELAY_PIN, HIGH);
  digitalWrite(BLUE_LIGHT_RELAY_PIN, HIGH);
}

void loop() {
  unsigned long currentMillis = millis();

  if (isFanOn && (currentMillis - previousMillis >= FAN_ON_DURATION)) {
    isFanOn = false;
    digitalWrite(FAN_RELAY_PIN, LOW);
    previousMillis = currentMillis;
  } else if (!isFanOn && (currentMillis - previousMillis >= FAN_OFF_DURATION)) {
    isFanOn = true;
    digitalWrite(FAN_RELAY_PIN, HIGH);
    previousMillis = currentMillis;
  }

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int soilMoistureRaw = analogRead(SOIL_MOISTURE_PIN);
  int soilMoistureBinary = soilMoistureRaw < 2000 ? 1 : 0;
  int ldrValue = analogRead(LDR_PIN);
  uint16_t ECO2 = ENS160.getECO2();

  if (humidity < HUMIDITY_THRESHOLD) {
    digitalWrite(HUMIDIFIER_RELAY_PIN, HIGH);
  } else {
    digitalWrite(HUMIDIFIER_RELAY_PIN, LOW);
  }

  if (!isnan(temperature) && !isnan(humidity)) {
    StaticJsonDocument<200> jsonDoc;
    jsonDoc["sensor_type"] = "white_oyster";
    jsonDoc["temperature"] = temperature;
    jsonDoc["humidity"] = humidity;
    jsonDoc["soilMoisture"] = soilMoistureBinary;
    jsonDoc["lightIntensity"] = ldrValue;
    jsonDoc["ECO2"] = ECO2;
    String jsonString;
    serializeJson(jsonDoc, jsonString);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverURL);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-KEY", apiKey);

      int httpResponseCode = http.POST(jsonString);
      if (httpResponseCode > 0) {
        Serial.println("HTTP Response code: " + String(httpResponseCode));
        Serial.println("Response: " + http.getString());
      } else {
        Serial.println("Error in HTTP request");
      }
      http.end();
    } else {
      Serial.println("WiFi not connected");
    }
    Serial.println("Sensor data sent: " + jsonString);
  } else {
    Serial.println("Failed to read from sensors!");
  }

  delay(5000);
}
