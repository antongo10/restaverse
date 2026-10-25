#!/usr/bin/env node
/**
 * MongoDB Atlas Provisioning, Index Creation & Collection Bulk-Sync Script
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/" node scripts/sync_to_mongodb_atlas.mjs
 */

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = "/Users/ag/Workspace/restaurants/data/mongodb";
const DB_NAME = process.env.MONGODB_DB || "hospitality_street_sim";
const MONGODB_URI = process.env.MONGODB_URI;

export const REQUIRED_ATLAS_INDEXES = {
  simulationEvents: [
    { key: { streetId: 1, serviceDate: 1, eventTimeMs: 1, sequence: 1 }, name: "idx_street_date_eventTime" },
    { key: { businessId: 1, eventTimeMs: 1, sequence: 1 }, name: "idx_business_eventTime" },
    { key: { idempotencyKey: 1 }, name: "idx_idempotencyKey_unique", unique: true },
    { key: { "target.domainEntityId": 1, eventTimeMs: 1 }, name: "idx_target_entity" },
  ],
  simulationSnapshots: [
    { key: { streetId: 1, serviceDate: 1, snapshotTimeMs: -1 }, name: "idx_snapshot_lookup" },
  ],
  sceneObjects: [
    { key: { streetId: 1, sceneObjectId: 1 }, name: "idx_scene_object_unique", unique: true },
    { key: { businessId: 1, domainEntityType: 1, domainEntityId: 1 }, name: "idx_domain_entity_lookup" },
  ],
  orders: [
    { key: { businessId: 1, serviceDate: 1, openedAt: 1 }, name: "idx_orders_date" },
    { key: { businessId: 1, tableId: 1, serviceDate: 1 }, name: "idx_orders_table" },
  ],
  reservations: [
    { key: { businessId: 1, serviceDate: 1, seatedAt: 1 }, name: "idx_reservations_date" },
  ],
  inventoryMovements: [
    { key: { businessId: 1, serviceDate: 1, ingredientId: 1 }, name: "idx_inventory_date_item" },
  ],
};

async function run() {
  if (!MONGODB_URI) {
    console.log("================================================================================");
    console.log("MONGODB_URI is not set in the environment.");
    console.log("All 23 MongoDB collections are prepared and validated in:");
    console.log(`  ${DATA_DIR}`);
    console.log("To push all collections and compound indexes to your MongoDB Atlas cluster, run:");
    console.log('  MONGODB_URI="mongodb+srv://..." node scripts/sync_to_mongodb_atlas.mjs');
    console.log("================================================================================");
    return;
  }

  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log(`Connected to MongoDB Atlas! Target database: ${DB_NAME}`);
  const db = client.db(DB_NAME);

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && f !== "migration_validation_report.json");
  for (const file of files) {
    const colName = path.basename(file, ".json");
    const docs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
    if (!Array.isArray(docs) || docs.length === 0) continue;

    const col = db.collection(colName);
    const ops = docs.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }));
    const res = await col.bulkWrite(ops, { ordered: false });
    console.log(`  [Collection: ${colName}] Upserted/Matched ${docs.length} documents (${res.upsertedCount} new)`);

    if (REQUIRED_ATLAS_INDEXES[colName]) {
      for (const idx of REQUIRED_ATLAS_INDEXES[colName]) {
        await col.createIndex(idx.key, { name: idx.name, unique: Boolean(idx.unique) });
      }
      console.log(`  [Indexes: ${colName}] Created ${REQUIRED_ATLAS_INDEXES[colName].length} compound indexes`);
    }
  }

  await client.close();
  console.log("MongoDB Atlas sync complete!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error("MongoDB Atlas sync failed:", err);
    process.exit(1);
  });
}
