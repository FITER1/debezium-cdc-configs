const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const JSON_FILE = path.join(REPORTS_DIR, 'monitored-run', 'api-load-test-2026-05-12T07-41-22Z.json');
const CSV_FILE = path.join(REPORTS_DIR, 'resource-usage.csv');
const OUTPUT_FILE = path.join(REPORTS_DIR, 'monitored-run', 'cdc-load-test-report.pdf');

// --- Load data ---
const k6Data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const csvLines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');

// --- Parse CSV ---
const csvHeader = csvLines[0].split(',');
const csvRows = csvLines.slice(1).map(line => {
  const [timestamp, pod, cpu, mem] = line.split(',');
  return { timestamp, pod, cpu: parseInt(cpu), mem: parseInt(mem) };
});

// Group by timestamp
const timestamps = [...new Set(csvRows.map(r => r.timestamp))];

// Get synapse data over time
const synapsePod = 'access-synapse-98df7df7b-rf2fv';
const fineractPod = 'access-fineract-6b5d9956c4-mj5k2';
const consumerPod = 'access-synapse-consumer-6ff4dd6b58-82frq';
const k6Pod = 'k6-api-load-test-c7mlh';

function getPodTimeSeries(podName) {
  return csvRows.filter(r => r.pod === podName).map(r => ({
    time: r.timestamp.slice(11, 19), // HH:MM:SS
    cpu: r.cpu,
    mem: r.mem
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
  synapse: '#3182ce',
  fineract: '#805ad5',
  consumer: '#dd6b20',
  k6: '#38a169',
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

// Draw a simple bar chart
function drawBarChart(doc, data, x, y, width, height, options = {}) {
  const { title, yLabel, color = COLORS.synapse, maxVal } = options;
  const padding = { top: 25, bottom: 35, left: 45, right: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const chartX = x + padding.left;
  const chartY = y + padding.top;

  // Title
  if (title) {
    doc.fontSize(9).fillColor(COLORS.text).font('Helvetica-Bold')
      .text(title, x, y + 5, { width, align: 'center' });
  }

  // Y-axis label
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
    const barH = (d.value / max) * chartH;
    const bx = chartX + i * (chartW / data.length);
    const by = chartY + chartH - barH;
    doc.rect(bx, by, barW, barH).fill(color);
  });

  // X-axis labels (every 5th)
  data.forEach((d, i) => {
    if (i % 5 === 0 || i === data.length - 1) {
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

// Simple table drawer
function drawTable(doc, headers, rows, x, y, colWidths, options = {}) {
  const { headerBg = COLORS.primary, headerColor = COLORS.white, fontSize = 8, rowHeight = 16 } = options;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header
  doc.rect(x, y, totalWidth, rowHeight + 4).fill(headerBg);
  let cx = x;
  headers.forEach((h, i) => {
    doc.fontSize(fontSize).fillColor(headerColor).font('Helvetica-Bold')
      .text(h, cx + 4, y + 4, { width: colWidths[i] - 8, align: i === 0 ? 'left' : 'right' });
    cx += colWidths[i];
  });
  y += rowHeight + 4;

  // Rows
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

// ============ PAGE 1: TITLE & OVERVIEW ============

// Header bar
doc.rect(0, 0, 595, 80).fill(COLORS.primary);
doc.fontSize(22).fillColor(COLORS.white).font('Helvetica-Bold')
  .text('CDC Infrastructure Load Test Report', 50, 20);
doc.fontSize(10).fillColor('#a0c4e8').font('Helvetica')
  .text('Access Bank Nigeria - POV Environment', 50, 48);
doc.fontSize(9).fillColor('#a0c4e8')
  .text('May 12, 2026 | EKS Cluster: fiter-us-east-2-dev', 50, 62);

let y = 100;

// Executive Summary
y = drawSectionTitle(doc, 'Executive Summary', y);
doc.fontSize(9).fillColor(COLORS.text).font('Helvetica')
  .text('Load test of the CDC (Change Data Capture) read path: Synapse API serving savings account transaction data. ' +
    'The test validated throughput, latency, and resource consumption under progressive virtual user loads ' +
    '(100 → 250 → 500 → 500 → 100 VUs over 5 minutes). All thresholds passed with zero errors.', 50, y, { width: 495, lineGap: 3 });
y += 55;

// Key Metrics boxes
const boxW = 115;
const boxH = 55;
const boxes = [
  { label: 'Total Requests', value: '128,990', sub: '0 failures', color: COLORS.accent },
  { label: 'Throughput', value: '428.6 req/s', sub: 'sustained', color: COLORS.synapse },
  { label: 'Avg Latency', value: '1.41 ms', sub: 'p95 = 2.89 ms', color: COLORS.primary },
  { label: 'Error Rate', value: '0.00%', sub: 'all checks pass', color: COLORS.accent },
];
boxes.forEach((b, i) => {
  const bx = 50 + i * (boxW + 10);
  doc.roundedRect(bx, y, boxW, boxH, 4).fill(b.color);
  doc.fontSize(8).fillColor(COLORS.white).font('Helvetica').text(b.label, bx + 8, y + 6, { width: boxW - 16 });
  doc.fontSize(16).fillColor(COLORS.white).font('Helvetica-Bold').text(b.value, bx + 8, y + 18, { width: boxW - 16 });
  doc.fontSize(7).fillColor('#ffffffcc').font('Helvetica').text(b.sub, bx + 8, y + 38, { width: boxW - 16 });
});
y += boxH + 20;

// Test Configuration
y = drawSectionTitle(doc, 'Test Configuration', y);
const m = k6Data.metrics;
y = drawTable(doc,
  ['Parameter', 'Value'],
  [
    ['Test Script', 'api-load-test.js (in-cluster k6 Job)'],
    ['Target Endpoint', 'GET /fineract-provider/api/v1/cdc/savingsaccounts/{id}/transactions'],
    ['Target Service', 'Synapse (access-synapse:8444)'],
    ['VU Stages', '100 VUs (1m) → 250 VUs (1m) → 500 VUs (1m) → 500 VUs (1m) → 100 VUs (1m)'],
    ['Total Duration', `${fmt(m.iterations.values.count / m.iterations.values.rate, 0)}s (~5 min)`],
    ['Think Time', '500ms sleep between iterations'],
    ['k6 Image', 'grafana/k6:0.54.0'],
    ['Execution', 'In-cluster (Kubernetes Job in "access" namespace)'],
  ],
  50, y, [180, 315]
);
y += 10;

// Infrastructure
y = drawSectionTitle(doc, 'Infrastructure (Initial State)', y);
y = drawTable(doc,
  ['Component', 'Replicas', 'CPU Req/Limit', 'Mem Req/Limit', 'Baseline CPU', 'Baseline Mem'],
  [
    ['Synapse', '1', '250m / none', '512Mi / 1Gi', '8m', '148 Mi'],
    ['Synapse Consumer', '1', '250m / none', '512Mi / 1Gi', '10m', '108 Mi'],
    ['Fineract', '1', '500m / none', '1Gi / 2Gi', '7m', '979 Mi'],
    ['Redis', '1', '-', '-', '2m', '3 Mi'],
    ['TigerBeetle (x3)', '3', '-', '-', '4m ea', '~2,587 Mi ea'],
  ],
  50, y, [95, 50, 75, 75, 75, 75]
);

y = drawTable(doc,
  ['Node', 'Type', 'vCPU', 'Memory', 'Baseline CPU', 'Baseline Mem'],
  [
    ['Node 1', 'c6a.large', '2', '~3.8 GB', '38m (1%)', '470 Mi (15%)'],
    ['Node 2', 'c6a.large', '2', '~3.8 GB', '66m (3%)', '2,047 Mi (65%)'],
  ],
  50, y, [65, 70, 50, 75, 85, 100]
);

// ============ PAGE 2: LATENCY & THROUGHPUT ============
doc.addPage();

y = 50;
y = drawSectionTitle(doc, 'HTTP Response Latency', y);
y = drawTable(doc,
  ['Metric', 'Min', 'Avg', 'Median', 'P90', 'P95', 'Max'],
  [
    [
      'http_req_duration',
      fmt(m.http_req_duration.values.min) + ' ms',
      fmt(m.http_req_duration.values.avg) + ' ms',
      fmt(m.http_req_duration.values.med) + ' ms',
      fmt(m.http_req_duration.values['p(90)']) + ' ms',
      fmt(m.http_req_duration.values['p(95)']) + ' ms',
      fmt(m.http_req_duration.values.max) + ' ms',
    ],
    [
      'http_req_waiting',
      fmt(m.http_req_waiting.values.min) + ' ms',
      fmt(m.http_req_waiting.values.avg) + ' ms',
      fmt(m.http_req_waiting.values.med) + ' ms',
      fmt(m.http_req_waiting.values['p(90)']) + ' ms',
      fmt(m.http_req_waiting.values['p(95)']) + ' ms',
      fmt(m.http_req_waiting.values.max) + ' ms',
    ],
    [
      'http_req_sending',
      fmt(m.http_req_sending.values.min, 3) + ' ms',
      fmt(m.http_req_sending.values.avg, 3) + ' ms',
      fmt(m.http_req_sending.values.med, 3) + ' ms',
      fmt(m.http_req_sending.values['p(90)'], 3) + ' ms',
      fmt(m.http_req_sending.values['p(95)'], 3) + ' ms',
      fmt(m.http_req_sending.values.max, 3) + ' ms',
    ],
    [
      'http_req_receiving',
      fmt(m.http_req_receiving.values.min, 3) + ' ms',
      fmt(m.http_req_receiving.values.avg, 3) + ' ms',
      fmt(m.http_req_receiving.values.med, 3) + ' ms',
      fmt(m.http_req_receiving.values['p(90)'], 3) + ' ms',
      fmt(m.http_req_receiving.values['p(95)'], 3) + ' ms',
      fmt(m.http_req_receiving.values.max, 3) + ' ms',
    ],
  ],
  50, y, [90, 60, 62, 62, 62, 62, 62], { fontSize: 7 }
);
y += 5;

// Thresholds
y = drawSectionTitle(doc, 'Threshold Results', y);
const thresholds = [
  { name: 'http_req_duration p(95) < 2000ms', actual: fmt(m.http_req_duration.values['p(95)']) + ' ms', pass: m.http_req_duration.thresholds['p(95)<2000'].ok },
  { name: 'txn_endpoint_latency p(95) < 2000ms', actual: fmt(m.txn_endpoint_latency.values['p(95)']) + ' ms', pass: m.txn_endpoint_latency.thresholds['p(95)<2000'].ok },
  { name: 'txn_error_rate < 5%', actual: fmt(m.txn_error_rate.values.rate * 100) + '%', pass: m.txn_error_rate.thresholds['rate<0.05'].ok },
];
y = drawTable(doc,
  ['Threshold', 'Actual Value', 'Result'],
  thresholds.map(t => [t.name, t.actual, t.pass ? '✓ PASS' : '✗ FAIL']),
  50, y, [250, 120, 80]
);
y += 5;

// Checks
y = drawSectionTitle(doc, 'Checks (Assertions)', y);
const checks = k6Data.root_group.groups[0].checks;
y = drawTable(doc,
  ['Check', 'Passes', 'Fails', 'Pass Rate'],
  checks.map(c => [
    c.name,
    c.passes.toLocaleString(),
    c.fails.toLocaleString(),
    fmt(c.passes / (c.passes + c.fails) * 100) + '%',
  ]),
  50, y, [180, 90, 90, 90]
);
y += 5;

// Data transfer
y = drawSectionTitle(doc, 'Data Transfer', y);
y = drawTable(doc,
  ['Metric', 'Total', 'Rate'],
  [
    ['Data Sent', fmt(m.data_sent.values.count / 1024 / 1024) + ' MB', fmt(m.data_sent.values.rate / 1024) + ' KB/s'],
    ['Data Received', fmt(m.data_received.values.count / 1024 / 1024) + ' MB', fmt(m.data_received.values.rate / 1024) + ' KB/s'],
    ['HTTP Requests', m.http_reqs.values.count.toLocaleString(), fmt(m.http_reqs.values.rate) + ' req/s'],
  ],
  50, y, [150, 150, 150]
);

// ============ PAGE 3: RESOURCE MONITORING ============
doc.addPage();

y = 50;
y = drawSectionTitle(doc, 'Resource Monitoring: Synapse (API Gateway)', y);

const synapseData = getPodTimeSeries(synapsePod);
y = drawBarChart(doc, synapseData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 130, { title: 'Synapse CPU (millicores)', yLabel: 'mCPU', color: COLORS.synapse, maxVal: 1000 });

y = drawBarChart(doc, synapseData.map(d => ({ label: d.time, value: d.mem })),
  50, y, 495, 120, { title: 'Synapse Memory (MiB)', yLabel: 'MiB', color: '#63b3ed', maxVal: 1024 });

// Synapse peak stats
doc.fontSize(8).fillColor(COLORS.text).font('Helvetica');
const synapseCPUs = synapseData.map(d => d.cpu);
const synapseMems = synapseData.map(d => d.mem);
doc.text(`Synapse CPU: baseline ${synapseCPUs[0]}m → peak ${Math.max(...synapseCPUs)}m (${(Math.max(...synapseCPUs) / 250 * 100).toFixed(0)}% of 250m request). ` +
  `Memory: baseline ${synapseMems[0]} Mi → peak ${Math.max(...synapseMems)} Mi (${(Math.max(...synapseMems) / 1024 * 100).toFixed(0)}% of 1Gi limit).`, 50, y, { width: 495 });
y += 25;

y = drawSectionTitle(doc, 'Resource Monitoring: Fineract', y);
const fineractData = getPodTimeSeries(fineractPod);
y = drawBarChart(doc, fineractData.map(d => ({ label: d.time, value: d.cpu })),
  50, y, 495, 120, { title: 'Fineract CPU (millicores)', yLabel: 'mCPU', color: COLORS.fineract, maxVal: 100 });

const fineractCPUs = fineractData.map(d => d.cpu);
doc.fontSize(8).fillColor(COLORS.text).font('Helvetica');
doc.text(`Fineract CPU: baseline ${fineractCPUs[0]}m → peak ${Math.max(...fineractCPUs)}m. Minimal impact — Synapse serves cached/local data without hitting Fineract.`, 50, y, { width: 495 });
y += 25;

// ============ PAGE 4: MORE RESOURCE DATA + SUMMARY ============
doc.addPage();

y = 50;
y = drawSectionTitle(doc, 'Resource Monitoring: k6 Load Generator', y);
const k6Data2 = getPodTimeSeries(k6Pod);
if (k6Data2.length > 0) {
  y = drawBarChart(doc, k6Data2.map(d => ({ label: d.time, value: d.cpu })),
    50, y, 495, 120, { title: 'k6 CPU (millicores)', yLabel: 'mCPU', color: COLORS.k6, maxVal: 500 });
  y = drawBarChart(doc, k6Data2.map(d => ({ label: d.time, value: d.mem })),
    50, y, 495, 110, { title: 'k6 Memory (MiB)', yLabel: 'MiB', color: '#68d391', maxVal: 500 });
}

y += 5;
y = drawSectionTitle(doc, 'Resource Usage Summary Table', y);

// Build summary for key pods
function podSummary(name, data) {
  const cpus = data.map(d => d.cpu);
  const mems = data.map(d => d.mem);
  return [
    name,
    `${cpus[0]}m`,
    `${Math.max(...cpus)}m`,
    `${Math.round(cpus.reduce((a, b) => a + b, 0) / cpus.length)}m`,
    `${mems[0]} Mi`,
    `${Math.max(...mems)} Mi`,
  ];
}

const consumerData = getPodTimeSeries(consumerPod);
y = drawTable(doc,
  ['Pod', 'CPU Base', 'CPU Peak', 'CPU Avg', 'Mem Base', 'Mem Peak'],
  [
    podSummary('Synapse', synapseData),
    podSummary('Fineract', fineractData),
    podSummary('Synapse Consumer', consumerData),
    ...(k6Data2.length > 0 ? [podSummary('k6 Load Generator', k6Data2)] : []),
  ],
  50, y, [110, 65, 65, 65, 70, 70]
);

// ============ PAGE 5: CONCLUSIONS ============
y += 15;
y = drawSectionTitle(doc, 'Key Findings & Recommendations', y);

const findings = [
  ['Sub-millisecond median latency', 'Synapse delivered 1.09ms median response time under 500 concurrent users, well within the 2s p95 threshold (actual p95: 2.89ms).'],
  ['Zero errors at scale', 'All 128,990 requests returned HTTP 200 with valid transaction data. Error rate: 0.00%.'],
  ['CPU scales linearly with load', 'Synapse CPU rose from 8m to 894m peak during 500 VU phase — exceeding its 250m request but within node capacity (no CPU limit configured). This is expected behavior with burstable workloads on Karpenter-managed nodes.'],
  ['Memory stable', 'Synapse memory increased modestly from 148 Mi to 232 Mi peak (23% of 1Gi limit), indicating efficient memory management.'],
  ['Fineract not bottleneck', 'Fineract CPU stayed below 44m throughout, confirming Synapse serves CDC data without proxying to Fineract for reads.'],
  ['Recommendation: Set CPU limit', 'Consider adding a CPU limit (e.g., 1000m) to Synapse to prevent potential noisy-neighbor issues in production.'],
  ['Recommendation: Horizontal scaling', 'With linear CPU scaling, adding replicas + an HPA at 70% CPU target would sustain higher throughput.'],
];

findings.forEach(([title, detail]) => {
  doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text('• ' + title, 50, y, { width: 495 });
  y += 14;
  doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
    .text(detail, 62, y, { width: 483, lineGap: 2 });
  y += doc.heightOfString(detail, { width: 483, lineGap: 2 }) + 8;
});

// Footer on each page
const pageCount = doc.bufferedPageRange().count;
for (let i = 0; i < pageCount; i++) {
  doc.switchToPage(i);
  doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
    .text(`Generated ${new Date().toISOString()} | Page ${i + 1} of ${pageCount}`, 50, 780, { width: 495, align: 'center' });
}

doc.end();
console.log(`PDF report generated: ${OUTPUT_FILE}`);
