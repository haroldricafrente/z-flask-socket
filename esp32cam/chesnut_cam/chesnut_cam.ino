#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include "time.h"
#include "esp_http_server.h"

// Replace with your Wi-Fi credentials
const char* ssid = "OT7";
const char* password = "dIk0aLAm";


// Flask server URL to handle uploads
const char* flask_server = "http://192.168.100.25/upload";

// Define camera settings
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

httpd_handle_t camera_httpd = NULL;
const long utcOffsetInSeconds = 28800; // Adjust based on timezone (e.g., UTC+8 for PH)
RTC_DATA_ATTR int capturedFlag = 0; // Track if image is captured for the day

// Initialize camera
void startCamera() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sscb_sda = SIOD_GPIO_NUM;
    config.pin_sscb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;
    
    if(psramFound()){
        config.frame_size = FRAMESIZE_SVGA; // Reduced for better performance
        config.jpeg_quality = 12;
        config.fb_count = 2;
    } else {
        config.frame_size = FRAMESIZE_VGA;
        config.jpeg_quality = 15;
        config.fb_count = 1;
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("Camera init failed with error 0x%x", err);
        delay(5000);
        ESP.restart();
    }
}

// Capture and send image to Flask
void captureAndUpload(const char* folder_id) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("Camera capture failed");
        return;
    }

    WiFiClient client;
    HTTPClient http;

    http.begin(client, flask_server);
    http.addHeader("Folder-ID", folder_id);
    int httpResponseCode = http.POST(fb->buf, fb->len);

    if (httpResponseCode > 0) {
        Serial.println("Image uploaded successfully.");
    } else {
        Serial.printf("Image upload failed. HTTP response code: %d\n", httpResponseCode);
    }

    http.end();
    esp_camera_fb_return(fb);
}

// Start camera web server
void startCameraServer() {
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 80;

    if (httpd_start(&camera_httpd, &config) == ESP_OK) {
        httpd_uri_t capture_uri = {"/capture", HTTP_GET, [](httpd_req_t *req) {
            captureAndUpload("YOUR_DEFAULT_FOLDER_ID");
            httpd_resp_send(req, "Image captured!", HTTPD_RESP_USE_STRLEN);
            return ESP_OK;
        }, NULL};
        httpd_register_uri_handler(camera_httpd, &capture_uri);
    }
}

// Check time and capture image at 6 AM
void checkTimeAndCapture() {
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
        if (timeinfo.tm_hour == 6 && timeinfo.tm_min == 0 && capturedFlag == 0) {
            Serial.println("Capturing image at 6 AM...");
            captureAndUpload("YOUR_DEFAULT_FOLDER_ID");
            capturedFlag = 1;
        } else if (timeinfo.tm_hour == 0 && timeinfo.tm_min == 1) {
            capturedFlag = 0;
        }
    }
}

// Ensure WiFi connection
void ensureWiFiConnected() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Reconnecting to WiFi...");
        WiFi.disconnect();
        WiFi.reconnect();
        int attempt = 0;
        while (WiFi.status() != WL_CONNECTED && attempt < 10) {
            delay(1000);
            Serial.print(".");
            attempt++;
        }
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("WiFi failed to reconnect, restarting...");
            ESP.restart();
        }
        Serial.println("\nWiFi Reconnected!");
    }
}

void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected.");

    startCamera();
    startCameraServer();
    configTime(utcOffsetInSeconds, 0, "pool.ntp.org", "time.nist.gov");
    struct tm timeinfo;
    while (!getLocalTime(&timeinfo)) {
        Serial.println("Waiting for NTP sync...");
        delay(2000);
    }
}

void loop() {
    ensureWiFiConnected();
    checkTimeAndCapture();
    delay(60000);
}
