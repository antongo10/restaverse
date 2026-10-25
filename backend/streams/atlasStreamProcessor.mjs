/**
 * MongoDB Atlas Stream Processing (ASP) Topology & Runtime Windowed Processor
 *
 * Implements the continuous event-stream processing specification (Section 3 & 14):
 * - Validates incoming operational events (`eventTime`, `idempotencyKey`, `businessId`, `streetId`)
 * - Routes events by `businessType` (`restaurant`, `pizza_takeaway`, `cafe`)
 * - Computes 15-minute tumbling-window operational KPIs (`streamVenueMetrics`)
 * - Detects low-stock & waste anomalies (`streamOperationalAlerts`)
 */

export function getAtlasStreamProcessorDefinition(connectionName = "atlasCluster0", dbName = "hospitality_street_sim") {
  return {
    processorName: "hospitalityStreetEventProcessor",
    description: "Validates, routes, and aggregates multi-venue hospitality simulation events on MongoDB Atlas Stream Processing",
    pipelines: {
      eventValidationAndPersistence: [
        {
          $source: {
            connectionName,
            db: dbName,
            coll: "simulationEventsIngest",
            timeField: { $dateFromString: { dateString: "$eventTime" } },
          },
        },
        {
          $match: {
            streetId: { $exists: true },
            businessId: { $exists: true },
            eventType: { $exists: true },
            idempotencyKey: { $exists: true },
          },
        },
        {
          $addFields: {
            processingTime: "$$NOW",
            streamValidated: true,
          },
        },
        {
          $merge: {
            into: {
              connectionName,
              db: dbName,
              coll: "simulationEvents",
            },
            on: ["idempotencyKey"],
            whenMatched: "keepExisting",
            whenNotMatched: "insert",
          },
        },
      ],
      tumblingWindowVenueMetrics: [
        {
          $source: {
            connectionName,
            db: dbName,
            coll: "simulationEvents",
            timeField: { $dateFromString: { dateString: "$eventTime" } },
          },
        },
        {
          $tumblingWindow: {
            interval: { size: 15, unit: "minute" },
            pipeline: [
              {
                $group: {
                  _id: {
                    streetId: "$streetId",
                    businessId: "$businessId",
                    businessType: "$businessType",
                  },
                  eventCount: { $sum: 1 },
                  ordersCreated: {
                    $sum: {
                      $cond: [
                        { $in: ["$eventType", ["ORDER_CREATED", "TAKEAWAY_ORDER_QUEUED", "COUNTER_ORDER_PLACED"]] },
                        1,
                        0,
                      ],
                    },
                  },
                  revenueCents: {
                    $sum: {
                      $switch: {
                        branches: [
                          { case: { $eq: ["$eventType", "PAYMENT_COMPLETED"] }, then: { $ifNull: ["$payload.paidCents", 0] } },
                          { case: { $eq: ["$eventType", "TAKEAWAY_ORDER_COLLECTED"] }, then: { $ifNull: ["$payload.totalCents", 0] } },
                          { case: { $eq: ["$eventType", "COUNTER_ORDER_PLACED"] }, then: { $ifNull: ["$payload.totalCents", 0] } },
                        ],
                        default: 0,
                      },
                    },
                  },
                },
              },
            ],
          },
        },
        {
          $merge: {
            into: {
              connectionName,
              db: dbName,
              coll: "streamVenueMetrics",
            },
          },
        },
      ],
    },
  };
}

/**
 * Computes live tumbling-window stream metrics and operational alerts up to `timestampMs`
 * so the UI can inspect real-time Atlas Stream Processing outputs at any replay timestamp.
 */
export function computeStreamMetricsAt(eventsUpToT, timestampMs) {
  const windowSizeMs = 15 * 60 * 1000; // 15-minute tumbling window
  const currentWindowStart = Math.floor(timestampMs / windowSizeMs) * windowSizeMs;
  const recentHourStart = timestampMs - 60 * 60 * 1000;

  const byBusiness = {};
  const alerts = [];

  for (const ev of eventsUpToT) {
    const bid = ev.businessId;
    if (!byBusiness[bid]) {
      byBusiness[bid] = {
        businessId: bid,
        businessType: ev.businessType,
        cumulativeEvents: 0,
        windowEvents15m: 0,
        lastHourEvents: 0,
        windowRevenueCents15m: 0,
        lastHourRevenueCents: 0,
        eventBreakdown: {},
      };
    }
    const b = byBusiness[bid];
    b.cumulativeEvents += 1;
    b.eventBreakdown[ev.eventType] = (b.eventBreakdown[ev.eventType] || 0) + 1;

    const inWindow = ev.eventTimeMs >= currentWindowStart && ev.eventTimeMs <= timestampMs;
    const inHour = ev.eventTimeMs >= recentHourStart && ev.eventTimeMs <= timestampMs;

    let rev = 0;
    if (ev.eventType === "PAYMENT_COMPLETED") rev = Number(ev.payload?.paidCents || 0);
    else if (ev.eventType === "TAKEAWAY_ORDER_COLLECTED") rev = Number(ev.payload?.totalCents || 0);
    else if (ev.eventType === "COUNTER_ORDER_PLACED") rev = Number(ev.payload?.totalCents || 0);

    if (inWindow) {
      b.windowEvents15m += 1;
      b.windowRevenueCents15m += rev;
    }
    if (inHour) {
      b.lastHourEvents += 1;
      b.lastHourRevenueCents += rev;
    }

    if (ev.eventType === "DAILY_WASTE_RECORDED" || ev.eventType === "RESERVATION_NO_SHOW") {
      alerts.push({
        id: ev._id,
        eventTime: ev.eventTime,
        businessId: bid,
        severity: ev.eventType === "DAILY_WASTE_RECORDED" ? "warning" : "info",
        type: ev.eventType,
        summary:
          ev.eventType === "DAILY_WASTE_RECORDED"
            ? `End-of-day spoilage recorded: €${((ev.payload?.totalWasteCostCents || 0) / 100).toFixed(2)}`
            : `No-show reservation: ${ev.payload?.guestName || "Guest"} (${ev.payload?.partySize || 2}p)`,
      });
    }
  }

  return {
    windowStartIso: new Date(currentWindowStart).toISOString(),
    windowEndIso: new Date(currentWindowStart + windowSizeMs).toISOString(),
    byBusiness,
    alerts: alerts.slice(-10).reverse(),
  };
}
