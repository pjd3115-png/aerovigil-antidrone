/**
 * AeroVigil X — Tactical Remote Operator Console Controller
 */

let activeApiKey = "";
let currentRole = "";
let threeEngine = null;
let ws = null;

let ptzState = { pan: 45, tilt: 15, zoom: 4.0 };
let radarRpm = 24;
let jammerActive = false;
let laserActive = false;

document.addEventListener('DOMContentLoaded', () => {
    initAuthModal();
    init3D();
    initWebSocket();
});

function initAuthModal() {
    const keyInput = document.getElementById('apiKeyInput');
    const authBtn = document.getElementById('authSubmitBtn');

    // Quick fill presets
    document.querySelectorAll('.preset-key').forEach(el => {
        el.addEventListener('click', () => {
            if (keyInput) keyInput.value = el.textContent.trim();
        });
    });

    if (authBtn) {
        authBtn.addEventListener('click', authenticateKey);
    }
}

async function authenticateKey() {
    const keyInput = document.getElementById('apiKeyInput');
    const key = keyInput ? keyInput.value.trim() : "";

    if (!key) {
        alert("Please enter an API Key");
        return;
    }

    try {
        const res = await fetch('/api/v1/auth/verify-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key })
        });

        const data = await res.json();

        if (res.ok && data.valid) {
            activeApiKey = key;
            currentRole = data.role;

            document.getElementById('authOverlay').style.display = 'none';
            const badge = document.getElementById('authBadge');
            badge.className = 'auth-badge';
            badge.textContent = `✔ AUTHENTICATED: ${currentRole}`;

            logTerminal(`[AUTH] Successfully authenticated as '${currentRole}' using key '${key.substring(0, 10)}...'`);
            fetchSystemStatus();
        } else {
            alert(data.message || "Invalid API Key");
        }
    } catch (err) {
        alert("Authentication request failed: " + err.message);
    }
}

function init3D() {
    if (window.AeroVigil3D) {
        threeEngine = new window.AeroVigil3D('remote3DCanvas', {
            radarRPM: 24,
            showSolar: true
        });
    }
}

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        logTerminal("[WS] Connected to AeroVigil X Central Server");
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'TELEMETRY_UPDATE' || msg.type === 'INITIAL_STATE') {
                const data = msg.data || msg.system_state;
                if (data) syncStateFromTelemetry(data);
            } else if (msg.type === 'COMMAND_EXECUTED') {
                logTerminal(`[REMOTE SYNC] Action Executed: ${msg.action} (${msg.log ? msg.log.message : ''})`);
                if (msg.system_state) syncStateFromTelemetry(msg.system_state);
            }
        } catch (e) {
            console.error("WS Parse error:", e);
        }
    };
}

function syncStateFromTelemetry(data) {
    if (data.ptz) {
        ptzState.pan = data.ptz.pan;
        ptzState.tilt = data.ptz.tilt;
        updateHudDisplays();
        if (threeEngine) threeEngine.setPTZ(ptzState.pan, ptzState.tilt);
    }

    if (typeof data.radar_rpm !== 'undefined') {
        radarRpm = data.radar_rpm;
        const rpmSlider = document.getElementById('radarRpmSlider');
        const rpmVal = document.getElementById('radarRpmVal');
        if (rpmSlider) rpmSlider.value = radarRpm;
        if (rpmVal) rpmVal.textContent = `${radarRpm} RPM`;
        if (threeEngine) threeEngine.radarRPM = radarRpm;
    }

    if (data.jammer) {
        jammerActive = data.jammer.active;
        if (threeEngine) threeEngine.setJammerActive(jammerActive);
    }

    if (data.laser) {
        laserActive = data.laser.active;
        if (threeEngine) threeEngine.setLaserActive(laserActive);
    }
}

async function fetchSystemStatus() {
    try {
        const res = await fetch('/api/v1/status');
        const data = await res.json();
        syncStateFromTelemetry(data);
    } catch (e) {
        console.error("Status fetch failed", e);
    }
}

/* PTZ Joystick Controls */
async function movePTZ(dPan, dTilt) {
    if (!activeApiKey) {
        alert("Please authenticate with API Key first.");
        return;
    }

    ptzState.pan += dPan;
    ptzState.tilt += dTilt;

    ptzState.pan = Math.max(-180, Math.min(180, ptzState.pan));
    ptzState.tilt = Math.max(-30, Math.min(90, ptzState.tilt));

    updateHudDisplays();
    if (threeEngine) threeEngine.setPTZ(ptzState.pan, ptzState.tilt);

    // Send API Request with x-api-key header
    sendPtzCommand();
}

async function resetPTZ() {
    ptzState.pan = 0;
    ptzState.tilt = 0;
    updateHudDisplays();
    if (threeEngine) threeEngine.setPTZ(0, 0);
    sendPtzCommand();
}

async function updateRadarSpeed(val) {
    radarRpm = parseInt(val);
    document.getElementById('radarRpmVal').textContent = `${radarRpm} RPM`;
    if (threeEngine) threeEngine.radarRPM = radarRpm;
    sendPtzCommand();
}

async function sendPtzCommand() {
    try {
        await fetch('/api/v1/command/ptz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': activeApiKey
            },
            body: JSON.stringify({
                pan: ptzState.pan,
                tilt: ptzState.tilt,
                radar_rpm: radarRpm
            })
        });
    } catch (err) {
        console.error("PTZ Command error:", err);
    }
}

/* Tactical Countermeasure Actions */
async function triggerJammer() {
    if (!activeApiKey) return alert("API Key Authentication required!");
    jammerActive = !jammerActive;

    try {
        const res = await fetch('/api/v1/command/jam', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': activeApiKey
            },
            body: JSON.stringify({
                activate: jammerActive,
                frequency: "ALL",
                target_id: "D-01"
            })
        });

        const data = await res.json();
        if (res.ok) {
            logTerminal(`[COMMAND] RF Jamming ${jammerActive ? 'ACTIVATED' : 'DEACTIVATED'} via API Key.`);
            if (threeEngine) threeEngine.setJammerActive(jammerActive);
        } else {
            alert(data.detail || "Command failed");
        }
    } catch (e) {
        alert("Jammer API call failed: " + e.message);
    }
}

async function triggerLaser() {
    if (!activeApiKey) return alert("API Key Authentication required!");
    laserActive = !laserActive;

    try {
        const res = await fetch('/api/v1/command/laser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': activeApiKey
            },
            body: JSON.stringify({
                activate: laserActive,
                target_id: "D-01"
            })
        });

        const data = await res.json();
        if (res.ok) {
            logTerminal(`[COMMAND] Laser Dazzler ${laserActive ? 'ENGAGED' : 'DISENGAGED'} on Drone #D-01.`);
            if (threeEngine) threeEngine.setLaserActive(laserActive);
        }
    } catch (e) {
        alert("Laser API call failed: " + e.message);
    }
}

async function autoTrackTarget() {
    if (!activeApiKey) return alert("API Key Authentication required!");
    // Track Drone D-01 coordinates
    ptzState.pan = 68.5;
    ptzState.tilt = 32.0;
    updateHudDisplays();
    if (threeEngine) threeEngine.setPTZ(ptzState.pan, ptzState.tilt);
    logTerminal("[AUTO-TRACK] PTZ Optical Head Locked onto Drone #D-01 Target Trajectory.");
    sendPtzCommand();
}

async function toggleGeofenceLock() {
    if (!activeApiKey) return alert("API Key Authentication required!");
    try {
        const res = await fetch('/api/v1/command/geofence', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': activeApiKey
            },
            body: JSON.stringify({
                radius_meters: 1800,
                active: true
            })
        });
        if (res.ok) {
            logTerminal("[GEOFENCE] Defense zone radius locked down to 1800m.");
        }
    } catch (e) {
        console.error(e);
    }
}

function updateHudDisplays() {
    const panEl = document.getElementById('hudPan');
    const tiltEl = document.getElementById('hudTilt');
    if (panEl) panEl.textContent = `${ptzState.pan.toFixed(1)}°`;
    if (tiltEl) tiltEl.textContent = `${ptzState.tilt.toFixed(1)}°`;
}

function logTerminal(msg) {
    const term = document.getElementById('logTerminal');
    if (!term) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    const timeStr = new Date().toLocaleTimeString();
    line.innerHTML = `<span class="time">[${timeStr}]</span> ${msg}`;
    term.prepend(line);
}
