import os
import time
import math
import json
import random
import asyncio
from typing import Dict, List, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, HTTPException, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="AeroVigil X — High Altitude Anti-Drone C-UAV API",
    description="Full Working Backend with Dynamic Flight Movement, Crash Location Calculator, Drone History Database, and Real-Time WebSockets.",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_API_KEYS = {
    "AVX-CMD-9948-KEY": "Central Command Console",
    "AVX-RMT-3381-KEY": "Tactical Remote Field Operator",
    "AVX-DEMO-2026-KEY": "Demo / Evaluation Key"
}

mast_poles = [
    {"id": "POLE-01", "name": "Central Command Mast Tower", "lat": 34.1800, "lng": 77.5800, "status": "ONLINE", "radar_range_m": 2500, "battery_pct": 98},
    {"id": "POLE-02", "name": "North Pass Radar Tower", "lat": 34.1910, "lng": 77.5680, "status": "ONLINE", "radar_range_m": 2000, "battery_pct": 92},
    {"id": "POLE-03", "name": "East Ridge Radar Tower", "lat": 34.1720, "lng": 77.5950, "status": "ONLINE", "radar_range_m": 2200, "battery_pct": 87},
    {"id": "POLE-04", "name": "South Valley Radar Tower", "lat": 34.1680, "lng": 77.5750, "status": "ONLINE", "radar_range_m": 2000, "battery_pct": 94}
]

drone_history_db: List[Dict[str, Any]] = [
    {
        "id": "D-00",
        "type": "Recon Drone",
        "detection_time": "14:15:02",
        "initial_dist_km": 3.1,
        "max_speed_kmh": 45.0,
        "action_taken": "RF JAMMER PULSE",
        "status": "CRASHED / DOWNED",
        "crash_time": "14:17:22",
        "crash_gps": "34.1872° N, 77.5910° E",
        "crash_dist_km": 1.1,
        "operator": "Central Command Console"
    }
]

system_state = {
    "status": "ONLINE",
    "mode": "AUTOMATIC",
    "radar_rpm": 24,
    "poles": mast_poles,
    "ptz": {"pan": 45.0, "tilt": 15.0, "zoom": 4.0},
    "jammer": {"active": False, "frequency": "2.4 GHz + 5.8 GHz + GNSS", "power_watts": 75, "mode": "DIRECTIONAL"},
    "laser": {"active": False, "power_pct": 100, "mode": "PULSED"},
    "geofence": {"active": True, "radius_meters": 2500, "center": {"lat": 34.1800, "lng": 77.5800}},
    "environmental": {"temperature_c": -12.4, "pressure_hpa": 614.2, "wind_kmh": 18.5, "wind_direction": "WSW", "altitude_m": 4200},
    "battery": {"percentage": 78, "solar_input_watts": 140, "state": "CHARGING"},
    "active_threats": [
        {
            "id": "D-01",
            "type": "Quadcopter UAV",
            "threat_level": "HIGH",
            "distance_km": 1.2,
            "altitude_m": 450,
            "speed_kmh": 35.0,
            "heading_deg": 231,
            "lat": 34.1852,
            "lng": 77.5920,
            "rf_freq": "2.42 GHz",
            "status": "INBOUND APPROACH",
            "neutralized": False,
            "crash_location": None,
            "path_history": []
        }
    ],
    "crashed_drones": [],
    "clutter_targets": [
        {"id": "B-01", "type": "BIRD", "lat": 34.1750, "lng": 77.5650, "alt": 120},
        {"id": "B-02", "type": "BIRD", "lat": 34.1920, "lng": 77.5710, "alt": 95},
        {"id": "B-03", "type": "BIRD", "lat": 34.1840, "lng": 77.5990, "alt": 210}
    ],
    "logs": []
}

def log_event(event_type: str, message: str, operator: str = "SYSTEM"):
    timestamp = time.strftime("%H:%M:%S")
    entry = {
        "id": len(system_state["logs"]) + 1,
        "time": timestamp,
        "type": event_type,
        "message": message,
        "operator": operator
    }
    system_state["logs"].insert(0, entry)
    if len(system_state["logs"]) > 100:
        system_state["logs"].pop()
    return entry

log_event("SYSTEM", "AeroVigil X Dynamic Drone Flight & Interception History Engine Active.")

def verify_api_key(x_api_key: str = Header(None, alias="x-api-key")):
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API Key in 'x-api-key' header")
    if x_api_key not in VALID_API_KEYS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API Key")
    return VALID_API_KEYS[x_api_key]

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# Background Simulation Loop (Dynamic Ikade-Tikade Movement & 1.5 Min Threat Spawner)
async def telemetry_simulator():
    t = 0
    drone_counter = 1
    last_spawn_time = time.time()

    while True:
        await asyncio.sleep(0.6)
        t += 1

        # Check 90s interval -> Archive old target & Spawn new threat drone
        if time.time() - last_spawn_time >= 90:
            drone_counter += 1
            new_id = f"D-0{drone_counter}"

            # Archive non-neutralized old drones to crashed/historical state
            for d in system_state["active_threats"]:
                if not d["neutralized"]:
                    d["neutralized"] = True
                    d["status"] = "EXPIRED / OUT OF RANGE"

            new_drone = {
                "id": new_id,
                "type": "Quadcopter UAV",
                "threat_level": "HIGH",
                "distance_km": 2.8,
                "altitude_m": 520,
                "speed_kmh": 40.0,
                "heading_deg": random.randint(0, 360),
                "lat": 34.1940 + random.uniform(-0.005, 0.005),
                "lng": 77.5890 + random.uniform(-0.005, 0.005),
                "rf_freq": "2.44 GHz",
                "status": "INBOUND APPROACH",
                "neutralized": False,
                "crash_location": None,
                "path_history": []
            }
            
            system_state["active_threats"] = [new_drone]
            last_spawn_time = time.time()

            log_entry = log_event("THREAT_SPAWN", f"NEW ALERT: Inbound Threat Drone {new_id} detected! Previous target data archived.", "RADAR_AI")

            await manager.broadcast({
                "type": "NEW_THREAT_ALERT",
                "drone": new_drone,
                "log": log_entry,
                "system_state": system_state,
                "history": drone_history_db
            })

        # Dynamic Flight Physics Animation ("Ikade Tikade Move")
        for d in system_state["active_threats"]:
            if not d["neutralized"]:
                # Zigzag turbulence movement
                angle = t * 0.08
                sweep_lat = 0.006 * math.sin(angle) + 0.002 * math.cos(t * 0.15)
                sweep_lng = 0.009 * math.cos(angle) + 0.003 * math.sin(t * 0.12)
                
                d["lat"] = 34.1800 + sweep_lat
                d["lng"] = 77.5800 + sweep_lng
                
                dist_m = math.sqrt((d["lat"] - 34.1800)**2 + (d["lng"] - 77.5800)**2) * 111000
                d["distance_km"] = round(dist_m / 1000, 2)
                d["altitude_m"] = int(420 + 60 * math.sin(t * 0.1))
                d["speed_kmh"] = round(32 + 14 * math.sin(t * 0.2), 1)
                d["heading_deg"] = int((math.degrees(angle) + 180 + 15 * math.sin(t * 0.3)) % 360)

                # Record last 15 flight path coordinates
                if "path_history" not in d: d["path_history"] = []
                d["path_history"].append([d["lat"], d["lng"]])
                if len(d["path_history"]) > 15:
                    d["path_history"].pop(0)

                # Auto-intercept when entering inner geofence
                if system_state["geofence"]["active"] and dist_m < (system_state["geofence"]["radius_meters"] * 0.35) and system_state["mode"] == "AUTOMATIC":
                    execute_drone_neutralization(d, "GEOFENCE AUTO-DEFENSE", "AUTOMATIC_GEOFENCE")

        # Move bird clutter
        for i, bird in enumerate(system_state["clutter_targets"]):
            b_angle = t * 0.04 + i
            bird["lat"] += 0.0002 * math.sin(b_angle)
            bird["lng"] += 0.0002 * math.cos(b_angle)

        await manager.broadcast({
            "type": "TELEMETRY_UPDATE",
            "timestamp": time.strftime("%H:%M:%S"),
            "data": system_state,
            "history": drone_history_db
        })

def execute_drone_neutralization(drone: dict, action_name: str, operator: str):
    drone["neutralized"] = True
    drone["status"] = "NEUTRALIZED / CRASHED"
    drone["threat_level"] = "NEUTRALIZED"

    # Calculate exact crash location (GPS coordinates)
    crash_lat = round(drone["lat"] + random.uniform(-0.0008, 0.0008), 4)
    crash_lng = round(drone["lng"] + random.uniform(-0.0008, 0.0008), 4)
    crash_dist = round(math.sqrt((crash_lat - 34.1800)**2 + (crash_lng - 77.5800)**2) * 111, 2)
    crash_gps_str = f"{crash_lat}° N, {crash_lng}° E"

    crash_info = {
        "id": drone["id"],
        "crash_lat": crash_lat,
        "crash_lng": crash_lng,
        "crash_gps": crash_gps_str,
        "crash_dist_km": crash_dist,
        "crash_time": time.strftime("%H:%M:%S"),
        "action": action_name
    }
    drone["crash_location"] = crash_info
    system_state["crashed_drones"].append(crash_info)

    # Remove moving threat drone from active_threats map list
    if drone in system_state["active_threats"]:
        system_state["active_threats"].remove(drone)

    # Save to Drone History Database
    history_entry = {
        "id": drone["id"],
        "type": drone.get("type", "Quadcopter UAV"),
        "detection_time": time.strftime("%H:%M:%S"),
        "initial_dist_km": drone.get("distance_km", 1.2),
        "max_speed_kmh": drone.get("speed_kmh", 35.0),
        "action_taken": action_name,
        "status": "CRASHED / DOWNED",
        "crash_time": time.strftime("%H:%M:%S"),
        "crash_gps": crash_gps_str,
        "crash_dist_km": crash_dist,
        "operator": operator
    }
    drone_history_db.insert(0, history_entry)
    if len(drone_history_db) > 100: drone_history_db.pop()

    log_event("NEUTRALIZATION", f"Target {drone['id']} neutralized by {action_name}. CRASH LOCATION: {crash_gps_str} ({crash_dist} km range)", operator)
    return crash_info

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_simulator())

# REST API Endpoints
@app.get("/api/v1/health")
def get_health():
    return {"status": "ok", "system": "AeroVigil X C-UAV", "time": time.time()}

@app.post("/api/v1/auth/verify-key")
def verify_key_endpoint(payload: dict):
    key = payload.get("api_key", "")
    if key in VALID_API_KEYS:
        return {"valid": True, "role": VALID_API_KEYS[key], "key": key, "message": "Authentication successful"}
    return JSONResponse(status_code=401, content={"valid": False, "message": "Invalid API Key"})

@app.get("/api/v1/status")
def get_status():
    return system_state

@app.get("/api/v1/drones/history")
def get_drone_history():
    return {"history": drone_history_db, "count": len(drone_history_db)}

class JammerPayload(BaseModel):
    activate: bool
    frequency: str = "ALL"
    target_id: str = "D-01"

@app.post("/api/v1/command/jam")
async def command_jam(payload: JammerPayload, operator: str = Depends(verify_api_key)):
    system_state["jammer"]["active"] = payload.activate
    status_str = "ACTIVATED" if payload.activate else "DEACTIVATED"
    crash_data = None

    if payload.activate:
        for d in system_state["active_threats"]:
            if d["id"] == payload.target_id or payload.target_id == "ALL":
                crash_data = execute_drone_neutralization(d, "RF JAMMER PULSE", operator)

    log_entry = log_event("JAMMER", f"RF Jamming {status_str} on target {payload.target_id}", operator)
    
    await manager.broadcast({
        "type": "COMMAND_EXECUTED",
        "action": "JAMMER",
        "target_id": payload.target_id,
        "crash_location": crash_data,
        "state": system_state["jammer"],
        "log": log_entry,
        "system_state": system_state,
        "history": drone_history_db
    })
    return {"status": "success", "jammer": system_state["jammer"], "crash_location": crash_data, "operator": operator}

class LaserPayload(BaseModel):
    activate: bool
    target_id: str = "D-01"

@app.post("/api/v1/command/laser")
async def command_laser(payload: LaserPayload, operator: str = Depends(verify_api_key)):
    system_state["laser"]["active"] = payload.activate
    status_str = "ENGAGED" if payload.activate else "DISENGAGED"
    crash_data = None

    if payload.activate:
        for d in system_state["active_threats"]:
            if d["id"] == payload.target_id:
                crash_data = execute_drone_neutralization(d, "LASER DAZZLER HARD-KILL", operator)

    log_entry = log_event("LASER", f"Laser Dazzler {status_str} targeting {payload.target_id}", operator)
    
    await manager.broadcast({
        "type": "COMMAND_EXECUTED",
        "action": "LASER",
        "target_id": payload.target_id,
        "crash_location": crash_data,
        "state": system_state["laser"],
        "log": log_entry,
        "system_state": system_state,
        "history": drone_history_db
    })
    return {"status": "success", "laser": system_state["laser"], "crash_location": crash_data, "operator": operator}

class PTZPayload(BaseModel):
    pan: float
    tilt: float
    zoom: float = 4.0
    radar_rpm: int = 24

@app.post("/api/v1/command/ptz")
async def command_ptz(payload: PTZPayload, operator: str = Depends(verify_api_key)):
    system_state["ptz"]["pan"] = max(-180.0, min(180.0, payload.pan))
    system_state["ptz"]["tilt"] = max(-30.0, min(90.0, payload.tilt))
    system_state["ptz"]["zoom"] = payload.zoom
    system_state["radar_rpm"] = max(0, min(60, payload.radar_rpm))

    log_entry = log_event("PTZ", f"PTZ Pan: {payload.pan}°, Tilt: {payload.tilt}°", operator)
    await manager.broadcast({"type": "COMMAND_EXECUTED", "action": "PTZ", "state": system_state["ptz"], "radar_rpm": system_state["radar_rpm"], "log": log_entry, "system_state": system_state})
    return {"status": "success", "ptz": system_state["ptz"]}

@app.post("/api/v1/target/spawn")
async def spawn_target(operator: str = Depends(verify_api_key)):
    # Archive previous targets
    for d in system_state["active_threats"]:
        if not d["neutralized"]:
            d["neutralized"] = True
            d["status"] = "ARCHIVED"

    new_id = f"D-0{len(drone_history_db) + 1}"
    new_drone = {
        "id": new_id,
        "type": "Quadcopter UAV",
        "threat_level": "HIGH",
        "distance_km": 2.8,
        "altitude_m": 580,
        "speed_kmh": 42.0,
        "heading_deg": 180,
        "lat": 34.1950,
        "lng": 77.5850,
        "rf_freq": "2.45 GHz",
        "status": "INBOUND APPROACH",
        "neutralized": False,
        "crash_location": None,
        "path_history": []
    }
    system_state["active_threats"] = [new_drone]
    log_entry = log_event("TARGET_SPAWN", f"New threat drone {new_id} spawned.", operator)

    await manager.broadcast({"type": "NEW_THREAT_ALERT", "drone": new_drone, "log": log_entry, "system_state": system_state, "history": drone_history_db})
    return {"status": "success", "target": new_drone}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await websocket.send_json({"type": "INITIAL_STATE", "data": system_state, "history": drone_history_db, "valid_keys_hint": list(VALID_API_KEYS.keys())})
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "PING":
                    await websocket.send_json({"type": "PONG", "timestamp": time.time()})
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

app.mount("/", StaticFiles(directory="public", html=True), name="public")
