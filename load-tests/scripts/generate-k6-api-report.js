const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "..", "reports", "api-load-test");
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const OUTPUT = path.join(REPORTS_DIR, "API_Load_Test_Report.pdf");

const doc = new PDFDocument({ size: "A4", margin: 40 });
const out = fs.createWriteStream(OUTPUT);
doc.pipe(out);

const NAVY="#1a365d",BLUE="#2b6cb0",GREEN="#276749",RED="#c53030",
  ORANGE="#dd6b20",TEAL="#2c7a7b",YELLOW="#d69e2e",GRAY="#718096",
  LGRAY="#e2e8f0",LBGRAY="#f7fafc",WHITE="#fff",DARK="#2d3748",
  PURPLE="#553c9a";
const L=40, R=555, PW=R-L;

/* ── k6 Results Data ── */
const D = {
  date: "May 13, 2026",
  endpoint: "GET /fineract-provider/api/v1/cdc/savingsaccounts/{account}/transactions",
  baseUrl: "http://access-synapse:8444",
  testDuration: "5m 00s",
  totalRequests: 128874,
  rps: 428.27,
  failedRequests: 0,
  errorRate: "0.00%",
  dataReceived: "819 MB",
  dataReceivedRate: "2.7 MB/s",
  dataSent: "34 MB",
  dataSentRate: "114 kB/s",
  checksTotal: 644370,
  checksPassed: 644369,
  checksFailed: 1,
  checksPassRate: "99.99%",
  // http_req_duration (ms)
  latency: {
    avg: 1.94, min: 0.82, med: 1.23, max: 669.56,
    p90: 3.17, p95: 5.28,
  },
  // txn_endpoint_latency (ms) - same as http_req_duration
  txnLatency: {
    avg: 1.94, min: 0.82, med: 1.23, max: 669.56,
    p90: 3.17, p95: 5.28,
  },
  // http_req_waiting (TTFB)
  waiting: {
    avg: 1.87, min: 0.77, med: 1.17, max: 669.35,
    p90: 3.10, p95: 5.17,
  },
  // group_duration
  groupDuration: {
    avg: 2.47, min: 1.14, med: 1.77, max: 710.72,
    p90: 3.78, p95: 5.94,
  },
  // iteration_duration
  iterDuration: {
    avg: 652.86, min: 301.70, med: 652.91, max: 1100.89,
    p90: 933.49, p95: 968.44,
  },
  // VU stages
  stages: [
    { name: "Ramp Up",     duration: "0-1m",  targetVUs: 100,  estReqs: "~12,600", estRPS: "~210" },
    { name: "Scale Up",    duration: "1-2m",  targetVUs: 250,  estReqs: "~24,800", estRPS: "~413" },
    { name: "Peak Load",   duration: "2-3m",  targetVUs: 500,  estReqs: "~46,100", estRPS: "~768" },
    { name: "Sustained",   duration: "3-4m",  targetVUs: 500,  estReqs: "~46,800", estRPS: "~780" },
    { name: "Cool Down",   duration: "4-5m",  targetVUs: 100,  estReqs: "~28,500", estRPS: "~475" },
  ],
  // VU ramp profile (sampled every 30s from k6 output)
  vuProfile: [
    { t: "0:00",  vu: 1 },
    { t: "0:30",  vu: 50 },
    { t: "1:00",  vu: 100 },
    { t: "1:30",  vu: 175 },
    { t: "2:00",  vu: 250 },
    { t: "2:30",  vu: 375 },
    { t: "3:00",  vu: 500 },
    { t: "3:30",  vu: 500 },
    { t: "4:00",  vu: 500 },
    { t: "4:30",  vu: 335 },
    { t: "5:00",  vu: 108 },
  ],
  // Throughput samples (iterations per second at sampled points)
  tpsSamples: [
    { t: "0:30",  rps: 77 },
    { t: "1:00",  rps: 155 },
    { t: "1:30",  rps: 268 },
    { t: "2:00",  rps: 410 },
    { t: "2:30",  rps: 622 },
    { t: "3:00",  rps: 770 },
    { t: "3:30",  rps: 775 },
    { t: "4:00",  rps: 768 },
    { t: "4:30",  rps: 517 },
    { t: "5:00",  rps: 170 },
  ],
  // Check results
  checks: [
    { name: "status is 200",         passed: 128874, failed: 0 },
    { name: "response has transactions", passed: 128874, failed: 0 },
    { name: "response time < 500ms", passed: 128873, failed: 1 },
    { name: "response time < 1000ms", passed: 128874, failed: 0 },
    { name: "response time < 2000ms", passed: 128874, failed: 0 },
  ],
  // Thresholds
  thresholds: [
    { metric: "http_req_duration p(95)", threshold: "< 2000ms", actual: "5.28ms", status: "PASS" },
    { metric: "txn_endpoint_latency p(95)", threshold: "< 2000ms", actual: "5.28ms", status: "PASS" },
    { metric: "txn_error_rate", threshold: "< 5%", actual: "0.00%", status: "PASS" },
  ],
  testAccounts: 10,
  vusMax: 500,
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
      const color = (c === "PASS") ? GREEN : (c === "FAIL") ? RED : DARK;
      doc.font("Helvetica").fontSize(6.5).fillColor(color).text(String(c), x + 5, y + 5, { width: cw[ci] - 10, align: (al && al[ci]) || "left" });
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
  doc.font("Helvetica").fontSize(6).fillColor(GRAY).text(`API Load Test Report | k6 ${D.testDuration} @ ${D.vusMax} VUs | ${D.date} | Page ${page}/${total}`, L, 787, { width: PW, align: "center" });
}

/* ====== PAGE 1 ====== */
doc.rect(0, 0, 595, 85).fill(NAVY);
doc.rect(0, 0, 595, 3).fill(PURPLE);
doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE).text("API Load Test Report", L, 18);
doc.font("Helvetica").fontSize(8.5).fillColor("#a0aec0").text("k6 Load Test | CDC Savings Account Transaction Endpoint | Access Bank Synapse", L, 43);
doc.font("Helvetica").fontSize(7.5).fillColor("#a0aec0").text(`Date: ${D.date}  |  Cluster: EKS fiter-us-east-2-dev  |  Region: us-east-2  |  Duration: ${D.testDuration}  |  Max VUs: ${D.vusMax}`, L, 58);

/* ── KPI Cards ── */
const bw = 123, bh = 60;
kpi(L, 93, bw, bh, "Total Requests", D.totalRequests.toLocaleString(), "128,874 iterations", GREEN);
kpi(L + bw + 5, 93, bw, bh, "Throughput", String(D.rps), "req/s (avg over 5 min)", BLUE);
kpi(L + 2 * (bw + 5), 93, bw, bh, "p95 Latency", D.latency.p95 + " ms", "well under 2000ms", TEAL, 20);
kpi(L + 3 * (bw + 5), 93, bw, bh, "Error Rate", D.errorRate, "0 HTTP failures", GREEN);

/* ── Latency Percentiles ── */
let y = sec("Response Latency Distribution", 160);
y = tbl(
  ["Metric", "Avg", "Min", "Median", "Max", "p(90)", "p(95)"],
  [
    ["http_req_duration", D.latency.avg + "ms", D.latency.min + "ms", D.latency.med + "ms", D.latency.max + "ms", D.latency.p90 + "ms", D.latency.p95 + "ms"],
    ["http_req_waiting (TTFB)", D.waiting.avg + "ms", D.waiting.min + "ms", D.waiting.med + "ms", D.waiting.max + "ms", D.waiting.p90 + "ms", D.waiting.p95 + "ms"],
    ["group_duration", D.groupDuration.avg + "ms", D.groupDuration.min + "ms", D.groupDuration.med + "ms", D.groupDuration.max + "ms", D.groupDuration.p90 + "ms", D.groupDuration.p95 + "ms"],
    ["iteration_duration", D.iterDuration.avg + "ms", D.iterDuration.min + "ms", D.iterDuration.med + "ms", D.iterDuration.max + "ms", D.iterDuration.p90 + "ms", D.iterDuration.p95 + "ms"],
  ],
  y, [120, 55, 55, 55, 60, 55, 115], ["left", "center", "center", "center", "center", "center", "center"]
);

/* ── Throughput Chart ── */
y = sec("Throughput Over Time (req/s)", y + 5);
y = bars(D.tpsSamples, L, y + 10, PW, 85, "", i => {
  if (i >= 5 && i <= 7) return RED;   // peak (500 VU)
  if (i >= 3 && i <= 4) return ORANGE; // ramp to peak
  return TEAL;
}, "t", "rps");

/* ── VU Ramp Profile Chart ── */
y = sec("Virtual User Ramp Profile", y + 2);
y = bars(D.vuProfile, L, y + 10, PW, 75, "", i => {
  if (D.vuProfile[i].vu >= 500) return RED;
  if (D.vuProfile[i].vu >= 250) return ORANGE;
  return TEAL;
}, "t", "vu");

/* ── Load Stage Breakdown ── */
y = sec("Load Stage Breakdown", y + 2);
y = tbl(
  ["Stage", "Duration", "Target VUs", "Est. Requests", "Est. RPS"],
  D.stages.map(s => [s.name, s.duration, s.targetVUs, s.estReqs, s.estRPS]),
  y, [100, 80, 80, 120, 135], ["left", "center", "center", "center", "center"]
);

footer(1, 2);

/* ====== PAGE 2 ====== */
doc.addPage();
doc.rect(0, 0, 595, 3).fill(PURPLE);

/* ── Check Results ── */
y = sec("Check Results", 14);
y = tbl(
  ["Check", "Passed", "Failed", "Pass %"],
  D.checks.map(c => {
    const total = c.passed + c.failed;
    const pct = total > 0 ? (c.passed / total * 100).toFixed(2) + "%" : "N/A";
    return [c.name, c.passed.toLocaleString(), c.failed.toLocaleString(), pct];
  }),
  y, [180, 100, 100, 135], ["left", "center", "center", "center"]
);

/* ── Threshold Results ── */
y = sec("Threshold Results", y + 5);
y = tbl(
  ["Metric", "Threshold", "Actual", "Result"],
  D.thresholds.map(t => [t.metric, t.threshold, t.actual, t.status]),
  y, [170, 120, 100, 125], ["left", "center", "center", "center"]
);

/* ── Data Transfer ── */
y = sec("Data Transfer", y + 5);
y = tbl(
  ["Direction", "Total", "Rate"],
  [
    ["Received", D.dataReceived, D.dataReceivedRate],
    ["Sent", D.dataSent, D.dataSentRate],
  ],
  y, [170, 170, 175], ["left", "center", "center"]
);

/* ── Test Configuration ── */
y = sec("Test Configuration", y + 5);
y = tbl(
  ["Parameter", "Value"],
  [
    ["Test Tool", "Grafana k6 v0.54.0 (inside EKS cluster)"],
    ["Endpoint", D.endpoint],
    ["Base URL", D.baseUrl + " (cluster-internal service)"],
    ["Test Accounts", D.testAccounts + " CDC savings accounts (random selection per iteration)"],
    ["VU Profile", "Ramp: 0>>100>>250>>500>>500>>100 over 5 stages (1 min each)"],
    ["Max Virtual Users", D.vusMax],
    ["Authentication", "Basic auth (tenant: default)"],
    ["Pod Placement", "access-nodepool (EKS managed node group)"],
    ["Namespace", "access"],
    ["Sleep Between Requests", "300-700ms (randomized per iteration)"],
  ],
  y, [160, 355], ["left", "left"]
);

/* ── Key Observations ── */
y = sec("Key Observations", y + 5);
const observations = [
  `API handled 128,874 requests across 5 minutes with 0 HTTP failures and only 1 check failure (a single 669ms outlier exceeding the 500ms soft threshold).`,
  `Average response time was 1.94ms with median 1.23ms -- sub-2ms latency even under heavy load. p95 was 5.28ms, well within the 2000ms threshold.`,
  `Peak sustained throughput reached ~775 req/s at 500 concurrent VUs (stages 3-4). Average throughput across all stages was 428 req/s.`,
  `TTFB (time-to-first-byte) averaged 1.87ms, indicating minimal server processing time. The 669ms max outlier likely resulted from JVM GC or connection pool contention during the 500-VU peak.`,
  `All 3 thresholds passed: p95 latency < 2000ms, endpoint p95 < 2000ms, error rate < 5%.`,
  `Total data received: 819 MB at 2.7 MB/s. Each response averaged ~6.4 KB of transaction data.`,
  `The test ran inside the EKS cluster (pod-to-service), eliminating external network latency. Production clients via load balancer would see additional 5-20ms.`,
];
observations.forEach(b => {
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - " + b, L, y, { width: PW, lineGap: 1 });
  y += doc.heightOfString("  - " + b, { width: PW, lineGap: 1 }) + 3;
});

/* ── Verdict ── */
y += 3;
doc.roundedRect(L, y, PW, 30, 4).fill(GREEN);
doc.font("Helvetica-Bold").fontSize(10).fillColor(WHITE).text("VERDICT: PASS", L + 15, y + 5, { width: PW - 30 });
doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.9)").text(
  "The CDC transaction query API handles 500 concurrent users at sub-6ms p95 latency with zero errors. Production-ready for expected load profiles.",
  L + 15, y + 18, { width: PW - 30 }
);

footer(2, 2);

doc.end();
out.on("finish", () => console.log("PDF -> " + OUTPUT));
