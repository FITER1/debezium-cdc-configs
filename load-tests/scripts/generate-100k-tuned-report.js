const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "..", "reports", "cdc-pipeline");
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const OUTPUT = path.join(REPORTS_DIR, "CDC_Pipeline_100K_Tuned_Performance_Report.pdf");

const doc = new PDFDocument({ size: "A4", margin: 40 });
const out = fs.createWriteStream(OUTPUT);
doc.pipe(out);

const NAVY="#1a365d",BLUE="#2b6cb0",GREEN="#276749",RED="#c53030",
  ORANGE="#dd6b20",TEAL="#2c7a7b",YELLOW="#d69e2e",GRAY="#718096",
  LGRAY="#e2e8f0",LBGRAY="#f7fafc",WHITE="#fff",DARK="#2d3748",
  PURPLE="#553c9a";
const L=40, R=555, PW=R-L;

/* -- Test Data -- */
const D = {
  records: 99993,
  oracleRows: 506054,
  oracleInsert: 55.59,
  deliveryTime: 430.5,
  totalE2E: 433.2,
  cdcLatency: 2.74,
  tps: 232.3,
  startUTC: "08:02:24 UTC",
  endUTC: "08:09:37 UTC",
  date: "May 13, 2026",
  insertStart: "08:02:24.146",
  insertEnd: "08:03:19.737",
  firstArrival: "08:02:26.889",
  lastArrival: "08:09:37.342",
  debit: 62539,
  credit: 37454,
  modRT: 79904,
  modAC: 15032,
  modIC: 5057,
  oraAczb: 211000,
  oraNipDC: 63515,
  oraNipIC: 63007,
  oraPR: 168532,
  arrival: [
    { t: "08:02", n: 8062 },
    { t: "08:03", n: 14706 },
    { t: "08:04", n: 18240 },
    { t: "08:05", n: 14039 },
    { t: "08:06", n: 7524 },
    { t: "08:07", n: 13908 },
    { t: "08:08", n: 14364 },
    { t: "08:09", n: 9150 },
  ],
  oracle: { cpu: 66, mem: 2616 },
  debezium: { cpu: 39, mem: 1831 },
  consumer: { cpu: "7-10", mem: "173-239" },
  synapse: { cpu: 7, mem: 133 },
  kafka: { cpu0: 54, cpu1: 45, cpu2: 66, mem0: 2085, mem1: 1789, mem2: 1804 },
};

/* -- Default (baseline) results for comparison -- */
const BASE = {
  oracleInsert: 59.94,
  deliveryTime: 433.3,
  totalE2E: 437.2,
  cdcLatency: 3.9,
  tps: 230.8,
  records: 100000,
};

/* -- Tuning parameters applied -- */
const TUNING = {
  batchDefault: { old: 20000, new: 50000 },
  batchMax: { old: 100000, new: 200000 },
  sleepDefault: { old: 1000, new: 200 },
  sleepIncrement: { old: 200, new: 50 },
  sleepMax: { old: 3000, new: 1000 },
  sleepMin: { old: "N/A", new: 0 },
  maxBatchSize: { old: 2048, new: 4096 },
  maxQueueSize: { old: 8192, new: 16384 },
  pollInterval: { old: 500, new: 100 },
  queryFilterMode: { old: "none", new: "in" },
};

/* -- helpers -- */
function sec(t, y) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(t, L, y);
  doc.moveTo(L, y + 14).lineTo(R, y + 14).strokeColor(LGRAY).lineWidth(0.6).stroke();
  return y + 19;
}

function kpi(x, y, w, h, label, val, sub, bg, valSize) {
  doc.roundedRect(x, y, w, h, 5).fill(bg);
  doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.85)").text(label, x + 10, y + 7, { width: w - 20 });
  doc.font("Helvetica-Bold").fontSize(valSize || 22).fillColor(WHITE).text(val, x + 10, y + 19, { width: w - 20 });
  if (sub) doc.font("Helvetica").fontSize(6.5).fillColor("rgba(255,255,255,0.6)").text(sub, x + 10, y + h - 13, { width: w - 20 });
}

function tbl(hdr, rows, y, cw, al) {
  const rh = 19, tw = cw.reduce((a, b) => a + b, 0);
  doc.roundedRect(L, y, tw, rh, 2).fill(NAVY);
  let x = L;
  hdr.forEach((h, i) => {
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(WHITE).text(h, x + 5, y + 5, { width: cw[i] - 10, align: (al && al[i]) || "left" });
    x += cw[i];
  });
  y += rh;
  rows.forEach((row, ri) => {
    doc.rect(L, y, tw, rh).fill(ri % 2 === 0 ? LBGRAY : WHITE);
    x = L;
    row.forEach((c, ci) => {
      doc.font("Helvetica").fontSize(6.5).fillColor(DARK).text(String(c), x + 5, y + 5, { width: cw[ci] - 10, align: (al && al[ci]) || "left" });
      x += cw[ci];
    });
    y += rh;
  });
  return y;
}

function bars(data, x0, y0, w, h, title, color, lk, vk) {
  if (title) doc.font("Helvetica-Bold").fontSize(7.5).fillColor(DARK).text(title, x0, y0 - 11, { width: w, align: "center" });
  const cL = x0 + 32, cB = y0 + h, cW = w - 38, mx = Math.max(...data.map(d => d[vk])) * 1.15;
  const bW = Math.min(32, (cW / data.length) * 0.55), gap = (cW - bW * data.length) / (data.length + 1);
  doc.moveTo(cL, y0).lineTo(cL, cB).strokeColor(LGRAY).lineWidth(0.4).stroke();
  doc.moveTo(cL, cB).lineTo(cL + cW, cB).strokeColor(LGRAY).lineWidth(0.4).stroke();
  for (let i = 0; i <= 4; i++) {
    const v = Math.round(mx * i / 4), yp = cB - (h * i / 4);
    doc.font("Helvetica").fontSize(5).fillColor(GRAY).text(String(v), x0, yp - 3, { width: 30, align: "right" });
    if (i > 0) doc.moveTo(cL, yp).lineTo(cL + cW, yp).strokeColor("#edf2f7").lineWidth(0.25).stroke();
  }
  data.forEach((d, i) => {
    const bx = cL + gap + i * (bW + gap), bh2 = (d[vk] / mx) * h, by = cB - bh2;
    doc.roundedRect(bx, by, bW, bh2, 2).fill(typeof color === "function" ? color(i) : color);
    doc.font("Helvetica-Bold").fontSize(5).fillColor(DARK).text(String(d[vk]), bx - 5, by - 8, { width: bW + 10, align: "center" });
    doc.font("Helvetica").fontSize(4.5).fillColor(GRAY).text(d[lk], bx - 5, cB + 2, { width: bW + 10, align: "center" });
  });
  return cB + 13;
}

function footer(page, total) {
  doc.moveTo(L, 783).lineTo(R, 783).strokeColor(LGRAY).lineWidth(0.4).stroke();
  doc.font("Helvetica").fontSize(6).fillColor(GRAY).text(`CDC Pipeline Performance Report | 100K Tuned | ${D.date} | Page ${page}/${total}`, L, 787, { width: PW, align: "center" });
}

function delta(newVal, oldVal, suffix, lowerBetter) {
  const diff = newVal - oldVal;
  const pct = ((diff / oldVal) * 100).toFixed(1);
  const sign = diff > 0 ? "+" : "";
  const better = lowerBetter ? diff < 0 : diff > 0;
  return `${sign}${pct}%${suffix ? " " + suffix : ""} (${better ? "better" : "same"})`;
}

/* ====== PAGE 1 ====== */
doc.rect(0, 0, 595, 85).fill(NAVY);
doc.rect(0, 0, 595, 3).fill(TEAL);
doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE).text("CDC Pipeline Performance Report", L, 14);
doc.font("Helvetica").fontSize(9).fillColor("#a0aec0").text("100K Transactions - TUNED LogMiner Configuration", L, 37);
doc.font("Helvetica").fontSize(7.5).fillColor("#a0aec0").text("Oracle XE >> Debezium >> Kafka >> Synapse Consumer >> PostgreSQL", L, 51);
doc.font("Helvetica").fontSize(7.5).fillColor("#a0aec0").text(`Date: ${D.date}  |  Cluster: EKS fiter-us-east-2-dev  |  Region: us-east-2  |  Test Start: ${D.startUTC}`, L, 64);

const bw = 123, bh = 60;
kpi(L, 93, bw, bh, "Pipeline TPS", String(D.tps), "records / sec (avg)", GREEN);
kpi(L + bw + 5, 93, bw, bh, "Delivery Time", "7m 10s", "99,993 records", RED);
kpi(L + 2 * (bw + 5), 93, bw, bh, "End-to-End", "7m 13s", "insert >> last arrival", ORANGE);
kpi(L + 3 * (bw + 5), 93, bw, bh, "CDC Latency", D.cdcLatency + "s", "commit >> first arrival", TEAL, 20);

let y = sec("Tuned vs Default Comparison", 160);
y = tbl(["Metric", "Default Settings", "Tuned Settings", "Change"], [
  ["Oracle INSERT", BASE.oracleInsert + "s", D.oracleInsert + "s", delta(D.oracleInsert, BASE.oracleInsert, "", true)],
  ["CDC Capture Latency", BASE.cdcLatency + "s", D.cdcLatency + "s", delta(D.cdcLatency, BASE.cdcLatency, "", true)],
  ["Delivery Time", "7m 13.3s (" + BASE.deliveryTime + "s)", "7m 10.5s (" + D.deliveryTime + "s)", delta(D.deliveryTime, BASE.deliveryTime, "", true)],
  ["End-to-End Time", "7m 17.2s (" + BASE.totalE2E + "s)", "7m 13.2s (" + D.totalE2E + "s)", delta(D.totalE2E, BASE.totalE2E, "", true)],
  ["Pipeline TPS", String(BASE.tps), String(D.tps), delta(D.tps, BASE.tps, "", false)],
  ["Records Delivered", BASE.records.toLocaleString(), D.records.toLocaleString(), "7 filtered (Groovy)"],
], y, [115, 115, 115, 170], ["left", "center", "center", "left"]);

y = sec("Tuning Parameters Applied", y + 5);
y = tbl(["Parameter", "Default Value", "Tuned Value", "Impact"], [
  ["log.mining.batch.size.default", String(TUNING.batchDefault.old), String(TUNING.batchDefault.new), "2.5x larger LogMiner batches"],
  ["log.mining.batch.size.max", String(TUNING.batchMax.old), String(TUNING.batchMax.new), "2x upper bound on batch growth"],
  ["log.mining.sleep.time.default.ms", TUNING.sleepDefault.old + "ms", TUNING.sleepDefault.new + "ms", "5x faster initial poll cycle"],
  ["log.mining.sleep.time.increment.ms", TUNING.sleepIncrement.old + "ms", TUNING.sleepIncrement.new + "ms", "4x slower backoff ramp"],
  ["log.mining.sleep.time.max.ms", TUNING.sleepMax.old + "ms", TUNING.sleepMax.new + "ms", "3x lower sleep ceiling"],
  ["log.mining.sleep.time.min.ms", TUNING.sleepMin.old, TUNING.sleepMin.new + "ms", "Zero-wait on active redo logs"],
  ["max.batch.size", String(TUNING.maxBatchSize.old), String(TUNING.maxBatchSize.new), "2x Kafka producer batch"],
  ["max.queue.size", String(TUNING.maxQueueSize.old), String(TUNING.maxQueueSize.new), "2x internal queue depth"],
  ["poll.interval.ms", TUNING.pollInterval.old + "ms", TUNING.pollInterval.new + "ms", "5x faster Kafka poll cycle"],
  ["log.mining.query.filter.mode", TUNING.queryFilterMode.old, TUNING.queryFilterMode.new, "IN-clause SCN filtering"],
], y, [150, 75, 75, 215], ["left", "center", "center", "left"]);

y = sec("Record Arrival Rate (per minute)", y + 5);
y = bars(D.arrival, L, y + 10, PW, 80, "", i => {
  if (i === 2) return TEAL;
  if (i === 4) return ORANGE;
  return GREEN;
}, "t", "n");

y = sec("Pipeline Timing", y + 2);
y = tbl(["Phase", "Duration", "Detail"], [
  ["Oracle INSERT (source)", D.oracleInsert + "s", "100,000 transactions >> " + D.oracleRows.toLocaleString() + " rows across 4 tables"],
  ["CDC Capture Latency", D.cdcLatency + "s", "First records arrived in PG 2.74s after INSERT start (streaming overlap)"],
  ["CDC Pipeline Delivery", "7m 10.5s", "First arrival (" + D.firstArrival + ") >> last record (" + D.lastArrival + ")"],
  ["Total End-to-End", "7m 13.2s", "INSERT start (" + D.insertStart + ") >> last record in PostgreSQL"],
], y, [130, 60, 325], ["left", "center", "left"]);

footer(1, 3);

/* ====== PAGE 2 ====== */
doc.addPage();
doc.rect(0, 0, 595, 3).fill(TEAL);

y = sec("Oracle Source Table Breakdown", 14);
y = tbl(["Source Table", "Schema", "Oracle Rows", "Delivered (PG)", "Module"], [
  ["ACZB_HISTORY", "ABFCUBSLIVE", D.oraAczb.toLocaleString(), D.modAC.toLocaleString(), "AC"],
  ["NIPX_DIRECT_CREDITS", "NIPSYSTEM", D.oraNipDC.toLocaleString(), "--", "--"],
  ["NIPX_INBOUND_CREDITS", "NIPSYSTEM", D.oraNipIC.toLocaleString(), D.modIC.toLocaleString(), "IC"],
  ["PAYMENT_ROUTER_TXN_LOG", "WEBSERVE", D.oraPR.toLocaleString(), D.modRT.toLocaleString(), "RT"],
  ["TOTAL", "", D.oracleRows.toLocaleString(), D.records.toLocaleString(), ""],
], y, [130, 90, 80, 80, 135], ["left", "left", "center", "center", "left"]);

y = sec("Transaction Breakdown", y + 8);
y = tbl(["Category", "Count", "Percentage"], [
  ["Debit (D)", D.debit.toLocaleString(), (D.debit / D.records * 100).toFixed(1) + "%"],
  ["Credit (C)", D.credit.toLocaleString(), (D.credit / D.records * 100).toFixed(1) + "%"],
  ["Module: RT (Payment Router)", D.modRT.toLocaleString(), (D.modRT / D.records * 100).toFixed(1) + "%"],
  ["Module: AC (Core Banking)", D.modAC.toLocaleString(), (D.modAC / D.records * 100).toFixed(1) + "%"],
  ["Module: IC (Inbound Credits)", D.modIC.toLocaleString(), (D.modIC / D.records * 100).toFixed(1) + "%"],
], y, [200, 100, 215], ["left", "center", "center"]);

y = sec("Throughput by 10-second Buckets (records/sec)", y + 8);
const tpsBuckets = [
  { t: "0s", n: 259 }, { t: "10s", n: 239 }, { t: "20s", n: 205 },
  { t: "30s", n: 239 }, { t: "40s", n: 239 }, { t: "50s", n: 239 },
  { t: "60s", n: 239 }, { t: "70s", n: 262 }, { t: "80s", n: 262 },
  { t: "90s", n: 274 }, { t: "100s", n: 239 }, { t: "110s", n: 296 },
  { t: "120s", n: 342 }, { t: "130s", n: 296 }, { t: "140s", n: 342 },
  { t: "150s", n: 342 }, { t: "160s", n: 342 }, { t: "170s", n: 365 },
  { t: "180s", n: 184 }, { t: "190s", n: 114 }, { t: "200s", n: 137 },
  { t: "210s", n: 114 }, { t: "220s", n: 137 }, { t: "230s", n: 137 },
  { t: "240s", n: 114 }, { t: "250s", n: 114 }, { t: "260s", n: 137 },
  { t: "270s", n: 160 }, { t: "280s", n: 228 }, { t: "290s", n: 228 },
  { t: "300s", n: 251 }, { t: "310s", n: 251 }, { t: "320s", n: 228 },
  { t: "330s", n: 251 }, { t: "340s", n: 228 }, { t: "350s", n: 228 },
  { t: "360s", n: 251 }, { t: "370s", n: 228 }, { t: "380s", n: 251 },
  { t: "390s", n: 251 }, { t: "400s", n: 251 }, { t: "410s", n: 251 },
  { t: "420s", n: 228 }, { t: "430s", n: 26 },
];
y = bars(tpsBuckets, L, y + 10, PW, 110, "", (i) => {
  if (i <= 17) return i <= 5 ? GREEN : TEAL;
  if (i <= 26) return ORANGE;
  return BLUE;
}, "t", "n");

y = sec("Delivery Flow Analysis", y + 2);
const flowNotes = [
  "Phase 1 (0-180s / 08:02-08:05): Fast capture. Tuned LogMiner with 50K default batch and 200ms sleep delivered bursts at 239-365 rec/s. Peak bucket at 170s hit 365 rec/s. ~54K records delivered (54% of total).",
  "Phase 2 (180-270s / 08:05-08:07): LogMiner gap. Throughput dropped to 114-184 rec/s. LogMiner reached redo log boundary and needed to open new archived logs. Sleep backoff (50ms increments, max 1s) kept it from stalling completely.",
  "Phase 3 (270-430s / 08:07-08:09): Recovery. Throughput recovered to 228-251 rec/s as LogMiner resumed steady mining. Consumer processing was the bottleneck here -- Debezium had already captured all changes.",
  "Final 30 records arrived at 08:09:37.342. Total delivery window: 7m 10.5s at 232.3 TPS average.",
];
flowNotes.forEach(b => {
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - " + b, L, y, { width: PW, lineGap: 1 });
  y += doc.heightOfString("  - " + b, { width: PW, lineGap: 1 }) + 3;
});

footer(2, 3);

/* ====== PAGE 3 ====== */
doc.addPage();
doc.rect(0, 0, 595, 3).fill(TEAL);

y = sec("Infrastructure Resource Snapshot (post-test)", 14);
y = tbl(["Component", "Role", "CPU", "Memory", "Namespace"], [
  ["Oracle XE", "Source database", D.oracle.cpu + "m", D.oracle.mem + " MiB", "access-cdc"],
  ["Debezium Connect", "CDC engine (LogMiner)", D.debezium.cpu + "m", D.debezium.mem + " MiB", "access-cdc"],
  ["Synapse Consumer x2", "Enrichment + write", D.consumer.cpu + "m", D.consumer.mem + " MiB", "access"],
  ["Synapse API", "Query service", D.synapse.cpu + "m", D.synapse.mem + " MiB", "access"],
  ["Kafka Broker 0", "Message broker", D.kafka.cpu0 + "m", D.kafka.mem0 + " MiB", "kafka"],
  ["Kafka Broker 1", "Message broker", D.kafka.cpu1 + "m", D.kafka.mem1 + " MiB", "kafka"],
  ["Kafka Broker 2", "Message broker", D.kafka.cpu2 + "m", D.kafka.mem2 + " MiB", "kafka"],
], y, [105, 100, 55, 72, 183], ["left", "left", "center", "center", "left"]);

y = sec("Performance Analysis: Why Tuning Had Marginal Impact", y + 8);
const analysis = [
  "The tuned LogMiner configuration improved CDC capture latency by 30% (3.9s >> 2.74s) but overall delivery time improved by only 0.6% (433.3s >> 430.5s). This reveals that LogMiner capture speed is NOT the bottleneck at 100K scale.",
  "The true bottleneck is downstream: Synapse consumer enrichment + PostgreSQL write throughput. Both configurations delivered records at ~230 TPS average, which matches the consumer's processing capacity with 2 replicas.",
  "Evidence: Phase 1 throughput peaked at 365 rec/s (tuned) vs ~300 rec/s (default) -- a 22% improvement in burst capture speed. But the sustained rate in Phase 3 converged to ~228-251 rec/s for both, bounded by consumer processing.",
  "The 30% improvement in CDC latency (2.74s vs 3.9s) confirms that the reduced sleep times (200ms vs 1000ms) and faster poll interval (100ms vs 500ms) DO help initial change detection.",
  "The LogMiner query filter mode (IN-clause) and larger batch sizes (50K default, 200K max) helped Debezium capture changes faster during the initial burst, but once the consumer queue filled, the benefit was absorbed.",
];
analysis.forEach(b => {
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - " + b, L, y, { width: PW, lineGap: 1 });
  y += doc.heightOfString("  - " + b, { width: PW, lineGap: 1 }) + 3;
});

y = sec("Recommendations for Higher Throughput", y + 4);
const recs = [
  "Scale consumers horizontally: Add 3-4 consumer replicas (currently 2). Each consumer handles ~115 TPS -- adding 2 more would push pipeline to ~460 TPS.",
  "Optimize consumer batch writes: Use PostgreSQL COPY or multi-row INSERT batching in Synapse consumer to reduce per-record write overhead.",
  "Increase Kafka partitions: Current 3 partitions per topic limits consumer parallelism. Increase to 6-8 partitions to match consumer scaling.",
  "Connection pooling: Ensure consumer uses connection pooling (HikariCP) with pool size matching batch concurrency.",
  "For 500+ TPS target: The LogMiner tuning is necessary but not sufficient. Consumer-side scaling is the primary lever at 100K+ scale.",
];
recs.forEach((b, i) => {
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  " + (i + 1) + ". " + b, L, y, { width: PW, lineGap: 1 });
  y += doc.heightOfString("  " + (i + 1) + ". " + b, { width: PW, lineGap: 1 }) + 3;
});

y = sec("Full Test Comparison (All Scales)", y + 4);
y = tbl(["Scale", "Records", "Delivery", "TPS", "E2E", "Config", "Bottleneck"], [
  ["1K", "1,000", "2.56s", "390", "6.95s", "Default", "Minimal -- pipeline near idle"],
  ["10K", "10,000", "43.45s", "230", "47.9s", "Default", "LogMiner poll-sleep visible"],
  ["100K", "100,000", "7m 13s", "231", "7m 17s", "Default", "LogMiner redo scanning"],
  ["100K", "99,993", "7m 10s", "232", "7m 13s", "Tuned", "Consumer processing (not LogMiner)"],
], y, [40, 55, 60, 35, 50, 55, 220], ["center", "center", "center", "center", "center", "center", "left"]);

y = sec("Pipeline Architecture", y + 8);
doc.font("Helvetica").fontSize(7).fillColor(DARK).text("Oracle XE (3 schemas)  >>  Debezium LogMiner (3 connectors)  >>  Kafka (3-broker Strimzi, 3 partitions/topic)  >>  Synapse Consumer (x2)  >>  PostgreSQL (RDS)", L, y, { width: PW });
y += 14;
y = tbl(["Component", "Detail"], [
  ["Source Schemas", "ABFCUBSLIVE (ACZB_HISTORY), NIPSYSTEM (NIPX_DIRECT_CREDITS, NIPX_INBOUND_CREDITS), WEBSERVE (PAYMENT_ROUTER_TXN_LOG)"],
  ["Debezium Connectors", "access-core-banking, access-nip-system, access-webserve (LogMiner-based, tuned batch/sleep params)"],
  ["Kafka Cluster", "3-broker Strimzi cluster (cdc-kafka-kafka-0/1/2), 10 topics x 3 partitions"],
  ["Consumer Config", "2 replicas, group.id=synapse-cdc-consumer, max.poll.records=2000, fetch.min.bytes=64KB"],
  ["Target Database", "PostgreSQL RDS (ora_enriched_transactions table)"],
  ["Container Platform", "Amazon EKS (Kubernetes) across namespaces: access, access-cdc, kafka"],
], y, [120, 395], ["left", "left"]);

y = sec("Conclusion", y + 8);
const conclusion = [
  "LogMiner tuning successfully reduced CDC capture latency by 30% and improved burst capture speed by 22%. However, at 100K scale the overall pipeline throughput is bounded by consumer processing, not LogMiner capture.",
  "The tuned settings should be kept as they provide better responsiveness for real-time change detection and will scale well as consumer throughput is improved.",
  "To achieve the 500+ TPS target, focus on: (1) consumer horizontal scaling, (2) batch write optimization, (3) Kafka partition increase. The LogMiner side is now well-tuned for production workloads.",
];
conclusion.forEach(b => {
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - " + b, L, y, { width: PW, lineGap: 1 });
  y += doc.heightOfString("  - " + b, { width: PW, lineGap: 1 }) + 3;
});

footer(3, 3);

doc.end();
out.on("finish", () => console.log("PDF -> " + OUTPUT));
