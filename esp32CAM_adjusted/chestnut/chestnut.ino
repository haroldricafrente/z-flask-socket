#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// Wi-Fi credentials for Chestnut project
const char* ssid = "OT7";
const char* password = "dIk0aLAm";

// Select camera model (same model for Chestnut project)
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
#endif

static httpd_handle_t stream_httpd = NULL;

// Stream handler for Chestnut project
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

// Capture image handler for Chestnut project
static esp_err_t capture_image_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;

  // In your capture_image_handler function on ESP32 for Chestnut
  res = httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*"); // Allow all origins

  fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return ESP_FAIL;
  }

  res = httpd_resp_set_type(req, "image/jpeg");
  if (res != ESP_OK) return res;

  res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  if (res != ESP_OK) {
    esp_camera_fb_return(fb);
    return ESP_FAIL;
  }

  esp_camera_fb_return(fb);
  return ESP_OK;
}

// Resolution change handler for Chestnut project
static esp_err_t set_resolution_handler(httpd_req_t *req) {
  char query[20];
  char value[10];

  if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
    if (httpd_query_key_value(query, "size", value, sizeof(value)) == ESP_OK) {
      sensor_t *s = esp_camera_sensor_get();

      if (strcmp(value, "small") == 0) {
        s->set_framesize(s, FRAMESIZE_QVGA);  // 320x240
      } else if (strcmp(value, "medium") == 0) {
        s->set_framesize(s, FRAMESIZE_VGA);   // 640x480
      } else if (strcmp(value, "large") == 0) {
        s->set_framesize(s, FRAMESIZE_SVGA);  // 800x600
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
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &resolution_uri);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  Serial.println();

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
    return;
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("ESP32-CAM IP Address: ");
  Serial.println(WiFi.localIP());

  startCameraServer();
  Serial.println("Chestnut Mushroom Camera Ready! Go to: http://192.168.100.193:81/stream");
}

void loop() {
  delay(10000); // nothing to do here
}
