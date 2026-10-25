import * as THREE from "three";
import { buildSortedStorageRack3D, buildSortedBarBottleShelf3D } from "../assets/KitchenBarShelves3D";

export const OSTERIA_BRAND = {
  businessId: "business-osteria-bellavista",
  name: "Osteria Bellavista",
  subtitle: "Trattoria Toscana, Pasta Fresca & Griglia a Legna",
  motto: "Sfoglia Tirata a Mano & Brace di Quercia Toscana",
  crestUrl: "/brands/osteria/crest.png",
  menuBoardUrl: "/brands/osteria/enoteca_art.png",
  primaryColor: "#ef4444",
  accentColor: "#15803d",
  signatureDishes: [
    "Bistecca alla Fiorentina 900g alla Brace di Quercia",
    "Tagliatelle Fresche al Ragù Antico di Chianina",
    "Pappardelle al Cinghiale del Chianti",
    "Tiramisù Tradizionale di Casa Bellavista",
  ],
};

// Shared texture cache so multiple mounts do not re-fetch textures unnecessarily
const textureCache = new Map();

function loadBrandTexture(url) {
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }
  const loader = new THREE.TextureLoader();
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, tex);
  return tex;
}

/**
 * Generates a procedural striped Tuscan awning canvas texture (Terracotta, Forest Green & Warm Parchment)
 */
function createTuscanAwningTexture() {
  if (textureCache.has("__osteria_awning_tex")) {
    return textureCache.get("__osteria_awning_tex");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const stripes = [
    "#b91c1c", // Deep Tuscan Terracotta Red
    "#fef3c7", // Warm Florentine Cream
    "#15803d", // Tuscan Olive / Forest Green
    "#fef3c7", // Warm Florentine Cream
  ];
  const stripeW = canvas.width / (stripes.length * 4);
  for (let i = 0; i < stripes.length * 4; i++) {
    ctx.fillStyle = stripes[i % stripes.length];
    ctx.fillRect(i * stripeW, 0, stripeW, canvas.height);
  }

  // Subtle fabric weave shading
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  for (let y = 0; y < canvas.height; y += 8) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(3, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  textureCache.set("__osteria_awning_tex", tex);
  return tex;
}

/**
 * Generates a procedural rustic Siena brick texture for the kitchen pass arch and wood grill hearth
 */
function createTuscanBrickTexture() {
  if (textureCache.has("__osteria_brick_tex")) {
    return textureCache.get("__osteria_brick_tex");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Mortar background
  ctx.fillStyle = "#d6d3d1";
  ctx.fillRect(0, 0, 256, 256);

  const brickPalette = ["#9a3412", "#7c2d12", "#b91c1c", "#991b1b", "#c2410c"];
  const rows = 8;
  const cols = 4;
  const bh = 256 / rows;
  const bw = 256 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw / 2);
    for (let c = -1; c <= cols; c++) {
      ctx.fillStyle = brickPalette[(r * 3 + c + 4) % brickPalette.length];
      ctx.fillRect(c * bw + offset + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  textureCache.set("__osteria_brick_tex", tex);
  return tex;
}

/**
 * Tags all child meshes in a group with interactive metadata and pushes them to `interactiveMeshes`.
 */
function registerInteractiveGroup(group, interactiveMeshes, meta) {
  group.userData = { ...meta };
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData = { ...meta, ...child.userData };
      if (Array.isArray(interactiveMeshes)) {
        interactiveMeshes.push(child);
      }
    }
  });
}

/**
 * Constructs and adds to `scene` a `THREE.Group` containing bespoke Tuscan Trattoria
 * architectural details for Osteria Bellavista (X = 24..42m, Z = 0..18m).
 *
 * @param {THREE.Scene} scene
 * @param {Object|Array} premises
 * @param {Array<THREE.Mesh>} interactiveMeshes
 * @returns {THREE.Group}
 */
export function buildOsteriaInterior(scene, premises, interactiveMeshes = []) {
  const premObj = Array.isArray(premises)
    ? premises.find(
        (p) => p.businessId === OSTERIA_BRAND.businessId || p._id === "premises-osteria-bellavista"
      )
    : premises;

  const bounds = premObj?.bounds || { minX: 24.0, maxX: 42.0, minZ: 0.0, maxZ: 18.0 };
  const minX = bounds.minX ?? 24.0;
  const maxX = bounds.maxX ?? 42.0;
  const premisesSceneId = premObj?._id ? `scene-${premObj._id}` : "scene-premises-premises-osteria-bellavista";

  const root = new THREE.Group();
  root.name = "OsteriaBellavistaInteriorGroup";

  const crestTex = loadBrandTexture(OSTERIA_BRAND.crestUrl);
  const enotecaTex = loadBrandTexture(OSTERIA_BRAND.menuBoardUrl);
  const awningTex = createTuscanAwningTexture();
  const brickTex = createTuscanBrickTexture();

  // Shared materials
  const walnutMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.65, metalness: 0.08 });
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.72, metalness: 0.05 });
  const wroughtIronMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.82 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.22, metalness: 0.88 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.25, metalness: 0.85 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.78, metalness: 0.05 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.22, metalness: 0.08 });
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });
  const warmGlowMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });

  // ===========================================================================
  // 1. TUSCAN TERRACOTTA & FOREST-GREEN STRIPED AWNING (X = 24.5..41.5, Z = 14.0)
  //    & RUSTIC WOODEN MENU LECTERN ("Menu della Tradizione") AT X = 30.8, Z = 14.6
  // ===========================================================================
  const facadeGroup = new THREE.Group();
  const awningMat = new THREE.MeshStandardMaterial({
    map: awningTex,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });

  // Left awning wing (X = 24.5 .. 31.4) & Right awning wing (X = 33.6 .. 41.5)
  // Leaves main entrance clear around X = 31.5 .. 33.5
  const awningSegments = [
    { startX: 24.5, endX: 31.4 },
    { startX: 33.6, endX: 41.5 },
  ];

  for (const seg of awningSegments) {
    const segW = seg.endX - seg.startX;
    const cx = (seg.startX + seg.endX) / 2;

    // Sloped canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.07, 1.85), awningMat);
    canopy.position.set(cx, 2.92, 14.82);
    canopy.rotation.x = 0.28;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    facadeGroup.add(canopy);

    // Front valance skirt
    const valance = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.24, 0.04), awningMat);
    valance.position.set(cx, 2.58, 15.68);
    valance.castShadow = true;
    facadeGroup.add(valance);

    // Wrought-iron scroll brackets under awning
    for (const bx of [seg.startX + 0.35, cx, seg.endX - 0.35]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.85, 8), wroughtIronMat);
      strut.position.set(bx, 2.55, 14.8);
      strut.rotation.x = Math.PI / 2 - 0.38;
      facadeGroup.add(strut);
    }
  }

  // Arched Tuscan Entrance Portico framing main street door (X = 32.5, Z = 14.0)
  const doorCenterX = 32.5;
  for (const dx of [-1.15, 1.15]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.05, 0.32), brickMat);
    pilaster.position.set(doorCenterX + dx, 1.525, 14.05);
    pilaster.castShadow = true;
    facadeGroup.add(pilaster);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.38), marbleMat);
    cap.position.set(doorCenterX + dx, 3.08, 14.05);
    facadeGroup.add(cap);
  }
  const lintelBeam = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.26, 0.36), walnutMat);
  lintelBeam.position.set(doorCenterX, 3.22, 14.06);
  facadeGroup.add(lintelBeam);

  // Exterior Mounted Brand Crest Medallion beside main entrance
  const extCrestFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 28), brassMat);
  extCrestFrame.rotation.x = Math.PI / 2;
  extCrestFrame.position.set(34.35, 2.15, 14.12);
  facadeGroup.add(extCrestFrame);

  const extCrestFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.07, 28),
    new THREE.MeshStandardMaterial({ map: crestTex, roughness: 0.35 })
  );
  extCrestFace.rotation.x = Math.PI / 2;
  extCrestFace.rotation.y = Math.PI / 2;
  extCrestFace.position.set(34.35, 2.15, 14.13);
  facadeGroup.add(extCrestFace);

  // Rustic Wooden Menu Lectern ("Menu della Tradizione") at X = 30.8, Z = 14.6
  const lecternGroup = new THREE.Group();
  lecternGroup.position.set(30.8, 0.0, 14.6);

  const lecternBase = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.48), walnutMat);
  lecternBase.position.y = 0.04;
  lecternBase.castShadow = true;
  lecternGroup.add(lecternBase);

  const lecternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.05, 12), walnutMat);
  lecternPost.position.y = 0.56;
  lecternPost.castShadow = true;
  lecternGroup.add(lecternPost);

  const lecternBoard = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.56), walnutMat);
  lecternBoard.position.set(0, 1.12, 0);
  lecternBoard.rotation.x = 0.48;
  lecternBoard.castShadow = true;
  lecternGroup.add(lecternBoard);

  // Textured Menu Page with `/brands/osteria/enoteca_art.png`
  const menuSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.64, 0.46),
    new THREE.MeshStandardMaterial({ map: enotecaTex, roughness: 0.32 })
  );
  menuSheet.position.set(0, 1.15, 0.01);
  menuSheet.rotation.x = -Math.PI / 2 + 0.48;
  lecternGroup.add(menuSheet);

  // Brass reading lamp above menu lectern
  const lampNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), brassMat);
  lampNeck.position.set(0, 1.3, -0.2);
  lecternGroup.add(lampNeck);
  const lampHood = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.06), brassMat);
  lampHood.position.set(0, 1.38, -0.14);
  lecternGroup.add(lampHood);

  registerInteractiveGroup(lecternGroup, interactiveMeshes, {
    sceneObjectId: premisesSceneId,
    label: "Menu della Tradizione — Osteria Bellavista (Sfoglia & Bistecca alla Fiorentina)",
    businessId: OSTERIA_BRAND.businessId,
  });
  facadeGroup.add(lecternGroup);

  registerInteractiveGroup(facadeGroup, interactiveMeshes, {
    sceneObjectId: premisesSceneId,
    label: `${OSTERIA_BRAND.name} — Facciata & Tendone Toscano`,
    businessId: OSTERIA_BRAND.businessId,
  });
  root.add(facadeGroup);

  // ===========================================================================
  // 2. FRAMED BRAND CREST & TUSCAN FRESCO MURAL ON INTERIOR WALLS
  // ===========================================================================
  const artGroup = new THREE.Group();

  // A) Grand Tuscan Culinary & Enoteca Fresco Mural on West Dining Wall (X = 24.16, Z = 9.6)
  const muralFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.95, 3.3), walnutMat);
  muralFrame.position.set(minX + 0.15, 1.88, 9.6);
  muralFrame.castShadow = true;
  artGroup.add(muralFrame);

  const muralGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.78, 3.12), brassMat);
  muralGoldTrim.position.set(minX + 0.16, 1.88, 9.6);
  artGroup.add(muralGoldTrim);

  const muralCanvas = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.66),
    new THREE.MeshStandardMaterial({ map: enotecaTex, roughness: 0.38 })
  );
  muralCanvas.rotation.y = Math.PI / 2;
  muralCanvas.position.set(minX + 0.21, 1.88, 9.6);
  artGroup.add(muralCanvas);

  // Brass gallery picture light above the fresco
  const picLightBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 10), brassMat);
  picLightBar.rotation.x = Math.PI / 2;
  picLightBar.position.set(minX + 0.32, 2.92, 9.6);
  artGroup.add(picLightBar);

  // B) Framed Osteria Bellavista Brand Crest on West Dining Wall (X = 24.16, Z = 6.3)
  const westCrestBacking = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.38, 1.38), walnutMat);
  westCrestBacking.position.set(minX + 0.15, 1.92, 6.3);
  artGroup.add(westCrestBacking);

  const westCrestGold = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.24, 1.24), brassMat);
  westCrestGold.position.set(minX + 0.16, 1.92, 6.3);
  artGroup.add(westCrestGold);

  const westCrestPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.14, 1.14),
    new THREE.MeshStandardMaterial({ map: crestTex, roughness: 0.32 })
  );
  westCrestPlane.rotation.y = Math.PI / 2;
  westCrestPlane.position.set(minX + 0.21, 1.92, 6.3);
  artGroup.add(westCrestPlane);

  // C) Central Crest Medallion above the Cucina a Vista Pass Arch (X = 35.0, Z = 5.14, Y = 2.62)
  const passCrestFrame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.08), walnutMat);
  passCrestFrame.position.set(35.0, 2.62, 5.14);
  artGroup.add(passCrestFrame);

  const passCrestFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.98),
    new THREE.MeshStandardMaterial({ map: crestTex, roughness: 0.3 })
  );
  passCrestFace.position.set(35.0, 2.62, 5.19);
  artGroup.add(passCrestFace);

  registerInteractiveGroup(artGroup, interactiveMeshes, {
    sceneObjectId: premisesSceneId,
    label: `${OSTERIA_BRAND.name} — Affresco Toscano & Stemma Storico`,
    businessId: OSTERIA_BRAND.businessId,
  });
  root.add(artGroup);

  // ===========================================================================
  // 3. FLOOR-TO-CEILING ENOTECA WINE WALL & OAK CASKS (East Wall X = 41.5, Z = 6.0..13.0)
  // ===========================================================================
  const enotecaGroup = new THREE.Group();
  const enotecaX = maxX - 0.38; // 41.62m (extending inward to 41.3m)
  const enotecaDepth = 6.8; // Z = 6.1 .. 12.9
  const enotecaCenterZ = 9.5;

  // Main floor-to-ceiling walnut cabinet carcass
  const wineBackPanel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.85, enotecaDepth), walnutMat);
  wineBackPanel.position.set(maxX - 0.18, 1.45, enotecaCenterZ);
  wineBackPanel.castShadow = true;
  enotecaGroup.add(wineBackPanel);

  // Horizontal wine rack shelves & warm LED under-shelf strips
  const shelfHeights = [0.78, 1.18, 1.58, 1.98, 2.38, 2.78];
  for (const sy of shelfHeights) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, enotecaDepth), oakMat);
    shelf.position.set(enotecaX, sy, enotecaCenterZ);
    shelf.castShadow = true;
    enotecaGroup.add(shelf);

    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.015, enotecaDepth * 0.94),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    ledStrip.position.set(enotecaX - 0.12, sy - 0.03, enotecaCenterZ);
    enotecaGroup.add(ledStrip);
  }

  // Vertical bay dividers & diagonal diamond wine cubbies
  for (let bz = 6.2; bz <= 12.8; bz += 1.1) {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.85, 0.05), walnutMat);
    divider.position.set(enotecaX, 1.45, bz);
    enotecaGroup.add(divider);

    if (bz < 12.2) {
      // Diamond X-lattice in middle wine cubby tier
      const diag1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 1.12), oakMat);
      diag1.position.set(enotecaX, 1.78, bz + 0.55);
      diag1.rotation.x = Math.PI / 4;
      enotecaGroup.add(diag1);

      const diag2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 1.12), oakMat);
      diag2.position.set(enotecaX, 1.78, bz + 0.55);
      diag2.rotation.x = -Math.PI / 4;
      enotecaGroup.add(diag2);
    }
  }

  // Dozens of green/ruby Chianti Classico Riserva & Brunello bottles along shelves
  const greenGlassMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.18, metalness: 0.25 });
  const rubyGlassMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.2, metalness: 0.2 });
  const strawFiascoMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
  const goldFoilMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.8 });

  const bottleRowsY = [0.82, 1.22, 1.62, 2.02, 2.42];
  for (let rIdx = 0; rIdx < bottleRowsY.length; rIdx++) {
    const by = bottleRowsY[rIdx];
    for (let bz = 6.42; bz <= 12.55; bz += 0.34) {
      const isFiasco = (rIdx + Math.round(bz * 3)) % 4 === 0;
      const bMat = (rIdx + Math.round(bz * 5)) % 2 === 0 ? greenGlassMat : rubyGlassMat;

      if (isFiasco) {
        // Traditional Tuscan straw-wrapped Chianti fiasco bottle
        const fiascoBase = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), strawFiascoMat);
        fiascoBase.scale.y = 1.15;
        fiascoBase.position.set(enotecaX - 0.04, by + 0.07, bz);
        enotecaGroup.add(fiascoBase);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.14, 8), greenGlassMat);
        neck.position.set(enotecaX - 0.04, by + 0.17, bz);
        enotecaGroup.add(neck);
      } else {
        // Upright Bordeaux/Burgundy reserve bottle with ruby/gold label & foil capsule
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.24, 10), bMat);
        bottle.position.set(enotecaX - 0.04, by + 0.12, bz);
        enotecaGroup.add(bottle);

        const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.07, 8), goldFoilMat);
        capsule.position.set(enotecaX - 0.04, by + 0.26, bz);
        enotecaGroup.add(capsule);
      }
    }
  }

  // Aged Oak Wine Barrels (Botti Toscane) along base of Enoteca Wall
  for (const caskZ of [6.65, 7.65, 8.65, 12.25]) {
    const caskGroup = new THREE.Group();
    caskGroup.position.set(enotecaX - 0.14, 0.36, caskZ);

    const barrelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.58, 16), oakMat);
    barrelBody.rotation.z = Math.PI / 2;
    barrelBody.castShadow = true;
    caskGroup.add(barrelBody);

    // Iron hoops around barrel
    for (const hx of [-0.2, -0.08, 0.08, 0.2]) {
      const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.246, 0.246, 0.025, 16), wroughtIronMat);
      hoop.rotation.z = Math.PI / 2;
      hoop.position.x = hx;
      caskGroup.add(hoop);
    }

    // Brass spigot on front barrel head
    const spigot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 8), brassMat);
    spigot.rotation.z = Math.PI / 2;
    spigot.position.set(-0.31, -0.06, 0);
    caskGroup.add(spigot);

    enotecaGroup.add(caskGroup);
  }

  registerInteractiveGroup(enotecaGroup, interactiveMeshes, {
    sceneObjectId: "scene-ob-station-bar",
    label: "Cantina Storica & Botti di Rovere (Chianti Classico Riserva & Brunello DOCG)",
    businessId: OSTERIA_BRAND.businessId,
  });
  root.add(enotecaGroup);

  // ===========================================================================
  // 4. RUSTIC EXPOSED TIMBER CEILING BEAMS & WARM WROUGHT-IRON LANTERNS (Y = 2.65m)
  // ===========================================================================
  const ceilingGroup = new THREE.Group();
  const beamWidth = maxX - minX - 0.4;
  const beamCenterX = (minX + maxX) / 2;

  for (const bz of [5.8, 8.2, 10.6, 13.0]) {
    // Transverse dark oak ceiling beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(beamWidth, 0.18, 0.22), walnutMat);
    beam.position.set(beamCenterX, 2.88, bz);
    beam.castShadow = true;
    ceilingGroup.add(beam);

    // Wall corbel brackets at West and East ends
    for (const sideX of [minX + 0.35, maxX - 0.35]) {
      const corbel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.24, 0.24), oakMat);
      corbel.position.set(sideX, 2.7, bz);
      ceilingGroup.add(corbel);
    }

    // Suspended Wrought-Iron Chandeliers / Tuscan Lanterns at Y = 2.65m
    for (const lx of [27.5, 32.8, 38.0]) {
      const lantern = new THREE.Group();
      lantern.position.set(lx, 2.65, bz);

      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 8), wroughtIronMat);
      chain.position.y = 0.14;
      lantern.add(chain);

      const ironRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 20), wroughtIronMat);
      ironRing.rotation.x = Math.PI / 2;
      lantern.add(ironRing);

      // 4 warm candle bulbs around the wrought-iron wheel
      for (let bi = 0; bi < 4; bi++) {
        const ang = (bi / 4) * Math.PI * 2;
        const candleCup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.04, 8), wroughtIronMat);
        candleCup.position.set(Math.cos(ang) * 0.28, 0.03, Math.sin(ang) * 0.28);
        lantern.add(candleCup);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), warmGlowMat);
        bulb.position.set(Math.cos(ang) * 0.28, 0.09, Math.sin(ang) * 0.28);
        lantern.add(bulb);
      }

      ceilingGroup.add(lantern);
    }
  }

  root.add(ceilingGroup);

  // ===========================================================================
  // 5. BRICK ARCH KITCHEN PASS & HANGING PROSCIUTTO / COPPER POTS ALONG Z = 5.0
  //    (Kitchen door at X = 31.5, Z = 5.0; Pass window at X = 33.0..37.0, Z = 5.0)
  // ===========================================================================
  const passArchGroup = new THREE.Group();
  const passZ = 5.0;

  // Brick masonry piers defining the kitchen doorway (X = 31.5) & open pass window (X = 33.0..37.0)
  const pierSpecs = [
    { x: 30.55, w: 0.45 }, // West side of kitchen door
    { x: 32.55, w: 0.55 }, // Pier between kitchen door (X=31.5) and pass window (X=33.0..37.0)
    { x: 37.35, w: 0.55 }, // East side of pass window
  ];

  for (const pier of pierSpecs) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(pier.w, 2.75, 0.34), brickMat);
    column.position.set(pier.x, 1.375, passZ);
    column.castShadow = true;
    passArchGroup.add(column);
  }

  // Upper brick arch header spanning across kitchen door & pass window (X = 30.3 .. 37.65)
  const archHeader = new THREE.Mesh(new THREE.BoxGeometry(7.35, 0.52, 0.36), brickMat);
  archHeader.position.set(33.98, 2.52, passZ);
  archHeader.castShadow = true;
  passArchGroup.add(archHeader);

  // Carrara Marble Pass Counter Sill along X = 33.0 .. 37.0, Z = 5.0
  const passCounterBase = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.96, 0.68), brickMat);
  passCounterBase.position.set(35.0, 0.48, passZ);
  passCounterBase.castShadow = true;
  passArchGroup.add(passCounterBase);

  const passMarbleSlab = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.07, 0.86), marbleMat);
  passMarbleSlab.position.set(35.0, 0.99, passZ);
  passMarbleSlab.castShadow = true;
  passMarbleSlab.receiveShadow = true;
  passArchGroup.add(passMarbleSlab);

  // Overhead Wrought-Iron Rack with Hanging Copper Pots, Cured Prosciutto & Garlic Braids
  const potRackBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.8, 12), wroughtIronMat);
  potRackBar.rotation.z = Math.PI / 2;
  potRackBar.position.set(35.0, 2.18, passZ);
  passArchGroup.add(potRackBar);

  // Hanging Copper Saucepans (Pentole in Rame)
  for (const px of [33.4, 34.4, 35.6, 36.5]) {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), wroughtIronMat);
    hook.position.set(px, 2.09, passZ);
    passArchGroup.add(hook);

    const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.11, 14), copperMat);
    potBody.rotation.x = Math.PI / 2;
    potBody.position.set(px, 1.92, passZ + 0.04);
    passArchGroup.add(potBody);

    const potHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), brassMat);
    potHandle.position.set(px, 2.06, passZ + 0.04);
    passArchGroup.add(potHandle);
  }

  // Hanging Cured Prosciutto di Parma / Toscano DOP Hams
  const hamMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55 });
  const rindMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 });
  for (const hx of [33.9, 35.0, 36.1]) {
    const hamGroup = new THREE.Group();
    hamGroup.position.set(hx, 1.9, passZ - 0.06);

    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6), wroughtIronMat);
    cord.position.y = 0.2;
    hamGroup.add(cord);

    const legBody = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), hamMat);
    legBody.scale.set(0.85, 1.85, 0.65);
    legBody.position.y = -0.04;
    hamGroup.add(legBody);

    const hock = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, 0.2, 8), rindMat);
    hock.position.y = 0.16;
    hamGroup.add(hock);

    passArchGroup.add(hamGroup);
  }

  // Braided White Garlic & Red Peperoncino Clusters flanking the pass arch
  const garlicMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
  const chiliMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  for (let i = 0; i < 5; i++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), garlicMat);
    bulb.position.set(32.85, 2.05 - i * 0.085, passZ + 0.18);
    passArchGroup.add(bulb);

    const chili = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.1, 8), chiliMat);
    chili.rotation.x = Math.PI;
    chili.position.set(37.12, 2.05 - i * 0.085, passZ + 0.18);
    passArchGroup.add(chili);
  }

  registerInteractiveGroup(passArchGroup, interactiveMeshes, {
    sceneObjectId: "scene-ob-station-passe",
    label: "Arco Cucina a Vista — Prosciutti Toscani DOP & Pentole in Rame",
    businessId: OSTERIA_BRAND.businessId,
  });
  root.add(passArchGroup);

  // ===========================================================================
  // 5B. BESPOKE SFOGLIA FRESH PASTA ATELIER BENCH IN OPEN KITCHEN (X = 28.4, Z = 2.2)
  //     Ensures the hand-rolled pasta showcase is prominently visible in Cucina a Vista
  // ===========================================================================
  const sfogliaAtelierGroup = new THREE.Group();
  sfogliaAtelierGroup.position.set(28.4, 0.0, 2.2);
  const sfogliaTr = { width: 2.2, depth: 0.95, height: 0.92 };

  const sfogliaBase = new THREE.Mesh(
    new THREE.BoxGeometry(sfogliaTr.width, sfogliaTr.height, sfogliaTr.depth),
    walnutMat
  );
  sfogliaBase.position.y = sfogliaTr.height / 2;
  sfogliaBase.castShadow = true;
  sfogliaBase.receiveShadow = true;
  sfogliaAtelierGroup.add(sfogliaBase);

  decorateOsteriaStation(
    sfogliaAtelierGroup,
    {
      domainEntityId: "station-ob-sfoglia",
      equipmentStyle: "marble_pasta_bench",
      stationKind: "pasta_bench",
    },
    sfogliaTr
  );

  registerInteractiveGroup(sfogliaAtelierGroup, interactiveMeshes, {
    sceneObjectId: "scene-ob-station-pasta",
    label: "Laboratorio Sfoglia — Spianatoia in Marmo di Carrara & Mattarello Toscano",
    businessId: OSTERIA_BRAND.businessId,
  });
  root.add(sfogliaAtelierGroup);

  // ===========================================================================
  // 6. MEDITERRANEAN TERRAZZA (Z = 14..18) WITH TERRACOTTA AMPHORA PLANTERS,
  //    SCULPTED OLIVE TREES, AND WARM FESTOON LIGHTS
  // ===========================================================================
  const terrazzaGroup = new THREE.Group();
  const oliveTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.88 });
  const oliveLeafMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.72 });
  const silverLeafMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.68 });

  // Sculpted Olive Trees in Hand-Thrown Terracotta Amphora Planters (Orcio Toscano)
  const amphoraPositions = [
    { x: 25.2, z: 14.8 },
    { x: 25.2, z: 17.6 },
    { x: 30.8, z: 17.8 },
    { x: 34.8, z: 17.8 },
    { x: 40.6, z: 17.6 },
    { x: 40.6, z: 14.8 },
  ];

  for (const pos of amphoraPositions) {
    const planterGroup = new THREE.Group();
    planterGroup.position.set(pos.x, 0.0, pos.z);

    // Terracotta amphora belly & rim
    const amphoraFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.16, 14), terracottaMat);
    amphoraFoot.position.y = 0.08;
    planterGroup.add(amphoraFoot);

    const amphoraBelly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), terracottaMat);
    amphoraBelly.scale.y = 1.15;
    amphoraBelly.position.y = 0.42;
    amphoraBelly.castShadow = true;
    planterGroup.add(amphoraBelly);

    const amphoraRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 10, 18), terracottaMat);
    amphoraRim.rotation.x = Math.PI / 2;
    amphoraRim.position.y = 0.76;
    planterGroup.add(amphoraRim);

    // Gnarled Olive Tree Trunk & Multi-Lobed Silvery-Green Canopy
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.11, 1.15, 10), oliveTrunkMat);
    trunk.position.y = 1.25;
    trunk.rotation.z = 0.06;
    trunk.castShadow = true;
    planterGroup.add(trunk);

    const mainCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 1), oliveLeafMat);
    mainCrown.scale.set(1.15, 0.82, 1.1);
    mainCrown.position.set(0, 1.98, 0);
    mainCrown.castShadow = true;
    planterGroup.add(mainCrown);

    const subCrown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), silverLeafMat);
    subCrown1.position.set(-0.34, 1.84, 0.18);
    planterGroup.add(subCrown1);

    const subCrown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), silverLeafMat);
    subCrown2.position.set(0.36, 1.88, -0.15);
    planterGroup.add(subCrown2);

    terrazzaGroup.add(planterGroup);
  }

  // Terrazza Timber Posts & Warm Festoon String Lights (Catena Luminosa) across Z = 14.3 .. 17.8
  const postCoords = [
    { x: 25.6, z: 17.8 },
    { x: 30.4, z: 17.8 },
    { x: 35.2, z: 17.8 },
    { x: 40.2, z: 17.8 },
  ];
  for (const pc of postCoords) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.75, 10), wroughtIronMat);
    post.position.set(pc.x, 1.375, pc.z);
    post.castShadow = true;
    terrazzaGroup.add(post);
  }

  // Festoon light catenary strands & glowing warm bulbs
  for (const strandZ of [15.4, 16.6, 17.75]) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 14.6, 8), wroughtIronMat);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(32.9, 2.68, strandZ);
    terrazzaGroup.add(wire);

    for (let bx = 26.2; bx <= 39.8; bx += 1.35) {
      const sag = Math.sin(((bx - 25.6) / 14.6) * Math.PI) * 0.14;
      const bulbSocket = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), wroughtIronMat);
      bulbSocket.position.set(bx, 2.66 - sag, strandZ);
      terrazzaGroup.add(bulbSocket);

      const festoonBulb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), warmGlowMat);
      festoonBulb.position.set(bx, 2.6 - sag, strandZ);
      terrazzaGroup.add(festoonBulb);
    }
  }

  registerInteractiveGroup(terrazzaGroup, interactiveMeshes, {
    sceneObjectId: premisesSceneId,
    label: "Terrazza Italiana — Orcio in Terracotta, Ulivi Toscani & Catena Luminosa",
    businessId: OSTERIA_BRAND.businessId,
  });
  root.add(terrazzaGroup);

  if (scene && typeof scene.add === "function") {
    scene.add(root);
  }

  return root;
}

/**
 * Adds ultra-detailed 3D culinary equipment to each Osteria Bellavista station group.
 *
 * Supports all Osteria station identifiers and equipment styles:
 *  - `station-ob-grill` (`tuscan_wood_grill` / `tuscan_hearth_grill`)
 *  - `station-ob-pasta` (`pasta_cooker` / `pasta_boiler_range`)
 *  - `station-ob-sfoglia` (`marble_pasta_bench`)
 *  - `station-ob-freddo` / `station-ob-antipasti` (`cold_prep_marble`)
 *  - `station-ob-pass` / `station-ob-passe` (`heat_lamp_pass` / `heated_pass`)
 *  - `station-ob-bar` (`italian_enoteca_bar`)
 *  - `station-ob-plonge` & `storage-ob-cold`
 *
 * @param {THREE.Group} group
 * @param {Object} obj
 * @param {Object} tr
 */
export function decorateOsteriaStation(group, obj = {}, tr = {}) {
  if (!group) return;

  const id = obj.domainEntityId || obj.sceneObjectId || "";
  const style = obj.equipmentStyle || "";
  const kind = obj.stationKind || "";
  const w = tr.width || tr.w || 2.2;
  const d = tr.depth || tr.d || 1.0;
  const bodyH = tr.height || 0.95;

  const brickTex = createTuscanBrickTexture();
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.82, roughness: 0.28 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.22 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.86, roughness: 0.22 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.84, roughness: 0.24 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.06 });
  const walnutMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.62 });
  const pastaDoughMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.48 });

  // ===========================================================================
  // 1. `station-ob-grill` (`tuscan_wood_grill` / `tuscan_hearth_grill`)
  //    Red-brick hearth arch, glowing red-orange oak charcoal ember bed,
  //    heavy iron grill grates, hanging wrought-iron meat hooks, and copper chimney flue
  // ===========================================================================
  if (
    id.includes("station-ob-grill") ||
    style === "tuscan_wood_grill" ||
    style === "tuscan_hearth_grill" ||
    kind === "wood_grill"
  ) {
    // Red-brick back & side hearth walls
    const backHearth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.95, 0.2), brickMat);
    backHearth.position.set(0, bodyH + 0.47, -d * 0.38);
    backHearth.castShadow = true;
    group.add(backHearth);

    for (const sx of [-w * 0.44, w * 0.44]) {
      const sidePier = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.95, d * 0.82), brickMat);
      sidePier.position.set(sx, bodyH + 0.47, -0.02);
      sidePier.castShadow = true;
      group.add(sidePier);
    }

    // Brick Hearth Arch Header
    const hearthArch = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.24, d * 0.86), brickMat);
    hearthArch.position.set(0, bodyH + 0.96, -0.02);
    group.add(hearthArch);

    // Copper Chimney Hood & Vertical Flue Pipe
    const hoodCone = new THREE.Mesh(new THREE.ConeGeometry(w * 0.52, 0.55, 4), copperMat);
    hoodCone.rotation.y = Math.PI / 4;
    hoodCone.position.set(0, bodyH + 1.32, -0.02);
    group.add(hoodCone);

    const fluePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.65, 14), copperMat);
    fluePipe.position.set(0, bodyH + 1.78, -0.02);
    group.add(fluePipe);

    // Glowing Red-Orange Oak Charcoal Ember Bed & Split Oak Logs
    const emberBed = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.74, 0.07, d * 0.66),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    emberBed.position.set(0, bodyH + 0.06, 0.02);
    group.add(emberBed);

    const hotCore = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.58, 0.08, d * 0.44),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    hotCore.position.set(0, bodyH + 0.07, 0.02);
    group.add(hotCore);

    const charredLogMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      emissive: 0xdc2626,
      emissiveIntensity: 0.65,
      roughness: 0.9,
    });
    for (const lx of [-0.52, 0.0, 0.52]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.52, 8), charredLogMat);
      log.rotation.z = Math.PI / 2 + (lx * 0.2);
      log.position.set(lx, bodyH + 0.1, 0.04);
      group.add(log);
    }

    // Heavy Cast-Iron Grill Grates over the embers
    const grateFrame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.74, 0.025, d * 0.66), ironMat);
    grateFrame.position.set(0, bodyH + 0.18, 0.04);
    group.add(grateFrame);

    for (let gx = -w * 0.34; gx <= w * 0.34; gx += 0.11) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, d * 0.64, 6), ironMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(gx, bodyH + 0.19, 0.04);
      group.add(bar);
    }

    // Thick Bistecca alla Fiorentina T-Bone Cuts Sizzling on the Grill
    const bisteccaMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.45 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 });
    for (const sx of [-0.42, 0.38]) {
      const steak = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.065, 0.26), bisteccaMat);
      steak.position.set(sx, bodyH + 0.23, 0.05);
      group.add(steak);

      const tBone = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.27), boneMat);
      tBone.position.set(sx, bodyH + 0.232, 0.05);
      group.add(tBone);
    }

    // Overhead Wrought-Iron Meat Hook Rail & Hanging Chianina Cuts
    const hookRail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, w * 0.72, 10), ironMat);
    hookRail.rotation.z = Math.PI / 2;
    hookRail.position.set(0, bodyH + 0.78, -0.05);
    group.add(hookRail);

    for (const hx of [-0.45, 0.0, 0.45]) {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 12, Math.PI * 1.3), ironMat);
      hook.position.set(hx, bodyH + 0.72, -0.05);
      group.add(hook);

      if (hx !== 0.0) {
        const hangingLoin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.26, 10), bisteccaMat);
        hangingLoin.position.set(hx, bodyH + 0.56, -0.05);
        group.add(hangingLoin);
      }
    }
    return;
  }

  // ===========================================================================
  // 2. `station-ob-pasta` (`pasta_cooker` / `pasta_boiler_range`)
  //    Brushed steel & brass 6-basket Bollitore Pasta Fresca with perforated
  //    brass strainer baskets and rising steam
  // ===========================================================================
  if (
    id.includes("station-ob-pasta") ||
    style === "pasta_cooker" ||
    style === "pasta_boiler_range" ||
    kind === "pasta_station"
  ) {
    // Steaming boiling water bath basin
    const waterBath = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.62, 0.04, d * 0.72),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.25,
        roughness: 0.15,
      })
    );
    waterBath.position.set(-w * 0.14, bodyH + 0.055, 0);
    group.add(waterBath);

    // 6 Perforated Brass Strainer Baskets with Ergonomic Handles & Fresh Egg Pasta
    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.34,
    });

    const basketX = [-w * 0.34, -w * 0.14, w * 0.06];
    const basketZ = [-d * 0.2, d * 0.2];

    for (const bx of basketX) {
      for (const bz of basketZ) {
        // Perforated brass strainer cylinder
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.125, 0.16, 16), brassMat);
        basket.position.set(bx, bodyH + 0.13, bz);
        group.add(basket);

        // Nest of golden fresh pasta inside basket
        const pastaNest = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.032, 8, 14), pastaDoughMat);
        pastaNest.rotation.x = Math.PI / 2;
        pastaNest.position.set(bx, bodyH + 0.18, bz);
        group.add(pastaNest);

        // Angled basket handle with walnut grip
        const handleRod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), steelMat);
        handleRod.rotation.x = Math.PI / 3;
        handleRod.position.set(bx, bodyH + 0.23, bz + 0.18);
        group.add(handleRod);

        // Rising steam puffs above each boiling pasta well
        const steamPuff1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), steamMat);
        steamPuff1.position.set(bx, bodyH + 0.34, bz);
        group.add(steamPuff1);

        const steamPuff2 = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), steamMat);
        steamPuff2.position.set(bx + 0.03, bodyH + 0.48, bz - 0.02);
        group.add(steamPuff2);
      }
    }

    // Swivel Brass Water Filler Faucet at back of Bollitore
    const faucetStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.32, 10), brassMat);
    faucetStand.position.set(-w * 0.14, bodyH + 0.21, -d * 0.38);
    group.add(faucetStand);

    // Adjacent Mantecatura Burner & Simmering Copper Ragù / Cinghiale Pan on Right Side
    const burnerGrate = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.04, 14), ironMat);
    burnerGrate.position.set(w * 0.32, bodyH + 0.07, 0);
    group.add(burnerGrate);

    const raguPan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.11, 16), copperMat);
    raguPan.position.set(w * 0.32, bodyH + 0.14, 0);
    group.add(raguPan);

    const raguSauce = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.17, 0.02, 14),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 })
    );
    raguSauce.position.set(w * 0.32, bodyH + 0.19, 0);
    group.add(raguSauce);
    return;
  }

  // ===========================================================================
  // 3. `station-ob-sfoglia` (`marble_pasta_bench`)
  //    Carrara marble slab top, wooden mattarello rolling pins, golden sheets of
  //    fresh egg pasta dough, flour bowls, and wooden pasta drying racks
  // ===========================================================================
  if (
    id.includes("station-ob-sfoglia") ||
    style === "marble_pasta_bench" ||
    kind === "pasta_bench"
  ) {
    // Thick Veined Carrara Marble Worktop Slab
    const carraraSlab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.08, d + 0.08), marbleMat);
    carraraSlab.position.set(0, bodyH + 0.04, 0);
    carraraSlab.receiveShadow = true;
    group.add(carraraSlab);

    // Golden Sheet of Hand-Rolled Fresh Egg Sfoglia Dough
    const sfogliaSheet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.012, 24),
      pastaDoughMat
    );
    sfogliaSheet.scale.set(1.25, 1, 0.85);
    sfogliaSheet.position.set(-0.22, bodyH + 0.088, 0.04);
    group.add(sfogliaSheet);

    // Traditional Long Wooden Mattarello Rolling Pin resting across the sfoglia
    const mattarelloMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 });
    const mattarello = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.88, 12), mattarelloMat);
    mattarello.rotation.z = Math.PI / 2;
    mattarello.rotation.y = 0.22;
    mattarello.position.set(-0.22, bodyH + 0.115, 0.08);
    group.add(mattarello);

    // Second shorter rolling pin & brass pastry cutter wheel
    const pin2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 10), mattarelloMat);
    pin2.rotation.z = Math.PI / 2;
    pin2.rotation.y = -0.35;
    pin2.position.set(-0.28, bodyH + 0.11, -0.24);
    group.add(pin2);

    // Terracotta & Ceramic Bowls of Caputo 00 Flour + Organic Egg Yolks
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.6 });
    const flourBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.09, 0.11, 14), bowlMat);
    flourBowl.position.set(-w * 0.36, bodyH + 0.13, -0.18);
    group.add(flourBowl);

    const flourMound = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })
    );
    flourMound.scale.y = 0.55;
    flourMound.position.set(-w * 0.36, bodyH + 0.17, -0.18);
    group.add(flourMound);

    // Multi-Bar Wooden Pasta Drying Rack (Stendarello) draped with Fresh Tagliatelle Ribbons
    const rackGroup = new THREE.Group();
    rackGroup.position.set(w * 0.26, bodyH + 0.08, -0.04);

    for (const px of [-0.32, 0.32]) {
      const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.46, 10), walnutMat);
      upright.position.set(px, 0.23, 0);
      rackGroup.add(upright);
    }
    const topDowel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 10), mattarelloMat);
    topDowel.rotation.z = Math.PI / 2;
    topDowel.position.set(0, 0.44, 0);
    rackGroup.add(topDowel);

    // Draped golden pasta ribbons hanging from drying rack
    for (let rx = -0.24; rx <= 0.24; rx += 0.06) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.28, 0.04), pastaDoughMat);
      ribbon.position.set(rx, 0.29, 0);
      rackGroup.add(ribbon);
    }

    group.add(rackGroup);
    return;
  }

  // ===========================================================================
  // 4. `station-ob-freddo` / `station-ob-antipasti` (`cold_prep_marble`)
  //    Refrigerated marble antipasti counter with wheels of Parmigiano Reggiano,
  //    prosciutto slicer in red enamel, and glass dessert display
  // ===========================================================================
  if (
    id.includes("station-ob-freddo") ||
    id.includes("station-ob-antipasti") ||
    style === "cold_prep_marble" ||
    kind === "antipasti_station"
  ) {
    // Stamped Golden Wheel of Parmigiano Reggiano DOP 36 Mesi + Cut Wedge
    const parmRindMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
    const parmCoreMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.65 });

    const parmWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 20), parmRindMat);
    parmWheel.position.set(-w * 0.3, bodyH + 0.13, -0.05);
    group.add(parmWheel);

    const parmTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 20), parmCoreMat);
    parmTop.position.set(-w * 0.3, bodyH + 0.212, -0.05);
    group.add(parmTop);

    // Vintage Red Enamel Flywheel Prosciutto Slicer (Affettatrice Berkel)
    const berkelGroup = new THREE.Group();
    berkelGroup.position.set(0.0, bodyH + 0.06, 0.02);

    const crimsonEnamelMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.45,
      roughness: 0.2,
    });

    const slicerBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.36), crimsonEnamelMat);
    slicerBase.position.y = 0.04;
    berkelGroup.add(slicerBase);

    // Iconic red spoked flywheel on side
    const flywheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 20), crimsonEnamelMat);
    flywheelRim.rotation.y = Math.PI / 2;
    flywheelRim.position.set(-0.23, 0.2, 0.04);
    berkelGroup.add(flywheelRim);

    // Chrome circular slicing blade
    const bladeDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 20), steelMat);
    bladeDisk.rotation.z = Math.PI / 2;
    bladeDisk.position.set(0.04, 0.22, -0.04);
    berkelGroup.add(bladeDisk);

    // Prosciutto crudo cut resting on carriage
    const prosciuttoCut = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.45 })
    );
    prosciuttoCut.position.set(0.12, 0.12, 0.05);
    berkelGroup.add(prosciuttoCut);

    group.add(berkelGroup);

    // Refrigerated Glass Dessert & Tiramisù Display Case on Right Side
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.48,
      roughness: 0.1,
    });
    const dessertCase = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.34, d * 0.72), glassMat);
    dessertCase.position.set(w * 0.28, bodyH + 0.22, 0);
    group.add(dessertCase);

    // Trays of Tiramisù Tradizionale inside glass case (cocoa-dusted mascarpone layers)
    const cocoaMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const mascarponeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 });
    for (const tz of [-0.15, 0.15]) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.2), mascarponeMat);
      tray.position.set(w * 0.28, bodyH + 0.11, tz);
      group.add(tray);

      const cocoaTop = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.015, 0.19), cocoaMat);
      cocoaTop.position.set(w * 0.28, bodyH + 0.138, tz);
      group.add(cocoaTop);
    }
    return;
  }

  // ===========================================================================
  // 5. `station-ob-pass` / `station-ob-passe` (`heat_lamp_pass` / `heated_pass`)
  //    Terracotta & copper pass counter with 3 glowing copper infrared heat lamps
  // ===========================================================================
  if (
    id.includes("station-ob-pass") ||
    style === "heat_lamp_pass" ||
    style === "heated_pass" ||
    kind === "pass"
  ) {
    // Terracotta & Carrara Marble Trim Strip along Pass
    const terracottaTrim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.06, 0.08, d + 0.06),
      new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.7 })
    );
    terracottaTrim.position.set(0, bodyH - 0.04, 0);
    group.add(terracottaTrim);

    // Copper Overhead Bridge Support Columns & Crossbar
    for (const px of [-w * 0.42, w * 0.42]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.66, 12), copperMat);
      post.position.set(px, bodyH + 0.36, -d * 0.22);
      group.add(post);
    }

    const crossBridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.055, 0.09), copperMat);
    crossBridge.position.set(0, bodyH + 0.68, -d * 0.05);
    group.add(crossBridge);

    // 3 Glowing Copper Infrared Heat Lamps
    const irBulbMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const glowConeMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.16,
    });

    for (const lx of [-w * 0.28, 0, w * 0.28]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 8), copperMat);
      cord.position.set(lx, bodyH + 0.61, -d * 0.05);
      group.add(cord);

      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 16), copperMat);
      shade.position.set(lx, bodyH + 0.5, -d * 0.05);
      group.add(shade);

      const irBulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), irBulbMat);
      irBulb.position.set(lx, bodyH + 0.41, -d * 0.05);
      group.add(irBulb);

      const heatCone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.36, 14), glowConeMat);
      heatCone.position.set(lx, bodyH + 0.22, -d * 0.05);
      group.add(heatCone);
    }

    // Brass Order Bell & Warm Ceramic Plate Stack at Pass Corner
    const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), brassMat);
    bellDome.position.set(-w * 0.38, bodyH + 0.06, d * 0.26);
    group.add(bellDome);

    for (let pi = 0; pi < 4; pi++) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.022, 16), marbleMat);
      plate.position.set(w * 0.38, bodyH + 0.065 + pi * 0.024, d * 0.22);
      group.add(plate);
    }
    return;
  }

  // ===========================================================================
  // 6. `station-ob-bar` (`italian_enoteca_bar`)
  //    Walnut & marble Enoteca bar with brass La Marzocco-style espresso machine,
  //    crystal wine decanters, and bottle display
  // ===========================================================================
  if (
    id.includes("station-ob-bar") ||
    style === "italian_enoteca_bar" ||
    kind === "bar"
  ) {
    // Rich Tuscan Walnut & Brass Footrail along front of Enoteca Bar
    const footRail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, w * 0.92, 12), brassMat);
    footRail.rotation.z = Math.PI / 2;
    footRail.position.set(0, 0.18, d * 0.54);
    group.add(footRail);

    // La Marzocco-Style 2-Group Brass & Crimson Espresso Machine
    const espressoGroup = new THREE.Group();
    espressoGroup.position.set(-w * 0.28, bodyH + 0.05, 0.06);

    const machineBody = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.44), brassMat);
    machineBody.position.y = 0.19;
    espressoGroup.add(machineBody);

    const crimsonPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.24, 0.46),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.5, roughness: 0.2 })
    );
    crimsonPanel.position.y = 0.2;
    espressoGroup.add(crimsonPanel);

    // Group heads & portafilter handles
    for (const gx of [-0.16, 0.16]) {
      const groupHead = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), steelMat);
      groupHead.position.set(gx, 0.16, 0.24);
      espressoGroup.add(groupHead);

      const pfHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.18, 8), walnutMat);
      pfHandle.rotation.x = Math.PI / 2;
      pfHandle.position.set(gx, 0.14, 0.34);
      espressoGroup.add(pfHandle);
    }

    // Top espresso cup warmer rail with white porcelain demitasses
    for (let cx = -0.22; cx <= 0.22; cx += 0.11) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.025, 0.045, 10), marbleMat);
      cup.position.set(cx, 0.41, 0);
      espressoGroup.add(cup);
    }

    group.add(espressoGroup);

    // Crystal Wine Decanters (Chianti Classico & Barolo) & Stemmed Tasting Glasses
    const crystalRubyMat = new THREE.MeshStandardMaterial({
      color: 0x881337,
      transparent: true,
      opacity: 0.85,
      roughness: 0.12,
    });
    const clearGlassMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.55,
      roughness: 0.08,
    });

    for (const dx of [0.12, 0.48]) {
      const decanterBase = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), crystalRubyMat);
      decanterBase.scale.y = 0.65;
      decanterBase.position.set(dx, bodyH + 0.12, 0.14);
      group.add(decanterBase);

      const decanterNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.05, 0.18, 12), clearGlassMat);
      decanterNeck.position.set(dx, bodyH + 0.24, 0.14);
      group.add(decanterNeck);
    }

    // Stepped Walnut Enoteca Bottle Display along back of bar
    const tierRack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.58, 0.42, 0.24), walnutMat);
    tierRack.position.set(w * 0.16, bodyH + 0.25, -d * 0.3);
    group.add(tierRack);

    const bottlePalette = [0x14532d, 0x991b1b, 0xd97706, 0x7f1d1d, 0x15803d, 0xb91c1c];
    for (let bi = 0; bi < 8; bi++) {
      const bMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.24, 10),
        new THREE.MeshStandardMaterial({
          color: bottlePalette[bi % bottlePalette.length],
          roughness: 0.18,
          metalness: 0.2,
        })
      );
      bMesh.position.set(-w * 0.08 + bi * (w * 0.075), bodyH + 0.54, -d * 0.3);
      group.add(bMesh);
    }

    // Attach 3D sorted bar bottle shelf for live barman bottle units & slot placeholders
    const barShelf = buildSortedBarBottleShelf3D(group, obj, tr);
    group.userData = group.userData || {};
    group.userData.shelfGroup = barShelf;
    return;
  }

  // ===========================================================================
  // 7. `station-ob-plonge` & `storage-ob-cold`
  //    Italian kitchen dishwashing sink & walk-in cold storage
  // ===========================================================================
  if (id.includes("station-ob-plonge") || style === "dish_pit" || kind === "dishwashing") {
    // Hood-type commercial Italian sanitizing dishwasher + twin sinks + sprayer arch
    const hoodWasher = new THREE.Mesh(new THREE.BoxGeometry(w * 0.38, 0.58, d * 0.82), steelMat);
    hoodWasher.position.set(-w * 0.26, bodyH + 0.32, 0);
    group.add(hoodWasher);

    // Gooseneck pre-rinse sprayer arch over wash basin
    const sprayerArch = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 8, 16, Math.PI), steelMat);
    sprayerArch.position.set(w * 0.18, bodyH + 0.35, -d * 0.22);
    group.add(sprayerArch);

    // Rack of clean white porcelain plates drying
    for (let pi = 0; pi < 6; pi++) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.018, 12), marbleMat);
      plate.rotation.z = Math.PI / 2 - 0.15;
      plate.position.set(w * 0.08 + pi * 0.055, bodyH + 0.16, 0.05);
      group.add(plate);
    }
    return;
  }

  if (
    id.includes("storage-ob-cold") ||
    id.includes("storage-ob-dry") ||
    style === "walkin_cooler" ||
    obj.objectType === "ingredient_storage" ||
    kind === "storage"
  ) {
    // Insulated Walk-in Cella Frigorifera Door, Chrome Latch & Digital Temp Readout
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.52, bodyH * 0.84, 0.06), steelMat);
    doorPanel.position.set(0, bodyH * 0.48, d * 0.51);
    group.add(doorPanel);

    const latchHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.08), ironMat);
    latchHandle.position.set(w * 0.19, bodyH * 0.48, d * 0.55);
    group.add(latchHandle);

    // Illuminated Cold Inspection Window showing aging Salumi & Parmigiano
    const viewWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.42, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xbae6fd })
    );
    viewWindow.position.set(0, bodyH * 0.64, d * 0.515);
    group.add(viewWindow);

    // Digital thermostat badge (+2°C)
    const thermoBadge = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.09, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    thermoBadge.position.set(-w * 0.32, bodyH * 0.82, d * 0.51);
    group.add(thermoBadge);

    // Attach 3-tier sorted storage rack (Tier 1..3, Slots 0..5) for live physical stock units
    const storageRack = buildSortedStorageRack3D(group, obj, tr);
    group.userData = group.userData || {};
    group.userData.shelfGroup = storageRack;
    return;
  }

  // ===========================================================================
  // 8. `pos-ob-main` (`pos_stand`) — Cassa Centrale Osteria Bellavista
  // ===========================================================================
  if (id.includes("pos-ob-main") || style === "pos_stand" || kind === "pos") {
    const screenStand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.04), ironMat);
    screenStand.rotation.x = -0.35;
    screenStand.position.set(0, bodyH + 0.16, 0);
    group.add(screenStand);

    const screenDisplay = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    screenDisplay.rotation.x = -0.35;
    screenDisplay.position.set(0, bodyH + 0.165, 0.022);
    group.add(screenDisplay);
  }
}
