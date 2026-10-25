import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useSimulationStore } from "../store/useSimulationStore";
import {
  createTextSprite,
  createFloorTexture,
  decorateStationMesh,
  createArticulatedAgentRig,
  animateArticulatedAgent,
} from "./scene3dBuilders";
import { buildBistrotInterior, decorateBistrotStation } from "./venues/BistrotLumiere3D";
import { buildOsteriaInterior, decorateOsteriaStation } from "./venues/OsteriaBellavista3D";
import { buildSakanaInterior, decorateSakanaStation } from "./venues/SakanaTei3D";
import { populateStationTaskModels, populateTableServedDishes } from "./assets/CulinaryAssets3D";
import {
  populateStationShelfUnits,
  buildSortedStorageRack3D,
  buildSortedBarBottleShelf3D,
} from "./assets/KitchenBarShelves3D";

const STATUS_COLORS = {
  AVAILABLE: 0x10b981,
  SEATED: 0x3b82f6,
  DINING_COURSE_1: 0xf59e0b,
  DINING_COURSE_2: 0xf97316,
  DINING_COURSE_3: 0xa855f7,
  REQUESTING_BILL: 0xeab308,
  PAYING_BILL: 0x06b6d4,
  PAID_SEATED: 0x14b8a6,
  NEEDS_CLEARING: 0xef4444,
  CLEARING_TABLE: 0xf43f5e,
  COOKING: 0xf97316,
  PREP_BATCH: 0xf59e0b,
  RECEIVING_STOCK: 0x06b6d4,
  READY_AT_PASS: 0x10b981,
  READY_FOR_PICKUP: 0x10b981,
  QUEUED: 0x3b82f6,
  WASHING: 0x38bdf8,
  IDLE: 0x64748b,
};

export default function StreetScene3D() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const interactiveMeshesRef = useRef([]);
  const tableVisualsRef = useRef({});
  const stationVisualsRef = useRef({});
  const agentMeshesRef = useRef({});
  const wallMeshesRef = useRef([]);
  const selectionRingRef = useRef(null);
  const navPathLineRef = useRef(null);
  const keysPressedRef = useRef(new Set());
  const walkModeRef = useRef(false);

  const bootstrap = useSimulationStore((s) => s.bootstrap);
  const cameraPreset = useSimulationStore((s) => s.cameraPreset);
  const cutawayWalls = useSimulationStore((s) => s.cutawayWalls);
  const selectSceneObject = useSimulationStore((s) => s.selectSceneObject);
  const provenanceTrace = useSimulationStore((s) => s.provenanceTrace);
  const stopProvenanceTrace = useSimulationStore((s) => s.stopProvenanceTrace);
  const timestampMs = useSimulationStore((s) => s.timestampMs);
  const setTimestampMs = useSimulationStore((s) => s.setTimestampMs);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const setPlaybackSpeed = useSimulationStore((s) => s.setPlaybackSpeed);

  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [walkMode, setWalkMode] = useState(false);

  const toggleWalkMode = () => {
    const next = !walkModeRef.current;
    walkModeRef.current = next;
    setWalkMode(next);
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (cam && ctrl) {
      if (next) {
        // Drop to 1.72m pedestrian eye level on the cobblestone promenade facing the restaurants
        const dir = new THREE.Vector3().subVectors(ctrl.target, cam.position);
        dir.y = 0;
        if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
        dir.normalize();
        const startX = THREE.MathUtils.clamp(ctrl.target.x, 4, 58);
        const startZ = THREE.MathUtils.clamp(ctrl.target.z + 6, -4, 19.5);
        cam.position.set(startX, 1.72, startZ);
        ctrl.target.set(startX + dir.x * 5.5, 1.64, startZ + dir.z * 5.5);
        ctrl.minDistance = 0.5;
        ctrl.maxPolarAngle = Math.PI * 0.62;
        ctrl.update();
      } else {
        ctrl.minDistance = 3.5;
        ctrl.maxPolarAngle = Math.PI / 2 - 0.03;
        cam.position.set(31, 24, 38);
        ctrl.target.set(31, 0, 7);
        ctrl.update();
      }
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !bootstrap) return;

    const w = container.clientWidth || 1200;
    const h = container.clientHeight || 800;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.0055);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(44, w / h, 0.2, 240);
    camera.position.set(31, 28, 44);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(31, 0, 7);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 3.5;
    controls.maxDistance = 105;
    controls.update();
    controlsRef.current = controls;

    // Warm Natural Sunlight + Interior Chandelier & Hearth Point Lights
    scene.add(new THREE.AmbientLight(0xfffbeb, 0.72));
    scene.add(new THREE.HemisphereLight(0xbae6fd, 0x334155, 0.58));

    const sun = new THREE.DirectionalLight(0xfff7ed, 1.55);
    sun.position.set(42, 48, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 140;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    // Warm interior chandelier / hearth fill lights for each venue
    const interiorLights = [
      { x: 11, y: 2.9, z: 7.5, color: 0xfde68a, intensity: 1.1, dist: 18 },
      { x: 11, y: 2.8, z: -3.2, color: 0xfffbeb, intensity: 0.9, dist: 14 },
      { x: 33, y: 2.9, z: 9.0, color: 0xfed7aa, intensity: 1.15, dist: 18 },
      { x: 33, y: 2.6, z: 2.2, color: 0xfb923c, intensity: 1.0, dist: 14 },
      { x: 53, y: 2.9, z: 8.8, color: 0xfef3c7, intensity: 1.1, dist: 18 },
      { x: 53, y: 2.6, z: 2.2, color: 0xfde047, intensity: 0.95, dist: 14 },
    ];
    for (const il of interiorLights) {
      const pLight = new THREE.PointLight(il.color, il.intensity, il.dist, 1.4);
      pLight.position.set(il.x, il.y, il.z);
      scene.add(pLight);
    }

    const interactiveMeshes = [];
    const wallMeshes = [];
    const tableVisuals = {};
    const stationVisuals = {};

    // 1. Commercial Street Base, Cobblestone Promenade & Roadway
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(125, 85),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(31, -0.04, 10);
    ground.receiveShadow = true;
    scene.add(ground);

    const sidewalkTex = createFloorTexture("cobblestone", "#64748b", 72, 10);
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(74, 0.08, 9.5),
      new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.82 })
    );
    sidewalk.position.set(31, 0.0, 18.75);
    sidewalk.receiveShadow = true;
    scene.add(sidewalk);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(74, 0.06, 7.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
    );
    road.position.set(31, -0.01, 27.1);
    road.receiveShadow = true;
    scene.add(road);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let rx = -2; rx <= 64; rx += 4.5) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.18), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(rx, 0.03, 27.1);
      scene.add(stripe);
    }

    // Boulevard Lamps & Olive/Plane Trees
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.25 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });

    for (const lx of [-1, 14, 23, 36, 43, 58]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 4.2, 10), poleMat);
      pole.position.set(lx, 2.1, 23.1);
      pole.castShadow = true;
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), bulbMat);
      lamp.position.set(lx, 4.3, 23.1);
      scene.add(lamp);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.8, 8), trunkMat);
      trunk.position.set(lx + 1.8, 0.9, 22.8);
      trunk.castShadow = true;
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), foliageMat);
      crown.position.set(lx + 1.8, 2.4, 22.8);
      crown.castShadow = true;
      scene.add(crown);
    }

    // 2. Build Multi-Venue Restaurant Interiors, Textured Floors, Partitions & Signboards
    const premisesList = bootstrap.premises || [];
    for (const prem of premisesList) {
      for (const z of prem.zones || []) {
        let pattern = "herringbone_parquet";
        if (prem.businessId === "business-osteria-bellavista") {
          pattern = z.zoneType === "kitchen" ? "carrara_marble" : "terracotta_tiles";
        } else if (prem.businessId === "business-sakana-tei") {
          pattern = z.zoneType === "kitchen" || z.zoneType === "terrace" ? "slate_stone" : "hinoki_wood";
        } else if (z.zoneType === "kitchen" || z.zoneType === "storage") {
          pattern = "carrara_marble";
        }

        const tex = createFloorTexture(pattern, z.floorColor || "#b45309", z.width, z.depth);
        const fMesh = new THREE.Mesh(
          new THREE.BoxGeometry(z.width, 0.1, z.depth),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.58 })
        );
        fMesh.position.set(z.x + z.width / 2, 0.02, z.z + z.depth / 2);
        fMesh.receiveShadow = true;
        fMesh.userData = {
          sceneObjectId: `scene-${prem._id}`,
          label: `${prem.name} — ${z.name}`,
        };
        scene.add(fMesh);
      }

      const b = prem.bounds;
      const bw = b.maxX - b.minX;
      const interiorDepth = 14.0 - b.minZ;
      const minZ = b.minZ;

      const wallColor =
        prem.businessId === "business-bistrot-lumiere"
          ? 0xfef3c7
          : prem.businessId === "business-osteria-bellavista"
          ? 0xffedd5
          : 0xf1f5f9;

      const wMat = new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: 0.72,
        transparent: true,
        opacity: 0.9,
      });

      // North Back Wall
      const northWall = new THREE.Mesh(new THREE.BoxGeometry(bw, 3.1, 0.18), wMat.clone());
      northWall.position.set(b.minX + bw / 2, 1.55, minZ);
      northWall.castShadow = true;
      scene.add(northWall);
      wallMeshes.push({ mesh: northWall, fullH: 3.1, cutawayH: 1.45 });

      // West & East Side Walls
      const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.1, interiorDepth), wMat.clone());
      westWall.position.set(b.minX, 1.55, minZ + interiorDepth / 2);
      westWall.castShadow = true;
      scene.add(westWall);
      wallMeshes.push({ mesh: westWall, fullH: 3.1, cutawayH: 0.95 });

      const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.1, interiorDepth), wMat.clone());
      eastWall.position.set(b.maxX, 1.55, minZ + interiorDepth / 2);
      eastWall.castShadow = true;
      scene.add(eastWall);
      wallMeshes.push({ mesh: eastWall, fullH: 3.1, cutawayH: 0.95 });

      // Interior Kitchen-to-Dining Partition Wall Segments (leaving kitchen doorways & pass windows open)
      const partMat = new THREE.MeshStandardMaterial({
        color:
          prem.businessId === "business-bistrot-lumiere"
            ? 0x7f1d1d
            : prem.businessId === "business-osteria-bellavista"
            ? 0xd6d3d1
            : 0x334155,
        roughness: 0.6,
        transparent: true,
        opacity: 0.88,
      });

      if (prem.businessId === "business-bistrot-lumiere") {
        const partWall = new THREE.Mesh(new THREE.BoxGeometry(13.8, 2.55, 0.16), partMat);
        partWall.position.set(7.1, 1.275, 0.0);
        scene.add(partWall);
        wallMeshes.push({ mesh: partWall, fullH: 2.55, cutawayH: 0.9 });
        buildBistrotInterior(scene, prem, interactiveMeshes);
      } else if (prem.businessId === "business-osteria-bellavista") {
        const partWest = new THREE.Mesh(new THREE.BoxGeometry(6.1, 2.55, 0.16), partMat.clone());
        partWest.position.set(27.25, 1.275, 5.0);
        scene.add(partWest);
        wallMeshes.push({ mesh: partWest, fullH: 2.55, cutawayH: 0.9 });

        const partEast = new THREE.Mesh(new THREE.BoxGeometry(4.1, 2.55, 0.16), partMat.clone());
        partEast.position.set(39.75, 1.275, 5.0);
        scene.add(partEast);
        wallMeshes.push({ mesh: partEast, fullH: 2.55, cutawayH: 0.9 });

        buildOsteriaInterior(scene, prem, interactiveMeshes);
      } else if (prem.businessId === "business-sakana-tei") {
        const partWest = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.55, 0.16), partMat.clone());
        partWest.position.set(47.5, 1.275, 5.0);
        scene.add(partWest);
        wallMeshes.push({ mesh: partWest, fullH: 2.55, cutawayH: 0.9 });

        buildSakanaInterior(scene, prem, interactiveMeshes);
      }

      // Signboard above each specialty restaurant
      const signMeta =
        prem.businessId === "business-bistrot-lumiere"
          ? { title: "BISTROT LUMIÈRE", sub: "Brasserie Française & Cuisine Niçoise", color: "#f59e0b" }
          : prem.businessId === "business-osteria-bellavista"
          ? { title: "OSTERIA BELLAVISTA", sub: "Trattoria Toscana • Pasta Fresca & Bistecca", color: "#ef4444" }
          : { title: "SAKANA-TEI 魚亭", sub: "Omakase Sushi Hinoki & Binchotan Robata", color: "#10b981" };

      const signSprite = createTextSprite(
        signMeta.title,
        "rgba(15, 23, 42, 0.94)",
        "#ffffff",
        signMeta.color,
        signMeta.sub
      );
      signSprite.scale.set(6.2, 1.35, 1);
      signSprite.position.set(b.minX + bw / 2, 3.85, 14.0);
      signSprite.userData = { sceneObjectId: `scene-${prem._id}`, label: prem.name };
      scene.add(signSprite);
    }

    // 3. Build All Interactive Tables & Specialized Kitchen/Bar/Pass Stations
    for (const obj of bootstrap.sceneObjects || []) {
      if (obj.objectType === "premises_building" || obj.objectType === "employee_agent") continue;
      const tr = obj.transform || { x: 0, y: 0, z: 0, width: 1, depth: 1, height: 0.8 };
      const group = new THREE.Group();
      group.position.set(tr.x, tr.y || 0, tr.z);
      group.userData = {
        sceneObjectId: obj.sceneObjectId,
        label: obj.label,
        objectType: obj.objectType,
        businessId: obj.businessId,
        domainEntityType: obj.domainEntityType,
        domainEntityId: obj.domainEntityId,
      };

      if (obj.domainEntityType === "table") {
        const isRound = obj.shape === "round";
        const isSakana = obj.businessId === "business-sakana-tei";
        const isOsteria = obj.businessId === "business-osteria-bellavista";

        const topGeo = isRound
          ? new THREE.CylinderGeometry(tr.width / 2, tr.width / 2, 0.06, 24)
          : new THREE.BoxGeometry(tr.width, 0.06, tr.depth);

        const woodColor = isSakana ? 0xd97706 : isOsteria ? 0x5c2d0c : 0xfef3c7;

        const topMesh = new THREE.Mesh(
          topGeo,
          new THREE.MeshStandardMaterial({ color: woodColor, roughness: isSakana ? 0.35 : 0.42 })
        );
        topMesh.position.y = 0.73;
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        group.add(topMesh);

        // Parisian Brass Rim on Bistrot Tables
        if (!isSakana && !isOsteria && isRound) {
          const brassRim = new THREE.Mesh(
            new THREE.TorusGeometry(tr.width / 2, 0.015, 8, 28),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 })
          );
          brassRim.rotation.x = Math.PI / 2;
          brassRim.position.y = 0.74;
          group.add(brassRim);
        }

        // Tablecloth / Status Mat
        const clothGeo = isRound
          ? new THREE.CylinderGeometry(tr.width * 0.41, tr.width * 0.41, 0.015, 20)
          : new THREE.BoxGeometry(tr.width * 0.82, 0.015, tr.depth * 0.82);
        const clothMat = new THREE.MeshStandardMaterial({ color: STATUS_COLORS.AVAILABLE, roughness: 0.5 });
        const clothMesh = new THREE.Mesh(clothGeo, clothMat);
        clothMesh.position.y = 0.768;
        group.add(clothMesh);

        // Table Centerpiece Accent (Bistrot brass lamp, Osteria Chianti bottle, Sakana soy cruet)
        if (isSakana) {
          const soyCruet = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.038, 0.11, 10),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25 })
          );
          soyCruet.position.set(0.06, 0.82, 0);
          group.add(soyCruet);
        } else if (isOsteria) {
          const chianti = new THREE.Mesh(
            new THREE.CylinderGeometry(0.022, 0.048, 0.16, 10),
            new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.2 })
          );
          chianti.position.set(-0.05, 0.84, 0.03);
          group.add(chianti);
        } else {
          const lampShade = new THREE.Mesh(
            new THREE.ConeGeometry(0.065, 0.08, 12),
            new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.45 })
          );
          lampShade.position.set(0, 0.89, 0);
          group.add(lampShade);
        }

        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.15, 0.72, 12),
          new THREE.MeshStandardMaterial({
            color: isSakana ? 0x78350f : 0x1e293b,
            metalness: isSakana ? 0.15 : 0.65,
            roughness: 0.35,
          })
        );
        leg.position.y = 0.36;
        group.add(leg);

        // Chairs with Backrests & Branded Upholstery around Table (backrests facing outward, seats facing table center)
        const seatCount = obj.seats || 2;
        const chairFrameMat = new THREE.MeshStandardMaterial({
          color: isSakana ? 0x1e293b : isOsteria ? 0x451a03 : 0x3b1306,
          roughness: 0.5,
        });
        const cushionMat = new THREE.MeshStandardMaterial({
          color: isSakana ? 0x065f46 : isOsteria ? 0x9a3412 : 0x991b1b,
          roughness: 0.7,
        });
        const napkinMat = new THREE.MeshStandardMaterial({
          color: isSakana ? 0x334155 : isOsteria ? 0xfef3c7 : 0xffffff,
          roughness: 0.85,
        });
        const waterGlassMat = new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.65,
          roughness: 0.1,
        });

        const chairSettings = [];
        for (let ci = 0; ci < seatCount; ci++) {
          const angle = (ci / seatCount) * Math.PI * 2;
          const radius = Math.max(tr.width, tr.depth) * 0.58;
          const chairGroup = new THREE.Group();
          chairGroup.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
          // Backrest is at +0.16 Z in chair local space; rotate so +Z points radially outward from table center
          chairGroup.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));

          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.38), cushionMat);
          seat.position.y = 0.44;
          seat.castShadow = true;
          chairGroup.add(seat);

          const back = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.05), chairFrameMat);
          back.position.set(0, 0.65, 0.165);
          back.castShadow = true;
          chairGroup.add(back);

          // 4 Chair Legs instead of single post for realistic furniture
          for (const [lx, lz] of [
            [-0.15, -0.15],
            [0.15, -0.15],
            [-0.15, 0.15],
            [0.15, 0.15],
          ]) {
            const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.42, 8), chairFrameMat);
            cLeg.position.set(lx, 0.21, lz);
            chairGroup.add(cLeg);
          }

          group.add(chairGroup);

          // Default Place Setting (Folded Linen Napkin + Water Goblet) on Table Top
          const settingRadius = Math.max(tr.width, tr.depth) * 0.29;
          const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.15), napkinMat);
          napkin.position.set(Math.cos(angle) * settingRadius, 0.774, Math.sin(angle) * settingRadius);
          napkin.rotation.y = Math.atan2(-Math.cos(angle), -Math.sin(angle));
          napkin.visible = false;
          group.add(napkin);

          const waterGoblet = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.085, 10), waterGlassMat);
          waterGoblet.position.set(
            Math.cos(angle - 0.32) * (settingRadius + 0.03),
            0.812,
            Math.sin(angle - 0.32) * (settingRadius + 0.03)
          );
          waterGoblet.visible = false;
          group.add(waterGoblet);

          chairSettings.push({ napkin, waterGoblet });
        }

        // Dynamic Plated Dishes Group (populated in real time from tState.servedDishes)
        const dishesGroup = new THREE.Group();
        dishesGroup.visible = false;
        group.add(dishesGroup);

        const cleanTableTitle = obj.tableLabel || obj.label.split("—")[0].trim();
        const badge = createTextSprite(cleanTableTitle, "rgba(15, 23, 42, 0.88)", "#f8fafc", "#10b981", `${seatCount} couverts`);
        badge.scale.set(1.55, 0.42, 1);
        badge.position.set(0, 1.36, 0);
        group.add(badge);

        tableVisuals[obj.domainEntityId] = {
          group,
          clothMat,
          chairSettings,
          dishesGroup,
          badge,
          cleanTableTitle,
          seatCount,
          width: tr.width,
          depth: tr.depth,
          businessId: obj.businessId,
          lastDishesSignature: "",
          lastBadgeSignature: "",
        };
      } else {
        // Specialized Kitchen / Bar / Pass / Storage Station
        const isHot = ["hot_kitchen", "grill_hearth", "pasta_station", "wok_fryer"].includes(obj.stationKind);
        const isBarOrCounter = ["bar", "sushi_counter", "pass"].includes(obj.stationKind);
        const isStorage = obj.objectType === "ingredient_storage";

        const baseColor = isHot
          ? 0x334155
          : isBarOrCounter
          ? 0x78350f
          : isStorage
          ? 0x0f766e
          : 0x475569;

        const bodyH = tr.height || 0.95;
        const bodyMat = new THREE.MeshStandardMaterial({
          color: baseColor,
          metalness: isHot ? 0.55 : 0.2,
          roughness: 0.4,
        });
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(tr.width, bodyH, tr.depth), bodyMat);
        bodyMesh.position.y = bodyH / 2;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        // Countertop Slab
        const topSurface = new THREE.Mesh(
          new THREE.BoxGeometry(tr.width + 0.05, 0.05, tr.depth + 0.05),
          new THREE.MeshStandardMaterial({
            color: obj.equipmentStyle === "hinoki_sushi_bar" ? 0xfde68a : isBarOrCounter ? 0xfef3c7 : 0xe2e8f0,
            metalness: isBarOrCounter ? 0.15 : 0.45,
            roughness: 0.25,
          })
        );
        topSurface.position.y = bodyH + 0.025;
        group.add(topSurface);

        // Dispatch to each specialty restaurant's dedicated 3D station decorator
        if (obj.businessId === "business-bistrot-lumiere") {
          decorateBistrotStation(group, obj, tr);
        } else if (obj.businessId === "business-osteria-bellavista") {
          decorateOsteriaStation(group, obj, tr);
        } else if (obj.businessId === "business-sakana-tei") {
          decorateSakanaStation(group, obj, tr);
        } else {
          decorateStationMesh(group, obj, tr);
        }

        // Attach 3-Tier Sorted Shelving Rack on Cold Storage / Garde-Manger / Bar Stations
        if (isStorage || obj.stationKind === "cold_storage" || obj.stationKind === "kitchen_cold") {
          buildSortedStorageRack3D(group, obj, tr);
        } else if (obj.stationKind === "bar") {
          buildSortedBarBottleShelf3D(group, obj, tr);
        }

        // Dynamic 3D Cookware & Food Group on Station Top
        const cookwareGroup = new THREE.Group();
        group.add(cookwareGroup);

        // Dynamic 3D Physical Stock Units Group on Station Tiers (for Storage, Fridge & Bar)
        const shelfUnitsGroup = new THREE.Group();
        group.add(shelfUnitsGroup);

        // Status Beacon
        const beaconMat = new THREE.MeshBasicMaterial({ color: STATUS_COLORS.IDLE });
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), beaconMat);
        beacon.position.set(-tr.width * 0.42, bodyH + 0.25, tr.depth * 0.38);
        group.add(beacon);

        // Station Title + Live Active Dish Banner
        const cleanTitle = obj.label.split("(")[0].trim();
        const stBadge = createTextSprite(cleanTitle, "rgba(15, 23, 42, 0.9)", "#f8fafc", "#38bdf8", "En attente");
        stBadge.scale.set(2.55, 0.58, 1);
        stBadge.position.set(0, bodyH + 0.86, 0);
        group.add(stBadge);

        stationVisuals[obj.domainEntityId] = {
          group,
          cleanTitle,
          bodyH,
          width: tr.width,
          depth: tr.depth,
          stationKind: obj.stationKind,
          objectType: obj.objectType,
          bodyMat,
          beaconMat,
          beacon,
          cookwareGroup,
          shelfUnitsGroup,
          stBadge,
          lastSignature: "",
          lastShelfSignature: "",
        };
      }

      group.traverse((child) => {
        if (child.isMesh) {
          child.userData = { ...group.userData };
          interactiveMeshes.push(child);
        }
      });

      scene.add(group);
    }

    // Selection Highlight Ring
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.88, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.08;
    ringMesh.visible = false;
    scene.add(ringMesh);
    selectionRingRef.current = ringMesh;

    // Active Agent Waypoint Navigation Path Line on Floor
    const navLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.12, 0),
      new THREE.Vector3(0, 0.12, 0),
    ]);
    const navLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const navLine = new THREE.Line(navLineGeo, navLineMat);
    navLine.visible = false;
    scene.add(navLine);
    navPathLineRef.current = navLine;

    interactiveMeshesRef.current = interactiveMeshes;
    wallMeshesRef.current = wallMeshes;
    tableVisualsRef.current = tableVisuals;
    stationVisualsRef.current = stationVisuals;
    agentMeshesRef.current = {};

    // Keyboard WASD + Arrow + Q/E Navigation Listeners
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        keysPressedRef.current.add(k);
      }
    };
    const onKeyUp = (e) => {
      keysPressedRef.current.delete(e.key.toLowerCase());
    };
    const onWindowBlur = () => {
      keysPressedRef.current.clear();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    // Raycaster Pointer Handling
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const getAgentHitMeshes = () => {
      const list = [];
      for (const a of Object.values(agentMeshesRef.current)) {
        if (a.hitMeshes?.length) list.push(...a.hitMeshes);
        else if (a.hitMesh) list.push(a.hitMesh);
      }
      return list;
    };

    // Prioritize specific plated dishes and shelf stock units when raycasting so parent table/station doesn't shadow them
    const pickBestHit = (hits) => {
      if (!hits || hits.length === 0) return null;
      const topDist = hits[0].distance;
      const priorityHit = hits.find(
        (h) =>
          h.distance - topDist < 0.9 &&
          (h.object.userData?.objectType === "plated_dish" ||
            h.object.userData?.objectType === "stock_unit" ||
            String(h.object.userData?.sceneObjectId || "").startsWith("scene-dish-") ||
            String(h.object.userData?.sceneObjectId || "").startsWith("dish-") ||
            String(h.object.userData?.sceneObjectId || "").startsWith("scene-unit-") ||
            String(h.object.userData?.sceneObjectId || "").startsWith("unit-"))
      );
      return priorityHit || hits[0];
    };

    const onPointerDown = (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...getAgentHitMeshes(), ...interactiveMeshesRef.current], false);
      const best = pickBestHit(hits);
      if (best) {
        const hitData = best.object.userData;
        if (hitData?.sceneObjectId) {
          selectSceneObject(hitData.sceneObjectId);
        }
      }
    };

    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...getAgentHitMeshes(), ...interactiveMeshesRef.current], false);
      const best = pickBestHit(hits);
      if (best && best.object.userData?.label) {
        renderer.domElement.style.cursor = "pointer";
        setHoveredLabel(best.object.userData.label);
      } else {
        renderer.domElement.style.cursor = "grab";
        setHoveredLabel(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    let lastTime = performance.now();
    let animId;

    const animate = (now) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Apply WASD / Arrow / Q & E Camera Movement
      const keys = keysPressedRef.current;
      if (keys.size > 0) {
        const isWalking = walkModeRef.current;
        const baseSpeed = isWalking ? 6.8 : 16.5;
        const speed = (keys.has("shift") ? baseSpeed * 1.85 : baseSpeed) * dt;

        const forward = new THREE.Vector3().subVectors(controls.target, camera.position);
        forward.y = 0;
        if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
        forward.normalize();

        const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
        const moveDelta = new THREE.Vector3();

        if (keys.has("w") || keys.has("arrowup")) moveDelta.addScaledVector(forward, speed);
        if (keys.has("s") || keys.has("arrowdown")) moveDelta.addScaledVector(forward, -speed);
        if (keys.has("d") || keys.has("arrowright")) moveDelta.addScaledVector(right, speed);
        if (keys.has("a") || keys.has("arrowleft")) moveDelta.addScaledVector(right, -speed);

        if (moveDelta.lengthSq() > 0) {
          camera.position.add(moveDelta);
          controls.target.add(moveDelta);
          if (isWalking) {
            // Subtle head-bob while walking at pedestrian eye-level
            const bob = Math.sin(now * 0.011) * 0.025;
            camera.position.y = 1.72 + bob;
            controls.target.y = 1.64 + bob * 0.5;
          }
        }

        // Q / E Horizontal Yaw Turn
        if (keys.has("q") || keys.has("e")) {
          const yawAngle = (keys.has("q") ? 1 : -1) * 1.65 * dt;
          const relTarget = new THREE.Vector3().subVectors(controls.target, camera.position);
          relTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
          controls.target.copy(camera.position).add(relTarget);
        }
      }

      useSimulationStore.getState().tickSimulation(dt);

      const state = useSimulationStore.getState();
      const proj = state.projectedState;

      if (proj) {
        for (const bs of Object.values(proj.businessStates || {})) {
          // 1. Update Table Visuals, Exact Guest Place Settings & Authentic 3D Plated Courses
          for (const [tid, tState] of Object.entries(bs.tables || {})) {
            const tv = tableVisualsRef.current[tid];
            if (!tv) continue;
            const col = STATUS_COLORS[tState.status] || STATUS_COLORS.AVAILABLE;
            tv.clothMat.color.setHex(col);

            // Only show napkins & water goblets for actual seated guests (partySize), never for empty seats!
            const activePartyCount =
              tState.status === "AVAILABLE" ? 0 : Math.max(1, Number(tState.partySize || 2));
            if (tv.chairSettings) {
              tv.chairSettings.forEach((cs, idx) => {
                const visibleForGuest = tState.status !== "AVAILABLE" && idx < activePartyCount;
                cs.napkin.visible = visibleForGuest;
                cs.waterGoblet.visible = visibleForGuest;
              });
            }

            const served = tState.servedDishes || [];
            const showDishes =
              (tState.status.startsWith("DINING_COURSE_") ||
                tState.status === "REQUESTING_BILL" ||
                tState.status === "PAYING_BILL" ||
                tState.status === "PAID_SEATED" ||
                tState.status === "NEEDS_CLEARING" ||
                tState.status === "CLEARING_TABLE") &&
              served.length > 0;
            tv.dishesGroup.visible = showDishes;

            const dishSig = showDishes
              ? `${activePartyCount}|` +
                served.map((d) => `${d.dishInstanceId || d.dishName}:${d.visualAsset}:${d.qty || 1}`).join("|")
              : "";
            if (dishSig !== tv.lastDishesSignature) {
              tv.lastDishesSignature = dishSig;
              if (showDishes) {
                populateTableServedDishes(
                  tv.dishesGroup,
                  served,
                  tv.seatCount,
                  tv.width,
                  tv.depth,
                  tv.businessId,
                  activePartyCount,
                  interactiveMeshesRef.current
                );
              } else {
                populateTableServedDishes(
                  tv.dishesGroup,
                  [],
                  tv.seatCount,
                  tv.width,
                  tv.depth,
                  tv.businessId,
                  0,
                  interactiveMeshesRef.current
                );
              }
            }

            // Update floating table badge with seated party & active dish course / bill / clearing state
            const topDishName = served[0]?.dishName || "";
            const badgeSig = `${tState.status}|${tState.partyName || ""}|${activePartyCount}|${topDishName}`;
            if (badgeSig !== tv.lastBadgeSignature) {
              tv.lastBadgeSignature = badgeSig;
              tv.group.remove(tv.badge);
              const subText =
                tState.status === "REQUESTING_BILL"
                  ? `✋ Addition demandée • ${tState.partyName || `${activePartyCount}p`}`
                  : tState.status === "PAYING_BILL"
                  ? `💳 Règlement TPE en cours • ${tState.partyName || `${activePartyCount}p`}`
                  : tState.status === "PAID_SEATED"
                  ? `✅ Addition réglée • ${tState.partyName || `${activePartyCount}p`}`
                  : tState.status === "NEEDS_CLEARING"
                  ? `🍽️ À débarrasser (${served.length || activePartyCount} couverts)`
                  : tState.status === "CLEARING_TABLE"
                  ? `🧹 Débarrassage & nettoyage en cours`
                  : topDishName
                  ? `${topDishName} (${activePartyCount}p)${served.length > 1 ? ` +${served.length - 1}` : ""}`
                  : tState.partyName
                  ? `${tState.partyName} (${activePartyCount}p / ${tv.seatCount} places)`
                  : `${tv.seatCount} places • Libre`;
              const borderHex =
                tState.status === "AVAILABLE"
                  ? "#10b981"
                  : tState.status === "SEATED"
                  ? "#3b82f6"
                  : tState.status === "REQUESTING_BILL"
                  ? "#eab308"
                  : tState.status === "PAYING_BILL" || tState.status === "PAID_SEATED"
                  ? "#06b6d4"
                  : tState.status === "NEEDS_CLEARING" || tState.status === "CLEARING_TABLE"
                  ? "#ef4444"
                  : "#f59e0b";
              const nextBadge = createTextSprite(
                tv.cleanTableTitle,
                "rgba(15, 23, 42, 0.9)",
                "#ffffff",
                borderHex,
                subText
              );
              nextBadge.scale.set(1.85, 0.46, 1);
              nextBadge.position.set(0, 1.36, 0);
              tv.group.add(nextBadge);
              tv.badge = nextBadge;
            }
          }

          // 2. Update Station 3D Cookware Assets, Sorted Shelf Inventory Units & Floating Dish Name Banner
          for (const [sid, sState] of Object.entries(bs.stations || {})) {
            const sv = stationVisualsRef.current[sid];
            if (!sv) continue;
            const col = STATUS_COLORS[sState.status] || STATUS_COLORS.IDLE;
            sv.beaconMat.color.setHex(col);
            const pulse = sState.status !== "IDLE" ? 1 + 0.25 * Math.sin(now * 0.008) : 1;
            sv.beacon.scale.set(pulse, pulse, pulse);

            // Populate sorted 3D physical stock units on Cold Storage, Fridge & Bar shelves
            const shelfInv = sState.shelfInventory || [];
            const shelfSig = shelfInv
              .map((u) => `${u.unitId}:${u.remainingQty}:${u.status}:${u.holderAgentId || ""}`)
              .join("|");
            if (shelfSig !== sv.lastShelfSignature) {
              sv.lastShelfSignature = shelfSig;
              const normalizedShelfUnits = shelfInv.map((u) => ({
                ...u,
                name: u.name || u.ingredientName || u.unitLabel,
                slotIndex: u.slotIndex ?? u.shelfSlot ?? 0,
                isNextToUse: (u.fifoOrder || 1) === 1 && u.remainingQty > 0,
                isTakenOffShelf:
                  u.status === "IN_USE_BY_COOK" ||
                  u.status === "IN_USE_BY_BARMAN" ||
                  u.status === "TAKEN_BY_COOK" ||
                  u.status === "TAKEN_BY_BARMAN",
                heldByAgentName: u.holderName || u.heldByAgentName,
                visualModel: u.visualModel || u.visualType,
              }));
              populateStationShelfUnits(
                sv.shelfUnitsGroup,
                normalizedShelfUnits,
                { width: sv.width, depth: sv.depth, height: sv.bodyH, bodyH: sv.bodyH },
                interactiveMeshesRef.current
              );
            }

            const tasks = sState.activeTasks || [];
            const sig = `${shelfSig}::` + tasks.map((t) => `${t.taskId || t.orderId}:${t.dishName || t.label}:${t.status}`).join("|");
            if (sig !== sv.lastSignature) {
              sv.lastSignature = sig;
              populateStationTaskModels(sv.cookwareGroup, tasks, sv.bodyH, sv.width);

              sv.group.remove(sv.stBadge);
              const topDish = tasks[0];
              const shelfSummary =
                shelfInv.length > 0
                  ? `${shelfInv.filter((u) => u.remainingQty > 0).length}/${shelfInv.length} unités triées (${shelfInv[0]?.ingredientName?.split(" ")[0] || "Stock"} ${shelfInv[0]?.remainingQty}${shelfInv[0]?.unit})`
                  : null;
              const subLine = topDish
                ? `${topDish.dishName || topDish.label} ×${topDish.qty || 1}${
                    tasks.length > 1 ? ` (+${tasks.length - 1})` : ""
                  } • ${topDish.tableLabel || ""}`
                : shelfSummary
                ? shelfSummary
                : sState.status === "IDLE"
                ? "Poste prêt"
                : sState.status;
              const borderCol = tasks.length > 0 ? "#f59e0b" : shelfInv.length > 0 ? "#10b981" : "#38bdf8";
              const nextBadge = createTextSprite(
                sv.cleanTitle,
                "rgba(15, 23, 42, 0.92)",
                "#ffffff",
                borderCol,
                subLine
              );
              nextBadge.scale.set(2.75, 0.64, 1);
              nextBadge.position.set(0, sv.bodyH + 0.88, 0);
              tvOrStationBadgeOffset(sv, nextBadge, shelfInv.length > 0);
              sv.group.add(nextBadge);
              sv.stBadge = nextBadge;
            }
          }
        }

        // 3. Reconcile & Animate Articulated 3D Agents along A* Waypoint Paths
        const activeIds = new Set();
        for (const ag of proj.activeAgents || []) {
          activeIds.add(ag.agentId);
          let agObj = agentMeshesRef.current[ag.agentId];
          if (!agObj) {
            agObj = createArticulatedAgentRig(ag);
            const sceneObjId = ag.agentKind === "employee" ? `scene-${ag.agentId}` : ag.agentId;
            const hitMeshes = [];
            agObj.group.traverse((child) => {
              if (child.isMesh) {
                child.userData = {
                  sceneObjectId: sceneObjId,
                  label: `${ag.name} (${ag.role}) — ${ag.currentTask || ""}`,
                  agentId: ag.agentId,
                };
                hitMeshes.push(child);
              }
            });
            agObj.hitMeshes = hitMeshes;
            scene.add(agObj.group);
            agentMeshesRef.current[ag.agentId] = agObj;
          }

          agObj.group.position.set(ag.x || 0, 0, ag.z || 0);
          animateArticulatedAgent(agObj, ag, now);
          const updatedLabel = `${ag.name} (${ag.role}) — ${ag.currentTask || ""}`;
          agObj.hitMesh.userData.label = updatedLabel;
          if (agObj.hitMeshes) {
            for (const hm of agObj.hitMeshes) {
              hm.userData.label = updatedLabel;
            }
          }

          // Refresh floating task subtitle on agent if task or speech bubble changed
          const speechPart = ag.speechBubble ? ` 💬 "${ag.speechBubble.slice(0, 34)}"` : "";
          const taskAndSpeech = `${ag.currentTask || ag.role}${speechPart}`;
          if (taskAndSpeech !== agObj.lastTaskText) {
            agObj.lastTaskText = taskAndSpeech;
            agObj.group.remove(agObj.nameTag);
            const newTag = createTextSprite(
              ag.name,
              ag.agentKind === "employee" ? "rgba(15, 23, 42, 0.9)" : "rgba(6, 78, 59, 0.9)",
              "#ffffff",
              ag.speechBubble ? "#f59e0b" : ag.agentKind === "employee" ? "#38bdf8" : "#34d399",
              taskAndSpeech
            );
            newTag.scale.set(2.25, 0.54, 1);
            newTag.position.set(0, 1.88, 0);
            agObj.group.add(newTag);
            agObj.nameTag = newTag;
          }

          if (state.cameraPreset === "follow_agent" && state.followedAgentId === ag.agentId) {
            controls.target.lerp(new THREE.Vector3(ag.x, 1.0, ag.z), 0.1);
          }
        }

        for (const [aid, agObj] of Object.entries(agentMeshesRef.current)) {
          if (!activeIds.has(aid)) {
            scene.remove(agObj.group);
            delete agentMeshesRef.current[aid];
          }
        }
      }

      // 4. Update Selection Ring & Active A* Navigation Path Polyline
      const selId = state.selectedSceneObjectId;
      if (selId && selectionRingRef.current) {
        let matchedObj = (state.bootstrap?.sceneObjects || []).find((s) => s.sceneObjectId === selId);
        if (!matchedObj && proj) {
          // If a plated dish or stock unit is selected, highlight its parent table or storage/bar station
          const dishKey = selId.replace(/^scene-dish-/, "");
          const dishObj = proj.dishInstancesState?.[dishKey];
          if (dishObj) {
            matchedObj = (state.bootstrap?.sceneObjects || []).find(
              (s) => s.domainEntityId === dishObj.currentStationId || s.domainEntityId === dishObj.tableId
            );
          }
          const unitKey = selId.replace(/^scene-unit-/, "");
          const unitObj = proj.stockUnitsState?.[unitKey];
          if (unitObj) {
            matchedObj = (state.bootstrap?.sceneObjects || []).find(
              (s) => s.domainEntityId === unitObj.stationId || s.sceneObjectId === unitObj.storageSceneObjectId
            );
          }
        }

        const matchedAgentEntry = Object.entries(agentMeshesRef.current).find(
          ([, a]) => a.hitMesh.userData?.sceneObjectId === selId || a.hitMesh.userData?.agentId === selId
        );
        if (matchedAgentEntry) {
          const [aid, agObj] = matchedAgentEntry;
          selectionRingRef.current.visible = true;
          selectionRingRef.current.position.set(agObj.group.position.x, 0.08, agObj.group.position.z);

          const liveAg = (proj?.activeAgents || []).find((x) => x.agentId === aid);
          if (liveAg?.pathPoints?.length >= 2 && navPathLineRef.current) {
            const vecs = liveAg.pathPoints.map((pt) => new THREE.Vector3(pt.x, 0.12, pt.z));
            navPathLineRef.current.geometry.setFromPoints(vecs);
            navPathLineRef.current.visible = true;
          }
        } else if (matchedObj?.transform) {
          selectionRingRef.current.visible = true;
          selectionRingRef.current.position.set(matchedObj.transform.x, 0.08, matchedObj.transform.z);
          if (navPathLineRef.current) navPathLineRef.current.visible = false;
        } else {
          selectionRingRef.current.visible = false;
          if (navPathLineRef.current) navPathLineRef.current.visible = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    function tvOrStationBadgeOffset(sv, badge, hasShelves) {
      badge.position.set(0, sv.bodyH + (hasShelves ? 1.18 : 0.88), 0);
    }

    animId = requestAnimationFrame(animate);

    const resizeObs = new ResizeObserver(() => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (!nw || !nh) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    resizeObs.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      resizeObs.disconnect();
      renderer.dispose();
    };
  }, [bootstrap]);

  // Apply Camera Presets for all 3 Specialty Restaurants
  useEffect(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;

    const presets = {
      street_overview: { pos: [31, 28, 44], target: [31, 0, 7] },
      isometric: { pos: [-10, 35, 45], target: [30, 0, 6] },
      bistrot: { pos: [11, 15, 25], target: [11, 0, 6] },
      kitchen: { pos: [11, 10, 4], target: [11, 0, -3.5] },
      osteria: { pos: [33, 15, 24], target: [33, 0, 7] },
      pizza: { pos: [33, 15, 24], target: [33, 0, 7] },
      sakana: { pos: [53, 15, 24], target: [53, 0, 7] },
      cafe: { pos: [53, 15, 24], target: [53, 0, 7] },
    };

    const p = presets[cameraPreset];
    if (p) {
      walkModeRef.current = false;
      setWalkMode(false);
      ctrl.minDistance = 3.5;
      ctrl.maxPolarAngle = Math.PI / 2 - 0.03;
      cam.position.set(...p.pos);
      ctrl.target.set(...p.target);
      ctrl.update();
    }
  }, [cameraPreset]);

  // Apply Cutaway Walls Toggle
  useEffect(() => {
    for (const w of wallMeshesRef.current) {
      const h = cutawayWalls ? w.cutawayH : w.fullH;
      w.mesh.scale.y = h / w.fullH;
      w.mesh.position.y = h / 2;
      w.mesh.material.opacity = cutawayWalls ? 0.52 : 0.94;
    }
  }, [cutawayWalls]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full" />

      {/* Walk Mode & WASD Controls HUD Pill */}
      <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
        <button
          onClick={toggleWalkMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 shadow-lg backdrop-blur ${
            walkMode
              ? "bg-emerald-500/90 text-slate-950 border-emerald-300"
              : "bg-slate-900/90 text-slate-200 border-slate-700/80 hover:border-sky-400/60"
          }`}
          title="Toggle first-person street-level walking mode"
        >
          <span>{walkMode ? "🚶 Walking Mode Active (1.7m Eye-Level)" : "🚶 Walk Mode (WASD)"}</span>
        </button>
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/85 border border-slate-800 text-[11px] text-slate-300 backdrop-blur">
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-sky-300 font-mono">W A S D</kbd>
          <span>Move</span>
          <span className="text-slate-600">•</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-sky-300 font-mono">Q / E</kbd>
          <span>Turn</span>
          <span className="text-slate-600">•</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-sky-300 font-mono">Shift</kbd>
          <span>Sprint</span>
        </div>
      </div>

      {hoveredLabel && (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-sky-400/50 text-xs font-medium text-sky-100 shadow-lg backdrop-blur z-20">
          Click to inspect: <span className="font-semibold text-white">{hoveredLabel}</span>
        </div>
      )}

      {/* Floating Provenance Playback Banner HUD */}
      {provenanceTrace && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 w-[720px] max-w-[94vw] bg-slate-950/95 border-2 border-amber-500/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    playbackSpeed < 0
                      ? "bg-amber-500/20 text-amber-300 border-amber-400/60 animate-pulse"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-400/60"
                  }`}
                >
                  {playbackSpeed < 0
                    ? `⏪ REVERSE PROVENANCE TRACE`
                    : `⏩ FORWARD LINEAGE TRACE`}
                </span>
                <span className="text-[11px] font-mono text-sky-300">
                  {new Date(timestampMs || 0).toLocaleTimeString("fr-FR", {
                    timeZone: "Europe/Paris",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white truncate mt-1">
                {provenanceTrace.title}
              </h3>
              {provenanceTrace.subtitle && (
                <p className="text-[11px] text-slate-300 truncate">{provenanceTrace.subtitle}</p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {[
                { label: "⏪ -5x", speed: -180 },
                { label: "⏪ -1x", speed: -60 },
                { label: isPlaying ? "⏸" : "▶️", toggle: true },
                { label: "⏩ 1x", speed: 60 },
                { label: "⏩ 5x", speed: 180 },
              ].map((btn, i) =>
                btn.toggle ? (
                  <button
                    key={i}
                    onClick={togglePlay}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
                  >
                    {btn.label}
                  </button>
                ) : (
                  <button
                    key={i}
                    onClick={() => setPlaybackSpeed(btn.speed)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition ${
                      isPlaying && playbackSpeed === btn.speed
                        ? "bg-sky-500 text-slate-950 border-sky-300"
                        : "bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/60"
                    }`}
                  >
                    {btn.label}
                  </button>
                )
              )}
              <button
                onClick={stopProvenanceTrace}
                className="ml-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-700/70 transition"
                title="Stop Provenance Playback"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Lineage Stage Stepper */}
          {provenanceTrace.stages?.length > 0 && (
            <div className="grid grid-cols-5 gap-1.5 pt-1 border-t border-slate-800/90">
              {provenanceTrace.stages.map((st, idx) => {
                const stTime = st.timestampMs || st.startMs || 0;
                const nextStTime =
                  provenanceTrace.stages[idx + 1]?.timestampMs || stTime + 180000;
                const isCurrent =
                  (timestampMs || 0) >= stTime - 25000 &&
                  (timestampMs || 0) <= nextStTime + 25000;
                return (
                  <button
                    key={st.stage || st.stageKey || idx}
                    onClick={() => {
                      setTimestampMs(stTime);
                      if (st.actorAgentId || st.agentId) {
                        useSimulationStore.setState({
                          followedAgentId: st.actorAgentId || st.agentId,
                          cameraPreset: "follow_agent",
                        });
                      }
                    }}
                    className={`text-left p-1.5 rounded-lg border transition ${
                      isCurrent
                        ? "bg-amber-500/20 border-amber-400 text-white shadow"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-[9px] font-mono font-bold text-amber-300 truncate">
                      {idx + 1}. {st.label}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-200 truncate mt-0.5">
                      {st.actorName || st.agentName || "Brigade"}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400">
                      {new Date(stTime).toLocaleTimeString("fr-FR", {
                        timeZone: "Europe/Paris",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2 text-[11px] text-slate-300 backdrop-blur">
        <span className="font-semibold text-slate-100 mr-1">3D Gastronomy Street:</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available / Ready at Pass</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Seated / Order Queued</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Entrée / Mise en Place</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Active Cooking / Main Course</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Dessert / Chef & Manager</span>
      </div>
    </div>
  );
}
