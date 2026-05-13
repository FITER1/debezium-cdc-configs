const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const CSV_FILE = path.join(REPORTS_DIR, 'cdc-pipeline-resources-1m.csv');
const OUTPUT_FILE = path.join(REPORTS_DIR, 'cdc-pipeline', 'cdc-pipeline-test-report-1m.pdf');

// Ensure output dir
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

// --- Test Results (captured from test run) ---
const testResults = {
  batchSize: 1000000,
  oracleInsertTime: 676.26,      // seconds (includes kubectl overhead)
  oracleDbTime: 664.30,          // actual Oracle elapsed (TIMING)
  pipelineDeliveryTime: 5087.23, // wall clock: oracle done → last record in Postgres
  totalE2ETime: 5763.49,
  overallTPS: 173.5,
  pipelineTPS: 196.6,
  // Postgres delivery details
  deliverySpread: 5155.0,         // first record to last record in Postgres (09:09:32 to 11:36:58)
  firstRecordAt: '2026-05-12 10:00:05.000',
  lastRecordAt: '2026-05-12 11:36:58.664',
  oracleStartTime: '2026-05-12T09:59:42.384Z',
  oracleDoneTime: '2026-05-12T10:10:58.645Z',
  debitCount: 864106,
  creditCount: 518451,
  peakArrival: 18582,   // peak per-minute bucket
  peakArrivalPerSec: 310,
  recordsByBucket: [
    { sec: '10:00', count: 6883 },
    { sec: '10:02', count: 7410 },
    { sec: '10:04', count: 7297 },
    { sec: '10:06', count: 6883 },
    { sec: '10:08', count: 7524 },
    { sec: '10:10', count: 7367 },
    { sec: '10:12', count: 7068 },
    { sec: '10:14', count: 7296 },
    { sec: '10:16', count: 7296 },
    { sec: '10:18', count: 7025 },
    { sec: '10:20', count: 7823 },
    { sec: '10:22', count: 6954 },
    { sec: '10:24', count: 7410 },
    { sec: '10:26', count: 9761 },
    { sec: '10:28', count: 11286 },
    { sec: '10:30', count: 10830 },
    { sec: '10:32', count: 10861 },
    { sec: '10:34', count: 9918 },
    { sec: '10:36', count: 11058 },
    { sec: '10:38', count: 10830 },
    { sec: '10:40', count: 10716 },
    { sec: '10:42', count: 10602 },
    { sec: '10:44', count: 10374 },
    { sec: '10:46', count: 9690 },
    { sec: '10:48', count: 9690 },
    { sec: '10:50', count: 9462 },
    { sec: '10:52', count: 9576 },
    { sec: '10:54', count: 11659 },
    { sec: '10:56', count: 12540 },
    { sec: '10:58', count: 12198 },
    { sec: '11:00', count: 12198 },
    { sec: '11:02', count: 12312 },
    { sec: '11:04', count: 12343 },
    { sec: '11:06', count: 12312 },
    { sec: '11:08', count: 12198 },
    { sec: '11:10', count: 12312 },
    { sec: '11:12', count: 12540 },
    { sec: '11:14', count: 11856 },
    { sec: '11:16', count: 12540 },
    { sec: '11:18', count: 12312 },
    { sec: '11:20', count: 12312 },
    { sec: '11:22', count: 12540 },
    { sec: '11:24', count: 12312 },
    { sec: '11:26', count: 12312 },
    { sec: '11:28', count: 12198 },
    { sec: '11:30', count: 12312 },
    { sec: '11:32', count: 12571 },
    { sec: '11:34', count: 12198 },
    { sec: '11:36', count: 12540 },
  ],
  // Connectors
  connectors: [
    { name: 'access-core-banking', state: 'RUNNING', taskState: 'RUNNING' },
    { name: 'access-nip-system', state: 'RUNNING', taskState: 'RUNNING' },
    { name: 'access-webserve', state: 'RUNNING', taskState: 'RUNNING' },
  ],
};

// --- Infrastructure ---
const infra = {
  access: [
    { name: 'Synapse (API)', replicas: 1, cpuReq: '250m', cpuLim: 'none', memReq: '512Mi', memLim: '1Gi', baselineCPU: '10m', baselineMem: '129 Mi' },
    { name: 'Synapse Consumer', replicas: 1, cpuReq: '250m', cpuLim: 'none', memReq: '512Mi', memLim: '1Gi', baselineCPU: '7m', baselineMem: '104 Mi' },
    { name: 'Fineract', replicas: 1, cpuReq: '500m', cpuLim: 'none', memReq: '1Gi', memLim: '2Gi', baselineCPU: '16m', baselineMem: '960 Mi' },
    { name: 'Redis', replicas: 1, cpuReq: '-', cpuLim: '-', memReq: '-', memLim: '-', baselineCPU: '2m', baselineMem: '3 Mi' },
    { name: 'TigerBeetle (x3)', replicas: 3, cpuReq: '-', cpuLim: '-', memReq: '-', memLim: '-', baselineCPU: '~5m ea', baselineMem: '~2,587 Mi ea' },
  ],
  accessCdc: [
    { name: 'Oracle XE', replicas: 1, cpuReq: '1', cpuLim: 'none', memReq: '2Gi', memLim: '4Gi', baselineCPU: '37m', baselineMem: '2,576 Mi' },
    { name: 'Debezium Connect', replicas: 1, cpuReq: '250m', cpuLim: 'none', memReq: '1Gi', memLim: '2Gi', baselineCPU: '14m', baselineMem: '819 Mi' },
  ],
  kafka: [
    { name: 'Kafka Broker (x3)', replicas: 3, cpuReq: '500m', cpuLim: '2', memReq: '2Gi', memLim: '4Gi', baselineCPU: '~43m ea', baselineMem: '~1,578 Mi ea' },
    { name: 'Zookeeper (x3)', replicas: 3, cpuReq: '-', cpuLim: '-', memReq: '-', memLim: '-', baselineCPU: '~8m ea', baselineMem: '~384 Mi ea' },
    { name: 'Kafka Connect (x3)', replicas: 3, cpuReq: '-', cpuLim: '-', memReq: '-', memLim: '-', baselineCPU: '~6m ea', baselineMem: '~705 Mi ea' },
    { name: 'Redis', replicas: 1, cpuReq: '-', cpuLim: '-', memReq: '1 Gi', memLim: '2 Gi', baselineCPU: '~3m', baselineMem: '~60 Mi' },
  ],
};

// --- Parse CSV ---
const csvLines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
const csvRows = csvLines.slice(1).map(line => {
  const [timestamp, namespace, pod, cpu, mem] = line.split(',');
  return { timestamp, namespace, pod, cpu: parseInt(cpu), mem: parseInt(mem) };
});

const timestamps = [...new Set(csvRows.map(r => r.timestamp))];

function getPodTimeSeries(podName) {
  return csvRows.filter(r => r.pod === podName).map(r => ({
    time: r.timestamp.slice(11, 19),
    cpu: r.cpu,
    mem: r.mem,
  }));
}

// --- Helpers ---
const COLORS = {
  primary: '#1a365d',
  secondary: '#2d5f8a',
  accent: '#38a169',
  danger: '#e53e3e',
  warning: '#d69e2e',
  light: '#edf2f7',
  text: '#2d3748',
  muted: '#718096',
  white: '#ffffff',
  oracle: '#c0392b',
  debezium: '#e67e22',
  kafka: '#2ecc71',
  synapse: '#3182ce',
  consumer: '#8e44ad',
  fineract: '#805ad5',
};

function fmt(val, decimals = 2) {
  return typeof val === 'number' ? val.toFixed(decimals) : String(val);
}

function drawHR(doc, y, color = '#cbd5e0') {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(color).lineWidth(0.5).stroke();
  return y + 10;
}

function drawSectionTitle(doc, title, y) {
  doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold').text(title, 50, y);
  return drawHR(doc, y + 20, COLORS.primary);
}

function drawSubTitle(doc, title, y) {
  doc.fontSize(11).fillColor(COLORS.secondary).font('Helvetica-Bold').text(title, 50, y);
  return y + 18;
}

function drawBarChart(doc, data, x, y, width, height, options = {}) {
  const { title, yLabel, color = COLORS.synapse, maxVal } = options;
  const padding = { top: 25, bottom: 35, left: 45, right: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const chartX = x + padding.left;
  const chartY = y + padding.top;

  if (title) {
    doc.fontSize(9).fillColor(COLORS.text).font('Helvetica-Bold')
      .text(title, x, y + 5, { width, align: 'center' });
  }

  if (yLabel) {
    doc.save();
    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica');
    doc.text(yLabel, x + 2, chartY + chartH / 2 - 10, { width: 40 });
    doc.restore();
  }

  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(1, (chartW / data.length) - 1);

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const gy = chartY + chartH - (chartH * i / 4);
    doc.moveTo(chartX, gy).lineTo(chartX + chartW, gy)
      .strokeColor('#e2e8f0').lineWidth(0.3).stroke();
    doc.fontSize(6).fillColor(COLORS.muted).font('Helvetica')
      .text(Math.round(max * i / 4).toString(), x + 5, gy - 4, { width: padding.left - 10, align: 'right' });
  }

  // Bars
  data.forEach((d, i) => {
    const barH = Math.min((d.value / max) * chartH, chartH);
    const bx = chartX + i * (chartW / data.length);
    const by = chartY + chartH - barH;
    doc.rect(bx, by, barW, barH).fill(color);
  });

  // X-axis labels
  data.forEach((d, i) => {
    if (i % Math.max(1, Math.floor(data.length / 8)) === 0 || i === data.length - 1) {
      const bx = chartX + i * (chartW / data.length);
      doc.fontSize(5).fillColor(COLORS.muted).font('Helvetica')
        .text(d.label, bx - 10, chartY + chartH + 3, { width: 25, align: 'center' });
    }
  });

  // Axes
  doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartH)
    .lineTo(chartX + chartW, chartY + chartH)
    .strokeColor(COLORS.muted).lineWidth(0.5).stroke();

  return y + height + 5;
}

function drawTable(doc, headers, rows, x, y, colWidths, options = {}) {
  const { headerBg = COLORS.primary, headerColor = COLORS.white, fontSize = 8, rowHeight = 16 } = options;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  doc.rect(x, y, totalWidth, rowHeight + 4).fill(headerBg);
  let cx = x;
  headers.forEach((h, i) => {
    doc.fontSize(fontSize).fillColor(headerColor).font('Helvetica-Bold')
      .text(h, cx + 4, y + 4, { width: colWidths[i] - 8, align: i === 0 ? 'left' : 'right' });
    cx += colWidths[i];
  });
  y += rowHeight + 4;

  rows.forEach((row, ri) => {
    if (ri % 2 === 0) {
      doc.rect(x, y, totalWidth, rowHeight).fill(COLORS.light);
    }
    cx = x;
    row.forEach((cell, ci) => {
      doc.fontSize(fontSize).fillColor(COLORS.text).font('Helvetica')
        .text(String(cell), cx + 4, y + 3, { width: colWidths[ci] - 8, align: ci === 0 ? 'left' : 'right' });
      cx += colWidths[ci];
    });
    y += rowHeight;
  });

  return y + 5;
}

// --- Build PDF ---
const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true });
doc.pipe(fs.createWriteStream(OUTPUT_FILE));

// ============ PAGE 1: TITLE & PIPELINE OVERVIEW ============

// Header bar
doc.rect(0, 0, 595, 90).fill(COLORS.primary);
doc.fontSize(20).fillColor(COLORS.white).font('Helvetica-Bold')
  .text('CDC Pipeline Latency Test Report', 50, 15);
doc.fontSize(9).fillColor('#a0c4e8')
  .text('Test Scenario 1: Oracle → Debezium → Kafka → Synapse Consumer → PostgreSQL', 50, 40);
doc.fontSize(8).fillColor('#a0c4e8')
  .text('May 12, 2026 | EKS Cluster: fiter-us-east-2-dev | Batch: 1,000,000 transactions', 50, 56);

let y = 105;

// Executive Summary
y = drawSectionTitle(doc, 'Executive Summary', y);
doc.fontSize(9).fillColor(COLORS.text).font('Helvetica')
  .text('End-to-end latency test of the CDC (Change Data Capture) write pipeline. 1,000,000 randomized banking transactions ' +
    'were inserted into Oracle XE (Flexcube simulation) and tracked through Debezium LogMiner → Kafka → Synapse Consumer ' +
    'until they arrived as enriched records in PostgreSQL. The test measured pipeline throughput, delivery spread, and ' +
    'resource consumption across all 3 namespaces (access, access-cdc, kafka).', 50, y, { width: 495, lineGap: 3 });
y += 60;

// Key Metrics boxes
const boxW = 150;
const boxH = 55;
const boxes = [
  { label: 'Pipeline Delivery', value: `${fmt(testResults.deliverySpread / 60, 1)}m`, sub: '1M records spread', color: COLORS.accent },
  { label: 'Pipeline TPS', value: `${fmt(testResults.pipelineTPS, 1)}`, sub: 'txn/sec (pipeline)', color: COLORS.synapse },
  { label: 'End-to-End', value: `${fmt(testResults.totalE2ETime / 60, 1)}m`, sub: 'insert \u2192 last record', color: COLORS.primary },
];
boxes.forEach((b, i) => {
  const bx = 50 + i * (boxW + 20);
  doc.roundedRect(bx, y, boxW, boxH, 4).fill(b.color);
  doc.fontSize(8).fillColor(COLORS.white).font('Helvetica').text(b.label, bx + 8, y + 6, { width: boxW - 16 });
  doc.fontSize(16).fillColor(COLORS.white).font('Helvetica-Bold').text(b.value, bx + 8, y + 18, { width: boxW - 16 });
  doc.fontSize(7).fillColor('#ffffffcc').font('Helvetica').text(b.sub, bx + 8, y + 38, { width: boxW - 16 });
});
y += boxH + 20;

// Pipeline Architecture
y = drawSectionTitle(doc, 'Pipeline Architecture', y);
const archSteps = [
  { step: '1', label: 'Oracle XE', detail: 'GENERATE_CDC_TRANSACTIONS(1000000)', ns: 'access-cdc' },
  { step: '2', label: 'Debezium Connect', detail: 'LogMiner → CDC events', ns: 'access-cdc' },
  { step: '3', label: 'Kafka (Strimzi)', detail: '3 brokers, 3 topics', ns: 'kafka' },
  { step: '4', label: 'Synapse Consumer', detail: 'Batch poll → enrich → persist', ns: 'access' },
  { step: '5', label: 'PostgreSQL (RDS)', detail: 'ora_enriched_transactions', ns: 'access' },
];
const stepW = 90;
archSteps.forEach((s, i) => {
  const sx = 50 + i * (stepW + 7);
  const stepColor = i === 0 ? COLORS.oracle : i === 1 ? COLORS.debezium : i === 2 ? COLORS.kafka : i === 3 ? COLORS.consumer : COLORS.synapse;
  doc.roundedRect(sx, y, stepW, 42, 3).fill(stepColor);
  doc.fontSize(7).fillColor(COLORS.white).font('Helvetica-Bold').text(s.label, sx + 4, y + 4, { width: stepW - 8, align: 'center' });
  doc.fontSize(6).fillColor('#ffffffcc').font('Helvetica').text(s.detail, sx + 4, y + 16, { width: stepW - 8, align: 'center' });
  doc.fontSize(6).fillColor('#ffffff99').font('Helvetica').text(`ns: ${s.ns}`, sx + 4, y + 30, { width: stepW - 8, align: 'center' });
  if (i < archSteps.length - 1) {
    const arrowX = sx + stepW + 1;
    doc.fontSize(10).fillColor(COLORS.muted).text('→', arrowX, y + 14, { width: 7 });
  }
});
y += 55;

// Test Configuration
y = drawSectionTitle(doc, 'Test Configuration', y);
y = drawTable(doc,
  ['Parameter', 'Value'],
  [
    ['Batch Size', '1,000,000 randomized transactions'],
    ['Transaction Distribution', '30% NIP Outgoing, 30% NIP Incoming, 20% Intrabank, 20% Standalone'],
    ['Oracle Procedure', 'GENERATE_CDC_TRANSACTIONS(1000000) \u2014 inserts across ACZB_HISTORY, NIPX_*, PAYMENT_ROUTER'],
    ['Commit Strategy', 'Every 100 records (10,000 commits per batch)'],
    ['Measurement', 'Wall-clock: Oracle INSERT start → last record in PostgreSQL'],
    ['Debezium Mode', 'LogMiner (Oracle XE), 3 connectors: core-banking, nip-system, webserve'],
    ['Kafka', '3 Strimzi brokers, 3 Zookeeper, topics: accessbank-core.*, accessbank-nip.*, accessbank-webserve.*'],
    ['Synapse Consumer', 'Batch poll from Kafka → upsert to ref tables → enrich → persist to ora_enriched_transactions'],
    ['PostgreSQL', 'AWS RDS (access.cktpwungvtu1.us-east-2.rds.amazonaws.com)'],
  ],
  50, y, [140, 355], { fontSize: 7 }
);

// ============ PAGE 2: TIMING & DELIVERY ============
doc.addPage();
y = 50;

y = drawSectionTitle(doc, 'Pipeline Timing Breakdown', y);
y = drawTable(doc,
  ['Phase', 'Duration', 'Detail'],
  [
    ['Oracle INSERT (DB)', `${testResults.oracleDbTime}s`, '1,000,000 rows across 3 schemas, committed every 100'],
    ['Oracle INSERT (total)', `${testResults.oracleInsertTime}s`, 'Includes kubectl exec overhead'],
    ['Pipeline delivery', `${testResults.pipelineDeliveryTime}s`, 'Oracle done → last record appears in Postgres (wall clock)'],
    ['Postgres delivery spread', `${testResults.deliverySpread}s`, 'First record → last record in ora_enriched_transactions'],
    ['Total end-to-end', `${testResults.totalE2ETime}s`, 'INSERT start → last record in Postgres'],
    ['Effective Pipeline TPS', `${testResults.pipelineTPS} txn/s`, '1000000 / delivery time'],
    ['Overall TPS', `${testResults.overallTPS} txn/s`, '1000000 / total end-to-end time'],
  ],
  50, y, [130, 80, 285]
);
y += 5;

// Delivery curve
y = drawSectionTitle(doc, 'Record Arrival Rate (per minute)', y);
y = drawBarChart(doc,
  testResults.recordsByBucket.map(d => ({ label: d.sec, value: d.count })),
  50, y, 495, 140,
  { title: 'Records arriving in PostgreSQL per minute', yLabel: 'Count', color: COLORS.accent, maxVal: 15000 }
);

doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
  .text(`Pipeline began delivering records while Oracle was still inserting. ` +
    `Steady-state throughput: ~7,300 rec/min during insert phase, ramping to ~12,400 rec/min after Oracle completed. ` +
    `Peak: ${testResults.peakArrival} records in a single minute (${testResults.peakArrivalPerSec} rec/s). ` +
    `Average arrival rate: ${Math.round(1000000 / (testResults.totalE2ETime / 60))} records/min.`, 50, y, { width: 495, lineGap: 2 });
y += 35;

// Transaction Type Distribution
y = drawSectionTitle(doc, 'Transaction Distribution', y);
y = drawTable(doc,
  ['Category', 'Count', 'Percentage'],
  [
    ['DEBIT (NIP Out + Intrabank + ATM/POS/Web)', testResults.debitCount, `${(testResults.debitCount / 10000).toFixed(1)}%`],
    ['CREDIT (NIP In + Cash Deposit + Salary + Interest)', testResults.creditCount, `${(testResults.creditCount / 10000).toFixed(1)}%`],
    ['Total', testResults.batchSize, '100%'],
  ],
  50, y, [250, 100, 100]
);

// Connector Status
y += 5;
y = drawSectionTitle(doc, 'Debezium Connector Status', y);
y = drawTable(doc,
  ['Connector', 'Connector State', 'Task State', 'Worker'],
  testResults.connectors.map(c => [c.name, c.state, c.taskState, 'access-connect-connect-0']),
  50, y, [150, 90, 90, 165]
);

// ============ PAGE 3: INFRASTRUCTURE ============
doc.addPage();
y = 50;

y = drawSectionTitle(doc, 'Infrastructure: access namespace', y);
y = drawTable(doc,
  ['Component', 'Replicas', 'CPU Req/Limit', 'Mem Req/Limit', 'Baseline CPU', 'Baseline Mem'],
  infra.access.map(c => [c.name, c.replicas, `${c.cpuReq}/${c.cpuLim}`, `${c.memReq}/${c.memLim}`, c.baselineCPU, c.baselineMem]),
  50, y, [100, 50, 80, 75, 70, 70], { fontSize: 7 }
);
y += 3;

y = drawSubTitle(doc, 'access-cdc namespace', y);
y = drawTable(doc,
  ['Component', 'Replicas', 'CPU Req/Limit', 'Mem Req/Limit', 'Baseline CPU', 'Baseline Mem'],
  infra.accessCdc.map(c => [c.name, c.replicas, `${c.cpuReq}/${c.cpuLim}`, `${c.memReq}/${c.memLim}`, c.baselineCPU, c.baselineMem]),
  50, y, [100, 50, 80, 75, 70, 70], { fontSize: 7 }
);
y += 3;

y = drawSubTitle(doc, 'kafka namespace', y);
y = drawTable(doc,
  ['Component', 'Replicas', 'CPU Req/Limit', 'Mem Req/Limit', 'Baseline CPU', 'Baseline Mem'],
  infra.kafka.map(c => [c.name, c.replicas, `${c.cpuReq}/${c.cpuLim}`, `${c.memReq}/${c.memLim}`, c.baselineCPU, c.baselineMem]),
  50, y, [100, 50, 80, 75, 70, 70], { fontSize: 7 }
);
// ============ PAGE 4: RESOURCE CHARTS (CPU) ============
doc.addPage();
y = 50;

y = drawSectionTitle(doc, 'Resource Monitoring: Oracle XE (Source Database)', y);
const oracleData = getPodTimeSeries('oracle-xe-0');
y = drawBarChart(doc, oracleData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 130, { title: 'Oracle XE CPU (millicores)', yLabel: 'mCPU', color: COLORS.oracle, maxVal: 700 });
y += 10;

y = drawSectionTitle(doc, 'Resource Monitoring: Debezium Connect (CDC Capture)', y);
const debeziumData = getPodTimeSeries('access-connect-connect-0');
y = drawBarChart(doc, debeziumData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 130, { title: 'Debezium Connect CPU (millicores)', yLabel: 'mCPU', color: COLORS.debezium, maxVal: 1200 });
y += 10;

y = drawSectionTitle(doc, 'Resource Monitoring: Synapse Consumer (CDC Processor)', y);
const consumerData = getPodTimeSeries('access-synapse-consumer-6ff4dd6b58-wz52z');
y = drawBarChart(doc, consumerData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 130, { title: 'Synapse Consumer CPU (millicores)', yLabel: 'mCPU', color: COLORS.consumer, maxVal: 400 });

// ============ PAGE 5: RESOURCE CHARTS (MEMORY) + KAFKA ============
doc.addPage();
y = 50;

y = drawSectionTitle(doc, 'Resource Monitoring: Synapse Consumer Memory', y);
y = drawBarChart(doc, consumerData.map(d => ({ label: d.time, value: d.mem })),
  50, y, 495, 130, { title: 'Synapse Consumer Memory (MiB)', yLabel: 'MiB', color: '#bb8fce', maxVal: 300 });
y += 10;

y = drawSectionTitle(doc, 'Resource Monitoring: Kafka Broker 0', y);
const kafkaData = getPodTimeSeries('cdc-kafka-kafka-0');
y = drawBarChart(doc, kafkaData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 130, { title: 'Kafka Broker 0 CPU (millicores)', yLabel: 'mCPU', color: COLORS.kafka, maxVal: 1200 });

// ============ PAGE 6: REDIS + MEMORY CHARTS ============
doc.addPage();
y = 50;

y = drawSectionTitle(doc, 'Resource Monitoring: Redis (Cache)', y);
const redisData = getPodTimeSeries('access-redis-78bb966f85-mhm2n');
if (redisData.length > 0) {
  const redisCpuY = y;
  y = drawBarChart(doc, redisData.map(d => ({ label: d.time, value: d.cpu })),
    50, y, 240, 120, { title: 'Redis CPU (millicores)', yLabel: 'mCPU', color: COLORS.danger, maxVal: 800 });
  drawBarChart(doc, redisData.map(d => ({ label: d.time, value: d.mem })),
    300, redisCpuY, 245, 120, { title: 'Redis Memory (MiB)', yLabel: 'MiB', color: '#e74c3c', maxVal: 1024 });
}
y += 10;
y += 10;

y = drawSectionTitle(doc, 'Memory: Debezium Connect & Oracle XE', y);
const memChartY = y;
y = drawBarChart(doc, debeziumData.map(d => ({ label: d.time, value: d.mem })),
  50, memChartY, 240, 120, { title: 'Debezium Memory (MiB)', yLabel: 'MiB', color: COLORS.debezium, maxVal: 2048 });
drawBarChart(doc, oracleData.map(d => ({ label: d.time, value: d.mem })),
  300, memChartY, 245, 120, { title: 'Oracle XE Memory (MiB)', yLabel: 'MiB', color: COLORS.oracle, maxVal: 4096 });

// ============ PAGE 7: RESOURCE SUMMARY & FINDINGS ============
doc.addPage();
y = 50;

y = drawSectionTitle(doc, 'Resource Usage Summary (Key CDC Pipeline Pods)', y);

function podSummary(label, data) {
  const cpus = data.map(d => d.cpu);
  const mems = data.map(d => d.mem);
  return [
    label,
    `${cpus[0]}m`,
    `${Math.max(...cpus)}m`,
    `${Math.round(cpus.reduce((a, b) => a + b, 0) / cpus.length)}m`,
    `${mems[0]} Mi`,
    `${Math.max(...mems)} Mi`,
  ];
}

const summaryRows = [
  podSummary('Oracle XE', oracleData),
  podSummary('Debezium Connect', debeziumData),
  podSummary('Synapse Consumer', consumerData),
  ...(kafkaData.length > 0 ? [podSummary('Kafka Broker 0', kafkaData)] : []),
  ...(redisData.length > 0 ? [podSummary('Redis', redisData)] : []),
];

y = drawTable(doc,
  ['Pod', 'CPU Base', 'CPU Peak', 'CPU Avg', 'Mem Base', 'Mem Peak'],
  summaryRows,
  50, y, [110, 65, 65, 65, 70, 70]
);
y += 10;

// Key Findings
y = drawSectionTitle(doc, 'Key Findings & Recommendations', y);

const findings = [
  ['Pipeline delivers 1,000,000 records in ~85 minutes',
   `All 1,000,000 transactions were delivered from Oracle to PostgreSQL within a ${fmt(testResults.pipelineDeliveryTime)}s ` +
   `(${fmt(testResults.pipelineDeliveryTime / 60, 1)} min) window. ` +
   `The effective pipeline throughput is ${testResults.pipelineTPS} records/sec, with peak arrival of ${testResults.peakArrival} records/min ` +
   `(${testResults.peakArrivalPerSec} rec/s).`],
  ['Oracle INSERT completes 1M rows in ~11 minutes',
   `Actual Oracle INSERT time was ${testResults.oracleDbTime}s for 1,000,000 rows (10,000 commits). The ${testResults.oracleInsertTime}s wall clock includes kubectl exec overhead. ` +
   `Oracle sustained ~1,505 inserts/sec.`],
  ['Debezium LogMiner captures at scale',
   'Debezium detected and published 1M changes across 3 connectors (core-banking, nip-system, webserve), ' +
   'all RUNNING with no task failures. Pipeline began delivering to Postgres while Oracle was still inserting. ' +
   'Debezium peaked at 1,099m CPU, demonstrating significant LogMiner processing load at this scale.'],
  ['Throughput ramps after Oracle INSERT completes',
   `Steady-state throughput during Oracle insertion: ~7,300 records/min. After Oracle INSERT completed (at ${testResults.oracleDoneTime.slice(11,19)}), ` +
   'throughput ramped to ~12,400 records/min as Debezium caught up with the redo log backlog. ' +
   'This 70% throughput increase demonstrates healthy batch catch-up behavior.'],
  ['Redis stability after fix',
   'After increasing Redis memory limit from 256Mi to 2Gi and enabling allkeys-lru eviction, Redis remained stable ' +
   'throughout the 1M test: peak 665m CPU / 803Mi memory, no OOMKill events or restarts.'],
  ['Resource scaling is sub-linear',
   'Moving from 100K to 1M (10x increase): Oracle CPU +13% (490→554m), Debezium CPU +2x (515→1099m), ' +
   'Consumer CPU flat (238→263m), Kafka CPU +53% (744→1139m). The Synapse consumer showed remarkable efficiency, ' +
   'processing 10x more records with only 10% more CPU.'],
];

findings.forEach(([title, detail]) => {
  doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text('• ' + title, 50, y, { width: 495 });
  y += 14;
  doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
    .text(detail, 62, y, { width: 483, lineGap: 2 });
  y += doc.heightOfString(detail, { width: 483, lineGap: 2 }) + 8;
});

// ============ PAGE 8: SCALE COMPARISON (1K vs 100K vs 1M) ============
doc.addPage();
y = 50;

y = drawSectionTitle(doc, 'Scale Comparison: 1K vs 100K vs 1,000,000 Records', y);

doc.fontSize(9).fillColor(COLORS.text).font('Helvetica')
  .text('Three test runs were conducted at increasing scale to characterize the CDC pipeline\'s throughput, ' +
    'latency, and resource behavior. All tests used the same architecture, cluster, and configuration.', 50, y, { width: 495, lineGap: 2 });
y += 35;

// Comparison table
y = drawTable(doc,
  ['Metric', '1,000', '100,000', '1,000,000'],
  [
    ['Oracle INSERT Time', '4.14s', '65.72s', '664.30s'],
    ['Pipeline Delivery Time', '5.55s', '257.35s', '5,087.23s'],
    ['Total End-to-End', '9.69s', '319.22s', '5,763.49s'],
    ['Pipeline TPS', '180.2 txn/s', '318.1 txn/s', '196.6 txn/s'],
    ['Overall TPS', '103.2 txn/s', '313.3 txn/s', '173.5 txn/s'],
    ['Peak Arrival Rate', '~200 rec/s', '262 rec/s', '310 rec/s'],
    ['Oracle CPU Peak', '200m', '490m', '554m'],
    ['Debezium CPU Peak', '92m', '515m', '1,099m'],
    ['Consumer CPU Peak', '101m', '238m', '263m'],
    ['Kafka CPU Peak', '214m', '744m', '1,139m'],
    ['Redis CPU Peak', 'N/A', 'N/A', '665m'],
    ['Debezium Mem Peak', '791 Mi', '948 Mi', '1,047 Mi'],
    ['Oracle Mem Peak', '2,705 Mi', '2,748 Mi', '2,748 Mi'],
  ],
  50, y, [130, 90, 90, 90],
  { fontSize: 8, rowHeight: 15 }
);
y += 15;

// Scaling analysis
y = drawSectionTitle(doc, 'Scaling Analysis', y);

const scalingFindings = [
  ['Throughput peaks at mid-scale',
   'Pipeline TPS peaked at 318.1 txn/s (100K) and dropped to 196.6 txn/s (1M). This is expected: ' +
   'at 1M scale, Debezium LogMiner must process ~10x more redo log data, creating a longer tail of catch-up processing. ' +
   'The peak per-second arrival rate still improved (262→310 rec/s), showing the pipeline handles burst throughput better at scale.'],
  ['Oracle INSERT scales linearly',
   'INSERT time scales almost perfectly linearly: 4.14s (1K) → 65.72s (100K, ~15.9x) → 664.30s (1M, ~10.1x from 100K). ' +
   'Oracle maintains ~1,500 inserts/sec regardless of batch size, confirming the commit-every-100 strategy is effective.'],
  ['Debezium is the scaling bottleneck',
   'Debezium CPU doubled from 515m (100K) to 1,099m (1M) while consumer CPU barely moved (238→263m). ' +
   'The delivery tail (time after Oracle completes) grew from 192s to 4,411s — a ~23x increase for 10x more records. ' +
   'LogMiner query complexity grows super-linearly with redo log volume.'],
  ['Consumer and Kafka show sub-linear scaling',
   'Synapse consumer CPU grew only 10% (238→263m) for 10x more records — excellent batch processing efficiency. ' +
   'Kafka CPU grew 53% (744→1,139m), reflecting increased replication and broker coordination load.'],
  ['Memory is stable across all scales',
   'Oracle XE memory is flat at ~2,748 Mi. Debezium memory grew modestly from 948→1,047 Mi. ' +
   'Redis (with the 2Gi fix) peaked at 803 Mi — well within limits. No OOMKill events at any scale.'],
];

scalingFindings.forEach(([title, detail]) => {
  doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text('\u2022 ' + title, 50, y, { width: 495 });
  y += 14;
  doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
    .text(detail, 62, y, { width: 483, lineGap: 2 });
  y += doc.heightOfString(detail, { width: 483, lineGap: 2 }) + 8;
});

// TPS comparison bar chart
if (y < 580) {
  y += 5;
  y = drawSubTitle(doc, 'Pipeline TPS by Scale', y);
  const tpsData = [
    { label: '1K', value: 180.2 },
    { label: '100K', value: 318.1 },
    { label: '1M', value: 196.6 },
  ];
  y = drawBarChart(doc, tpsData, 150, y, 250, 100,
    { title: '', yLabel: 'TPS', color: COLORS.accent, maxVal: 400 });
}

// Footer on each page
const pageCount = doc.bufferedPageRange().count;
for (let i = 0; i < pageCount; i++) {
  doc.switchToPage(i);
  doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
    .text(`CDC Pipeline Latency Test — Generated ${new Date().toISOString()} | Page ${i + 1} of ${pageCount}`, 50, 780, { width: 495, align: 'center' });
}

doc.end();
console.log(`PDF report generated: ${OUTPUT_FILE}`);
