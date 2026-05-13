const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const CSV_FILE = path.join(REPORTS_DIR, 'cdc-pipeline-resources-100k-clean.csv');
const OUTPUT_FILE = path.join(REPORTS_DIR, 'cdc-pipeline', 'cdc-pipeline-test-report-100k-clean-slate.pdf');

const outDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// --- Clean-Slate Post-Tuning 100K Test Data ---
const test = {
  batchSize: 100000,
  oracleInsertTime: 58.02,
  oracleStartTime: '15:50:38',
  oracleDoneTime: '15:51:39',
  pipelineDeliveryTime: 489.3,   // oracle done → last PG record (max percentile)
  totalE2ETime: 551.1,           // oracle start → last PG record
  pipelineTPS: 204.4,            // 100000/489.3
  overallTPS: 181.5,             // 100000/551.1
  firstRecordAt: '15:50:49',
  lastRecordAt: '16:00:29',
  debitCount: 62345,
  creditCount: 37645,
  peakArrival: 14250,
  recordsByMinute: [
    { min: '15:50', count: 1425 },
    { min: '15:51', count: 8094 },
    { min: '15:52', count: 8094 },
    { min: '15:53', count: 9179 },
    { min: '15:54', count: 10260 },
    { min: '15:55', count: 10602 },
    { min: '15:56', count: 12540 },
    { min: '15:57', count: 14250 },
    { min: '15:58', count: 14022 },
    { min: '15:59', count: 11534 },
  ],
  percentiles: { p50: 273.3, p90: 446.7, p95: 468.1, p99: 485.1, min: -50.7, max: 489.3 },
  resources: {
    oracle:   { cpuPeak: 668, cpuAvg: 127, memPeak: 2683 },
    debezium: { cpuPeak: 1319, cpuAvg: 166, memPeak: 1817 },
    consumer: { cpuPeak: 258, cpuAvg: 167, memPeak: 208 },
    kafka:    { cpuPeak: 1148, cpuAvg: 162, memPeak: 2126 },
  },
};

// Pre-tuning 100K baseline
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

// Dirty-redo post-tuning 100K (for 3-way comparison)
const dirtyTuning = {
  pipelineDeliveryTime: 530.0,
  pipelineTPS: 188.7,
  percentiles: { p50: 298.0, p90: 481.1, p95: 503.7, p99: 523.6 },
  resources: { debezium: { cpuPeak: 1837, memPeak: 1813 } },
};

// Tuning changes
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
doc.rect(0, 0, 595, 45).fill(C.primary);
doc.fontSize(16).fillColor(C.white).font('Helvetica-Bold').text('CDC Pipeline: 100K Clean-Slate Post-Tuning Report', 50, 12);
doc.fontSize(8).fillColor('#a0aec0').font('Helvetica')
  .text('May 12, 2026 | EKS: fiter-us-east-2-dev | Clean redo log + truncated tables | Debezium LogMiner tuning', 50, 32);
y = 55;

// Key Metrics — 4 boxes
const metrics = [
  { label: 'Pipeline TPS', value: `${fmt(test.pipelineTPS)}`, sub: 'tuned + clean', color: C.accent },
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

// 3-way percentile table
y = drawSection(doc, 'Delivery Latency Percentiles (Oracle done → Postgres created_at)', y);
y = drawTable(doc,
  ['Test', 'p50', 'p90', 'p95', 'p99', 'Min', 'Max'],
  [
    ['Pre-Tuning (baseline)', `${preTuning.percentiles.p50}s`, `${preTuning.percentiles.p90}s`, `${preTuning.percentiles.p95}s`, `${preTuning.percentiles.p99}s`, `${preTuning.percentiles.min}s`, `${preTuning.percentiles.max}s`],
    ['Post-Tuning (dirty redo)', `${dirtyTuning.percentiles.p50}s`, `${dirtyTuning.percentiles.p90}s`, `${dirtyTuning.percentiles.p95}s`, `${dirtyTuning.percentiles.p99}s`, '-', '-'],
    ['Post-Tuning (clean redo)', `${test.percentiles.p50}s`, `${test.percentiles.p90}s`, `${test.percentiles.p95}s`, `${test.percentiles.p99}s`, `${test.percentiles.min}s`, `${test.percentiles.max}s`],
  ],
  50, y, [110, 50, 50, 50, 50, 55, 55],
  { fontSize: 7, rowHeight: 14 }
);
doc.fontSize(7).fillColor(C.muted).font('Helvetica')
  .text('Clean redo log improved p99 from 523.6s (dirty) to 485.1s, but both are slower than pre-tuning 248.1s baseline.', 50, y, { width: 495 });
y += 18;

// Arrival rate chart
y = drawSection(doc, 'Record Arrival Rate (per minute)', y);
y = drawBarChart(doc,
  test.recordsByMinute.map(d => ({ label: d.min.slice(-5), value: d.count })),
  50, y, 495, 130,
  { title: 'Records arriving in PostgreSQL per minute', yLabel: 'Count', color: C.accent, maxVal: 16000 }
);
doc.fontSize(7).fillColor(C.text).font('Helvetica')
  .text(`Steady ramp from 1,425 to 14,250 rec/min. Pipeline streamed records 50.7s before Oracle INSERT completed. Peak: ${test.peakArrival} rec/min.`, 50, y, { width: 495 });
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
  50, y, 495, 110, { title: `Oracle XE CPU (millicores) — peak ${test.resources.oracle.cpuPeak}m`, yLabel: 'mCPU', color: C.oracle, maxVal: 800 });
y += 5;

y = drawSection(doc, 'CPU Usage: Debezium Connect (Tuned)', y);
y = drawBarChart(doc, debeziumData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: `Debezium Connect CPU (millicores) — peak ${test.resources.debezium.cpuPeak}m`, yLabel: 'mCPU', color: C.debezium, maxVal: 2000 });
y += 5;

y = drawSection(doc, 'CPU Usage: Synapse Consumer', y);
y = drawBarChart(doc, consumerData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: `Synapse Consumer CPU (millicores) — peak ${test.resources.consumer.cpuPeak}m`, yLabel: 'mCPU', color: C.consumer, maxVal: 400 });
y += 5;

y = drawSection(doc, 'CPU Usage: Kafka Broker 0', y);
y = drawBarChart(doc, kafkaData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 110, { title: `Kafka Broker 0 CPU (millicores) — peak ${test.resources.kafka.cpuPeak}m`, yLabel: 'mCPU', color: C.kafka, maxVal: 1200 });

// ============ PAGE 3: MEMORY + COMPARISON + FINDINGS ============
doc.addPage();
y = 50;

// Side-by-side memory charts
y = drawSection(doc, 'Memory Usage: Debezium & Oracle', y);
const memY = y;
y = drawBarChart(doc, debeziumData.map(d => ({ label: d.time, value: d.mem })),
  50, memY, 240, 110, { title: `Debezium Memory (MiB) — peak ${test.resources.debezium.memPeak}`, yLabel: 'MiB', color: C.debezium, maxVal: 2048 });
drawBarChart(doc, oracleData.map(d => ({ label: d.time, value: d.mem })),
  300, memY, 245, 110, { title: `Oracle Memory (MiB) — peak ${test.resources.oracle.memPeak}`, yLabel: 'MiB', color: C.oracle, maxVal: 4096 });
y += 8;

// 3-way throughput comparison
y = drawSection(doc, 'Throughput Comparison: 3 Test Runs', y);
y = drawTable(doc,
  ['Metric', 'Pre-Tuning', 'Post-Tuning (dirty)', 'Post-Tuning (clean)', 'Clean vs Pre'],
  [
    ['Oracle INSERT', `${preTuning.oracleDbTime}s`, '67.4s', `${test.oracleInsertTime}s`, `${fmt(test.oracleInsertTime - preTuning.oracleDbTime)}s`],
    ['Pipeline Delivery', `${preTuning.pipelineDeliveryTime}s`, `${dirtyTuning.pipelineDeliveryTime}s`, `${test.pipelineDeliveryTime}s`, `+${fmt(test.pipelineDeliveryTime - preTuning.pipelineDeliveryTime, 0)}s`],
    ['Pipeline TPS', `${preTuning.pipelineTPS}`, `${dirtyTuning.pipelineTPS}`, `${test.pipelineTPS}`, `${fmt(test.pipelineTPS - preTuning.pipelineTPS)}`],
    ['p50 Latency', `${preTuning.percentiles.p50}s`, `${dirtyTuning.percentiles.p50}s`, `${test.percentiles.p50}s`, `+${fmt(test.percentiles.p50 - preTuning.percentiles.p50, 0)}s`],
    ['p99 Latency', `${preTuning.percentiles.p99}s`, `${dirtyTuning.percentiles.p99}s`, `${test.percentiles.p99}s`, `+${fmt(test.percentiles.p99 - preTuning.percentiles.p99, 0)}s`],
  ],
  50, y, [90, 80, 95, 95, 75],
  { fontSize: 7, rowHeight: 14 }
);
y += 5;

// Resource comparison
y = drawSection(doc, 'Resource Usage: Pre-Tuning vs Clean Post-Tuning', y);
y = drawTable(doc,
  ['Pod', 'CPU Pre', 'CPU Post', '\u0394 CPU', 'Mem Pre', 'Mem Post', '\u0394 Mem'],
  [
    ['Oracle XE', '490m', `${test.resources.oracle.cpuPeak}m`, `+${test.resources.oracle.cpuPeak - preTuning.resources.oracle.cpuPeak}m`, '2,748 Mi', `${test.resources.oracle.memPeak} Mi`, `${test.resources.oracle.memPeak - preTuning.resources.oracle.memPeak} Mi`],
    ['Debezium', '515m', `${test.resources.debezium.cpuPeak}m`, `+${test.resources.debezium.cpuPeak - preTuning.resources.debezium.cpuPeak}m`, '948 Mi', `${test.resources.debezium.memPeak} Mi`, `+${test.resources.debezium.memPeak - preTuning.resources.debezium.memPeak} Mi`],
    ['Consumer', '238m', `${test.resources.consumer.cpuPeak}m`, `+${test.resources.consumer.cpuPeak - preTuning.resources.consumer.cpuPeak}m`, '245 Mi', `${test.resources.consumer.memPeak} Mi`, `${test.resources.consumer.memPeak - preTuning.resources.consumer.memPeak} Mi`],
    ['Kafka 0', '744m', `${test.resources.kafka.cpuPeak}m`, `+${test.resources.kafka.cpuPeak - preTuning.resources.kafka.cpuPeak}m`, '2,120 Mi', `${test.resources.kafka.memPeak} Mi`, `+${test.resources.kafka.memPeak - preTuning.resources.kafka.memPeak} Mi`],
  ],
  50, y, [75, 55, 60, 55, 60, 65, 60],
  { fontSize: 7, rowHeight: 14 }
);
y += 8;

// Findings
y = drawSection(doc, 'Key Findings', y);

const findings = [
  ['Clean redo log confirmed: dirty redo added ~8% overhead, not the primary issue',
   'Clean-slate test delivered in 489.3s vs 530.0s with dirty redo (7.7% improvement). However, pre-tuning baseline was 257.4s — ' +
   'proving the tuning parameters themselves caused the regression, not redo log contamination.'],
  ['Tuning increased Debezium CPU 2.6x without proportional throughput gain',
   `Debezium CPU peaked at ${test.resources.debezium.cpuPeak}m (clean) vs 515m pre-tuning — a 2.6x increase. ` +
   `Memory rose from 948 to ${test.resources.debezium.memPeak} MiB (+92%). Pipeline TPS dropped from 318.1 to ${test.pipelineTPS} (-35.8%). ` +
   'The aggressive LogMiner batch sizes and polling intervals create overhead that exceeds the benefit at 100K scale.'],
  ['Arrival rate pattern shifted from step-function to smooth ramp',
   `Peak arrival rate was ${test.peakArrival} rec/min vs 15,696 pre-tuning. The smoother ramp suggests Debezium is processing ` +
   'in larger but less frequent batches, delivering steadily rather than in bursts. This is better for downstream stability but slower overall.'],
  ['Recommendation: Revert LogMiner tuning, keep resource increases',
   'The resource increases (CPU 500m/2000m, Memory 2Gi/3Gi, Heap 1536m) provide safety margins for large batches. ' +
   'However, the LogMiner tuning parameters (batch.size.max 500K, poll.interval 100ms) should be reverted to defaults — ' +
   'they cause more CPU overhead than throughput benefit at this scale. Test at 1M+ scale before committing to LogMiner tuning.'],
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
    .text(`CDC Pipeline 100K Clean-Slate Post-Tuning Report — ${new Date().toISOString()} | Page ${i + 1}/${pageCount}`, 50, 780, { width: 495, align: 'center' });
}

doc.end();
console.log(`PDF generated: ${OUTPUT_FILE}`);
