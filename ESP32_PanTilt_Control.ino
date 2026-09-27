/*
 * ==================================================================================
 * AeroVigil X — ESP32 DevKit Pan-Tilt Servo Controller
 * ==================================================================================
 * Hardware Configuration:
 * - ESP32 DevKit Module (ESP32-WROOM-32 / DevKit V1)
 * - Pan Servo Motor (Horizontal 0° - 180°): Connected to GPIO 12
 * - Tilt Servo Motor (Vertical 0° - 180°):   Connected to GPIO 13
 *
 * Description:
 * Light-weight HTTP REST API & Web Server for ESP32. Receives live Pan/Tilt 
 * positioning commands directly from the AeroVigil X Anti-Drone Web Platform!
 * ==================================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

// Wi-Fi Configuration (Update with your Wi-Fi credentials)
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Servo Pin Assignments
const int PAN_PIN  = 12; // Pan Servo (Horizontal rotation) on GPIO 12
const int TILT_PIN = 13; // Tilt Servo (Vertical rotation) on GPIO 13

// Servo Objects
Servo panServo;
Servo tiltServo;

// Current Angles
int currentPan  = 90; // Default Center
int currentTilt = 45; // Default Horizon

// Web Server on Port 80
WebServer server(80);

// Set HTTP CORS Headers so browser web app can send requests
void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleRoot() {
  sendCORSHeaders();
  String html = "<html><head><title>AeroVigil ESP32 Pan-Tilt</title></head>";
  html += "<body style='font-family:sans-serif;background:#051321;color:#fff;text-align:center;padding:40px;'>";
  html += "<h2>🛸 AeroVigil X - ESP32 Pan-Tilt Servo Controller</h2>";
  html += "<p>Pan Pin: GPIO 12 | Tilt Pin: GPIO 13</p>";
  html += "<p>Status: <b style='color:#00ff88;'>ONLINE</b></p>";
  html += "<p>Current Pan: <b>" + String(currentPan) + "°</b> | Tilt: <b>" + String(currentTilt) + "°</b></p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleStatus() {
  sendCORSHeaders();
  String json = "{\"status\":\"ONLINE\",\"pan\":" + String(currentPan) + ",\"tilt\":" + String(currentTilt) + ",\"pan_pin\":12,\"tilt_pin\":13}";
  server.send(200, "application/json", json);
}

void handlePTZ() {
  sendCORSHeaders();
  
  if (server.hasArg("pan")) {
    int targetPan = server.arg("pan").toInt();
    targetPan = constrain(targetPan, 0, 180);
    currentPan = targetPan;
    panServo.write(currentPan);
  }

  if (server.hasArg("tilt")) {
    int targetTilt = server.arg("tilt").toInt();
    targetTilt = constrain(targetTilt, 0, 180);
    currentTilt = targetTilt;
    tiltServo.write(currentTilt);
  }

  Serial.printf("[SERVO MOVE] Pan (GPIO 12): %d° | Tilt (GPIO 13): %d°\n", currentPan, currentTilt);

  String json = "{\"success\":true,\"pan\":" + String(currentPan) + ",\"tilt\":" + String(currentTilt) + "}";
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
  Serial.println("\n--- AeroVigil X ESP32 Pan-Tilt Starting ---");

  // Allocate timers for ESP32Servo
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  // Attach Servo Motors to GPIO 12 & 13
  panServo.setPeriodHertz(50); // Standard 50Hz Servo
  tiltServo.setPeriodHertz(50);

  panServo.attach(PAN_PIN, 500, 2400);   // GPIO 12
  tiltServo.attach(TILT_PIN, 500, 2400); // GPIO 13

  // Set initial position
  panServo.write(currentPan);
  tiltServo.write(currentTilt);

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[Wi-Fi Connected!]");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // Setup Server Endpoints
  server.on("/", handleRoot);
  server.on("/api/status", handleStatus);
  server.on("/api/ptz", handlePTZ);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("HTTP Server Started on port 80");
}

void loop() {
  server.handleClient();
}
