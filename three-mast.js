/**
 * AeroVigil X — Hyper-Realistic 3D Anti-Drone Hardware Engine (Three.js PBR)
 * 100% Faithful 3D Reconstruction modeled strictly after media_1789458745874.jpg
 * 
 * Includes:
 * - Top White Cylindrical 360° Radar Radome
 * - EO/IR Dual Camera Sensor Head on 360° Pan-and-Tilt Gimbal
 * - Ring of 4 Vertical Communication Antennas (4G/5G / LoRa / RF)
 * - 4-Panel Angled Solar Canopy Collar Array
 * - Rugged Military-Green Ground Electronics Enclosure with 4 Outrigger Stabilizing Legs
 * - Conceptual Internal View (NVIDIA Jetson / Raspberry Pi AI, Battery Pack, Charge Controller)
 * - Camera Presets (Front, Side, Back, Top, 3/4 Perspective)
 * - Web Audio API Tactical Sound Effects & Interactive Raycaster Inspection
 */

window.AeroVigil3D = class AeroVigil3D {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.options = Object.assign({
            interactive: true,
            autoRotate: false,
            radarRPM: 24,
            showSolar: true,
            showRadarBeam: true,
            enableAudio: true
        }, options);

        this.panDeg = 45;
        this.tiltDeg = 15;
        this.radarRPM = this.options.radarRPM;
        this.isJamming = false;
        this.isLaserActive = false;
        this.soundEnabled = true;
        this.internalViewOpen = false;

        this.initAudio();
        this.initThree();
        this.buildMaterials();
        this.buildEnvironment();
        this.buildMastSystem();
        this.setupLights();
        this.setupRaycaster();
        this.setupEvents();
        this.animate();
    }

    initAudio() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();
        } catch (e) {
            this.audioCtx = null;
        }
    }

    playTone(freq, duration, type = 'sine', gainVal = 0.1) {
        if (!this.soundEnabled || !this.audioCtx) return;
        try {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {}
    }

    playRadarPing() { this.playTone(880, 0.15, 'sine', 0.08); }
    playJammerPulseSound() { this.playTone(120, 0.4, 'sawtooth', 0.15); }
    playLaserZapSound() { this.playTone(1800, 0.25, 'triangle', 0.2); }

    initThree() {
        const width = this.container.clientWidth || 700;
        const height = this.container.clientHeight || 500;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x030c18);
        this.scene.fog = new THREE.FogExp2(0x051627, 0.012);

        this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        this.camera.position.set(5.5, 3.8, 6.8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        this.container.appendChild(this.renderer.domElement);

        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2 + 0.02;
            this.controls.minDistance = 2.0;
            this.controls.maxDistance = 18.0;
            this.controls.target.set(0, 2.2, 0);
        }
    }

    buildMaterials() {
        // Solar Panel Cell Texture
        const solarCanvas = document.createElement('canvas');
        solarCanvas.width = 256; solarCanvas.height = 256;
        const sCtx = solarCanvas.getContext('2d');
        sCtx.fillStyle = '#061730'; sCtx.fillRect(0, 0, 256, 256);
        sCtx.strokeStyle = '#2b6cb0'; sCtx.lineWidth = 2;
        for (let i = 0; i <= 256; i += 32) {
            sCtx.beginPath(); sCtx.moveTo(i, 0); sCtx.lineTo(i, 256); sCtx.stroke();
            sCtx.beginPath(); sCtx.moveTo(0, i); sCtx.lineTo(256, i); sCtx.stroke();
        }
        const solarTex = new THREE.CanvasTexture(solarCanvas);
        solarTex.wrapS = THREE.RepeatWrapping; solarTex.wrapT = THREE.RepeatWrapping;
        solarTex.repeat.set(2, 2);

        // PCB Green Circuit Board Texture
        const pcbCanvas = document.createElement('canvas');
        pcbCanvas.width = 256; pcbCanvas.height = 256;
        const pCtx = pcbCanvas.getContext('2d');
        pCtx.fillStyle = '#0f5223'; pCtx.fillRect(0, 0, 256, 256);
        pCtx.strokeStyle = '#ffd42d'; pCtx.lineWidth = 1.5;
        for (let i = 20; i < 240; i += 40) {
            pCtx.beginPath(); pCtx.moveTo(i, 10); pCtx.lineTo(i + 20, 100); pCtx.lineTo(i, 200); pCtx.stroke();
        }
        const pcbTex = new THREE.CanvasTexture(pcbCanvas);

        // PBR Physical Materials
        this.matOliveMatte = new THREE.MeshPhysicalMaterial({ color: 0x3d4d38, roughness: 0.5, metalness: 0.35, clearcoat: 0.1 });
        this.matOliveBox = new THREE.MeshPhysicalMaterial({ color: 0x465741, roughness: 0.45, metalness: 0.4, clearcoat: 0.15 });
        this.matWhiteRadome = new THREE.MeshPhysicalMaterial({ color: 0xf0f4f8, roughness: 0.25, metalness: 0.1, clearcoat: 0.3 });
        this.matSensorHousing = new THREE.MeshPhysicalMaterial({ color: 0xe6ecf0, roughness: 0.3, metalness: 0.2 });
        this.matDarkChassis = new THREE.MeshPhysicalMaterial({ color: 0x1b231c, roughness: 0.2, metalness: 0.85, clearcoat: 0.2 });
        this.matSteelBrackets = new THREE.MeshPhysicalMaterial({ color: 0xb5c5d5, roughness: 0.15, metalness: 0.95 });
        this.matSolarGlass = new THREE.MeshPhysicalMaterial({ map: solarTex, color: 0x0a2040, roughness: 0.08, metalness: 0.9, clearcoat: 0.8 });
        this.matOpticalLens = new THREE.MeshPhysicalMaterial({ color: 0x061019, metalness: 0.95, roughness: 0.03, clearcoat: 1.0 });
        this.matIRGermaniumLens = new THREE.MeshPhysicalMaterial({ color: 0x771100, metalness: 0.85, roughness: 0.05, clearcoat: 1.0, emissive: 0x330000, emissiveIntensity: 0.3 });
        this.matConcrete = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.95 });
        this.matPCB = new THREE.MeshStandardMaterial({ map: pcbTex, roughness: 0.4, metalness: 0.3 });
        this.matBatteryBlue = new THREE.MeshPhysicalMaterial({ color: 0x0a66c2, roughness: 0.3, metalness: 0.2 });
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xdbeeff, 0.8);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff7ec, 1.6);
        sun.position.set(7, 12, 7);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 30;
        sun.shadow.bias = -0.0004;
        this.scene.add(sun);

        const cyanRim = new THREE.DirectionalLight(0x00cfff, 0.9);
        cyanRim.position.set(-7, 6, -6);
        this.scene.add(cyanRim);
    }

    buildEnvironment() {
        // Concrete Deployment Pad
        const padGeo = new THREE.BoxGeometry(3.6, 0.12, 3.6);
        const pad = new THREE.Mesh(padGeo, this.matConcrete);
        pad.position.y = 0.06;
        pad.receiveShadow = true;
        this.scene.add(pad);
    }

    buildMastSystem() {
        this.rootGroup = new THREE.Group();
        this.scene.add(this.rootGroup);

        // ==========================================
        // 1. BOTTOM RUGGED ELECTRONICS ENCLOSURE & LEGS
        // ==========================================
        this.enclosureGroup = new THREE.Group();
        
        // Main Box Body
        const mainBox = new THREE.Mesh(new THREE.BoxGeometry(1.28, 1.25, 1.28), this.matOliveBox);
        mainBox.position.y = 0.745;
        mainBox.castShadow = true; mainBox.receiveShadow = true;
        mainBox.userData = { name: "Electronics Enclosure", desc: "IP67 Rugged Military Enclosure housing AI processing computer, power management & battery pack." };
        this.enclosureGroup.add(mainBox);

        // Enclosure Door (Front)
        this.doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.15, 0.06), this.matOliveMatte);
        this.doorMesh.position.set(0, 0.745, 0.65);
        this.doorMesh.castShadow = true;
        this.doorMesh.userData = { name: "Access Door Panel", desc: "Weather-sealed hinged access door with dual heavy toggle latches." };
        this.enclosureGroup.add(this.doorMesh);

        // Door Latches
        [-0.52, 0.52].forEach(lx => {
            const latch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.08), this.matSteelBrackets);
            latch.position.set(lx, 0.745, 0.68);
            this.enclosureGroup.add(latch);
        });

        // Ventilation Louvers (Sides)
        [-0.65, 0.65].forEach(sx => {
            for (let ly = 0.45; ly <= 1.05; ly += 0.12) {
                const louver = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.42), this.matDarkChassis);
                louver.position.set(sx, ly, 0);
                this.enclosureGroup.add(louver);
            }
        });

        // 4 Outrigger Stabilizing Legs
        const legPositions = [
            [-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]
        ];
        legPositions.forEach(([lx, lz]) => {
            const legStrut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), this.matDarkChassis);
            legStrut.position.set(lx, 0.32, lz);
            legStrut.castShadow = true;
            this.enclosureGroup.add(legStrut);

            const footPad = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.08, 16), this.matSteelBrackets);
            footPad.position.set(lx, 0.08, lz);
            footPad.userData = { name: "Stabilizing Leg Footpad", desc: "Heavy-duty leveling leg footpad for solid ground deployment." };
            this.enclosureGroup.add(footPad);
        });

        // ==========================================
        // 1B. INTERNAL HARDWARE (AI / BATTERY / COMMS)
        // ==========================================
        this.internalGroup = new THREE.Group();
        this.internalGroup.position.set(0, 0.745, 0.10);
        this.internalGroup.visible = true; // visible when door opened conceptually

        // AI Processor (Jetson/Raspberry Pi)
        const pcbBoard = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.36, 0.04), this.matPCB);
        pcbBoard.position.set(0, 0.32, 0.22);
        pcbBoard.userData = { name: "NVIDIA Jetson / Raspberry Pi AI", desc: "AI edge computer executing YOLOv8 real-time threat detection & tracking." };
        this.internalGroup.add(pcbBoard);

        const cpuHeatsink = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.08), this.matDarkChassis);
        cpuHeatsink.position.set(0, 0.32, 0.28);
        this.internalGroup.add(cpuHeatsink);

        // Power Management Controller
        const powerController = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.18, 0.08), this.matDarkChassis);
        powerController.position.set(0, -0.02, 0.22);
        powerController.userData = { name: "Power Management & Charge Controller", desc: "MPPT solar charge controller and power distribution module." };
        this.internalGroup.add(powerController);

        // Rechargeable Battery Pack (12V/24V)
        const batteryPack = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.32, 0.32), this.matBatteryBlue);
        batteryPack.position.set(0, -0.32, 0.22);
        batteryPack.userData = { name: "Rechargeable Battery Pack (12V/24V)", desc: "High capacity LiFePO4 battery pack providing up to 72h off-grid power." };
        this.internalGroup.add(batteryPack);

        this.enclosureGroup.add(this.internalGroup);
        this.rootGroup.add(this.enclosureGroup);

        // ==========================================
        // 2. VERTICAL CENTRAL MAST
        // ==========================================
        const mastGeo = new THREE.CylinderGeometry(0.12, 0.15, 3.4, 24);
        const mainMast = new THREE.Mesh(mastGeo, this.matOliveMatte);
        mainMast.position.y = 3.07;
        mainMast.castShadow = true;
        mainMast.userData = { name: "Vertical Central Mast", desc: "Heavy-duty telescopic steel mast with internal cable conduit." };
        this.rootGroup.add(mainMast);

        // ==========================================
        // 3. 4-PANEL ANGLED SOLAR CANOPY ARRAY
        // ==========================================
        if (this.options.showSolar) {
            const solarCollar = new THREE.Group();
            solarCollar.position.set(0, 2.7, 0);

            const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
            angles.forEach((ang, idx) => {
                const pGroup = new THREE.Group();
                pGroup.rotation.y = ang;

                const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.65), this.matSteelBrackets);
                arm.position.set(0, 0, 0.45);
                pGroup.add(arm);

                const panelGroup = new THREE.Group();
                panelGroup.position.set(0, 0, 0.78);
                panelGroup.rotation.x = Math.PI / 4.5; // Angled outward

                const frame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.05, 0.05), this.matSteelBrackets);
                frame.castShadow = true;
                panelGroup.add(frame);

                const glass = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.98, 0.02), this.matSolarGlass);
                glass.position.z = 0.03;
                glass.userData = { name: `Solar Panel #${idx + 1}`, desc: "Monocrystalline photovoltaic solar panel providing continuous off-grid power." };
                panelGroup.add(glass);

                pGroup.add(panelGroup);
                solarCollar.add(pGroup);
            });

            this.rootGroup.add(solarCollar);
        }

        // ==========================================
        // 4. COMMUNICATION ANTENNA ARRAY
        // ==========================================
        const antennaCollar = new THREE.Group();
        antennaCollar.position.set(0, 3.8, 0);

        const antPositions = [
            [-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]
        ];
        antPositions.forEach(([ax, az], idx) => {
            const antMast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 16), this.matDarkChassis);
            antMast.position.set(ax, 0.475, az);
            antMast.castShadow = true;
            antMast.userData = { name: `Comm Antenna #${idx + 1}`, desc: "4G/5G / LoRa / RF multi-frequency communication whip antenna." };
            antennaCollar.add(antMast);
        });
        this.rootGroup.add(antennaCollar);

        // ==========================================
        // 5. 360° ROTATING GIMBAL & EO/IR SENSOR HEAD
        // ==========================================
        this.ptzGroup = new THREE.Group();
        this.ptzGroup.position.set(0, 4.35, 0);

        // Rotating Gimbal Base
        const gimbalBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.24, 24), this.matDarkChassis);
        gimbalBase.position.y = 0.12;
        this.ptzGroup.add(gimbalBase);

        // Sensor Head Assembly
        this.sensorHeadGroup = new THREE.Group();
        this.sensorHeadGroup.position.set(0, 0.42, 0);

        const sensorBox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.46, 0.54), this.matSensorHousing);
        sensorBox.castShadow = true;
        sensorBox.userData = { name: "EO/IR Sensor Head Assembly", desc: "Dual Daylight Optical Camera + Thermal Infrared Heatmap Camera on 360° Gimbal." };
        this.sensorHeadGroup.add(sensorBox);

        // Left Optical Lens (Square Bezel)
        const l1Bezel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.04), this.matDarkChassis);
        l1Bezel.position.set(-0.18, 0, 0.28);
        this.sensorHeadGroup.add(l1Bezel);

        const l1Glass = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.02, 24), this.matOpticalLens);
        l1Glass.rotation.x = Math.PI / 2; l1Glass.position.set(-0.18, 0, 0.30);
        l1Glass.userData = { name: "EO Optical Camera Lens", desc: "High-resolution 1080p optical daylight visual camera." };
        this.sensorHeadGroup.add(l1Glass);

        // Right Thermal IR Lens (Dual Cylindrical Apertures)
        const l2Bezel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.04), this.matDarkChassis);
        l2Bezel.position.set(0.18, 0, 0.28);
        this.sensorHeadGroup.add(l2Bezel);

        const l2Glass = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24), this.matIRGermaniumLens);
        l2Glass.rotation.x = Math.PI / 2; l2Glass.position.set(0.18, 0.04, 0.30);
        l2Glass.userData = { name: "IR Thermal Infrared Lens", desc: "Long-wave thermal infrared (LWIR) heat sensor." };
        this.sensorHeadGroup.add(l2Glass);

        this.ptzGroup.add(this.sensorHeadGroup);

        // ==========================================
        // 6. TOP WHITE CYLINDRICAL RADAR RADOME
        // ==========================================
        this.radarGroup = new THREE.Group();
        this.radarGroup.position.set(0, 0.45, 0);

        const radomeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.10, 24), this.matDarkChassis);
        radomeBase.position.y = 0.05;
        this.radarGroup.add(radomeBase);

        // White Cylindrical Radome
        const radomeDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.42, 32), this.matWhiteRadome);
        radomeDrum.position.y = 0.31;
        radomeDrum.castShadow = true;
        radomeDrum.userData = { name: "360° Radar Module (Radome)", desc: "Primary 360-degree radar detection module scanning RF signals & drone trajectory." };
        this.radarGroup.add(radomeDrum);

        // Conical Volumetric Radar Sweep Cone
        if (this.options.showRadarBeam) {
            const coneGeo = new THREE.ConeGeometry(3.6, 7.2, 32, 1, true);
            coneGeo.rotateX(Math.PI / 2); coneGeo.translate(0, 0, 3.6);
            const coneMat = new THREE.MeshBasicMaterial({
                color: 0x19cfff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
            });
            this.radarSweepBeam = new THREE.Mesh(coneGeo, coneMat);
            this.radarSweepBeam.position.set(0, 0.31, 0);
            this.radarGroup.add(this.radarSweepBeam);
        }

        this.sensorHeadGroup.add(this.radarGroup);
        this.rootGroup.add(this.ptzGroup);
    }

    setupRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.renderer.domElement.addEventListener('click', (e) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.rootGroup.children, true);

            if (intersects.length > 0) {
                let hitObj = intersects[0].object;
                while (hitObj && !hitObj.userData.name && hitObj.parent) {
                    hitObj = hitObj.parent;
                }
                if (hitObj && hitObj.userData.name) {
                    this.playTone(1200, 0.1, 'sine', 0.1);
                    if (window.showComponentModal) {
                        window.showComponentModal(hitObj.userData.name, hitObj.userData.desc);
                    }
                }
            }
        });
    }

    setCameraView(viewName) {
        if (!this.controls) return;
        switch(viewName.toLowerCase()) {
            case 'front':
                this.camera.position.set(0, 2.8, 8.0);
                this.controls.target.set(0, 2.5, 0);
                break;
            case 'side':
                this.camera.position.set(8.0, 2.8, 0);
                this.controls.target.set(0, 2.5, 0);
                break;
            case 'back':
                this.camera.position.set(0, 2.8, -8.0);
                this.controls.target.set(0, 2.5, 0);
                break;
            case 'top':
                this.camera.position.set(0, 10.5, 0.01);
                this.controls.target.set(0, 2.5, 0);
                break;
            case 'perspective':
            default:
                this.camera.position.set(5.5, 3.8, 6.8);
                this.controls.target.set(0, 2.2, 0);
                break;
        }
        this.controls.update();
    }

    toggleInternalView() {
        this.internalViewOpen = !this.internalViewOpen;
        if (this.doorMesh) {
            this.doorMesh.position.x = this.internalViewOpen ? 0.95 : 0;
            this.doorMesh.rotation.y = this.internalViewOpen ? -Math.PI / 2 : 0;
        }
        return this.internalViewOpen;
    }

    loadGLBModel(glbUrl = 'Generated-Model.glb') {
        if (typeof THREE.GLTFLoader === 'undefined') {
            console.warn("GLTFLoader not found. Please include GLTFLoader.js script tag.");
            return;
        }

        const loader = new THREE.GLTFLoader();
        loader.load(glbUrl, (gltf) => {
            if (this.rootGroup) {
                this.rootGroup.visible = false; // Hide default procedural mast
            }
            if (this.customGLB) {
                this.scene.remove(this.customGLB);
            }

            this.customGLB = gltf.scene;

            // Compute Bounding Box for automatic centering & scaling
            const box = new THREE.Box3().setFromObject(this.customGLB);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetHeight = 5.0;
            const scale = targetHeight / (maxDim || 1);

            this.customGLB.scale.set(scale, scale, scale);
            this.customGLB.position.set(-center.x * scale, (size.y * scale) / 2 + 0.05, -center.z * scale);

            this.customGLB.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.side = THREE.DoubleSide;
                    }
                }
            });

            this.scene.add(this.customGLB);
            console.log(`Successfully loaded 3D GLB model: ${glbUrl}`);
            if (window.toast) window.toast(`Loaded custom 3D model: ${glbUrl}`);
        }, undefined, (err) => {
            console.error(`Failed to load GLB model '${glbUrl}':`, err);
        });
    }

    triggerJammer() {
        this.isJamming = true;
        this.playJammerPulseSound();
        setTimeout(() => { this.isJamming = false; }, 3000);
    }

    triggerLaser() {
        this.isLaserActive = true;
        this.playLaserZapSound();
        setTimeout(() => { this.isLaserActive = false; }, 3000);
    }

    setupEvents() {
        window.addEventListener('resize', () => {
            if (!this.container) return;
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls) this.controls.update();

        // Rotate Radar Beam
        if (this.radarGroup) {
            this.radarGroup.rotation.y += (this.radarRPM * 0.0015);
        }

        this.renderer.render(this.scene, this.camera);
    }
};

window.AeroVigilDrone3D = class AeroVigilDrone3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this.init();
    }

    init() {
        const w = this.container.clientWidth || 440;
        const h = this.container.clientHeight || 280;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020b18);

        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 50);
        this.camera.position.set(2.4, 1.5, 3.0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.target.set(0, 0, 0);
        }

        const amb = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(amb);
        const dir = new THREE.DirectionalLight(0xff3f55, 1.6);
        dir.position.set(3, 5, 4);
        this.scene.add(dir);

        this.droneGroup = new THREE.Group();
        this.scene.add(this.droneGroup);

        // Carbon Frame Body
        const bodyGeo = new THREE.BoxGeometry(0.52, 0.14, 0.52);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.3, metalness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.droneGroup.add(body);

        // Red Threat Eye Sensor
        const eyeGeo = new THREE.SphereGeometry(0.09, 16, 16);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3f55 });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(0, 0, 0.27);
        this.droneGroup.add(eye);

        // 4 Arms & Rotors
        this.rotors = [];
        const armOffsets = [
            [-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]
        ];
        armOffsets.forEach(([ax, az]) => {
            const armGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.68, 8);
            const arm = new THREE.Mesh(armGeo, bodyMat);
            arm.rotation.z = Math.PI / 2;
            arm.position.set(ax / 2, 0, az / 2);
            arm.rotation.y = Math.atan2(az, ax);
            this.droneGroup.add(arm);

            const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16), bodyMat);
            motor.position.set(ax, 0.05, az);
            this.droneGroup.add(motor);

            const rotorGeo = new THREE.BoxGeometry(0.52, 0.01, 0.04);
            const rotorMat = new THREE.MeshStandardMaterial({ color: 0x99aabb, transparent: true, opacity: 0.85 });
            const rotor = new THREE.Mesh(rotorGeo, rotorMat);
            rotor.position.set(ax, 0.11, az);
            this.droneGroup.add(rotor);
            this.rotors.push(rotor);
        });

        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        if (this.droneGroup) this.droneGroup.rotation.y += 0.012;
        if (this.rotors) {
            this.rotors.forEach(r => r.rotation.y += 0.45);
        }
        this.renderer.render(this.scene, this.camera);
    }
};
