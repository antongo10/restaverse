import * as THREE from "three";
import { buildSortedStorageRack3D, buildSortedBarBottleShelf3D } from "./assets/KitchenBarShelves3D";

export function createTextSprite(
  text,
  bgColor = "rgba(15, 23, 42, 0.88)",
  textColor = "#f8fafc",
  borderColor = "#38bdf8",
  subText = null
) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = subText ? 92 : 68;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = "bold 22px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text || "").slice(0, 30), canvas.width / 2, subText ? 31 : 35);

  if (subText) {
    ctx.fillStyle = "#bae6fd";
    ctx.font = "600 17px Inter, system-ui, sans-serif";
    ctx.fillText(String(subText).slice(0, 36), canvas.width / 2, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(subText ? 2.7 : 2.3, subText ? 0.65 : 0.48, 1);
  return sprite;
}

export function createFloorTexture(pattern = "herringbone_parquet", baseHex = "#b45309", widthM = 10, depthM = 10) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  if (pattern === "herringbone_parquet") {
    ctx.strokeStyle = "rgba(69, 26, 3, 0.38)";
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 32) {
        ctx.fillStyle = (x + y) % 64 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
        ctx.fillRect(x, y, 30, 14);
        ctx.strokeRect(x, y, 32, 16);
        ctx.strokeRect(x, y + 16, 16, 16);
      }
    }
  } else if (pattern === "terracotta_tiles") {
    ctx.strokeStyle = "rgba(120, 53, 15, 0.45)";
    ctx.lineWidth = 3;
    for (let y = 0; y < 256; y += 64) {
      for (let x = 0; x < 256; x += 64) {
        ctx.fillStyle = (x + y) % 128 === 0 ? "rgba(254, 215, 170, 0.08)" : "rgba(154, 52, 18, 0.12)";
        ctx.fillRect(x + 2, y + 2, 60, 60);
        ctx.strokeRect(x, y, 64, 64);
      }
    }
  } else if (pattern === "carrara_marble") {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 256; i += 64) {
      ctx.strokeRect(i, 0, 64, 256);
      ctx.strokeRect(0, i, 256, 64);
    }
    ctx.strokeStyle = "rgba(100, 116, 139, 0.22)";
    ctx.beginPath();
    ctx.moveTo(10, 20);
    ctx.bezierCurveTo(90, 60, 150, 140, 240, 220);
    ctx.stroke();
  } else if (pattern === "hinoki_wood") {
    ctx.strokeStyle = "rgba(180, 83, 9, 0.22)";
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "rgba(15, 23, 42, 0.28)";
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 32) {
        ctx.strokeRect(x, y, 32, 32);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, widthM / 2.2), Math.max(1, depthM / 2.2));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds specialized 3D architectural details for kitchen, bar, pass, and dining stations
 */
export function decorateStationMesh(group, obj, tr) {
  const style = obj.equipmentStyle || obj.stationKind || "";
  const bodyH = tr.height || 0.95;

  if (style === "french_island_range") {
    // 8 cast-iron gas burners with glowing blue/amber flames & overhead extraction hood
    const grateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    for (const gx of [-1.2, -0.4, 0.4, 1.2]) {
      for (const gz of [-0.32, 0.32]) {
        const grate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 12), grateMat);
        grate.position.set(gx, bodyH + 0.06, gz);
        group.add(grate);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 16), flameMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(gx, bodyH + 0.07, gz);
        group.add(ring);
      }
    }
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.25 });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(tr.width * 0.95, 0.38, tr.depth * 0.95), hoodMat);
    hood.position.set(0, bodyH + 1.35, 0);
    group.add(hood);
  } else if (style === "tuscan_wood_grill") {
    // Brick hearth + glowing oak embers + iron grill grates
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.85 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(tr.width, 0.9, 0.22), brickMat);
    backWall.position.set(0, bodyH + 0.45, -tr.depth * 0.38);
    group.add(backWall);

    const emberMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const emberBed = new THREE.Mesh(new THREE.BoxGeometry(tr.width * 0.82, 0.06, tr.depth * 0.65), emberMat);
    emberBed.position.set(0, bodyH + 0.06, 0.05);
    group.add(emberBed);
  } else if (style === "pasta_cooker") {
    // 6 perforated brass pasta baskets in steaming water wells
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.25 });
    for (const bx of [-0.7, 0, 0.7]) {
      for (const bz of [-0.22, 0.22]) {
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.14, 14), brassMat);
        basket.position.set(bx, bodyH + 0.1, bz);
        group.add(basket);
      }
    }
  } else if (style === "hinoki_sushi_bar") {
    // Refrigerated glass Neta sashimi case + sashimi blocks + counter stools
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
    });
    const netaCase = new THREE.Mesh(new THREE.BoxGeometry(tr.width * 0.75, 0.22, 0.36), glassMat);
    netaCase.position.set(-0.2, bodyH + 0.14, -0.25);
    group.add(netaCase);

    const fishColors = [0xef4444, 0xf97316, 0xfef08a, 0xfda4af, 0xdc2626];
    fishColors.forEach((col, idx) => {
      const fillet = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.06, 0.18),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 })
      );
      fillet.position.set(-1.3 + idx * 0.55, bodyH + 0.08, -0.25);
      group.add(fillet);
    });
  } else if (style === "binchotan_robata_hearth") {
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const charcoal = new THREE.Mesh(new THREE.BoxGeometry(tr.width * 0.8, 0.07, tr.depth * 0.65), emberMat);
    charcoal.position.set(0, bodyH + 0.06, 0);
    group.add(charcoal);
  } else if (style === "heat_lamp_pass" || obj.stationKind === "pass") {
    // Copper bridge with 3 glowing infrared heat lamps
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(tr.width * 0.88, 0.05, 0.08), copperMat);
    bar.position.set(0, bodyH + 0.58, 0);
    group.add(bar);

    for (const lx of [-tr.width * 0.3, 0, tr.width * 0.3]) {
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 12), copperMat);
      shade.position.set(lx, bodyH + 0.46, 0);
      group.add(shade);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      bulb.position.set(lx, bodyH + 0.38, 0);
      group.add(bulb);
    }
  } else if (obj.stationKind === "bar") {
    // Illuminated 3-tier back-bar sorted bottle shelf + speed rail
    const barShelf = buildSortedBarBottleShelf3D(group, obj, tr);
    group.userData = group.userData || {};
    group.userData.shelfGroup = barShelf;
  } else if (
    obj.stationKind === "storage" ||
    style === "cold_storage" ||
    style === "dry_storage" ||
    String(obj.id || "").toLowerCase().includes("storage") ||
    String(obj.id || "").toLowerCase().includes("chambre") ||
    String(obj.id || "").toLowerCase().includes("dispensa")
  ) {
    // Multi-tiered sorted stainless storage rack (Tier 1..3, Slots 0..5)
    const storageRack = buildSortedStorageRack3D(group, obj, tr);
    group.userData = group.userData || {};
    group.userData.shelfGroup = storageRack;
  }
}

/**
 * Builds 3D cookware & plated dish models for active tasks on a station
 */
export function populateStationTaskModels(cookwareGroup, activeTasks = [], bodyH = 0.95, stationWidth = 2.4) {
  while (cookwareGroup.children.length > 0) {
    cookwareGroup.remove(cookwareGroup.children[0]);
  }
  if (!activeTasks || activeTasks.length === 0) return;

  const visibleTasks = activeTasks.slice(0, 4);
  const spacing = Math.min(0.62, (stationWidth * 0.78) / Math.max(1, visibleTasks.length));
  const startX = -((visibleTasks.length - 1) * spacing) / 2;

  visibleTasks.forEach((task, idx) => {
    const itemGroup = new THREE.Group();
    itemGroup.position.set(startX + idx * spacing, bodyH + 0.08, 0.12);
    const asset = task.visualAsset || "copper_saute_pan";

    if (asset === "copper_saute_pan" || asset === "tempura_wok") {
      const panMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.75, roughness: 0.25 });
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.08, 16), panMat);
      itemGroup.add(pan);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), panMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 0.03, 0.24);
      itemGroup.add(handle);
      const food = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.14, 0.03, 12),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 })
      );
      food.position.y = 0.035;
      itemGroup.add(food);
    } else if (asset === "sushi_geta_board") {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.04, 0.24),
        new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.55 })
      );
      itemGroup.add(board);
      const nigiriCols = [0xef4444, 0xf97316, 0xfef08a];
      nigiriCols.forEach((c, ni) => {
        const piece = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.045, 0.05),
          new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 })
        );
        piece.position.set(-0.1 + ni * 0.1, 0.04, 0);
        itemGroup.add(piece);
      });
    } else if (asset === "tuscan_bistecca_grill" || asset === "robata_skewers") {
      const platter = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.03, 0.26),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 })
      );
      itemGroup.add(platter);
      const steak = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.06, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.5 })
      );
      steak.position.y = 0.045;
      itemGroup.add(steak);
    } else if (asset === "stockpot_simmer" || asset === "pasta_bollitore_basket") {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.22, 16),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 })
      );
      pot.position.y = 0.08;
      itemGroup.add(pot);
    } else if (asset === "wine_decanter_glasses") {
      const decanter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.11, 0.24, 12),
        new THREE.MeshStandardMaterial({ color: 0x881337, transparent: true, opacity: 0.85, roughness: 0.15 })
      );
      decanter.position.y = 0.09;
      itemGroup.add(decanter);
    } else {
      // Plated Dish with garnish
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.15, 0.03, 16),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
      );
      itemGroup.add(plate);
      const garnish = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45 })
      );
      garnish.scale.y = 0.55;
      garnish.position.y = 0.04;
      itemGroup.add(garnish);
    }

    cookwareGroup.add(itemGroup);
  });
}

const ROLE_OUTFIT_COLORS = {
  Manager: 0x7c3aed,
  Kitchen: 0xf8fafc, // Crisp white chef jacket
  Floor: 0x1e3a8a,   // Navy bistro vest & apron
  Bar: 0xb45309,     // Warm amber bartender vest
  Customer: 0x059669,
  Pedestrian: 0x475569,
};

const CUSTOMER_PALETTE = [
  0x059669,
  0x0284c7,
  0xd97706,
  0xe11d48,
  0x7c3aed,
  0x0d9488,
  0x9333ea,
  0x2563eb,
  0xb45309,
  0xbe123c,
];

const SKIN_TONES = [0xfde68a, 0xfcd34d, 0xfed7aa, 0xe2a76f, 0xc68642];
const HAIR_COLORS = [0x18181b, 0x78350f, 0x451a03, 0x9a3412, 0xca8a04, 0x3f3f46];

function buildSingleHumanRig(ag, memberIdx = 0, baseHash = 0) {
  const memberRoot = new THREE.Group();
  const bodyPivot = new THREE.Group();
  memberRoot.add(bodyPivot);

  const h = baseHash + memberIdx * 31;
  const torsoColor =
    ag.agentKind === "customer"
      ? CUSTOMER_PALETTE[h % CUSTOMER_PALETTE.length]
      : ROLE_OUTFIT_COLORS[ag.role] || 0x2563eb;

  const trouserColor =
    ag.role === "Kitchen"
      ? 0x1e293b
      : ag.agentKind === "customer"
      ? [0x1e293b, 0x334155, 0x451a03, 0x0f172a][h % 4]
      : 0x0f172a;

  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN_TONES[h % SKIN_TONES.length],
    roughness: 0.52,
  });
  const torsoMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.38 });
  const legMat = new THREE.MeshStandardMaterial({ color: trouserColor, roughness: 0.58 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.4 });

  // Torso + Shoulders + Pelvis
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.22), torsoMat);
  torso.position.y = 0.84;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Collar / Shirt / Tie accent for staff & guests
  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.08, 0.23),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  );
  collar.position.set(0, 1.06, 0.01);
  bodyPivot.add(collar);

  // Apron for Kitchen / Floor / Bar staff
  if (ag.agentKind === "employee" && ["Kitchen", "Floor", "Bar"].includes(ag.role)) {
    const apronColor = ag.role === "Kitchen" ? 0xe2e8f0 : 0xf8fafc;
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.44, 0.035),
      new THREE.MeshStandardMaterial({ color: apronColor, roughness: 0.5 })
    );
    apron.position.set(0, 0.58, 0.115);
    bodyPivot.add(apron);
  }

  // Head & Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 10), skinMat);
  neck.position.y = 1.12;
  bodyPivot.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 16), skinMat);
  head.position.y = 1.26;
  head.castShadow = true;
  bodyPivot.add(head);

  // Eyes (subtle forward orientation cues)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  for (const ex of [-0.052, 0.052]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeMat);
    eye.position.set(ex, 1.27, 0.14);
    bodyPivot.add(eye);
  }

  // Chef Toque for Kitchen Staff, Styled Hair for others
  if (ag.role === "Kitchen") {
    const toqueMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28 });
    const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.135, 0.24, 14), toqueMat);
    toque.position.y = 1.47;
    bodyPivot.add(toque);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.162, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({ color: HAIR_COLORS[h % HAIR_COLORS.length], roughness: 0.68 })
    );
    hair.position.y = 1.27;
    hair.rotation.x = -0.12;
    bodyPivot.add(hair);
  }

  // Articulated Left & Right Legs with Upper Thigh + Knee Joint + Lower Calf + Shoe
  const buildArticulatedLeg = (offsetX) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(offsetX, 0.58, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.29, 10), legMat);
    thigh.position.y = -0.14;
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.28, 0);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.28, 10), legMat);
    calf.position.y = -0.14;
    calf.castShadow = true;
    kneePivot.add(calf);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.18), shoeMat);
    shoe.position.set(0, -0.27, 0.03);
    kneePivot.add(shoe);

    hipPivot.add(kneePivot);
    bodyPivot.add(hipPivot);
    return { hipPivot, kneePivot };
  };

  const leftLeg = buildArticulatedLeg(-0.1);
  const rightLeg = buildArticulatedLeg(0.1);

  // Articulated Left & Right Arms + Hands
  const buildArticulatedArm = (offsetX) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(offsetX, 1.03, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.38, 8), torsoMat);
    sleeve.position.y = -0.18;
    armPivot.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skinMat);
    hand.position.y = -0.38;
    armPivot.add(hand);
    bodyPivot.add(armPivot);
    return armPivot;
  };

  const leftArmPivot = buildArticulatedArm(-0.23);
  const rightArmPivot = buildArticulatedArm(0.23);

  // 1. Waiter Silver Serving Tray + Plated Course + Cloche (visible when carryingDish / SERVING)
  const trayGroup = new THREE.Group();
  trayGroup.position.set(0.16, 0.94, 0.34);
  const trayMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.022, 18),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.14 })
  );
  trayGroup.add(trayMesh);

  // Plated dish + garnish visible on the waiter's serving tray
  const trayPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.11, 0.02, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.16 })
  );
  trayPlate.position.set(-0.02, 0.02, 0.02);
  trayGroup.add(trayPlate);

  const trayEntree = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.028, 0.065),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.38 })
  );
  trayEntree.position.set(-0.02, 0.042, 0.02);
  trayGroup.add(trayEntree);

  const trayGarnish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.012, 10),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 })
  );
  trayGarnish.position.set(0.03, 0.04, -0.02);
  trayGroup.add(trayGarnish);

  const cloche = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.78,
      roughness: 0.18,
      transparent: true,
      opacity: 0.82,
    })
  );
  cloche.position.set(0.04, 0.025, -0.03);
  cloche.rotation.z = -0.18;
  trayGroup.add(cloche);
  trayGroup.visible = false;
  bodyPivot.add(trayGroup);

  // 2. Chef Copper Pan in Hand (visible when status === "COOKING")
  const chefPanGroup = new THREE.Group();
  chefPanGroup.position.set(0.22, 0.82, 0.34);
  const chefPan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.13, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.75, roughness: 0.25 })
  );
  chefPanGroup.add(chefPan);
  const panHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
  );
  panHandle.rotation.x = Math.PI / 2;
  panHandle.position.set(0, 0.02, -0.16);
  chefPanGroup.add(panHandle);
  chefPanGroup.visible = false;
  bodyPivot.add(chefPanGroup);

  // 3. Cook Carrying Ingredient Unit (Gastronorm tray + cucumber + prime cut held in both hands)
  // Visible when carryingIngredient / FETCHING_INGREDIENT / RETURNING_INGREDIENT
  const ingredientCarryGroup = new THREE.Group();
  ingredientCarryGroup.position.set(0, 0.86, 0.32);
  const gnTray = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.035, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.82, roughness: 0.22 })
  );
  ingredientCarryGroup.add(gnTray);

  // Ridged dark-green cucumber on the gastronorm tray
  const carriedCucumber = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.022, 0.19, 10),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.35 })
  );
  carriedCucumber.rotation.z = Math.PI / 2;
  carriedCucumber.position.set(0, 0.036, 0.04);
  ingredientCarryGroup.add(carriedCucumber);

  // Marbled protein block beside cucumber
  const carriedProtein = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.038, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.35 })
  );
  carriedProtein.position.set(-0.06, 0.036, -0.04);
  ingredientCarryGroup.add(carriedProtein);

  // Chilled dairy/burrata tub
  const carriedTub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.038, 0.048, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.22 })
  );
  carriedTub.position.set(0.08, 0.042, -0.04);
  ingredientCarryGroup.add(carriedTub);

  ingredientCarryGroup.visible = false;
  bodyPivot.add(ingredientCarryGroup);

  // 4. Cook Waiting for Shared Ingredient (Order clipboard / ticket check in hand)
  const waitTicketGroup = new THREE.Group();
  waitTicketGroup.position.set(-0.18, 0.88, 0.26);
  const clipboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.22, 0.015),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 })
  );
  clipboard.rotation.x = -0.55;
  waitTicketGroup.add(clipboard);
  const ticketPaper = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.17, 0.018),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xf59e0b, emissiveIntensity: 0.2 })
  );
  ticketPaper.rotation.x = -0.55;
  ticketPaper.position.z = 0.004;
  waitTicketGroup.add(ticketPaper);
  waitTicketGroup.visible = false;
  bodyPivot.add(waitTicketGroup);

  // 5. Barman Carrying / Pouring Spirit Bottle + Cocktail Shaker/Glass
  const barmanBottleGroup = new THREE.Group();
  barmanBottleGroup.position.set(0.18, 0.94, 0.3);
  const spiritBottleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.18, 12),
    new THREE.MeshStandardMaterial({
      color: 0x047857,
      transparent: true,
      opacity: 0.88,
      roughness: 0.12,
      metalness: 0.15,
    })
  );
  barmanBottleGroup.add(spiritBottleBody);
  const spiritBottleNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.024, 0.08, 10),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 })
  );
  spiritBottleNeck.position.y = 0.12;
  barmanBottleGroup.add(spiritBottleNeck);

  // Amber liquid pour stream (visible when status === "POURING_DRINK")
  const pourStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.009, 0.16, 8),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 })
  );
  pourStream.position.set(-0.08, 0.08, 0.06);
  pourStream.rotation.z = 0.65;
  pourStream.visible = false;
  barmanBottleGroup.add(pourStream);
  barmanBottleGroup.visible = false;
  bodyPivot.add(barmanBottleGroup);

  const barmanShakerGroup = new THREE.Group();
  barmanShakerGroup.position.set(-0.14, 0.84, 0.32);
  const shakerCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.034, 0.14, 14),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.14 })
  );
  barmanShakerGroup.add(shakerCup);
  barmanShakerGroup.visible = false;
  bodyPivot.add(barmanShakerGroup);

  // 6. Waiter Leather Bill Presenter Folder + Printed Receipt + Wireless TPE Card Terminal
  // Visible when status === "FETCHING_BILL" || status === "BRINGING_BILL"
  const billFolderGroup = new THREE.Group();
  billFolderGroup.position.set(0.16, 0.92, 0.32);
  const leatherFolder = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.018, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.45, metalness: 0.15 })
  );
  billFolderGroup.add(leatherFolder);
  const receiptSheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.008, 0.19),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xffffff, emissiveIntensity: 0.18 })
  );
  receiptSheet.position.set(-0.01, 0.012, 0);
  billFolderGroup.add(receiptSheet);
  const tpeTerminal = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.032, 0.13),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.5 })
  );
  tpeTerminal.position.set(0.045, 0.024, 0.02);
  billFolderGroup.add(tpeTerminal);
  const tpeScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.008, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.85 })
  );
  tpeScreen.position.set(0.045, 0.041, -0.005);
  billFolderGroup.add(tpeScreen);
  billFolderGroup.visible = false;
  bodyPivot.add(billFolderGroup);

  // 7. Waiter Table-Cleaning Microfiber Cloth + Sanitizer Spray (attached to right hand)
  // Visible when status === "CLEARING_TABLE"
  const cleaningClothGroup = new THREE.Group();
  cleaningClothGroup.position.set(0, -0.5, 0.06);
  const clothPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.026, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.65 })
  );
  cleaningClothGroup.add(clothPad);
  cleaningClothGroup.visible = false;
  rightArmPivot.add(cleaningClothGroup);

  // 8. Seated Guest Payment Card / Raised Bill Signal (attached to guest right hand)
  // Visible when customer status === "REQUESTING_BILL" || status === "PAYING_BILL"
  const guestCardGroup = new THREE.Group();
  guestCardGroup.position.set(0, -0.51, 0.04);
  const goldCard = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.008, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.88,
      roughness: 0.18,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
    })
  );
  guestCardGroup.add(goldCard);
  guestCardGroup.visible = false;
  rightArmPivot.add(guestCardGroup);

  return {
    memberRoot,
    bodyPivot,
    torso,
    head,
    leftLegPivot: leftLeg.hipPivot,
    leftKneePivot: leftLeg.kneePivot,
    rightLegPivot: rightLeg.hipPivot,
    rightKneePivot: rightLeg.kneePivot,
    leftArmPivot,
    rightArmPivot,
    trayGroup,
    chefPanGroup,
    ingredientCarryGroup,
    waitTicketGroup,
    barmanBottleGroup,
    barmanShakerGroup,
    pourStream,
    billFolderGroup,
    cleaningClothGroup,
    guestCardGroup,
  };
}

/**
 * Creates an articulated 3D character or multi-guest customer dining party rig.
 */
export function createArticulatedAgentRig(ag) {
  const root = new THREE.Group();

  const hash = String(ag.agentId || "")
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const memberCount =
    ag.agentKind === "customer" ? Math.min(Math.max(1, Number(ag.partySize || 2)), 8) : 1;

  const members = [];
  for (let mi = 0; mi < memberCount; mi++) {
    const m = buildSingleHumanRig(ag, mi, hash);
    root.add(m.memberRoot);
    members.push(m);
  }

  const primary = members[0];

  // Name & Task Floating Tag
  const tagBg =
    ag.agentKind === "employee"
      ? "rgba(15, 23, 42, 0.9)"
      : ag.agentKind === "pedestrian"
      ? "rgba(30, 41, 59, 0.85)"
      : "rgba(6, 78, 59, 0.9)";
  const tagBorder =
    ag.agentKind === "employee" ? "#38bdf8" : ag.agentKind === "pedestrian" ? "#94a3b8" : "#34d399";

  const nameTag = createTextSprite(ag.name, tagBg, "#ffffff", tagBorder, ag.currentTask || ag.role);
  nameTag.scale.set(2.15, 0.52, 1);
  nameTag.position.set(0, 1.92, 0);
  root.add(nameTag);

  return {
    group: root,
    members,
    bodyPivot: primary.bodyPivot,
    hitMesh: primary.torso,
    leftLegPivot: primary.leftLegPivot,
    rightLegPivot: primary.rightLegPivot,
    leftArmPivot: primary.leftArmPivot,
    rightArmPivot: primary.rightArmPivot,
    trayGroup: primary.trayGroup,
    chefPanGroup: primary.chefPanGroup,
    ingredientCarryGroup: primary.ingredientCarryGroup,
    waitTicketGroup: primary.waitTicketGroup,
    barmanBottleGroup: primary.barmanBottleGroup,
    barmanShakerGroup: primary.barmanShakerGroup,
    nameTag,
    lastTaskText: ag.currentTask || "",
  };
}

const PARTY_WALK_OFFSETS = [
  { lx: 0, lz: 0 },
  { lx: -0.36, lz: -0.34 },
  { lx: 0.36, lz: -0.4 },
  { lx: 0, lz: -0.74 },
  { lx: -0.42, lz: -0.82 },
  { lx: 0.42, lz: -0.82 },
  { lx: -0.24, lz: -1.18 },
  { lx: 0.24, lz: -1.18 },
];

export function animateArticulatedAgent(agObj, ag, now) {
  const isRequestingBill = ag.status === "REQUESTING_BILL";
  const isPayingBill = ag.status === "PAYING_BILL";
  const isSeated =
    (ag.status === "SEATED" || isRequestingBill || isPayingBill) && !ag.isMoving;
  const isCarryingBill =
    ag.status === "FETCHING_BILL" || ag.status === "BRINGING_BILL";
  const isClearingTable = ag.status === "CLEARING_TABLE";
  const isBussingToPlonge = ag.status === "BUSSING_TO_PLONGE";
  const isServing =
    Boolean(ag.carryingDish) ||
    ag.status === "SERVING" ||
    ag.status === "CARRYING_DISH" ||
    isBussingToPlonge ||
    (isClearingTable && Boolean(ag.carryingDish));
  const isCarryingIngredient =
    Boolean(ag.carryingIngredient) ||
    ag.status === "FETCHING_INGREDIENT" ||
    ag.status === "RETURNING_INGREDIENT";
  const isWaitingForIngredient = ag.status === "WAITING_FOR_INGREDIENT";
  const isPouringDrink = ag.status === "POURING_DRINK";
  const isCarryingBottle =
    Boolean(ag.carryingBottle) ||
    isPouringDrink ||
    ag.status === "FETCHING_BOTTLE" ||
    ag.status === "RETURNING_BOTTLE";
  const isCooking =
    ag.status === "COOKING" && !isCarryingIngredient && !isWaitingForIngredient;
  const isMoving = Boolean(ag.isMoving);
  const heading = typeof ag.headingRad === "number" ? ag.headingRad : 0;

  const members = agObj.members || [];
  const activePartySize =
    ag.agentKind === "customer"
      ? Math.max(1, Math.min(members.length, Number(ag.partySize || members.length)))
      : 1;
  const seatCount = Math.max(activePartySize, Number(ag.tableSeats || 2));
  const chairRadius = Math.max(Number(ag.tableWidth || 0.9), Number(ag.tableDepth || 0.9)) * 0.57;

  members.forEach((m, mi) => {
    if (ag.agentKind === "customer") {
      m.memberRoot.visible = mi < activePartySize;
      if (!m.memberRoot.visible) return;
    }

    m.trayGroup.visible = mi === 0 && (isServing || (isClearingTable && !isMoving));
    m.chefPanGroup.visible = mi === 0 && isCooking && !isMoving;
    if (m.ingredientCarryGroup) {
      m.ingredientCarryGroup.visible = mi === 0 && isCarryingIngredient;
    }
    if (m.waitTicketGroup) {
      m.waitTicketGroup.visible = mi === 0 && isWaitingForIngredient;
    }
    if (m.barmanBottleGroup) {
      m.barmanBottleGroup.visible = mi === 0 && isCarryingBottle;
      if (m.pourStream) {
        m.pourStream.visible = mi === 0 && isPouringDrink && !isMoving;
      }
    }
    if (m.barmanShakerGroup) {
      m.barmanShakerGroup.visible = mi === 0 && isPouringDrink && !isMoving;
    }
    if (m.billFolderGroup) {
      m.billFolderGroup.visible = mi === 0 && isCarryingBill;
    }
    if (m.cleaningClothGroup) {
      m.cleaningClothGroup.visible = mi === 0 && isClearingTable && !isMoving;
    }
    if (m.guestCardGroup) {
      m.guestCardGroup.visible =
        ag.agentKind === "customer" && mi === 0 && (isRequestingBill || isPayingBill);
    }
    // Reset any z-rotation on right arm unless waving/wiping
    m.rightArmPivot.rotation.z = 0;

    if (isSeated && ag.agentKind === "customer") {
      // Position each guest in the party on their actual chair around the table (seats 0 .. partySize-1)
      const angle = (mi / seatCount) * Math.PI * 2;
      m.memberRoot.position.set(Math.cos(angle) * chairRadius, 0, Math.sin(angle) * chairRadius);
      m.bodyPivot.rotation.y = Math.atan2(-Math.cos(angle), -Math.sin(angle));

      // Proper seated posture: pelvis on chair cushion (y=0.44m), thighs horizontal, knees bent 90 deg down
      m.bodyPivot.position.y = -0.14;
      m.leftLegPivot.rotation.x = -1.48;
      m.leftKneePivot.rotation.x = 1.48;
      m.rightLegPivot.rotation.x = -1.48;
      m.rightKneePivot.rotation.x = 1.48;

      if (mi === 0 && isRequestingBill) {
        // Guest #0 raises right hand high & waves to signal the waiter for the check
        const wave = Math.sin(now * 0.011);
        m.leftArmPivot.rotation.x = -0.62;
        m.rightArmPivot.rotation.x = -2.38 + wave * 0.22;
        m.rightArmPivot.rotation.z = -0.16 + Math.cos(now * 0.011) * 0.16;
        m.head.rotation.y = Math.sin(now * 0.004) * 0.32;
      } else if (mi === 0 && isPayingBill) {
        // Guest #0 extends gold payment card forward toward the waiter's TPE terminal
        const tap = Math.sin(now * 0.015);
        m.leftArmPivot.rotation.x = -0.68;
        m.rightArmPivot.rotation.x = -1.22 + tap * 0.14;
        m.head.rotation.y = 0.15;
      } else {
        // Natural dining & conversation arm/head gestures
        const gesture = Math.sin(now * 0.0035 + mi * 1.9);
        m.leftArmPivot.rotation.x = -0.68 + gesture * 0.08;
        m.rightArmPivot.rotation.x = -0.76 - gesture * 0.14;
        m.head.rotation.y = Math.sin(now * 0.0018 + mi * 2.1) * 0.18;
      }
    } else if (isMoving) {
      if (mi === 0) {
        m.memberRoot.position.set(0, 0, 0);
      } else {
        const off = PARTY_WALK_OFFSETS[mi] || { lx: (mi - 1) * 0.35, lz: -0.45 * mi };
        const cosH = Math.cos(heading);
        const sinH = Math.sin(heading);
        const wx = off.lx * cosH + off.lz * sinH;
        const wz = -off.lx * sinH + off.lz * cosH;
        m.memberRoot.position.set(wx, 0, wz);
      }

      const phase = now * 0.0115 + mi * 0.85;
      const stride = Math.sin(phase) * 0.56;
      m.leftLegPivot.rotation.x = stride;
      m.leftKneePivot.rotation.x = Math.max(0, -stride * 0.65);
      m.rightLegPivot.rotation.x = -stride;
      m.rightKneePivot.rotation.x = Math.max(0, stride * 0.65);

      if (mi === 0 && isCarryingIngredient) {
        // Both arms raised steady in front holding the gastronorm ingredient tray
        m.leftArmPivot.rotation.x = -0.92 + Math.sin(phase) * 0.06;
        m.rightArmPivot.rotation.x = -0.92 - Math.sin(phase) * 0.06;
      } else if (mi === 0 && (isServing || isCarryingBill)) {
        // Waiter carries silver tray or leather bill folder + TPE terminal on raised right hand
        m.leftArmPivot.rotation.x = -stride * 0.5;
        m.rightArmPivot.rotation.x = -1.02;
      } else if (mi === 0 && isCarryingBottle) {
        // Barman walks carrying spirit bottle from/to the sorted back-bar shelf
        m.leftArmPivot.rotation.x = -stride * 0.55;
        m.rightArmPivot.rotation.x = -0.95;
        if (m.barmanBottleGroup) {
          m.barmanBottleGroup.rotation.z = 0;
        }
      } else {
        m.leftArmPivot.rotation.x = -stride * 0.68;
        m.rightArmPivot.rotation.x = stride * 0.68;
      }

      m.bodyPivot.position.y = Math.abs(Math.sin(phase)) * 0.042;
      m.bodyPivot.rotation.y = heading;
      m.head.rotation.y = 0;
    } else if (isClearingTable) {
      // Waiter standing beside vacated table wiping the tabletop with microfiber cloth & stacking dirty plates on tray
      m.memberRoot.position.set(0, 0, 0);
      m.leftLegPivot.rotation.x = 0;
      m.leftKneePivot.rotation.x = 0;
      m.rightLegPivot.rotation.x = 0;
      m.rightKneePivot.rotation.x = 0;
      const wipePhase = now * 0.017;
      m.leftArmPivot.rotation.x = -0.95; // Left arm holds bussing tray steady
      m.rightArmPivot.rotation.x = -1.06 + Math.sin(wipePhase) * 0.26; // Right arm wipes tabletop back and forth
      m.rightArmPivot.rotation.z = Math.cos(wipePhase) * 0.24;
      m.bodyPivot.position.y = Math.sin(wipePhase * 2) * 0.015;
      m.bodyPivot.rotation.y = heading;
      m.head.rotation.y = Math.cos(wipePhase) * 0.14;
    } else if (isWaitingForIngredient) {
      // Cook waiting for another cook to return a shared ingredient unit to the shelf:
      // checks order ticket clipboard in left hand, taps right foot impatiently, looks toward storage
      m.memberRoot.position.set(0, 0, 0);
      const tap = Math.max(0, Math.sin(now * 0.016));
      m.leftLegPivot.rotation.x = 0;
      m.leftKneePivot.rotation.x = 0;
      m.rightLegPivot.rotation.x = -tap * 0.16;
      m.rightKneePivot.rotation.x = tap * 0.24;
      m.leftArmPivot.rotation.x = -0.88;
      m.rightArmPivot.rotation.x = -0.35 + Math.sin(now * 0.008) * 0.12;
      m.bodyPivot.position.y = 0;
      m.bodyPivot.rotation.y = heading;
      m.head.rotation.y = Math.sin(now * 0.005) * 0.35;
    } else if (isPouringDrink) {
      // Barman tilting bottle to pour into cocktail shaker/glass at the bar counter
      m.memberRoot.position.set(0, 0, 0);
      m.leftLegPivot.rotation.x = 0;
      m.leftKneePivot.rotation.x = 0;
      m.rightLegPivot.rotation.x = 0;
      m.rightKneePivot.rotation.x = 0;
      const pourOsc = Math.sin(now * 0.01);
      m.leftArmPivot.rotation.x = -0.78;
      m.rightArmPivot.rotation.x = -1.12 + pourOsc * 0.08;
      if (m.barmanBottleGroup) {
        m.barmanBottleGroup.rotation.z = 1.18 + pourOsc * 0.1;
        m.barmanBottleGroup.position.set(0.08, 1.02, 0.32);
      }
      m.bodyPivot.position.y = 0;
      m.bodyPivot.rotation.y = heading;
      m.head.rotation.y = -0.08;
    } else if (isCooking) {
      m.memberRoot.position.set(0, 0, 0);
      m.leftLegPivot.rotation.x = 0;
      m.leftKneePivot.rotation.x = 0;
      m.rightLegPivot.rotation.x = 0;
      m.rightKneePivot.rotation.x = 0;
      m.leftArmPivot.rotation.x = -0.5;
      m.rightArmPivot.rotation.x = -0.85 + Math.sin(now * 0.014) * 0.25;
      m.chefPanGroup.position.z = 0.34 + Math.sin(now * 0.014) * 0.06;
      m.bodyPivot.position.y = 0;
      m.bodyPivot.rotation.y = Math.PI; // Face the cooking station
      m.head.rotation.y = Math.sin(now * 0.004) * 0.1;
    } else {
      // Standing at host stand, pass, bar, storage rack, POS, or table side
      if (mi === 0) {
        m.memberRoot.position.set(0, 0, 0);
      } else {
        const off = PARTY_WALK_OFFSETS[mi] || { lx: 0.35, lz: -0.35 };
        m.memberRoot.position.set(off.lx, 0, off.lz);
      }
      m.leftLegPivot.rotation.x = 0;
      m.leftKneePivot.rotation.x = 0;
      m.rightLegPivot.rotation.x = 0;
      m.rightKneePivot.rotation.x = 0;
      if (mi === 0 && isCarryingIngredient) {
        m.leftArmPivot.rotation.x = -0.88;
        m.rightArmPivot.rotation.x = -0.88;
      } else if (mi === 0 && isCarryingBottle) {
        m.leftArmPivot.rotation.x = -0.25;
        m.rightArmPivot.rotation.x = -0.9;
        if (m.barmanBottleGroup) {
          m.barmanBottleGroup.rotation.z = 0;
          m.barmanBottleGroup.position.set(0.18, 0.94, 0.3);
        }
      } else if (mi === 0 && isCarryingBill) {
        // Presenting leather bill folder + wireless TPE terminal to the guest at table side
        m.leftArmPivot.rotation.x = -0.45;
        m.rightArmPivot.rotation.x = -1.04 + Math.sin(now * 0.008) * 0.06;
      } else {
        m.leftArmPivot.rotation.x = isServing ? -0.35 : -0.08;
        m.rightArmPivot.rotation.x = isServing ? -0.98 : -0.12 + Math.sin(now * 0.003 + mi) * 0.06;
      }
      m.bodyPivot.position.y = 0;
      m.bodyPivot.rotation.y = heading;
      m.head.rotation.y = Math.sin(now * 0.002 + mi) * 0.12;
    }
  });
}
