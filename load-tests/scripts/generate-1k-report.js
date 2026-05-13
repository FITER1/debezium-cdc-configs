const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "..", "reports", "cdc-pipeline");
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const OUTPUT = path.join(REPORTS_DIR, "CDC_Pipeline_1K_Performance_Report.pdf");

const doc = new PDFDocument({ size: "A4", margin: 40 });
const out = fs.createWriteStream(OUTPUT);
doc.pipe(out);

const NAVY="#1a365d",BLUE="#2b6cb0",GREEN="#276749",RED="#c53030",
  ORANGE="#dd6b20",TEAL="#2c7a7b",YELLOW="#d69e2e",GRAY="#718096",
  LGRAY="#e2e8f0",LBGRAY="#f7fafc",WHITE="#fff",DARK="#2d3748";
const L=40, R=555, PW=R-L;

const D = {
  records:1000, oracleRows:2398,
  oracleInsert:0.098, deliveryTime:3.46, totalE2E:5.3,
  cdcLatency:1.8, tps:289.0, peakArrival:415,
  startUTC:"04:57:15 UTC", endUTC:"04:57:20 UTC", date:"May 13, 2026",
  debit:653, credit:347, modRT:810, modAC:140, modIC:50,
  oraAczb:1000, oraNipDC:311, oraNipIC:277, oraPR:810,
  firstArrival:"04:57:16.867", lastArrival:"04:57:20.327",
  arrival:[
    {t:"04:57:16",n:69},{t:"04:57:17",n:415},{t:"04:57:18",n:81},
    {t:"04:57:19",n:228},{t:"04:57:20",n:207},
  ],
  // 100K comparison
  cmp100k:{records:100000,oracleInsert:63.59,deliveryTime:420.8,totalE2E:462.1,tps:216.4},
};

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
  const bW=Math.min(40,(cW/data.length)*0.55),gap=(cW-bW*data.length)/(data.length+1);
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
    doc.font("Helvetica-Bold").fontSize(5.5).fillColor(DARK).text(String(d[vk]),bx-5,by-8,{width:bW+10,align:"center"});
    doc.font("Helvetica").fontSize(5).fillColor(GRAY).text(d[lk],bx-5,cB+2,{width:bW+10,align:"center"});
  });
  return cB+13;
}

function footer(page,total){
  doc.moveTo(L,783).lineTo(R,783).strokeColor(LGRAY).lineWidth(0.4).stroke();
  doc.font("Helvetica").fontSize(6).fillColor(GRAY).text(`CDC Pipeline Performance Report | 1K Transactions | ${D.date} | Page ${page}/${total}`,L,787,{width:PW,align:"center"});
}

/* ====== PAGE 1 ====== */
doc.rect(0,0,595,85).fill(NAVY);
doc.rect(0,0,595,3).fill(GREEN);
doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE).text("CDC Pipeline Performance Report",L,18);
doc.font("Helvetica").fontSize(8.5).fillColor("#a0aec0").text("1,000 Transactions | Oracle XE >> Debezium >> Kafka >> Synapse Consumer >> PostgreSQL",L,43);
doc.font("Helvetica").fontSize(7.5).fillColor("#a0aec0").text(`Date: ${D.date}  |  Cluster: EKS fiter-us-east-2-dev  |  Region: us-east-2  |  Test Start: ${D.startUTC}`,L,58);

const bw=123,bh=60;
kpi(L,93,bw,bh,"Pipeline TPS",String(D.tps),"records / sec",GREEN);
kpi(L+bw+5,93,bw,bh,"Delivery Time",D.deliveryTime+"s","1K records",RED);
kpi(L+2*(bw+5),93,bw,bh,"End-to-End",D.totalE2E+"s","insert >> last arrival",ORANGE);
kpi(L+3*(bw+5),93,bw,bh,"CDC Latency",D.cdcLatency+"s","commit >> first arrival",TEAL,20);

let y=sec("Pipeline Timing",160);
y=tbl(["Phase","Duration","Detail"],[
  ["Oracle INSERT (source)",D.oracleInsert+"s","1,000 transactions >> 2,398 rows across 4 tables (ACZB_HISTORY, NIPX_*, PAYMENT_ROUTER)"],
  ["CDC Capture Latency",D.cdcLatency+"s","Oracle commit >> first record arrives in PostgreSQL"],
  ["CDC Pipeline Delivery",D.deliveryTime+"s","First arrival >> last record lands in PostgreSQL"],
  ["Total End-to-End",D.totalE2E+"s",`INSERT start >> last record in PostgreSQL (${D.startUTC} >> ${D.endUTC})`],
],y,[130,60,325],["left","center","left"]);

y=sec("Oracle Source Table Breakdown",y+5);
y=tbl(["Source Table","Schema","Oracle Rows","Delivered (PG)","Module"],[
  ["ACZB_HISTORY","ABFCUBSLIVE",D.oraAczb.toLocaleString(),"140","AC"],
  ["NIPX_DIRECT_CREDITS","NIPSYSTEM",D.oraNipDC.toLocaleString(),"--","--"],
  ["NIPX_INBOUND_CREDITS","NIPSYSTEM",D.oraNipIC.toLocaleString(),"50","IC"],
  ["PAYMENT_ROUTER_TXN_LOG","WEBSERVE",D.oraPR.toLocaleString(),"810","RT"],
  ["TOTAL","",D.oracleRows.toLocaleString(),D.records.toLocaleString(),""],
],y,[130,90,80,80,135],["left","left","center","center","left"]);

y=sec("Record Arrival Rate (per second)",y+5);
y=bars(D.arrival,L,y+10,PW,85,"","",i=>i===1?RED:GREEN,"t","n");

y=sec("Transaction Breakdown",y+2);
y=tbl(["Category","Count","Percentage"],[
  ["Debit (D)",D.debit.toLocaleString(),(D.debit/D.records*100).toFixed(1)+"%"],
  ["Credit (C)",D.credit.toLocaleString(),(D.credit/D.records*100).toFixed(1)+"%"],
  ["Module: RT (Payment Router)",D.modRT.toLocaleString(),(D.modRT/D.records*100).toFixed(1)+"%"],
  ["Module: AC (Core Banking)",D.modAC.toLocaleString(),(D.modAC/D.records*100).toFixed(1)+"%"],
  ["Module: IC (Inbound Credits)",D.modIC.toLocaleString(),(D.modIC/D.records*100).toFixed(1)+"%"],
],y,[200,100,215],["left","center","center"]);
footer(1,2);

/* ====== PAGE 2 — Architecture + Comparison + Summary ====== */
doc.addPage();
doc.rect(0,0,595,3).fill(GREEN);

y=sec("Pipeline Architecture",14);
doc.font("Helvetica").fontSize(7).fillColor(DARK).text("Oracle XE (3 schemas)  >>  Debezium LogMiner (3 connectors)  >>  Kafka (3-broker Strimzi, 3 partitions/topic)  >>  Synapse Consumer (x2)  >>  PostgreSQL (RDS)",L,y,{width:PW});y+=14;
y=tbl(["Component","Detail"],[
  ["Source Schemas","ABFCUBSLIVE (ACZB_HISTORY), NIPSYSTEM (NIPX_DIRECT_CREDITS, NIPX_INBOUND_CREDITS), WEBSERVE (PAYMENT_ROUTER_TXN_LOG)"],
  ["Debezium Connectors","access-core-banking, access-nip-system, access-webserve"],
  ["Kafka Cluster","3-broker Strimzi cluster (cdc-kafka-kafka-0/1/2), 10 topics x 3 partitions"],
  ["Consumer Config","2 replicas, group.id=synapse-cdc-consumer, max.poll.records=2000, fetch.min.bytes=64KB"],
  ["Target Database","PostgreSQL RDS (ora_enriched_transactions table)"],
  ["Container Platform","Amazon EKS (Kubernetes) across namespaces: access, access-cdc, kafka"],
],y,[120,395],["left","left"]);

y=sec("Scale Comparison: 1K vs 100K",y+8);
y=tbl(["Metric","1K Test","100K Test","Scale Factor"],[
  ["Source Transactions","1,000","100,000","100x"],
  ["Oracle Insert Time",D.oracleInsert+"s",D.cmp100k.oracleInsert+"s",(D.cmp100k.oracleInsert/D.oracleInsert).toFixed(0)+"x"],
  ["CDC Delivery Time",D.deliveryTime+"s",Math.round(D.cmp100k.deliveryTime)+"s",(D.cmp100k.deliveryTime/D.deliveryTime).toFixed(0)+"x"],
  ["Total End-to-End",D.totalE2E+"s",Math.round(D.cmp100k.totalE2E)+"s",(D.cmp100k.totalE2E/D.totalE2E).toFixed(0)+"x"],
  ["Pipeline TPS",D.tps+" TPS",D.cmp100k.tps+" TPS",(D.tps/D.cmp100k.tps).toFixed(1)+"x faster"],
],y,[130,103,103,179],["left","center","center","center"]);

y=sec("Observations",y+8);
const observations = [
  `Pipeline delivered 1,000 enriched transactions in ${D.totalE2E}s end-to-end at ${D.tps} TPS.`,
  `Oracle inserted 2,398 source rows in ${D.oracleInsert}s. Debezium captured and delivered 1,000 enriched records to PostgreSQL in ${D.deliveryTime}s.`,
  `CDC capture latency was ${D.cdcLatency}s (Oracle commit >> first PostgreSQL arrival). Pipeline was already warm from prior activity.`,
  `1K TPS (${D.tps}) is ${(D.tps/D.cmp100k.tps).toFixed(1)}x higher than 100K TPS (${D.cmp100k.tps}). Smaller batches benefit from lower queuing and pipeline overhead.`,
  `Peak arrival rate was ${D.peakArrival} records/sec at 04:57:17 UTC. Delivery burst completed in under 4 seconds.`,
  `Transaction mix: 65.3% Debit, 34.7% Credit. 1,398 Oracle rows were filtered by Debezium Groovy predicates (POV-scoped accounts).`,
  `Note: 1,372 residual records from a prior 1M test were also flushed from the Kafka pipeline during this run, arriving in a distinct earlier wave (04:56:54-04:57:00) with a 16-second gap before the 1K test data. These are excluded from all metrics above.`,
];
observations.forEach(b=>{
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - "+b,L,y,{width:PW,lineGap:1});
  y+=doc.heightOfString("  - "+b,{width:PW,lineGap:1})+3;
});

footer(2,2);

doc.end();
out.on("finish",()=>console.log("PDF -> " + OUTPUT));
