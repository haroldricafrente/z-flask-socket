#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_timer.h"
#include "img_converters.h"
#include "Arduino.h"
#include "fb_gfx.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_http_server.h"

// Network credentials
const char* ssid = "OT7";
const char* password = "dIk0aLAm";

// EC2 Server Details
const char* serverAddress = "http://52.64.254.252/upload";

// Define Mushroom Type
#define MUSHROOM_TYPE "chestnut" // Options: "chestnut", "milky", "reishi", "shiitake", "white_oyster"

// NTP Server
const char* ntpServer = "time.google.com";

// Camera Model
#define CAMERA_MODEL_AI_THINKER

#if defined(CAMERA_MODEL_AI_THINKER)
  #define PWDN_GPIO_NUM     32
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
#else
  #error "Camera model not selected"
#endif

// Global Variables
httpd_handle_t stream_httpd = NULL;
long lastCapturedTime = 0;
const long captureInterval = 60000; // Check time every minute

// Time Synchronization
void syncTime() {
  configTime(8 * 3600, 0, ntpServer);  // PHT is UTC+8
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
  } else {
    Serial.println("Time synchronized");
  }
}

// Function to upload the captured image to EC2 with Mushroom Type in Header
void uploadImageToEC2(uint8_t *imgBuf, size_t imgLen) {
  HTTPClient http;
  http.begin(serverAddress);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("Mushroom-Type", MUSHROOM_TYPE);  // Added Mushroom Type header

  int httpResponseCode = http.POST(imgBuf, imgLen);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("Server Response: ");
    Serial.println(response);
  } else {
    Serial.print("Error uploading image. HTTP Code: ");
    Serial.println(httpResponseCode);
  }

  http.end();
}


// Capture Image Function
void captureAndUploadImage() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return;
  }
  uploadImageToEC2(fb->buf, fb->len);
  esp_camera_fb_return(fb);
  Serial.println("Image captured and uploaded");
}

// Time-Based Capture
void checkTimeForCapture() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return;
  }

  // Capture at 6:03 AM and 7:03 PM PHT
  if ((timeinfo.tm_hour == 6 && timeinfo.tm_min == 3) || (timeinfo.tm_hour == 19 && timeinfo.tm_min == 3)) {
    if (millis() - lastCapturedTime > 60000) {  // Avoid duplicate capture
      captureAndUploadImage();
      lastCapturedTime = millis();
    }
  }
}

// Stream handler
// Proper MJPEG Stream Handler
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;

  // Send the proper HTTP header for MJPEG streaming
  httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=frame");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    // Capture a frame from the camera
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
      break;
    }

    // Send frame boundary
    res = httpd_resp_sendstr_chunk(req, "--frame\r\n"
                                         "Content-Type: image/jpeg\r\n\r\n");
    if (res != ESP_OK) {
      esp_camera_fb_return(fb);
      break;
    }

    // Send the image
    res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    if (res != ESP_OK) {
      break;
    }

    // Send frame footer
    res = httpd_resp_sendstr_chunk(req, "\r\n");
    if (res != ESP_OK) {
      break;
    }

    delay(100);  // Small delay to avoid flooding
  }
  return res;
}


// Capture handler
static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  // Upload to EC2
  uploadImageToEC2(fb->buf, fb->len);

  // Send the image back as response
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);

  return ESP_OK;
}

// Start Camera Server with Dynamic Endpoints
void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  // Dynamic stream endpoint (e.g., /stream_chestnut)
  char stream_uri[32];
  snprintf(stream_uri, sizeof(stream_uri), "/stream_%s", MUSHROOM_TYPE);
  httpd_uri_t stream_uri_handler = {
      .uri       = stream_uri,
      .method    = HTTP_GET,
      .handler   = stream_handler,
      .user_ctx  = NULL
  };

  // Dynamic capture endpoint (e.g., /capture_chestnut)
  char capture_uri[32];
  snprintf(capture_uri, sizeof(capture_uri), "/capture_%s", MUSHROOM_TYPE);
  httpd_uri_t capture_uri_handler = {
      .uri       = capture_uri,
      .method    = HTTP_GET,
      .handler   = capture_handler,
      .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
      httpd_register_uri_handler(stream_httpd, &stream_uri_handler);
      httpd_register_uri_handler(stream_httpd, &capture_uri_handler);
  }
}

// Setup and Loop
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); //disable brownout detector
  
  Serial.begin(115200);
  Serial.setDebugOutput(false);

  // Wi-Fi connection
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Sync time
  syncTime();

  // Start streaming web server
  startCameraServer();

  Serial.print("Camera Stream Ready! Go to: http://");
  Serial.print(WiFi.localIP());
  Serial.print("/stream_");
  Serial.println(MUSHROOM_TYPE);
}

void loop() {
  checkTimeForCapture();
  delay(1000);
}
