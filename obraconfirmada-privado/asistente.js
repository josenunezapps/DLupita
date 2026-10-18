/* ObraConfirmada - agente de entrevistas y presupuestos, sin precios supuestos. */
(function(){
"use strict";
let api=null,current=null,busy=false;
const $=id=>document.getElementById(id),uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);
const escape=s=>String(s??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const trim=s=>String(s||"").trim(),money=n=>Number(n||0).toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:2});
const steps=[
 {key:"description",q:"¿Qué trabajo querés presupuestar? Describímelo brevemente. Por ejemplo: «Casa de dos pisos de 140 m²».",hint:"No necesito todavía medidas exactas ni precios."},
 {key:"area",q:"¿Qué superficie abarca el trabajo? Indicá los m² totales o respondé «No aplica» si no corresponde.",hint:"Es un dato de referencia. No calcularé materiales a partir de esta superficie."},
 {key:"floors",q:"¿Cuántas plantas o niveles incluye? Si no aplica, escribí «No aplica».",hint:"Este dato solo describe el proyecto."},
 {key:"scopeType",q:"¿Vas a cotizar materiales, mano de obra o ambos?",choices:["Ambos","Solo materiales","Solo mano de obra"]},
 {key:"location",q:"¿En qué localidad se realizará la obra? Si preferís no indicarla, escribí «Omitir».",hint:"No buscaré ni inventaré precios por ubicación."},
 {key:"client",q:"¿A nombre de quién irá el presupuesto? Escribí el nombre del cliente."},
 {key:"phone",q:"¿Querés indicar el teléfono del cliente? Escribilo o respondé «Omitir»."},
 {key:"concept",q:"Ahora vamos con los conceptos. ¿Cuál es el primer trabajo o material que vas a presupuestar?",hint:"Podés cargar cada concepto uno por uno o elegir un precio de tu catálogo."},
 {key:"quantity",q:"¿Qué cantidad tendrá este concepto? Indicá únicamente la cantidad, por ejemplo 25 o 2,5."},
 {key:"unit",q:"¿En qué unidad se mide? Por ejemplo m², m³, metro lineal, unidad, jornal o global.",choices:["m²","m³","ml","u","jornal","gl"]},
 {key:"price",q:"¿Cuál es el precio de VENTA por unidad en pesos argentinos? Solo usaré el importe que me indiques."},
 {key:"cost",q:"¿Cuál es tu COSTO interno por unidad? Si no lo conocés, respondé «Pendiente»; quedará sin completar.",hint:"No aparece en el PDF. Si queda pendiente, la ganancia no podrá considerarse definitiva."},
 {key:"another",q:"¿Querés agregar otro concepto?",choices:["Sí, otro concepto","No, terminar conceptos"]},
 {key:"payment",q:"¿Cuáles son las condiciones de pago? Escribilas o respondé «Omitir»."},
 {key:"discount",q:"¿Aplicamos un descuento porcentual? Escribí el porcentaje (0 si no corresponde)."},
 {key:"tax",q:"¿Qué porcentaje de impuestos querés sumar? Escribí 0 si no corresponde.",hint:"No agregaré IVA u otros impuestos automáticamente."},
 {key:"validity",q:"¿Cuántos días de validez tendrá el presupuesto? Escribí un número entre 1 y 365."},
 {key:"delivery",q:"¿Qué plazo de ejecución querés informar? Podés escribirlo o responder «Omitir»."},
 {key:"notes",q:"¿Querés agregar observaciones, exclusiones o condiciones adicionales? Respondé «Omitir» si no."}
];
const stepKeys=steps.map(x=>x.key);
const notApplicable=s=>/^(omitir|no aplica|ninguno|ninguna|no corresponde|na|n\/a|s\/d|sin dato)$/i.test(trim(s));
const pending=s=>/^(pendiente|no se|no sé|no lo se|no lo sé|a confirmar|sin precio)$/i.test(trim(s));
function num(s){let str=trim(s).replace(/\$/g,"").replace(/\s/g,"");if(!str)return NaN;
 if(!/^[0-9.,]+$/.test(str))return NaN;
 if(str.includes(",")&&str.includes("."))str=str.lastIndexOf(",")>str.lastIndexOf(".")?str.replace(/\./g,"").replace(",","."):str.replace(/,/g,"");
 else if(str.includes(","))str=str.replace(",",".");
 else if(/^\d{1,3}(\.\d{3})+$/.test(str))str=str.replace(/\./g,"");
 const val=Number(str);return Number.isFinite(val)?val:NaN;
}
function history(){return api.business().assistantDrafts||(api.business().assistantDrafts=[])}
function newDraft(){return {id:"AS-"+uid(),step:0,answers:{},lines:[],log:[],pendingLine:{},savedQuoteId:null,created:new Date().toISOString(),updated:new Date().toISOString()}}
function getStep(){return steps[current?.step]||null}
function say(role,text){if(!current)return;current.log.push({role,text:String(text),at:new Date().toISOString()});if(current.log.length>180)current.log.splice(0,current.log.length-180)}
function save(){if(!current)return;current.updated=new Date().toISOString();api.save()}
function ask(){const s=getStep();if(s)say("assistant",s.q)}
function begin(){current=newDraft();history().unshift(current);ask();save();render();api.show("asistente")}
function continueDraft(id){current=history().find(x=>x.id===id)||null;render();api.show("asistente")}
function questionKey(){return getStep()?.key||"done"}
function msg(s){$("ocAssistantNotice").textContent=s}
function validateAnswer(key,raw){
 const answer=trim(raw),omit=notApplicable(answer);
 if(!answer)return {error:"Necesito una respuesta para continuar."};
 if(["description","client","concept"].includes(key)&&omit)return {error:"Este dato es necesario para preparar el presupuesto."};
 if(["area","floors","location","phone","payment","delivery","notes"].includes(key)&&omit)return {value:""};
 if(key==="scopeType"){if(/ambos|materiales y mano|mano de obra y materiales/i.test(answer))return {value:"Ambos"};
  if(/solo materiales|materiales solamente/i.test(answer))return {value:"Solo materiales"};
  if(/solo mano|mano de obra solamente/i.test(answer))return {value:"Solo mano de obra"};
  return {error:"Elegí «Ambos», «Solo materiales» o «Solo mano de obra»."};}
 if(key==="another"){if(/^(s[ií]|otro|agregar|sí, otro concepto)/i.test(answer))return {value:true};if(/^(no|terminar|no, terminar conceptos)/i.test(answer))return {value:false};return {error:"Respondé «Sí, otro concepto» o «No, terminar conceptos»."}}
 if(key==="cost"&&pending(answer))return {value:null};
 if(["quantity","price","cost","discount","tax","validity"].includes(key)){
  const n=num(answer);if(!Number.isFinite(n))return {error:"Necesito un número válido, por ejemplo 12500 o 12,5."};
  if(["quantity","validity"].includes(key)&&n<=0)return {error:"Ingresá un número mayor que cero."};
  if(["price","cost","discount","tax"].includes(key)&&n<0)return {error:"No se permiten valores negativos."};
  if(["discount","tax"].includes(key)&&n>100)return {error:"El porcentaje debe estar entre 0 y 100."};
  if(key==="validity"&&(!Number.isInteger(n)||n>365))return {error:"La validez debe ser un número entero entre 1 y 365 días."};
  if(n>999999999)return {error:"Ese importe excede el máximo permitido."};
  return {value:n};
 }
 if(key==="unit"&&answer.length>15)return {error:"La unidad es demasiado larga; usá una abreviatura."};
 if(answer.length>(key==="notes"?1200:key==="description"?600:180))return {error:"Acortá la respuesta para continuar."};
 return {value:answer};
}
function advance(key,value){
 const a=current.answers,l=current.pendingLine;
 switch(key){
 case "concept":l.name=value;break;
 case "quantity":l.qty=value;break;
 case "unit":l.unit=value;break;
 case "price":l.price=value;break;
 case "cost":
   l.cost=value;l.missingCost=value===null;
   current.lines.push({id:"AI-"+uid(),name:l.name,qty:l.qty,unit:l.unit,price:l.price,cost:value===null?0:value,missingCost:value===null});
   current.pendingLine={};
   break;
 case "another":if(value===true){current.step=stepKeys.indexOf("concept");return}break;
 default:a[key]=value;
 }
 current.step++;
}
function answer(raw){
 if(!current||busy)return;
 const step=getStep();if(!step)return msg("La entrevista terminó. Guardá el presupuesto o iniciá otra.");
 const result=validateAnswer(step.key,raw);
 if(result.error){msg(result.error);return}
 say("user",trim(raw));
 advance(step.key,result.value);msg("");ask();save();render();
}
function fromCatalog(id){
 if(!current||!["concept","quantity","unit","price","cost"].includes(questionKey()))return;
 const entry=api.catalog().find(x=>x.id===id);if(!entry)return;
 const catItem={id:"AI-"+uid(),name:entry.name,qty:1,unit:entry.unit,price:Number(entry.price),cost:Number(entry.cost||0),missingCost:false};
 if(!Number.isFinite(catItem.price)||catItem.price<0||!Number.isFinite(catItem.cost)||catItem.cost<0)return msg("El precio guardado no es válido.");
 current.lines.push(catItem);current.pendingLine={};
 say("user","Utilizar el concepto del catálogo: "+entry.name+" (cantidad inicial 1, precio de venta "+money(entry.price)+").");
 say("assistant","Agregué «"+entry.name+"» con cantidad 1 y los precios guardados en tu catálogo. Después podés editar esa cantidad y cualquier precio en el presupuesto. ¿Querés agregar otro concepto?");
 current.step=stepKeys.indexOf("another");save();render();
}
function total(){
 const a=current?.answers||{},items=current?.lines||[];
 const s=items.reduce((n,l)=>n+l.qty*l.price,0),discount=s*(Number(a.discount)||0)/100,tax=(s-discount)*(Number(a.tax)||0)/100;
 return {subtotal:s,discount,tax,price:s-discount+tax,missing:items.filter(l=>l.missingCost).length};
}
function payload(){
 if(!current||current.step<steps.length||!current.lines.length)return null;
 const a=current.answers,p=current.pendingLine;
 return {title:trim(a.description).slice(0,100),client:a.client,phone:a.phone||"",scope:[a.description,a.area?"Superficie informada: "+a.area:"",a.floors?"Plantas: "+a.floors:"",a.scopeType?"Alcance: "+a.scopeType:"",a.location?"Ubicación: "+a.location:""].filter(Boolean).join("\n"),lines:JSON.parse(JSON.stringify(current.lines)),payment:a.payment||"",taxRate:a.tax||0,discountRate:a.discount||0,validity:a.validity||15,delivery:a.delivery||"",notes:[a.notes||"",current.lines.some(x=>x.missingCost)?"Costos internos pendientes de confirmar.":""].filter(Boolean).join("\n"),status:"Borrador"};
}
function createQuote(){
 const p=payload();if(!p)return msg("Faltan respuestas o conceptos para preparar el presupuesto.");
 const existing=current.savedQuoteId&&api.quotes().find(q=>q.id===current.savedQuoteId);
 if(existing){msg("Este borrador ya tiene un presupuesto guardado. Abrilo y editá los conceptos desde Presupuestos.");api.openQuote(existing.id);return}
 const q=api.createQuote(p);
 if(!q)return msg("No se pudo guardar el presupuesto. Revisá la conexión y reintentá.");
 current.savedQuoteId=q.id;say("assistant","¡Presupuesto guardado! Código: "+q.id+". Podés editar cada concepto, descargar PDF o compartirlo.");save();render();
}
function render(){
 const list=history(),selection=$("ocAssistantDrafts");if(!selection)return;
 if(!current&&list.length)current=list[0];
 selection.innerHTML='<option value="">Elegir entrevista guardada...</option>'+list.map(x=>'<option value="'+escape(x.id)+'">'+escape((x.answers?.description||"Entrevista iniciada").slice(0,60))+(x.savedQuoteId?" · Guardado":" · En progreso")+'</option>').join("");
 selection.value=current?.id||"";
 const panel=$("ocAssistantConversation"),form=$("ocAssistantForm"),review=$("ocAssistantReview");
 if(!current){panel.innerHTML='<div class="oc-ai-empty">Empezá una entrevista para preparar tu presupuesto. El asistente no inventará precios ni cantidades.</div>';form.classList.add("hidden");review.classList.add("hidden");$("ocAssistantStep").textContent="Sin entrevista";return}
 panel.innerHTML=current.log.map(x=>'<div class="oc-ai-bubble '+(x.role==="user"?"oc-ai-user":"oc-ai-bot")+'">'+escape(x.text)+'</div>').join("");
 panel.scrollTop=panel.scrollHeight;
 const step=getStep(),done=!step;
 $("ocAssistantStep").textContent=done?"Entrevista completa":"Pregunta "+(current.step+1)+" de "+steps.length;
 const progress=Math.min(100,100*current.step/steps.length);$("ocAssistantProgress").style.width=progress+"%";
 form.classList.toggle("hidden",done);
 const hint=$("ocAssistantHint"),choices=$("ocAssistantChips"),catalogBlock=$("ocAssistantCatalogBlock");
 if(step){
  $("ocAssistantInput").placeholder=step.hint||"Escribí tu respuesta...";
  $("ocAssistantInput").value="";
  choices.replaceChildren();
  (step.choices||[]).forEach(label=>{const b=document.createElement("button");b.type="button";b.className="btn btn-secondary btn-sm";b.textContent=label;b.onclick=()=>answer(label);choices.append(b)});
  hint.textContent=step.hint||"";
  const canChoose=["concept","quantity","unit","price","cost"].includes(step.key)&&api.catalog().length>0;
  catalogBlock.classList.toggle("hidden",!canChoose);
  if(canChoose){const sel=$("ocAssistantCatalog");sel.innerHTML='<option value="">Seleccioná un concepto guardado...</option>'+api.catalog().map(x=>'<option value="'+escape(x.id)+'">'+escape(x.name)+' · '+money(x.price)+'</option>').join("")}
 }
 review.classList.toggle("hidden",!done);
 if(done){const t=total();$("ocAssistantSummary").innerHTML='<p><strong>'+escape(current.answers.description)+'</strong></p><p>Conceptos: '+current.lines.length+' · Subtotal: '+money(t.subtotal)+' · Descuento: '+money(t.discount)+' · Impuestos: '+money(t.tax)+'</p><h3>Total previsto: '+money(t.price)+'</h3>'+(t.missing?'<p class="oc-ai-warning">'+t.missing+' conceptos tienen costo interno pendiente. Revisalos antes de calcular la ganancia.</p>':"");$("ocAssistantGenerate").textContent=current.savedQuoteId?"Abrir presupuesto guardado":"Crear presupuesto editable"}
 $("ocAssistantDelete").disabled=!current;
}
function init(bridge){
 api=bridge;
 const style=document.createElement("style");style.textContent=".oc-ai-layout{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:16px}.oc-ai-chat{height:390px;overflow:auto;background:#f5f7fa;border-radius:14px;padding:17px;display:flex;flex-direction:column;gap:12px}.oc-ai-bubble{font-size:13px;white-space:pre-wrap;line-height:1.65;max-width:88%;padding:12px 14px;border-radius:15px}.oc-ai-bot{align-self:flex-start;background:#fff;color:#23384b;border:1px solid #e4e9ef}.oc-ai-user{align-self:flex-end;background:#23374d;color:#fff}.oc-ai-input{display:flex;gap:9px;margin-top:12px}.oc-ai-input input{min-width:0;flex:1;padding:12px;border:1px solid #d6dee8;border-radius:10px}.oc-ai-chips{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}.oc-ai-step{font-weight:700;font-size:12px;color:#a46639}.oc-ai-track{height:6px;background:#e6ecf1;border-radius:10px;overflow:hidden;margin:8px 0 14px}.oc-ai-track div{height:100%;width:0;background:#d5894b;transition:width .25s}.oc-ai-warning{background:#fff4df;padding:12px;border-radius:9px;color:#82550f}.oc-ai-actions{display:flex;gap:8px;flex-wrap:wrap}.oc-ai-empty{color:#657588;text-align:center;margin:auto;line-height:1.6}.oc-ai-side .card{margin-bottom:12px}@media(max-width:880px){.oc-ai-layout{grid-template-columns:1fr}.oc-ai-chat{height:340px}}";document.head.append(style);
 const nav=document.querySelector(".sidenav"),button=document.createElement("button");button.type="button";button.className="nav-item";button.dataset.nav="asistente";button.textContent="✦ Asistente de presupuestos";button.onclick=()=>api.show("asistente");nav.insertBefore(button,nav.querySelector('[data-nav="presupuestos"]'));
 const html='<section class="page hidden" id="page-asistente"><div class="card panel"><div class="sectionhead"><div><span class="eyebrow">PRESUPUESTOS GUIADOS</span><h2>Asistente de presupuestos</h2></div><button id="ocAssistantNew" class="btn btn-primary">+ Nueva entrevista</button></div><p class="subtle">El asistente pregunta y organiza tus respuestas. No estima cantidades ni precios: solo utiliza lo que ingresás o elegís del catálogo. Podés continuar entrevistas guardadas.</p><div class="oc-ai-layout"><div><div class="oc-ai-step" id="ocAssistantStep"></div><div class="oc-ai-track"><div id="ocAssistantProgress"></div></div><div class="oc-ai-chat" id="ocAssistantConversation"></div><form id="ocAssistantForm" class="hidden"><div class="oc-ai-input"><input id="ocAssistantInput" maxlength="1200" autocomplete="off" placeholder="Tu respuesta" required><button class="btn btn-primary">Responder</button></div><div id="ocAssistantChips" class="oc-ai-chips"></div><p id="ocAssistantHint" class="subtle"></p><div id="ocAssistantCatalogBlock" class="hidden"><select id="ocAssistantCatalog"></select><button type="button" id="ocAssistantUseCatalog" class="btn btn-secondary btn-sm">Usar concepto del catálogo</button></div></form><div class="card hidden" id="ocAssistantReview"><h3>Revisá el resumen</h3><div id="ocAssistantSummary"></div><button type="button" id="ocAssistantGenerate" class="btn btn-primary">Crear presupuesto editable</button></div><p id="ocAssistantNotice" class="subtle" role="status" aria-live="polite"></p></div><aside class="oc-ai-side"><div class="card"><h3>Entrevistas guardadas</h3><select id="ocAssistantDrafts" style="width:100%"></select><div class="oc-ai-actions" style="margin-top:12px"><button type="button" id="ocAssistantOpen" class="btn btn-secondary btn-sm">Continuar</button><button type="button" id="ocAssistantDelete" class="btn btn-danger btn-sm">Eliminar borrador</button></div></div><div class="card"><h3>Presupuesto manual</h3><p class="subtle">Si preferís, podés seguir creando presupuestos con el formulario tradicional.</p><button type="button" id="ocAssistantManual" class="btn btn-secondary">Ir al presupuesto manual</button></div></aside></div></div></section>';
 const page=document.createElement("div");page.innerHTML=html;const el=page.firstElementChild,config=document.getElementById("page-config");config.parentNode.insertBefore(el,config);
 $("ocAssistantForm").onsubmit=e=>{e.preventDefault();answer($("ocAssistantInput").value)};
 $("ocAssistantNew").onclick=begin;
 $("ocAssistantOpen").onclick=()=>continueDraft($("ocAssistantDrafts").value);
 $("ocAssistantDelete").onclick=()=>{if(!current||!confirm("¿Eliminar esta entrevista guardada? No eliminará el presupuesto ya creado."))return;const a=history(),i=a.findIndex(x=>x.id===current.id);if(i>=0)a.splice(i,1);current=a[0]||null;api.save();render()};
 $("ocAssistantManual").onclick=()=>api.show("presupuestos");
 $("ocAssistantUseCatalog").onclick=()=>fromCatalog($("ocAssistantCatalog").value);
 $("ocAssistantGenerate").onclick=createQuote;
 render();
}
window.OCAssistant={init,render,begin,validateAnswer};
})();