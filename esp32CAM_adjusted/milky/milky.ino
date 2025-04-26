// (keep your includes and WiFi setup same as before)

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

const char* ssid = "OT7";
const char* password = "dIk0aLAm";

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
#define LED_GPIO_NUM       4   // <-- FLASH GPIO
#endif

static httpd_handle_t stream_httpd = NULL;

// Root handler
static esp_err_t root_handler(httpd_req_t *req) {
  const char* resp_str = "Milky Mushroom Camera is online!";
  httpd_resp_set_type(req, "text/plain");
  httpd_resp_send(req, resp_str, strlen(resp_str));
  return ESP_OK;
}

// Stream handler
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;

  res = httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=frame");
  if (res != ESP_OK) return res;

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      return ESP_FAIL;
    }

    res = httpd_resp_send_chunk(req, "--frame\r\n", strlen("--frame\r\n"));
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, "Content-Type: image/jpeg\r\n\r\n", strlen("Content-Type: image/jpeg\r\n\r\n"));
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, "\r\n", strlen("\r\n"));
    }

    esp_camera_fb_return(fb);
    if (res != ESP_OK) break;
  }

  return res;
}

// Capture image handler (with flash ON during capture)
static esp_err_t capture_image_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;

  digitalWrite(LED_GPIO_NUM, HIGH);  // Flash ON
  delay(100); // Small delay to allow lighting stabilization (optional but improves photo quality)

  fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    digitalWrite(LED_GPIO_NUM, LOW); // Flash OFF even if failed
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  digitalWrite(LED_GPIO_NUM, LOW);   // Flash OFF immediately after capture

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_type(req, "image/jpeg");
  res = httpd_resp_send(req, (const char *)fb->buf, fb->len);

  esp_camera_fb_return(fb);
  return res;
}

// Set resolution handler
static esp_err_t set_resolution_handler(httpd_req_t *req) {
  char query[20];
  char value[10];

  if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
    if (httpd_query_key_value(query, "size", value, sizeof(value)) == ESP_OK) {
      sensor_t *s = esp_camera_sensor_get();

      if (strcmp(value, "small") == 0) {
        s->set_framesize(s, FRAMESIZE_QVGA);
      } else if (strcmp(value, "medium") == 0) {
        s->set_framesize(s, FRAMESIZE_VGA);
      } else if (strcmp(value, "large") == 0) {
        s->set_framesize(s, FRAMESIZE_SVGA);
      } else {
        httpd_resp_sendstr(req, "Invalid size");
        return ESP_FAIL;
      }

      httpd_resp_sendstr(req, "Resolution updated");
      return ESP_OK;
    }
  }

  httpd_resp_sendstr(req, "Missing size parameter");
  return ESP_FAIL;
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 81;

  httpd_uri_t root_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = root_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture_image",
    .method    = HTTP_GET,
    .handler   = capture_image_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t resolution_uri = {
    .uri       = "/set_resolution",
    .method    = HTTP_GET,
    .handler   = set_resolution_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &root_uri);
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &resolution_uri);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  Serial.println();

  pinMode(LED_GPIO_NUM, OUTPUT);
  digitalWrite(LED_GPIO_NUM, LOW);  // Flash OFF initially

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

  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    ESP.restart();
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Failed to connect to WiFi. Restarting...");
    ESP.restart();
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("ESP32-CAM IP Address: ");
  Serial.println(WiFi.localIP());

  startCameraServer();
  Serial.println("Milky Mushroom Camera Ready!");
  Serial.print("Stream URL: http://");
  Serial.print(WiFi.localIP());
  Serial.println(":81/stream");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! Restarting...");
    ESP.restart();
  }
  delay(10000);
}
