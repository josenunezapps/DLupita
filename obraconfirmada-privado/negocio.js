(function(){
"use strict";
let api=null,editing=null,lines=[],editingCatalog=null;
const $=id=>document.getElementById(id);
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cash=x=>Number(x||0).toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
const round=x=>Math.round((Number(x)||0)*100)/100;
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const today=()=>new Date().toISOString().slice(0,10);
const get=id=>$(id).value.trim();
const qs=()=>api.quotes(),cat=()=>api.catalog(),pro=()=>api.projects(),company=()=>api.business();
const companySnapshot=()=>{const c=company();return {name:c.name||"",phone:c.phone||"",email:c.email||"",address:c.address||"",logo:c.logo||"",logoW:c.logoW||0,logoH:c.logoH||0}};
const info=s=>{$("ocBusinessNotice").textContent=s};
function totals(items,tax,discount){
 const cost=round(items.reduce((a,b)=>a+(+b.qty||0)*(+b.cost||0),0));
 const subtotal=round(items.reduce((a,b)=>a+(+b.qty||0)*(+b.price||0),0));
 const discountAmount=round(subtotal*(+discount||0)/100);
 const taxable=round(subtotal-discountAmount);
 const taxAmount=round(taxable*(+tax||0)/100);
 return {cost,subtotal,discount:discountAmount,tax:taxAmount,price:round(taxable+taxAmount),profit:round(taxable-cost),taxable};
}
function renderLines(){
const tbody=$("ocLineRows");tbody.innerHTML="";
lines.forEach((x,i)=>{
const tr=document.createElement("tr");
tr.innerHTML='<td><input data-k="name" aria-label="Concepto" value="'+safe(x.name)+'"></td><td><input data-k="unit" aria-label="Unidad" value="'+safe(x.unit)+'"></td><td><input data-k="qty" type="number" min="0.001" step="any" value="'+x.qty+'"></td><td><input data-k="cost" type="number" min="0" step="0.01" value="'+x.cost+'"></td><td><input data-k="price" type="number" min="0" step="0.01" value="'+x.price+'"></td><td><button class="btn btn-danger btn-sm" type="button">×</button></td>';
tr.querySelectorAll("[data-k]").forEach(inp=>inp.oninput=()=>{const k=inp.dataset.k;x[k]=["qty","cost","price"].includes(k)?Number(inp.value):inp.value;if(k==="cost")x.missingCost=false;renderSummary()});
tr.querySelector("button").onclick=()=>{lines.splice(i,1);renderLines()};
tbody.append(tr);
});renderSummary();
}
function renderSummary(){
const t=totals(lines,$("ocTax").value,$("ocDiscount").value);
$("ocCost").textContent=cash(t.cost);
$("ocPrice").textContent=cash(t.price);$("ocSubtotal").textContent=cash(t.subtotal);
$("ocProfit").textContent=cash(t.profit);
$("ocMargin").textContent=(t.taxable>0?(100*t.profit/t.taxable).toFixed(1):"0")+" %";
$("ocDiscountTotal").textContent=cash(t.discount);$("ocTaxTotal").textContent=cash(t.tax);
}
function newQuote(){
editing=null;lines=[];$("ocQuoteForm").reset();$("ocTax").value="0";$("ocDiscount").value="0";$("ocValidity").value="15";$("ocQuoteTitle").textContent="Nuevo presupuesto";$("ocVersions").innerHTML="";
$("ocConvert").disabled=true;renderLines();
}
function loadQuote(id){
const q=qs().find(x=>x.id===id);if(!q)return;
editing=q.id;lines=JSON.parse(JSON.stringify(q.lines||[]));
[["ocJob",q.title],["ocClient",q.client],["ocClientPhone",q.phone],["ocScope",q.scope],["ocPaymentTerms",q.payment],["ocTax",q.taxRate||0],["ocDiscount",q.discountRate||0],["ocValidity",q.validity??15],["ocDelivery",q.delivery||""],["ocNotes",q.notes||""],["ocQuoteStatus",q.status]].forEach(([key,value])=>$(key).value=value??"");
$("ocQuoteTitle").textContent=q.id+" · "+q.title;$("ocConvert").disabled=!!q.projectId;
renderLines();renderVersions(q);api.show("presupuestos");$("ocQuoteEditor").scrollIntoView({block:"start",behavior:"smooth"});
}
function validate(){
 if(!get("ocJob")||!get("ocClient")){info("Completá el trabajo y el cliente.");return null}
 if(!lines.length||lines.some(x=>!String(x.name).trim()||!String(x.unit).trim()||![x.qty,x.cost,x.price].every(v=>Number.isFinite(+v)&&+v<=999999999)||+x.qty<=0||+x.cost<0||+x.price<0)){info("Revisá la descripción, cantidades y precios de todos los conceptos.");return null}
 const tax=Number($("ocTax").value),discount=Number($("ocDiscount").value),validity=Number($("ocValidity").value);
 if(!Number.isFinite(tax)||tax<0||tax>100||!Number.isFinite(discount)||discount<0||discount>100){info("Descuento e impuestos deben estar entre 0 y 100 %.");return null}
 if(!Number.isInteger(validity)||validity<1||validity>365){info("La validez del presupuesto debe estar entre 1 y 365 días.");return null}
 const total=totals(lines,tax,discount);if(total.price>999999999){info("El total excede el límite admitido.");return null}
 return {title:get("ocJob"),client:get("ocClient"),phone:get("ocClientPhone"),scope:get("ocScope"),payment:get("ocPaymentTerms"),taxRate:tax,discountRate:discount,validity,delivery:get("ocDelivery"),notes:get("ocNotes"),status:$("ocQuoteStatus").value,lines:JSON.parse(JSON.stringify(lines))};
}
function saveQuote(){
 const data=validate();if(!data)return null;
 const old=qs().find(q=>q.id===editing);
 if(old){
  const oldFields={title:old.title,client:old.client,phone:old.phone||"",scope:old.scope||"",payment:old.payment||"",taxRate:Number(old.taxRate||0),discountRate:Number(old.discountRate||0),validity:Number(old.validity??15),delivery:old.delivery||"",notes:old.notes||"",status:old.status,lines:old.lines||[]};
  if(JSON.stringify(oldFields)===JSON.stringify(data)){info("No hay cambios nuevos. La última versión está guardada.");return old}
 }
 const now=new Date().toISOString();
 let quoteId=old?.id||"PRE-"+Date.now();
 if(!old)while(qs().some(q=>q.id===quoteId))quoteId+="A";
 const previous=old?JSON.parse(JSON.stringify(old)):null;
 const q={...data,id:quoteId,created:old?.created||now,updated:now,projectId:old?.projectId||null,history:old?.history||[],demo:old?.demo||false};
 const version=q.history.length+1;
 q.history=q.history.concat([{number:version,at:now,snapshot:JSON.parse(JSON.stringify({...data,company:companySnapshot()}))}]);
 if(old)Object.assign(old,q);else qs().unshift(q);
 if(!api.save()){if(old)Object.assign(old,previous);else qs().splice(qs().indexOf(q),1);info("No se pudo guardar el presupuesto.");return null}
 editing=q.id;render();renderVersions(q);info("Presupuesto guardado · versión "+version+".");return q;
}
function pdf(q){
 const t=totals(q.lines||[],q.taxRate||0,q.discountRate||0);
 const doc={id:q.id,title:q.title,client:q.client,phone:q.phone||"",scope:q.scope||"",original:t.price,payment:q.payment||"",validity:q.validity??15,delivery:q.delivery||"",notes:q.notes||"",discountRate:q.discountRate||0,taxRate:q.taxRate||0,lines:q.lines||[],version:q.version||null,issuedAt:q.issuedAt||q.updated||q.created||new Date().toISOString(),demo:!!q.demo};
 api.pdf(doc,"ObraConfirmada-Presupuesto-"+q.id+(q.version?"-v"+q.version:"")+".pdf",q.company||company());
}
function renderVersions(q){
const box=$("ocVersions");box.replaceChildren();
(q.history||[]).slice().reverse().forEach(v=>{const b=document.createElement("button");b.type="button";b.className="btn btn-secondary btn-sm";b.textContent="Versión "+v.number+" · "+new Date(v.at).toLocaleDateString("es-AR")+" · PDF";
b.onclick=()=>pdf({...v.snapshot,id:q.id,version:v.number,issuedAt:v.at,demo:q.demo});box.append(b)});
}
function convert(){
const q=qs().find(x=>x.id===editing);if(!q)return info("Guardá el presupuesto antes.");
if(q.projectId)return info("El presupuesto ya fue convertido.");
if(!confirm("¿Convertir el presupuesto en una obra?"))return;
const t=totals(q.lines||[],q.taxRate||0,q.discountRate||0);const name=api.nextId("OC",pro().map(p=>p.id),100);
pro().unshift({id:name,title:q.title,client:q.client,phone:(q.phone||"00000000").replace(/\D/g,"")||"00000000",scope:q.scope||"Según el presupuesto "+q.id,original:t.price,start:today(),duration:30,payment:q.payment,validity:q.validity??15,delivery:q.delivery||"",budgetNotes:(q.notes?q.notes+"\n":"")+"Origen: "+q.id,created:new Date().toISOString(),status:"Activa",changes:[],expenses:[],payments:[],lines:JSON.parse(JSON.stringify(q.lines)),taxRate:q.taxRate,discountRate:q.discountRate||0,discountTotal:t.discount,taxTotal:t.tax,demo:!!q.demo,events:[{text:"Obra creada desde el presupuesto "+q.id,at:new Date().toISOString()}]});
q.projectId=name;q.status="Convertido";api.save();render();api.openProject(name);
}
function cloneQuote(q){
 if(!q)return;
 const original={title:q.title,client:q.client,phone:q.phone||"",scope:q.scope||"",payment:q.payment||"",taxRate:q.taxRate||0,discountRate:q.discountRate||0,validity:q.validity??15,delivery:q.delivery||"",notes:q.notes||"",status:"Borrador",lines:JSON.parse(JSON.stringify(q.lines||[]))};
 const now=new Date().toISOString();let quoteId="PRE-"+Date.now();while(qs().some(x=>x.id===quoteId))quoteId+="A";
 const fresh={...original,title:original.title+" (copia)",id:quoteId,created:now,updated:now,projectId:null,demo:false,history:[{number:1,at:now,snapshot:JSON.parse(JSON.stringify({...original,company:companySnapshot()}))}]};
 qs().unshift(fresh);
 if(!api.save()){qs().shift();return info("No se pudo duplicar el presupuesto.")}
 render();loadQuote(fresh.id);info("Se creó una copia independiente del presupuesto.");
}
function removeQuote(q){
 if(!q)return;
 if(q.projectId)return info("Este presupuesto está asociado a una obra y debe conservarse como referencia.");
 if(!confirm("¿Eliminar el presupuesto "+q.id+" y todas sus versiones? Esta acción no se puede deshacer."))return;
 const i=qs().findIndex(x=>x.id===q.id);if(i<0)return;const old=qs()[i];
 qs().splice(i,1);if(!api.save()){qs().splice(i,0,old);return info("No se pudo eliminar.")}
 if(editing===q.id)newQuote();render();info("Presupuesto eliminado.");
}
function renderQuotes(){
 const div=$("ocQuotes"),all=qs();
 div.innerHTML=all.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Presupuesto</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+all.map(q=>'<tr><td><b>'+safe(q.title)+'</b><small>'+safe(q.id)+(q.demo?" · EJEMPLO":"")+'</small></td><td>'+safe(q.client)+'</td><td>'+cash(totals(q.lines||[],q.taxRate,q.discountRate).price)+'</td><td>'+safe(q.status)+'</td><td><div class="oc-tools"><button type="button" data-q="'+safe(q.id)+'" class="btn btn-secondary btn-sm">Editar</button><button type="button" data-clone="'+safe(q.id)+'" class="btn btn-secondary btn-sm">Duplicar</button><button type="button" data-delete="'+safe(q.id)+'" class="btn btn-danger btn-sm">Eliminar</button></div></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">No hay presupuestos todavía.</div>';
 div.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>loadQuote(b.dataset.q));
 div.querySelectorAll("[data-clone]").forEach(b=>b.onclick=()=>cloneQuote(qs().find(q=>q.id===b.dataset.clone)));
 div.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>removeQuote(qs().find(q=>q.id===b.dataset.delete)));
}
function renderCatalog(){
const items=cat();$("ocCatalogSelect").innerHTML='<option value="">Seleccionar precio guardado...</option>'+items.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+' · '+cash(x.price)+'</option>').join("");
const div=$("ocCatalog");
div.innerHTML=items.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Concepto</th><th>Unidad</th><th>Costo</th><th>Venta</th><th>Fecha</th><th></th></tr></thead><tbody>'+items.map(x=>'<tr><td><b>'+safe(x.name)+'</b><small>'+safe(x.category||"General")+(x.demo?" · EJEMPLO":"")+'</small></td><td>'+safe(x.unit)+'</td><td>'+cash(x.cost)+'</td><td>'+cash(x.price)+'</td><td>'+safe(x.updated)+'</td><td><button class="btn btn-secondary btn-sm" data-edit="'+safe(x.id)+'">Editar</button> <button class="btn btn-danger btn-sm" data-del="'+safe(x.id)+'">Quitar</button></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">Todavía no hay conceptos en el catálogo.</div>';
div.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const c=items.find(x=>x.id===b.dataset.edit);if(!c)return;editingCatalog=c.id;$("ocConcept").value=c.name;$("ocUnit").value=c.unit;$("ocCategory").value=c.category||"";$("ocUnitCost").value=c.cost;$("ocUnitPrice").value=c.price;api.show("catalogo");$("ocConcept").focus();info("Editando "+c.name+". Guardá para actualizar el precio.");});
div.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{if(!confirm("¿Quitar este concepto? No modifica presupuestos ya guardados."))return;const i=items.findIndex(x=>x.id===b.dataset.del);if(i>=0){items.splice(i,1);api.save();renderCatalog()}});
}
function renderProject(p){
if(!p)return;
const expenses=p.expenses||[],payments=p.payments||[];
const cost=expenses.reduce((s,e)=>s+Number(e.amount),0),paid=payments.reduce((s,e)=>s+Number(e.amount),0);
const price=Number(p.original||0)+(p.changes||[]).filter(x=>x.status==="Aprobado").reduce((s,x)=>s+Number(x.delta),0);
$("ocJobCost").textContent=cash(cost);$("ocJobPaid").textContent=cash(paid);
$("ocJobPending").textContent=cash(price-paid);$("ocJobProfit").textContent=cash(price-cost);
const expenseTable=expenses.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Fecha</th><th>Gasto</th><th>Categoría</th><th>Importe</th><th></th></tr></thead><tbody>'+expenses.slice().reverse().map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+safe(x.concept)+'</td><td>'+safe(x.category)+'</td><td>'+cash(x.amount)+'</td><td><button type="button" class="btn btn-danger btn-sm" data-exp="'+safe(x.id)+'">Quitar</button></td></tr>').join("")+'</tbody></table></div>':'<p class="subtle">Sin gastos registrados.</p>';
const paymentTable=payments.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Fecha</th><th>Detalle</th><th>Importe</th><th></th></tr></thead><tbody>'+payments.slice().reverse().map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+safe(x.concept)+'</td><td>'+cash(x.amount)+'</td><td><button type="button" class="btn btn-danger btn-sm" data-pay="'+safe(x.id)+'">Quitar</button></td></tr>').join("")+'</tbody></table></div>':'<p class="subtle">Sin cobros registrados.</p>';
$("ocExpenses").innerHTML=expenseTable;$("ocPayments").innerHTML=paymentTable;
$("ocExpenses").querySelectorAll("[data-exp]").forEach(b=>b.onclick=()=>{if(!confirm("¿Quitar este gasto registrado?"))return;const i=expenses.findIndex(x=>x.id===b.dataset.exp);if(i<0)return;expenses.splice(i,1);api.save();renderProject(p);renderFinance()});
$("ocPayments").querySelectorAll("[data-pay]").forEach(b=>b.onclick=()=>{if(!confirm("¿Quitar este cobro registrado?"))return;const i=payments.findIndex(x=>x.id===b.dataset.pay);if(i<0)return;payments.splice(i,1);api.save();renderProject(p);renderFinance()});
}
function renderFinance(){
const rows=pro().map(p=>{const cost=(p.expenses||[]).reduce((s,x)=>s+Number(x.amount),0),paid=(p.payments||[]).reduce((s,x)=>s+Number(x.amount),0);
const price=Number(p.original||0)+(p.changes||[]).filter(c=>c.status==="Aprobado").reduce((s,c)=>s+Number(c.delta),0);return {p,cost,paid,price}});
$("ocTotalSales").textContent=cash(rows.reduce((s,x)=>s+x.price,0));
$("ocTotalCosts").textContent=cash(rows.reduce((s,x)=>s+x.cost,0));
$("ocTotalPaid").textContent=cash(rows.reduce((s,x)=>s+x.paid,0));
$("ocTotalPending").textContent=cash(rows.reduce((s,x)=>s+x.price-x.paid,0));
const div=$("ocFinance");
div.innerHTML=rows.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Obra</th><th>Presupuesto</th><th>Gastos</th><th>Cobrado</th><th>Pendiente</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+safe(x.p.title)+'</b>'+(x.p.demo?'<small>EJEMPLO FICTICIO</small>':'')+'</td><td>'+cash(x.price)+'</td><td>'+cash(x.cost)+'</td><td>'+cash(x.paid)+'</td><td>'+cash(x.price-x.paid)+'</td><td><button data-p="'+safe(x.p.id)+'" class="btn btn-secondary btn-sm">Abrir</button></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">Todavía no hay obras registradas.</div>';
div.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>api.openProject(b.dataset.p));
}

/* Datos de demostración: nunca reemplazar obras reales ni duplicar ejemplos. */
function hasExamples(){return pro().some(p=>p.demo===true)||qs().some(q=>q.demo===true)||cat().some(c=>c.demo===true)}
function renderExampleControls(){
 const count=pro().filter(p=>p.demo===true).length,has=hasExamples();
 $("ocExampleCount").textContent=has?"Tenés "+count+" obras de ejemplo. Los clientes, importes, gastos y cobros son ficticios.":"Podés cargar seis obras ficticias completas para probar presupuestos, gastos y cobros.";
 $("ocImportExamples").classList.toggle("hidden",has);
 $("ocRemoveExamples").classList.toggle("hidden",!has);
 $("ocExampleBanner").classList.toggle("hidden",!has);
}
function refreshSamples(){api.redraw();render();}
async function importExamples(){
 if(hasExamples())return info("Ya hay ejemplos cargados. Podés quitarlos y volver a cargarlos.");
 const button=$("ocImportExamples");button.disabled=true;button.textContent="Cargando ejemplos...";
 try{
  const resp=await fetch("./ejemplos.json",{cache:"no-store"});
  if(!resp.ok)throw Error("No se pudo descargar la colección de ejemplos.");
  const data=await resp.json();
  if(data.version!==1||!Array.isArray(data.projects)||data.projects.length!==6||!Array.isArray(data.quotes)||!Array.isArray(data.catalog))throw Error("El archivo de ejemplos no es válido.");
  const clone=x=>JSON.parse(JSON.stringify(x));
  const ids=pro().map(x=>x.id),usedChanges=pro().flatMap(p=>(p.changes||[]).map(c=>c.id));
  const mapping=new Map();
  const works=data.projects.map(p=>{
   if(!p.demo||!Array.isArray(p.lines)||!Array.isArray(p.changes)||!Array.isArray(p.expenses)||!Array.isArray(p.payments))throw Error("Ejemplo incompleto.");
   const item=clone(p),old=item.id;
   if(ids.includes(item.id)){item.id=api.nextId("OC",ids,100)}
   ids.push(item.id);mapping.set(old,item.id);
   item.changes.forEach(c=>{if(usedChanges.includes(c.id)){c.id=api.nextId("CM",usedChanges,200)}usedChanges.push(c.id)});
   return item;
  });
  const quoteIds=qs().map(q=>q.id);
  const quotes=data.quotes.map(q=>{const x=clone(q);if(!x.demo||!Array.isArray(x.lines))throw Error("Presupuesto de ejemplo inválido.");
   if(quoteIds.includes(x.id))x.id="PRE-DEMO-"+Date.now()+"-"+quoteIds.length;
   quoteIds.push(x.id);if(x.projectId)x.projectId=mapping.get(x.projectId)||null;return x});
  const catalogIds=cat().map(c=>c.id);
  const sampleCatalog=data.catalog.map(c=>{const x=clone(c);if(!x.demo)throw Error("Catálogo de ejemplo inválido.");if(catalogIds.includes(x.id))x.id="CAT-DEMO-"+Date.now()+"-"+catalogIds.length;catalogIds.push(x.id);return x});
  pro().push(...works);qs().push(...quotes);cat().push(...sampleCatalog);
  if(!api.save()){
    pro().splice(pro().length-works.length,works.length);
    qs().splice(qs().length-quotes.length,quotes.length);
    cat().splice(cat().length-sampleCatalog.length,sampleCatalog.length);
    throw Error("No se pudieron guardar los ejemplos.");
  }
  refreshSamples();info("Agregamos 6 obras, 5 presupuestos y 14 precios ficticios. Podés quitarlos desde Obras.");
 }catch(error){info("No se pudieron cargar los ejemplos: "+error.message)}
 finally{button.disabled=false;button.textContent="Cargar 6 obras de ejemplo"}
}
function removeExamples(){
 if(!hasExamples())return;
 if(!confirm("¿Quitar todos los ejemplos ficticios? Se eliminarán las obras, presupuestos y precios de ejemplo, con sus gastos y cobros. Tus datos reales se conservarán."))return;
 const oldP=pro().slice(),oldQ=qs().slice(),oldC=cat().slice();
 const remove=items=>{for(let i=items.length-1;i>=0;i--)if(items[i].demo===true)items.splice(i,1)};
 remove(pro());remove(qs());remove(cat());
 if(!api.save()){pro().splice(0,pro().length,...oldP);qs().splice(0,qs().length,...oldQ);cat().splice(0,cat().length,...oldC);return info("No se pudieron quitar los ejemplos. Intentá nuevamente.")}
 editing=null;newQuote();api.show("obras");refreshSamples();
 info("Ejemplos retirados. Tus obras, presupuestos y precios reales siguen en la cuenta.");
}

function render(){renderQuotes();renderCatalog();renderFinance();renderExampleControls();
 $("ocCompanyName").value=company().name||"";$("ocCompanyPhone").value=company().phone||"";
 $("ocCompanyEmail").value=company().email||"";$("ocCompanyAddress").value=company().address||"";
 const img=$("ocLogoPreview");img.classList.toggle("hidden",!company().logo);
 if(company().logo)img.src=company().logo;else img.removeAttribute("src");
}
function installUI(){
 const style=document.createElement("style");style.textContent=".oc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.oc-stats .card{padding:16px}.oc-stats b{display:block;font-size:18px;margin-top:8px}.oc-stats small{color:#8390a0}.oc-split{display:grid;grid-template-columns:1fr 1fr;gap:17px}.oc-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.oc-tools select{padding:10px;border:1px solid #dce4ec;background:white;border-radius:8px}.oc-lines{min-width:650px}.oc-lines input{font-size:12px;border:1px solid #dce3ea;border-radius:8px;width:100%;min-width:65px;padding:8px}.oc-lines td:first-child input{min-width:150px}@media(max-width:850px){.oc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.oc-split{grid-template-columns:1fr}}@media(max-width:550px){.oc-stats .card{padding:10px}.oc-stats b{font-size:15px}}";document.head.append(style);

 const bar=document.createElement("section");
 bar.className="card panel";bar.style.marginBottom="16px";bar.id="ocExamplesBox";
 bar.innerHTML='<div class="sectionhead"><h2>Obras de demostración</h2></div><p id="ocExampleCount" class="subtle"></p><div class="oc-tools"><button type="button" id="ocImportExamples" class="btn btn-primary">Cargar 6 obras de ejemplo</button><button type="button" id="ocRemoveExamples" class="btn btn-secondary">Quitar los ejemplos</button></div>';
 const worksSection=document.getElementById("page-obras");
 worksSection.insertBefore(bar,worksSection.firstChild);
 const banner=document.createElement("div");banner.id="ocExampleBanner";banner.className="card panel hidden";banner.style.marginBottom="16px";
 banner.innerHTML='<strong style="color:#995e32">Datos de demostración</strong><p class="subtle" style="margin:7px 0">Los importes, gastos, cobros y clientes de ejemplo son ficticios. Para empezar con tus datos reales, entrá en Obras y tocá «Quitar los ejemplos».</p>';
 document.getElementById("page-inicio").insertBefore(banner,document.getElementById("page-inicio").firstChild);
 const menu=document.querySelector(".sidenav");
 const old=menu.querySelector('[data-nav="cliente"]');if(old)old.remove();
 [["presupuestos","Presupuestos"],["finanzas","Gastos y cobros"],["catalogo","Catálogo de precios"]].forEach(([page,label])=>{
  const button=document.createElement("button");button.type="button";button.className="nav-item";button.dataset.nav=page;button.textContent=label;button.onclick=()=>api.show(page);
  menu.insertBefore(button,menu.querySelector('[data-nav="config"]'));
 });
 document.querySelectorAll('[data-nav="cliente"]').forEach(e=>e.remove());
 const client=document.getElementById("page-cliente");if(client)client.classList.add("hidden");

 const config=document.getElementById("page-config");
 for(const html of ["<section class=\"page hidden\" id=\"page-presupuestos\"><div class=\"card panel\"><div class=\"sectionhead\"><h2>Mis presupuestos</h2><button id=\"ocNewQuote\" type=\"button\" class=\"btn btn-primary\">+ Nuevo presupuesto</button></div><div id=\"ocQuotes\"></div></div><div id=\"ocQuoteEditor\" class=\"card panel\" style=\"margin-top:18px\"><h2 id=\"ocQuoteTitle\">Nuevo presupuesto</h2><form id=\"ocQuoteForm\" onsubmit=\"return false\"><div class=\"fields\"><label class=\"field\"><span>Trabajo *</span><input id=\"ocJob\" required maxlength=\"100\"></label><label class=\"field\"><span>Cliente *</span><input id=\"ocClient\" required maxlength=\"90\"></label><label class=\"field\"><span>Teléfono</span><input id=\"ocClientPhone\" maxlength=\"30\"></label><label class=\"field\"><span>Estado (registro interno)</span><select id=\"ocQuoteStatus\"><option>Borrador</option><option>Enviado</option><option>Aceptado (registrado por mí)</option><option>Convertido</option></select></label></div><label class=\"field\"><span>Descripción</span><textarea id=\"ocScope\" maxlength=\"3000\"></textarea></label><label class=\"field\"><span>Condiciones de pago</span><input id=\"ocPaymentTerms\" maxlength=\"180\"></label><h3>Materiales y mano de obra</h3><div class=\"oc-tools\"><select id=\"ocCatalogSelect\"><option>Seleccionar del catálogo...</option></select><button id=\"ocAddCatalog\" type=\"button\" class=\"btn btn-secondary btn-sm\">Del catálogo</button><button id=\"ocAddLine\" type=\"button\" class=\"btn btn-secondary btn-sm\">+ Concepto libre</button></div><div class=\"tablewrap\" style=\"margin-top:15px\"><table class=\"table oc-lines\"><thead><tr><th>Concepto</th><th>Unidad</th><th>Cantidad</th><th>Costo/u</th><th>Venta/u</th><th></th></tr></thead><tbody id=\"ocLineRows\"></tbody></table></div><label class=\"field\"><span>Impuestos (%) opcionales</span><input id=\"ocTax\" type=\"number\" min=\"0\" max=\"100\" step=\"0.01\" value=\"0\"></label><div class=\"oc-stats\"><div class=\"card\"><small>Costos internos</small><b id=\"ocCost\">$0</b></div><div class=\"card\"><small>Total al cliente</small><b id=\"ocPrice\">$0</b></div><div class=\"card\"><small>Ganancia bruta estimada</small><b id=\"ocProfit\">$0</b></div><div class=\"card\"><small>Margen sobre venta</small><b id=\"ocMargin\">$0</b></div></div><p class=\"subtle\">Los costos internos y el margen no aparecen en el PDF. El margen excluye los impuestos configurados y sólo contempla los costos cargados.</p><div class=\"oc-tools\"><button id=\"ocSaveQuote\" type=\"button\" class=\"btn btn-primary\">Guardar presupuesto</button><button id=\"ocPrintQuote\" type=\"button\" class=\"btn btn-secondary\">Descargar PDF</button><button id=\"ocConvert\" type=\"button\" class=\"btn btn-dark\" disabled>Convertir en obra</button></div></form><h3>Versiones anteriores</h3><div id=\"ocVersions\" class=\"oc-tools\"></div></div></section>","<section class=\"page hidden\" id=\"page-finanzas\"><div class=\"oc-stats\"><div class=\"card\"><small>Importe de obras</small><b id=\"ocTotalSales\">$0</b></div><div class=\"card\"><small>Gastos registrados</small><b id=\"ocTotalCosts\">$0</b></div><div class=\"card\"><small>Cobrado</small><b id=\"ocTotalPaid\">$0</b></div><div class=\"card\"><small>Por cobrar</small><b id=\"ocTotalPending\">$0</b></div></div><div class=\"card panel\"><h2>Gastos y cobros por obra</h2><p class=\"subtle\">La ganancia definitiva puede ser menor si faltan costos por registrar.</p><div id=\"ocFinance\"></div></div></section>","<section class=\"page hidden\" id=\"page-catalogo\"><div class=\"oc-split\"><div class=\"card panel\"><h2>Agregar precio</h2><form id=\"ocCatalogForm\"><label class=\"field\"><span>Concepto *</span><input id=\"ocConcept\" required maxlength=\"140\"></label><div class=\"fields\"><label class=\"field\"><span>Unidad *</span><input id=\"ocUnit\" value=\"m²\" required maxlength=\"16\"></label><label class=\"field\"><span>Rubro</span><input id=\"ocCategory\" maxlength=\"70\"></label><label class=\"field\"><span>Costo unitario</span><input id=\"ocUnitCost\" type=\"number\" min=\"0\" step=\"0.01\" required></label><label class=\"field\"><span>Venta unitaria</span><input id=\"ocUnitPrice\" type=\"number\" min=\"0\" step=\"0.01\" required></label></div><button class=\"btn btn-primary\">Guardar precio</button></form></div><div class=\"card panel\"><h2>Mi empresa</h2><p class=\"subtle\">El nombre aparece en tus presupuestos PDF.</p><form id=\"ocCompanyForm\"><label class=\"field\"><span>Nombre comercial</span><input id=\"ocCompanyName\" maxlength=\"45\"></label><label class=\"field\"><span>Teléfono</span><input id=\"ocCompanyPhone\" maxlength=\"40\"></label><button class=\"btn btn-secondary\">Guardar datos</button></form></div></div><div class=\"card panel\" style=\"margin-top:18px\"><h2>Catálogo reutilizable</h2><p class=\"subtle\">Los precios no se actualizan automáticamente y no modifican presupuestos ya emitidos.</p><div id=\"ocCatalog\"></div></div></section>"]){
  const holder=document.createElement("div");holder.innerHTML=html;config.parentNode.insertBefore(holder.firstElementChild,config);
 }
 const extras='<div class="fields"><label class="field"><span>Descuento (%)</span><input id="ocDiscount" type="number" min="0" max="100" step="0.01" value="0"></label><label class="field"><span>Validez del presupuesto (días)</span><input id="ocValidity" type="number" min="1" max="365" step="1" value="15"></label></div><div class="fields"><label class="field"><span>Plazo estimado de ejecución</span><input id="ocDelivery" maxlength="120" placeholder="Ej.: 20 días desde el inicio"></label></div><label class="field"><span>Observaciones para el PDF</span><textarea id="ocNotes" rows="3" maxlength="1200" placeholder="Exclusiones, materiales, condiciones adicionales..."></textarea></label>';
 document.getElementById("ocTax").closest("label").insertAdjacentHTML("beforebegin",extras);
 document.getElementById("ocPrice").closest(".oc-stats").insertAdjacentHTML("afterend",'<p class="subtle">Subtotal: <strong id="ocSubtotal">$0</strong> · Descuento: <strong id="ocDiscountTotal">$0</strong> · Impuestos: <strong id="ocTaxTotal">$0</strong></p>');
 const quoteButtons=document.getElementById("ocConvert").parentNode;
 quoteButtons.insertAdjacentHTML("beforeend",'<button type="button" class="btn btn-secondary" id="ocDownloadCsv">Descargar Excel (CSV)</button><button type="button" class="btn btn-secondary" id="ocShareQuote">Compartir PDF</button><button type="button" class="btn btn-secondary btn-sm" id="ocShareWhatsApp">WhatsApp</button><button type="button" class="btn btn-secondary btn-sm" id="ocShareGmail">Gmail</button>');
  const businessForm=document.getElementById("ocCompanyForm");
 businessForm.querySelector("button").insertAdjacentHTML("beforebegin",'<label class="field"><span>Correo comercial</span><input id="ocCompanyEmail" type="email" maxlength="100" placeholder="contacto@tuempresa.com"></label><label class="field"><span>Dirección o localidad</span><input id="ocCompanyAddress" maxlength="115" placeholder="Ciudad, provincia"></label><label class="field"><span>Logo del negocio (JPG, PNG o WEBP, hasta 2 MB)</span><input id="ocCompanyLogo" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="oc-logo-preview"><img id="ocLogoPreview" alt="Logo del negocio" class="hidden" style="max-width:115px;max-height:85px;object-fit:contain"><button type="button" id="ocRemoveLogo" class="btn btn-secondary btn-sm">Quitar logo</button></div><p class="subtle">El logo se adapta al PDF y queda guardado en tu cuenta.</p>');

 const d=document.getElementById("page-detalle");d.insertAdjacentHTML("beforeend","<section class=\"card panel\" style=\"margin-top:18px\"><h2>Control económico de la obra</h2><div class=\"oc-stats\"><div class=\"card\"><small>Gastos cargados</small><b id=\"ocJobCost\">$0</b></div><div class=\"card\"><small>Cobrado</small><b id=\"ocJobPaid\">$0</b></div><div class=\"card\"><small>Por cobrar</small><b id=\"ocJobPending\">$0</b></div><div class=\"card\"><small>Presupuesto menos gastos</small><b id=\"ocJobProfit\">$0</b></div></div><p class=\"subtle\">La diferencia no representa la ganancia definitiva si faltan costos por registrar.</p><div class=\"oc-split\"><div><h3>Registrar gasto</h3><form id=\"ocExpenseForm\"><label class=\"field\"><span>Concepto *</span><input id=\"ocExpenseConcept\" required maxlength=\"120\"></label><div class=\"fields\"><label class=\"field\"><span>Importe *</span><input id=\"ocExpenseAmount\" type=\"number\" min=\"0.01\" step=\"0.01\" required></label><label class=\"field\"><span>Fecha *</span><input id=\"ocExpenseDate\" type=\"date\" required></label><label class=\"field\"><span>Categoría</span><select id=\"ocExpenseCategory\"><option>Materiales</option><option>Mano de obra</option><option>Transporte</option><option>Equipos</option><option>Otros</option></select></label></div><button class=\"btn btn-secondary\">Guardar gasto</button></form><div id=\"ocExpenses\"></div></div><div><h3>Registrar cobro</h3><form id=\"ocPaymentForm\"><label class=\"field\"><span>Detalle *</span><input id=\"ocPaymentConcept\" required maxlength=\"120\"></label><div class=\"fields\"><label class=\"field\"><span>Importe *</span><input id=\"ocPaymentAmount\" type=\"number\" min=\"0.01\" step=\"0.01\" required></label><label class=\"field\"><span>Fecha *</span><input id=\"ocPaymentDate\" type=\"date\" required></label></div><button class=\"btn btn-secondary\">Guardar cobro</button></form><div id=\"ocPayments\"></div></div></div></section>");
 const notice=document.createElement("p");notice.id="ocBusinessNotice";notice.className="subtle";
 notice.setAttribute("role","status");notice.setAttribute("aria-live","polite");
 document.querySelector(".main").append(notice);
 const review=document.getElementById("reviewInClient");
 if(review){review.textContent="Incorporar al presupuesto";review.onclick=()=>{
  const obj=api.currentChange();if(!obj||obj.c.status!=="Pendiente")return;
  if(!confirm("¿Incorporar este adicional al presupuesto de la obra? Es un registro interno, no una firma del cliente."))return;
  obj.c.status="Aprobado";obj.c.decidedAt=new Date().toISOString();obj.c.decidedBy="Registro interno";obj.c.decisionNotes="Incorporado por el profesional";
  api.save();document.getElementById("detailDialog").close();api.redraw();api.openProject(obj.p.id);
 }}
}
function init(bridge){
api=bridge;installUI();
$("ocImportExamples").onclick=importExamples;
$("ocRemoveExamples").onclick=removeExamples;
$("ocNewQuote").onclick=()=>{newQuote();api.show("presupuestos")};
$("ocAddLine").onclick=()=>{lines.push({id:id(),name:"",unit:"u",qty:1,cost:0,price:0});renderLines()};
$("ocAddCatalog").onclick=()=>{const c=cat().find(x=>x.id===$("ocCatalogSelect").value);if(c){lines.push({id:id(),name:c.name,unit:c.unit,qty:1,cost:c.cost,price:c.price});renderLines()}};
$("ocTax").oninput=renderSummary;$("ocDiscount").oninput=renderSummary;
$("ocSaveQuote").onclick=saveQuote;
$("ocPrintQuote").onclick=()=>{const q=saveQuote();if(q)pdf({...q,version:q.history.length,issuedAt:q.history[q.history.length-1]?.at})};
$("ocConvert").onclick=convert;
 $("ocDownloadCsv").onclick=()=>{const q=qs().find(q=>q.id===editing);if(!q)return info("Guardá antes el presupuesto.");csvQuote(q)};
 $("ocShareQuote").onclick=()=>{const q=qs().find(q=>q.id===editing);if(!q)return info("Guardá antes el presupuesto.");shareQuote(q)};
 $("ocShareWhatsApp").onclick=()=>{const q=qs().find(q=>q.id===editing);if(!q)return info("Guardá antes el presupuesto.");shareQuote(q,"whatsapp")};
 $("ocShareGmail").onclick=()=>{const q=qs().find(q=>q.id===editing);if(!q)return info("Guardá antes el presupuesto.");shareQuote(q,"gmail")};

$("ocCatalogForm").onsubmit=e=>{e.preventDefault();const name=get("ocConcept"),unit=get("ocUnit"),cost=+$("ocUnitCost").value,price=+$("ocUnitPrice").value;
if(!name||!unit||!Number.isFinite(cost)||cost<0||!Number.isFinite(price)||price<0){info("Revisá los datos del catálogo.");return}
const previous=editingCatalog&&cat().find(x=>x.id===editingCatalog);
if(previous){Object.assign(previous,{name,unit,cost,price,category:get("ocCategory"),updated:today()})}else cat().unshift({id:id(),name,unit,cost,price,category:get("ocCategory"),updated:today()});
editingCatalog=null;api.save();e.target.reset();render();info("Precio guardado.")};
$("ocExpenseForm").onsubmit=e=>{e.preventDefault();const p=api.currentProject(),v=+$("ocExpenseAmount").value,concept=get("ocExpenseConcept");if(!p||!concept||!Number.isFinite(v)||v<=0)return;
(p.expenses||(p.expenses=[])).push({id:id(),date:$("ocExpenseDate").value||today(),concept,category:$("ocExpenseCategory").value,amount:v});api.save();e.target.reset();$("ocExpenseDate").value=today();renderProject(p);renderFinance();info("Gasto registrado.")};
$("ocPaymentForm").onsubmit=e=>{e.preventDefault();const p=api.currentProject(),v=+$("ocPaymentAmount").value,concept=get("ocPaymentConcept");if(!p||!concept||!Number.isFinite(v)||v<=0)return;
(p.payments||(p.payments=[])).push({id:id(),date:$("ocPaymentDate").value||today(),concept,amount:v});api.save();e.target.reset();$("ocPaymentDate").value=today();renderProject(p);renderFinance();info("Cobro registrado.")};
$("ocCompanyForm").onsubmit=e=>{
 e.preventDefault();
 const email=get("ocCompanyEmail");
 if(email&&(!$("ocCompanyEmail").checkValidity()))return info("Revisá el correo comercial.");
 const previous={...company()};
 Object.assign(company(),{name:get("ocCompanyName"),phone:get("ocCompanyPhone"),email,address:get("ocCompanyAddress")});
 if(!api.save()){Object.assign(company(),previous);return info("No se pudieron guardar los datos del negocio.")}
 info("Datos del negocio actualizados para los próximos presupuestos.");
};
$("ocCompanyLogo").onchange=function(){
 const file=this.files&&this.files[0];this.value="";
 if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>2*1024*1024)return info("Usá un logo JPG, PNG o WEBP de hasta 2 MB.");
 const image=new Image(),url=URL.createObjectURL(file);
 image.onerror=function(){URL.revokeObjectURL(url);info("No pudimos leer el logo.")};
 image.onload=function(){
  URL.revokeObjectURL(url);
  try{
   const scale=Math.min(1,220/Math.max(image.naturalWidth,image.naturalHeight));
   const canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const ctx=canvas.getContext("2d");if(!ctx)throw Error("No se pudo procesar la imagen.");
   ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const b64=canvas.toDataURL("image/jpeg",.78);
   if(!/^data:image\/jpeg;base64,/.test(b64)||b64.length>165000)throw Error("El archivo de logo es demasiado grande.");
   const before={logo:company().logo,logoW:company().logoW,logoH:company().logoH};
   company().logo=b64;company().logoW=canvas.width;company().logoH=canvas.height;
   if(!api.save()){Object.assign(company(),before);throw Error("No pudimos preparar el guardado del logo.")}
   const preview=$("ocLogoPreview");preview.src=b64;preview.classList.remove("hidden");info("Logo guardado. Aparecerá en los próximos presupuestos PDF.");
  }catch(e){info("Error al cargar el logo: "+e.message)}
 };
 image.src=url;
};
$("ocRemoveLogo").onclick=function(){
 if(!company().logo)return info("No hay un logo guardado.");
 const previous={logo:company().logo,logoW:company().logoW,logoH:company().logoH};
 delete company().logo;delete company().logoW;delete company().logoH;
 if(!api.save()){Object.assign(company(),previous);return info("No se pudo quitar el logo.")}
 $("ocLogoPreview").removeAttribute("src");$("ocLogoPreview").classList.add("hidden");info("Se quitó el logo comercial.");
};
$("ocExpenseDate").value=today();$("ocPaymentDate").value=today();
newQuote();render();
}

function createQuoteFromAgent(p){
 if(!p||!String(p.title||"").trim()||!String(p.client||"").trim()||!Array.isArray(p.lines)||!p.lines.length)return null;
 const values=p.lines.map(x=>({id:x.id||id(),name:String(x.name||"").trim(),unit:String(x.unit||"").trim(),qty:Number(x.qty),price:Number(x.price),cost:Number(x.cost||0),missingCost:x.missingCost===true}));
 if(values.some(x=>!x.name||!x.unit||!Number.isFinite(x.qty)||x.qty<=0||!Number.isFinite(x.price)||x.price<0||!Number.isFinite(x.cost)||x.cost<0))return null;
 let quoteId="PRE-"+Date.now();while(qs().some(q=>q.id===quoteId))quoteId+="A";
 const now=new Date().toISOString();
 const data={title:String(p.title).slice(0,100),client:String(p.client).slice(0,90),phone:String(p.phone||"").slice(0,30),scope:String(p.scope||"").slice(0,3000),payment:String(p.payment||"").slice(0,180),taxRate:Number(p.taxRate||0),discountRate:Number(p.discountRate||0),validity:Number(p.validity||15),delivery:String(p.delivery||"").slice(0,120),notes:String(p.notes||"").slice(0,1200),status:"Borrador",lines:values};
 if(data.taxRate<0||data.taxRate>100||data.discountRate<0||data.discountRate>100||!Number.isInteger(data.validity)||data.validity<1||data.validity>365)return null;
 const q={...data,id:quoteId,created:now,updated:now,projectId:null,history:[{number:1,at:now,snapshot:JSON.parse(JSON.stringify({...data,company:companySnapshot()}))}]};
 qs().unshift(q);
 if(!api.save()){qs().shift();return null}
 render();return q;
}
function csvQuote(q){
 if(!q)return;
 const escCSV=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
 const header=["Concepto","Cantidad","Unidad","Precio unitario","Subtotal"];
 const rows=(q.lines||[]).map(l=>[l.name,l.qty,l.unit,l.price,round(l.qty*l.price)]);
 const t=totals(q.lines||[],q.taxRate,q.discountRate);
 rows.push(["Subtotal","","","",t.subtotal],["Descuento","","","",-t.discount],["Impuestos","","","",t.tax],["TOTAL","","","",t.price]);
 const csv="\ufeffsep=;\r\n"+header.map(escCSV).join(";")+"\r\n"+rows.map(row=>row.map(escCSV).join(";")).join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="ObraConfirmada-"+q.id+".csv";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 info("Archivo CSV compatible con Excel preparado.");
}
async function shareQuote(q,channel){
 if(!q)return info("Guardá primero el presupuesto.");
 if(!window.OCBudgetPDF)return info("El generador de PDF no está disponible.");
 const p={...q,id:q.id,issuedAt:q.updated||q.created,version:q.history?.length||1};
 let file;
 try{
  const blob=window.OCBudgetPDF.build(p,company());
  file=new File([blob],"ObraConfirmada-"+q.id+".pdf",{type:"application/pdf"});
 }catch(e){return info("No se pudo preparar el PDF: "+e.message)}
 if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
  try{await navigator.share({files:[file],title:"Presupuesto "+q.id,text:"Presupuesto de "+q.title+". Elegí WhatsApp, Gmail u otra aplicación para compartir el PDF."});info("Se abrió el menú de compartir.");return}
  catch(e){if(e.name==="AbortError")return}
 }
 // No navegador universal permite adjuntar PDF a WhatsApp/Gmail por enlace sin autorización.
 api.pdf({...p,lines:q.lines},"ObraConfirmada-"+q.id+".pdf",company());
 info("Tu navegador no permite adjuntar directamente el PDF. Lo descargué para que lo adjuntes en "+(channel==="gmail"?"Gmail":channel==="whatsapp"?"WhatsApp":"el servicio que prefieras")+".");
 if(channel==="whatsapp")window.open("https://wa.me/?text="+encodeURIComponent("Te comparto el presupuesto "+q.id+" de "+q.title+". Adjunto el PDF descargado."),"_blank","noopener,noreferrer");
 if(channel==="gmail")window.open("https://mail.google.com/mail/?view=cm&fs=1&su="+encodeURIComponent("Presupuesto "+q.id+" - "+q.title)+"&body="+encodeURIComponent("Hola, adjunto el presupuesto en PDF.\n\nSaludos."),"_blank","noopener,noreferrer");
}
window.OCBusiness={init,render,renderProject,totals,createQuoteFromAgent,shareQuote,csvQuote,openQuote:loadQuote};
})();