/* ObraConfirmada - Formulario de presupuestos.
 * Sin conversación obligatoria: cada dato se escribe o selecciona.
 * Las entrevistas anteriores se conservan y se importan como borradores editables.
 */
(function(){
"use strict";
let api=null,activeId=null,saveTimer=null,pickerSelection=new Set();
const $=id=>document.getElementById(id);
const money=value=>Number(value||0).toLocaleString("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0,maximumFractionDigits:2});
const safe=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const uid=()=>Math.random().toString(36).slice(2,10)+"-"+Date.now().toString(36);
const num=value=>value===""||value==null?NaN:Number(value);
const fullNum=value=>Number.isFinite(num(value))&&num(value)>=0&&num(value)<=999999999;
const date=()=>new Date().toISOString();
const workTypes=[
 {id:"Construcción",icon:"⌂",desc:"Casas y obras nuevas"},
 {id:"Refacción",icon:"⚒",desc:"Reparaciones y reformas"},
 {id:"Aberturas",icon:"▣",desc:"Puertas y ventanas"},
 {id:"Personalizado",icon:"+",desc:"Cualquier otro trabajo"}
];
const suggested={
 "Construcción":[
 ["Preparación y terreno",["Limpieza del terreno","Replanteo de la obra","Excavaciones","Movimiento de suelo","Retiro de escombros"]],
 ["Fundaciones y estructura",["Fundaciones","Hormigonado de bases","Encadenados","Columnas y vigas","Losas y entrepisos"]],
 ["Muros y cubierta",["Mampostería","Revoques","Contrapisos y carpetas","Estructura de techo","Cubierta y aislaciones"]],
 ["Instalaciones",["Instalación eléctrica","Instalación sanitaria","Desagües pluviales","Instalación de gas","Climatización"]],
 ["Terminaciones",["Aberturas","Pisos y revestimientos","Pintura interior","Pintura exterior","Artefactos sanitarios","Limpieza final"]]
 ],
 "Refacción":[
 ["Preparación",["Protección de superficies","Demolición de sectores","Retiro de escombros","Reparación de mampostería"]],
 ["Trabajos",["Revoques y reparaciones","Impermeabilización","Contrapisos y carpetas","Revestimientos y pisos","Instalación eléctrica","Instalación sanitaria"]],
 ["Terminaciones",["Pintura","Colocación de aberturas","Griferías y artefactos","Limpieza final"]]
 ],
 "Aberturas":[
 ["Fabricación y suministro",["Ventanas","Puertas","Paños fijos","Mosquiteros","Herrajes y accesorios"]],
 ["Instalación",["Retiro de aberturas existentes","Preparación de vanos","Colocación y nivelación","Sellado perimetral","Terminaciones y ajustes"]]
 ],
 "Personalizado":[["Trabajos frecuentes",["Mano de obra","Suministro de materiales","Traslado y flete","Instalación","Retiro de residuos"]]]
};
function pickEntries(){
 const d=get();if(!d)return [];
 const entries=[];
 for(const [group,names] of suggested[d.workType]||[]){
  for(const name of names)entries.push({key:"tpl:"+d.workType+":"+name,name,group,unit:"",price:"",cost:"",category:"Servicios"});
 }
 for(const x of api.catalog()){
  entries.push({key:"cat:"+x.id,name:String(x.name||""),group:"De tu catálogo",unit:x.unit||"",price:String(x.price??""),cost:String(x.cost??""),category:x.category||"Materiales"});
 }
 return entries;
}
function selectType(type){
 const d=get();if(!d||!workTypes.some(x=>x.id===type))return;
 d.workType=type;flushSave();
 renderTypes();note("");
}
function renderTypes(){
 const d=get(),host=$("ocWorkTypeCards");if(!d||!host)return;
 host.innerHTML=workTypes.map(t=>'<button type="button" data-type="'+safe(t.id)+'" class="oc-type-card'+(d.workType===t.id?" is-active":"")+'" aria-pressed="'+(d.workType===t.id)+'"><span class="oc-type-icon" aria-hidden="true">'+safe(t.icon)+'</span><strong>'+safe(t.id)+'</strong><small>'+safe(t.desc)+'</small></button>').join("");
 host.querySelectorAll("[data-type]").forEach(btn=>btn.onclick=()=>selectType(btn.dataset.type));
}
function openPicker(){
 const d=get();if(!d)return;
 if(!d.workType){note("Primero elegí el tipo de trabajo.","error");$("ocWorkTypeCards").scrollIntoView({behavior:"smooth",block:"center"});return}
 pickerSelection.clear();
 $("ocPickerSearch").value="";
 $("ocPickerOverlay").classList.remove("hidden");
 $("ocPickerSearch").focus();
 drawPicker();
}
function closePicker(){$("ocPickerOverlay").classList.add("hidden");pickerSelection.clear()}
function drawPicker(){
 const host=$("ocPickerList"),q=$("ocPickerSearch").value.trim().toLocaleLowerCase("es-AR"),entries=pickEntries().filter(x=>(x.name+" "+x.group).toLocaleLowerCase("es-AR").includes(q));
 const groups=[...new Set(entries.map(x=>x.group))];
 host.innerHTML=entries.length?groups.map(group=>'<div class="oc-pick-group"><h4>'+safe(group)+'</h4>'+entries.filter(x=>x.group===group).map(x=>'<label class="oc-pick-choice"><input type="checkbox" data-pick="'+safe(x.key)+'"'+(pickerSelection.has(x.key)?" checked":"")+'><span><strong>'+safe(x.name)+'</strong>'+(x.key.startsWith("cat:")?'<small>Precio guardado: '+money(x.price||0)+'</small>':"<small>Precio y cantidad por completar</small>")+'</span></label>').join("")+'</div>').join(""):'<p class="oc-form-noitems">No encontramos conceptos con ese nombre. Podés agregar uno personalizado.</p>';
 host.querySelectorAll("[data-pick]").forEach(check=>check.onchange=()=>{check.checked?pickerSelection.add(check.dataset.pick):pickerSelection.delete(check.dataset.pick);updatePickerCount()});
 updatePickerCount();
}
function updatePickerCount(){$("ocPickerConfirm").textContent="Agregar seleccionados ("+pickerSelection.size+")";$("ocPickerConfirm").disabled=pickerSelection.size===0}
function commitPicker(){
 const d=get();if(!d)return;
 const entries=pickEntries(),selected=entries.filter(x=>pickerSelection.has(x.key));
 for(const x of selected)d.lines.push(item(x.name,x.unit,"",x.cost,x.price,x.category));
 if(!selected.length)return;
 flushSave();closePicker();linesHTML();
 note(selected.length+" trabajo"+(selected.length===1?" agregado":"s agregados")+". Completá cantidades y precios antes de generar el PDF.","success");
 $("ocFormLines").scrollIntoView({behavior:"smooth",block:"start"});
}

const drafts=()=>api.business().formDrafts||(api.business().formDrafts=[]);
const get=()=>drafts().find(d=>d.id===activeId)||null;
const empty=()=>({
 id:"B-"+uid(),workType:"",title:"",client:"",phone:"",location:"",measurements:"",floors:"",
 scopeType:"Ambos",scope:"",payment:"",discountRate:"0",taxRate:"0",validity:"15",
 delivery:"",notes:"",lines:[],savedQuoteId:null,created:date(),updated:date()
});
function item(name="",unit="",qty="",cost="",price="",category="Materiales"){
 return {id:"I-"+uid(),name:String(name||""),unit:String(unit||""),qty:String(qty??""),cost:String(cost??""),price:String(price??""),category};
}
function fromLegacy(source){
 const a=source.answers||{};
 const result=empty();
 result.legacyId=source.id;
 result.workType="";
 result.title=String(a.description||"");
 result.client=String(a.client||"");
 result.phone=String(a.phone||"");
 result.location=String(a.location||"");
 result.measurements=String(a.area||"");
 result.floors=String(a.floors||"");
 result.scopeType=["Ambos","Solo materiales","Solo mano de obra"].includes(a.scopeType)?a.scopeType:"Ambos";
 result.payment=String(a.payment||"");
 result.discountRate=String(a.discount??0);
 result.taxRate=String(a.tax??0);
 result.validity=String(a.validity??15);
 result.delivery=String(a.delivery||"");
 result.notes=String(a.notes||"");
 result.created=source.created||date();
 result.updated=source.updated||date();
 result.savedQuoteId=source.savedQuoteId||null;
 result.lines=Array.isArray(source.lines)?source.lines.map(x=>item(x.name,x.unit,x.qty,x.missingCost?"":x.cost,x.price,"Materiales")):[];
 return result;
}
function migrate(){
 const old=api.business().assistantDrafts||[];
 const all=drafts();let moved=0;
 for(const legacy of old){
  if(!legacy||!legacy.id||all.some(x=>x.legacyId===legacy.id))continue;
  if(!legacy.answers?.description&&!legacy.lines?.length)continue;
  all.push(fromLegacy(legacy));moved++;
 }
 if(moved)api.save();
}
function note(message,type="info"){
 const target=$("ocFormNotice");target.textContent=message||"";
 target.dataset.kind=type;
}
function save(){
 const d=get();if(!d)return;
 d.updated=date();
 if(!api.save())note("No se pudo guardar la información. Revisá tu conexión.","error");
}
function scheduleSave(){
 if(saveTimer)clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{saveTimer=null;save()},650);
}
function flushSave(){
 if(saveTimer){clearTimeout(saveTimer);saveTimer=null}
 save();
}
function showDrafts(){
 const box=$("ocFormSaved"),host=$("ocFormSavedList"),all=drafts();
 box.classList.toggle("hidden",!all.length);
 host.innerHTML=all.map(d=>{
  const name=(d.title||"Presupuesto sin título").slice(0,75);
  const state=d.savedQuoteId?"Guardado · editable":"En preparación";
  return '<button type="button" class="oc-form-draft'+(d.id===activeId?" is-current":"")+'" data-draft="'+safe(d.id)+'"><strong>'+safe(name)+'</strong><small>'+state+'</small></button>';
 }).join("");
 host.querySelectorAll("[data-draft]").forEach(el=>el.onclick=()=>openDraft(el.dataset.draft));
}
function createDraft(){
 flushBeforeSwitch();
 const d=empty();drafts().unshift(d);activeId=d.id;save();render();$("ocFTitle").focus();
}
function flushBeforeSwitch(){
 if(saveTimer){clearTimeout(saveTimer);saveTimer=null;save()}
}
function openDraft(id){
 flushBeforeSwitch();activeId=drafts().some(x=>x.id===id)?id:null;
 render();
}
function removeDraft(){
 const d=get();if(!d)return;
 const message=d.savedQuoteId?"¿Eliminar este formulario? El presupuesto ya guardado no se borrará.":"¿Eliminar este formulario sin guardar como presupuesto?";
 if(!confirm(message))return;
 const arr=drafts(),idx=arr.findIndex(x=>x.id===d.id);
 if(idx<0)return;
 arr.splice(idx,1);activeId=arr[0]?.id||null;
 if(!api.save()){arr.splice(idx,0,d);activeId=d.id;return note("No se pudo eliminar el formulario.","error")}
 render();
}
function makeOptions(current){
 return ["m²","m³","ml","u","jornal","gl","hora","día"].map(x=>'<option value="'+x+'"'+(current===x?" selected":"")+'>'+x+'</option>').join("");
}
function linesHTML(){
 const d=get();if(!d)return;
 const host=$("ocFormLines");
 host.innerHTML=d.lines.length?d.lines.map((x,i)=>'<div class="oc-simple-line" data-row="'+safe(x.id)+'">'+
 '<div class="oc-simple-name"><strong>'+safe(x.name||"Nuevo trabajo")+'</strong><small>'+safe(x.category||"")+'</small></div>'+
 '<label class="oc-form-field oc-simple-qty"><span>Cantidad</span><input data-key="qty" type="number" min="0.000001" step="any" placeholder="Falta" value="'+safe(x.qty)+'"></label>'+
 '<label class="oc-form-field oc-simple-unit"><span>Unidad</span><input data-key="unit" maxlength="16" list="ocUnitOptions" placeholder="m², u..." value="'+safe(x.unit)+'"></label>'+
 '<label class="oc-form-field oc-simple-price"><span>Precio por unidad</span><input data-key="price" type="number" min="0" step="any" placeholder="Falta" value="'+safe(x.price)+'"></label>'+
 '<div class="oc-simple-amount"><small>Importe</small><strong data-amount>'+((num(x.qty)>0&&fullNum(x.price))?money(num(x.qty)*num(x.price)):"Pendiente")+'</strong></div>'+
 '<button class="oc-form-remove oc-simple-remove" type="button" data-remove="'+safe(x.id)+'" title="Quitar concepto" aria-label="Quitar '+safe(x.name||"concepto")+'">×</button>'+
 '<details class="oc-simple-rowdetail"><summary>Editar nombre y datos internos</summary><div class="oc-form-grid">'+
 '<label class="oc-form-field"><span>Nombre del trabajo</span><input data-key="name" maxlength="140" value="'+safe(x.name)+'"></label>'+
 '<label class="oc-form-field"><span>Categoría</span><select data-key="category">'+["Materiales","Mano de obra","Servicios","Otros"].map(c=>'<option'+(x.category===c?" selected":"")+'>'+c+'</option>').join("")+'</select></label>'+
 '<label class="oc-form-field"><span>Costo interno por unidad (opcional)</span><input data-key="cost" type="number" min="0" step="any" placeholder="Pendiente" value="'+safe(x.cost)+'"></label>'+
 '</div></details></div>').join(""):'<div class="oc-form-noitems">Todavía no seleccionaste trabajos. Tocá «Seleccionar trabajos» para empezar.</div>';
 host.querySelectorAll("[data-row]").forEach(row=>{
  const x=d.lines.find(t=>t.id===row.dataset.row);
  row.querySelectorAll("[data-key]").forEach(c=>{
   c.oninput=()=>{
    updateLine(x,c.dataset.key,c.value);
    if(c.dataset.key==="name"){row.querySelector(".oc-simple-name strong").textContent=c.value||"Nuevo trabajo"}
    const label=row.querySelector("[data-amount]");if(label)label.textContent=num(x.qty)>0&&fullNum(x.price)?money(num(x.qty)*num(x.price)):"Pendiente";
   };
   c.onchange=()=>{updateLine(x,c.dataset.key,c.value);flushSave()};
  });
  row.querySelector("[data-remove]").onclick=()=>{d.lines=d.lines.filter(t=>t.id!==x.id);flushSave();linesHTML()};
 });
 totalsUI();
}
function addLine(fromCatalog=false){
 let d=get();if(!d)return;
 if(fromCatalog){
  const source=api.catalog().find(x=>x.id===$("ocFormCatalog").value);
  if(!source)return note("Elegí primero un precio del catálogo.","error");
  // Price comes from the user's catalog. Quantity is ALWAYS blank.
  d.lines.push(item(source.name,source.unit,"",source.cost,source.price,source.category||"Materiales"));
 }else d.lines.push(item());
 note("");flushSave();linesHTML();
 $("ocFormLines").lastElementChild?.querySelector(fromCatalog?'[data-key="qty"]':'[data-key="name"]')?.focus();
}
function updateLine(line,key,value){
 if(!line)return;line[key]=String(value);scheduleSave();totalsUI();
}
function totalsUI(){
 const d=get();if(!d)return;
 let subtotal=0,cost=0,missingPrice=0,missingQty=0,missingCosts=0;
 for(const r of d.lines){
  const qty=num(r.qty),price=num(r.price),c=num(r.cost);
  if(!(qty>0)){missingQty++;continue}
  if(!fullNum(r.price)){missingPrice++;continue}
  subtotal+=qty*price;
  if(!fullNum(r.cost))missingCosts++;
  else cost+=qty*c;
 }
 const discount=fullNum(d.discountRate)&&num(d.discountRate)<=100?subtotal*num(d.discountRate)/100:0;
 const taxable=subtotal-discount;
 const tax=fullNum(d.taxRate)&&num(d.taxRate)<=100?taxable*num(d.taxRate)/100:0;
 $("ocFormSubtotal").textContent=money(subtotal);
 $("ocFormDiscountTotal").textContent=money(discount);
 $("ocFormTaxTotal").textContent=money(tax);
 $("ocFormTotal").textContent=money(taxable+tax);
 $("ocFormProfit").textContent=missingQty||missingPrice||missingCosts?"Pendiente":money(taxable-cost);
 $("ocFormPending").textContent=(!d.lines.length?"Agregá al menos un concepto.":missingQty||missingPrice?"Completá todas las cantidades y precios de venta antes de guardar.":missingCosts?"Hay costos internos pendientes; la ganancia no será definitiva.":"Los importes se calculan con los datos que cargaste.");
}
function fill(){
 const d=get(),form=$("ocBudgetForm");
 $("ocFormBlank").classList.toggle("hidden",!!d);
 form.classList.toggle("hidden",!d);
 $("ocFormDelete").classList.toggle("hidden",!d);
 if(!d)return;
 const mapping={title:"ocFTitle",client:"ocFClient",phone:"ocFPhone",location:"ocFLocation",measurements:"ocFMeasures",floors:"ocFFloors",scopeType:"ocFScopeType",scope:"ocFScope",payment:"ocFPayment",discountRate:"ocFDiscount",taxRate:"ocFTax",validity:"ocFValidity",delivery:"ocFDelivery",notes:"ocFNotes"};
 for(const [field,id] of Object.entries(mapping))$(id).value=d[field]??"";
 const selector=$("ocFormCatalog");
 selector.innerHTML='<option value="">Elegí un precio que ya guardaste...</option>'+api.catalog().map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+" · "+money(x.price)+'</option>').join("");
 linesHTML();$("ocFormSave").textContent=d.savedQuoteId?"Guardar cambios":"Guardar en Mis presupuestos";
 $("ocFormActions").classList.toggle("hidden",!d.savedQuoteId);
}
function render(){
 migrate();
 if(!drafts().some(d=>d.id===activeId))activeId=drafts()[0]?.id||null;
 showDrafts();
 fill();
}
function createPayload(d){
 const first=$("ocFTitle"),client=$("ocFClient");
 if(!d.title.trim()){note("Ingresá el nombre del trabajo.","error");first.focus();return null}
 if(!d.client.trim()){note("Ingresá el nombre del cliente.","error");client.focus();return null}
 if(!d.lines.length){note("Agregá al menos un material o trabajo.","error");$("ocFormAddLine").focus();return null}
 for(let i=0;i<d.lines.length;i++){
  const line=d.lines[i];
  if(!line.name.trim()||!line.unit.trim()||!Number.isFinite(num(line.qty))||num(line.qty)<=0||!fullNum(line.price)){
   note("Revisá el concepto "+(i+1)+": nombre, unidad, cantidad mayor que cero y precio de venta.","error");
   $("ocFormLines").querySelectorAll("[data-row]")[i]?.querySelector("[data-key='name']")?.focus();
   return null;
  }
  if(line.cost!==""&&!fullNum(line.cost)){note("El costo interno del concepto "+(i+1)+" no es válido.","error");return null}
 }
 if(!fullNum(d.discountRate)||num(d.discountRate)>100||!fullNum(d.taxRate)||num(d.taxRate)>100){note("Revisá los porcentajes de descuento e impuestos (0 a 100).","error");return null}
 if(d.floors!==""&&(!Number.isInteger(num(d.floors))||num(d.floors)<1||num(d.floors)>100)){note("La cantidad de plantas debe ser un número entero positivo.","error");return null}
 if(!Number.isInteger(num(d.validity))||num(d.validity)<1||num(d.validity)>365){note("La validez debe ser de 1 a 365 días.","error");return null}
 const details=[d.scope,d.measurements?"Medidas o superficie informadas: "+d.measurements:"",d.floors?"Plantas: "+d.floors:"",d.scopeType?"Incluye: "+d.scopeType:"",d.location?"Localidad: "+d.location:""].filter(Boolean).join("\n");
 return {
  title:d.title.trim(),client:d.client.trim(),phone:d.phone.trim(),scope:details,
  payment:d.payment.trim(),discountRate:num(d.discountRate),taxRate:num(d.taxRate),
  validity:num(d.validity),delivery:d.delivery.trim(),notes:d.notes.trim(),status:"Borrador",
  lines:d.lines.map(x=>({id:x.id,name:x.name.trim(),unit:x.unit.trim(),qty:num(x.qty),cost:x.cost===""?0:num(x.cost),price:num(x.price),missingCost:x.cost==="",category:x.category}))
 };
}
function saveBudget(e){
 if(e)e.preventDefault();
 const d=get();if(!d)return;
 flushBeforeSwitch();
 const payload=createPayload(d);if(!payload)return;
 $("ocFormSave").disabled=true;
 let q=null;
 try{q=api.createQuote(payload,d.savedQuoteId||null)}
 catch(e){note("No se pudo guardar el presupuesto. Revisá la información.","error")}
 finally{$("ocFormSave").disabled=false}
 if(!q){note("No se pudo guardar el presupuesto. Revisá tu conexión e intentá nuevamente.","error");return}
 d.savedQuoteId=q.id;flushSave();showDrafts();fill();
 note("Presupuesto "+q.id+" guardado. Ya podés descargarlo, compartirlo o seguir editándolo.","success");
}
function savedQuote(){
 const d=get();return api.quotes().find(q=>q.id===d?.savedQuoteId)||null;
}
function action(type){
 const q=savedQuote();
 if(!q){note("Guardá primero el presupuesto.","error");return}
 if(type==="open")api.openQuote(q.id);
 else if(type==="pdf")api.download(q);
 else if(type==="csv")api.csv(q);
 else api.share(q,type==="wa"?"whatsapp":type==="gmail"?"gmail":undefined);
}
function init(bridge){
 api=bridge;
 const css=String.raw`
 .oc-form-page{padding:24px 28px 30px}.oc-form-header{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;border-bottom:1px solid #e7edf1;padding-bottom:20px}
 .oc-form-header h2{font-size:23px;margin:7px 0;color:#213449}.oc-form-header p{color:#6a7d8c;font-size:13px;margin:4px 0}.oc-form-head-actions{display:flex;gap:8px;flex-wrap:wrap}
 .oc-form-saved{margin:20px 0}.oc-form-saved h3{font-size:12px;margin:0 0 10px;color:#435466}
 .oc-form-draftlist{display:flex;gap:9px;overflow-x:auto;padding-bottom:7px}
 .oc-form-draft{min-width:170px;max-width:240px;flex:0 0 196px;text-align:left;background:#f6f8fa;border:1px solid #e2e8ed;border-radius:11px;padding:12px;color:#25394d}
 .oc-form-draft strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
 .oc-form-draft small{display:block;color:#788b9a;font-size:11px;margin-top:6px}.oc-form-draft.is-current{background:#fff7ef;border-color:#d98b4a;box-shadow:inset 3px 0 #d98b4a}
 .oc-form-empty{padding:40px 16px;text-align:center;background:#f5f7fa;border-radius:15px;margin-top:18px}.oc-form-empty strong{font-size:17px;color:#27394a}.oc-form-empty p{color:#728392;font-size:13px}
 .oc-form-card{padding:20px 22px;border:1px solid #e5eaf0;border-radius:14px;margin:17px 0;background:#fff}
 .oc-form-cardhead{display:flex;align-items:start;gap:12px;margin-bottom:18px}.oc-form-num{display:grid;place-items:center;flex:none;width:27px;height:27px;border-radius:9px;background:#fff0e5;color:#b96e3f;font-size:13px;font-weight:800}
 .oc-form-card h3{margin:2px 0 5px;font-size:17px;color:#23394e}.oc-form-card p{color:#7a8b99;font-size:12px;line-height:1.55;margin:0}
 .oc-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
 .oc-form-field{display:flex;flex-direction:column;gap:6px;min-width:0}.oc-form-field span{font-size:12px;color:#405467;font-weight:700}
 .oc-form-field input,.oc-form-field select,.oc-form-field textarea{box-sizing:border-box;width:100%;min-height:42px;border:1px solid #d7dfe7;border-radius:9px;background:#fff;color:#22354a;font-size:13px;padding:10px 12px;font-family:inherit}
 .oc-form-field textarea{resize:vertical;min-height:80px}.oc-form-field input:focus,.oc-form-field select:focus,.oc-form-field textarea:focus{outline:2px solid #ecb67f;outline-offset:1px}
 .oc-form-span2{grid-column:1/-1}
 .oc-form-line{border:1px solid #e4e9ee;border-radius:12px;padding:14px;margin-top:12px;background:#fafbfd}
 .oc-form-linehead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
 .oc-form-linehead strong{font-size:12px;color:#45596a}.oc-form-remove{background:none;border:0;color:#a94545;font-size:12px;text-decoration:underline;cursor:pointer}
 .oc-form-linegrid{display:grid;grid-template-columns:minmax(180px,2fr) minmax(120px,1.1fr) repeat(4,minmax(95px,1fr));gap:10px}
 .oc-form-linegrid .oc-form-field span{font-size:11px}
 .oc-form-tools{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:12px 0}
 .oc-form-tools select{padding:10px;border:1px solid #dbe3eb;background:white;border-radius:9px;max-width:100%;min-width:200px;flex:1}
 .oc-form-noitems{background:#f6f8fa;color:#7b8b9a;padding:22px;text-align:center;font-size:12px;border-radius:11px}
 .oc-form-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}
 .oc-form-summary div{padding:15px;background:#f7f9fa;border-radius:10px}.oc-form-summary small{display:block;color:#778b9a;font-size:11px;margin-bottom:8px}.oc-form-summary b{display:block;color:#24394e;font-size:18px}
 .oc-form-summary .oc-form-grand{background:#243a50}.oc-form-summary .oc-form-grand small,.oc-form-summary .oc-form-grand b{color:#fff}
 .oc-form-status{font-size:12px;margin:14px 0;line-height:1.5;color:#66798a}.oc-form-status[data-kind=error]{color:#9c3e28}.oc-form-status[data-kind=success]{color:#247452}
 .oc-form-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:20px}
 .oc-form-actions-footer{border-top:1px solid #e6edf2;margin-top:20px;padding-top:20px}
 .oc-form-delete{font-size:12px;color:#9c4a3e;background:none;border:0;text-decoration:underline;cursor:pointer;margin-left:auto;padding:10px}
 @media(max-width:1100px){.oc-form-linegrid{grid-template-columns:repeat(3,minmax(0,1fr))}.oc-form-name{grid-column:span 2}}
 @media(max-width:720px){.oc-form-page{padding:18px 14px}.oc-form-card{padding:16px 13px}.oc-form-grid{grid-template-columns:1fr}.oc-form-span2{grid-column:auto}.oc-form-linegrid{grid-template-columns:repeat(2,minmax(0,1fr))}.oc-form-name{grid-column:span 2}.oc-form-summary b{font-size:15px}.oc-form-head-actions{width:100%}.oc-form-head-actions .btn{flex:1}}
 `;
 const style=document.createElement("style");style.textContent=css;document.head.append(style);
 const nav=document.querySelector(".sidenav");
 const button=document.createElement("button");button.type="button";button.className="nav-item";button.dataset.nav="asistente";button.textContent="Crear presupuesto";button.onclick=()=>api.show("asistente");
 nav.insertBefore(button,nav.querySelector('[data-nav="presupuestos"]'));
 const markup=String.raw`
 <section class="page hidden" id="page-asistente">
 <div class="card oc-form-page">
  <div class="oc-form-header"><div><span class="eyebrow">PRESUPUESTOS</span><h2>Nuevo presupuesto</h2><p>Completá los datos, agregá los trabajos y guardá tu presupuesto.</p></div>
   <div class="oc-form-head-actions"><button type="button" id="ocFormNew" class="btn btn-primary">+ Nuevo presupuesto</button><button type="button" id="ocFormGoManual" class="btn btn-secondary">Abrir editor completo</button></div></div>
  <div id="ocFormSaved" class="oc-form-saved hidden"><h3>Continuar presupuestos</h3><div id="ocFormSavedList" class="oc-form-draftlist"></div></div>
  <div id="ocFormBlank" class="oc-form-empty"><strong>Prepará tu próximo presupuesto</strong><p>Todos los importes los indicás vos. Podés guardar y seguir más tarde.</p><button type="button" id="ocFormStart" class="btn btn-primary">Comenzar</button></div>
  <form id="ocBudgetForm" class="hidden" novalidate>
  <div class="oc-form-card"><div class="oc-form-cardhead"><span class="oc-form-num">1</span><div><h3>Datos de la obra</h3><p>Información general y del cliente</p></div></div>
   <div class="oc-form-grid">
    <label class="oc-form-field"><span>Nombre del trabajo *</span><input id="ocFTitle" maxlength="100" required placeholder="Ej.: Construcción de vivienda"></label>
    <label class="oc-form-field"><span>Cliente *</span><input id="ocFClient" maxlength="90" required placeholder="Nombre del cliente"></label>
    <label class="oc-form-field"><span>Teléfono del cliente (opcional)</span><input id="ocFPhone" maxlength="30" type="tel" placeholder="Número de contacto"></label>
    <label class="oc-form-field"><span>Localidad</span><input id="ocFLocation" maxlength="100" placeholder="Lugar de la obra"></label>
    <label class="oc-form-field"><span>Medidas o superficie (dato informativo)</span><input id="ocFMeasures" maxlength="120" placeholder="Ej.: 23 × 15 m o 140 m²"></label>
    <label class="oc-form-field"><span>Cantidad de plantas</span><input id="ocFFloors" type="number" min="1" max="100" step="1" placeholder="Ej.: 1"></label>
    <label class="oc-form-field"><span>¿Qué incluye?</span><select id="ocFScopeType"><option>Ambos</option><option>Solo materiales</option><option>Solo mano de obra</option></select></label>
    <label class="oc-form-field oc-form-span2"><span>Descripción y alcance</span><textarea id="ocFScope" maxlength="2500" rows="3" placeholder="Describí los trabajos incluidos..."></textarea></label>
   </div>
  </div>
  <div class="oc-form-card"><div class="oc-form-cardhead"><span class="oc-form-num">2</span><div><h3>Materiales y trabajos</h3><p>Agregá tantos conceptos como necesites. Las cantidades y precios no se completan automáticamente.</p></div></div>
   <div class="oc-form-tools"><button type="button" id="ocFormAddLine" class="btn btn-secondary">+ Agregar concepto</button><select id="ocFormCatalog" aria-label="Seleccionar un concepto del catálogo"></select><button type="button" id="ocFormAddCatalog" class="btn btn-secondary">Agregar del catálogo</button></div>
   <div id="ocFormLines"></div>
   <datalist id="ocUnitOptions"><option value="m²"></option><option value="m³"></option><option value="ml"></option><option value="u"></option><option value="gl"></option><option value="jornal"></option><option value="hora"></option></datalist>
  </div>
  <div class="oc-form-card"><div class="oc-form-cardhead"><span class="oc-form-num">3</span><div><h3>Condiciones del presupuesto</h3><p>Elegí cómo se presentará al cliente</p></div></div>
   <div class="oc-form-grid">
    <label class="oc-form-field oc-form-span2"><span>Condiciones de pago</span><input id="ocFPayment" maxlength="180" placeholder="Ej.: 50 % de anticipo y saldo al finalizar"></label>
    <label class="oc-form-field"><span>Descuento (%)</span><input id="ocFDiscount" type="number" min="0" max="100" step="any"></label>
    <label class="oc-form-field"><span>Impuestos (%)</span><input id="ocFTax" type="number" min="0" max="100" step="any"></label>
    <label class="oc-form-field"><span>Validez del presupuesto (días)</span><input id="ocFValidity" type="number" min="1" max="365" step="1"></label>
    <label class="oc-form-field"><span>Plazo de ejecución</span><input id="ocFDelivery" maxlength="120" placeholder="Si está definido"></label>
    <label class="oc-form-field oc-form-span2"><span>Observaciones para el cliente</span><textarea id="ocFNotes" maxlength="1200" rows="3" placeholder="Condiciones, exclusiones, aclaraciones..."></textarea></label>
   </div>
  </div>
  <div class="oc-form-card"><div class="oc-form-cardhead"><span class="oc-form-num">4</span><div><h3>Resumen</h3><p>Los precios internos no aparecen en el PDF del cliente</p></div></div>
   <div class="oc-form-summary">
    <div><small>Subtotal</small><b id="ocFormSubtotal">$0</b></div>
    <div><small>Descuento</small><b id="ocFormDiscountTotal">$0</b></div>
    <div><small>Impuestos</small><b id="ocFormTaxTotal">$0</b></div>
    <div class="oc-form-grand"><small>Total al cliente</small><b id="ocFormTotal">$0</b></div>
    <div><small>Ganancia bruta (uso interno)</small><b id="ocFormProfit">Pendiente</b></div>
   </div>
   <p id="ocFormPending" class="oc-form-status"></p>
   <div class="oc-form-actions"><button id="ocFormSave" type="submit" class="btn btn-primary">Guardar en Mis presupuestos</button><span class="subtle">Tus avances se guardan automáticamente.</span></div>
   <p id="ocFormNotice" class="oc-form-status" role="status" aria-live="polite"></p>
   <div id="ocFormActions" class="oc-form-actions oc-form-actions-footer hidden">
    <button id="ocFormPdf" class="btn btn-secondary" type="button">Descargar PDF</button>
    <button id="ocFormCsv" class="btn btn-secondary" type="button">Excel (CSV)</button>
    <button id="ocFormShare" class="btn btn-secondary" type="button">Compartir PDF</button>
    <button id="ocFormWa" class="btn btn-secondary" type="button">WhatsApp</button>
    <button id="ocFormGmail" class="btn btn-secondary" type="button">Gmail</button>
    <button id="ocFormOpen" class="btn btn-secondary" type="button">Editar en Mis presupuestos</button>
   </div>
  </div>
  </form>
  <div class="oc-form-actions"><button type="button" id="ocFormDelete" class="oc-form-delete hidden">Eliminar este formulario</button></div>
 </div></section>
 `;
 const tmp=document.createElement("div");tmp.innerHTML=markup;
 const config=$("page-config");config.parentNode.insertBefore(tmp.firstElementChild,config);
 const keys={ocFTitle:"title",ocFClient:"client",ocFPhone:"phone",ocFLocation:"location",ocFMeasures:"measurements",ocFFloors:"floors",ocFScopeType:"scopeType",ocFScope:"scope",ocFPayment:"payment",ocFDiscount:"discountRate",ocFTax:"taxRate",ocFValidity:"validity",ocFDelivery:"delivery",ocFNotes:"notes"};
 for(const [id,key] of Object.entries(keys)){
  $(id).oninput=()=>{
   const d=get();if(!d)return;
   d[key]=$(id).value;
   if(key==="title")showDrafts();
   scheduleSave();
   if(key==="taxRate"||key==="discountRate")totalsUI();
  };
  $(id).onchange=()=>flushSave();
 }
 $("ocBudgetForm").onsubmit=saveBudget;
 $("ocFormNew").onclick=createDraft;$("ocFormStart").onclick=createDraft;
 $("ocFormGoManual").onclick=()=>api.show("presupuestos");
 $("ocFormAddLine").onclick=()=>addLine(false);
 $("ocFormAddCatalog").onclick=()=>addLine(true);
 $("ocFormDelete").onclick=removeDraft;
 for(const type of ["pdf","csv","share","wa","gmail","open"]){const id={pdf:"ocFormPdf",csv:"ocFormCsv",share:"ocFormShare",wa:"ocFormWa",gmail:"ocFormGmail",open:"ocFormOpen"}[type];$(id).onclick=()=>action(type)}
 render();
}
window.OCAssistant={init,render,begin:createDraft,validateAnswer:()=>({error:"Usá los campos del formulario."})};
})();