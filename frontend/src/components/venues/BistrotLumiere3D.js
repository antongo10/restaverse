import * as THREE from "three";
import { buildSortedStorageRack3D, buildSortedBarBottleShelf3D } from "../assets/KitchenBarShelves3D";

export const BISTROT_BRAND = {
  businessId: "business-bistrot-lumiere",
  name: "Bistrot Lumière",
  subtitle: "Brasserie Française & Cuisine Niçoise",
  motto: "L'Art du Feu, du Cuivre et du Terroir depuis 1924",
  crestUrl: "/brands/bistrot/crest.png",
  menuBoardUrl: "/brands/bistrot/menu_board.png",
  primaryColor: "#f59e0b",
  accentColor: "#991b1b",
  signatureDishes: [
    "Entrecôte grillée maître d'hôtel & Pommes Pont-Neuf",
    "Filet de loup grillé au fenouil flambé",
    "Soupe à l'oignon gratinée au Comté 24 mois",
    "Crème brûlée à la vanille Bourbon",
  ],
};

// Shared texture cache to avoid redundant loads across rebuilds
const textureCache = new Map();

function loadBrandTexture(url) {
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }
  const loader = new THREE.TextureLoader();
  const tex = loader.load(url, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.needsUpdate = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, tex);
  return tex;
}

/**
 * Generates a high-resolution striped burgundy, cream, and burnished-gold Parisian awning texture
 */
function createParisianAwningTexture() {
  if (textureCache.has("__bistrot_awning__")) {
    return textureCache.get("__bistrot_awning__");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const stripeCount = 16;
  const stripeW = canvas.width / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#7f1d1d" : "#fef3c7";
    ctx.fillRect(i * stripeW, 0, stripeW, canvas.height);

    // Subtle woven fabric shading & gold pinstripe
    ctx.fillStyle = "#d97706";
    ctx.fillRect(i * stripeW, 0, 2.5, canvas.height);
  }

  // Bottom burgundy & gold valance band
  ctx.fillStyle = "rgba(69, 10, 10, 0.94)";
  ctx.fillRect(0, canvas.height - 46, canvas.width, 46);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 44);
  ctx.lineTo(canvas.width, canvas.height - 44);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(2.5, 1);
  tex.needsUpdate = true;
  textureCache.set("__bistrot_awning__", tex);
  return tex;
}

/**
 * Generates a digital thermometer badge texture (e.g., "-2°C" or "195°C")
 */
function createDigitalReadoutTexture(text = "-2.0°C", color = "#34d399") {
  const key = `__readout_${text}_${color}__`;
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 60);

  ctx.fillStyle = color;
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Helper to build a tufted red velvet Parisian banquette along a wall
 */
function buildVelvetBanquette({ x, zStart, zEnd, facing = 1, materials }) {
  const banqGroup = new THREE.Group();
  const length = Math.abs(zEnd - zStart);
  const centerZ = (zStart + zEnd) / 2;
  banqGroup.position.set(x, 0, centerZ);

  // Dark mahogany plinth base
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, length), materials.mahogany);
  plinth.position.set(facing * 0.04, 0.11, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  banqGroup.add(plinth);

  // Plush crimson velvet seat cushion
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, length), materials.velvetSeat);
  seat.position.set(facing * 0.06, 0.31, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  banqGroup.add(seat);

  // Channel-tufted vertical velvet backrest
  const backBase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, length), materials.velvetBack);
  backBase.position.set(-facing * 0.2, 0.68, 0);
  backBase.castShadow = true;
  banqGroup.add(backBase);

  // Individual vertical tufted ribs & brass upholstery buttons
  const ribSpacing = 0.28;
  const ribCount = Math.floor((length - 0.2) / ribSpacing);
  const ribGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.58, 10);
  const buttonGeo = new THREE.SphereGeometry(0.018, 8, 8);
  for (let i = 0; i <= ribCount; i++) {
    const rz = -length / 2 + 0.14 + i * ribSpacing;
    if (rz > length / 2 - 0.1) continue;
    const rib = new THREE.Mesh(ribGeo, materials.velvetSeat);
    rib.position.set(-facing * 0.13, 0.68, rz);
    banqGroup.add(rib);

    const btn = new THREE.Mesh(buttonGeo, materials.brass);
    btn.position.set(-facing * 0.08, 0.72, rz);
    banqGroup.add(btn);
  }

  // Mahogany top cap & polished brass gallery backrest rail (Galerie en laiton)
  const woodCap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, length + 0.04), materials.mahogany);
  woodCap.position.set(-facing * 0.2, 1.01, 0);
  banqGroup.add(woodCap);

  const topBrassRail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, length, 12),
    materials.brass
  );
  topBrassRail.rotation.x = Math.PI / 2;
  topBrassRail.position.set(-facing * 0.2, 1.15, 0);
  banqGroup.add(topBrassRail);

  const postCount = Math.max(3, Math.floor(length / 1.1));
  const postGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.14, 8);
  for (let pi = 0; pi <= postCount; pi++) {
    const pz = -length / 2 + 0.08 + (pi / postCount) * (length - 0.16);
    const post = new THREE.Mesh(postGeo, materials.brass);
    post.position.set(-facing * 0.2, 1.08, pz);
    banqGroup.add(post);
  }

  return banqGroup;
}

/**
 * Helper to build an Art Deco Brass & Opaline Globe Chandelier suspended at Y = 2.65m
 */
function buildArtDecoChandelier(x, y, z, materials, addPointLight = false) {
  const chand = new THREE.Group();
  chand.position.set(x, y, z);

  // Ceiling rose & vertical suspension rod
  const ceilingRose = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.06, 16), materials.brass);
  ceilingRose.position.y = 0.55;
  chand.add(ceilingRose);

  const downRod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.56, 10), materials.brass);
  downRod.position.y = 0.28;
  chand.add(downRod);

  // Stepped Art Deco central brass hub & outer decorative ring
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.12, 12), materials.brass);
  chand.add(hub);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.022, 10, 28), materials.brass);
  ring.rotation.x = Math.PI / 2;
  chand.add(ring);

  // 4 spoke arms with opaline milk-glass globes
  const armAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  for (const ang of armAngles) {
    const gx = Math.cos(ang) * 0.46;
    const gz = Math.sin(ang) * 0.46;

    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 8), materials.brass);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = -ang;
    spoke.position.set(gx * 0.5, 0, gz * 0.5);
    chand.add(spoke);

    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.05, 12), materials.brass);
    cup.position.set(gx, 0.04, gz);
    chand.add(cup);

    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 16), materials.opalineGlobe);
    globe.position.set(gx, -0.05, gz);
    chand.add(globe);
  }

  // Central lower finial globe
  const centerGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), materials.opalineGlobe);
  centerGlobe.position.y = -0.11;
  chand.add(centerGlobe);

  if (addPointLight) {
    const warmLight = new THREE.PointLight(0xffedd5, 0.65, 9.5, 1.6);
    warmLight.position.set(0, -0.2, 0);
    chand.add(warmLight);
  }

  return chand;
}

/**
 * Helper to build an overhead hammered-copper pot rack with hanging sauté pans and ladles
 */
function buildCopperPotRack(x, y, z, width, depth, materials) {
  const rackGroup = new THREE.Group();
  rackGroup.position.set(x, y, z);

  // Rectangular wrought-iron & brass pot frame
  const railH = 0.045;
  const frontRail = new THREE.Mesh(new THREE.BoxGeometry(width, railH, 0.04), materials.darkIron);
  frontRail.position.set(0, 0, depth / 2);
  rackGroup.add(frontRail);

  const backRail = new THREE.Mesh(new THREE.BoxGeometry(width, railH, 0.04), materials.darkIron);
  backRail.position.set(0, 0, -depth / 2);
  rackGroup.add(backRail);

  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.04, railH, depth), materials.darkIron);
  leftRail.position.set(-width / 2, 0, 0);
  rackGroup.add(leftRail);

  const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.04, railH, depth), materials.darkIron);
  rightRail.position.set(width / 2, 0, 0);
  rackGroup.add(rightRail);

  // Brass corner medallions & ceiling suspension rods
  for (const cx of [-width * 0.44, width * 0.44]) {
    for (const cz of [-depth * 0.44, depth * 0.44]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.9, 8), materials.brass);
      rod.position.set(cx, 0.45, cz);
      rackGroup.add(rod);
    }
  }

  // Hanging copper sauté pans, saucepans, and brass ladles
  const panCount = 5;
  for (let i = 0; i < panCount; i++) {
    const px = -width * 0.38 + (i / (panCount - 1)) * (width * 0.76);
    const pz = i % 2 === 0 ? depth * 0.48 : -depth * 0.48;
    const radius = 0.11 + (i % 3) * 0.025;

    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), materials.brass);
    hook.position.set(px, -0.06, pz);
    rackGroup.add(hook);

    const panHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), materials.brass);
    panHandle.position.set(px, -0.18, pz);
    rackGroup.add(panHandle);

    const panBody = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.92, 0.08, 16),
      materials.copper
    );
    panBody.rotation.x = Math.PI / 2;
    panBody.position.set(px, -0.34, pz + (pz > 0 ? 0.03 : -0.03));
    panBody.castShadow = true;
    rackGroup.add(panBody);

    const innerTin = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.88, radius * 0.85, 0.082, 16),
      materials.stainless
    );
    innerTin.rotation.x = Math.PI / 2;
    innerTin.position.copy(panBody.position);
    rackGroup.add(innerTin);
  }

  // Hanging brass ladles & skimmers in between
  for (const lx of [-width * 0.2, width * 0.2]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), materials.brass);
    stem.position.set(lx, -0.16, depth * 0.48);
    rackGroup.add(stem);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), materials.copper);
    bowl.position.set(lx, -0.33, depth * 0.5);
    rackGroup.add(bowl);
  }

  return rackGroup;
}

/**
 * Constructs and adds to `scene` a `THREE.Group` containing bespoke Parisian Brasserie
 * architectural details for Bistrot Lumière.
 */
export function buildBistrotInterior(scene, premises, interactiveMeshes = []) {
  const root = new THREE.Group();
  root.name = "BistrotLumiereInteriorGroup";

  const premId = premises?._id || "premises-bistrot-lumiere";
  const sceneObjectId = `scene-${premId}`;

  const crestTex = loadBrandTexture(BISTROT_BRAND.crestUrl);
  const menuBoardTex = loadBrandTexture(BISTROT_BRAND.menuBoardUrl);
  const awningTex = createParisianAwningTexture();

  const materials = {
    burgundyWood: new THREE.MeshStandardMaterial({ color: 0x6b1111, roughness: 0.48, metalness: 0.1 }),
    darkMahogany: new THREE.MeshStandardMaterial({ color: 0x3b1306, roughness: 0.42, metalness: 0.12 }),
    mahogany: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.45, metalness: 0.1 }),
    velvetSeat: new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.78, metalness: 0.05 }),
    velvetBack: new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.82, metalness: 0.05 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.86, roughness: 0.2 }),
    antiqueBrass: new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.28 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xc2410c, metalness: 0.85, roughness: 0.22 }),
    stainless: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.82, roughness: 0.22 }),
    darkIron: new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.72, roughness: 0.35 }),
    mirrorGlass: new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.92,
      roughness: 0.08,
    }),
    cafeCurtain: new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      roughness: 0.7,
      transparent: true,
      opacity: 0.82,
    }),
    opalineGlobe: new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    }),
    stringBulb: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    awningFabric: new THREE.MeshStandardMaterial({
      map: awningTex,
      roughness: 0.65,
      side: THREE.DoubleSide,
    }),
    crestArt: new THREE.MeshStandardMaterial({
      map: crestTex,
      roughness: 0.32,
      metalness: 0.15,
    }),
    menuBoardArt: new THREE.MeshStandardMaterial({
      map: menuBoardTex,
      roughness: 0.35,
      metalness: 0.1,
    }),
  };

  const registerInteractive = (mesh, label) => {
    mesh.userData = {
      sceneObjectId,
      businessId: BISTROT_BRAND.businessId,
      label,
    };
    if (Array.isArray(interactiveMeshes)) {
      interactiveMeshes.push(mesh);
    }
  };

  // =========================================================================
  // 1. PARISIAN STOREFRONT & STRIPED BURGUNDY/GOLD AWNING (X = 0.5..21.5, Z = 14.0)
  //    Leaving main doorway clear at X = 9.0..11.0
  // =========================================================================
  const storefrontGroup = new THREE.Group();
  const storefrontSegments = [
    { xMin: 0.5, xMax: 9.0 },
    { xMin: 11.0, xMax: 21.5 },
  ];

  for (const seg of storefrontSegments) {
    const segW = seg.xMax - seg.xMin;
    const segCenterX = (seg.xMin + seg.xMax) / 2;

    // Lower burgundy boiserie dado paneling
    const dado = new THREE.Mesh(
      new THREE.BoxGeometry(segW, 0.88, 0.24),
      materials.burgundyWood
    );
    dado.position.set(segCenterX, 0.44, 14.0);
    dado.castShadow = true;
    dado.receiveShadow = true;
    storefrontGroup.add(dado);
    registerInteractive(dado, "Façade Boiserie Parisienne — Bistrot Lumière");

    // Brass dado rail & kickplate
    const brassRail = new THREE.Mesh(
      new THREE.BoxGeometry(segW + 0.02, 0.045, 0.26),
      materials.brass
    );
    brassRail.position.set(segCenterX, 0.9, 14.0);
    storefrontGroup.add(brassRail);

    // Upper cornice beam
    const cornice = new THREE.Mesh(
      new THREE.BoxGeometry(segW + 0.06, 0.26, 0.32),
      materials.burgundyWood
    );
    cornice.position.set(segCenterX, 3.02, 14.0);
    storefrontGroup.add(cornice);

    // Vertical brass & burgundy mullions + Café Rideau half-curtains
    const bayCount = Math.max(2, Math.round(segW / 2.6));
    const bayW = segW / bayCount;
    for (let bi = 0; bi <= bayCount; bi++) {
      const mx = seg.xMin + bi * bayW;
      const pilaster = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 3.1, 0.26),
        materials.burgundyWood
      );
      pilaster.position.set(mx, 1.55, 14.0);
      storefrontGroup.add(pilaster);

      if (bi < bayCount) {
        const bayMidX = mx + bayW / 2;
        // Brass curtain rod + pleated Parisian bistro lace half-curtain
        const curtainRod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, bayW - 0.14, 8),
          materials.brass
        );
        curtainRod.rotation.z = Math.PI / 2;
        curtainRod.position.set(bayMidX, 1.48, 14.0);
        storefrontGroup.add(curtainRod);

        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(bayW - 0.18, 0.52, 0.03),
          materials.cafeCurtain
        );
        curtain.position.set(bayMidX, 1.2, 14.0);
        storefrontGroup.add(curtain);
      }
    }

    // Sloped Striped Burgundy/Cream/Gold Awning (Store Banne Parisien)
    const awningSlope = new THREE.Mesh(
      new THREE.BoxGeometry(segW, 0.05, 1.48),
      materials.awningFabric
    );
    awningSlope.position.set(segCenterX, 2.82, 14.68);
    awningSlope.rotation.x = 0.32;
    awningSlope.castShadow = true;
    storefrontGroup.add(awningSlope);
    registerInteractive(awningSlope, "Store Banne Rayé Bordeaux & Or — Bistrot Lumière");

    // Front vertical valance with gold trim
    const valance = new THREE.Mesh(
      new THREE.BoxGeometry(segW, 0.24, 0.04),
      materials.awningFabric
    );
    valance.position.set(segCenterX, 2.48, 15.38);
    storefrontGroup.add(valance);

    const valanceGoldBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, segW, 12),
      materials.brass
    );
    valanceGoldBar.rotation.z = Math.PI / 2;
    valanceGoldBar.position.set(segCenterX, 2.6, 15.38);
    storefrontGroup.add(valanceGoldBar);
  }

  // Ornate Entrance Archway Portal at X = 9.0..11.0, Z = 14.0
  for (const dx of [9.0, 11.0]) {
    const doorCol = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.25, 0.34), materials.burgundyWood);
    doorCol.position.set(dx, 1.625, 14.0);
    storefrontGroup.add(doorCol);

    // Glowing Parisian brass wall lantern flanking the main entrance
    const lanternBracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.22), materials.brass);
    lanternBracket.position.set(dx, 2.25, 14.22);
    storefrontGroup.add(lanternBracket);

    const lanternGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), materials.opalineGlobe);
    lanternGlobe.position.set(dx, 2.34, 14.32);
    storefrontGroup.add(lanternGlobe);
  }

  const portalTransom = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 0.36), materials.burgundyWood);
  portalTransom.position.set(10.0, 3.05, 14.0);
  storefrontGroup.add(portalTransom);

  // Storefront Crest Plaque above the Main Entrance Archway
  const entranceCrestFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 24), materials.brass);
  entranceCrestFrame.rotation.x = Math.PI / 2;
  entranceCrestFrame.position.set(10.0, 3.12, 14.2);
  storefrontGroup.add(entranceCrestFrame);

  const entranceCrestFace = new THREE.Mesh(new THREE.CircleGeometry(0.41, 24), materials.crestArt);
  entranceCrestFace.position.set(10.0, 3.12, 14.24);
  storefrontGroup.add(entranceCrestFace);
  registerInteractive(entranceCrestFace, "Blason Art Déco — Bistrot Lumière (Fondé 1924)");

  // Street-side Brass Menu Easel ("Carte du Jour") at X = 8.4, Z = 14.6
  const easelGroup = new THREE.Group();
  easelGroup.position.set(8.4, 0, 14.6);
  easelGroup.rotation.y = 0.22;

  for (const [lx, lz, rx, rz] of [
    [-0.32, 0.18, -0.12, -0.08],
    [0.32, 0.18, -0.12, 0.08],
    [0, -0.32, 0.22, 0],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 1.52, 10), materials.brass);
    leg.position.set(lx * 0.6, 0.74, lz * 0.6);
    leg.rotation.set(rx, 0, rz);
    leg.castShadow = true;
    easelGroup.add(leg);
  }

  const easelFrame = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.06, 0.05), materials.brass);
  easelFrame.position.set(0, 1.08, 0.08);
  easelFrame.rotation.x = -0.14;
  easelFrame.castShadow = true;
  easelGroup.add(easelFrame);

  const easelBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.96), materials.menuBoardArt);
  easelBoard.position.set(0, 1.08, 0.11);
  easelBoard.rotation.x = -0.14;
  easelGroup.add(easelBoard);
  registerInteractive(easelFrame, "Chevalet Carte du Jour — Bistrot Lumière");
  registerInteractive(easelBoard, "Carte du Jour — Entrecôte Maître d'Hôtel, Bouillabaisse & Crème Brûlée");

  // Top brass crest finial on easel
  const easelFinial = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), materials.brass);
  easelFinial.position.set(0, 1.63, 0.01);
  easelGroup.add(easelFinial);

  storefrontGroup.add(easelGroup);
  root.add(storefrontGroup);

  // =========================================================================
  // 2. FRAMED BRAND CREST & BRASSERIE MIRRORS ON INTERIOR WALLS
  // =========================================================================
  const wallDecorGroup = new THREE.Group();

  // Grand Illuminated Art Deco Crest Medallion on Kitchen-to-Dining Partition Wall (Z = 0.12)
  const grandCrestBacking = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.48, 0.06), materials.brass);
  grandCrestBacking.position.set(6.5, 2.02, 0.12);
  wallDecorGroup.add(grandCrestBacking);

  const grandCrestCanvas = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.34), materials.crestArt);
  grandCrestCanvas.position.set(6.5, 2.02, 0.16);
  wallDecorGroup.add(grandCrestCanvas);
  registerInteractive(grandCrestCanvas, "Emblème Historique — Bistrot Lumière (Fondé 1924)");

  // Interior Framed "Carte du Jour & Spécialités Niçoises" Board on Partition Wall (X = 11.4, Z = 0.12)
  const interiorMenuFrame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.22, 0.06), materials.darkMahogany);
  interiorMenuFrame.position.set(11.4, 1.95, 0.12);
  wallDecorGroup.add(interiorMenuFrame);

  const interiorMenuBrassTrim = new THREE.Mesh(new THREE.BoxGeometry(1.56, 1.14, 0.07), materials.brass);
  interiorMenuBrassTrim.position.set(11.4, 1.95, 0.12);
  wallDecorGroup.add(interiorMenuBrassTrim);

  const interiorMenuFace = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 1.04), materials.menuBoardArt);
  interiorMenuFace.position.set(11.4, 1.95, 0.16);
  wallDecorGroup.add(interiorMenuFace);
  registerInteractive(interiorMenuFace, "Ardoise des Spécialités — Bistrot Lumière");

  // Second Brand Crest Emblem in the Petit Salon / Bar Zone (East Wall X = 21.82, Z = 10.8)
  const barCrestFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.18, 1.18), materials.brass);
  barCrestFrame.position.set(21.84, 2.22, 10.8);
  wallDecorGroup.add(barCrestFrame);

  const barCrestFace = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.06), materials.crestArt);
  barCrestFace.rotation.y = -Math.PI / 2;
  barCrestFace.position.set(21.8, 2.22, 10.8);
  wallDecorGroup.add(barCrestFace);
  registerInteractive(barCrestFace, "Blason Cave & Comptoir Zinc — Bistrot Lumière");

  // Classic Tilted Parisian Brasserie Mirrors (Miroirs biseautés inclinés) along West & East Walls
  const mirrorZPositionsWest = [2.8, 5.6, 8.4];
  for (const mz of mirrorZPositionsWest) {
    const mGroup = new THREE.Group();
    mGroup.position.set(0.16, 1.92, mz);
    mGroup.rotation.z = -0.06; // Authentic slight downward brasserie mirror tilt

    const mFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.15, 2.15), materials.darkMahogany);
    mGroup.add(mFrame);
    const mBrass = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.04, 2.04), materials.brass);
    mGroup.add(mBrass);
    const mGlass = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.96, 1.96), materials.mirrorGlass);
    mGroup.add(mGlass);
    registerInteractive(mGlass, "Grand Miroir Biseauté de Brasserie (Grande Salle)");
    wallDecorGroup.add(mGroup);
  }

  const mirrorZPositionsEast = [3.2, 6.4];
  for (const mz of mirrorZPositionsEast) {
    const mGroup = new THREE.Group();
    mGroup.position.set(21.84, 1.92, mz);
    mGroup.rotation.z = 0.06;

    const mFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.15, 2.25), materials.darkMahogany);
    mGroup.add(mFrame);
    const mBrass = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.04, 2.14), materials.brass);
    mGroup.add(mBrass);
    const mGlass = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.96, 2.06), materials.mirrorGlass);
    mGroup.add(mGlass);
    registerInteractive(mGlass, "Miroir Art Déco (Petit Salon)");
    wallDecorGroup.add(mGroup);
  }

  // Interior Partition Wall Molding, Kitchen Swing Door Frame (X = 15.0, Z = 0.0) & Pass Window Frame (X = 16.5..20.5, Z = 0.0)
  const kitchenDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.28, 0.24), materials.burgundyWood);
  kitchenDoorFrame.position.set(15.0, 1.14, 0.0);
  wallDecorGroup.add(kitchenDoorFrame);

  const portholeGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 16), materials.mirrorGlass);
  portholeGlass.rotation.x = Math.PI / 2;
  portholeGlass.position.set(15.0, 1.55, 0.0);
  wallDecorGroup.add(portholeGlass);

  const portholeBrass = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 10, 20), materials.brass);
  portholeBrass.position.set(15.0, 1.55, 0.13);
  wallDecorGroup.add(portholeBrass);

  // Framed Pass Window Portal at X = 16.5..20.5, Z = 0.0
  const passHeader = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.42, 0.26), materials.darkMahogany);
  passHeader.position.set(18.5, 2.18, 0.0);
  wallDecorGroup.add(passHeader);

  const passBrassBand = new THREE.Mesh(new THREE.BoxGeometry(4.24, 0.05, 0.28), materials.brass);
  passBrassBand.position.set(18.5, 1.96, 0.0);
  wallDecorGroup.add(passBrassBand);

  root.add(wallDecorGroup);

  // =========================================================================
  // 3. TUFTED RED VELVET BANQUETTES WITH BRASS BACKREST RAILS
  //    West wall (X = 0.6, Z = 1.5..9.5) & Petit Salon East wall (X = 21.4, Z = 1.5..11.0)
  // =========================================================================
  const westBanquette = buildVelvetBanquette({
    x: 0.6,
    zStart: 1.5,
    zEnd: 9.5,
    facing: 1,
    materials,
  });
  westBanquette.traverse((c) => {
    if (c.isMesh) registerInteractive(c, "Banquette Capitonnée Velours Rouge (Grande Salle Ouest)");
  });
  root.add(westBanquette);

  const eastBanquette = buildVelvetBanquette({
    x: 21.4,
    zStart: 1.5,
    zEnd: 11.0,
    facing: -1,
    materials,
  });
  eastBanquette.traverse((c) => {
    if (c.isMesh) registerInteractive(c, "Banquette Capitonnée Velours & Galerie Laiton (Petit Salon Est)");
  });
  root.add(eastBanquette);

  // =========================================================================
  // 4. ART DECO BRASS & OPALINE GLOBE CHANDELIERS AT Y = 2.65m
  // =========================================================================
  const chandelierCoords = [
    { x: 5.0, z: 4.2, light: true, zone: "Grande Salle" },
    { x: 5.0, z: 9.2, light: false, zone: "Grande Salle" },
    { x: 11.2, z: 4.2, light: false, zone: "Grande Salle" },
    { x: 11.2, z: 9.2, light: true, zone: "Grande Salle" },
    { x: 18.2, z: 4.5, light: true, zone: "Petit Salon" },
    { x: 18.6, z: 10.6, light: false, zone: "Comptoir Le Zinc" },
  ];

  for (const ch of chandelierCoords) {
    const chandelier = buildArtDecoChandelier(ch.x, 2.65, ch.z, materials, ch.light);
    chandelier.traverse((c) => {
      if (c.isMesh) registerInteractive(c, `Lustre Art Déco Laiton & Opaline (${ch.zone})`);
    });
    root.add(chandelier);
  }

  // =========================================================================
  // 5. OVERHEAD COPPER POT RACK IN KITCHEN (X = 5.2, Y = 2.2, Z = -3.2)
  //    Plus secondary copper batterie de cuisine rack over the hot island
  // =========================================================================
  const primaryPotRack = buildCopperPotRack(5.2, 2.2, -3.2, 2.2, 0.85, materials);
  primaryPotRack.traverse((c) => {
    if (c.isMesh) registerInteractive(c, "Portique à Casseroles en Cuivre Mauviel (Cuisine)");
  });
  root.add(primaryPotRack);

  const rangePotRack = buildCopperPotRack(14.2, 2.32, -3.5, 2.1, 0.78, materials);
  rangePotRack.traverse((c) => {
    if (c.isMesh) registerInteractive(c, "Batterie de Cuisine en Cuivre Martelé (Poste Chaud)");
  });
  root.add(rangePotRack);

  // =========================================================================
  // 6. TERRACE WROUGHT-IRON & BRASS RAILING WITH BISTRO GLOBE STRING LIGHTS (Z = 17.85)
  // =========================================================================
  const terraceGroup = new THREE.Group();
  const railingSegments = [
    { x1: 0.6, x2: 8.6 },
    { x1: 11.4, x2: 21.4 },
  ];

  for (const seg of railingSegments) {
    const len = seg.x2 - seg.x1;
    const midX = (seg.x1 + seg.x2) / 2;

    // Lower & upper wrought-iron bars + polished brass handrail at Z = 17.85
    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.05), materials.darkIron);
    bottomBar.position.set(midX, 0.16, 17.85);
    terraceGroup.add(bottomBar);

    const midBar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.05), materials.darkIron);
    midBar.position.set(midX, 0.78, 17.85);
    terraceGroup.add(midBar);

    const topBrassHandrail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, len + 0.08, 12),
      materials.brass
    );
    topBrassHandrail.rotation.z = Math.PI / 2;
    topBrassHandrail.position.set(midX, 0.92, 17.85);
    terraceGroup.add(topBrassHandrail);
    registerInteractive(topBrassHandrail, "Balustrade Fer Forgé & Laiton — Terrasse Bistrot Lumière");

    // Vertical wrought-iron balusters & Art Deco ring medallions
    const balusterStep = 0.35;
    const count = Math.floor(len / balusterStep);
    for (let i = 0; i <= count; i++) {
      const bx = seg.x1 + (i / count) * len;
      const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.76, 8), materials.darkIron);
      baluster.position.set(bx, 0.52, 17.85);
      terraceGroup.add(baluster);

      if (i % 3 === 1 && bx < seg.x2 - 0.2) {
        const scrollRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 16), materials.brass);
        scrollRing.position.set(bx + balusterStep * 0.5, 0.48, 17.85);
        terraceGroup.add(scrollRing);
      }
    }
  }

  // Tall Wrought-Iron & Brass Lamp Posts along Z = 17.85 supporting Parisian Guinguette String Lights
  const lampPostX = [0.6, 4.6, 8.6, 11.4, 16.4, 21.4];
  for (let i = 0; i < lampPostX.length; i++) {
    const px = lampPostX[i];
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.75, 10), materials.darkIron);
    post.position.set(px, 1.375, 17.85);
    post.castShadow = true;
    terraceGroup.add(post);

    const brassCollar = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), materials.brass);
    brassCollar.position.set(px, 0.95, 17.85);
    terraceGroup.add(brassCollar);

    const topFinial = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), materials.brass);
    topFinial.position.set(px, 2.78, 17.85);
    terraceGroup.add(topFinial);

    // String light catenary span to next post along Z = 17.85
    if (i < lampPostX.length - 1) {
      const nextX = lampPostX[i + 1];
      const spanW = nextX - px;
      const bulbCount = 6;
      const curvePts = [];
      for (let bi = 0; bi <= bulbCount; bi++) {
        const t = bi / bulbCount;
        const bx = px + t * spanW;
        const sag = Math.sin(t * Math.PI) * 0.24;
        const by = 2.72 - sag;
        curvePts.push(new THREE.Vector3(bx, by, 17.85));

        if (bi > 0 && bi < bulbCount) {
          const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8), materials.brass);
          socket.position.set(bx, by - 0.02, 17.85);
          terraceGroup.add(socket);

          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), materials.stringBulb);
          bulb.position.set(bx, by - 0.06, 17.85);
          terraceGroup.add(bulb);
        }
      }
      const wireGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
      const wireLine = new THREE.Line(wireGeo, new THREE.LineBasicMaterial({ color: 0x1e293b }));
      terraceGroup.add(wireLine);
    }
  }

  root.add(terraceGroup);

  if (scene && typeof scene.add === "function") {
    scene.add(root);
  }

  return root;
}

/**
 * Adds ultra-detailed 3D culinary equipment to each Bistrot Lumière station group.
 */
export function decorateBistrotStation(group, obj = {}, tr = {}) {
  const id = obj.domainEntityId || obj.sceneObjectId || "";
  const style = obj.equipmentStyle || obj.stationKind || obj.objectType || "";
  const bodyH = tr.height || 0.95;
  const w = tr.width || 2.2;
  const d = tr.depth || 1.0;

  const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, metalness: 0.85, roughness: 0.22 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.82, roughness: 0.22 });
  const brushedSteelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.72, roughness: 0.28 });
  const castIronMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.35 });
  const enamelBurgundyMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, metalness: 0.35, roughness: 0.3 });

  // -------------------------------------------------------------------------
  // 1. PIANO DE CUISINE CHARVET (station-bl-piano / french_island_range)
  // -------------------------------------------------------------------------
  if (
    id === "station-bl-piano" ||
    style === "french_island_range" ||
    style === "charvet_range" ||
    obj.stationKind === "kitchen_hot"
  ) {
    // Enameled burgundy front oven doors with brass handles & towel rail
    for (const ox of [-w * 0.24, w * 0.24]) {
      const ovenDoor = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.42, bodyH * 0.62, 0.04),
        enamelBurgundyMat
      );
      ovenDoor.position.set(ox, bodyH * 0.42, d / 2 + 0.015);
      group.add(ovenDoor);

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, w * 0.34, 10),
        brassMat
      );
      handle.rotation.z = Math.PI / 2;
      handle.position.set(ox, bodyH * 0.65, d / 2 + 0.055);
      group.add(handle);
    }

    // Full-length brass chef's towel rail (Barre à torchons en laiton)
    const towelBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, w * 0.94, 12), brassMat);
    towelBar.rotation.z = Math.PI / 2;
    towelBar.position.set(0, bodyH * 0.84, d / 2 + 0.07);
    group.add(towelBar);

    // 8 brass gas control knobs along front bezel
    for (let ki = 0; ki < 8; ki++) {
      const kx = -w * 0.42 + (ki / 7) * (w * 0.84);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.035, 10), brassMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(kx, bodyH * 0.86, d / 2 + 0.025);
      group.add(knob);
    }

    // 8 cast-iron star burners with glowing blue/amber gas flame rings
    const flameOuterMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const flameInnerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const xCols = [-w * 0.36, -w * 0.12, w * 0.12, w * 0.36];
    const zRows = [-d * 0.24, d * 0.22];

    xCols.forEach((gx, ci) => {
      zRows.forEach((gz, ri) => {
        const grate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 12), castIronMat);
        grate.position.set(gx, bodyH + 0.06, gz);
        group.add(grate);

        const outerFlame = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 18), flameOuterMat);
        outerFlame.rotation.x = Math.PI / 2;
        outerFlame.position.set(gx, bodyH + 0.072, gz);
        group.add(outerFlame);

        const innerFlame = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 16), flameInnerMat);
        innerFlame.rotation.x = Math.PI / 2;
        innerFlame.position.set(gx, bodyH + 0.076, gz);
        group.add(innerFlame);

        // Resting hammered copper pans on selected burners
        if ((ci === 0 && ri === 0) || (ci === 2 && ri === 1)) {
          const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.08, 16), copperMat);
          pan.position.set(gx, bodyH + 0.12, gz);
          group.add(pan);
          const panHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), brassMat);
          panHandle.rotation.x = Math.PI / 2;
          panHandle.position.set(gx, bodyH + 0.14, gz + 0.22);
          group.add(panHandle);
        }
      });
    });

    // Overhead brushed-steel Charvet extraction hood with brass trim & baffle filters
    const hood = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.42, d * 1.04), brushedSteelMat);
    hood.position.set(0, bodyH + 1.38, 0);
    hood.castShadow = true;
    group.add(hood);

    const hoodBrassTrim = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.04, d * 1.06), brassMat);
    hoodBrassTrim.position.set(0, bodyH + 1.18, 0);
    group.add(hoodBrassTrim);

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.65, 14), brushedSteelMat);
    chimney.position.set(0, bodyH + 1.88, 0);
    group.add(chimney);
    return;
  }

  // -------------------------------------------------------------------------
  // 2. FOUR MIXTE COMBI-OVEN (station-bl-four / station-bl-combi / combi_oven)
  // -------------------------------------------------------------------------
  if (
    id === "station-bl-four" ||
    id === "station-bl-combi" ||
    style === "combi_oven" ||
    obj.stationKind === "kitchen_oven"
  ) {
    // Glowing interior baking chamber visible through glass window
    const chamberGlow = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.58, bodyH * 0.62, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xf97316,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      })
    );
    chamberGlow.position.set(-w * 0.1, bodyH * 0.56, d / 2 - 0.01);
    group.add(chamberGlow);

    // 4 interior stainless baking racks with roasting trays
    for (let ri = 0; ri < 4; ri++) {
      const ry = bodyH * 0.34 + ri * (bodyH * 0.14);
      const rack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.54, 0.02, 0.09), steelMat);
      rack.position.set(-w * 0.1, ry, d / 2 + 0.01);
      group.add(rack);
    }

    // Triple-glazed tinted glass oven door frame & ergonomic latch handle
    const glassDoor = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.64, bodyH * 0.68, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.42,
        roughness: 0.1,
      })
    );
    glassDoor.position.set(-w * 0.1, bodyH * 0.56, d / 2 + 0.03);
    group.add(glassDoor);

    const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 10), castIronMat);
    doorHandle.position.set(w * 0.18, bodyH * 0.54, d / 2 + 0.07);
    group.add(doorHandle);

    // Digital iCombi control column on right side
    const ctrlPanel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, bodyH * 0.68, 0.04), castIronMat);
    ctrlPanel.position.set(w * 0.34, bodyH * 0.56, d / 2 + 0.025);
    group.add(ctrlPanel);

    const screenTex = createDigitalReadoutTexture("195°C", "#f97316");
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.18, 0.18),
      new THREE.MeshBasicMaterial({ map: screenTex })
    );
    screen.position.set(w * 0.34, bodyH * 0.72, d / 2 + 0.05);
    group.add(screen);

    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 14), brassMat);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(w * 0.34, bodyH * 0.46, d / 2 + 0.05);
    group.add(dial);

    // Top steam exhaust vent chimney
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 12), steelMat);
    vent.position.set(-w * 0.2, bodyH + 0.15, -d * 0.2);
    group.add(vent);
    return;
  }

  // -------------------------------------------------------------------------
  // 3. GARDE-MANGER & PÂTISSERIE (station-bl-froid / station-bl-patisserie / station-bl-saladette)
  // -------------------------------------------------------------------------
  if (
    id === "station-bl-froid" ||
    id === "station-bl-patisserie" ||
    id === "station-bl-saladette" ||
    style === "cold_prep_marble" ||
    obj.stationKind === "kitchen_cold"
  ) {
    // White Carrara marble pastry & cold prep slab
    const marbleSlab = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.46, 0.055, d * 0.88),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.18, metalness: 0.05 })
    );
    marbleSlab.position.set(w * 0.24, bodyH + 0.055, 0.02);
    group.add(marbleSlab);

    // 6 Stainless Gastronorm (GN 1/6) ingredient pans with colorful Niçoise garnishes
    const gnColors = [0x16a34a, 0xdc2626, 0xfef08a, 0x31102f, 0xf97316, 0xfde68a];
    gnColors.forEach((col, idx) => {
      const gx = -w * 0.42 + idx * 0.22;
      const panRim = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.05, 0.26), steelMat);
      panRim.position.set(gx, bodyH + 0.06, -d * 0.22);
      group.add(panRim);

      const ingredient = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.035, 0.22),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 })
      );
      ingredient.position.set(gx, bodyH + 0.078, -d * 0.22);
      group.add(ingredient);
    });

    // Refrigerated glass sneeze guard over GN rail
    const sneezeGuard = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.62, 0.24, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45, roughness: 0.1 })
    );
    sneezeGuard.position.set(-w * 0.14, bodyH + 0.18, -d * 0.22);
    group.add(sneezeGuard);

    // Copper & Brass Planetary Pastry Mixer (Batteur Pâtissier) on the marble slab
    const mixerBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.28), copperMat);
    mixerBase.position.set(w * 0.32, bodyH + 0.24, -0.08);
    group.add(mixerBase);

    const mixerHead = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.28, 12), brassMat);
    mixerHead.rotation.x = Math.PI / 2;
    mixerHead.position.set(w * 0.32, bodyH + 0.4, 0.02);
    group.add(mixerHead);

    const mixingBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.16, 16), steelMat);
    mixingBowl.position.set(w * 0.32, bodyH + 0.16, 0.1);
    group.add(mixingBowl);
    return;
  }

  // -------------------------------------------------------------------------
  // 4. FRITEUSE DOUBLE (station-bl-friteuse / fryer_vat)
  // -------------------------------------------------------------------------
  if (id === "station-bl-friteuse" || style === "fryer_vat" || obj.stationKind === "kitchen_fryer") {
    const oilMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.15,
    });
    for (const fx of [-w * 0.23, w * 0.23]) {
      const vat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.38, 0.06, d * 0.58), oilMat);
      vat.position.set(fx, bodyH + 0.055, -0.04);
      group.add(vat);

      const basket = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 0.09, d * 0.48), steelMat);
      basket.position.set(fx, bodyH + 0.1, -0.04);
      group.add(basket);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 8), castIronMat);
      handle.rotation.x = Math.PI / 3;
      handle.position.set(fx, bodyH + 0.18, d * 0.32);
      group.add(handle);
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 5. PASSE CUISINE & RAMPE CHAUFFANTE CUIVRE (station-bl-passe / heat_lamp_pass)
  // -------------------------------------------------------------------------
  if (
    id === "station-bl-passe" ||
    style === "heat_lamp_pass" ||
    style === "heated_pass" ||
    obj.stationKind === "pass"
  ) {
    // Support posts + upper copper & stainless pass bridge
    for (const px of [-w * 0.45, w * 0.45]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.68, 12), brassMat);
      post.position.set(px, bodyH + 0.36, 0);
      group.add(post);
    }

    const upperShelf = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.05, d * 0.52), steelMat);
    upperShelf.position.set(0, bodyH + 0.68, 0);
    group.add(upperShelf);

    // Brass order ticket rail (Rampe à bons de commande) with pinned paper tickets
    const ticketRail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.045, 0.04), brassMat);
    ticketRail.position.set(0, bodyH + 0.66, d * 0.27);
    group.add(ticketRail);

    const ticketMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.6 });
    for (let ti = 0; ti < 6; ti++) {
      const tx = -w * 0.35 + ti * (w * 0.14);
      const ticket = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.008), ticketMat);
      ticket.position.set(tx, bodyH + 0.58, d * 0.28);
      ticket.rotation.z = (ti % 2 === 0 ? 1 : -1) * 0.06;
      group.add(ticket);
    }

    // 4 Glowing Hammered-Copper Infrared Heat Lamps
    const lampBulbMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (const lx of [-w * 0.34, -w * 0.11, w * 0.11, w * 0.34]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 8), brassMat);
      cord.position.set(lx, bodyH + 0.6, 0);
      group.add(cord);

      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.19, 16), copperMat);
      shade.position.set(lx, bodyH + 0.48, 0);
      group.add(shade);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), lampBulbMat);
      bulb.position.set(lx, bodyH + 0.39, 0);
      group.add(bulb);
    }

    // Stack of warmed white porcelain service plates & chef's call bell
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const plateStack = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.14, 16), plateMat);
    plateStack.position.set(-w * 0.38, bodyH + 0.11, -0.15);
    group.add(plateStack);

    const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), brassMat);
    bellDome.position.set(w * 0.4, bodyH + 0.06, 0.18);
    group.add(bellDome);
    return;
  }

  // -------------------------------------------------------------------------
  // 6. COMPTOIR EN ZINC & CAVE À VINS (station-bl-bar / zinc_bar_counter)
  // -------------------------------------------------------------------------
  if (
    id === "station-bl-bar" ||
    style === "zinc_bar_counter" ||
    style === "french_zinc_bar" ||
    obj.stationKind === "bar"
  ) {
    // Classic Parisian curved pewter "Le Zinc" countertop slab with raised lip
    const pewterMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.22 });
    const zincTop = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.07, d + 0.12), pewterMat);
    zincTop.position.y = bodyH + 0.04;
    group.add(zincTop);

    const frontBullnose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, w + 0.14, 14),
      pewterMat
    );
    frontBullnose.rotation.z = Math.PI / 2;
    frontBullnose.position.set(0, bodyH + 0.045, -(d / 2 + 0.06));
    group.add(frontBullnose);

    // Polished brass foot-rail (Repose-pieds en laiton) along customer side
    const footRail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, w * 0.96, 12), brassMat);
    footRail.rotation.z = Math.PI / 2;
    footRail.position.set(0, 0.18, -(d / 2 + 0.16));
    group.add(footRail);

    // Draft beer & Pastis water fountain towers on the Zinc counter
    const draftTower = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.42, 14), brassMat);
    draftTower.position.set(-w * 0.25, bodyH + 0.26, -0.12);
    group.add(draftTower);

    for (const hx of [-0.05, 0.05]) {
      const tapHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.16, 8), enamelBurgundyMat);
      tapHandle.rotation.x = -0.35;
      tapHandle.position.set(-w * 0.25 + hx, bodyH + 0.46, -0.2);
      group.add(tapHandle);
    }

    // Multi-tier illuminated mahogany & mirror bottle back-bar
    const backBarCabinet = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.88, 1.15, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x3b1306, roughness: 0.45 })
    );
    backBarCabinet.position.set(0, bodyH + 0.62, d * 0.36);
    group.add(backBarCabinet);

    const backBarGlow = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.82, 0.98, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.45,
        roughness: 0.2,
      })
    );
    backBarGlow.position.set(0, bodyH + 0.62, d * 0.25);
    group.add(backBarGlow);

    // 2 tiers of Wine, Champagne & Liqueur bottles
    const bottleColors = [0x14532d, 0x7f1d1d, 0xd97706, 0x065f46, 0x991b1b, 0x1e3a8a];
    for (const shelfY of [bodyH + 0.22, bodyH + 0.62]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.03, 0.22), brassMat);
      shelf.position.set(0, shelfY, d * 0.32);
      group.add(shelf);

      for (let bi = 0; bi < 9; bi++) {
        const bx = -w * 0.36 + (bi / 8) * (w * 0.72);
        const col = bottleColors[(bi + Math.round(shelfY * 10)) % bottleColors.length];
        const bottle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036, 0.038, 0.24, 10),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.15, metalness: 0.2 })
        );
        bottle.position.set(bx, shelfY + 0.13, d * 0.3);
        group.add(bottle);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.08, 8), brassMat);
        neck.position.set(bx, shelfY + 0.27, d * 0.3);
        group.add(neck);
      }
    }

    // Attach 3D sorted bar bottle shelf for live barman bottle units & slot placeholders
    const barShelf = buildSortedBarBottleShelf3D(group, obj, tr);
    group.userData = group.userData || {};
    group.userData.shelfGroup = barShelf;
    return;
  }

  // -------------------------------------------------------------------------
  // 7. MACHINE EXPRESSO CONTI & MOULIN MAZZER (station-bl-expresso)
  // -------------------------------------------------------------------------
  if (id === "station-bl-expresso" || style === "espresso_bar" || obj.stationKind === "bar_coffee") {
    const machineBody = new THREE.Mesh(new THREE.BoxGeometry(w * 0.58, 0.38, d * 0.68), copperMat);
    machineBody.position.set(-w * 0.14, bodyH + 0.22, 0);
    group.add(machineBody);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.04, d * 0.7), brassMat);
    topRail.position.set(-w * 0.14, bodyH + 0.42, 0);
    group.add(topRail);

    // 2 Portafilter group heads
    for (const gx of [-w * 0.26, -w * 0.02]) {
      const pf = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.06, 10), steelMat);
      pf.position.set(gx, bodyH + 0.22, -d * 0.36);
      group.add(pf);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.14, 8), castIronMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(gx, bodyH + 0.22, -d * 0.45);
      group.add(handle);
    }

    // Mazzer Coffee Grinder with clear bean hopper
    const grinderBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.26, 12), steelMat);
    grinderBase.position.set(w * 0.28, bodyH + 0.16, 0);
    group.add(grinderBase);

    const hopper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.05, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.3, transparent: true, opacity: 0.85 })
    );
    hopper.position.set(w * 0.28, bodyH + 0.36, 0);
    group.add(hopper);
    return;
  }

  // -------------------------------------------------------------------------
  // 8. LAVERIE & PLONGE (station-bl-plonge / dishwashing)
  // -------------------------------------------------------------------------
  if (id === "station-bl-plonge" || style === "dish_pit" || obj.stationKind === "dishwashing") {
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
    });
    // Twin deep stainless sinks
    for (const sx of [-w * 0.26, 0.0]) {
      const basin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.24, 0.05, d * 0.62), waterMat);
      basin.position.set(sx, bodyH + 0.04, 0.02);
      group.add(basin);
    }

    // Tall chrome gooseneck pre-rinse sprayer arc
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.62, 10), steelMat);
    stem.position.set(-w * 0.13, bodyH + 0.34, -d * 0.32);
    group.add(stem);

    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 16, Math.PI), steelMat);
    arc.position.set(-w * 0.13, bodyH + 0.64, -d * 0.16);
    arc.rotation.y = Math.PI / 2;
    group.add(arc);

    // Inclined dish drying rack with clean white porcelain plates
    const rack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.08, d * 0.64), steelMat);
    rack.position.set(w * 0.28, bodyH + 0.08, 0);
    group.add(rack);

    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    for (let pi = 0; pi < 6; pi++) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 14), plateMat);
      plate.rotation.z = Math.PI / 2 - 0.18;
      plate.position.set(w * 0.16 + pi * 0.045, bodyH + 0.18, 0);
      group.add(plate);
    }
    return;
  }

  // -------------------------------------------------------------------------
  // 9. CHAMBRES FROIDES & RÉSERVE (storage-bl-cold / storage-bl-dry)
  // -------------------------------------------------------------------------
  if (
    id === "storage-bl-cold" ||
    id === "storage-bl-dry" ||
    style === "walkin_cooler" ||
    obj.objectType === "ingredient_storage" ||
    obj.stationKind === "storage"
  ) {
    // Insulated stainless cold-room door with cam-lock hinges & inspection window
    const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.44, bodyH * 0.84, 0.06), brushedSteelMat);
    door.position.set(-w * 0.18, bodyH * 0.44, d / 2 + 0.02);
    group.add(door);

    const windowGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.42, 0.07),
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        roughness: 0.1,
      })
    );
    windowGlass.position.set(-w * 0.18, bodyH * 0.62, d / 2 + 0.025);
    group.add(windowGlass);

    const safetyHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.09), brassMat);
    safetyHandle.position.set(0.0, bodyH * 0.46, d / 2 + 0.06);
    group.add(safetyHandle);

    // Digital "-2°C" LED thermometer panel
    const thermoTex = createDigitalReadoutTexture("-2.0°C", "#38bdf8");
    const thermoDisplay = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.17),
      new THREE.MeshBasicMaterial({ map: thermoTex })
    );
    thermoDisplay.position.set(w * 0.24, bodyH * 0.78, d / 2 + 0.03);
    group.add(thermoDisplay);

    // Stocked side shelving with wooden produce & wine crates
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
    for (const sy of [bodyH * 0.25, bodyH * 0.52]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.2, 0.12), crateMat);
      crate.position.set(w * 0.24, sy, d / 2 + 0.04);
      group.add(crate);
    }

    // Attach 3-tier sorted storage rack (Tier 1..3, Slots 0..5) for live physical stock units
    const storageRack = buildSortedStorageRack3D(group, obj, tr);
    group.userData = group.userData || {};
    group.userData.shelfGroup = storageRack;
  }
}
