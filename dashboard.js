/**
 * AeroVigil X — Command Dashboard & Full Live Map Navigation Controller
 * Implements Dynamic Drone Flight Path, Exact Crash Location Markers, Drone History Database, and Voice Announcements.
 */

let mapDashboard = null;
let mapFull = null;
let droneMarkerDash = null, droneMarkerFull = null;
let flightPathPolyDash = null, flightPathPolyFull = null;
let crashedMarkers = [];
let geofencePolyDash = null, geofencePolyFull = null;
let threeEngineDashboard = null;
let threeEngineShowcase = null;
let ws = null;
let voiceAlertEnabled = true;
let activeThreatDroneId = "D-01";

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initTabNavigation();
    initDashboardMap();
    initFullLiveMap();
    init3DModels();
    initCanvases();
    initWebSocket();
});

function initClock() {
    const clockEl = document.getElementById('clock');
    setInterval(() => {
        if (clockEl) clockEl.textContent = new Date().toLocaleTimeString();
    }, 1000);
}

function speakVoiceAlert(text) {
    if (!voiceAlertEnabled || !('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
    } catch (e) {}
}

function initTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            if (!targetTab) return;

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.tab-page').forEach(page => {
                page.style.display = 'none';
            });

            const activePage = document.getElementById(`tab-${targetTab}`);
            if (activePage) {
                activePage.style.display = 'block';
                toast(`Switched to ${item.textContent.trim()} view`);
            }

            if (targetTab === 'dashboard' && mapDashboard) {
                setTimeout(() => mapDashboard.invalidateSize(), 150);
            }
            if (targetTab === 'live-map' && mapFull) {
                setTimeout(() => mapFull.invalidateSize(), 150);
            }

            if (targetTab === '3d-system' && !threeEngineShowcase) {
                initShowcase3D();
            }
        });
    });
}

function initDashboardMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const center = [34.1800, 77.5800];
    mapDashboard = L.map('map', { center: center, zoom: 13, zoomControl: true });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, attribution: 'Esri Satellite'
    }).addTo(mapDashboard);

    addAntiDronePolesToMap(mapDashboard);

    geofencePolyDash = L.polygon(getGeofenceCoords(), {
        color: '#19cfff', fillColor: '#00b8e5', fillOpacity: 0.22, weight: 2
    }).addTo(mapDashboard);

    const droneIcon = L.divIcon({
        className: 'drone-threat-icon',
        html: `<div style="background:rgba(73, 20, 32, 0.95);border:1px solid #ff3f55;padding:4px 8px;border-radius:5px;color:#ff7583;font-size:11px;font-weight:bold;white-space:nowrap;box-shadow:0 0 14px #ff3f55">⚠ Drone #D-01</div>`,
        iconSize: [105, 30]
    });
    droneMarkerDash = L.marker([34.1852, 77.5920], { icon: droneIcon }).addTo(mapDashboard);
    droneMarkerDash.on('click', () => openEnemyDrone3DModal(activeThreatDroneId));

    flightPathPolyDash = L.polyline([], { color: '#ff3f55', weight: 2.5, dashArray: '4, 6' }).addTo(mapDashboard);

    addLegendToMap(mapDashboard);
}

function initFullLiveMap() {
    const mapEl = document.getElementById('mapFull');
    if (!mapEl) return;

    const center = [34.1800, 77.5800];
    mapFull = L.map('mapFull', { center: center, zoom: 13, zoomControl: true });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, attribution: 'Esri Satellite'
    }).addTo(mapFull);

    addAntiDronePolesToMap(mapFull);

    geofencePolyFull = L.polygon(getGeofenceCoords(), {
        color: '#19cfff', fillColor: '#00b8e5', fillOpacity: 0.25, weight: 2.5
    }).addTo(mapFull);

    const droneIcon = L.divIcon({
        className: 'drone-threat-icon',
        html: `<div style="background:rgba(73, 20, 32, 0.95);border:1px solid #ff3f55;padding:5px 10px;border-radius:5px;color:#ff7583;font-size:12px;font-weight:bold;white-space:nowrap;box-shadow:0 0 16px #ff3f55">⚠ Drone #D-01 (Threat)</div>`,
        iconSize: [140, 32]
    });
    droneMarkerFull = L.marker([34.1852, 77.5920], { icon: droneIcon }).addTo(mapFull);
    droneMarkerFull.on('click', () => openEnemyDrone3DModal(activeThreatDroneId));

    flightPathPolyFull = L.polyline([], { color: '#ff3f55', weight: 3, dashArray: '4, 6' }).addTo(mapFull);

    addLegendToMap(mapFull);
}

function getGeofenceCoords() {
    return [
        [34.1950, 77.5700], [34.1920, 77.5980],
        [34.1720, 77.6020], [34.1640, 77.5810], [34.1700, 77.5620]
    ];
}

function addAntiDronePolesToMap(targetMap) {
    const mastPoles = [
        {"id": "POLE-01", "name": "Central Command Mast Tower", "lat": 34.1800, "lng": 77.5800, "range": 2500},
        {"id": "POLE-02", "name": "North Pass Radar Tower", "lat": 34.1910, "lng": 77.5680, "range": 2000},
        {"id": "POLE-03", "name": "East Ridge Radar Tower", "lat": 34.1720, "lng": 77.5950, "range": 2200},
        {"id": "POLE-04", "name": "South Valley Radar Tower", "lat": 34.1680, "lng": 77.5750, "range": 2000}
    ];

    mastPoles.forEach((pole) => {
        const poleIcon = L.divIcon({
            className: 'anti-drone-pole-icon',
            html: `<div style="background:#06253c;border:2px solid #19cfff;border-radius:6px;padding:3px 7px;color:#fff;font-size:10px;font-weight:bold;box-shadow:0 0 14px #00cfff;white-space:nowrap">📡 ${pole.id}</div>`,
            iconSize: [75, 24]
        });

        const marker = L.marker([pole.lat, pole.lng], { icon: poleIcon }).addTo(targetMap);
        marker.bindPopup(`
            <div style="font-size:12px;line-height:1.6;color:#020f1a">
                <b style="color:#0877b3">📡 ${pole.name} (${pole.id})</b><br>
                Status: <span style="color:#20e99a;font-weight:bold">● ONLINE</span><br>
                Radar Coverage: <b>${pole.range} meters</b><br>
                Power: <b>Solar PV + LiFePO4 (98%)</b><br>
                <button onclick="openPole3DModal('${pole.id}', '${pole.name}')" style="margin-top:6px;background:#06253c;border:1px solid #19cfff;color:#19cfff;padding:4px 8px;border-radius:4px;font-size:10.5px;font-weight:bold;cursor:pointer;width:100%">📡 OPEN 3D MAST SYSTEM VIEWPORT</button>
            </div>
        `);
        marker.on('click', () => openPole3DModal(pole.id, pole.name));

        L.circle([pole.lat, pole.lng], {
            radius: pole.range, color: '#19cfff', weight: 1, dashArray: '3, 6', fillColor: '#00b8e5', fillOpacity: 0.06
        }).addTo(targetMap);
    });
}

function addLegendToMap(targetMap) {
    const legend = L.control({ position: 'topright' });
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'map-legend-box');
        div.style.background = 'rgba(6, 26, 44, 0.92)';
        div.style.border = '1px solid #14597d';
        div.style.padding = '10px 14px';
        div.style.borderRadius = '6px';
        div.style.fontSize = '11px';
        div.style.lineHeight = '1.8';
        div.style.color = '#e2f1f8';
        div.innerHTML = `
            <b style="color:#19cfff;display:block;margin-bottom:4px;font-size:12px">MAP LEGEND</b>
            <span style="color:#19cfff">📡 Anti-Drone System Tower Pole</span><br>
            <span style="color:#ff3f55">✈ Drone (Threat)</span><br>
            <span style="color:#ff3f55">💥 Crashed / Downed Drone</span><br>
            <span>▱ Protected Zone</span><br>
            <span style="color:#ff3f55">╌ Drone Vector Path</span>
        `;
        return div;
    };
    legend.addTo(targetMap);
}

function init3DModels() {
    if (window.AeroVigil3D && document.getElementById('hardware3dCanvas')) {
        threeEngineDashboard = new window.AeroVigil3D('hardware3dCanvas', {
            radarRPM: 24, showSolar: true, showCallouts: false, showRadarBeam: true
        });
    }
}

function initShowcase3D() {
    if (window.AeroVigil3D && document.getElementById('showcase3dCanvas')) {
        threeEngineShowcase = new window.AeroVigil3D('showcase3dCanvas', {
            radarRPM: 30, showSolar: true, showCallouts: true, showRadarBeam: true
        });
    }
}

function set3DView(viewName) {
    if (threeEngineDashboard) {
        threeEngineDashboard.setCameraView(viewName);
        toast(`Camera switched to ${viewName.toUpperCase()} view`);
    }
}

function toggleInternalDoor() {
    if (threeEngineDashboard) {
        const isOpen = threeEngineDashboard.toggleInternalView();
        toast(isOpen ? "Opened Internal Electronics Door (AI & Battery View)" : "Closed Electronics Enclosure Door");
    }
}

function loadCustomGLBModel(glbName = 'Generated-Model.glb') {
    if (threeEngineDashboard && typeof threeEngineDashboard.loadGLBModel === 'function') {
        threeEngineDashboard.loadGLBModel(glbName);
        toast(`Loading custom 3D model '${glbName}'...`);
    } else {
        toast(`3D GLTFLoader engine initializing...`);
    }
}

function initCanvases() {
    const eoCanvas = document.getElementById('eoFeedCanvas');
    if (eoCanvas) {
        const ctx = eoCanvas.getContext('2d');
        function drawEO() {
            ctx.fillStyle = '#0a1d28'; ctx.fillRect(0, 0, eoCanvas.width, eoCanvas.height);
            ctx.fillStyle = '#122c3b'; ctx.beginPath(); ctx.moveTo(0, 90); ctx.lineTo(50, 35);
            ctx.lineTo(110, 75); ctx.lineTo(170, 15); ctx.lineTo(230, 65); ctx.lineTo(280, 90); ctx.fill();

            const t = Date.now() * 0.002;
            const bx = 130 + Math.sin(t) * 12; const by = 35 + Math.cos(t) * 8;
            ctx.strokeStyle = '#ff3f55'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 36, 26);
            ctx.fillStyle = '#ff7583'; ctx.font = '9px monospace'; ctx.fillText(`Drone #${activeThreatDroneId}`, bx, by - 4);
            requestAnimationFrame(drawEO);
        }
        drawEO();
    }

    const irCanvas = document.getElementById('irFeedCanvas');
    if (irCanvas) {
        const ctx = irCanvas.getContext('2d');
        function drawIR() {
            ctx.fillStyle = '#050b10'; ctx.fillRect(0, 0, irCanvas.width, irCanvas.height);
            const grad = ctx.createLinearGradient(0, 0, 280, 132); grad.addColorStop(0, '#0a1722'); grad.addColorStop(1, '#182f42');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 280, 132);

            const t = Date.now() * 0.002; const hx = 140 + Math.sin(t) * 12; const hy = 45 + Math.cos(t) * 8;
            const radial = ctx.createRadialGradient(hx + 15, hy + 12, 2, hx + 15, hy + 12, 22);
            radial.addColorStop(0, '#ffffff'); radial.addColorStop(0.3, '#ff3f55'); radial.addColorStop(0.7, '#771122'); radial.addColorStop(1, 'transparent');
            ctx.fillStyle = radial; ctx.beginPath(); ctx.arc(hx + 15, hy + 12, 22, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ff3f55'; ctx.lineWidth = 1; ctx.strokeRect(hx, hy, 28, 22);
            requestAnimationFrame(drawIR);
        }
        drawIR();
    }

    const rfCanvas = document.getElementById('rfSpectrumCanvas');
    if (rfCanvas) {
        const ctx = rfCanvas.getContext('2d');
        function drawRF() {
            ctx.fillStyle = '#020f1a'; ctx.fillRect(0, 0, rfCanvas.width, rfCanvas.height);
            const numBars = 32; const w = rfCanvas.width / numBars;
            for (let i = 0; i < numBars; i++) {
                let h = 8 + Math.random() * 12;
                if (i >= 10 && i <= 14) { h = 50 + Math.random() * 20; ctx.fillStyle = '#ff3f55'; }
                else { ctx.fillStyle = '#159ed0'; }
                ctx.fillRect(i * w, rfCanvas.height - h, w - 2, h);
            }
            setTimeout(drawRF, 140);
        }
        drawRF();
    }
}

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);
    ws.onopen = () => { toast("Connected to AeroVigil X Real-Time Telemetry Stream"); };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'TELEMETRY_UPDATE' || msg.type === 'INITIAL_STATE') {
                const data = msg.data || msg.system_state;
                updateTelemetryUI(data);
                if (msg.history) renderDroneHistoryTable(msg.history);
            } else if (msg.type === 'NEW_THREAT_ALERT') {
                // ARCHIVE PREVIOUS TARGET & FOCUS NEW INBOUND THREAT
                activeThreatDroneId = msg.drone ? msg.drone.id : "D-01";
                const alertText = `Warning! New inbound threat drone ${activeThreatDroneId} detected in Ladakh Sector! What action should be taken?`;

                speakVoiceAlert(alertText);
                toast(`🚨 NEW THREAT ALERT: Drone #${activeThreatDroneId} Detected!`);
                openThreatActionPromptModal(activeThreatDroneId);

                if (msg.system_state) updateTelemetryUI(msg.system_state);
                if (msg.history) renderDroneHistoryTable(msg.history);
            } else if (msg.type === 'COMMAND_EXECUTED') {
                if (msg.crash_location) {
                    renderCrashLocation(msg.crash_location);
                }
                toast(`Remote Action Executed: ${msg.action}`);
                if (msg.system_state) updateTelemetryUI(msg.system_state);
                if (msg.history) renderDroneHistoryTable(msg.history);
            }
        } catch (err) {
            console.error("WS Parse error:", err);
        }
    };
    ws.onclose = () => { setTimeout(initWebSocket, 3000); };
}

function updateTelemetryUI(data) {
    if (!data) return;

    if (threeEngineDashboard) {
        if (data.ptz) threeEngineDashboard.setPTZ(data.ptz.pan, data.ptz.tilt);
        if (typeof data.radar_rpm !== 'undefined') threeEngineDashboard.radarRPM = data.radar_rpm;
        if (data.jammer) threeEngineDashboard.setJammerActive(data.jammer.active);
        if (data.laser) threeEngineDashboard.setLaserActive(data.laser.active);
    }

    if (threeEngineShowcase) {
        if (data.ptz) threeEngineShowcase.setPTZ(data.ptz.pan, data.ptz.tilt);
        if (typeof data.radar_rpm !== 'undefined') threeEngineShowcase.radarRPM = data.radar_rpm;
        if (data.jammer) threeEngineShowcase.setJammerActive(data.jammer.active);
        if (data.laser) threeEngineShowcase.setLaserActive(data.laser.active);
    }

    // Dynamic Drone Position & Path Animation ("Ikade Tikade Movement")
    if (data.active_threats && data.active_threats.length > 0) {
        const d1 = data.active_threats[0];
        activeThreatDroneId = d1.id;

        if (d1.lat && d1.lng) {
            if (droneMarkerDash) droneMarkerDash.setLatLng([d1.lat, d1.lng]);
            if (droneMarkerFull) droneMarkerFull.setLatLng([d1.lat, d1.lng]);

            // Draw Trailing Flight Path Line
            if (d1.path_history && d1.path_history.length > 0) {
                if (flightPathPolyDash) flightPathPolyDash.setLatLngs(d1.path_history);
                if (flightPathPolyFull) flightPathPolyFull.setLatLngs(d1.path_history);
            }
        }

        document.querySelectorAll('.val-drone-id').forEach(el => el.textContent = d1.id);
        document.querySelectorAll('.val-dist').forEach(el => el.textContent = `${d1.distance_km} km`);
        document.querySelectorAll('.val-alt').forEach(el => el.textContent = `${d1.altitude_m} m`);
        document.querySelectorAll('.val-speed').forEach(el => el.textContent = `${d1.speed_kmh} km/h`);
    }

    // Render Crashed Drone Markers on Maps
    if (data.crashed_drones && data.crashed_drones.length > 0) {
        data.crashed_drones.forEach(crash => renderCrashLocation(crash));
    }
}

/* Render Crashed Drone Marker, Remove Active Threat Drone from Map & Announcement */
function renderCrashLocation(crash) {
    if (!crash || !crash.crash_lat || !crash.crash_lng) return;

    // 1. DELETE / REMOVE ACTIVE MOVING THREAT DRONE MARKERS & TRAILING PATH FROM MAP
    if (droneMarkerDash && mapDashboard) {
        mapDashboard.removeLayer(droneMarkerDash);
    }
    if (droneMarkerFull && mapFull) {
        mapFull.removeLayer(droneMarkerFull);
    }
    if (flightPathPolyDash) flightPathPolyDash.setLatLngs([]);
    if (flightPathPolyFull) flightPathPolyFull.setLatLngs([]);

    // 2. DROP STATIONARY DOWNED CRASH MARKER AT CRASH GPS COORDINATES
    const crashIcon = L.divIcon({
        className: 'crashed-drone-icon',
        html: `<div style="background:#590914;border:2px solid #ff3f55;padding:4px 8px;border-radius:6px;color:#fff;font-size:11px;font-weight:bold;box-shadow:0 0 16px #ff3f55;white-space:nowrap">💥 Downed Drone #${crash.id}</div>`,
        iconSize: [120, 28]
    });

    if (mapDashboard) {
        const m1 = L.marker([crash.crash_lat, crash.crash_lng], { icon: crashIcon }).addTo(mapDashboard);
        m1.bindPopup(`<b>💥 Crashed Drone #${crash.id}</b><br>Action: ${crash.action}<br>GPS: ${crash.crash_gps}<br>Range: ${crash.crash_dist_km} km`);
        crashedMarkers.push(m1);
    }
    if (mapFull) {
        const m2 = L.marker([crash.crash_lat, crash.crash_lng], { icon: crashIcon }).addTo(mapFull);
        m2.bindPopup(`<b>💥 Crashed Drone #${crash.id}</b><br>Action: ${crash.action}<br>GPS: ${crash.crash_gps}<br>Range: ${crash.crash_dist_km} km`);
        crashedMarkers.push(m2);
    }

    // Update Alert Banner display with crash info
    const alertBox = document.getElementById('alertBox');
    if (alertBox) {
        alertBox.style.borderColor = '#ff3f55';
        const detEl = alertBox.querySelector('.alert-details');
        if (detEl) {
            detEl.innerHTML = `
                <b style="color:#ff3f55;font-size:12px">💥 Drone #${crash.id} (CRASHED / DOWNED)</b><br>
                Action Executed: <b>${crash.action}</b><br>
                GPS Location: <b style="color:#19cfff">${crash.crash_gps}</b> (${crash.crash_dist_km} km)<br>
                <span style="background:#7c121e;color:#fff;font-weight:700;padding:1px 6px;border-radius:3px;font-size:9.5px;margin-top:3px;display:inline-block">REMOVED FROM MAP</span>
            `;
        }
    }
}

/* Render Drone History Log Table */
function renderDroneHistoryTable(historyList) {
    const tbody = document.getElementById('droneHistoryTbody');
    if (!tbody || !historyList) return;

    tbody.innerHTML = '';
    historyList.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #0d3854';
        tr.innerHTML = `
            <td style="padding:8px;font-weight:bold;color:var(--cyan)">${item.id}</td>
            <td style="padding:8px">${item.type}</td>
            <td style="padding:8px">${item.detection_time}</td>
            <td style="padding:8px;color:var(--red);font-weight:bold">${item.action_taken}</td>
            <td style="padding:8px"><span style="background:#7c121e;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px">${item.status}</span></td>
            <td style="padding:8px;font-family:monospace;color:#19cfff">${item.crash_gps}</td>
            <td style="padding:8px">${item.operator}</td>
        `;
        tbody.appendChild(tr);
    });
}

function openThreatActionPromptModal(droneId = "D-01") {
    activeThreatDroneId = droneId;
    const modal = document.getElementById('threatActionModal');
    const droneIdEl = document.getElementById('promptDroneId');
    if (modal && droneIdEl) {
        droneIdEl.textContent = droneId;
        modal.style.display = 'grid';
    }
}

function closeThreatActionModal() {
    const modal = document.getElementById('threatActionModal');
    if (modal) modal.style.display = 'none';
}

async function handleOperatorChoice(choice) {
    closeThreatActionModal();

    if (choice === 'JAMMER') {
        const res = await triggerJammerDirect();
        speakVoiceAlert(`RF Jammer Countermeasure activated! Target Drone ${activeThreatDroneId} neutralized and crashed at grid location!`);
    } else if (choice === 'LASER') {
        const res = await triggerLaserDirect();
        speakVoiceAlert(`Laser Dazzler Beam engaged! Target Drone ${activeThreatDroneId} optically dazzled and crashed!`);
    } else if (choice === 'GEOFENCE') {
        speakVoiceAlert(`Geofence Auto Intercept mode enforced for Drone ${activeThreatDroneId}`);
        toast("🛡️ Geofence Auto-Defense Active!");
    } else if (choice === 'MONITOR') {
        speakVoiceAlert(`Tracking and monitoring target Drone ${activeThreatDroneId}`);
        toast("👁️ Target Lock Active (Monitoring)");
    }
}

function toggleAudio() {
    const isMuted = window.isMuted || false;
    window.isMuted = !isMuted;
    voiceAlertEnabled = !window.isMuted;
    if (threeEngineDashboard) threeEngineDashboard.soundEnabled = !window.isMuted;
    if (threeEngineShowcase) threeEngineShowcase.soundEnabled = !window.isMuted;

    const btn = document.getElementById('audioToggleBtn');
    if (btn) btn.textContent = window.isMuted ? '🔇 Muted' : '🔊 Sound On';
    toast(window.isMuted ? 'Tactical Voice & Sound Muted' : 'Tactical Voice & Sound Enabled');
}

async function acknowledgeAlert() {
    openThreatActionPromptModal(activeThreatDroneId);
}

async function triggerJammerDirect() {
    closeThreatActionModal();
    closeEnemyDroneModal();
    toast(`🔴 RF JAMMER PULSE ACTIVATED ON DRONE #${activeThreatDroneId}!`);
    speakVoiceAlert(`RF Jammer Countermeasure activated against Drone ${activeThreatDroneId}! Forced Landing Initialized! Target Downed!`);

    if (threeEngineDashboard) threeEngineDashboard.triggerJammer();
    if (threeEngineShowcase) threeEngineShowcase.triggerJammer();

    // Calculate Crash GPS Location
    const crashLat = (dronePos && dronePos.lat) ? dronePos.lat : 34.1852;
    const crashLng = (dronePos && dronePos.lng) ? dronePos.lng : 77.5920;
    const crashData = {
        id: activeThreatDroneId,
        action: "RF JAMMER PULSE",
        crash_lat: crashLat,
        crash_lng: crashLng,
        crash_gps: `${crashLat.toFixed(4)}° N, ${crashLng.toFixed(4)}° E`,
        crash_dist_km: 1.1
    };

    renderCrashLocation(crashData);
    addLocalDroneHistoryRow(activeThreatDroneId, "RF JAMMER PULSE", crashLat, crashLng);

    // Call API in background if server available
    try {
        fetch('/api/v1/command/jam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'AVX-CMD-9948-KEY' },
            body: JSON.stringify({ activate: true, target_id: activeThreatDroneId })
        }).catch(() => {});
    } catch(e) {}

    respawnNewThreatAfterDelay();
}

async function triggerLaserDirect() {
    closeThreatActionModal();
    closeEnemyDroneModal();
    toast(`⚡ LASER DAZZLER FIRED ON DRONE #${activeThreatDroneId}!`);
    speakVoiceAlert(`Laser Dazzler Beam fired at Drone ${activeThreatDroneId}! Optical sensors neutralized! Target Downed!`);

    if (threeEngineDashboard) threeEngineDashboard.triggerLaser();
    if (threeEngineShowcase) threeEngineShowcase.triggerLaser();

    const crashLat = (dronePos && dronePos.lat) ? dronePos.lat : 34.1852;
    const crashLng = (dronePos && dronePos.lng) ? dronePos.lng : 77.5920;
    const crashData = {
        id: activeThreatDroneId,
        action: "LASER DAZZLER",
        crash_lat: crashLat,
        crash_lng: crashLng,
        crash_gps: `${crashLat.toFixed(4)}° N, ${crashLng.toFixed(4)}° E`,
        crash_dist_km: 1.2
    };

    renderCrashLocation(crashData);
    addLocalDroneHistoryRow(activeThreatDroneId, "LASER DAZZLER", crashLat, crashLng);

    try {
        fetch('/api/v1/command/laser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'AVX-CMD-9948-KEY' },
            body: JSON.stringify({ activate: true, target_id: activeThreatDroneId })
        }).catch(() => {});
    } catch(e) {}

    respawnNewThreatAfterDelay();
}

function triggerGeofenceDirect() {
    closeThreatActionModal();
    closeEnemyDroneModal();
    toast(`🛡️ GEOFENCE LOCKDOWN ENFORCED ON DRONE #${activeThreatDroneId}!`);
    speakVoiceAlert(`Geofence Lockdown enforced for Drone ${activeThreatDroneId}! Target auto-intercepted!`);
}

function triggerMonitorDirect() {
    closeThreatActionModal();
    closeEnemyDroneModal();
    toast(`👁️ TARGET LOCK ACTIVE: MONITORING DRONE #${activeThreatDroneId}`);
    speakVoiceAlert(`Tracking and monitoring target Drone ${activeThreatDroneId}`);
}

let respawnTimeout = null;
function respawnNewThreatAfterDelay() {
    clearTimeout(respawnTimeout);
    respawnTimeout = setTimeout(() => {
        droneCount++;
        activeThreatDroneId = `D-0${droneCount}`;
        dronePos = { lat: 34.1850 + (Math.random()-0.5)*0.02, lng: 77.5850 + (Math.random()-0.5)*0.02, alt: 480, speed: 40 };
        document.querySelectorAll('.val-drone-id').forEach(e => e.textContent = activeThreatDroneId);
        toast(`🚨 NEW INBOUND THREAT DETECTED: Drone #${activeThreatDroneId}`);
        speakVoiceAlert(`WARNING! New inbound threat drone ${activeThreatDroneId} detected!`);
    }, 4500);
}

function addLocalDroneHistoryRow(droneId, action, lat, lng) {
    const tbody = document.getElementById('droneHistoryTbody');
    if (!tbody) return;
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid #0d3854';
    row.innerHTML = `
        <td style="padding:10px;font-weight:bold;color:var(--cyan)">${droneId}</td>
        <td style="padding:10px">Quadcopter UAV</td>
        <td style="padding:10px">${new Date().toLocaleTimeString()}</td>
        <td style="padding:10px;color:var(--red);font-weight:bold">${action}</td>
        <td style="padding:10px"><span style="background:#7c121e;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px">DOWNED</span></td>
        <td style="padding:10px;font-family:monospace;color:#19cfff">${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</td>
        <td style="padding:10px">Central Command</td>
    `;
    tbody.prepend(row);
}

/* System Mode Manager (Automatic vs Manual Attack Mode) */
let currentAttackMode = "MANUAL"; // MANUAL or AUTOMATIC

function setAttackMode(mode) {
    currentAttackMode = mode;
    const btnAuto = document.getElementById('btnModeAuto');
    const btnManual = document.getElementById('btnModeManual');

    if (btnAuto && btnManual) {
        if (mode === 'AUTOMATIC') {
            btnAuto.className = 'mode-btn active-auto';
            btnManual.className = 'mode-btn';
            toast('🤖 AUTOMATIC ATTACK MODE ENABLED: Inbound Hostile Drones Auto-Neutralized');
            speakVoiceAlert('Automatic defense mode engaged. Hostile targets will be auto-intercepted.');
        } else {
            btnAuto.className = 'mode-btn';
            btnManual.className = 'mode-btn active-manual';
            toast('👨‍✈️ MANUAL ATTACK MODE ENABLED: Operator Confirmation Required');
            speakVoiceAlert('Manual mode engaged. Awaiting operator tactical commands.');
        }
    }
}

/* PDF Defense Telemetry Report Generator */
function generateDefenseReportPDF() {
    toast("Generating Official Defense Telemetry Report...");
    speakVoiceAlert("Generating official defense telemetry report PDF.");

    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();

    const reportWindow = window.open('', '_blank', 'width=850,height=900');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>AeroVigil X — Official Defense Telemetry Report</title>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111; padding: 40px; }
                .header { border-bottom: 3px solid #063459; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
                .logo { font-size: 26px; font-weight: bold; color: #063459; }
                .logo span { color: #0099cc; }
                .sub { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
                .meta-box { background: #f0f4f8; border: 1px solid #c0d0e0; padding: 14px; border-radius: 6px; margin-bottom: 24px; font-size: 12px; line-height: 1.8; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
                th { background: #063459; color: #fff; padding: 8px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #ddd; }
                .crashed { color: #cc0000; font-weight: bold; }
                .friendly { color: #008800; font-weight: bold; }
                .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #777; text-align: center; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="logo">AeroVigil <span>X</span></div>
                    <div class="sub">High Altitude Anti-Drone C-UAV Platform — Telemetry Report</div>
                </div>
                <div style="text-align:right;font-size:11px;color:#444">
                    <b>Sector:</b> Ladakh Sector (34.18° N, 77.58° E)<br>
                    <b>Generated:</b> ${dateStr} ${timeStr}
                </div>
            </div>

            <div class="meta-box">
                <b>System Status:</b> ONLINE & OPERATIONAL &nbsp;|&nbsp; <b>Defense Mode:</b> ${currentAttackMode}<br>
                <b>Radar Detection Module:</b> 360° AESA White Radome (5 km Range) &nbsp;|&nbsp; <b>Power Level:</b> 94% (Solar + Battery)<br>
                <b>Active Sensors:</b> EO Optical Camera, IR Thermal LWIR, 4G/5G Comm Antennas, Edge AI Computer
            </div>

            <h3>📊 Drone Interception & Neutralization Log</h3>
            <table>
                <thead>
                    <tr>
                        <th>Target ID</th>
                        <th>Type</th>
                        <th>IFF Identity</th>
                        <th>Detection Time</th>
                        <th>Action Executed</th>
                        <th>Status</th>
                        <th>Crash GPS Coordinates</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><b>D-01</b></td>
                        <td>Inbound Quadcopter</td>
                        <td><span class="crashed">🔴 HOSTILE THREAT</span></td>
                        <td>14:31:52</td>
                        <td>RF JAMMER PULSE</td>
                        <td><span class="crashed">DOWNED</span></td>
                        <td>34.1872° N, 77.5910° E</td>
                    </tr>
                    <tr>
                        <td><b>F-101</b></td>
                        <td>Army Patrol UAV</td>
                        <td><span class="friendly">🟢 FRIENDLY (आपले)</span></td>
                        <td>14:26:10</td>
                        <td>SAFE PASSAGE</td>
                        <td><span class="friendly">ACTIVE PATROL</span></td>
                        <td>N/A (In Flight)</td>
                    </tr>
                    <tr>
                        <td><b>D-00</b></td>
                        <td>Recon UAV</td>
                        <td><span class="crashed">🔴 HOSTILE THREAT</span></td>
                        <td>14:15:02</td>
                        <td>LASER DAZZLER</td>
                        <td><span class="crashed">DOWNED</span></td>
                        <td>34.1915° N, 77.5822° E</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                CONFIDENTIAL — FOR DEFENSE SURVEILLANCE & EVALUATION PURPOSES ONLY • AEROVIGIL X SIH 2026
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

/* Open Full Screen Live Vision Camera Viewport Modal */
function openFullCameraView(type) {
    const title = type === 'EO' ? 'EO Visual Camera Stream (1080p PTZ)' : 'IR Thermal Heatmap Stream (640x512)';
    toast(`Opening Full Screen ${title}...`);
    speakVoiceAlert(`Expanding live ${type} camera vision.`);
    
    const modal = document.getElementById('cameraVisionModal');
    const modalTitle = document.getElementById('cameraVisionTitle');
    if (modal && modalTitle) {
        modalTitle.textContent = title;
        modal.style.display = 'grid';
    }
}

function closeCameraVisionModal() {
    const modal = document.getElementById('cameraVisionModal');
    if (modal) modal.style.display = 'none';
}

async function spawnNewTarget() {
    try {
        const res = await fetch('/api/v1/target/spawn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'AVX-CMD-9948-KEY' }
        });
        const data = await res.json();
        if (res.ok) {
            toast(`🛸 New Target ${data.target.id} Spawned in Ladakh Sector!`);
            speakVoiceAlert(`Warning! New inbound threat drone ${data.target.id} spawned! Select action now!`);
            openThreatActionPromptModal(data.target.id);
        }
    } catch (e) {
        alert("Spawn call failed: " + e.message);
    }
}

function toast(msg) {
    const t = document.getElementById('toastbox');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        t.style.display = 'none';
    }, 2500);
}

/* -------------------------------------------------------------
 * 3D POLE MAST MODAL VIEWPORT CONTROLLER
 * ------------------------------------------------------------- */
let poleModal3DEngine = null;

function openPole3DModal(poleId = "POLE-01", poleName = "Central Command Mast Tower") {
    toast(`Opening 3D Viewport for ${poleName} (${poleId})...`);
    speakVoiceAlert(`Opening 3D Hardware Viewport for ${poleName}`);

    const modal = document.getElementById('pole3DModal');
    const titleEl = document.getElementById('poleModalTitle');
    if (titleEl) titleEl.textContent = `📡 ${poleName} (${poleId}) — 3D Viewport`;
    if (modal) modal.style.display = 'grid';

    setTimeout(() => {
        const container = document.getElementById('poleModal3DCanvas');
        if (container && window.AeroVigil3D) {
            container.innerHTML = '';
            poleModal3DEngine = new window.AeroVigil3D('poleModal3DCanvas', {
                radarRPM: 28, showSolar: true, showRadarBeam: true
            });
        }
    }, 100);
}

function closePole3DModal() {
    const modal = document.getElementById('pole3DModal');
    if (modal) modal.style.display = 'none';
    poleModal3DEngine = null;
}

function modalSet3DView(viewName) {
    if (poleModal3DEngine) {
        poleModal3DEngine.setCameraView(viewName);
        toast(`3D Camera set to ${viewName.toUpperCase()} view`);
    }
}

function modalLoadGLB() {
    if (poleModal3DEngine && typeof poleModal3DEngine.loadGLBModel === 'function') {
        poleModal3DEngine.loadGLBModel('Generated-Model.glb');
        toast("Loading 'Generated-Model.glb' into 3D Modal...");
    }
}

function modalToggleInternalDoor() {
    if (poleModal3DEngine) {
        const isOpen = poleModal3DEngine.toggleInternalView();
        toast(isOpen ? "Opened Enclosure Access Door" : "Closed Access Door");
    }
}

/* -------------------------------------------------------------
 * 3D ENEMY THREAT DRONE INSPECTOR MODAL CONTROLLER
 * ------------------------------------------------------------- */
let enemyDrone3DEngine = null;

function openEnemyDrone3DModal(droneId = "D-01") {
    toast(`Opening 3D Inspector for Hostile Drone #${droneId}...`);
    speakVoiceAlert(`WARNING! Inspecting 3D Threat Model for Hostile Drone ${droneId}!`);

    const modal = document.getElementById('enemyDroneModal');
    const droneIdEl = document.getElementById('enemyDroneModalId');
    if (droneIdEl) droneIdEl.textContent = droneId;
    if (modal) modal.style.display = 'grid';

    setTimeout(() => {
        const container = document.getElementById('enemyDrone3DCanvas');
        if (container && window.AeroVigilDrone3D) {
            container.innerHTML = '';
            enemyDrone3DEngine = new window.AeroVigilDrone3D('enemyDrone3DCanvas');
        }
    }, 100);
}

function closeEnemyDroneModal() {
    const modal = document.getElementById('enemyDroneModal');
    if (modal) modal.style.display = 'none';
    enemyDrone3DEngine = null;
}
