import * as THREE from "three";
import { buildSortedStorageRack3D, buildSortedBarBottleShelf3D } from "../assets/KitchenBarShelves3D";

export const SAKANA_BRAND = {
  businessId: "business-sakana-tei",
  name: "Sakana-Tei 魚亭",
  subtitle: "Omakase Sushi Hinoki & Robatayaki au Binchotan",
  motto: "L'Équilibre de l'Eau, du Cyprès Hinoki et de la Braise Blanche",
  crestUrl: "/brands/sakana/crest.png",
  menuBoardUrl: "/brands/sakana/ukiyoe_art.png",
  primaryColor: "#10b981",
  accentColor: "#0284c7",
  signatureDishes: [
    "Omakase Nigiri Sélection du Maître (8 pièces sur Geta)",
    "Black Cod Gindara Misoyaki au Saikyo Miso",
    "Tataki de Bœuf Wagyu A5 Kagoshima à la Truffe",
    "Ramen Tonkotsu Noir Ail Grillé & Chashu Fondant",
  ],
};

// Shared texture cache so textures are loaded once per session
const textureCache = {};

function loadBrandTexture(url) {
  if (!textureCache[url]) {
    if (typeof document !== "undefined") {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      textureCache[url] = tex;
    } else {
      textureCache[url] = new THREE.Texture();
    }
  }
  return textureCache[url];
}

/**
 * Helper to create a Japanese Noren (暖簾) split fabric curtain assembly
 */
function createNorenAssembly({
  width = 2.2,
  height = 0.82,
  panels = 4,
  crestTex = null,
  label = "Sakana-Tei 魚亭 — Noren Indigo (暖簾)",
  sceneObjectId = "scene-premises-premises-sakana-tei",
  interactiveMeshes = null,
}) {
  const norenGroup = new THREE.Group();

  const rodMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.45,
    metalness: 0.1,
  });
  const bracketMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.75,
  });

  // Hinoki / Cedar hanging rod (Noren-bou)
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, width + 0.24, 14),
    rodMat
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, height / 2 + 0.03, 0);
  rod.castShadow = true;
  norenGroup.add(rod);

  // End brackets
  for (const side of [-1, 1]) {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.09, 0.08),
      bracketMat
    );
    bracket.position.set(side * (width / 2 + 0.06), height / 2 + 0.04, 0);
    norenGroup.add(bracket);
  }

  // Deep indigo (Ai-zome 藍染) woven linen panels with crest overlay
  const gap = 0.035;
  const panelW = (width - gap * (panels - 1)) / panels;
  const indigoMat = new THREE.MeshStandardMaterial({
    color: 0x172554,
    roughness: 0.82,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const crestMat = crestTex
    ? new THREE.MeshStandardMaterial({
        map: crestTex,
        roughness: 0.65,
        metalness: 0.08,
        side: THREE.DoubleSide,
      })
    : indigoMat;

  const startX = -width / 2 + panelW / 2;
  for (let i = 0; i < panels; i++) {
    const px = startX + i * (panelW + gap);
    const flapPivot = new THREE.Group();
    flapPivot.position.set(px, height / 2, 0);
    // Subtle natural drape angle
    flapPivot.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.035;

    const flap = new THREE.Mesh(
      new THREE.BoxGeometry(panelW, height, 0.018),
      indigoMat
    );
    flap.position.set(0, -height / 2, 0);
    flap.castShadow = true;
    flap.userData = { sceneObjectId, label };
    flapPivot.add(flap);

    // Bottom white seigaiha/hem stripe
    const hem = new THREE.Mesh(
      new THREE.BoxGeometry(panelW * 0.96, 0.045, 0.022),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 })
    );
    hem.position.set(0, -height + 0.05, 0);
    flapPivot.add(hem);

    // Center panels carry the Sakana-Tei 魚亭 crest medallion
    if (crestTex && (i === 1 || i === 2 || panels <= 3)) {
      const medallionSize = Math.min(panelW * 0.84, height * 0.64);
      const crestPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(medallionSize, medallionSize),
        crestMat
      );
      crestPlane.position.set(0, -height * 0.46, 0.012);
      crestPlane.userData = { sceneObjectId, label };
      flapPivot.add(crestPlane);

      const crestPlaneBack = new THREE.Mesh(
        new THREE.PlaneGeometry(medallionSize, medallionSize),
        crestMat
      );
      crestPlaneBack.rotation.y = Math.PI;
      crestPlaneBack.position.set(0, -height * 0.46, -0.012);
      crestPlaneBack.userData = { sceneObjectId, label };
      flapPivot.add(crestPlaneBack);
    }

    if (Array.isArray(interactiveMeshes)) {
      interactiveMeshes.push(flap);
    }

    norenGroup.add(flapPivot);
  }

  return norenGroup;
}

/**
 * Helper to create a Kumiko Cedar & Shoji translucent lattice screen
 */
function createKumikoShojiScreen(width = 1.6, height = 1.85) {
  const screen = new THREE.Group();

  const cedarMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.52,
    metalness: 0.08,
  });
  const darkCedarMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.6,
  });
  const washiMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.18,
    roughness: 0.85,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });

  // Outer Cedar Frame Posts
  for (const sx of [-width / 2, width / 2]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, height, 0.055),
      cedarMat
    );
    post.position.set(sx, height / 2, 0);
    post.castShadow = true;
    screen.add(post);

    // Base stabilize foot (Koshi-ita)
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.04, 0.28),
      darkCedarMat
    );
    foot.position.set(sx, 0.02, 0);
    screen.add(foot);
  }

  // Top & Bottom Rails + Dado rail (Koshi)
  for (const ry of [0.06, 0.42, height - 0.03]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.04, 0.045, 0.05),
      cedarMat
    );
    rail.position.set(0, ry, 0);
    screen.add(rail);
  }

  // Bottom cedar kick-board panel (Koshi-ita)
  const kickPanel = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.05, 0.34, 0.025),
    darkCedarMat
  );
  kickPanel.position.set(0, 0.24, 0);
  screen.add(kickPanel);

  // Translucent Washi paper core
  const washiH = height - 0.48;
  const washi = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.06, washiH),
    washiMat
  );
  washi.position.set(0, 0.44 + washiH / 2, 0);
  screen.add(washi);

  // Fine Kumiko vertical & horizontal muntin bars
  const vCols = 4;
  for (let c = 1; c < vCols; c++) {
    const vx = -width / 2 + (c * width) / vCols;
    const vBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, washiH, 0.028),
      cedarMat
    );
    vBar.position.set(vx, 0.44 + washiH / 2, 0);
    screen.add(vBar);
  }

  const hRows = 5;
  for (let r = 1; r < hRows; r++) {
    const hy = 0.44 + (r * washiH) / hRows;
    const hBar = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.06, 0.014, 0.028),
      cedarMat
    );
    hBar.position.set(0, hy, 0);
    screen.add(hBar);
  }

  // Geometric Asanoha / Diamond Kumiko accent in top row
  for (const dx of [-width * 0.25, 0, width * 0.25]) {
    const diamond = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.03),
      cedarMat
    );
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(dx, height - 0.22, 0);
    screen.add(diamond);
  }

  return screen;
}

/**
 * Helper to create a glowing Washi Paper Chōchin (提灯) lantern
 */
function createChochinLantern(radius = 0.22, height = 0.46, isRedAccent = false) {
  const lantern = new THREE.Group();

  const lacquerMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.25,
    metalness: 0.4,
  });
  const washiGlowMat = new THREE.MeshStandardMaterial({
    color: isRedAccent ? 0xfca5a5 : 0xffedd5,
    emissive: isRedAccent ? 0xef4444 : 0xfbbf24,
    emissiveIntensity: isRedAccent ? 0.55 : 0.65,
    roughness: 0.7,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.6,
  });

  // Suspension cord from ceiling beam
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6),
    lacquerMat
  );
  cord.position.y = height / 2 + 0.18;
  lantern.add(cord);

  // Top & bottom black lacquer caps
  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.58, radius * 0.72, 0.045, 16),
    lacquerMat
  );
  topCap.position.y = height / 2;
  lantern.add(topCap);

  const botCap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.52, 0.045, 16),
    lacquerMat
  );
  botCap.position.y = -height / 2;
  lantern.add(botCap);

  // Glowing Washi body
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 14),
    washiGlowMat
  );
  body.scale.set(1, height / (radius * 2), 1);
  lantern.add(body);

  // Bamboo spiral ribs (Higo)
  for (const ry of [-0.12, -0.04, 0.04, 0.12]) {
    const rScale = Math.sqrt(Math.max(0.2, 1 - Math.pow(ry / (height / 2), 2)));
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * rScale + 0.003, 0.005, 6, 20),
      ribMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    lantern.add(ring);
  }

  // Bottom silk tassel
  const tassel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.024, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 })
  );
  tassel.position.y = -height / 2 - 0.07;
  lantern.add(tassel);

  return lantern;
}

/**
 * Helper to create a carved granite Tōrō (灯籠) Japanese garden stone lantern
 */
function createToroStoneLantern() {
  const toro = new THREE.Group();
  const graniteMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.88,
    metalness: 0.08,
  });
  const mossGraniteMat = new THREE.MeshStandardMaterial({
    color: 0x4d7c0f,
    roughness: 0.92,
  });
  const fireBoxMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });

  // 1. Base stone (Kiso)
  const kiso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.14, 6),
    graniteMat
  );
  kiso.position.y = 0.07;
  kiso.castShadow = true;
  toro.add(kiso);

  // 2. Pedestal shaft (Sao)
  const sao = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, 0.56, 8),
    graniteMat
  );
  sao.position.y = 0.42;
  sao.castShadow = true;
  toro.add(sao);

  // 3. Middle platform (Chūdai)
  const chudai = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.18, 0.1, 6),
    graniteMat
  );
  chudai.position.y = 0.74;
  toro.add(chudai);

  // 4. Firebox chamber (Hibukuro) with glowing warm window
  const hibukuro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.24, 6),
    fireBoxMat
  );
  hibukuro.position.y = 0.91;
  toro.add(hibukuro);

  // Corner stone pillars around firebox
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.25, 6),
      graniteMat
    );
    pillar.position.set(Math.cos(ang) * 0.165, 0.91, Math.sin(ang) * 0.165);
    toro.add(pillar);
  }

  // 5. Pagoda umbrella roof (Kasa)
  const kasa = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.24, 6),
    graniteMat
  );
  kasa.position.y = 1.14;
  kasa.castShadow = true;
  toro.add(kasa);

  // Subtle moss patch on roof edge
  const moss = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    mossGraniteMat
  );
  moss.scale.set(1.4, 0.35, 1.1);
  moss.position.set(0.14, 1.15, 0.1);
  toro.add(moss);

  // 6. Lotus finial jewel (Hōju)
  const hoju = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 10),
    graniteMat
  );
  hoju.scale.set(1, 1.35, 1);
  hoju.position.y = 1.31;
  toro.add(hoju);

  return toro;
}

/**
 * Helper to create a cluster of tall green bamboo stalks in a dark slate planter
 */
function createBambooPlanterCluster(width = 1.8, depth = 0.44, stalkCount = 7) {
  const cluster = new THREE.Group();

  const slateMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.78,
    metalness: 0.15,
  });
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.42,
  });
  const nodeRingMat = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    roughness: 0.5,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

  // Dark Kyoto slate planter box
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.44, depth),
    slateMat
  );
  box.position.y = 0.22;
  box.castShadow = true;
  box.receiveShadow = true;
  cluster.add(box);

  // Black river pebble top bed
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.08, 0.04, depth - 0.08),
    pebbleMat
  );
  bed.position.y = 0.43;
  cluster.add(bed);

  for (let i = 0; i < stalkCount; i++) {
    const frac = stalkCount > 1 ? i / (stalkCount - 1) - 0.5 : 0;
    const sx = frac * (width - 0.34);
    const sz = ((i % 3) - 1) * (depth * 0.2);
    const stalkH = 2.15 + ((i * 17) % 5) * 0.16;

    const stalkGroup = new THREE.Group();
    stalkGroup.position.set(sx, 0.44, sz);
    stalkGroup.rotation.z = ((i % 2 === 0 ? 1 : -1) * 0.025);
    stalkGroup.rotation.x = (((i + 1) % 3) - 1) * 0.02;

    const culm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.042, stalkH, 10),
      bambooMat
    );
    culm.position.y = stalkH / 2;
    culm.castShadow = true;
    stalkGroup.add(culm);

    // Segmented bamboo nodes (Fushi) & leaf sprays
    for (let ny = 0.38; ny < stalkH - 0.1; ny += 0.42) {
      const nodeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.038, 0.006, 6, 12),
        nodeRingMat
      );
      nodeRing.rotation.x = Math.PI / 2;
      nodeRing.position.y = ny;
      stalkGroup.add(nodeRing);

      if (ny > stalkH * 0.42) {
        for (const side of [-1, 1]) {
          const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(0.11, 0.32, 5),
            leafMat
          );
          leaf.scale.set(0.35, 1, 1);
          leaf.rotation.z = side * 0.85;
          leaf.rotation.y = (i + ny) * 1.3;
          leaf.position.set(side * 0.11, ny + 0.06, 0);
          stalkGroup.add(leaf);
        }
      }
    }

    cluster.add(stalkGroup);
  }

  return cluster;
}

/**
 * Constructs and adds to `scene` a `THREE.Group` containing bespoke Japanese Omakase & Izakaya
 * architectural details for Sakana-Tei 魚亭 (X = 44..62m).
 */
export function buildSakanaInterior(scene, premises, interactiveMeshes = []) {
  const sakanaGroup = new THREE.Group();
  sakanaGroup.name = "SakanaTei3D_ArchitecturalGroup";

  const skPrem = Array.isArray(premises)
    ? premises.find(
        (p) =>
          p.businessId === "business-sakana-tei" ||
          p._id === "premises-sakana-tei"
      )
    : premises;

  const sceneObjectId = skPrem?._id
    ? `scene-premises-${skPrem._id}`
    : "scene-premises-premises-sakana-tei";

  const crestTex = loadBrandTexture(SAKANA_BRAND.crestUrl);
  const ukiyoeTex = loadBrandTexture(SAKANA_BRAND.menuBoardUrl);

  // =========================================================================
  // 1. INDIGO JAPANESE NOREN (暖簾) SPLIT FABRIC CURTAINS (魚亭)
  //    - Main Street Entrance (X = 52.5..53.0, Z = 14.0)
  //    - Kitchen Pass & Izakaya Archways (X = 52.0, Z = 5.0 and X = 55.2, Z = 0.0)
  // =========================================================================
  const mainDoor =
    (skPrem?.entrances || []).find((e) => e.kind === "customer") || {
      x: 52.5,
      z: 14.0,
      width: 2.3,
    };
  const mainNoren = createNorenAssembly({
    width: mainDoor.width || 2.3,
    height: 0.86,
    panels: 4,
    crestTex,
    label: "Sakana-Tei 魚亭 — Noren d'Entrée Indigo (暖簾)",
    sceneObjectId,
    interactiveMeshes,
  });
  mainNoren.position.set(52.5, 2.15, 14.02);
  sakanaGroup.add(mainNoren);

  // Traditional Hinoki Torii-inspired entrance lintel & eaves over X = 52.5, Z = 14.0
  const hinokiBeamMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.45,
  });
  const charredCedarMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
  });
  const entryLintel = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.16, 0.36),
    hinokiBeamMat
  );
  entryLintel.position.set(52.5, 2.68, 14.05);
  entryLintel.castShadow = true;
  sakanaGroup.add(entryLintel);

  const entryEave = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.09, 0.65),
    charredCedarMat
  );
  entryEave.rotation.x = 0.12;
  entryEave.position.set(52.5, 2.84, 14.18);
  entryEave.castShadow = true;
  sakanaGroup.add(entryEave);

  // Kitchen Pass Doorway Noren at X = 52.0, Z = 5.0 (partition line)
  const kitchenPassNoren = createNorenAssembly({
    width: 2.1,
    height: 0.76,
    panels: 4,
    crestTex,
    label: "Sakana-Tei 魚亭 — Noren Passe Cuisine & Robata",
    sceneObjectId,
    interactiveMeshes,
  });
  kitchenPassNoren.position.set(52.0, 2.18, 5.0);
  sakanaGroup.add(kitchenPassNoren);

  // Secondary Noren at back kitchen corridor threshold (X = 55.2, Z = 0.0)
  const robataCorridorNoren = createNorenAssembly({
    width: 1.65,
    height: 0.72,
    panels: 3,
    crestTex,
    label: "Sakana-Tei 魚亭 — Noren Atelier Omakase & Binchotan",
    sceneObjectId,
    interactiveMeshes,
  });
  robataCorridorNoren.position.set(55.2, 2.18, 0.0);
  sakanaGroup.add(robataCorridorNoren);

  // =========================================================================
  // 2. FRAMED UKIYO-E & EDO CALLIGRAPHY ART PANELS
  //    Mounted on West interior wall, North wall & Tatami gallery alcoves
  // =========================================================================
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.38,
    metalness: 0.25,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.3,
    metalness: 0.75,
  });
  const ukiyoeArtMat = new THREE.MeshStandardMaterial({
    map: ukiyoeTex,
    roughness: 0.45,
    metalness: 0.05,
  });
  const crestArtMat = new THREE.MeshStandardMaterial({
    map: crestTex,
    roughness: 0.45,
    metalness: 0.05,
  });

  function createFramedArtPanel(w, h, artMat, titleLabel) {
    const panelGroup = new THREE.Group();
    const outerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.05),
      frameMat
    );
    outerFrame.castShadow = true;
    panelGroup.add(outerFrame);

    const goldBorder = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.056),
      goldMat
    );
    panelGroup.add(goldBorder);

    const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
    canvasMesh.position.z = 0.031;
    canvasMesh.userData = { sceneObjectId, label: titleLabel };
    panelGroup.add(canvasMesh);

    if (Array.isArray(interactiveMeshes)) {
      interactiveMeshes.push(canvasMesh);
    }
    return panelGroup;
  }

  // Grand Ukiyo-e Culinary Triptych on West Wall (X = 44.14, Z = 8.0)
  const westUkiyoeMain = createFramedArtPanel(
    2.6,
    1.45,
    ukiyoeArtMat,
    "Sakana-Tei 魚亭 — Fresque Ukiyo-e Omakase (Otoro, Uni, Black Cod & Wagyu A5)"
  );
  westUkiyoeMain.rotation.y = Math.PI / 2;
  westUkiyoeMain.position.set(44.14, 1.72, 8.0);
  sakanaGroup.add(westUkiyoeMain);

  // Edo Calligraphy Crest Seal on West Wall (X = 44.14, Z = 11.4)
  const westCrestPanel = createFramedArtPanel(
    1.35,
    1.35,
    crestArtMat,
    "Sakana-Tei 魚亭 — Sceau Calligraphique Edo & Emblème Hanko"
  );
  westCrestPanel.rotation.y = Math.PI / 2;
  westCrestPanel.position.set(44.14, 1.72, 11.4);
  sakanaGroup.add(westCrestPanel);

  // Ukiyo-e Panel in North Tatami Salon (X = 44.14, Z = 3.8)
  const westNorthUkiyoe = createFramedArtPanel(
    2.1,
    1.25,
    ukiyoeArtMat,
    "Sakana-Tei 魚亭 — Estampe La Grande Vague & Sushi Edomae"
  );
  westNorthUkiyoe.rotation.y = Math.PI / 2;
  westNorthUkiyoe.position.set(44.14, 1.72, 3.8);
  sakanaGroup.add(westNorthUkiyoe);

  // Panoramic Ukiyo-e & Crest Backdrop on Interior Partition Wall (X = 49.0, Z = 5.12)
  const partitionArt = createFramedArtPanel(
    2.5,
    1.2,
    ukiyoeArtMat,
    "Sakana-Tei 魚亭 — Carte Omakase du Maître Itamae Kenji Takahashi"
  );
  partitionArt.position.set(48.8, 1.65, 5.12);
  sakanaGroup.add(partitionArt);

  // =========================================================================
  // 3. KUMIKO CEDAR & SHOJI LATTICE SCREENS + IGUSA TATAMI ALCOVE MATS
  //    Dividing the Tatami dining alcoves (X = 44.6..61.4, Z = 7..13)
  // =========================================================================
  const shojiPlacements = [
    // Dividers flanking West Tatami alcoves (X = 44.6..48.2, Z = 6.0 & Z = 9.8)
    { x: 45.8, z: 5.9, rotY: 0, w: 1.75, h: 1.82 },
    { x: 45.8, z: 9.85, rotY: 0, w: 1.75, h: 1.82 },
    // Dividers between Central Tatami tables (X = 48.6 & X = 52.6 at Z = 8.0)
    { x: 48.35, z: 8.0, rotY: Math.PI / 2, w: 1.55, h: 1.78 },
    { x: 52.65, z: 8.0, rotY: Math.PI / 2, w: 1.55, h: 1.78 },
    // South Tatami Salon screen near entrance foyer (X = 47.2, Z = 12.6)
    { x: 47.2, z: 12.6, rotY: 0, w: 1.85, h: 1.82 },
    // Screen separating Sake Bar lounge from Tatami dining (X = 56.3, Z = 7.2)
    { x: 56.3, z: 7.2, rotY: 0, w: 1.5, h: 1.78 },
  ];

  for (const sp of shojiPlacements) {
    const screen = createKumikoShojiScreen(sp.w, sp.h);
    screen.position.set(sp.x, 0, sp.z);
    screen.rotation.y = sp.rotY;
    sakanaGroup.add(screen);
  }

  // Woven Igusa Rush-Grass Tatami Mats with Dark Indigo Brocade Borders (Beri)
  const tatamiMat = new THREE.MeshStandardMaterial({
    color: 0xa3b18a,
    roughness: 0.78,
  });
  const beriBorderMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.65,
  });
  const tatamiZones = [
    { x: 46.2, z: 3.8, w: 2.1, d: 2.1 },
    { x: 50.2, z: 3.8, w: 2.4, d: 2.1 },
    { x: 54.4, z: 3.8, w: 2.4, d: 2.1 },
    { x: 46.2, z: 8.0, w: 2.1, d: 2.1 },
    { x: 50.5, z: 8.0, w: 2.8, d: 2.2 },
    { x: 54.6, z: 8.0, w: 2.4, d: 2.1 },
    { x: 49.2, z: 11.6, w: 2.1, d: 2.1 },
  ];
  for (const tz of tatamiZones) {
    const beri = new THREE.Mesh(
      new THREE.BoxGeometry(tz.w + 0.12, 0.022, tz.d + 0.12),
      beriBorderMat
    );
    beri.position.set(tz.x, 0.072, tz.z);
    beri.receiveShadow = true;
    sakanaGroup.add(beri);

    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(tz.w, 0.028, tz.d),
      tatamiMat
    );
    mat.position.set(tz.x, 0.076, tz.z);
    mat.receiveShadow = true;
    sakanaGroup.add(mat);
  }

  // =========================================================================
  // 4. WARM GLOWING WASHI PAPER CHŌCHIN LANTERNS & CEDAR CEILING BEAMS (Y = 2.6m)
  // =========================================================================
  const ceilingBeamMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.58,
  });

  for (const bz of [2.5, 6.2, 9.6, 12.8]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(17.6, 0.12, 0.16),
      ceilingBeamMat
    );
    beam.position.set(53.0, 2.96, bz);
    sakanaGroup.add(beam);
  }

  const lanternCoords = [
    { x: 46.5, z: 2.5, red: false },
    { x: 51.0, z: 2.5, red: false },
    { x: 55.5, z: 2.5, red: true },
    { x: 46.5, z: 6.2, red: false },
    { x: 50.5, z: 6.2, red: true },
    { x: 54.8, z: 6.2, red: false },
    { x: 59.0, z: 6.2, red: false },
    { x: 46.5, z: 9.6, red: true },
    { x: 50.5, z: 9.6, red: false },
    { x: 54.8, z: 9.6, red: false },
    { x: 59.0, z: 9.6, red: true },
    { x: 49.2, z: 12.8, red: false },
    { x: 52.5, z: 12.8, red: true },
    { x: 56.5, z: 12.8, red: false },
  ];

  lanternCoords.forEach((lc, idx) => {
    const lantern = createChochinLantern(0.21, 0.44, lc.red);
    lantern.position.set(lc.x, 2.6, lc.z);
    lantern.userData = {
      sceneObjectId,
      label: "Sakana-Tei 魚亭 — Lanterne Chōchin en Papier Washi (提灯)",
    };
    sakanaGroup.add(lantern);

    // Add warm interior point lights on key central lanterns for authentic Hinoki ambiance
    if (idx === 4 || idx === 9) {
      const warmLight = new THREE.PointLight(0xffedd5, 0.65, 9.5);
      warmLight.position.set(lc.x, 2.35, lc.z);
      sakanaGroup.add(warmLight);
    }
  });

  // =========================================================================
  // 5. ILLUMINATED SAKE & JAPANESE WHISKY WALL (X = 61.5, Z = 8.0..13.0)
  //    Rows of 1.8L Isshobin bottles, Komodaru straw sake barrels & Masu cups
  // =========================================================================
  const sakeWallGroup = new THREE.Group();
  sakeWallGroup.position.set(61.55, 0, 10.5);

  const sakeWallLabel =
    "Sakana-Tei 魚亭 — Bibliothèque à Saké Isshobin, Fûts Komodaru & Whisky Japonais";
  const sakeBarObjectId = "scene-sk-station-bar";

  const hinokiShelfMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.38,
  });
  const backlitPanelMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.38,
    roughness: 0.4,
  });

  // Backlit Washi & Hinoki cabinet frame spanning Z = 8.0..13.0 (depth 4.9m)
  const cabinetBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 2.55, 4.9),
    charredCedarMat
  );
  cabinetBack.position.set(0.12, 1.32, 0);
  cabinetBack.userData = { sceneObjectId: sakeBarObjectId, label: sakeWallLabel };
  sakeWallGroup.add(cabinetBack);

  const glowBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 2.25, 4.65),
    backlitPanelMat
  );
  glowBack.position.set(0.03, 1.38, 0);
  glowBack.userData = { sceneObjectId: sakeBarObjectId, label: sakeWallLabel };
  sakeWallGroup.add(glowBack);

  if (Array.isArray(interactiveMeshes)) {
    interactiveMeshes.push(cabinetBack, glowBack);
  }

  // 4 Illuminated horizontal Hinoki shelves
  const shelfHeights = [0.65, 1.15, 1.65, 2.15];
  for (const sy of shelfHeights) {
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.04, 4.75),
      hinokiShelfMat
    );
    shelf.position.set(-0.08, sy, 0);
    shelf.castShadow = true;
    sakeWallGroup.add(shelf);
  }

  // Bottom Shelf (Y = 0.67): Ceremonial Komodaru (菰樽) Woven Straw Sake Barrels
  const strawMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.85,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.75,
  });
  for (let bi = 0; bi < 5; bi++) {
    const bz = -1.75 + bi * 0.88;
    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(-0.1, 0.9, bz);

    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.18, 0.42, 16),
      strawMat
    );
    drum.userData = { sceneObjectId: sakeBarObjectId, label: sakeWallLabel };
    barrelGroup.add(drum);

    // Woven rope bands
    for (const ry of [-0.13, 0, 0.13]) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.192, 0.012, 6, 18),
        ropeMat
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = ry;
      barrelGroup.add(band);
    }

    // Circular front calligraphy crest label on each Komodaru barrel
    const seal = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 14),
      crestArtMat
    );
    seal.rotation.y = -Math.PI / 2;
    seal.position.set(-0.195, 0, 0);
    barrelGroup.add(seal);

    sakeWallGroup.add(barrelGroup);
  }

  // Middle Shelves (Y = 1.17 & Y = 1.67): 1.8L Isshobin Sake Bottles & Japanese Whisky Bottles
  const bottlePalette = [
    0x065f46, // Deep emerald Junmai Daiginjo
    0xd97706, // Amber Yamazaki Whisky
    0x1e3a8a, // Cobalt Ginjo glass
    0x115e59, // Teal Nama-zake
    0x451a03, // Dark brown Tokubetsu Honjozo
    0x0284c7, // Frosted azure Daiginjo
  ];
  const labelPaperMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.6,
  });
  const foilCapMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.8,
    roughness: 0.2,
  });

  for (const shelfY of [1.17, 1.67]) {
    for (let i = 0; i < 16; i++) {
      const bz = -2.1 + i * 0.28;
      const bCol = bottlePalette[(i + Math.round(shelfY * 3)) % bottlePalette.length];
      const bMat = new THREE.MeshStandardMaterial({
        color: bCol,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.9,
      });

      const bottleGroup = new THREE.Group();
      bottleGroup.position.set(-0.1, shelfY, bz);

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.055, 0.26, 10),
        bMat
      );
      body.position.y = 0.13;
      bottleGroup.add(body);

      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.048, 0.11, 10),
        bMat
      );
      neck.position.y = 0.31;
      bottleGroup.add(neck);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8),
        foilCapMat
      );
      cap.position.y = 0.38;
      bottleGroup.add(cap);

      const washiLabel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.13, 10, 1, true),
        labelPaperMat
      );
      washiLabel.position.y = 0.13;
      bottleGroup.add(washiLabel);

      sakeWallGroup.add(bottleGroup);
    }
  }

  // Top Shelf (Y = 2.17): Stacked Cedar Masu (枡) Sake Cups & Tokkuri Flasks
  const masuCedarMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.45,
  });
  for (let mi = 0; mi < 9; mi++) {
    const mz = -1.9 + mi * 0.48;
    const masu = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.08, 0.11),
      masuCedarMat
    );
    masu.position.set(-0.1, 2.23, mz);
    sakeWallGroup.add(masu);

    const masuTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.075, 0.095),
      masuCedarMat
    );
    masuTop.rotation.y = 0.35;
    masuTop.position.set(-0.1, 2.31, mz);
    sakeWallGroup.add(masuTop);
  }

  sakanaGroup.add(sakeWallGroup);

  // =========================================================================
  // 6. JARDIN ZEN & BAMBOO COURTYARD TERRACE (Z = 14..18+)
  //    Tall green bamboo stalks in slate planters, stone Tōrō lanterns & river pebbles
  // =========================================================================
  const zenGardenLabel =
    "Sakana-Tei 魚亭 — Jardin Zen Karesansui, Bambous & Lanternes Tōrō";

  // Raked Karesansui gravel & black river pebble beds flanking the main entrance walkway
  const karesansuiMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
  });
  const blackPebbleMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
  });
  const steppingStoneMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.75,
  });

  for (const sideX of [48.0, 57.5]) {
    const pebbleBed = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.04, 1.35),
      karesansuiMat
    );
    pebbleBed.position.set(sideX, 0.05, 14.85);
    pebbleBed.receiveShadow = true;
    sakanaGroup.add(pebbleBed);

    // Concentric Zen sand ripple rings around mossy garden boulders
    for (const rx of [-1.4, 1.4]) {
      const ripple = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.48, 24),
        new THREE.MeshBasicMaterial({ color: 0x94a3b8, side: THREE.DoubleSide })
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.set(sideX + rx, 0.075, 14.85);
      sakanaGroup.add(ripple);

      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.24, 1),
        blackPebbleMat
      );
      rock.scale.set(1.2, 0.75, 1.0);
      rock.position.set(sideX + rx, 0.16, 14.85);
      rock.castShadow = true;
      sakanaGroup.add(rock);
    }
  }

  // Tobi-ishi (飛び石) granite stepping stones leading to the Noren entrance (X = 52.5..53.0, Z = 14.2..16.4)
  for (let sz = 14.4; sz <= 16.4; sz += 0.52) {
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.36, 0.045, 12),
      steppingStoneMat
    );
    stone.scale.set(1.3, 1, 0.85);
    stone.position.set(52.75 + (Math.round(sz * 10) % 2 === 0 ? -0.1 : 0.1), 0.06, sz);
    stone.receiveShadow = true;
    sakanaGroup.add(stone);
  }

  // Tall Emerald Bamboo Planter Clusters around the Zen Courtyard Terrace (Z = 14.5..18.0)
  const bambooConfigs = [
    { x: 46.2, z: 14.55, w: 2.2, d: 0.44, rotY: 0, stalks: 8 },
    { x: 49.8, z: 14.55, w: 1.9, d: 0.44, rotY: 0, stalks: 7 },
    { x: 55.6, z: 14.55, w: 1.9, d: 0.44, rotY: 0, stalks: 7 },
    { x: 59.4, z: 14.55, w: 2.2, d: 0.44, rotY: 0, stalks: 8 },
    // West & East Bamboo Courtyard Wings (Z = 15.8..17.6)
    { x: 44.55, z: 16.5, w: 2.4, d: 0.44, rotY: Math.PI / 2, stalks: 8 },
    { x: 61.35, z: 16.5, w: 2.4, d: 0.44, rotY: Math.PI / 2, stalks: 8 },
  ];

  for (const bc of bambooConfigs) {
    const bamboo = createBambooPlanterCluster(bc.w, bc.d, bc.stalks);
    bamboo.position.set(bc.x, 0, bc.z);
    bamboo.rotation.y = bc.rotY;
    sakanaGroup.add(bamboo);
  }

  // Carved Stone Tōrō Lanterns flanking the Noren Entrance & Zen Terrace Corners
  const toroPositions = [
    { x: 50.95, z: 14.75 },
    { x: 54.35, z: 14.75 },
    { x: 45.4, z: 17.6 },
    { x: 60.4, z: 17.6 },
  ];

  for (const tp of toroPositions) {
    const toro = createToroStoneLantern();
    toro.position.set(tp.x, 0, tp.z);
    toro.traverse((child) => {
      if (child.isMesh) {
        child.userData = { sceneObjectId, label: zenGardenLabel };
        if (Array.isArray(interactiveMeshes)) {
          interactiveMeshes.push(child);
        }
      }
    });
    sakanaGroup.add(toro);
  }

  scene.add(sakanaGroup);
  return sakanaGroup;
}

/**
 * Adds ultra-detailed 3D culinary equipment to each Sakana-Tei 魚亭 station group:
 *   - `station-sk-sushi` (`hinoki_sushi_bar` / `hinoki_sushi_counter`)
 *   - `station-sk-robata` (`binchotan_robata_hearth` / `binchotan_robata`)
 *   - `station-sk-tempura` (`japanese_wok_fryer` / `tempura_ramen_range`)
 *   - `station-sk-pass` / `station-sk-passe` (`heat_lamp_pass` / `heated_pass`)
 *   - `station-sk-bar` (`sake_bar_counter` / `japanese_sake_bar`)
 *   - `station-sk-plonge` & `storage-sk-cold` (+ `pos-sk-main`)
 */
export function decorateSakanaStation(group, obj = {}, tr = {}) {
  const id = obj.domainEntityId || obj.sceneObjectId || "";
  const style = obj.equipmentStyle || "";
  const kind = obj.stationKind || "";
  const bodyH = tr.height || 0.95;
  const w = tr.width || 2.4;
  const d = tr.depth || 1.0;

  // =========================================================================
  // 1. OMAKASE HINOKI SUSHI BAR (`station-sk-sushi` / `hinoki_sushi_bar`)
  // =========================================================================
  if (
    id.includes("sushi") ||
    style === "hinoki_sushi_bar" ||
    style === "hinoki_sushi_counter" ||
    kind === "sushi_bar" ||
    kind === "sushi_counter"
  ) {
    const hinokiMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.28,
      metalness: 0.05,
    });
    const cedarBarkMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.55,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.52,
      roughness: 0.08,
      metalness: 0.15,
    });
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xf0f9ff,
      roughness: 0.35,
      metalness: 0.1,
    });
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.82,
      roughness: 0.22,
    });

    // Pale blond Hinoki Cypress L-counter top plank (Ichimai-ita)
    const mainSlab = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.14, 0.075, d + 0.12),
      hinokiMat
    );
    mainSlab.position.set(0, bodyH + 0.04, 0);
    mainSlab.castShadow = true;
    mainSlab.receiveShadow = true;
    group.add(mainSlab);

    // L-Return wing on the East end of the Omakase counter
    const lWing = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.075, 0.68),
      hinokiMat
    );
    lWing.position.set(w / 2 - 0.18, bodyH + 0.04, d / 2 + 0.28);
    group.add(lWing);

    const lWingBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, bodyH, 0.62),
      cedarBarkMat
    );
    lWingBase.position.set(w / 2 - 0.18, bodyH / 2, d / 2 + 0.26);
    group.add(lWingBase);

    // Refrigerated Glass Neta Sashimi Showcase with Crushed Ice Bed
    const caseW = w * 0.68;
    const iceBed = new THREE.Mesh(
      new THREE.BoxGeometry(caseW - 0.06, 0.045, 0.3),
      iceMat
    );
    iceBed.position.set(-0.22, bodyH + 0.095, -0.18);
    group.add(iceBed);

    const netaGlassTop = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.22,
        0.22,
        caseW,
        16,
        1,
        false,
        0,
        Math.PI
      ),
      glassMat
    );
    netaGlassTop.rotation.z = Math.PI / 2;
    netaGlassTop.position.set(-0.22, bodyH + 0.11, -0.18);
    group.add(netaGlassTop);

    // Sashimi Sakus inside Neta Showcase: Ruby Akami, Marbled Otoro, Orange Salmon, Yellowtail, Sea Bream
    const netaSpec = [
      { color: 0xb91c1c, name: "Akami" },    // Deep ruby Akami tuna
      { color: 0xfda4af, name: "Otoro" },    // Pink marbled Otoro belly
      { color: 0xf97316, name: "Sake" },     // Bright orange Ora King salmon
      { color: 0xfef08a, name: "Hamachi" },  // Golden yellowtail loin
      { color: 0xfce7f3, name: "Madai" },    // Pearlescent sea bream fillet
      { color: 0xf59e0b, name: "Uni" },      // Hokkaido sea urchin tray
    ];
    const startFishX = -0.22 - caseW * 0.42;
    const stepFishX = (caseW * 0.84) / (netaSpec.length - 1);
    netaSpec.forEach((fish, idx) => {
      const saku = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.048, 0.15),
        new THREE.MeshStandardMaterial({ color: fish.color, roughness: 0.25 })
      );
      saku.position.set(startFishX + idx * stepFishX, bodyH + 0.135, -0.18);
      group.add(saku);
    });

    // Wooden Hangiri (飯切) Sushi Rice Tub with Dual Copper Bands
    const hangiriGroup = new THREE.Group();
    hangiriGroup.position.set(w * 0.34, bodyH + 0.13, -0.14);
    const tub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.19, 0.13, 18),
      hinokiMat
    );
    hangiriGroup.add(tub);

    for (const cy of [-0.03, 0.03]) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.202, 0.008, 6, 20),
        copperMat
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = cy;
      hangiriGroup.add(band);
    }

    const shariRice = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.02, 14),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.6 })
    );
    shariRice.position.y = 0.06;
    hangiriGroup.add(shariRice);
    group.add(hangiriGroup);

    // Yanagiba & Deba Sushi Knives on Slanted Magnetic Hinoki Block
    const knifeBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.16, 0.06),
      cedarBarkMat
    );
    knifeBlock.rotation.x = -0.28;
    knifeBlock.position.set(w * 0.12, bodyH + 0.14, -0.34);
    group.add(knifeBlock);

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.12,
    });
    for (const ky of [-0.03, 0.03]) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.022, 0.006),
        bladeMat
      );
      blade.position.set(w * 0.1, bodyH + 0.15 + ky, -0.31);
      group.add(blade);

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8),
        hinokiMat
      );
      handle.rotation.z = Math.PI / 2;
      handle.position.set(w * 0.25, bodyH + 0.15 + ky, -0.31);
      group.add(handle);
    }

    // Individual Hinoki Geta Placement Mats along Customer Counter Edge
    for (let si = 0; si < 4; si++) {
      const sx = -w * 0.34 + si * (w * 0.22);
      const geta = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.03, 0.18),
        hinokiMat
      );
      geta.position.set(sx, bodyH + 0.09, d * 0.26);
      group.add(geta);

      // 4 Hinoki Counter Stools with Indigo Cushions in front of the counter
      const stoolGroup = new THREE.Group();
      stoolGroup.position.set(sx, 0, d / 2 + 0.42);

      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.06, 0.64, 10),
        cedarBarkMat
      );
      leg.position.y = 0.32;
      stoolGroup.add(leg);

      const footRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.012, 6, 16),
        copperMat
      );
      footRing.rotation.x = Math.PI / 2;
      footRing.position.y = 0.22;
      stoolGroup.add(footRing);

      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.055, 0.34),
        hinokiMat
      );
      seat.position.y = 0.66;
      seat.castShadow = true;
      stoolGroup.add(seat);

      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.035, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.65 })
      );
      cushion.position.y = 0.7;
      stoolGroup.add(cushion);

      group.add(stoolGroup);
    }
    return;
  }

  // =========================================================================
  // 2. BINCHOTAN ROBATAYAKI HEARTH (`station-sk-robata` / `binchotan_robata_hearth`)
  // =========================================================================
  if (
    id.includes("robata") ||
    style === "binchotan_robata_hearth" ||
    style === "binchotan_robata" ||
    kind === "robata_grill"
  ) {
    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.15,
    });
    const ashSandMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.92,
    });
    const binchotanGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.95,
      roughness: 0.35,
    });
    const whiteAshMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xf97316,
      emissiveIntensity: 0.45,
      roughness: 0.65,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.3,
    });
    const bronzeHoodMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      metalness: 0.72,
      roughness: 0.28,
    });

    // Sunken Dark Basalt Hearth Curb
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.92, 0.16, d * 0.86),
      basaltMat
    );
    curb.position.set(0, bodyH + 0.08, 0);
    group.add(curb);

    // Fine Grey Ash Sand Bed (Haizuna)
    const sandBed = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.82, 0.04, d * 0.74),
      ashSandMat
    );
    sandBed.position.set(0, bodyH + 0.15, 0);
    group.add(sandBed);

    // Glowing Kishu Binchotan White-Ash Charcoal Logs
    for (let ci = 0; ci < 9; ci++) {
      const cx = -w * 0.32 + (ci % 5) * (w * 0.16);
      const cz = ci < 5 ? -0.08 : 0.1;
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.048, 0.32, 8),
        ci % 2 === 0 ? binchotanGlowMat : whiteAshMat
      );
      log.rotation.z = Math.PI / 2 + ((ci % 3) - 1) * 0.2;
      log.rotation.y = (ci % 4) * 0.35;
      log.position.set(cx, bodyH + 0.19, cz);
      group.add(log);
    }

    // Tiered Forged-Iron Skewer Bars (Tekkyu) over the Binchotan Pit
    for (const barZ of [-0.14, 0.06]) {
      const ironBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, w * 0.84, 8),
        ironMat
      );
      ironBar.rotation.z = Math.PI / 2;
      ironBar.position.set(0, bodyH + 0.26, barZ);
      group.add(ironBar);
    }

    // Upright Bamboo Skewers (Genshiyaki style) planted in the sand bed angled toward the coals
    const skewerMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.6,
    });
    const wagyuFoodMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.4,
    });
    const codFoodMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.35,
    });

    for (let si = 0; si < 6; si++) {
      const sx = -w * 0.3 + si * (w * 0.12);
      const skewerGroup = new THREE.Group();
      skewerGroup.position.set(sx, bodyH + 0.17, -0.24);
      skewerGroup.rotation.x = 0.48;

      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.006, 0.34, 6),
        skewerMat
      );
      stick.position.y = 0.15;
      skewerGroup.add(stick);

      const morsel = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.11, 0.045),
        si % 2 === 0 ? wagyuFoodMat : codFoodMat
      );
      morsel.position.y = 0.23;
      skewerGroup.add(morsel);

      group.add(skewerGroup);
    }

    // Dark Bronze Exhaust Hood with Brass Trim
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.96, 0.42, d * 0.94),
      bronzeHoodMat
    );
    hood.position.set(0, bodyH + 1.38, 0);
    hood.castShadow = true;
    group.add(hood);

    const brassTrim = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.98, 0.04, d * 0.96),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.85,
        roughness: 0.2,
      })
    );
    brassTrim.position.set(0, bodyH + 1.18, 0);
    group.add(brassTrim);
    return;
  }

  // =========================================================================
  // 3. TEMPURA & RAMEN ZUNDŌ STATION (`station-sk-tempura` / `japanese_wok_fryer`)
  // =========================================================================
  if (
    id.includes("tempura") ||
    style === "japanese_wok_fryer" ||
    style === "tempura_ramen_range" ||
    kind === "tempura_ramen" ||
    kind === "wok_fryer"
  ) {
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.82,
      roughness: 0.22,
    });
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.8,
      roughness: 0.25,
    });
    const oilMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.12,
      metalness: 0.1,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.85,
      roughness: 0.2,
    });
    const woodLidMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.55,
    });

    // Twin Hammered Brass Tempura Frying Vats (Tempura-nabe)
    for (const vx of [-w * 0.28, -0.02]) {
      const vat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.19, 0.14, 18),
        brassMat
      );
      vat.position.set(vx, bodyH + 0.09, 0.04);
      group.add(vat);

      const sesameOil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.02, 16),
        oilMat
      );
      sesameOil.position.set(vx, bodyH + 0.145, 0.04);
      group.add(sesameOil);

      // Semi-circular copper wire oil-draining rack (Ami) at back of vat
      const drainRack = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.012, 6, 14, Math.PI),
        copperMat
      );
      drainRack.rotation.x = -Math.PI / 2;
      drainRack.position.set(vx, bodyH + 0.17, 0.02);
      group.add(drainRack);
    }

    // Steaming Wooden-Lidded Ramen Zundō Broth Cauldron on Right Side
    const zundoX = w * 0.29;
    const zundoPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.38, 18),
      steelMat
    );
    zundoPot.position.set(zundoX, bodyH + 0.21, -0.04);
    zundoPot.castShadow = true;
    group.add(zundoPot);

    // Traditional heavy wooden Ki-buta lid with cross handle
    const kiButa = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.035, 16),
      woodLidMat
    );
    kiButa.position.set(zundoX, bodyH + 0.41, -0.04);
    group.add(kiButa);

    const lidHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.045, 0.055),
      woodLidMat
    );
    lidHandle.position.set(zundoX, bodyH + 0.445, -0.04);
    group.add(lidHandle);

    // Two Tebo bamboo noodle boiling baskets next to the cauldron
    for (const bz of [-0.18, 0.14]) {
      const tebo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.065, 0.16, 12),
        copperMat
      );
      tebo.position.set(zundoX - 0.15, bodyH + 0.11, bz);
      group.add(tebo);
    }
    return;
  }

  // =========================================================================
  // 4. CEDAR & SLATE PASS COUNTER (`station-sk-pass` / `station-sk-passe` / `heat_lamp_pass`)
  // =========================================================================
  if (
    id.includes("pass") ||
    style === "heat_lamp_pass" ||
    style === "heated_pass" ||
    kind === "pass"
  ) {
    const slateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.2,
    });
    const cedarMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.42,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      metalness: 0.82,
      roughness: 0.22,
    });
    const lacquerBlackMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.18,
      metalness: 0.3,
    });
    const lacquerRedMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.22,
    });

    // Dark Kyoto Slate & Cedar Pass Surface
    const slateSlab = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.96, 0.04, d * 0.92),
      slateMat
    );
    slateSlab.position.set(0, bodyH + 0.045, 0);
    group.add(slateSlab);

    // Overhead Cedar & Bronze Pendant Bridge
    for (const px of [-w * 0.42, w * 0.42]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.68, 10),
        bronzeMat
      );
      post.position.set(px, bodyH + 0.36, 0);
      group.add(post);
    }

    const crossBeam = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.9, 0.055, 0.09),
      cedarMat
    );
    crossBeam.position.set(0, bodyH + 0.68, 0);
    group.add(crossBeam);

    // 4 Warm Bronze Japanese Conical Pendant Heat Lamps
    for (const lx of [-w * 0.32, -w * 0.11, w * 0.11, w * 0.32]) {
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.16, 16),
        bronzeMat
      );
      shade.position.set(lx, bodyH + 0.54, 0);
      group.add(shade);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      bulb.position.set(lx, bodyH + 0.45, 0);
      group.add(bulb);
    }

    // Stacked Urushi Lacquer Serving Trays (Obon) on Left & Right Ends
    for (let ti = 0; ti < 4; ti++) {
      const obon = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.025, 0.28),
        ti % 2 === 0 ? lacquerBlackMat : lacquerRedMat
      );
      obon.position.set(-w * 0.36, bodyH + 0.08 + ti * 0.03, 0.12);
      group.add(obon);
    }
    return;
  }

  // =========================================================================
  // 5. HINOKI & SLATE SAKE BAR (`station-sk-bar` / `sake_bar_counter`)
  // =========================================================================
  if (
    id.includes("bar") ||
    style === "sake_bar_counter" ||
    style === "japanese_sake_bar" ||
    kind === "bar"
  ) {
    const slateMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.32,
      metalness: 0.25,
    });
    const hinokiMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.3,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.18,
    });
    const celadonMat = new THREE.MeshStandardMaterial({
      color: 0x99f6e4,
      roughness: 0.2,
    });
    const bizenMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.5,
    });

    // Two-tone Hinoki & Dark Slate Bar Top
    const slateTop = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.96, 0.04, d * 0.55),
      slateMat
    );
    slateTop.position.set(0, bodyH + 0.045, -d * 0.18);
    group.add(slateTop);

    const hinokiFrontEdge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.06, 0.055, d * 0.45),
      hinokiMat
    );
    hinokiFrontEdge.position.set(0, bodyH + 0.048, d * 0.22);
    group.add(hinokiFrontEdge);

    // Chilled Glass & Brass Sake Dispenser Tower
    const dispenser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.18, 0.42, 16),
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.68,
        roughness: 0.1,
      })
    );
    dispenser.position.set(-w * 0.26, bodyH + 0.26, -0.15);
    group.add(dispenser);

    const dispenserCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16),
      brassMat
    );
    dispenserCap.position.set(-w * 0.26, bodyH + 0.48, -0.15);
    group.add(dispenserCap);

    // Ceramic Tokkuri Sake Carafes & Ochoko Tasting Cups
    for (let ci = 0; ci < 5; ci++) {
      const cx = -0.35 + ci * 0.34;
      const mat = ci % 2 === 0 ? celadonMat : bizenMat;

      // Tokkuri flask
      const flask = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.052, 0.16, 12),
        mat
      );
      flask.position.set(cx, bodyH + 0.14, 0.08);
      group.add(flask);

      // Pair of Ochoko cups
      for (const ox of [-0.06, 0.06]) {
        const cup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.018, 0.042, 10),
          mat
        );
        cup.position.set(cx + ox, bodyH + 0.085, 0.22);
        group.add(cup);
      }
    }

    // Attach 3D sorted bar bottle shelf for live barman bottle units & slot placeholders
    const barShelf = buildSortedBarBottleShelf3D(group, obj, tr);
    group.userData = group.userData || {};
    group.userData.shelfGroup = barShelf;
    return;
  }

  // =========================================================================
  // 6. JAPANESE DISHWASHING STATION (`station-sk-plonge`) &
  //    ULTRA-COLD SASHIMI FREEZER (`storage-sk-cold`)
  // =========================================================================
  if (id.includes("plonge") || kind === "dishwashing" || style === "dish_pit") {
    const inoxMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.78,
      roughness: 0.25,
    });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
    });

    // Hood-type Japanese ceramic washer on left
    const washerHood = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.58, 0.72),
      inoxMat
    );
    washerHood.position.set(-w * 0.26, bodyH + 0.29, 0);
    group.add(washerHood);

    // Rinse basin & overhead gooseneck pre-rinse sprayer on right
    const basin = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.03, 0.54),
      waterMat
    );
    basin.position.set(w * 0.22, bodyH + 0.04, 0);
    group.add(basin);

    const arcPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8),
      inoxMat
    );
    arcPipe.position.set(w * 0.22, bodyH + 0.28, -0.26);
    group.add(arcPipe);
    return;
  }

  if (
    id.includes("cold") ||
    id.includes("storage") ||
    kind === "storage" ||
    style === "walkin_cooler"
  ) {
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.65,
      roughness: 0.28,
    });
    const frostGlassMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.15,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.92,
      roughness: 0.12,
    });

    // Insulated stainless freezer door on front (+Z) face
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.56, bodyH * 0.84, 0.06),
      doorMat
    );
    door.position.set(0, bodyH * 0.46, d / 2 + 0.03);
    group.add(door);

    // Blue-lit frost viewport window showing ultra-cold -4°C / -60°C sashimi aging chamber
    const viewport = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.34, bodyH * 0.32, 0.075),
      frostGlassMat
    );
    viewport.position.set(0, bodyH * 0.58, d / 2 + 0.03);
    group.add(viewport);

    // Heavy chrome walk-in latch handle
    const latch = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.24, 0.09),
      chromeMat
    );
    latch.position.set(w * 0.22, bodyH * 0.45, d / 2 + 0.06);
    group.add(latch);

    // Attach 3-tier sorted storage rack (Tier 1..3, Slots 0..5) for live physical stock units
    const storageRack = buildSortedStorageRack3D(group, obj, tr);
    group.userData = group.userData || {};
    group.userData.shelfGroup = storageRack;
  }
}
