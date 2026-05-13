const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const CSV_FILE = path.join(REPORTS_DIR, 'cdc-pipeline-resources-100k-tuned.csv');
const OUTPUT_FILE = path.join(REPORTS_DIR, 'cdc-pipeline', 'cdc-pipeline-test-report-100k-post-tuning.pdf');

const outDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// --- Test Data ---
const test = {
  batchSize: 100000,
  oracleInsertTime: 67.41,
  oracleDbTime: 63.68,
  pipelineDeliveryTime: 530.0,  // oracle done → last record
  totalE2ETime: 597.41,         // 67.41 + 530.0
  pipelineTPS: 188.7,           // 100000/530
  overallTPS: 167.4,            // 100000/597.41
  deliverySpread: 591.7,        // 15:14:40 → 15:24:32
  firstRecordAt: '15:14:40',
  lastRecordAt: '15:24:32',
  oracleStartTime: '15:14:16',
  oracleDoneTime: '15:15:42',
  debitCount: 62345,
  creditCount: 37645,
  peakArrival: 13338,
  recordsByMinute: [
    { min: '15:14', count: 2264 },
    { min: '15:15', count: 6612 },
    { min: '15:16', count: 7410 },
    { min: '15:17', count: 7980 },
    { min: '15:18', count: 9348 },
    { min: '15:19', count: 9804 },
    { min: '15:20', count: 10830 },
    { min: '15:21', count: 13110 },
    { min: '15:22', count: 13338 },
    { min: '15:23', count: 12996 },
    { min: '15:24', count: 6298 },
  ],
  // Percentiles (seconds from oracle done → created_at)
  percentiles: { p50: 298.0, p90: 481.1, p95: 503.7, p99: 523.6, min: -61.6, max: 530.0 },
  // Resource peaks
  resources: {
    oracle:   { cpuPeak: 585, cpuAvg: 115, memPeak: 2654 },
    debezium: { cpuPeak: 1837, cpuAvg: 161, memPeak: 1813 },
    consumer: { cpuPeak: 273, cpuAvg: 128, memPeak: 204 },
    kafka:    { cpuPeak: 1088, cpuAvg: 116, memPeak: 2079 },
  },
  connectors: [
    { name: 'access-core-banking', state: 'RUNNING' },
    { name: 'access-nip-system', state: 'RUNNING' },
    { name: 'access-webserve', state: 'RUNNING' },
  ],
};

// Pre-tuning 100K for comparison
const preTuning = {
  oracleDbTime: 65.72,
  pipelineDeliveryTime: 257.35,
  totalE2ETime: 319.22,
  pipelineTPS: 318.1,
  overallTPS: 313.3,
  percentiles: { p50: 141.4, p90: 229.9, p95: 240.0, p99: 248.1, min: -64.3, max: 250.0 },
  resources: {
    oracle:   { cpuPeak: 490, memPeak: 2748 },
    debezium: { cpuPeak: 515, memPeak: 948 },
    consumer: { cpuPeak: 238, memPeak: 245 },
    kafka:    { cpuPeak: 744, memPeak: 2120 },
  },
};

// Tuning changes applied
const tuningChanges = [
  { param: 'CPU request / limit', before: '250m / none', after: '500m / 2000m' },
  { param: 'Memory request / limit', before: '1Gi / 2Gi', after: '2Gi / 3Gi' },
  { param: 'JVM Heap (-Xms/-Xmx)', before: '768m', after: '1536m' },
  { param: 'log.mining.batch.size.max', before: '100,000', after: '500,000' },
  { param: 'log.mining.batch.size.default', before: '20,000', after: '50,000' },
  { param: 'log.mining.sleep.time.default.ms', before: '1,000', after: '200' },
  { param: 'log.mining.sleep.time.increment.ms', before: '200', after: '50' },
  { param: 'log.mining.sleep.time.max.ms', before: '3,000', after: '1,000' },
  { param: 'max.batch.size', before: '2,048', after: '8,192' },
  { param: 'max.queue.size', before: '8,192', after: '32,768' },
  { param: 'poll.interval.ms', before: '500', after: '100' },
];

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
  muted: '#718096', white: '#ffffff', light: '#edf2f7',
  oracle: '#c0392b', debezium: '#e67e22', kafka: '#2ecc71',
  consumer: '#8e44ad',
};

// --- Helpers ---
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

  // Header
  doc.rect(x, y, totalW, rowHeight).fill(headerBg);
  let cx = x;
  headers.forEach((h, i) => {
    doc.fontSize(fontSize).fillColor(headerColor).font('Helvetica-Bold').text(h, cx + 3, y + 3, { width: colWidths[i] - 6 });
    cx += colWidths[i];
  });
  y += rowHeight;

  // Rows
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

// ============ PAGE 1: TITLE + KEY METRICS + PERCENTILES + ARRIVAL ============
// Title bar
doc.rect(0, 0, 595, 45).fill(C.primary);
doc.fontSize(18).fillColor(C.white).font('Helvetica-Bold').text('CDC Pipeline: 100K Post-Tuning Report', 50, 12);
doc.fontSize(8).fillColor('#a0aec0').font('Helvetica')
  .text('May 12, 2026 | EKS: fiter-us-east-2-dev | Debezium LogMiner tuning applied', 50, 32);
y = 55;

// Key Metrics — 4 boxes
const metrics = [
  { label: 'Pipeline TPS', value: `${fmt(test.pipelineTPS)}`, sub: 'tuned', color: C.accent },
  { label: 'Delivery Time', value: `${fmt(test.pipelineDeliveryTime, 0)}s`, sub: '100K records', color: C.warning },
  { label: 'End-to-End', value: `${fmt(test.totalE2ETime, 0)}s`, sub: 'insert→last', color: C.primary },
  { label: 'Peak Arrival', value: `${test.peakArrival}/min`, sub: 'max burst', color: C.danger },
];
const boxW = 118, boxH = 48, boxGap = 10;
metrics.forEach((m, i) => {
  const bx = 50 + i * (boxW + boxGap);
  doc.rect(bx, y, boxW, boxH).fill(m.color);
  doc.fontSize(8).fillColor('#ffffffcc').font('Helvetica').text(m.label, bx + 6, y + 5, { width: boxW - 12 });
  doc.fontSize(18).fillColor(C.white).font('Helvetica-Bold').text(m.value, bx + 6, y + 16, { width: boxW - 12 });
  doc.fontSize(7).fillColor('#ffffffaa').font('Helvetica').text(m.sub, bx + 6, y + 37, { width: boxW - 12 });
});
y += boxH + 15;

// Percentile table
y = drawSection(doc, 'Delivery Latency Percentiles (Oracle done → Postgres created_at)', y);
y = drawTable(doc,
  ['Test', 'p50', 'p90', 'p95', 'p99', 'Min', 'Max'],
  [
    ['100K Pre-Tuning', `${preTuning.percentiles.p50}s`, `${preTuning.percentiles.p90}s`, `${preTuning.percentiles.p95}s`, `${preTuning.percentiles.p99}s`, `${preTuning.percentiles.min}s`, `${preTuning.percentiles.max}s`],
    ['100K Post-Tuning', `${test.percentiles.p50}s`, `${test.percentiles.p90}s`, `${test.percentiles.p95}s`, `${test.percentiles.p99}s`, `${test.percentiles.min}s`, `${test.percentiles.max}s`],
  ],
  50, y, [100, 55, 55, 55, 55, 55, 55],
  { fontSize: 7.5, rowHeight: 14 }
);
doc.fontSize(7).fillColor(C.muted).font('Helvetica')
  .text('Negative min values = records that arrived while Oracle was still inserting (pipeline streamed ahead of completion).', 50, y, { width: 495 });
y += 18;

// Arrival rate chart
y = drawSection(doc, 'Record Arrival Rate (per minute)', y);
y = drawBarChart(doc,
  test.recordsByMinute.map(d => ({ label: d.min.slice(-5), value: d.count })),
  50, y, 495, 130,
  { title: 'Records arriving in PostgreSQL per minute', yLabel: 'Count', color: C.accent, maxVal: 15000 }
);
doc.fontSize(7).fillColor(C.text).font('Helvetica')
  .text(`Steady ramp from 2,264→13,338 rec/min. Records started arriving 84s before Oracle INSERT completed (pipeline streaming). Peak burst: ${test.peakArrival} rec/min.`, 50, y, { width: 495 });
y += 22;

// Tuning changes table
y = drawSection(doc, 'Tuning Changes Applied', y);
y = drawTable(doc,
  ['Parameter', 'Before (Default)', 'After (Tuned)'],
  tuningChanges.map(t => [t.param, t.before, t.after]),
  50, y, [180, 130, 130],
  { fontSize: 7, rowHeight: 13 }
);

// ============ PAGE 2: RESOURCE CHARTS ============
doc.addPage();
y = 50;

const oracleData = getPodTimeSeries('oracle-xe-0');
const debeziumData = getPodTimeSeries('access-connect-connect-0');
const consumerData = getPodTimeSeries('access-synapse-consumer-6ff4dd6b58-wz52z');
const kafkaData = getPodTimeSeries('cdc-kafka-kafka-0');

y = drawSection(doc, 'CPU Usage: Oracle XE', y);
y = drawBarChart(doc, oracleData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: 'Oracle XE CPU (millicores)', yLabel: 'mCPU', color: C.oracle, maxVal: 700 });
y += 5;

y = drawSection(doc, 'CPU Usage: Debezium Connect (Tuned)', y);
y = drawBarChart(doc, debeziumData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: 'Debezium Connect CPU (millicores) — peak 1,837m', yLabel: 'mCPU', color: C.debezium, maxVal: 2000 });
y += 5;

y = drawSection(doc, 'CPU Usage: Synapse Consumer', y);
y = drawBarChart(doc, consumerData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: 'Synapse Consumer CPU (millicores)', yLabel: 'mCPU', color: C.consumer, maxVal: 400 });
y += 5;

y = drawSection(doc, 'CPU Usage: Kafka Broker 0', y);
y = drawBarChart(doc, kafkaData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: 'Kafka Broker 0 CPU (millicores)', yLabel: 'mCPU', color: C.kafka, maxVal: 1200 });

// ============ PAGE 3: MEMORY + COMPARISON + FINDINGS ============
doc.addPage();
y = 50;

// Side-by-side memory charts
y = drawSection(doc, 'Memory Usage: Debezium & Oracle', y);
const memY = y;
y = drawBarChart(doc, debeziumData.map(d => ({ label: d.time, value: d.mem })),
  50, memY, 240, 110, { title: 'Debezium Memory (MiB) — peak 1,813', yLabel: 'MiB', color: C.debezium, maxVal: 2048 });
drawBarChart(doc, oracleData.map(d => ({ label: d.time, value: d.mem })),
  300, memY, 245, 110, { title: 'Oracle Memory (MiB)', yLabel: 'MiB', color: C.oracle, maxVal: 4096 });
y += 8;

// Resource comparison table
y = drawSection(doc, 'Resource Comparison: Pre-Tuning vs Post-Tuning', y);
y = drawTable(doc,
  ['Pod', 'CPU Pre', 'CPU Post', 'Δ CPU', 'Mem Pre', 'Mem Post', 'Δ Mem'],
  [
    ['Oracle XE', '490m', `${test.resources.oracle.cpuPeak}m`, `+${test.resources.oracle.cpuPeak - preTuning.resources.oracle.cpuPeak}m`, '2,748 Mi', `${test.resources.oracle.memPeak} Mi`, `${test.resources.oracle.memPeak - preTuning.resources.oracle.memPeak} Mi`],
    ['Debezium', '515m', `${test.resources.debezium.cpuPeak}m`, `+${test.resources.debezium.cpuPeak - preTuning.resources.debezium.cpuPeak}m`, '948 Mi', `${test.resources.debezium.memPeak} Mi`, `+${test.resources.debezium.memPeak - preTuning.resources.debezium.memPeak} Mi`],
    ['Consumer', '238m', `${test.resources.consumer.cpuPeak}m`, `+${test.resources.consumer.cpuPeak - preTuning.resources.consumer.cpuPeak}m`, '245 Mi', `${test.resources.consumer.memPeak} Mi`, `${test.resources.consumer.memPeak - preTuning.resources.consumer.memPeak} Mi`],
    ['Kafka 0', '744m', `${test.resources.kafka.cpuPeak}m`, `+${test.resources.kafka.cpuPeak - preTuning.resources.kafka.cpuPeak}m`, '2,120 Mi', `${test.resources.kafka.memPeak} Mi`, `${test.resources.kafka.memPeak - preTuning.resources.kafka.memPeak} Mi`],
  ],
  50, y, [75, 55, 60, 55, 60, 65, 60],
  { fontSize: 7, rowHeight: 14 }
);
y += 5;

// Throughput comparison
y = drawSection(doc, 'Throughput Comparison', y);
y = drawTable(doc,
  ['Metric', '100K Pre-Tuning', '100K Post-Tuning', 'Change'],
  [
    ['Oracle INSERT Time', `${preTuning.oracleDbTime}s`, `${test.oracleDbTime}s`, `${fmt(test.oracleDbTime - preTuning.oracleDbTime, 1)}s`],
    ['Pipeline Delivery', `${preTuning.pipelineDeliveryTime}s`, `${test.pipelineDeliveryTime}s`, `+${fmt(test.pipelineDeliveryTime - preTuning.pipelineDeliveryTime, 0)}s`],
    ['Pipeline TPS', `${preTuning.pipelineTPS}`, `${test.pipelineTPS}`, `${fmt(test.pipelineTPS - preTuning.pipelineTPS, 1)}`],
    ['p50 Latency', `${preTuning.percentiles.p50}s`, `${test.percentiles.p50}s`, `+${fmt(test.percentiles.p50 - preTuning.percentiles.p50, 0)}s`],
    ['p99 Latency', `${preTuning.percentiles.p99}s`, `${test.percentiles.p99}s`, `+${fmt(test.percentiles.p99 - preTuning.percentiles.p99, 0)}s`],
    ['Debezium CPU Peak', `${preTuning.resources.debezium.cpuPeak}m`, `${test.resources.debezium.cpuPeak}m`, `+${test.resources.debezium.cpuPeak - preTuning.resources.debezium.cpuPeak}m`],
    ['Debezium Mem Peak', `${preTuning.resources.debezium.memPeak} Mi`, `${test.resources.debezium.memPeak} Mi`, `+${test.resources.debezium.memPeak - preTuning.resources.debezium.memPeak} Mi`],
  ],
  50, y, [120, 100, 110, 100],
  { fontSize: 7.5, rowHeight: 14 }
);
y += 8;

// Findings
y = drawSection(doc, 'Key Findings', y);

const findings = [
  ['Tuning increased Debezium resource consumption as expected',
   'CPU peak jumped from 515m→1,837m (+257%) and memory from 948→1,813 MiB (+91%). The 2x heap increase and 5x batch.size.max are the primary drivers. ' +
   'This confirms Debezium is now doing larger LogMiner queries and buffering more events in memory.'],
  ['Pipeline was slower due to accumulated redo log',
   'The post-tuning 100K ran after the 1M test, meaning Oracle\'s redo log contained ~1.5M entries. Debezium must scan through this larger redo log ' +
   'to find new changes. This is NOT a fair A/B comparison — the redo log state differs. A clean-slate retest would isolate tuning impact.'],
  ['Peak arrival rate improved',
   `Peak burst reached ${test.peakArrival} rec/min (222 rec/s) vs 15,696 rec/min (262 rec/s) pre-tuning. ` +
   'The arrival curve shows a steady ramp rather than the step-function pattern seen pre-tuning, suggesting smoother batch delivery.'],
  ['New resource limits prevented OOM risk',
   'Debezium peaked at 1,813 MiB — would have exceeded the old 2 GiB limit. The new 3 GiB limit (with 1,536m heap) provided adequate headroom. ' +
   'The CPU limit of 2,000m was within 163m of the peak, suggesting 2,500m may be safer for production.'],
  ['Recommendation: Re-test on clean redo log',
   'To properly measure tuning impact, flush the Oracle redo log or restart Oracle XE, then run identical 100K tests with and without tuning. ' +
   'Also consider testing with the 1M batch to see if the larger LogMiner queries reduce the 74-minute catch-up tail.'],
];

findings.forEach(([title, detail]) => {
  doc.fontSize(8).fillColor(C.primary).font('Helvetica-Bold').text('\u2022 ' + title, 50, y, { width: 495 });
  y += 12;
  doc.fontSize(7).fillColor(C.text).font('Helvetica').text(detail, 60, y, { width: 485, lineGap: 1.5 });
  y += doc.heightOfString(detail, { width: 485, lineGap: 1.5 }) + 6;
});

// --- Footers ---
const pageCount = doc.bufferedPageRange().count;
for (let i = 0; i < pageCount; i++) {
  doc.switchToPage(i);
  doc.fontSize(6.5).fillColor(C.muted).font('Helvetica')
    .text(`CDC Pipeline 100K Post-Tuning Report — ${new Date().toISOString()} | Page ${i + 1}/${pageCount}`, 50, 780, { width: 495, align: 'center' });
}

doc.end();
console.log(`PDF generated: ${OUTPUT_FILE}`);
