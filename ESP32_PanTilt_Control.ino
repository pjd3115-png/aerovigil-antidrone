/*
 * ==================================================================================
 * AeroVigil X — ESP32 DevKit Pan-Tilt Servo Controller (Native LEDC PWM - No Library Required)
 * ==================================================================================
 * Hardware Connections:
 * - ESP32 DevKit Board (ESP32 WROOM / V1)
 * - Pan Servo Signal Wire (Yellow/Orange):  GPIO 12
 * - Tilt Servo Signal Wire (Yellow/Orange): GPIO 13
 * - Servo Red Wire:                         5V (VIN / External 5V Power)
 * - Servo Brown/Black Wire:                 GND (Common Ground with ESP32!)
 *
 * NOTE ON POWER:
 * Servo motors require strong 5V power. Connect Servo GND to ESP32 GND!
 * ==================================================================================
 */

#include <WiFi.h>
#include <WebServer.h>

// Wi-Fi Credentials (Change to your Wi-Fi name and password)
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Servo Pins
const int PAN_PIN  = 12; // Pan Servo on GPIO 12
const int TILT_PIN = 13; // Tilt Servo on GPIO 13

// LEDC PWM Channels & Frequency
const int PAN_CHANNEL  = 0;
const int TILT_CHANNEL = 1;
const int PWM_FREQ     = 50; // Standard 50Hz Servo Frequency
const int PWM_RES      = 16; // 16-bit Resolution (0 - 65535)

// Current Angles
int currentPan  = 90;
int currentTilt = 45;

WebServer server(80);

// Function to convert angle (0-180°) to 16-bit LEDC duty cycle
uint32_t angleToDuty(int angle) {
  angle = constrain(angle, 0, 180);
  // 0° = ~500us duty (1638), 180° = ~2500us duty (8192)
  uint32_t duty = map(angle, 0, 180, 1638, 8192);
  return duty;
}

void writePan(int angle) {
  currentPan = constrain(angle, 0, 180);
#if ESP_IDF_VERSION_MAJOR >= 5
  ledcWrite(PAN_PIN, angleToDuty(currentPan));
#else
  ledcWrite(PAN_CHANNEL, angleToDuty(currentPan));
#endif
  Serial.printf("Pan (GPIO 12): %d°\n", currentPan);
}

void writeTilt(int angle) {
  currentTilt = constrain(angle, 0, 180);
#if ESP_IDF_VERSION_MAJOR >= 5
  ledcWrite(TILT_PIN, angleToDuty(currentTilt));
#else
  ledcWrite(TILT_CHANNEL, angleToDuty(currentTilt));
#endif
  Serial.printf("Tilt (GPIO 13): %d°\n", currentTilt);
}

void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handlePTZ() {
  sendCORSHeaders();
  
  if (server.hasArg("pan")) {
    int p = server.arg("pan").toInt();
    writePan(p);
  }

  if (server.hasArg("tilt")) {
    int t = server.arg("tilt").toInt();
    writeTilt(t);
  }

  String json = "{\"status\":\"OK\",\"pan\":" + String(currentPan) + ",\"tilt\":" + String(currentTilt) + "}";
  server.send(200, "application/json", json);
}

void handleStatus() {
  sendCORSHeaders();
  String json = "{\"status\":\"ONLINE\",\"module\":\"ESP32_DevKit\",\"pan\":" + String(currentPan) + ",\"tilt\":" + String(currentTilt) + "}";
  server.send(200, "application/json", json);
}

void handleNotFound() {
  sendCORSHeaders();
  if (server.method() == HTTP_OPTIONS) {
    server.send(204);
  } else {
    server.send(404, "text/plain", "Not Found");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==========================================");
  Serial.println("AeroVigil X — ESP32 DevKit Pan-Tilt Servo Setup");
  Serial.println("==========================================");

  // Configure Native ESP32 LEDC PWM Channels
#if ESP_IDF_VERSION_MAJOR >= 5
  ledcAttach(PAN_PIN, PWM_FREQ, PWM_RES);
  ledcAttach(TILT_PIN, PWM_FREQ, PWM_RES);
#else
  ledcSetup(PAN_CHANNEL, PWM_FREQ, PWM_RES);
  ledcSetup(TILT_CHANNEL, PWM_FREQ, PWM_RES);
  ledcAttachPin(PAN_PIN, PAN_CHANNEL);
  ledcAttachPin(TILT_PIN, TILT_CHANNEL);
#endif

  // TEST SWEEP ON STARTUP to verify hardware connection!
  Serial.println("Testing Servo Motor Movement (Self-Test Sweep)...");
  writePan(45);  writeTilt(30); delay(600);
  writePan(135); writeTilt(90); delay(600);
  writePan(90);  writeTilt(45); delay(600);
  Serial.println("Self-Test Complete! Servos set to Center (90°, 45°).");

  // Connect Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[Wi-Fi CONNECTED SUCCESS!]");
  Serial.print("ESP32 Local IP Address: ");
  Serial.println(WiFi.localIP());

  server.on("/api/ptz", handlePTZ);
  server.on("/api/status", handleStatus);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("AeroVigil WebServer Active on Port 80");
}

void loop() {
  server.handleClient();
}
