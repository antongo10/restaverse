import * as THREE from "three";

/**
 * Rich metadata dictionary mapping every `visualAsset` key in the MongoDB dataset
 * to its culinary cookware description, temperature, badge, icon, and accent color.
 */
export const VISUAL_ASSET_META = {
  copper_saute_pan: {
    title: "Sautoir en Cuivre Étamé",
    badge: "Cuisson Minute",
    color: "#d97706",
    icon: "🍳",
    temp: "195°C",
  },
  tuscan_bistecca_grill: {
    title: "Grille Fonte & Braise de Chêne",
    badge: "Braise Vive",
    color: "#dc2626",
    icon: "🥩",
    temp: "380°C",
  },
  pasta_bollitore_basket: {
    title: "Panier Laiton Pasta Fresca",
    badge: "Eau Frémissante",
    color: "#f59e0b",
    icon: "🍝",
    temp: "100°C",
  },
  sushi_geta_board: {
    title: "Planche Geta en Cyprès Hinoki",
    badge: "Découpe Omakase",
    color: "#10b981",
    icon: "🍣",
    temp: "14°C",
  },
  robata_skewers: {
    title: "Brochettes Yakitori sur Binchotan",
    badge: "Charbon Blanc",
    color: "#ea580c",
    icon: "🍢",
    temp: "420°C",
  },
  tempura_wok: {
    title: "Friteuse Cuivre Tempura & Chaudron Ramen",
    badge: "Friture Légère",
    color: "#eab308",
    icon: "🍤",
    temp: "180°C",
  },
  stockpot_simmer: {
    title: "Marmite de Fond & Réduction",
    badge: "Mijotage Lent",
    color: "#0284c7",
    icon: "🍲",
    temp: "92°C",
  },
  pass_heat_lamp_plate: {
    title: "Assiette Porcelaine sous Lampe Chaude",
    badge: "Prêt au Passe",
    color: "#10b981",
    icon: "🍽️",
    temp: "65°C",
  },
  cold_plated_dish: {
    title: "Dressage Garde-Manger sur Assiette Froide",
    badge: "Dressage Frais",
    color: "#06b6d4",
    icon: "🥗",
    temp: "6°C",
  },
  pastry_dessert_plate: {
    title: "Assiette Pâtisserie & Dôme Chocolat",
    badge: "Finition Pâtissière",
    color: "#a855f7",
    icon: "🍮",
    temp: "18°C",
  },
  wine_decanter_glasses: {
    title: "Carafe en Cristal & Verres Grands Crus",
    badge: "Sommellerie",
    color: "#e11d48",
    icon: "🍷",
    temp: "16°C",
  },
  espresso_tray: {
    title: "Plateau Café & Digestifs",
    badge: "Bar & Torréfaction",
    color: "#8b5cf6",
    icon: "☕",
    temp: "88°C",
  },
  ingredient_prep_crate: {
    title: "Bac Gastronorme Inox & Produits Frais",
    badge: "Mise en Place / Lot",
    color: "#14b8a6",
    icon: "🥬",
    temp: "3°C",
  },
};

function addSteamPuffs(group, count = 3, baseHeight = 0.12) {
  const steamMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.36,
    roughness: 0.9,
  });
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.032 + i * 0.008, 8, 8), steamMat);
    const angle = (i / count) * Math.PI * 2;
    puff.position.set(Math.cos(angle) * 0.04, baseHeight + i * 0.055, Math.sin(angle) * 0.04);
    group.add(puff);
  }
}

/**
 * Builds a detailed multi-part Three.js Group for a specific culinary task and its `visualAsset`.
 */
export function buildCookwareForTask(task = {}) {
  const itemGroup = new THREE.Group();
  const asset = task.visualAsset || "copper_saute_pan";

  const copperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.78, roughness: 0.22 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.82, roughness: 0.2 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.18 });
  const castIronMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.55, roughness: 0.48 });
  const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15 });

  switch (asset) {
    case "copper_saute_pan": {
      // Copper pan body + tin interior rim + riveted brass handle + seared protein + herb garnish + rising steam
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.08, 18), copperMat);
      itemGroup.add(pan);

      const innerLining = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.15, 0.082, 18), steelMat);
      innerLining.position.y = 0.003;
      itemGroup.add(innerLining);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), brassMat);
      handle.rotation.x = Math.PI / 2 - 0.15;
      handle.position.set(0, 0.04, 0.26);
      itemGroup.add(handle);

      const sauce = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.145, 0.025, 14),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.35 })
      );
      sauce.position.y = 0.036;
      itemGroup.add(sauce);

      const fillet = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.04, 0.09),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.45 })
      );
      fillet.position.set(-0.02, 0.052, 0);
      itemGroup.add(fillet);

      const herb = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.015, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 })
      );
      herb.position.set(0.03, 0.072, 0.02);
      itemGroup.add(herb);

      addSteamPuffs(itemGroup, 3, 0.11);
      break;
    }

    case "tuscan_bistecca_grill": {
      // Cast-iron grill platter + thick T-bone Bistecca alla Fiorentina + sear marks + rosemary sprig
      const platter = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.27), castIronMat);
      itemGroup.add(platter);

      const steak = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.065, 0.17),
        new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.48 })
      );
      steak.position.y = 0.045;
      itemGroup.add(steak);

      // T-bone ivory ridge
      const tBone = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.068, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 })
      );
      tBone.position.set(0.02, 0.046, 0);
      itemGroup.add(tBone);

      // Char sear marks
      const searMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });
      for (const sx of [-0.07, -0.02, 0.03, 0.08]) {
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.15), searMat);
        mark.position.set(sx, 0.078, 0);
        mark.rotation.y = 0.35;
        itemGroup.add(mark);
      }

      // Rosemary sprig
      const rosemary = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55 })
      );
      rosemary.rotation.z = Math.PI / 2;
      rosemary.rotation.y = 0.25;
      rosemary.position.set(0, 0.084, 0.03);
      itemGroup.add(rosemary);

      addSteamPuffs(itemGroup, 3, 0.12);
      break;
    }

    case "pasta_bollitore_basket": {
      // Perforated brass pasta basket + vertical handle + golden pasta ribbons
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.17, 16), brassMat);
      basket.position.y = 0.07;
      itemGroup.add(basket);

      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.025), brassMat);
      handle.position.set(0, 0.17, 0.15);
      handle.rotation.x = 0.35;
      itemGroup.add(handle);

      const pastaMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.38 });
      for (let i = 0; i < 3; i++) {
        const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.065 - i * 0.015, 0.018, 8, 16), pastaMat);
        ribbon.rotation.x = Math.PI / 2;
        ribbon.position.y = 0.13 + i * 0.012;
        itemGroup.add(ribbon);
      }

      addSteamPuffs(itemGroup, 3, 0.18);
      break;
    }

    case "sushi_geta_board": {
      // Handcrafted Hinoki wooden geta board on 2 feet + 5 colorful omakase nigiri + wasabi + gari ginger
      const hinokiMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.52 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.25), hinokiMat);
      board.position.y = 0.035;
      itemGroup.add(board);

      for (const fx of [-0.14, 0.14]) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.23), hinokiMat);
        foot.position.set(fx, 0.008, 0);
        itemGroup.add(foot);
      }

      const shariMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const netaColors = [0xdc2626, 0xf97316, 0xfef08a, 0xfda4af, 0x991b1b]; // Toro, Salmon, Tamago, Tai, Akami
      netaColors.forEach((col, ni) => {
        const nx = -0.15 + ni * 0.075;
        const rice = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.028, 0.075), shariMat);
        rice.position.set(nx, 0.064, -0.015);
        itemGroup.add(rice);

        const topping = new THREE.Mesh(
          new THREE.BoxGeometry(0.054, 0.018, 0.092),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.25 })
        );
        topping.position.set(nx, 0.084, -0.015);
        itemGroup.add(topping);
      });

      // Grated Hon-Wasabi & Pickled Ginger
      const wasabi = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.6 })
      );
      wasabi.position.set(-0.14, 0.062, 0.075);
      itemGroup.add(wasabi);

      const ginger = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfecdd3, roughness: 0.45 })
      );
      ginger.scale.y = 0.6;
      ginger.position.set(0.14, 0.06, 0.075);
      itemGroup.add(ginger);
      break;
    }

    case "robata_skewers": {
      // Binchotan grill tray + 4 bamboo skewers with tare-glazed yakitori morsels
      const grillTray = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.24), castIronMat);
      itemGroup.add(grillTray);

      const bambooMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 });
      const yakitoriMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.35 });
      const negiMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 });

      for (let si = 0; si < 4; si++) {
        const sx = -0.11 + si * 0.075;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.24, 6), bambooMat);
        stick.rotation.x = Math.PI / 2;
        stick.position.set(sx, 0.04, 0.02);
        itemGroup.add(stick);

        for (let mi = 0; mi < 3; mi++) {
          const piece = new THREE.Mesh(
            new THREE.BoxGeometry(0.042, 0.032, 0.036),
            mi === 1 ? negiMat : yakitoriMat
          );
          piece.position.set(sx, 0.042, -0.06 + mi * 0.05);
          itemGroup.add(piece);
        }
      }
      addSteamPuffs(itemGroup, 2, 0.09);
      break;
    }

    case "tempura_wok": {
      // Ceramic ramen bowl / copper tempura vessel + golden broth + prawns + wooden chopsticks
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.11, 0.12, 18),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.28 })
      );
      bowl.position.y = 0.05;
      itemGroup.add(bowl);

      const broth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.165, 0.15, 0.02, 16),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 })
      );
      broth.position.y = 0.095;
      itemGroup.add(broth);

      // Golden tempura prawns
      const tempuraMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
      for (const px of [-0.045, 0.045]) {
        const prawn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, 0.14, 8), tempuraMat);
        prawn.rotation.z = 0.45;
        prawn.position.set(px, 0.12, 0);
        itemGroup.add(prawn);
      }

      // Chopsticks resting on rim
      const chopMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
      const chopsticks = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.022), chopMat);
      chopsticks.position.set(0, 0.118, 0.07);
      itemGroup.add(chopsticks);
      break;
    }

    case "stockpot_simmer": {
      // Tall stainless/copper stockpot with twin side handles + simmering stock + steam
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 18), steelMat);
      pot.position.y = 0.1;
      itemGroup.add(pot);

      const copperBase = new THREE.Mesh(new THREE.CylinderGeometry(0.183, 0.183, 0.06, 18), copperMat);
      copperBase.position.y = 0.015;
      itemGroup.add(copperBase);

      const stock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.168, 0.168, 0.02, 16),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.2 })
      );
      stock.position.y = 0.21;
      itemGroup.add(stock);

      addSteamPuffs(itemGroup, 3, 0.25);
      break;
    }

    case "wine_decanter_glasses": {
      // Crystal wine decanter + ruby wine + 2 stemmed wine glasses
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.48,
        roughness: 0.1,
      });
      const wineMat = new THREE.MeshStandardMaterial({
        color: 0x9f1239,
        transparent: true,
        opacity: 0.88,
        roughness: 0.12,
      });

      const decanterBase = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), wineMat);
      decanterBase.scale.y = 0.65;
      decanterBase.position.set(-0.06, 0.05, 0);
      itemGroup.add(decanterBase);

      const decanterNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.055, 0.18, 12), glassMat);
      decanterNeck.position.set(-0.06, 0.15, 0);
      itemGroup.add(decanterNeck);

      for (const gx of [0.09, 0.18]) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.028, 0.09, 8), glassMat);
        stem.position.set(gx, 0.03, 0.03);
        itemGroup.add(stem);

        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.022, 0.07, 10), wineMat);
        bowl.position.set(gx, 0.095, 0.03);
        itemGroup.add(bowl);
      }
      break;
    }

    case "pastry_dessert_plate": {
      // Fine porcelain plate + glossy chocolate dome + gold leaf accent
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.025, 18), porcelainMat);
      itemGroup.add(plate);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.18, metalness: 0.25 })
      );
      dome.position.y = 0.015;
      itemGroup.add(dome);

      const goldLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), brassMat);
      goldLeaf.position.set(0, 0.1, 0);
      itemGroup.add(goldLeaf);
      break;
    }

    case "espresso_tray": {
      // Brass/silver serving tray + 2 white espresso cups + saucers
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.18, 0.02, 18), brassMat);
      itemGroup.add(tray);

      for (const cx of [-0.065, 0.065]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.028, 0.055, 12), porcelainMat);
        cup.position.set(cx, 0.035, 0);
        itemGroup.add(cup);

        const crema = new THREE.Mesh(
          new THREE.CylinderGeometry(0.034, 0.034, 0.01, 10),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 })
        );
        crema.position.set(cx, 0.06, 0);
        itemGroup.add(crema);
      }
      break;
    }

    case "ingredient_prep_crate": {
      // Stainless Gastronorm GN 1/1 pan with fresh emerald greens & ruby tomatoes
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.24), steelMat);
      crate.position.y = 0.035;
      itemGroup.add(crate);

      const greens = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.05, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 })
      );
      greens.position.set(-0.07, 0.07, 0);
      itemGroup.add(greens);

      const produce = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.05, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
      );
      produce.position.set(0.08, 0.07, 0);
      itemGroup.add(produce);
      break;
    }

    case "pass_heat_lamp_plate":
    case "cold_plated_dish":
    default: {
      // Fine porcelain plate + plated gourmet course + optional silver cloche rim
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.028, 18), porcelainMat);
      itemGroup.add(plate);

      const mainItem = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 14, 12),
        new THREE.MeshStandardMaterial({
          color: asset === "cold_plated_dish" ? 0x10b981 : 0xea580c,
          roughness: 0.4,
        })
      );
      mainItem.scale.y = 0.55;
      mainItem.position.y = 0.042;
      itemGroup.add(mainItem);

      if (asset === "pass_heat_lamp_plate") {
        addSteamPuffs(itemGroup, 2, 0.11);
      }
      break;
    }
  }

  return itemGroup;
}

/**
 * Builds a 3D active ingredient prep board (e.g., sliced cucumber rounds, seared protein,
 * or burrata/sashimi prep) positioned beside the active cookware on a kitchen/bar station.
 */
function buildActiveIngredientPrepMesh(task = {}) {
  const prepGroup = new THREE.Group();
  const ingText = String(
    task.activeIngredientName ||
      task.ingredientName ||
      (Array.isArray(task.ingredientUnits) && task.ingredientUnits[0]?.ingredientName) ||
      task.dishName ||
      ""
  ).toLowerCase();

  // Compact prep cutting board
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.014, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 })
  );
  board.position.y = 0.007;
  prepGroup.add(board);

  if (ingText.includes("concombre") || ingText.includes("cucumber") || ingText.includes("tzatziki") || ingText.includes("sunomono")) {
    // Whole halved cucumber + freshly sliced rounds on the cutting board
    const halfCuc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.015, 0.09, 10),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.35 })
    );
    halfCuc.rotation.z = Math.PI / 2;
    halfCuc.position.set(-0.025, 0.022, -0.02);
    prepGroup.add(halfCuc);

    const sliceMat = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, roughness: 0.3 });
    for (let si = 0; si < 4; si++) {
      const round = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 10), sliceMat);
      round.position.set(0.02 + si * 0.014, 0.017 + (si % 2) * 0.003, 0.015);
      prepGroup.add(round);
    }
  } else if (ingText.includes("thon") || ingText.includes("tuna") || ingText.includes("saumon") || ingText.includes("salmon") || ingText.includes("saku")) {
    const saku = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.024, 0.048),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.25 })
    );
    saku.position.set(0, 0.025, 0);
    prepGroup.add(saku);
  } else if (ingText.includes("burrata") || ingText.includes("mozzarella") || ingText.includes("fromage")) {
    const pouch = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
    );
    pouch.scale.y = 0.72;
    pouch.position.set(0, 0.028, 0);
    prepGroup.add(pouch);
  } else {
    // Prime protein cut + herb sprig on prep board
    const cut = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.022, 0.052),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.38 })
    );
    cut.position.set(-0.01, 0.024, 0);
    prepGroup.add(cut);

    const herb = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 })
    );
    herb.scale.set(1.5, 0.35, 0.7);
    herb.position.set(0.04, 0.022, 0.015);
    prepGroup.add(herb);
  }

  return prepGroup;
}

/**
 * Populates a station's `cookwareGroup` with 3D culinary models and active ingredient
 * prep models for its active tasks, attaching clickable provenance `userData`.
 */
export function populateStationTaskModels(
  cookwareGroup,
  activeTasks = [],
  bodyH = 0.95,
  stationWidth = 2.4,
  interactiveMeshes = null
) {
  if (!cookwareGroup) return;

  if (Array.isArray(interactiveMeshes) && cookwareGroup.userData?._registeredTaskMeshes) {
    for (const oldMesh of cookwareGroup.userData._registeredTaskMeshes) {
      const idx = interactiveMeshes.indexOf(oldMesh);
      if (idx !== -1) interactiveMeshes.splice(idx, 1);
    }
  }
  const registeredMeshes = [];
  cookwareGroup.userData = cookwareGroup.userData || {};
  cookwareGroup.userData._registeredTaskMeshes = registeredMeshes;

  while (cookwareGroup.children.length > 0) {
    cookwareGroup.remove(cookwareGroup.children[0]);
  }
  if (!activeTasks || activeTasks.length === 0) return;

  const visibleTasks = activeTasks.slice(0, 4);
  const spacing = Math.min(0.62, (stationWidth * 0.78) / Math.max(1, visibleTasks.length));
  const startX = -((visibleTasks.length - 1) * spacing) / 2;

  visibleTasks.forEach((task, idx) => {
    const itemGroup = buildCookwareForTask(task);
    itemGroup.position.set(startX + idx * spacing, bodyH + 0.08, 0.12);

    // Add 3D active ingredient prep board right beside the cookware when ingredient info exists
    if (
      task.activeIngredientName ||
      task.ingredientName ||
      (Array.isArray(task.ingredientUnits) && task.ingredientUnits.length > 0) ||
      task.unitId
    ) {
      const prepBoard = buildActiveIngredientPrepMesh(task);
      prepBoard.position.set(0.24, -0.02, 0.08);
      itemGroup.add(prepBoard);
    }

    const firstUnit = Array.isArray(task.ingredientUnits) ? task.ingredientUnits[0] : null;
    const sceneObjectId =
      task.dishInstanceId ||
      task.unitId ||
      firstUnit?.unitId ||
      task.taskId ||
      `task-${idx}`;
    const label = `🍳 En préparation: ${task.dishName || "Plat"} (${
      task.activeIngredientName || firstUnit?.ingredientName || task.stationRole || "Cuisine"
    })`;

    const meta = {
      sceneObjectId,
      dishInstanceId: task.dishInstanceId || null,
      unitId: task.unitId || firstUnit?.unitId || null,
      taskId: task.taskId || null,
      orderId: task.orderId || null,
      dishName: task.dishName || "Plat",
      activeIngredientName: task.activeIngredientName || firstUnit?.ingredientName || null,
      ingredientUnits: task.ingredientUnits || [],
      status: task.status || "IN_PREPARATION",
      label,
      objectType: task.dishInstanceId ? "plated_dish" : "ingredient_unit",
      domainEntityType: task.dishInstanceId ? "plated_dish" : "stock_unit",
      domainEntityId: sceneObjectId,
    };

    itemGroup.userData = { ...meta };
    itemGroup.traverse((child) => {
      if (child.isMesh) {
        child.userData = { ...meta };
        if (Array.isArray(interactiveMeshes)) {
          interactiveMeshes.push(child);
          registeredMeshes.push(child);
        }
      }
    });

    cookwareGroup.add(itemGroup);
  });
}

/**
 * Builds a dining-table-scaled 3D plated dish model for a served course on a guest's table setting.
 */
export function buildPlatedDishForTable(dish = {}, businessId = "business-bistrot-lumiere") {
  const asset = dish.visualAsset || "cold_plated_dish";
  const dishNameLower = String(dish.dishName || dish.name || "").toLowerCase();
  const group = new THREE.Group();

  const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.16, metalness: 0.05 });
  const slateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.15 });
  const hinokiMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.5 });
  const oakBoardMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
  const goldRimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });

  if (asset === "sushi_geta_board" || dishNameLower.includes("sushi") || dishNameLower.includes("nigiri") || dishNameLower.includes("sashimi")) {
    // Hinoki cypress geta board with 4 nigiri pieces + wasabi & gari ginger
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.15), hinokiMat);
    board.position.y = 0.015;
    group.add(board);

    const nigiriColors = [0xdc2626, 0xf97316, 0xfef08a, 0xfda4af];
    nigiriColors.forEach((col, i) => {
      const shari = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.02, 0.024),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
      );
      shari.position.set(-0.065 + i * 0.044, 0.035, -0.01);
      group.add(shari);

      const neta = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.014, 0.028),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.25 })
      );
      neta.position.set(-0.065 + i * 0.044, 0.048, -0.01);
      group.add(neta);
    });

    const wasabi = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 })
    );
    wasabi.position.set(0.08, 0.032, 0.04);
    group.add(wasabi);
  } else if (asset === "tuscan_bistecca_grill" || dishNameLower.includes("bistecca") || dishNameLower.includes("tagliata")) {
    // Carved Tuscan oak board with thick seared T-bone Bistecca, rosemary & lemon wedge
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.024, 0.18), oakBoardMat);
    board.position.y = 0.012;
    group.add(board);

    const steak = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.042, 0.11),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.48 })
    );
    steak.position.set(-0.02, 0.04, 0);
    group.add(steak);

    const rosemary = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 })
    );
    rosemary.rotation.z = Math.PI / 2.3;
    rosemary.position.set(-0.02, 0.066, 0.01);
    group.add(rosemary);

    const lemon = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    lemon.position.set(0.085, 0.035, 0.03);
    group.add(lemon);
  } else if (asset === "robata_skewers" || dishNameLower.includes("yakitori") || dishNameLower.includes("robata") || dishNameLower.includes("misoyaki") || dishNameLower.includes("wagyu")) {
    // Japanese black slate plate with glazed robata skewers & lime
    const slate = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.018, 0.15), slateMat);
    slate.position.y = 0.01;
    group.add(slate);

    for (let si = -1; si <= 1; si++) {
      const meat = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.026, 0.028),
        new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.35 })
      );
      meat.position.set(0, 0.03, si * 0.038);
      group.add(meat);
    }
  } else if (asset === "pasta_bollitore_basket" || dishNameLower.includes("tagliatelle") || dishNameLower.includes("pappardelle") || dishNameLower.includes("ravioli") || dishNameLower.includes("pasta") || dishNameLower.includes("risotto")) {
    // Deep porcelain pasta bowl with golden pasta nest, rich ragù & basil leaf
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.095, 0.042, 18), porcelainMat);
    bowl.position.y = 0.021;
    group.add(bowl);

    const pastaNest = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.028, 10, 18),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.45 })
    );
    pastaNest.rotation.x = Math.PI / 2;
    pastaNest.position.y = 0.042;
    group.add(pastaNest);

    const ragu = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.35 })
    );
    ragu.scale.y = 0.45;
    ragu.position.y = 0.058;
    group.add(ragu);

    const basil = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 })
    );
    basil.scale.set(1.4, 0.35, 0.8);
    basil.position.set(0.01, 0.068, 0.01);
    group.add(basil);
  } else if (asset === "tempura_wok" || dishNameLower.includes("ramen") || dishNameLower.includes("tempura") || dishNameLower.includes("udon")) {
    // Deep ceramic donburi/ramen bowl with broth, chashu & ajitama egg
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.085, 0.065, 16), slateMat);
    bowl.position.y = 0.033;
    group.add(bowl);

    const broth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.112, 0.11, 0.01, 14),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25 })
    );
    broth.position.y = 0.058;
    group.add(broth);

    const egg = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.3 })
    );
    egg.scale.y = 0.55;
    egg.position.set(0.035, 0.065, 0.02);
    group.add(egg);
  } else if (asset === "pastry_dessert_plate" || dishNameLower.includes("tiramisu") || dishNameLower.includes("brûlée") || dishNameLower.includes("tarte") || dishNameLower.includes("profiteroles") || dishNameLower.includes("matcha") || dishNameLower.includes("panna")) {
    // Fine porcelain dessert plate with caramelized pastry & berry garnish
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.02, 16), porcelainMat);
    plate.position.y = 0.01;
    group.add(plate);

    const pastry = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.042, 14),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.38 })
    );
    pastry.position.y = 0.032;
    group.add(pastry);

    const berry = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3 })
    );
    berry.position.set(0, 0.058, 0);
    group.add(berry);
  } else if (
    dishNameLower.includes("concombre") ||
    dishNameLower.includes("cucumber") ||
    dishNameLower.includes("tzatziki") ||
    dishNameLower.includes("sunomono") ||
    dishNameLower.includes("carpaccio") ||
    dishNameLower.includes("burrata")
  ) {
    // Chilled porcelain starter plate with fanned cucumber rounds / burrata / carpaccio & dill
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.105, 0.02, 20), porcelainMat);
    plate.position.y = 0.01;
    group.add(plate);

    const centerMound = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 12, 10),
      new THREE.MeshStandardMaterial({
        color: dishNameLower.includes("carpaccio") ? 0xdc2626 : 0xf8fafc,
        roughness: 0.25,
      })
    );
    centerMound.scale.y = 0.55;
    centerMound.position.set(0, 0.028, 0);
    group.add(centerMound);

    const sliceMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.32 });
    for (let ri = 0; ri < 6; ri++) {
      const a = (ri / 6) * Math.PI * 2;
      const cucumberRound = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 10), sliceMat);
      cucumberRound.position.set(Math.cos(a) * 0.055, 0.023, Math.sin(a) * 0.055);
      group.add(cucumberRound);
    }
  } else {
    // Signature French Brasserie / Bistro Plated Main Course (Entrecôte, Magret, Bouillabaisse, Confit)
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.022, 20), porcelainMat);
    plate.position.y = 0.011;
    group.add(plate);

    const goldRim = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.004, 6, 20), goldRimMat);
    goldRim.rotation.x = Math.PI / 2;
    goldRim.position.y = 0.022;
    group.add(goldRim);

    const protein = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.032, 0.075),
      new THREE.MeshStandardMaterial({
        color: asset === "cold_plated_dish" ? 0x10b981 : 0x9a3412,
        roughness: 0.4,
      })
    );
    protein.position.set(-0.02, 0.034, 0.01);
    group.add(protein);

    // Maître d'hôtel herb butter or garnish + side gratin
    const butter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.01, 10),
      new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.35 })
    );
    butter.position.set(-0.02, 0.054, 0.01);
    group.add(butter);

    const sideGratin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.032, 0.028, 12),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })
    );
    sideGratin.position.set(0.055, 0.032, -0.025);
    group.add(sideGratin);
  }

  return group;
}

/**
 * Populates a dining table's `dishesGroup` with authentic 3D plated dishes, stemware, and cutlery
 * reflecting the table's live `servedDishes` array.
 *
 * CRITICAL SEAT-ACCURATE PLATING:
 * Uses `angle = (ci / seatCount) * Math.PI * 2` for `ci = 0 .. activeSeats - 1` so plates sit
 * ONLY in front of occupied guest seats (e.g., if `partySize = 2` at a 5- or 6-seat table,
 * only seats `0` and `1` receive plates; seats `2..seatCount-1` remain empty).
 * Every plated dish mesh carries full clickable `userData` (`sceneObjectId = dishInstanceId`)
 * so clicking a plate opens its ingredient provenance in the ObjectInspectorPanel.
 */
export function populateTableServedDishes(
  dishesGroup,
  servedDishes = [],
  seatCount = 2,
  tableWidth = 0.9,
  tableDepth = 0.9,
  businessId = "business-bistrot-lumiere",
  partySize = null,
  interactiveMeshes = null
) {
  if (!dishesGroup) return;

  // Clean up previously registered interactive meshes for this table's dishesGroup
  if (Array.isArray(interactiveMeshes) && dishesGroup.userData?._registeredDishMeshes) {
    for (const oldMesh of dishesGroup.userData._registeredDishMeshes) {
      const idx = interactiveMeshes.indexOf(oldMesh);
      if (idx !== -1) interactiveMeshes.splice(idx, 1);
    }
  }
  const registeredMeshes = [];
  dishesGroup.userData = dishesGroup.userData || {};
  dishesGroup.userData._registeredDishMeshes = registeredMeshes;

  while (dishesGroup.children.length > 0) {
    dishesGroup.remove(dishesGroup.children[0]);
  }
  if (!servedDishes || servedDishes.length === 0) return;

  const isSakana = businessId === "business-sakana-tei";
  const isOsteria = businessId === "business-osteria-bellavista";

  const totalSeats = Math.max(1, Number(seatCount) || 2);
  const totalDishQty = servedDishes.reduce((sum, d) => sum + (Number(d?.qty) || 1), 0);
  const inferredPartySize =
    Number(partySize) > 0
      ? Number(partySize)
      : Number(servedDishes[0]?.partySize) > 0
      ? Number(servedDishes[0].partySize)
      : totalDishQty > 0
      ? totalDishQty
      : totalSeats;

  // Only place settings at occupied seats 0 .. activeSeats - 1
  const activeSeats = Math.max(1, Math.min(totalSeats, inferredPartySize));
  const placeRadius = Math.max(0.22, Math.min(tableWidth, tableDepth) * 0.33);

  // Expand servedDishes by quantity so each guest seat gets its corresponding course instance
  const expandedDishes = [];
  servedDishes.forEach((d) => {
    const count = Math.max(1, Number(d?.qty) || 1);
    for (let q = 0; q < count; q++) {
      expandedDishes.push({ ...d, _seatCopyIndex: q });
    }
  });

  const silverMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.18 });
  const wineMat = new THREE.MeshStandardMaterial({
    color: isSakana ? 0xd1fae5 : isOsteria ? 0x7f1d1d : 0x881337,
    transparent: true,
    opacity: 0.86,
    roughness: 0.12,
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.48,
    roughness: 0.08,
  });

  for (let ci = 0; ci < activeSeats; ci++) {
    // Match exact chair and seated guest angle: (ci / totalSeats) * Math.PI * 2
    const angle = (ci / totalSeats) * Math.PI * 2;
    const dishData = expandedDishes[ci % expandedDishes.length] || servedDishes[ci % servedDishes.length] || servedDishes[0];

    const settingGroup = new THREE.Group();
    settingGroup.position.set(Math.cos(angle) * placeRadius, 0.772, Math.sin(angle) * placeRadius);
    // Rotate place setting so the plate faces the guest sitting at `angle`
    settingGroup.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));

    const dishModel = buildPlatedDishForTable(dishData, businessId);
    settingGroup.add(dishModel);

    // Silver Fork (left) & Knife / Chopsticks (right)
    if (isSakana) {
      const chopstick = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.008, 0.012),
        new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.4 })
      );
      chopstick.position.set(0, 0.008, 0.1);
      settingGroup.add(chopstick);
    } else {
      const fork = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.15), silverMat);
      fork.position.set(-0.15, 0.006, 0);
      settingGroup.add(fork);

      const knife = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.16), silverMat);
      knife.position.set(0.15, 0.006, 0);
      settingGroup.add(knife);
    }

    // Stemmed Wine Glass or Sake Ochoko Cup to the top-right of the plate
    const glassGroup = new THREE.Group();
    glassGroup.position.set(0.13, 0, -0.1);
    if (isSakana) {
      const ochoko = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.02, 0.048, 12),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25 })
      );
      ochoko.position.y = 0.024;
      glassGroup.add(ochoko);
    } else {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.005, 10), crystalMat);
      base.position.y = 0.003;
      glassGroup.add(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.055, 8), crystalMat);
      stem.position.y = 0.03;
      glassGroup.add(stem);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.018, 0.055, 12), crystalMat);
      bowl.position.y = 0.075;
      glassGroup.add(bowl);
      const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.016, 0.032, 10), wineMat);
      wine.position.y = 0.068;
      glassGroup.add(wine);
    }
    settingGroup.add(glassGroup);

    // Attach clickable provenance userData to every mesh in this guest's place setting
    const dishName = dishData?.dishName || dishData?.name || "Plat du Chef";
    const dishInstanceId =
      dishData?.dishInstanceId ||
      dishData?.id ||
      `${dishData?.orderId || "order"}-${dishData?.dishId || "dish"}-seat-${ci + 1}`;
    const dishMeta = {
      sceneObjectId: dishInstanceId,
      dishInstanceId,
      orderId: dishData?.orderId || null,
      tableId: dishData?.tableId || null,
      seatIndex: ci,
      seatNumber: ci + 1,
      activeSeats,
      seatCount: totalSeats,
      dishId: dishData?.dishId || null,
      dishName,
      category: dishData?.category || "main",
      cookedBy: dishData?.cookedBy || dishData?.preparedBy || null,
      servedBy: dishData?.servedBy || null,
      servedAt: dishData?.servedAt || null,
      ingredientUnits: dishData?.ingredientUnits || dishData?.ingredients || [],
      originProvenance: dishData?.originProvenance || dishData?.provenance || null,
      label: `🍽️ ${dishName} (Couvert #${ci + 1}/${activeSeats}) — Cliquer pour tracer l'origine`,
      objectType: "plated_dish",
      businessId,
      domainEntityType: "plated_dish",
      domainEntityId: dishInstanceId,
    };

    settingGroup.userData = { ...dishMeta };
    settingGroup.traverse((child) => {
      if (child.isMesh) {
        child.userData = { ...dishMeta };
        if (Array.isArray(interactiveMeshes)) {
          interactiveMeshes.push(child);
          registeredMeshes.push(child);
        }
      }
    });

    dishesGroup.add(settingGroup);
  }
}
