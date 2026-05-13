const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "..", "reports", "cdc-pipeline");
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const OUTPUT = path.join(REPORTS_DIR, "CDC_Pipeline_100K_Performance_Report.pdf");

const doc = new PDFDocument({ size: "A4", margin: 40 });
const out = fs.createWriteStream(OUTPUT);
doc.pipe(out);

const NAVY="#1a365d",BLUE="#2b6cb0",GREEN="#276749",RED="#c53030",
  ORANGE="#dd6b20",TEAL="#2c7a7b",YELLOW="#d69e2e",GRAY="#718096",
  LGRAY="#e2e8f0",LBGRAY="#f7fafc",WHITE="#fff",DARK="#2d3748";
const L=40, R=555, PW=R-L;

const D = {
  records: 100000,
  oracleRows: 263733,
  oracleInsert: 59.94,
  deliveryTime: 433.3,
  totalE2E: 437.2,
  cdcLatency: 3.9,
  tps: 230.8,
  startUTC: "07:16:10 UTC",
  endUTC: "07:23:27 UTC",
  date: "May 13, 2026",
  insertStart: "07:16:10.456",
  insertEnd: "07:17:10.399",
  firstArrival: "07:16:14.370",
  lastArrival: "07:23:27.664",
  debit: 62595,
  credit: 37405,
  modRT: 79878,
  modAC: 15161,
  modIC: 4961,
  oraAczb: 110000,
  oraNipDC: 33065,
  oraNipIC: 32830,
  oraPR: 87838,
  // per-minute arrival buckets
  arrival: [
    { t: "07:16", n: 8555 },
    { t: "07:17", n: 13794 },
    { t: "07:18", n: 18012 },
    { t: "07:19", n: 14934 },
    { t: "07:20", n: 7752 },
    { t: "07:21", n: 15048 },
    { t: "07:22", n: 15048 },
    { t: "07:23", n: 6857 },
  ],
  // resource usage (post-test snapshot)
  oracle: { cpu: 46, mem: 2571 },
  debezium: { cpu: 13, mem: 1829 },
  consumer: { cpu: "7-7", mem: "161-234" },
  synapse: { cpu: 8, mem: 133 },
  kafka: { cpu0: 50, cpu1: 50, cpu2: 68, mem0: 2145, mem1: 1890, mem2: 1073 },
};

/* ── helpers ── */
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
  doc.font("Helvetica").fontSize(6).fillColor(GRAY).text(`CDC Pipeline Performance Report | 100K Transactions | ${D.date} | Page ${page}/${total}`, L, 787, { width: PW, align: "center" });
}

/* ====== PAGE 1 ====== */
doc.rect(0, 0, 595, 85).fill(NAVY);
doc.rect(0, 0, 595, 3).fill(GREEN);
doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE).text("CDC Pipeline Performance Report", L, 18);
doc.font("Helvetica").fontSize(8.5).fillColor("#a0aec0").text("100,000 Transactions | Oracle XE >> Debezium >> Kafka >> Synapse Consumer >> PostgreSQL", L, 43);
doc.font("Helvetica").fontSize(7.5).fillColor("#a0aec0").text(`Date: ${D.date}  |  Cluster: EKS fiter-us-east-2-dev  |  Region: us-east-2  |  Test Start: ${D.startUTC}`, L, 58);

const bw = 123, bh = 60;
kpi(L, 93, bw, bh, "Pipeline TPS", String(D.tps), "records / sec", GREEN);
kpi(L + bw + 5, 93, bw, bh, "Delivery Time", "7m 13s", "100K records", RED);
kpi(L + 2 * (bw + 5), 93, bw, bh, "End-to-End", "7m 17s", "insert >> last arrival", ORANGE);
kpi(L + 3 * (bw + 5), 93, bw, bh, "CDC Latency", D.cdcLatency + "s", "commit >> first arrival", TEAL, 20);

let y = sec("Pipeline Timing", 160);
y = tbl(["Phase", "Duration", "Detail"], [
  ["Oracle INSERT (source)", D.oracleInsert + "s", "100,000 transactions >> " + D.oracleRows.toLocaleString() + " rows across 4 tables"],
  ["CDC Capture Latency", D.cdcLatency + "s", "First records arrived in PG while Oracle INSERT was still running (streaming overlap)"],
  ["CDC Pipeline Delivery", "7m 13.3s", "First arrival (" + D.firstArrival + ") >> last record lands in PG (" + D.lastArrival + ")"],
  ["Total End-to-End", "7m 17.2s", `INSERT start >> last record in PostgreSQL (${D.startUTC} >> ${D.endUTC})`],
], y, [130, 60, 325], ["left", "center", "left"]);

y = sec("Oracle Source Table Breakdown", y + 5);
y = tbl(["Source Table", "Schema", "Oracle Rows", "Delivered (PG)", "Module"], [
  ["ACZB_HISTORY", "ABFCUBSLIVE", D.oraAczb.toLocaleString(), D.modAC.toLocaleString(), "AC"],
  ["NIPX_DIRECT_CREDITS", "NIPSYSTEM", D.oraNipDC.toLocaleString(), "--", "--"],
  ["NIPX_INBOUND_CREDITS", "NIPSYSTEM", D.oraNipIC.toLocaleString(), D.modIC.toLocaleString(), "IC"],
  ["PAYMENT_ROUTER_TXN_LOG", "WEBSERVE", D.oraPR.toLocaleString(), D.modRT.toLocaleString(), "RT"],
  ["TOTAL", "", D.oracleRows.toLocaleString(), D.records.toLocaleString(), ""],
], y, [130, 90, 80, 80, 135], ["left", "left", "center", "center", "left"]);

y = sec("Record Arrival Rate (per minute)", y + 5);
y = bars(D.arrival, L, y + 10, PW, 85, "", i => {
  if (i === 2) return RED;      // peak minute
  if (i === 4) return ORANGE;   // dip (LogMiner slow phase)
  return GREEN;
}, "t", "n");

y = sec("Transaction Breakdown", y + 2);
y = tbl(["Category", "Count", "Percentage"], [
  ["Debit (D)", D.debit.toLocaleString(), (D.debit / D.records * 100).toFixed(1) + "%"],
  ["Credit (C)", D.credit.toLocaleString(), (D.credit / D.records * 100).toFixed(1) + "%"],
  ["Module: RT (Payment Router)", D.modRT.toLocaleString(), (D.modRT / D.records * 100).toFixed(1) + "%"],
  ["Module: AC (Core Banking)", D.modAC.toLocaleString(), (D.modAC / D.records * 100).toFixed(1) + "%"],
  ["Module: IC (Inbound Credits)", D.modIC.toLocaleString(), (D.modIC / D.records * 100).toFixed(1) + "%"],
], y, [200, 100, 215], ["left", "center", "center"]);
footer(1, 2);

/* ====== PAGE 2 ====== */
doc.addPage();
doc.rect(0, 0, 595, 3).fill(GREEN);

y = sec("Pipeline Architecture", 14);
doc.font("Helvetica").fontSize(7).fillColor(DARK).text("Oracle XE (3 schemas)  >>  Debezium LogMiner (3 connectors)  >>  Kafka (3-broker Strimzi, 3 partitions/topic)  >>  Synapse Consumer (x2)  >>  PostgreSQL (RDS)", L, y, { width: PW });
y += 14;
y = tbl(["Component", "Detail"], [
  ["Source Schemas", "ABFCUBSLIVE (ACZB_HISTORY), NIPSYSTEM (NIPX_DIRECT_CREDITS, NIPX_INBOUND_CREDITS), WEBSERVE (PAYMENT_ROUTER_TXN_LOG)"],
  ["Debezium Connectors", "access-core-banking, access-nip-system, access-webserve (LogMiner-based CDC)"],
  ["Kafka Cluster", "3-broker Strimzi cluster (cdc-kafka-kafka-0/1/2), 10 topics x 3 partitions"],
  ["Consumer Config", "2 replicas, group.id=synapse-cdc-consumer, max.poll.records=2000, fetch.min.bytes=64KB"],
  ["Target Database", "PostgreSQL RDS (ora_enriched_transactions table)"],
  ["Container Platform", "Amazon EKS (Kubernetes) across namespaces: access, access-cdc, kafka"],
], y, [120, 395], ["left", "left"]);

y = sec("Infrastructure Resource Snapshot (post-test)", y + 8);
y = tbl(["Component", "Role", "CPU", "Memory", "Namespace"], [
  ["Oracle XE", "Source database", D.oracle.cpu + "m", D.oracle.mem + " MiB", "access-cdc"],
  ["Debezium Connect", "CDC engine (LogMiner)", D.debezium.cpu + "m", D.debezium.mem + " MiB", "access-cdc"],
  ["Synapse Consumer x2", "Enrichment + write", D.consumer.cpu + "m", D.consumer.mem + " MiB", "access"],
  ["Synapse API", "Query service", D.synapse.cpu + "m", D.synapse.mem + " MiB", "access"],
  ["Kafka Broker 0", "Message broker", D.kafka.cpu0 + "m", D.kafka.mem0 + " MiB", "kafka"],
  ["Kafka Broker 1", "Message broker", D.kafka.cpu1 + "m", D.kafka.mem1 + " MiB", "kafka"],
  ["Kafka Broker 2", "Message broker", D.kafka.cpu2 + "m", D.kafka.mem2 + " MiB", "kafka"],
], y, [105, 100, 55, 72, 183], ["left", "left", "center", "center", "left"]);

y = sec("Delivery Flow Analysis", y + 8);
const flowNotes = [
  "Phase 1 (07:16-07:18): Initial burst. CDC streaming began 3.9s after INSERT start -- first records arrived while Oracle was still inserting. Peak minute (07:18) delivered 18,012 records.",
  "Phase 2 (07:18-07:20): Mixed rate. Delivery oscillated between fast bursts (1,800/5s) and LogMiner sleep cycles (680/5s). The dip at 07:20 (7,752 records) reflects LogMiner redo log scanning overhead.",
  "Phase 3 (07:20-07:23): Steady-state. Consistent delivery at ~1,368/5s with periodic bursts. LogMiner poll-sleep cycle dominated throughput at ~274 records/sec.",
  "Final records arrived at 07:23:27.664. Total delivery window 7m 13s at 230.8 TPS average.",
];
flowNotes.forEach(b => {
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - " + b, L, y, { width: PW, lineGap: 1 });
  y += doc.heightOfString("  - " + b, { width: PW, lineGap: 1 }) + 3;
});

y = sec("Performance Summary", y + 4);
const observations = [
  `Pipeline delivered 100,000 enriched transactions in 7m 17s end-to-end at ${D.tps} TPS average.`,
  `Oracle inserted ${D.oracleRows.toLocaleString()} source rows across 4 tables in ${D.oracleInsert}s. Debezium captured, filtered, and delivered 100,000 enriched records to PostgreSQL.`,
  `CDC capture latency was ${D.cdcLatency}s -- first PostgreSQL records arrived while Oracle INSERT was still running (streaming overlap with LogMiner).`,
  `${(D.oracleRows - D.records).toLocaleString()} Oracle rows (${((D.oracleRows - D.records) / D.oracleRows * 100).toFixed(1)}%) were filtered by Debezium Groovy predicates (account-scoped filtering). Only matching records were forwarded to Kafka.`,
  `Transaction mix: ${(D.debit / D.records * 100).toFixed(1)}% Debit, ${(D.credit / D.records * 100).toFixed(1)}% Credit. Payment Router (RT) accounted for ${(D.modRT / D.records * 100).toFixed(1)}% of delivered records.`,
  `Delivery rate showed two distinct phases: fast bursts (~360 rec/s) during initial redo log consumption, then steady-state (~137 rec/s) during LogMiner's poll-sleep cycle. Average throughput: ${D.tps} TPS.`,
  `At 100K scale, the LogMiner bottleneck is clearly visible -- delivery took 7+ minutes despite Oracle INSERT completing in 60s. XStream or Oracle Enterprise Edition would significantly reduce this gap.`,
];
observations.forEach(b => {
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - " + b, L, y, { width: PW, lineGap: 1 });
  y += doc.heightOfString("  - " + b, { width: PW, lineGap: 1 }) + 3;
});

y = sec("Comparison with Smaller Tests", y + 4);
y = tbl(["Scale", "Records", "Delivery Time", "TPS", "E2E Time", "Bottleneck"], [
  ["1K", "1,000", "3.46s", "289", "5.3s", "Minimal"],
  ["10K", "10,000", "43.45s", "230", "47.9s", "LogMiner poll-sleep visible"],
  ["100K", "100,000", "7m 13s", "231", "7m 17s", "LogMiner redo scanning dominates"],
], y, [50, 60, 80, 50, 65, 210], ["center", "center", "center", "center", "center", "left"]);

footer(2, 2);

doc.end();
out.on("finish", () => console.log("PDF -> " + OUTPUT));
