import * as THREE from "three";

/**
 * Shared canvas texture cache for shelf labels, slot numbers, and stock unit mini-badges
 * so identical labels do not allocate duplicate WebGL textures across frames.
 */
const shelfTextureCache = new Map();

function createLabelCanvasTexture(
  text,
  {
    subText = null,
    bgColor = "rgba(15, 23, 42, 0.92)",
    textColor = "#f8fafc",
    subColor = "#bae6fd",
    borderColor = "#38bdf8",
    width = 320,
    height = 68,
    fontSize = 20,
  } = {}
) {
  const cacheKey = `${text}|${subText || ""}|${bgColor}|${textColor}|${borderColor}|${width}x${height}`;
  if (shelfTextureCache.has(cacheKey)) {
    return shelfTextureCache.get(cacheKey);
  }

  if (typeof document === "undefined") {
    return new THREE.Texture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(3, 3, width - 6, height - 6, 12);
  } else {
    ctx.rect(3, 3, width - 6, height - 6);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text || "").slice(0, 38), width / 2, subText ? height * 0.36 : height * 0.52);

  if (subText) {
    ctx.fillStyle = subColor;
    ctx.font = `600 ${Math.max(13, fontSize - 4)}px Inter, system-ui, sans-serif`;
    ctx.fillText(String(subText).slice(0, 42), width / 2, height * 0.72);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  if (shelfTextureCache.size > 400) {
    const firstKey = shelfTextureCache.keys().next().value;
    shelfTextureCache.delete(firstKey);
  }
  shelfTextureCache.set(cacheKey, tex);
  return tex;
}

function createMiniBadgeSprite(
  text,
  {
    subText = null,
    bgColor = "rgba(15, 23, 42, 0.92)",
    textColor = "#f8fafc",
    subColor = "#a7f3d0",
    borderColor = "#10b981",
    scaleX = 0.56,
    scaleY = 0.14,
  } = {}
) {
  const tex = createLabelCanvasTexture(text, {
    subText,
    bgColor,
    textColor,
    subColor,
    borderColor,
    width: 340,
    height: subText ? 84 : 60,
    fontSize: 20,
  });
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleX, subText ? scaleY * 1.28 : scaleY, 1);
  return sprite;
}

/**
 * Canonical 3-tier shelf configuration shared by `buildSortedStorageRack3D`,
 * `buildSortedBarBottleShelf3D`, and `populateStationShelfUnits`.
 */
export const STORAGE_SHELF_TIERS = [
  {
    tier: 1,
    title: "Tier 1 Top: Proteins & Spirits",
    shortCode: "T1 • PROTEINS & SPIRITS",
    yOffset: 0.8,
    zOffset: -0.08,
    accentHex: "#f97316",
    ledColor: 0xfef08a,
  },
  {
    tier: 2,
    title: "Tier 2 Mid: Fresh Produce & Cucumber",
    shortCode: "T2 • FRESH PRODUCE & CUCUMBER",
    yOffset: 0.44,
    zOffset: 0.0,
    accentHex: "#10b981",
    ledColor: 0x38bdf8,
  },
  {
    tier: 3,
    title: "Tier 3 Bottom: Dairy, Stocks & Wines",
    shortCode: "T3 • DAIRY, STOCKS & WINES",
    yOffset: 0.08,
    zOffset: 0.08,
    accentHex: "#38bdf8",
    ledColor: 0x38bdf8,
  },
];

export const BAR_BOTTLE_SLOTS = [
  { slotIndex: 0, label: "Gin", visualModel: "bar_bottle_clear", color: 0xe0f2fe },
  { slotIndex: 1, label: "Vermouth", visualModel: "bar_bottle_amber", color: 0x991b1b },
  { slotIndex: 2, label: "Campari", visualModel: "bar_bottle_amber", color: 0xdc2626 },
  { slotIndex: 3, label: "Chianti Classico", visualModel: "bar_bottle_emerald", color: 0x14532d },
  { slotIndex: 4, label: "Grappa", visualModel: "bar_bottle_clear", color: 0xf8fafc },
  { slotIndex: 5, label: "Junmai Daiginjo", visualModel: "bar_bottle_emerald", color: 0x065f46 },
  { slotIndex: 6, label: "Nikka Whisky", visualModel: "bar_bottle_amber", color: 0xd97706 },
  { slotIndex: 7, label: "Yuzu Liqueur", visualModel: "bar_bottle_emerald", color: 0x65a30d },
];

/**
 * Computes exact local (x, y, z) coordinates for a given (shelfTier 1..3, slotIndex 0..5)
 * relative to the station group origin.
 */
export function computeShelfSlotLocalTransform(shelfTier = 2, slotIndex = 0, stationTransform = {}) {
  const w = Number(stationTransform?.width || stationTransform?.w || 2.2);
  const bodyH = Number(stationTransform?.height || stationTransform?.bodyH || 0.95);

  const normalizedTier = Math.max(1, Math.min(3, Number(shelfTier) || 2));
  const tierSpec =
    STORAGE_SHELF_TIERS.find((t) => t.tier === normalizedTier) || STORAGE_SHELF_TIERS[1];

  const slotCount = 6;
  const clampedSlot = Math.max(0, Math.min(slotCount - 1, Number(slotIndex) || 0));
  const rackWidth = Math.max(1.25, w * 0.86);
  const bayWidth = rackWidth / slotCount;
  const x = -rackWidth / 2 + (clampedSlot + 0.5) * bayWidth;
  const y = bodyH + tierSpec.yOffset + 0.022;
  const z = tierSpec.zOffset;

  return {
    x,
    y,
    z,
    bayWidth,
    rackWidth,
    bodyH,
    tierSpec,
    clampedSlot,
    normalizedTier,
  };
}

/**
 * Builds a 3-tier industrial anodized-steel / brass / hinoki shelving unit with 3 clearly
 * labeled horizontal shelf tiers (`Tier 1 Top: Proteins & Spirits`,
 * `Tier 2 Mid: Fresh Produce & Cucumber`, `Tier 3 Bottom: Dairy, Stocks & Wines`)
 * and 6 sorted slot bays per tier (`slotIndex 0..5`), complete with shelf lip rails,
 * LED under-shelf strip lighting, and slot divider tags.
 */
export function buildSortedStorageRack3D(stationObjOrGroup = {}, trOrObj = {}, maybeTr = null) {
  let targetParent = null;
  let stationObj = stationObjOrGroup || {};
  let tr = trOrObj || {};

  if (stationObjOrGroup && stationObjOrGroup.isObject3D) {
    targetParent = stationObjOrGroup;
    stationObj = trOrObj || {};
    tr = maybeTr || {};
  }

  const rackGroup = new THREE.Group();
  rackGroup.name = "SortedStorageRack3D";

  const businessId = stationObj.businessId || "";
  const isSakana = businessId === "business-sakana-tei";
  const isOsteria = businessId === "business-osteria-bellavista";

  const w = Number(tr.width || tr.w || 2.2);
  const d = Number(tr.depth || tr.d || 1.0);
  const bodyH = Number(tr.height || tr.bodyH || 0.95);
  const rackW = Math.max(1.25, w * 0.86);
  const shelfDepth = Math.min(0.36, d * 0.42);
  const slotCount = 6;
  const bayW = rackW / slotCount;

  const frameMat = new THREE.MeshStandardMaterial({
    color: isSakana ? 0xd97706 : isOsteria ? 0x451a03 : 0x64748b,
    metalness: isSakana ? 0.18 : 0.78,
    roughness: isSakana ? 0.42 : 0.25,
  });
  const shelfDeckMat = new THREE.MeshStandardMaterial({
    color: isSakana ? 0xfde68a : 0xcbd5e1,
    metalness: isSakana ? 0.08 : 0.72,
    roughness: isSakana ? 0.38 : 0.24,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: isOsteria || !isSakana ? 0xf59e0b : 0x94a3b8,
    metalness: 0.85,
    roughness: 0.2,
  });
  const dividerMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.65,
    roughness: 0.3,
  });

  // 4 Stepped vertical corner posts + center support stanchions
  const postHeight = 0.92;
  for (const px of [-rackW / 2 - 0.02, 0, rackW / 2 + 0.02]) {
    for (const pz of [-0.22, 0.22]) {
      if (px === 0 && pz > 0) continue; // Keep center front unobstructed
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.02, postHeight, 10),
        frameMat
      );
      post.position.set(px, bodyH + postHeight / 2 + 0.02, pz);
      post.castShadow = true;
      rackGroup.add(post);
    }
  }

  // Build each of the 3 horizontal tiers and 6 slot bays per tier
  for (const tierSpec of STORAGE_SHELF_TIERS) {
    const ty = bodyH + tierSpec.yOffset;
    const tz = tierSpec.zOffset;

    // Perforated/slatted horizontal shelf deck
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(rackW + 0.04, 0.028, shelfDepth),
      shelfDeckMat
    );
    deck.position.set(0, ty, tz);
    deck.castShadow = true;
    deck.receiveShadow = true;
    rackGroup.add(deck);

    // Front & back lip rails (garde-corps)
    for (const side of [-1, 1]) {
      const lipRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, rackW + 0.04, 10),
        railMat
      );
      lipRail.rotation.z = Math.PI / 2;
      lipRail.position.set(0, ty + 0.032, tz + side * (shelfDepth / 2 - 0.015));
      rackGroup.add(lipRail);
    }

    // Under-shelf LED strip light
    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(rackW * 0.96, 0.012, 0.025),
      new THREE.MeshBasicMaterial({ color: tierSpec.ledColor })
    );
    ledStrip.position.set(0, ty - 0.018, tz + shelfDepth * 0.25);
    rackGroup.add(ledStrip);

    // Tier title plaque mounted on the left side of each shelf tier
    const tierBannerTex = createLabelCanvasTexture(tierSpec.title, {
      bgColor: "rgba(15, 23, 42, 0.94)",
      textColor: "#ffffff",
      borderColor: tierSpec.accentHex,
      width: 384,
      height: 54,
      fontSize: 18,
    });
    const tierPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.075),
      new THREE.MeshBasicMaterial({ map: tierBannerTex, transparent: true })
    );
    tierPlaque.position.set(-rackW / 2 + 0.29, ty - 0.025, tz + shelfDepth / 2 + 0.012);
    rackGroup.add(tierPlaque);

    // 6 Sorted Slot Bays (slotIndex 0..5) with bay dividers and slot tags
    for (let si = 0; si <= slotCount; si++) {
      const divX = -rackW / 2 + si * bayW;
      const dividerFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.055, shelfDepth * 0.9),
        dividerMat
      );
      dividerFin.position.set(divX, ty + 0.038, tz);
      rackGroup.add(dividerFin);

      if (si < slotCount) {
        const slotCenterX = divX + bayW / 2;
        const slotTagTex = createLabelCanvasTexture(`SLOT #${si + 1}`, {
          bgColor: "rgba(15, 23, 42, 0.88)",
          textColor: "#e2e8f0",
          borderColor: tierSpec.accentHex,
          width: 128,
          height: 40,
          fontSize: 16,
        });
        const slotTag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.11, 0.032),
          new THREE.MeshBasicMaterial({ map: slotTagTex, transparent: true })
        );
        slotTag.position.set(slotCenterX, ty + 0.002, tz + shelfDepth / 2 + 0.008);
        rackGroup.add(slotTag);
      }
    }
  }

  if (targetParent) {
    const existing = targetParent.getObjectByName("SortedStorageRack3D");
    if (existing) targetParent.remove(existing);
    targetParent.add(rackGroup);
  }

  return rackGroup;
}

/**
 * Builds an illuminated tiered back-bar bottle display rack with sorted bottle slots
 * (`Gin`, `Vermouth`, `Campari`, `Chianti Classico`, `Grappa`, `Junmai Daiginjo`,
 * `Nikka Whisky`, `Yuzu Liqueur`), glass rails, and warm back-lighting.
 */
export function buildSortedBarBottleShelf3D(stationObjOrGroup = {}, trOrObj = {}, maybeTr = null) {
  let targetParent = null;
  let stationObj = stationObjOrGroup || {};
  let tr = trOrObj || {};

  if (stationObjOrGroup && stationObjOrGroup.isObject3D) {
    targetParent = stationObjOrGroup;
    stationObj = trOrObj || {};
    tr = maybeTr || {};
  }

  const barShelfGroup = new THREE.Group();
  barShelfGroup.name = "SortedBarBottleShelf3D";

  const businessId = stationObj.businessId || "";
  const isSakana = businessId === "business-sakana-tei";
  const isOsteria = businessId === "business-osteria-bellavista";

  const w = Number(tr.width || tr.w || 2.2);
  const bodyH = Number(tr.height || tr.bodyH || 0.95);
  const rackW = Math.max(1.25, w * 0.86);
  const slotCount = 6;
  const bayW = rackW / slotCount;

  const woodMat = new THREE.MeshStandardMaterial({
    color: isSakana ? 0xfde68a : isOsteria ? 0x451a03 : 0x3b1306,
    roughness: 0.38,
    metalness: 0.12,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.88,
    roughness: 0.18,
  });
  const glassRailMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.52,
    roughness: 0.08,
    metalness: 0.15,
  });
  const warmBacklightMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.55,
    roughness: 0.25,
  });

  // Illuminated Back-Bar Architectural Frame behind the 3 bottle tiers
  const backFrame = new THREE.Mesh(
    new THREE.BoxGeometry(rackW + 0.08, 1.05, 0.06),
    woodMat
  );
  backFrame.position.set(0, bodyH + 0.56, -0.26);
  backFrame.castShadow = true;
  barShelfGroup.add(backFrame);

  const glowPanel = new THREE.Mesh(
    new THREE.BoxGeometry(rackW, 0.94, 0.025),
    warmBacklightMat
  );
  glowPanel.position.set(0, bodyH + 0.56, -0.22);
  barShelfGroup.add(glowPanel);

  // Build 3 stepped bottle display tiers matching STORAGE_SHELF_TIERS coordinates
  STORAGE_SHELF_TIERS.forEach((tierSpec, tIdx) => {
    const ty = bodyH + tierSpec.yOffset;
    const tz = tierSpec.zOffset;

    const shelfStep = new THREE.Mesh(
      new THREE.BoxGeometry(rackW + 0.04, 0.032, 0.24),
      woodMat
    );
    shelfStep.position.set(0, ty, tz);
    shelfStep.castShadow = true;
    barShelfGroup.add(shelfStep);

    // Warm LED strip along bottle base
    const ledBar = new THREE.Mesh(
      new THREE.BoxGeometry(rackW * 0.96, 0.01, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xfde68a })
    );
    ledBar.position.set(0, ty + 0.018, tz);
    barShelfGroup.add(ledBar);

    // Front glass bottle guard rail with brass stanchions
    const glassGuard = new THREE.Mesh(
      new THREE.BoxGeometry(rackW, 0.042, 0.012),
      glassRailMat
    );
    glassGuard.position.set(0, ty + 0.042, tz + 0.11);
    barShelfGroup.add(glassGuard);

    const brassTopTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, rackW + 0.02, 10),
      brassMat
    );
    brassTopTrim.rotation.z = Math.PI / 2;
    brassTopTrim.position.set(0, ty + 0.065, tz + 0.11);
    barShelfGroup.add(brassTopTrim);

    // Sorted bottle slot plaques (`Gin`, `Vermouth`, `Campari`, `Chianti Classico`, `Grappa`, `Junmai Daiginjo`, `Nikka Whisky`, `Yuzu Liqueur`)
    for (let si = 0; si < slotCount; si++) {
      const slotCenterX = -rackW / 2 + (si + 0.5) * bayW;
      const bottleInfo = BAR_BOTTLE_SLOTS[(tIdx * 3 + si) % BAR_BOTTLE_SLOTS.length];

      const tagTex = createLabelCanvasTexture(bottleInfo.label, {
        bgColor: "rgba(15, 23, 42, 0.9)",
        textColor: "#fef3c7",
        borderColor: "#f59e0b",
        width: 180,
        height: 42,
        fontSize: 16,
      });
      const slotPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(0.22, bayW * 0.88), 0.036),
        new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })
      );
      slotPlaque.position.set(slotCenterX, ty - 0.002, tz + 0.125);
      barShelfGroup.add(slotPlaque);
    }
  });

  if (targetParent) {
    const existing = targetParent.getObjectByName("SortedBarBottleShelf3D");
    if (existing) targetParent.remove(existing);
    targetParent.add(barShelfGroup);
  }

  return barShelfGroup;
}

/**
 * Infers the visual model archetype from `unit.visualModel` or `unit.name`.
 */
export function resolveUnitArchetype(unit = {}) {
  const vm = String(unit.visualModel || "").toLowerCase();
  const nm = String(unit.name || "").toLowerCase();

  if (
    vm.includes("cucumber") ||
    nm.includes("concombre") ||
    nm.includes("cetriolo") ||
    nm.includes("kyūri") ||
    nm.includes("kyuri") ||
    nm.includes("cucumber")
  ) {
    return "cucumber_unit";
  }
  if (
    vm.includes("bottle") ||
    nm.includes("gin") ||
    nm.includes("vermouth") ||
    nm.includes("campari") ||
    nm.includes("chianti") ||
    nm.includes("grappa") ||
    nm.includes("daiginjo") ||
    nm.includes("saké") ||
    nm.includes("sake") ||
    nm.includes("whisky") ||
    nm.includes("yuzu") ||
    nm.includes("chablis") ||
    nm.includes("champagne") ||
    nm.includes("vin")
  ) {
    if (vm.includes("emerald") || nm.includes("chianti") || nm.includes("daiginjo") || nm.includes("yuzu")) {
      return "bar_bottle_emerald";
    }
    if (vm.includes("clear") || nm.includes("gin") || nm.includes("grappa")) {
      return "bar_bottle_clear";
    }
    return "bar_bottle_amber";
  }
  if (
    vm.includes("beef") ||
    vm.includes("entrecote") ||
    nm.includes("entrecôte") ||
    nm.includes("entrecote") ||
    nm.includes("bistecca") ||
    nm.includes("chianina") ||
    nm.includes("wagyu") ||
    nm.includes("bœuf") ||
    nm.includes("magret") ||
    nm.includes("cinghiale")
  ) {
    return "beef_entrecote_prime";
  }
  if (
    vm.includes("tuna") ||
    vm.includes("saku") ||
    vm.includes("fish") ||
    nm.includes("thon") ||
    nm.includes("otoro") ||
    nm.includes("loup") ||
    nm.includes("crabe") ||
    nm.includes("saumon") ||
    nm.includes("black cod") ||
    nm.includes("gindara")
  ) {
    return "tuna_saku_block";
  }
  if (
    vm.includes("burrata") ||
    vm.includes("tub") ||
    vm.includes("dairy") ||
    nm.includes("burrata") ||
    nm.includes("crème") ||
    nm.includes("chèvre") ||
    nm.includes("mascarpone") ||
    nm.includes("comté") ||
    nm.includes("parmigiano") ||
    nm.includes("beurre")
  ) {
    return "burrata_tub";
  }
  return "produce_crate";
}

/**
 * Creates a distinct, recognizable 3D model for each physical ingredient unit or bottle
 * based on `unit.visualModel` or `unit.name`, scaling proportionally with `remainingQty / initialQty`
 * and attaching clickable `stock_unit` metadata.
 */
export function createPhysicalStockUnitMesh(unit = {}) {
  const unitGroup = new THREE.Group();
  const archetype = resolveUnitArchetype(unit);

  const initialQty = Math.max(1, Number(unit.initialQty) || 150);
  const remainingQty = Math.max(0, Number(unit.remainingQty ?? initialQty));
  const ratio = THREE.MathUtils.clamp(remainingQty / initialQty, 0.12, 1.0);
  const isPartiallyUsed = remainingQty < initialQty - 0.01;
  const isNextToUse = Boolean(unit.isNextToUse);
  const unitLabelUnit = unit.unit || "g";

  // 1. Optional glowing emerald FIFO ring when `unit.isNextToUse === true`
  if (isNextToUse) {
    const fifoRing = new THREE.Mesh(
      new THREE.RingGeometry(0.115, 0.145, 24),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
      })
    );
    fifoRing.rotation.x = -Math.PI / 2;
    fifoRing.position.y = 0.004;
    unitGroup.add(fifoRing);
  }

  // 2. Build the specific 3D ingredient or bottle geometry
  if (archetype === "cucumber_unit") {
    // Polycarbonate Gastronorm tray + dark-green ridged 3D cucumber cylinder with tapered ends
    const polyTrayMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.55,
      roughness: 0.15,
    });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.15), polyTrayMat);
    tray.position.y = 0.016;
    unitGroup.add(tray);

    const cucumberSkinMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.42,
    });
    const cucumberFleshMat = new THREE.MeshStandardMaterial({
      color: 0xbbf7d0,
      roughness: 0.35,
    });

    const fullLength = 0.2;
    const currentLength = Math.max(0.045, fullLength * ratio);
    const cucumberHolder = new THREE.Group();
    cucumberHolder.position.set(0, 0.044, 0);

    // Main cucumber body (shortens in length as grams are consumed!)
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.026, currentLength, 12),
      cucumberSkinMat
    );
    body.rotation.z = Math.PI / 2;
    // Anchor left tapered tip at -fullLength/2 so the right cut end visibly recedes
    const centerX = -fullLength / 2 + currentLength / 2;
    body.position.x = centerX;
    body.castShadow = true;
    cucumberHolder.add(body);

    // Left tapered stem end
    const leftTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 10, 10),
      cucumberSkinMat
    );
    leftTip.scale.set(1.2, 0.95, 0.95);
    leftTip.position.x = centerX - currentLength / 2;
    cucumberHolder.add(leftTip);

    // Right end: either tapered blossom tip (if 100% full) or pale-green sliced flesh face (if partially cut!)
    if (isPartiallyUsed) {
      const cutFace = new THREE.Mesh(
        new THREE.CylinderGeometry(0.023, 0.023, 0.006, 12),
        cucumberFleshMat
      );
      cutFace.rotation.z = Math.PI / 2;
      cutFace.position.x = centerX + currentLength / 2 + 0.002;
      cucumberHolder.add(cutFace);

      // 2 freshly sliced cucumber rounds beside the cut end
      for (let si = 0; si < 2; si++) {
        const slice = new THREE.Mesh(
          new THREE.CylinderGeometry(0.021, 0.021, 0.008, 12),
          cucumberFleshMat
        );
        slice.position.set(centerX + currentLength / 2 + 0.026 + si * 0.022, -0.012, 0.02 * (si === 0 ? 1 : -1));
        cucumberHolder.add(slice);
      }
    } else {
      const rightTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 10, 10),
        cucumberSkinMat
      );
      rightTip.scale.set(1.2, 0.95, 0.95);
      rightTip.position.x = centerX + currentLength / 2;
      cucumberHolder.add(rightTip);
    }

    unitGroup.add(cucumberHolder);
  } else if (archetype === "beef_entrecote_prime") {
    // Stainless butcher tray + marbled crimson beef loin scaling with remainingQty
    const steelTrayMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.8,
      roughness: 0.22,
    });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.024, 0.16), steelTrayMat);
    tray.position.y = 0.012;
    unitGroup.add(tray);

    const loinW = Math.max(0.05, 0.19 * ratio);
    const meatMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.42 });
    const fatMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.38 });

    const loin = new THREE.Mesh(new THREE.BoxGeometry(loinW, 0.048, 0.11), meatMat);
    loin.position.set(-0.095 + loinW / 2, 0.046, 0);
    loin.castShadow = true;
    unitGroup.add(loin);

    // Ivory fat marbling cap & intramuscular streaks
    const fatCap = new THREE.Mesh(new THREE.BoxGeometry(loinW * 0.96, 0.01, 0.114), fatMat);
    fatCap.position.set(-0.095 + loinW / 2, 0.068, 0);
    unitGroup.add(fatCap);

    const rosemary = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, Math.min(0.12, loinW * 0.8), 6),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 })
    );
    rosemary.rotation.z = Math.PI / 2;
    rosemary.position.set(-0.095 + loinW / 2, 0.076, 0.015);
    unitGroup.add(rosemary);
  } else if (archetype === "tuna_saku_block") {
    // Crushed ice tray + sashimi-grade ruby/coral fish saku block
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 });
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.25,
      metalness: 0.1,
    });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.026, 0.16), trayMat);
    tray.position.y = 0.013;
    unitGroup.add(tray);

    const iceBed = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.018, 0.135), iceMat);
    iceBed.position.y = 0.028;
    unitGroup.add(iceBed);

    const sakuW = Math.max(0.045, 0.18 * ratio);
    const fishColor = String(unit.name || "").toLowerCase().includes("loup")
      ? 0xfda4af
      : 0xdc2626;
    const saku = new THREE.Mesh(
      new THREE.BoxGeometry(sakuW, 0.042, 0.095),
      new THREE.MeshStandardMaterial({ color: fishColor, roughness: 0.22 })
    );
    saku.position.set(-0.09 + sakuW / 2, 0.056, 0);
    saku.castShadow = true;
    unitGroup.add(saku);
  } else if (archetype === "burrata_tub") {
    // Ceramic/dairy tub with lid & visible dairy fill height
    const tubMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
    });
    const tub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.072, 0.095, 16),
      tubMat
    );
    tub.position.y = 0.048;
    tub.castShadow = true;
    unitGroup.add(tub);

    // Blue/gold artisan dairy band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.078, 0.032, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
    );
    band.position.y = 0.048;
    unitGroup.add(band);

    // Creamy white burrata/dairy dome scaled by remaining ratio
    const curd = new THREE.Mesh(
      new THREE.SphereGeometry(0.068 * (0.55 + 0.45 * ratio), 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.3 })
    );
    curd.scale.y = 0.55;
    curd.position.y = 0.082 * ratio + 0.02;
    unitGroup.add(curd);
  } else if (
    archetype === "bar_bottle_amber" ||
    archetype === "bar_bottle_emerald" ||
    archetype === "bar_bottle_clear"
  ) {
    // Sculpted glass bottle with neck, foil capsule, front label, and visible liquid level inside!
    const glassColor =
      archetype === "bar_bottle_emerald"
        ? 0x10b981
        : archetype === "bar_bottle_clear"
        ? 0xe0f2fe
        : 0xf59e0b;
    const liquidColor =
      archetype === "bar_bottle_emerald"
        ? 0x047857
        : archetype === "bar_bottle_clear"
        ? 0xbae6fd
        : 0xb45309;

    const glassMat = new THREE.MeshStandardMaterial({
      color: glassColor,
      transparent: true,
      opacity: 0.38,
      roughness: 0.08,
      metalness: 0.15,
    });
    const liquidMat = new THREE.MeshStandardMaterial({
      color: liquidColor,
      transparent: true,
      opacity: 0.88,
      roughness: 0.15,
    });
    const foilMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.85,
      roughness: 0.2,
    });

    const maxBodyH = 0.18;
    // Outer glass cylinder
    const outerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.044, maxBodyH, 14),
      glassMat
    );
    outerBody.position.y = maxBodyH / 2 + 0.005;
    unitGroup.add(outerBody);

    // Visible internal liquid cylinder that scales in height with `remainingQty / initialQty`
    const liqH = Math.max(0.015, (maxBodyH - 0.016) * ratio);
    const liquidCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.037, 0.039, liqH, 12),
      liquidMat
    );
    liquidCyl.position.y = 0.01 + liqH / 2;
    unitGroup.add(liquidCyl);

    // Bottle shoulder & neck
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.041, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      glassMat
    );
    shoulder.position.y = maxBodyH + 0.005;
    unitGroup.add(shoulder);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.022, 0.075, 10),
      glassMat
    );
    neck.position.y = maxBodyH + 0.055;
    unitGroup.add(neck);

    const capsule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0165, 0.0175, 0.036, 10),
      foilMat
    );
    capsule.position.y = maxBodyH + 0.082;
    unitGroup.add(capsule);

    // Front vintage parchment label
    const labelMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0435, 0.0445, 0.075, 12, 1, true, -Math.PI * 0.35, Math.PI * 0.7),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5, side: THREE.DoubleSide })
    );
    labelMesh.position.y = maxBodyH * 0.52;
    unitGroup.add(labelMesh);
  } else {
    // `produce_crate` — Slatted wooden market crate with colorful produce spheres
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.68 });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.068, 0.16), woodMat);
    crate.position.y = 0.034;
    crate.castShadow = true;
    unitGroup.add(crate);

    const nm = String(unit.name || "").toLowerCase();
    const sphereColor = nm.includes("tomate")
      ? 0xef4444
      : nm.includes("fenouil") || nm.includes("herbe")
      ? 0x4ade80
      : 0xfacc15;
    const produceMat = new THREE.MeshStandardMaterial({ color: sphereColor, roughness: 0.38 });

    const totalSpheres = Math.max(1, Math.round(6 * ratio));
    for (let pi = 0; pi < totalSpheres; pi++) {
      const px = -0.065 + (pi % 3) * 0.065;
      const pz = pi < 3 ? -0.032 : 0.032;
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), produceMat);
      sphere.position.set(px, 0.074, pz);
      unitGroup.add(sphere);
    }
  }

  // 3. Floating weight / FIFO pill above the unit
  const shortName = String(unit.name || "Stock").slice(0, 18);
  const weightText = `${Math.round(remainingQty)}${unitLabelUnit}/${Math.round(initialQty)}${unitLabelUnit}`;
  const pillTitle = `${shortName} • ${weightText}`;
  const pillSub = isNextToUse
    ? "NEXT TO USE (FIFO)"
    : isPartiallyUsed
    ? "ENTAMÉ"
    : null;

  const badgeSprite = createMiniBadgeSprite(pillTitle, {
    subText: pillSub,
    bgColor: isNextToUse
      ? "rgba(6, 78, 59, 0.94)"
      : isPartiallyUsed
      ? "rgba(120, 53, 15, 0.94)"
      : "rgba(15, 23, 42, 0.9)",
    borderColor: isNextToUse ? "#10b981" : isPartiallyUsed ? "#f59e0b" : "#38bdf8",
    scaleX: 0.44,
    scaleY: 0.11,
  });
  badgeSprite.position.set(
    0,
    archetype.startsWith("bar_bottle") ? 0.34 : 0.165,
    0
  );
  unitGroup.add(badgeSprite);

  // 4. Attach required `userData` to unitGroup and every mesh inside it
  const unitUserData = {
    sceneObjectId: unit.unitId,
    unitId: unit.unitId,
    label: `${unit.name} (${Math.round(remainingQty)}${unitLabelUnit}/${Math.round(initialQty)}${unitLabelUnit})${
      isNextToUse ? " • NEXT TO USE" : ""
    }`,
    objectType: "stock_unit",
    businessId: unit.businessId,
    domainEntityType: "stock_unit",
    domainEntityId: unit.unitId,
    shelfTier: unit.shelfTier,
    slotIndex: unit.slotIndex,
    status: unit.status || "ON_SHELF",
  };

  unitGroup.userData = { ...unitUserData };
  unitGroup.traverse((child) => {
    if (child.isMesh || child.isSprite) {
      child.userData = { ...unitUserData };
    }
  });

  return unitGroup;
}

/**
 * Builds a glowing amber wireframe placeholder when a physical stock unit is currently
 * taken off the shelf by a Cook or Barman (`u.isTakenOffShelf` or `TAKEN_BY_COOK` / `TAKEN_BY_BARMAN`).
 */
function createTakenSlotPlaceholderMesh(unit = {}) {
  const placeholderGroup = new THREE.Group();
  const initialQty = Math.max(1, Number(unit.initialQty) || 150);
  const remainingQty = Math.max(0, Number(unit.remainingQty ?? initialQty));
  const unitLabelUnit = unit.unit || "g";

  const wireGeo = new THREE.BoxGeometry(0.22, 0.085, 0.14);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    wireframe: true,
    transparent: true,
    opacity: 0.85,
  });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  wireMesh.position.y = 0.045;
  placeholderGroup.add(wireMesh);

  // Semi-transparent amber hitbox inside wireframe so clicking the slot works effortlessly
  const hitMesh = new THREE.Mesh(
    wireGeo,
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.16,
    })
  );
  hitMesh.position.y = 0.045;
  placeholderGroup.add(hitMesh);

  const agentName = unit.heldByAgentName || "Cuisine";
  const badgeSprite = createMiniBadgeSprite(`EN COURS: ${agentName}`, {
    subText: `${unit.name || "Unité"} (${Math.round(remainingQty)}${unitLabelUnit})`,
    bgColor: "rgba(120, 53, 15, 0.95)",
    textColor: "#fef3c7",
    subColor: "#fde68a",
    borderColor: "#f59e0b",
    scaleX: 0.48,
    scaleY: 0.12,
  });
  badgeSprite.position.set(0, 0.165, 0);
  placeholderGroup.add(badgeSprite);

  const unitUserData = {
    sceneObjectId: unit.unitId,
    unitId: unit.unitId,
    label: `${unit.name} (${Math.round(remainingQty)}${unitLabelUnit}/${Math.round(initialQty)}${unitLabelUnit}) • EN COURS (${agentName})`,
    objectType: "stock_unit",
    businessId: unit.businessId,
    domainEntityType: "stock_unit",
    domainEntityId: unit.unitId,
    shelfTier: unit.shelfTier,
    slotIndex: unit.slotIndex,
    status: unit.status || "TAKEN_BY_COOK",
  };

  placeholderGroup.userData = { ...unitUserData };
  placeholderGroup.traverse((child) => {
    if (child.isMesh || child.isSprite) {
      child.userData = { ...unitUserData };
    }
  });

  return placeholderGroup;
}

/**
 * Clears and populates `shelfGroup` with the sorted 3D physical units (`createPhysicalStockUnitMesh(u)`),
 * positioned neatly by `u.shelfTier` (`1..3`) and `u.slotIndex` (`0..5`).
 */
export function populateStationShelfUnits(
  shelfGroup,
  units = [],
  stationTransform = {},
  interactiveMeshes = null
) {
  if (!shelfGroup) return [];

  // Clean up any previously registered interactive meshes belonging to this shelfGroup
  if (Array.isArray(interactiveMeshes) && Array.isArray(shelfGroup.userData?._registeredMeshes)) {
    const oldSet = new Set(shelfGroup.userData._registeredMeshes);
    for (let i = interactiveMeshes.length - 1; i >= 0; i--) {
      if (oldSet.has(interactiveMeshes[i])) {
        interactiveMeshes.splice(i, 1);
      }
    }
  }

  while (shelfGroup.children.length > 0) {
    shelfGroup.remove(shelfGroup.children[0]);
  }

  const newlyRegistered = [];
  if (!Array.isArray(units) || units.length === 0) {
    shelfGroup.userData._registeredMeshes = newlyRegistered;
    return newlyRegistered;
  }

  // Track occupied (tier, slot) pairs so multiple units in the same slot offset cleanly
  const occupiedCountMap = new Map();

  units.forEach((u, idx) => {
    const inferredTier =
      Number(u.shelfTier) >= 1 && Number(u.shelfTier) <= 3
        ? Number(u.shelfTier)
        : Math.floor(idx / 6) % 3 + 1;
    const inferredSlot =
      typeof u.slotIndex === "number" && u.slotIndex >= 0
        ? u.slotIndex % 6
        : idx % 6;

    const slotKey = `${inferredTier}:${inferredSlot}`;
    const stackIdx = occupiedCountMap.get(slotKey) || 0;
    occupiedCountMap.set(slotKey, stackIdx + 1);

    const pos = computeShelfSlotLocalTransform(inferredTier, inferredSlot, stationTransform);
    const isTaken =
      Boolean(u.isTakenOffShelf) ||
      u.status === "TAKEN_BY_COOK" ||
      u.status === "TAKEN_BY_BARMAN";

    const unitNode = isTaken
      ? createTakenSlotPlaceholderMesh(u)
      : createPhysicalStockUnitMesh(u);

    const offsetX = stackIdx > 0 ? (stackIdx % 2 === 1 ? 0.055 : -0.055) : 0;
    const offsetZ = stackIdx > 0 ? -0.035 * stackIdx : 0;
    unitNode.position.set(pos.x + offsetX, pos.y, pos.z + offsetZ);

    shelfGroup.add(unitNode);

    unitNode.traverse((child) => {
      if (child.isMesh) {
        newlyRegistered.push(child);
        if (Array.isArray(interactiveMeshes)) {
          interactiveMeshes.push(child);
        }
      }
    });
  });

  shelfGroup.userData._registeredMeshes = newlyRegistered;
  return newlyRegistered;
}
