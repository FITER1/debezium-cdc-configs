const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const CSV_FILE = path.join(REPORTS_DIR, 'cdc-pipeline-resources-100k-defaults.csv');
const OUTPUT_FILE = path.join(REPORTS_DIR, 'cdc-pipeline', 'cdc-pipeline-100k-defaults-performance-report.pdf');

const outDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// --- Test Data ---
const test = {
  batchSize: 100000,
  oracleInsertTime: 55.92,
  oracleStartTime: '16:45:01 UTC',
  oracleDoneTime: '16:46:01 UTC',
  pipelineDeliveryTime: 556.1,
  totalE2ETime: 615.4,
  pipelineTPS: 179.8,
  overallTPS: 162.5,
  firstRecordAt: '16:45:09',
  lastRecordAt: '16:55:17',
  totalRecordsDelivered: 100000,
  debitCount: 62370,
  creditCount: 37630,
  peakArrival: 13794,
  moduleBreakdown: { RT: 80017, AC: 15000, IC: 4983 },
  recordsByMinute: [
    { min: '16:45', count: 3343 },
    { min: '16:46', count: 3990 },
    { min: '16:47', count: 7638 },
    { min: '16:48', count: 8094 },
    { min: '16:49', count: 10260 },
    { min: '16:50', count: 10120 },
    { min: '16:51', count: 11172 },
    { min: '16:52', count: 13794 },
    { min: '16:53', count: 13794 },
    { min: '16:54', count: 13794 },
    { min: '16:55', count: 4001 },
  ],
  percentiles: { p50: 336.4, p90: 512.5, p95: 534.5, p99: 551.7, min: -51.7, max: 556.1 },
  resources: {
    oracle:   { cpuPeak: 447, cpuAvg: 70, memPeak: 2746, memAvg: 2670 },
    debezium: { cpuPeak: 908, cpuAvg: 136, memPeak: 1821, memAvg: 1821 },
    consumer: { cpuPeak: 252, cpuAvg: 189, memPeak: 210, memAvg: 204 },
    kafka:    { cpuPeak: 1145, cpuAvg: 184, memPeak: 2110, memAvg: 2052 },
  },
};

// --- Parse CSV ---
const csvLines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
const csvRows = csvLines.slice(1).map(line => {
  const [timestamp, namespace, pod, cpu, mem] = line.split(',');
  return { timestamp, namespace, pod, cpu: parseInt(cpu), mem: parseInt(mem) };
});

function getPodTimeSeries(podName) {
  return csvRows.filter(r => r.pod === podName).map(r => ({
    time: r.timestamp.slice(11, 19),
    cpu: r.cpu,
    mem: r.mem,
  }));
}

// --- Colors ---
const C = {
  primary: '#1a365d', secondary: '#2d5f8a', accent: '#38a169',
  danger: '#e53e3e', warning: '#d69e2e', text: '#2d3748',
  muted: '#718096', white: '#ffffff',
  oracle: '#c0392b', debezium: '#e67e22', kafka: '#2ecc71',
  consumer: '#8e44ad',
};

function fmt(v, d = 1) { return typeof v === 'number' ? v.toFixed(d) : String(v); }

function drawHR(doc, y, color = '#cbd5e0') {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(color).lineWidth(0.5).stroke();
  return y + 8;
}

function drawSection(doc, title, y) {
  doc.fontSize(13).fillColor(C.primary).font('Helvetica-Bold').text(title, 50, y);
  return drawHR(doc, y + 18, C.primary);
}

function drawBarChart(doc, data, x, y, width, height, opts = {}) {
  const { title, yLabel, color = C.accent, maxVal } = opts;
  const pad = { top: 22, bottom: 30, left: 40, right: 8 };
  const cW = width - pad.left - pad.right;
  const cH = height - pad.top - pad.bottom;
  const cX = x + pad.left;
  const cY = y + pad.top;

  if (title) doc.fontSize(8).fillColor(C.text).font('Helvetica-Bold').text(title, x, y + 4, { width, align: 'center' });
  if (yLabel) doc.fontSize(6).fillColor(C.muted).font('Helvetica').text(yLabel, x + 2, cY + cH / 2 - 8, { width: 35 });

  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(1, (cW / data.length) - 1);

  for (let i = 0; i <= 4; i++) {
    const gy = cY + cH - (cH * i / 4);
    doc.moveTo(cX, gy).lineTo(cX + cW, gy).strokeColor('#e2e8f0').lineWidth(0.3).stroke();
    doc.fontSize(5.5).fillColor(C.muted).font('Helvetica')
      .text(Math.round(max * i / 4).toString(), x + 3, gy - 4, { width: pad.left - 8, align: 'right' });
  }

  data.forEach((d, i) => {
    const barH = Math.min((d.value / max) * cH, cH);
    const bx = cX + i * (cW / data.length);
    doc.rect(bx, cY + cH - barH, barW, barH).fill(color);
  });

  data.forEach((d, i) => {
    if (i % Math.max(1, Math.floor(data.length / 8)) === 0 || i === data.length - 1) {
      const bx = cX + i * (cW / data.length);
      doc.fontSize(5).fillColor(C.muted).font('Helvetica').text(d.label, bx - 10, cY + cH + 2, { width: 25, align: 'center' });
    }
  });

  doc.moveTo(cX, cY).lineTo(cX, cY + cH).lineTo(cX + cW, cY + cH).strokeColor(C.muted).lineWidth(0.5).stroke();
  return y + height + 3;
}

function drawTable(doc, headers, rows, x, y, colWidths, opts = {}) {
  const { headerBg = C.primary, headerColor = C.white, fontSize = 7.5, rowHeight = 14 } = opts;
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  doc.rect(x, y, totalW, rowHeight).fill(headerBg);
  let cx = x;
  headers.forEach((h, i) => {
    doc.fontSize(fontSize).fillColor(headerColor).font('Helvetica-Bold').text(h, cx + 3, y + 3, { width: colWidths[i] - 6 });
    cx += colWidths[i];
  });
  y += rowHeight;

  rows.forEach((row, ri) => {
    if (ri % 2 === 0) doc.rect(x, y, totalW, rowHeight).fill('#f7fafc');
    cx = x;
    row.forEach((cell, ci) => {
      doc.fontSize(fontSize).fillColor(C.text).font('Helvetica').text(String(cell), cx + 3, y + 3, { width: colWidths[ci] - 6 });
      cx += colWidths[ci];
    });
    y += rowHeight;
  });
  return y + 5;
}

// --- Build PDF ---
const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 }, bufferPages: true });
doc.pipe(fs.createWriteStream(OUTPUT_FILE));

let y = 40;

// ============ PAGE 1: TITLE + METRICS + PERCENTILES + ARRIVAL ============
doc.rect(0, 0, 595, 50).fill(C.primary);
doc.fontSize(18).fillColor(C.white).font('Helvetica-Bold').text('CDC Pipeline Performance Report', 50, 10);
doc.fontSize(9).fillColor('#a0aec0').font('Helvetica')
  .text('100,000 Transactions | Oracle XE \u2192 Debezium \u2192 Kafka \u2192 Synapse Consumer \u2192 PostgreSQL', 50, 32);
y = 60;

// Test Environment Info
doc.fontSize(8).fillColor(C.text).font('Helvetica')
  .text('Date: May 12, 2026  |  Cluster: EKS fiter-us-east-2-dev  |  Region: us-east-2  |  Test Start: ' + test.oracleStartTime, 50, y, { width: 495 });
y += 18;

// Key Metrics — 4 boxes
const metrics = [
  { label: 'Pipeline TPS', value: `${fmt(test.pipelineTPS)}`, sub: 'records / sec', color: C.accent },
  { label: 'Delivery Time', value: `${fmt(test.pipelineDeliveryTime, 0)}s`, sub: '100K records', color: C.warning },
  { label: 'End-to-End', value: `${fmt(test.totalE2ETime, 0)}s`, sub: 'insert \u2192 last arrival', color: C.primary },
  { label: 'Peak Arrival', value: `${test.peakArrival}/min`, sub: 'max burst rate', color: C.danger },
];
const boxW = 118, boxH = 48, boxGap = 10;
metrics.forEach((m, i) => {
  const bx = 50 + i * (boxW + boxGap);
  doc.rect(bx, y, boxW, boxH).fill(m.color);
  doc.fontSize(8).fillColor('#ffffffcc').font('Helvetica').text(m.label, bx + 6, y + 5, { width: boxW - 12 });
  doc.fontSize(18).fillColor(C.white).font('Helvetica-Bold').text(m.value, bx + 6, y + 16, { width: boxW - 12 });
  doc.fontSize(7).fillColor('#ffffffaa').font('Helvetica').text(m.sub, bx + 6, y + 37, { width: boxW - 12 });
});
y += boxH + 18;

// Pipeline Timing Breakdown
y = drawSection(doc, 'Pipeline Timing', y);
y = drawTable(doc,
  ['Phase', 'Duration', 'Detail'],
  [
    ['Oracle INSERT (source)', `${test.oracleInsertTime}s`, `100,000 records committed across 3 schemas (ACZB_HISTORY, NIPX_*, PAYMENT_ROUTER)`],
    ['CDC Pipeline Delivery', `${test.pipelineDeliveryTime}s`, 'Oracle commit \u2192 last record lands in PostgreSQL'],
    ['Total End-to-End', `${test.totalE2ETime}s`, `First INSERT \u2192 last record in PostgreSQL (${test.oracleStartTime} \u2192 ${test.lastRecordAt} UTC)`],
    ['Streaming Overlap', `${Math.abs(test.percentiles.min).toFixed(0)}s`, 'Records began arriving in PostgreSQL before Oracle INSERT completed'],
  ],
  50, y, [130, 75, 290],
  { fontSize: 7.5, rowHeight: 16 }
);
y += 5;

// Percentile table
y = drawSection(doc, 'Delivery Latency Percentiles', y);
doc.fontSize(7).fillColor(C.muted).font('Helvetica')
  .text('Measured as: time from Oracle INSERT completion to each record\u2019s created_at in PostgreSQL.', 50, y, { width: 495 });
y += 14;
y = drawTable(doc,
  ['p50 (median)', 'p90', 'p95', 'p99', 'Min', 'Max'],
  [
    [`${test.percentiles.p50}s`, `${test.percentiles.p90}s`, `${test.percentiles.p95}s`, `${test.percentiles.p99}s`, `${test.percentiles.min}s`, `${test.percentiles.max}s`],
  ],
  50, y, [82, 82, 82, 82, 82, 82],
  { fontSize: 8, rowHeight: 16 }
);
doc.fontSize(7).fillColor(C.muted).font('Helvetica')
  .text('Negative min = records that arrived while Oracle was still inserting (real-time streaming).', 50, y, { width: 495 });
y += 16;

// Arrival rate chart
y = drawSection(doc, 'Record Arrival Rate (per minute)', y);
y = drawBarChart(doc,
  test.recordsByMinute.map(d => ({ label: d.min.slice(-5), value: d.count })),
  50, y, 495, 130,
  { title: 'Records arriving in PostgreSQL per minute', yLabel: 'Count', color: C.accent, maxVal: 16000 }
);
doc.fontSize(7).fillColor(C.text).font('Helvetica')
  .text(`Arrival ramped from ${test.recordsByMinute[0].count} to ${test.peakArrival} records/min over ~10 minutes, then tapered as remaining records were flushed.`, 50, y, { width: 495 });
y += 16;

// Transaction Breakdown
y = drawSection(doc, 'Transaction Breakdown', y);
y = drawTable(doc,
  ['Category', 'Count', 'Percentage'],
  [
    ['Debit (D)', test.debitCount.toLocaleString(), `${(test.debitCount / test.batchSize * 100).toFixed(1)}%`],
    ['Credit (C)', test.creditCount.toLocaleString(), `${(test.creditCount / test.batchSize * 100).toFixed(1)}%`],
    ['Module: RT (Payment Router)', test.moduleBreakdown.RT.toLocaleString(), `${(test.moduleBreakdown.RT / test.batchSize * 100).toFixed(1)}%`],
    ['Module: AC (Core Banking)', test.moduleBreakdown.AC.toLocaleString(), `${(test.moduleBreakdown.AC / test.batchSize * 100).toFixed(1)}%`],
    ['Module: IC (Inbound Credits)', test.moduleBreakdown.IC.toLocaleString(), `${(test.moduleBreakdown.IC / test.batchSize * 100).toFixed(1)}%`],
  ],
  50, y, [180, 100, 100],
  { fontSize: 7.5, rowHeight: 14 }
);

// ============ PAGE 2: RESOURCE CHARTS ============
doc.addPage();
y = 50;

const oracleData = getPodTimeSeries('oracle-xe-0');
const debeziumData = getPodTimeSeries('access-connect-connect-0');
const consumerData = getPodTimeSeries('access-synapse-consumer-6ff4dd6b58-wz52z');
const kafkaData = getPodTimeSeries('cdc-kafka-kafka-0');

y = drawSection(doc, 'CPU Usage: Oracle XE (Source Database)', y);
y = drawBarChart(doc, oracleData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: `Oracle XE CPU (millicores) \u2014 peak ${test.resources.oracle.cpuPeak}m, avg ${test.resources.oracle.cpuAvg}m`, yLabel: 'mCPU', color: C.oracle, maxVal: 800 });
y += 5;

y = drawSection(doc, 'CPU Usage: Debezium Kafka Connect (CDC Engine)', y);
y = drawBarChart(doc, debeziumData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: `Debezium Connect CPU (millicores) \u2014 peak ${test.resources.debezium.cpuPeak}m, avg ${test.resources.debezium.cpuAvg}m`, yLabel: 'mCPU', color: C.debezium, maxVal: 1500 });
y += 5;

y = drawSection(doc, 'CPU Usage: Synapse Consumer (Enrichment Service)', y);
y = drawBarChart(doc, consumerData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: `Synapse Consumer CPU (millicores) \u2014 peak ${test.resources.consumer.cpuPeak}m, avg ${test.resources.consumer.cpuAvg}m`, yLabel: 'mCPU', color: C.consumer, maxVal: 400 });
y += 5;

y = drawSection(doc, 'CPU Usage: Kafka Broker', y);
y = drawBarChart(doc, kafkaData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: `Kafka Broker 0 CPU (millicores) \u2014 peak ${test.resources.kafka.cpuPeak}m, avg ${test.resources.kafka.cpuAvg}m`, yLabel: 'mCPU', color: C.kafka, maxVal: 1200 });

// ============ PAGE 3: MEMORY + INFRA SUMMARY ============
doc.addPage();
y = 50;

// Memory charts side by side
y = drawSection(doc, 'Memory Usage', y);
const memY = y;
y = drawBarChart(doc, debeziumData.map(d => ({ label: d.time, value: d.mem })),
  50, memY, 240, 110, { title: `Debezium Memory (MiB) \u2014 peak ${test.resources.debezium.memPeak}`, yLabel: 'MiB', color: C.debezium, maxVal: 2048 });
drawBarChart(doc, oracleData.map(d => ({ label: d.time, value: d.mem })),
  300, memY, 245, 110, { title: `Oracle Memory (MiB) \u2014 peak ${test.resources.oracle.memPeak}`, yLabel: 'MiB', color: C.oracle, maxVal: 4096 });
y += 8;

const memY2 = y;
y = drawBarChart(doc, kafkaData.map(d => ({ label: d.time, value: d.mem })),
  50, memY2, 240, 110, { title: `Kafka Broker Memory (MiB) \u2014 peak ${test.resources.kafka.memPeak}`, yLabel: 'MiB', color: C.kafka, maxVal: 3072 });
drawBarChart(doc, consumerData.map(d => ({ label: d.time, value: d.mem })),
  300, memY2, 245, 110, { title: `Synapse Consumer Memory (MiB) \u2014 peak ${test.resources.consumer.memPeak}`, yLabel: 'MiB', color: C.consumer, maxVal: 512 });
y += 10;

// Resource Summary Table
y = drawSection(doc, 'Infrastructure Resource Summary', y);
y = drawTable(doc,
  ['Component', 'Role', 'CPU Peak', 'CPU Avg', 'Memory Peak', 'Namespace'],
  [
    ['Oracle XE', 'Source database', `${test.resources.oracle.cpuPeak}m`, `${test.resources.oracle.cpuAvg}m`, `${test.resources.oracle.memPeak} MiB`, 'access-cdc'],
    ['Debezium Connect', 'CDC engine (LogMiner)', `${test.resources.debezium.cpuPeak}m`, `${test.resources.debezium.cpuAvg}m`, `${test.resources.debezium.memPeak} MiB`, 'access-cdc'],
    ['Synapse Consumer', 'Enrichment + write to PG', `${test.resources.consumer.cpuPeak}m`, `${test.resources.consumer.cpuAvg}m`, `${test.resources.consumer.memPeak} MiB`, 'access'],
    ['Kafka Broker 0', 'Message broker (of 3)', `${test.resources.kafka.cpuPeak}m`, `${test.resources.kafka.cpuAvg}m`, `${test.resources.kafka.memPeak} MiB`, 'kafka'],
  ],
  50, y, [90, 95, 55, 55, 70, 60],
  { fontSize: 7, rowHeight: 14 }
);
y += 5;

// Pipeline Architecture
y = drawSection(doc, 'Pipeline Architecture', y);
doc.fontSize(8).fillColor(C.text).font('Helvetica')
  .text('Oracle XE (3 schemas)  \u2192  Debezium LogMiner (3 connectors)  \u2192  Kafka (3-broker Strimzi cluster)  \u2192  Synapse Consumer  \u2192  PostgreSQL (RDS)', 50, y, { width: 495 });
y += 18;

y = drawTable(doc,
  ['Component', 'Detail'],
  [
    ['Source Schemas', 'ABFCUBSLIVE (ACZB_HISTORY), NIPSYSTEM (NIPX_DIRECT_CREDITS, NIPX_INBOUND_CREDITS), WEBSERVE (PAYMENT_ROUTER_TXN_LOG)'],
    ['Debezium Connectors', 'access-core-banking, access-nip-system, access-webserve'],
    ['Kafka Cluster', '3-broker Strimzi cluster (cdc-kafka-kafka-0/1/2)'],
    ['Target Database', 'PostgreSQL RDS (ora_enriched_transactions table)'],
    ['Container Platform', 'Amazon EKS (Kubernetes) across namespaces: access, access-cdc, kafka'],
  ],
  50, y, [120, 370],
  { fontSize: 7, rowHeight: 18 }
);
y += 8;

// Summary
y = drawSection(doc, 'Performance Summary', y);
const summaryItems = [
  `The pipeline processed 100,000 transactions end-to-end in ${fmt(test.totalE2ETime, 0)} seconds at an effective throughput of ${fmt(test.pipelineTPS)} TPS.`,
  `Oracle inserted all records in ${test.oracleInsertTime}s. The CDC pipeline began streaming records to PostgreSQL ${Math.abs(test.percentiles.min).toFixed(0)}s before Oracle completed all inserts.`,
  `Median delivery latency was ${test.percentiles.p50}s with p99 at ${test.percentiles.p99}s. The p99/p50 ratio of ${(test.percentiles.p99 / test.percentiles.p50).toFixed(1)}x indicates consistent delivery with modest tail latency.`,
  `Debezium was the most CPU-intensive component (peak ${test.resources.debezium.cpuPeak}m), followed by Kafka (${test.resources.kafka.cpuPeak}m) and Oracle (${test.resources.oracle.cpuPeak}m). The Synapse consumer used minimal resources (peak ${test.resources.consumer.cpuPeak}m).`,
];

summaryItems.forEach(item => {
  doc.fontSize(7.5).fillColor(C.text).font('Helvetica').text('\u2022  ' + item, 50, y, { width: 495, lineGap: 1.5 });
  y += doc.heightOfString('\u2022  ' + item, { width: 495, lineGap: 1.5 }) + 5;
});

// --- Footers ---
const pageCount = doc.bufferedPageRange().count;
for (let i = 0; i < pageCount; i++) {
  doc.switchToPage(i);
  doc.fontSize(6.5).fillColor(C.muted).font('Helvetica')
    .text(`CDC Pipeline Performance Report \u2014 100K Transactions \u2014 ${new Date().toISOString().slice(0, 10)} | Page ${i + 1}/${pageCount}`, 50, 780, { width: 495, align: 'center' });
}

doc.end();
console.log(`PDF generated: ${OUTPUT_FILE}`);
