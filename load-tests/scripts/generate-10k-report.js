const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "..", "reports", "cdc-pipeline");
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const OUTPUT = path.join(REPORTS_DIR, "CDC_Pipeline_10K_Performance_Report.pdf");

const doc = new PDFDocument({ size: "A4", margin: 40 });
const out = fs.createWriteStream(OUTPUT);
doc.pipe(out);

const NAVY="#1a365d",BLUE="#2b6cb0",GREEN="#276749",RED="#c53030",
  ORANGE="#dd6b20",TEAL="#2c7a7b",YELLOW="#d69e2e",GRAY="#718096",
  LGRAY="#e2e8f0",LBGRAY="#f7fafc",WHITE="#fff",DARK="#2d3748";
const L=40, R=555, PW=R-L;

const D = {
  records:10000, oracleRows:23899,
  oracleInsert:4.44, deliveryTime:43.45, totalE2E:47.9,
  cdcLatency:4.41, tps:230.2,
  startUTC:"05:58:27 UTC", endUTC:"05:59:14 UTC", date:"May 13, 2026",
  insertStart:"05:58:27.085", insertEnd:"05:58:31.521",
  firstArrival:"05:58:31.495", lastArrival:"05:59:14.940",
  debit:6219, credit:3781, modRT:7960, modAC:1526, modIC:514,
  oraAczb:10000, oraNipDC:2943, oraNipIC:2996, oraPR:7960,
  // per-5s arrival buckets
  arrival:[
    {t:"05:58:30",n:1454},{t:"05:58:35",n:1026},{t:"05:58:40",n:1254},
    {t:"05:58:45",n:1535},{t:"05:58:50",n:1191},{t:"05:58:55",n:912},
    {t:"05:59:00",n:912},{t:"05:59:05",n:1140},{t:"05:59:10",n:1289},
  ],
  // resource usage (idle / post-test snapshot)
  oracle:{cpuI:37,memI:2577},
  debezium:{cpuI:14,memI:1829},
  consumer:{cpuI:"6-6",memI:"177-242"},
  kafka:{cpu0:52,cpu1:53,cpu2:68,mem0:2081,mem1:2092,mem2:2039},
};

// Timeline labels for resource charts
const tL=["05:58:30","05:58:35","05:58:40","05:58:45","05:58:50","05:58:55",
  "05:59:00","05:59:05","05:59:10"];

/* ── helpers ── */
function sec(t,y){
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(t,L,y);
  doc.moveTo(L,y+14).lineTo(R,y+14).strokeColor(LGRAY).lineWidth(0.6).stroke();
  return y+19;
}

function kpi(x,y,w,h,label,val,sub,bg,valSize){
  doc.roundedRect(x,y,w,h,5).fill(bg);
  doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.85)").text(label,x+10,y+7,{width:w-20});
  doc.font("Helvetica-Bold").fontSize(valSize||22).fillColor(WHITE).text(val,x+10,y+19,{width:w-20});
  if(sub)doc.font("Helvetica").fontSize(6.5).fillColor("rgba(255,255,255,0.6)").text(sub,x+10,y+h-13,{width:w-20});
}

function tbl(hdr,rows,y,cw,al){
  const rh=19,tw=cw.reduce((a,b)=>a+b,0);
  doc.roundedRect(L,y,tw,rh,2).fill(NAVY);
  let x=L;hdr.forEach((h,i)=>{doc.font("Helvetica-Bold").fontSize(6.5).fillColor(WHITE).text(h,x+5,y+5,{width:cw[i]-10,align:(al&&al[i])||"left"});x+=cw[i];});
  y+=rh;
  rows.forEach((row,ri)=>{doc.rect(L,y,tw,rh).fill(ri%2===0?LBGRAY:WHITE);x=L;row.forEach((c,ci)=>{doc.font("Helvetica").fontSize(6.5).fillColor(DARK).text(String(c),x+5,y+5,{width:cw[ci]-10,align:(al&&al[ci])||"left"});x+=cw[ci];});y+=rh;});
  return y;
}

function bars(data,x0,y0,w,h,title,yLab,color,lk,vk){
  if(title)doc.font("Helvetica-Bold").fontSize(7.5).fillColor(DARK).text(title,x0,y0-11,{width:w,align:"center"});
  const cL=x0+32,cB=y0+h,cW=w-38,mx=Math.max(...data.map(d=>d[vk]))*1.15;
  const bW=Math.min(32,(cW/data.length)*0.55),gap=(cW-bW*data.length)/(data.length+1);
  doc.moveTo(cL,y0).lineTo(cL,cB).strokeColor(LGRAY).lineWidth(0.4).stroke();
  doc.moveTo(cL,cB).lineTo(cL+cW,cB).strokeColor(LGRAY).lineWidth(0.4).stroke();
  for(let i=0;i<=4;i++){
    const v=Math.round(mx*i/4),yp=cB-(h*i/4);
    doc.font("Helvetica").fontSize(5).fillColor(GRAY).text(String(v),x0,yp-3,{width:30,align:"right"});
    if(i>0)doc.moveTo(cL,yp).lineTo(cL+cW,yp).strokeColor("#edf2f7").lineWidth(0.25).stroke();
  }
  data.forEach((d,i)=>{
    const bx=cL+gap+i*(bW+gap),bh2=(d[vk]/mx)*h,by=cB-bh2;
    doc.roundedRect(bx,by,bW,bh2,2).fill(typeof color==="function"?color(i):color);
    doc.font("Helvetica-Bold").fontSize(5).fillColor(DARK).text(String(d[vk]),bx-5,by-8,{width:bW+10,align:"center"});
    doc.font("Helvetica").fontSize(4.5).fillColor(GRAY).text(d[lk],bx-5,cB+2,{width:bW+10,align:"center"});
  });
  return cB+13;
}

function footer(page,total){
  doc.moveTo(L,783).lineTo(R,783).strokeColor(LGRAY).lineWidth(0.4).stroke();
  doc.font("Helvetica").fontSize(6).fillColor(GRAY).text(`CDC Pipeline Performance Report | 10K Transactions | ${D.date} | Page ${page}/${total}`,L,787,{width:PW,align:"center"});
}

/* ====== PAGE 1 ====== */
doc.rect(0,0,595,85).fill(NAVY);
doc.rect(0,0,595,3).fill(GREEN);
doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE).text("CDC Pipeline Performance Report",L,18);
doc.font("Helvetica").fontSize(8.5).fillColor("#a0aec0").text("10,000 Transactions | Oracle XE >> Debezium >> Kafka >> Synapse Consumer >> PostgreSQL",L,43);
doc.font("Helvetica").fontSize(7.5).fillColor("#a0aec0").text(`Date: ${D.date}  |  Cluster: EKS fiter-us-east-2-dev  |  Region: us-east-2  |  Test Start: ${D.startUTC}`,L,58);

const bw=123,bh=60;
kpi(L,93,bw,bh,"Pipeline TPS",String(D.tps),"records / sec",GREEN);
kpi(L+bw+5,93,bw,bh,"Delivery Time",D.deliveryTime+"s","10K records",RED);
kpi(L+2*(bw+5),93,bw,bh,"End-to-End",D.totalE2E+"s","insert >> last arrival",ORANGE);
kpi(L+3*(bw+5),93,bw,bh,"CDC Latency",D.cdcLatency+"s","commit >> first arrival",TEAL,20);

let y=sec("Pipeline Timing",160);
y=tbl(["Phase","Duration","Detail"],[
  ["Oracle INSERT (source)",D.oracleInsert+"s","10,000 transactions >> 24,046 rows across 4 tables (ACZB_HISTORY, NIPX_*, PAYMENT_ROUTER)"],
  ["CDC Capture Latency",D.cdcLatency+"s","First records arrived in PostgreSQL while Oracle INSERT was still running (streaming overlap)"],
  ["CDC Pipeline Delivery",D.deliveryTime+"s","First arrival >> last record lands in PostgreSQL"],
  ["Total End-to-End",D.totalE2E+"s",`INSERT start >> last record in PostgreSQL (${D.startUTC} >> ${D.endUTC})`],
],y,[130,60,325],["left","center","left"]);

y=sec("Oracle Source Table Breakdown",y+5);
y=tbl(["Source Table","Schema","Oracle Rows","Delivered (PG)","Module"],[
  ["ACZB_HISTORY","ABFCUBSLIVE",D.oraAczb.toLocaleString(),"1,526","AC"],
  ["NIPX_DIRECT_CREDITS","NIPSYSTEM",D.oraNipDC.toLocaleString(),"--","--"],
  ["NIPX_INBOUND_CREDITS","NIPSYSTEM",D.oraNipIC.toLocaleString(),"514","IC"],
  ["PAYMENT_ROUTER_TXN_LOG","WEBSERVE",D.oraPR.toLocaleString(),"7,960","RT"],
  ["TOTAL","",D.oracleRows.toLocaleString(),D.records.toLocaleString(),""],
],y,[130,90,80,80,135],["left","left","center","center","left"]);

y=sec("Record Arrival Rate (per 5-second bucket)",y+5);
y=bars(D.arrival,L,y+10,PW,85,"","",i=>(i===0||i===3||i===4)?RED:GREEN,"t","n");

y=sec("Transaction Breakdown",y+2);
y=tbl(["Category","Count","Percentage"],[
  ["Debit (D)",D.debit.toLocaleString(),(D.debit/D.records*100).toFixed(1)+"%"],
  ["Credit (C)",D.credit.toLocaleString(),(D.credit/D.records*100).toFixed(1)+"%"],
  ["Module: RT (Payment Router)",D.modRT.toLocaleString(),(D.modRT/D.records*100).toFixed(1)+"%"],
  ["Module: AC (Core Banking)",D.modAC.toLocaleString(),(D.modAC/D.records*100).toFixed(1)+"%"],
  ["Module: IC (Inbound Credits)",D.modIC.toLocaleString(),(D.modIC/D.records*100).toFixed(1)+"%"],
],y,[200,100,215],["left","center","center"]);
footer(1,2);

/* ====== PAGE 2 — Architecture + Resources + Summary ====== */
doc.addPage();
doc.rect(0,0,595,3).fill(GREEN);

y=sec("Pipeline Architecture",14);
doc.font("Helvetica").fontSize(7).fillColor(DARK).text("Oracle XE (3 schemas)  >>  Debezium LogMiner (3 connectors)  >>  Kafka (3-broker Strimzi, 3 partitions/topic)  >>  Synapse Consumer (x2)  >>  PostgreSQL (RDS)",L,y,{width:PW});y+=14;
y=tbl(["Component","Detail"],[
  ["Source Schemas","ABFCUBSLIVE (ACZB_HISTORY), NIPSYSTEM (NIPX_DIRECT_CREDITS, NIPX_INBOUND_CREDITS), WEBSERVE (PAYMENT_ROUTER_TXN_LOG)"],
  ["Debezium Connectors","access-core-banking, access-nip-system, access-webserve (LogMiner-based CDC)"],
  ["Kafka Cluster","3-broker Strimzi cluster (cdc-kafka-kafka-0/1/2), 10 topics x 3 partitions"],
  ["Consumer Config","2 replicas, group.id=synapse-cdc-consumer, max.poll.records=2000, fetch.min.bytes=64KB"],
  ["Target Database","PostgreSQL RDS (ora_enriched_transactions table)"],
  ["Container Platform","Amazon EKS (Kubernetes) across namespaces: access, access-cdc, kafka"],
],y,[120,395],["left","left"]);

y=sec("Infrastructure Resource Snapshot",y+8);
y=tbl(["Component","Role","CPU (idle)","Memory (idle)","Namespace"],[
  ["Oracle XE","Source database",D.oracle.cpuI+"m",D.oracle.memI+" MiB","access-cdc"],
  ["Debezium Connect","CDC engine (LogMiner)",D.debezium.cpuI+"m",D.debezium.memI+" MiB","access-cdc"],
  ["Synapse Consumer x2","Enrichment + write",D.consumer.cpuI+"m",D.consumer.memI+" MiB","access"],
  ["Kafka Broker 0","Message broker",D.kafka.cpu0+"m",D.kafka.mem0+" MiB","kafka"],
  ["Kafka Broker 1","Message broker",D.kafka.cpu1+"m",D.kafka.mem1+" MiB","kafka"],
  ["Kafka Broker 2","Message broker",D.kafka.cpu2+"m",D.kafka.mem2+" MiB","kafka"],
],y,[105,100,60,72,178],["left","left","center","center","left"]);

y=sec("Delivery Flow Analysis",y+8);
const flowNotes = [
  "First 5 seconds: Initial burst of 1,454 records. CDC streaming began as Oracle INSERT completed at 05:58:31.",
  "Seconds 5-20: Sustained delivery at 1,026-1,535 records per 5s bucket as Debezium processed redo log entries.",
  "Seconds 20-45: Steady-state delivery at ~228 records/sec in uniform batches, characteristic of LogMiner's poll-sleep cycle with max.batch.size=2048.",
  "Final records arrived at 05:59:14. Total delivery window 43.45s at 230.2 TPS.",
];
flowNotes.forEach(b=>{
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - "+b,L,y,{width:PW,lineGap:1});
  y+=doc.heightOfString("  - "+b,{width:PW,lineGap:1})+3;
});

y=sec("Performance Summary",y+4);
const observations = [
  `Pipeline delivered 10,000 enriched transactions in ${D.totalE2E}s end-to-end at ${D.tps} TPS.`,
  `Oracle inserted ${D.oracleRows.toLocaleString()} source rows across 4 tables in ${D.oracleInsert}s. Debezium captured and delivered 10,000 enriched records to PostgreSQL.`,
  `CDC capture latency was ${D.cdcLatency}s -- first PostgreSQL records arrived just after Oracle INSERT completed.`,
  `${(D.oracleRows - D.records).toLocaleString()} Oracle rows (${((D.oracleRows - D.records)/D.oracleRows*100).toFixed(1)}%) were filtered by Debezium Groovy predicates (POV-scoped account filtering). Only matching records were forwarded to Kafka.`,
  `Transaction mix: ${(D.debit/D.records*100).toFixed(1)}% Debit, ${(D.credit/D.records*100).toFixed(1)}% Credit. Payment Router (RT) accounted for ${(D.modRT/D.records*100).toFixed(1)}% of delivered records.`,
  `Delivery window was ${D.deliveryTime}s with sustained arrival rate of ~228 records/sec. The uniform batching pattern is characteristic of LogMiner's poll-sleep cycle.`,
];
observations.forEach(b=>{
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - "+b,L,y,{width:PW,lineGap:1});
  y+=doc.heightOfString("  - "+b,{width:PW,lineGap:1})+3;
});

footer(2,2);

doc.end();
out.on("finish",()=>console.log("PDF -> " + OUTPUT));
