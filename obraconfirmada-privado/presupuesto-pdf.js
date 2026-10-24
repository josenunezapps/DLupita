/* ObraCotiza · PDF comercial autónomo, A4, sin servicios externos. */
(function(){
"use strict";
const PT=595.28,PH=841.89,LEFT=42,RIGHT=553,BOTTOM=779;
const C={navy:[.094,.149,.22],ink:[.14,.2,.28],slate:[.37,.44,.52],line:[.86,.89,.92],pale:[.96,.974,.984],orange:[.86,.48,.27],white:[1,1,1]};
const normal=n=>Math.round((Number(n)||0)*100)/100;
const peso=n=>Number(n||0).toLocaleString("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0,maximumFractionDigits:2});
const dates=d=>{if(!d)return "—";const v=new Date(/^\d{4}-\d\d-\d\d$/.test(d)?d+"T12:00:00":d);return isNaN(v.getTime())?"—":v.toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})};
function totals(data){
 const subtotal=normal((data.lines||[]).reduce((s,x)=>s+(Number(x.qty)||0)*(Number(x.price)||0),0));
 const discountRate=Math.max(0,Math.min(100,Number(data.discountRate)||0));
 const discount=normal(subtotal*discountRate/100);
 const taxable=normal(subtotal-discount);
 const taxRate=Math.max(0,Math.min(100,Number(data.taxRate)||0));
 const tax=normal(taxable*taxRate/100);
 return {subtotal,discount,tax,total:normal(taxable+tax),discountRate,taxRate};
}
const cp1252=input=>{const map={8364:128,8216:145,8217:146,8220:147,8221:148,8211:150,8212:151,8226:149,8482:153};let out="";for(const ch of String(input==null?"":input)){const n=ch.codePointAt(0);out+=String.fromCharCode(n<=255?n:map[n]||63)}return out};
const literal=t=>cp1252(t).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/[\r\n]/g," ");
function build(data,business,environment){
 if(!data||!Array.isArray(data.lines)||!data.lines.length)throw Error("El presupuesto necesita al menos un concepto.");
 business=business||{};
 const pdfTotal=totals(data);
 const extras=(data.changes||[]).filter(x=>x.status==="Aprobado");
 const extrasTotal=normal(extras.reduce((sum,x)=>sum+Number(x.delta||0),0));
 const payable=normal(pdfTotal.total+extrasTotal);
 let jpg=null;
 if(typeof business.logo==="string"&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(business.logo)&&business.logo.length<170000&&Number.isInteger(business.logoW)&&Number.isInteger(business.logoH)&&business.logoW>0&&business.logoW<=500&&business.logoH>0&&business.logoH<=500){
  try{jpg=(environment&&environment.atob||atob)(business.logo.slice(business.logo.indexOf(",")+1))}catch(e){jpg=null}
 }
 let content="",pages=[],y=135;
 const rgb=(a,type)=>a.map(v=>v.toFixed(3)).join(" ")+(type?" RG\n":" rg\n");
 const text=(x,top,value,size=10,bold=false,color=C.ink)=>{content+=rgb(color)+"BT /F"+(bold?"2":"1")+" "+size+" Tf 1 0 0 1 "+x.toFixed(1)+" "+(PH-top).toFixed(1)+" Tm ("+literal(value)+") Tj ET\n"};
 const rect=(x,top,w,h,color)=>{content+=rgb(color)+" "+x.toFixed(1)+" "+(PH-top-h).toFixed(1)+" "+w.toFixed(1)+" "+h.toFixed(1)+" re f\n"};
 const line=(top)=>{content+=rgb(C.line,true)+" .8 w "+LEFT+" "+(PH-top).toFixed(1)+" m "+RIGHT+" "+(PH-top).toFixed(1)+" l S\n"};
 const width=(s,size,bold)=>String(s).split("").reduce((n,c)=>n+(/[il!.,:;'| ]/.test(c)?.26:/[MW@#%]/.test(c)?.84:.54)*size*(bold?1.04:1),0);
 const right=(to,top,value,size=9,bold=false,color=C.ink)=>text(Math.max(LEFT,to-width(value,size,bold)),top,value,size,bold,color);
 function wrap(t,sz,w){const out=[];for(const raw of String(t||"").split(/\r?\n/)){const words=raw.split(/\s+/).filter(Boolean);if(!words.length){out.push("");continue}let curr="";for(let word of words){if(width(word,sz)>w){if(curr){out.push(curr);curr=""}while(width(word,sz)>w){let take="";for(const ch of word){if(width(take+ch,sz)>w&&take)break;take+=ch}out.push(take);word=word.slice(take.length)}}if(!word)continue;const attempt=curr?curr+" "+word:word;if(width(attempt,sz)>w&&curr){out.push(curr);curr=word}else curr=attempt}if(curr)out.push(curr)}return out}
 function startPage(continuation){
  content="";
  rect(0,0,PT,99,C.navy);rect(LEFT,19,4,60,C.orange);
  let xx=LEFT+15;
  if(jpg){content+="q 52 0 0 52 "+(LEFT+13)+" "+(PH-22-52)+" cm /Im1 Do Q\n";xx=LEFT+76}
  const name=String(business.name||"ObraCotiza").slice(0,jpg?31:40);
  text(xx,43,name,Math.min(17,name.length>26?13.5:17),true,C.white);
  text(xx,60,[business.phone,business.email].filter(Boolean).join("  ·  ").slice(0,67)||"PRESUPUESTOS PROFESIONALES",8,false,[.8,.85,.89]);
  text(xx,77,String(business.address||"").slice(0,75),7.5,false,[.7,.79,.85]);
  right(RIGHT,35,"PRESUPUESTO",9,true,[.98,.78,.63]);
  y=126;
  if(continuation){text(LEFT,y,"DETALLE DE TRABAJOS · CONTINUACIÓN",10,true,C.orange);y+=22}
 }
 function next(need){if(y+need<=BOTTOM)return;pages.push(content);startPage(true)}
 function heading(t){next(42);text(LEFT,y,String(t).toUpperCase(),10,true,C.orange);y+=12;line(y);y+=18}
 function paragraph(t,size=9,max=RIGHT-LEFT){const ls=wrap(t,size,max);for(const one of ls){next(16);text(LEFT,y,one,size,false,C.ink);y+=14}y+=7}
 function pair(k,v){const rows=wrap(v||"—",9.2,320);next(15*Math.max(1,rows.length)+4);text(LEFT+4,y,k,8.5,false,C.slate);rows.forEach((row,i)=>text(LEFT+145,y+i*15,row,9.2,i===0,C.ink));y+=Math.max(21,rows.length*15+6)}
 function tableHeader(){next(36);rect(LEFT,y-5,RIGHT-LEFT,29,C.navy);text(LEFT+9,y+12,"CONCEPTO",8,true,C.white);right(LEFT+303,y+12,"CANT.",8,true,C.white);text(LEFT+309,y+12,"UND.",8,true,C.white);right(LEFT+412,y+12,"UNITARIO",8,true,C.white);right(RIGHT-10,y+12,"IMPORTE",8,true,C.white);y+=34}
 function tableLine(item,i){
  const labels=wrap(item.name||"Concepto",9.1,220);let rowH=Math.max(27,labels.length*13+13);
  if(y+rowH>BOTTOM){pages.push(content);startPage(true);tableHeader()}
  if(i%2===1)rect(LEFT,y-7,RIGHT-LEFT,rowH,C.pale);
  labels.forEach((t,j)=>text(LEFT+9,y+7+j*13,t,9.1,j===0,C.ink));
  right(LEFT+303,y+7,Number(item.qty||0).toLocaleString("es-AR",{maximumFractionDigits:3}),8.6);
  text(LEFT+309,y+7,String(item.unit||"u").slice(0,7),8.5);
  right(LEFT+412,y+7,peso(item.price),8.6);
  right(RIGHT-10,y+7,peso(Number(item.qty)*Number(item.price)),8.6,true);
  y+=rowH;
 }
 function summaryRow(name,number,emphasis){next(30);text(LEFT+268,y,name,emphasis?10:9,emphasis,C.ink);right(RIGHT-12,y,peso(number),emphasis?12:10,!!emphasis,C.ink);y+=25}
 startPage(false);
 text(LEFT,y,"PRESUPUESTO DE OBRA",17,true,C.ink);y+=23;
 text(LEFT,y,"N° "+String(data.id||"S/N")+"   ·   Emitido: "+dates(data.issuedAt||new Date().toISOString())+(data.version?"   ·   Versión "+data.version:""),8.5,false,C.slate);y+=28;
 if(data.demo){rect(LEFT,y-9,RIGHT-LEFT,24,[1,.94,.86]);text(LEFT+9,y+7,"EJEMPLO FICTICIO · NO VÁLIDO COMO COTIZACIÓN REAL",8.5,true,[.58,.33,.14]);y+=36}
 heading("Datos del cliente");
 pair("Cliente",data.client);if(data.phone)pair("Contacto",data.phone);pair("Trabajo",data.title);
 if(data.scope){heading("Descripción del trabajo");paragraph(data.scope,9.4)}
 heading("Detalle de materiales y trabajos");tableHeader();
 data.lines.forEach(tableLine);
 if(extras.length){heading("Trabajos adicionales incorporados");extras.forEach(function(x,i){tableLine({name:x.title||"Trabajo adicional",qty:1,unit:"gl",price:Number(x.delta)||0},i)});}
 next(23);line(y+3);y+=20;
 summaryRow("Subtotal",pdfTotal.subtotal);
 if(pdfTotal.discountRate>0)summaryRow("Descuento ("+pdfTotal.discountRate+" %)",-pdfTotal.discount);
 if(pdfTotal.taxRate>0)summaryRow("Impuestos ("+pdfTotal.taxRate+" %)",pdfTotal.tax);
 if(extras.length)summaryRow("Adicionales incorporados",extrasTotal);
 next(69);rect(LEFT+260,y-12,RIGHT-LEFT-260,57,[.98,.94,.9]);
 text(LEFT+273,y+10,"TOTAL FINAL",10,true,C.ink);right(RIGHT-12,y+14,peso(payable),15,true,C.ink);y+=65;
 heading("Condiciones comerciales");
 if(data.payment)pair("Forma de pago",data.payment);
 if(data.validity!=null)pair("Validez",String(data.validity)+" días desde la emisión");
 if(data.delivery)pair("Plazo estimado",data.delivery);
 if(data.notes){heading("Observaciones");paragraph(data.notes,9)}
 next(30);text(LEFT,y,"Documento informativo. No es factura ni certificación de aceptación.",8,false,C.slate);
 pages.push(content);
 const pageCount=pages.length;
 const bodyObjects=[];const obj=s=>{bodyObjects.push(s);return bodyObjects.length};
 const regular=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
 const bold=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
 let imageRef=null;
 if(jpg)imageRef=obj("<< /Type /XObject /Subtype /Image /Width "+business.logoW+" /Height "+business.logoH+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpg.length+" >>\nstream\n"+jpg+"\nendstream");
 const root=obj(""),catalog=obj(""),references=[];
 pages.forEach((pageContent,index)=>{
  const foot=rgb(C.slate)+"BT /F1 8 Tf 1 0 0 1 "+LEFT+" 29 Tm ("+literal(String(business.name||"ObraCotiza")+" · Presupuesto comercial")+") Tj ET\n";
  const number=rgb(C.slate)+"BT /F1 8 Tf 1 0 0 1 516 29 Tm ("+(index+1)+" / "+pageCount+") Tj ET\n";
  const stream=pageContent+foot+number;
  const c=obj("<< /Length "+stream.length+" >>\nstream\n"+stream+"\nendstream");
  const xObject=imageRef?"/XObject << /Im1 "+imageRef+" 0 R >>":"";
  references.push(obj("<< /Type /Page /Parent "+root+" 0 R /MediaBox [0 0 "+PT+" "+PH+"] /Resources << /Font << /F1 "+regular+" 0 R /F2 "+bold+" 0 R >> "+xObject+" >> /Contents "+c+" 0 R >>"));
 });
 bodyObjects[root-1]="<< /Type /Pages /Kids ["+references.map(n=>n+" 0 R").join(" ")+"] /Count "+references.length+" >>";
 bodyObjects[catalog-1]="<< /Type /Catalog /Pages "+root+" 0 R >>";
 let binary="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n",offsets=[0];
 bodyObjects.forEach((body,i)=>{offsets.push(binary.length);binary+=(i+1)+" 0 obj\n"+body+"\nendobj\n"});
 const startXref=binary.length;
 binary+="xref\n0 "+(bodyObjects.length+1)+"\n0000000000 65535 f \n";
 for(let i=1;i<offsets.length;i++)binary+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
 binary+="trailer\n<< /Size "+(bodyObjects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+startXref+"\n%%EOF";
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const BlobConstructor=environment&&environment.Blob||Blob;
 return new BlobConstructor([bytes],{type:"application/pdf"});
}
window.OCBudgetPDF={build,totals};
})();