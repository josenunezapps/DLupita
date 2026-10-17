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
const info=s=>{$("ocBusinessNotice").textContent=s};
function totals(items,tax){
const cost=round(items.reduce((a,b)=>a+(+b.qty||0)*(+b.cost||0),0));
const subtotal=round(items.reduce((a,b)=>a+(+b.qty||0)*(+b.price||0),0));
return {cost,subtotal,tax:round(subtotal*(+tax||0)/100),price:round(subtotal*(1+(+tax||0)/100)),profit:round(subtotal-cost)};
}
function renderLines(){
const tbody=$("ocLineRows");tbody.innerHTML="";
lines.forEach((x,i)=>{
const tr=document.createElement("tr");
tr.innerHTML='<td><input data-k="name" aria-label="Concepto" value="'+safe(x.name)+'"></td><td><input data-k="unit" aria-label="Unidad" value="'+safe(x.unit)+'"></td><td><input data-k="qty" type="number" min="0.001" step="any" value="'+x.qty+'"></td><td><input data-k="cost" type="number" min="0" step="0.01" value="'+x.cost+'"></td><td><input data-k="price" type="number" min="0" step="0.01" value="'+x.price+'"></td><td><button class="btn btn-danger btn-sm" type="button">×</button></td>';
tr.querySelectorAll("[data-k]").forEach(inp=>inp.oninput=()=>{const k=inp.dataset.k;x[k]=["qty","cost","price"].includes(k)?Number(inp.value):inp.value;renderSummary()});
tr.querySelector("button").onclick=()=>{lines.splice(i,1);renderLines()};
tbody.append(tr);
});renderSummary();
}
function renderSummary(){
const t=totals(lines,$("ocTax").value);
$("ocCost").textContent=cash(t.cost);
$("ocPrice").textContent=cash(t.price);
$("ocProfit").textContent=cash(t.profit);
$("ocMargin").textContent=(t.subtotal>0?(100*t.profit/t.subtotal).toFixed(1):"0")+" %";
}
function newQuote(){
editing=null;lines=[];$("ocQuoteForm").reset();$("ocTax").value="0";$("ocQuoteTitle").textContent="Nuevo presupuesto";$("ocVersions").innerHTML="";
$("ocConvert").disabled=true;renderLines();
}
function loadQuote(id){
const q=qs().find(x=>x.id===id);if(!q)return;
editing=q.id;lines=JSON.parse(JSON.stringify(q.lines||[]));
[["ocJob",q.title],["ocClient",q.client],["ocClientPhone",q.phone],["ocScope",q.scope],["ocPaymentTerms",q.payment],["ocTax",q.taxRate||0],["ocQuoteStatus",q.status]].forEach(([key,value])=>$(key).value=value??"");
$("ocQuoteTitle").textContent=q.id+" · "+q.title;$("ocConvert").disabled=!!q.projectId;
renderLines();renderVersions(q);api.show("presupuestos");$("ocQuoteEditor").scrollIntoView({block:"start",behavior:"smooth"});
}
function validate(){
if(!get("ocJob")||!get("ocClient")){info("Completá el trabajo y el cliente.");return null}
if(!lines.length||lines.some(x=>!String(x.name).trim()||!String(x.unit).trim()||![x.qty,x.cost,x.price].every(v=>Number.isFinite(+v))||+x.qty<=0||+x.cost<0||+x.price<0)){info("Revisá la descripción, cantidades y precios de todos los conceptos.");return null}
const tax=Number($("ocTax").value);if(!Number.isFinite(tax)||tax<0||tax>100){info("Revisá el porcentaje de impuestos.");return null}
const total=totals(lines,tax);if(total.price>999999999){info("El total excede el límite admitido.");return null}
return {title:get("ocJob"),client:get("ocClient"),phone:get("ocClientPhone"),scope:get("ocScope"),payment:get("ocPaymentTerms"),taxRate:tax,status:$("ocQuoteStatus").value,lines:JSON.parse(JSON.stringify(lines))};
}
function saveQuote(){
const data=validate();if(!data)return null;
const old=qs().find(q=>q.id===editing);
const now=new Date().toISOString();
const q={...data,id:old?.id||"PRE-"+Date.now(),created:old?.created||now,updated:now,projectId:old?.projectId||null,history:old?.history||[]};
const v=q.history.length+1;q.history=q.history.concat([{number:v,at:now,snapshot:JSON.parse(JSON.stringify(data))}]);
if(old)Object.assign(old,q);else qs().unshift(q);
api.save();editing=q.id;render();renderVersions(q);info("Presupuesto guardado · versión "+v+".");
return q;
}
function pdf(q){
const t=totals(q.lines||[],q.taxRate||0);
api.pdf({id:q.id,title:q.title,client:q.client,scope:q.scope||"Según los trabajos detallados.",original:t.price,phone:q.phone||"",duration:0,start:"",payment:q.payment||"",validity:15,changes:[],lines:q.lines||[],taxTotal:t.tax,taxRate:q.taxRate||0}, "ObraConfirmada-"+q.id+(q.version?"-v"+q.version:"")+".pdf");
}
function renderVersions(q){
const box=$("ocVersions");box.replaceChildren();
(q.history||[]).slice().reverse().forEach(v=>{const b=document.createElement("button");b.type="button";b.className="btn btn-secondary btn-sm";b.textContent="Versión "+v.number+" · "+new Date(v.at).toLocaleDateString("es-AR")+" · PDF";
b.onclick=()=>pdf({...v.snapshot,id:q.id,version:v.number});box.append(b)});
}
function convert(){
const q=qs().find(x=>x.id===editing);if(!q)return info("Guardá el presupuesto antes.");
if(q.projectId)return info("El presupuesto ya fue convertido.");
if(!confirm("¿Convertir el presupuesto en una obra?"))return;
const t=totals(q.lines||[],q.taxRate||0);const name=api.nextId("OC",pro().map(p=>p.id),100);
pro().unshift({id:name,title:q.title,client:q.client,phone:(q.phone||"00000000").replace(/\D/g,"")||"00000000",scope:q.scope||"Según el presupuesto "+q.id,original:t.price,start:today(),duration:30,payment:q.payment,validity:15,budgetNotes:"Origen: "+q.id,created:new Date().toISOString(),status:"Activa",changes:[],expenses:[],payments:[],lines:JSON.parse(JSON.stringify(q.lines)),taxRate:q.taxRate,taxTotal:t.tax,events:[{text:"Obra creada desde el presupuesto "+q.id,at:new Date().toISOString()}]});
q.projectId=name;q.status="Convertido";api.save();render();api.openProject(name);
}
function renderQuotes(){
const div=$("ocQuotes");const all=qs();
div.innerHTML=all.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Presupuesto</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>'+all.map(q=>'<tr><td><b>'+safe(q.title)+'</b><small>'+safe(q.id)+'</small></td><td>'+safe(q.client)+'</td><td>'+cash(totals(q.lines||[],q.taxRate).price)+'</td><td>'+safe(q.status)+'</td><td><button data-q="'+safe(q.id)+'" class="btn btn-secondary btn-sm">Abrir</button></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">No hay presupuestos todavía.</div>';
div.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>loadQuote(b.dataset.q));
}
function renderCatalog(){
const items=cat();$("ocCatalogSelect").innerHTML='<option value="">Seleccionar precio guardado...</option>'+items.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+' · '+cash(x.price)+'</option>').join("");
const div=$("ocCatalog");
div.innerHTML=items.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Concepto</th><th>Unidad</th><th>Costo</th><th>Venta</th><th>Fecha</th><th></th></tr></thead><tbody>'+items.map(x=>'<tr><td><b>'+safe(x.name)+'</b><small>'+safe(x.category||"General")+'</small></td><td>'+safe(x.unit)+'</td><td>'+cash(x.cost)+'</td><td>'+cash(x.price)+'</td><td>'+safe(x.updated)+'</td><td><button class="btn btn-secondary btn-sm" data-edit="'+safe(x.id)+'">Editar</button> <button class="btn btn-danger btn-sm" data-del="'+safe(x.id)+'">Quitar</button></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">Todavía no hay conceptos en el catálogo.</div>';
div.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const c=items.find(x=>x.id===b.dataset.edit);if(!c)return;editingCatalog=c.id;$("ocConcept").value=c.name;$("ocUnit").value=c.unit;$("ocCategory").value=c.category||"";$("ocUnitCost").value=c.cost;$("ocUnitPrice").value=c.price;api.show("catalogo");$("ocConcept").focus();info("Editando "+c.name+". Guardá para actualizar el precio.");});
div.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{if(!confirm("¿Quitar este concepto? No modifica presupuestos ya guardados."))return;const i=items.findIndex(x=>x.id===b.dataset.del);if(i>=0){items.splice(i,1);api.save();renderCatalog()}});
}
function renderProject(p){
if(!p)return;
const expenses=p.expenses||[],payments=p.payments||[];
const cost=expenses.reduce((s,e)=>s+Number(e.amount),0),paid=payments.reduce((s,e)=>s+Number(e.amount),0),price=Number(p.original||0)+(p.changes||[]).filter(x=>x.status==="Aprobado").reduce((s,x)=>s+Number(x.delta),0);
$("ocJobCost").textContent=cash(cost);$("ocJobPaid").textContent=cash(paid);$("ocJobPending").textContent=cash(price-paid);$("ocJobProfit").textContent=cash(price-cost);
$("ocExpenses").innerHTML=expenses.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Fecha</th><th>Gasto</th><th>Categoría</th><th>Importe</th></tr></thead><tbody>'+expenses.slice().reverse().map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+safe(x.concept)+'</td><td>'+safe(x.category)+'</td><td>'+cash(x.amount)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="subtle">Sin gastos registrados.</p>';
$("ocPayments").innerHTML=payments.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Fecha</th><th>Detalle</th><th>Importe</th></tr></thead><tbody>'+payments.slice().reverse().map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+safe(x.concept)+'</td><td>'+cash(x.amount)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="subtle">Sin cobros registrados.</p>';
}
function renderFinance(){
const rows=pro().map(p=>{const cost=(p.expenses||[]).reduce((s,x)=>s+Number(x.amount),0),paid=(p.payments||[]).reduce((s,x)=>s+Number(x.amount),0);
const price=Number(p.original||0)+(p.changes||[]).filter(c=>c.status==="Aprobado").reduce((s,c)=>s+Number(c.delta),0);return {p,cost,paid,price}});
$("ocTotalSales").textContent=cash(rows.reduce((s,x)=>s+x.price,0));
$("ocTotalCosts").textContent=cash(rows.reduce((s,x)=>s+x.cost,0));
$("ocTotalPaid").textContent=cash(rows.reduce((s,x)=>s+x.paid,0));
$("ocTotalPending").textContent=cash(rows.reduce((s,x)=>s+x.price-x.paid,0));
const div=$("ocFinance");
div.innerHTML=rows.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Obra</th><th>Presupuesto</th><th>Gastos</th><th>Cobrado</th><th>Pendiente</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+safe(x.p.title)+'</b></td><td>'+cash(x.price)+'</td><td>'+cash(x.cost)+'</td><td>'+cash(x.paid)+'</td><td>'+cash(x.price-x.paid)+'</td><td><button data-p="'+safe(x.p.id)+'" class="btn btn-secondary btn-sm">Abrir</button></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">Todavía no hay obras registradas.</div>';
div.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>api.openProject(b.dataset.p));
}
function render(){renderQuotes();renderCatalog();renderFinance();
$("ocCompanyName").value=company().name||"";$("ocCompanyPhone").value=company().phone||"";}
function installUI(){
 const style=document.createElement("style");style.textContent=".oc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.oc-stats .card{padding:16px}.oc-stats b{display:block;font-size:18px;margin-top:8px}.oc-stats small{color:#8390a0}.oc-split{display:grid;grid-template-columns:1fr 1fr;gap:17px}.oc-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.oc-tools select{padding:10px;border:1px solid #dce4ec;background:white;border-radius:8px}.oc-lines{min-width:650px}.oc-lines input{font-size:12px;border:1px solid #dce3ea;border-radius:8px;width:100%;min-width:65px;padding:8px}.oc-lines td:first-child input{min-width:150px}@media(max-width:850px){.oc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.oc-split{grid-template-columns:1fr}}@media(max-width:550px){.oc-stats .card{padding:10px}.oc-stats b{font-size:15px}}";document.head.append(style);
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
$("ocNewQuote").onclick=()=>{newQuote();api.show("presupuestos")};
$("ocAddLine").onclick=()=>{lines.push({id:id(),name:"",unit:"u",qty:1,cost:0,price:0});renderLines()};
$("ocAddCatalog").onclick=()=>{const c=cat().find(x=>x.id===$("ocCatalogSelect").value);if(c){lines.push({id:id(),name:c.name,unit:c.unit,qty:1,cost:c.cost,price:c.price});renderLines()}};
$("ocTax").oninput=renderSummary;
$("ocSaveQuote").onclick=saveQuote;
$("ocPrintQuote").onclick=()=>{const q=qs().find(x=>x.id===editing);if(!q)return info("Guardá el presupuesto primero.");pdf(q)};
$("ocConvert").onclick=convert;
$("ocCatalogForm").onsubmit=e=>{e.preventDefault();const name=get("ocConcept"),unit=get("ocUnit"),cost=+$("ocUnitCost").value,price=+$("ocUnitPrice").value;
if(!name||!unit||!Number.isFinite(cost)||cost<0||!Number.isFinite(price)||price<0){info("Revisá los datos del catálogo.");return}
const previous=editingCatalog&&cat().find(x=>x.id===editingCatalog);
if(previous){Object.assign(previous,{name,unit,cost,price,category:get("ocCategory"),updated:today()})}else cat().unshift({id:id(),name,unit,cost,price,category:get("ocCategory"),updated:today()});
editingCatalog=null;api.save();e.target.reset();render();info("Precio guardado.")};
$("ocExpenseForm").onsubmit=e=>{e.preventDefault();const p=api.currentProject(),v=+$("ocExpenseAmount").value,concept=get("ocExpenseConcept");if(!p||!concept||!Number.isFinite(v)||v<=0)return;
(p.expenses||(p.expenses=[])).push({id:id(),date:$("ocExpenseDate").value||today(),concept,category:$("ocExpenseCategory").value,amount:v});api.save();e.target.reset();$("ocExpenseDate").value=today();renderProject(p);renderFinance();info("Gasto registrado.")};
$("ocPaymentForm").onsubmit=e=>{e.preventDefault();const p=api.currentProject(),v=+$("ocPaymentAmount").value,concept=get("ocPaymentConcept");if(!p||!concept||!Number.isFinite(v)||v<=0)return;
(p.payments||(p.payments=[])).push({id:id(),date:$("ocPaymentDate").value||today(),concept,amount:v});api.save();e.target.reset();$("ocPaymentDate").value=today();renderProject(p);renderFinance();info("Cobro registrado.")};
$("ocCompanyForm").onsubmit=e=>{e.preventDefault();company().name=get("ocCompanyName");company().phone=get("ocCompanyPhone");api.save();info("Datos del negocio guardados.")};
$("ocExpenseDate").value=today();$("ocPaymentDate").value=today();
newQuote();render();
}
window.OCBusiness={init,render,renderProject,totals};
})();