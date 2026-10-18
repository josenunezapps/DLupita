/* ObraConfirmada - agente de entrevistas y presupuestos, sin precios supuestos. */
(function(){
"use strict";
let api=null,current=null,busy=false,aiBusy=false,cloudSequence=0;
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

/* A saved conversation could contain questions rewritten by the old AI behavior.
   Recover the fixed question for each known interview step without modifying
   user responses, numeric fields, quote lines, or previously saved estimates. */
function restoreLegacyQuestions(draft){
 if(!draft||draft.fixedQuestionsVersion===1||!Array.isArray(draft.log))return false;
 let pos=0,fromCatalog=false,changed=false;
 const shortHistory=draft.log.length<=155;
 for(const entry of draft.log){
  if(!entry||typeof entry.text!=="string")continue;
  if(entry.role==="user"){
   const response=entry.text.trim();
   if(response.startsWith("Utilizar del catálogo:")){pos=stepKeys.indexOf("quantity");fromCatalog=true;continue}
   if(pos===stepKeys.indexOf("quantity")&&fromCatalog){pos=stepKeys.indexOf("another");fromCatalog=false;continue}
   if(pos===stepKeys.indexOf("another")&&/^(sí|si|otro|agregar)/i.test(response)){pos=stepKeys.indexOf("concept");continue}
   pos=Math.min(steps.length,pos+1);
  }else if(entry.role==="assistant"&&shortHistory&&pos<steps.length){
   // The catalog quantity question and confirmation messages have special,
   // intentionally authored text and must be preserved.
   if(/^(Elegiste «|Agregué «|¡Presupuesto guardado!)/.test(entry.text))continue;
   if(entry.text!==steps[pos].q){entry.text=steps[pos].q;changed=true}
  }
 }
 // The stored step is authoritative for the question still awaiting an answer.
 if(draft.step>=0&&draft.step<steps.length&&draft.log.length){
  const last=draft.log[draft.log.length-1];
  if(last?.role==="assistant"&&!/^(Elegiste «|Agregué «|¡Presupuesto guardado!)/.test(last.text)){
   const fixed=steps[draft.step].q;
   if(last.text!==fixed){last.text=fixed;changed=true}
  }
 }
 draft.fixedQuestionsVersion=1;
 return true;
}

function say(role,text){if(!current)return;current.log.push({role,text:String(text),at:new Date().toISOString()});if(current.log.length>180)current.log.splice(0,current.log.length-180)}
function save(){if(!current)return;current.updated=new Date().toISOString();api.save()}
function ask(){const s=getStep();if(s)say("assistant",s.q)}
function begin(){cancelHelp();current=newDraft();history().unshift(current);ask();save();render();api.show("asistente")}
function continueDraft(id){cancelHelp();current=history().find(x=>x.id===id)||null;render();api.show("asistente")}
function questionKey(){return getStep()?.key||"done"}
function msg(s){$("ocAssistantNotice").textContent=s}
function validateAnswer(key,raw){
 const answer=trim(raw),omit=notApplicable(answer);
 if(!answer)return {error:"Necesito una respuesta para continuar."};
 if(["description","client","concept"].includes(key)&&omit)return {error:"Este dato es necesario para preparar el presupuesto."};
 if(["area","floors","location","phone","payment","delivery","notes"].includes(key)&&omit)return {value:""};
 if(key==="scopeType"){if(/ambos|materiales y mano|mano de obra y materiales/i.test(answer))return {value:"Ambos"};
  if(/solo materiales|materiales solamente|^materiales$/i.test(answer))return {value:"Solo materiales"};
  if(/solo mano|mano de obra solamente|^mano de obra$/i.test(answer))return {value:"Solo mano de obra"};
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
 case "quantity":
    l.qty=value;
    if(l.fromCatalog){
      current.lines.push({id:"AI-"+uid(),name:l.name,qty:l.qty,unit:l.unit,price:l.price,cost:l.cost,missingCost:!!l.missingCost});
      current.pendingLine={};current.step=stepKeys.indexOf("another");return;
    }break;
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
 cancelHelp();say("user",trim(raw));
 advance(step.key,result.value);msg("");ask();save();render();
}
function fromCatalog(id){
 if(!current||!["concept","quantity","unit","price","cost"].includes(questionKey()))return;
 const entry=api.catalog().find(x=>x.id===id);if(!entry)return;
 const price=Number(entry.price),cost=Number(entry.cost);
 if(!Number.isFinite(price)||price<0||!Number.isFinite(cost)||cost<0)return msg("El precio guardado no es válido.");
 current.pendingLine={fromCatalog:true,name:entry.name,unit:entry.unit,price,cost,missingCost:false};
 current.step=stepKeys.indexOf("quantity");
 say("user","Utilizar del catálogo: "+entry.name+" (precio de venta "+money(price)+" por "+entry.unit+").");
 say("assistant","Elegiste «"+entry.name+"» del catálogo. ¿Qué cantidad necesitás? No asignaré ninguna cantidad por defecto.");
 cancelHelp();save();render();
}
function total(){
 const a=current?.answers||{},items=current?.lines||[];
 const s=items.reduce((n,l)=>n+l.qty*l.price,0),discount=s*(Number(a.discount)||0)/100,tax=(s-discount)*(Number(a.tax)||0)/100;
 return {subtotal:s,discount,tax,price:s-discount+tax,missing:items.filter(l=>l.missingCost).length};
}
function payload(){
 if(!current||current.step<steps.length||!current.lines.length)return null;
 const a=current.answers,p=current.pendingLine;
 return {title:trim(a.description).slice(0,100),client:a.client,phone:a.phone||"",scope:[a.description,a.area?"Superficie informada: "+a.area:"",a.floors?"Plantas: "+a.floors:"",a.scopeType?"Alcance: "+a.scopeType:"",a.location?"Ubicación: "+a.location:""].filter(Boolean).join("\n"),lines:JSON.parse(JSON.stringify(current.lines)),payment:a.payment||"",taxRate:a.tax||0,discountRate:a.discount||0,validity:a.validity||15,delivery:a.delivery||"",notes:a.notes||"",status:"Borrador"};
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
 const list=history();
 if(list.some(restoreLegacyQuestions))api.save();
 if(current&&!list.includes(current))current=null;
 if(!current&&list.length)current=list[0];
 const shelf=$("ocAssistantSavedSection"),draftList=$("ocAssistantDraftList");
 shelf.classList.toggle("hidden",list.length===0);
 draftList.innerHTML=list.map(x=>{
  const title=(x.answers?.description||"Nuevo presupuesto").trim().slice(0,70);
  const state=x.savedQuoteId?"Presupuesto guardado":x.step>=steps.length?"Listo para guardar":Math.min(x.step,steps.length)+" de "+steps.length+" respuestas";
  return '<button type="button" class="oc-ai-draft'+(current===x?" is-current":"")+'" data-draft="'+escape(x.id)+'" aria-pressed="'+(current===x?'true':'false')+'"><strong>'+escape(title)+'</strong><span>'+escape(state)+'</span></button>';
 }).join("");
 draftList.querySelectorAll("[data-draft]").forEach(btn=>btn.onclick=()=>continueDraft(btn.dataset.draft));
 const panel=$("ocAssistantConversation"),form=$("ocAssistantForm"),review=$("ocAssistantReview"),work=$("ocAssistantWorking");
 if(!current){
  panel.classList.add("is-empty");
  panel.innerHTML='<div class="oc-ai-empty"><span class="oc-ai-empty-icon" aria-hidden="true">✦</span><strong>Un presupuesto, paso a paso</strong><p>Empezá describiendo tu trabajo. Yo te voy guiando.</p></div>';
  form.classList.add("hidden");review.classList.add("hidden");work.classList.add("hidden");$("ocAssistantHelpArea").classList.add("hidden");
  $("ocAssistantNotice").textContent="";
  return;
 }
 work.classList.remove("hidden");panel.classList.remove("is-empty");
 panel.innerHTML=current.log.map(x=>'<div class="oc-ai-bubble '+(x.role==="user"?"oc-ai-user":"oc-ai-bot")+'">'+escape(x.text)+'</div>').join("");
 panel.scrollTop=panel.scrollHeight;
 const step=getStep(),done=!step;
 $("ocAssistantStep").textContent=done?"Información completa":"Paso "+(current.step+1)+" de "+steps.length;
 $("ocAssistantProgress").style.width=Math.min(100,100*current.step/steps.length)+"%";
 $("ocAssistantDelete").textContent=current.savedQuoteId?"Eliminar conversación":"Eliminar borrador";
 form.classList.toggle("hidden",done);$("ocAssistantHelpArea").classList.toggle("hidden",done);
 const hint=$("ocAssistantHint"),choices=$("ocAssistantChips"),catalogBlock=$("ocAssistantCatalogBlock");
 if(step){
  $("ocAssistantInput").placeholder=step.hint||"Escribí tu respuesta...";
  $("ocAssistantInput").value="";
  choices.replaceChildren();
  (step.choices||[]).forEach(label=>{const b=document.createElement("button");b.type="button";b.className="btn btn-secondary btn-sm";b.textContent=label;b.onclick=()=>answer(label);choices.append(b)});
  hint.textContent=step.hint||"";
  const canChoose=["concept","quantity","unit","price","cost"].includes(step.key)&&api.catalog().length>0;
  catalogBlock.classList.toggle("hidden",!canChoose);
  if(canChoose){const select=$("ocAssistantCatalog");select.innerHTML='<option value="">Elegí un concepto del catálogo...</option>'+api.catalog().map(x=>'<option value="'+escape(x.id)+'">'+escape(x.name)+' · '+money(x.price)+'</option>').join("")}
 }
 review.classList.toggle("hidden",!done);
 if(done){
  $("ocAssistantExport").classList.toggle("hidden",!current.savedQuoteId);
  const t=total();
  $("ocAssistantSummary").innerHTML='<p><strong>'+escape(current.answers.description)+'</strong></p><p>Conceptos: '+current.lines.length+' · Subtotal: '+money(t.subtotal)+' · Descuento: '+money(t.discount)+' · Impuestos: '+money(t.tax)+'</p><h3>Total: '+money(t.price)+'</h3>'+(t.missing?'<p class="oc-ai-warning">Tenés '+t.missing+' costos internos pendientes de completar.</p>':"");
  $("ocAssistantGenerate").textContent=current.savedQuoteId?"Abrir presupuesto guardado":"Guardar presupuesto editable";
 }
 $("ocAssistantDelete").disabled=false;
}

/* La entrevista no usa IA. Esta ayuda solo se consulta por acción explícita. */
function cancelHelp(){
 cloudSequence++;
 const panel=$("ocAssistantHelpBox"),output=$("ocAssistantHelpReply"),input=$("ocAssistantHelpInput");
 if(panel)panel.classList.add("hidden");
 if(output)output.textContent="";
 if(input)input.value="";
}
async function askForHelp(){
 const draft=current,step=getStep(),input=$("ocAssistantHelpInput"),output=$("ocAssistantHelpReply"),button=$("ocAssistantHelpSend");
 if(!draft||!step||aiBusy)return;
 const question=trim(input.value);
 if(question.length<4){output.textContent="Escribí qué necesitás saber.";return}
 const token=api.getAccessToken?.();
 if(!token){output.textContent="Volvé a ingresar a tu cuenta para consultar.";return}
 const index=current.step,sequence=++cloudSequence;
 const context={
  project:String(current.answers.description||"").slice(0,210),
  area:String(current.answers.area||"").slice(0,90),
  floors:String(current.answers.floors||"").slice(0,65),
  scope:String(current.answers.scopeType||"").slice(0,40),
  currentConcept:String(current.pendingLine?.name||"").slice(0,110)
 };
 aiBusy=true;button.disabled=true;button.textContent="Consultando...";
 output.textContent="Buscando una respuesta...";
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),16000);
  let res,data;
  try{
   res=await fetch("https://zenix-fuego-sur.josene242.workers.dev/obra/ask",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,"apikey":api.getPublicKey()},
    body:JSON.stringify({mode:"help",step:step.key,question,context}),
    signal:controller.signal
   });
   data=await res.json();
  }finally{clearTimeout(timeout)}
  if(sequence!==cloudSequence||current!==draft||current.step!==index)return;
  if(!res.ok||typeof data?.answer!=="string"){
   output.textContent=res.status===429?"Llegaste al límite de consultas por hoy. Podés seguir preparando el presupuesto.":"No pude responder en este momento. Podés continuar el presupuesto igualmente.";
   return;
  }
  const answer=trim(data.answer).slice(0,850);
  output.textContent=answer||"No pude obtener una respuesta. Probá reformular tu consulta.";
 }catch(e){
  if(sequence===cloudSequence&&current===draft&&current.step===index)output.textContent="No pude responder ahora. Podés continuar sin usar la ayuda.";
 }finally{
  aiBusy=false;button.disabled=false;button.textContent="Consultar";
 }
}
function init(bridge){
 api=bridge;
 const style=document.createElement("style");style.textContent=".oc-ai-workspace{padding:26px 28px 30px}.oc-ai-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-bottom:23px;border-bottom:1px solid #e9edf1}.oc-ai-header h2{font-size:24px;letter-spacing:-.035em;margin:7px 0 8px}.oc-ai-intro{font-size:13px;line-height:1.6;color:#657789;margin:0;max-width:630px}.oc-ai-header-actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px}.oc-ai-saved{margin:24px 0 17px}.oc-ai-saved-head{margin-bottom:11px}.oc-ai-saved h3{font-size:13px;font-weight:850;margin:0;color:#33475a}.oc-ai-draft-list{display:flex;gap:10px;overflow-x:auto;padding:2px 1px 9px;scrollbar-width:thin}.oc-ai-draft{display:flex;flex-direction:column;gap:7px;text-align:left;min-width:188px;max-width:260px;flex:0 0 210px;padding:13px 14px;border:1px solid #e0e8ef;border-radius:12px;background:#f8fafc;color:#283a4c;transition:border-color .15s,background .15s}.oc-ai-draft:hover{border-color:#d58d59;background:#fffaf6}.oc-ai-draft.is-current{border-color:#db925b;background:#fff6ee;box-shadow:inset 3px 0 #d68a53}.oc-ai-draft strong{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.oc-ai-draft span{font-size:11px;color:#748395}.oc-ai-sessionhead{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:23px;margin-bottom:8px}.oc-ai-step{font-weight:800;font-size:12px;color:#a8663a}.oc-ai-reset{background:transparent;color:#8996a4;border:0;font-size:11px;text-decoration:underline;text-underline-offset:3px;padding:7px}.oc-ai-track{height:5px;background:#e6ebef;border-radius:8px;overflow:hidden;margin-bottom:15px}.oc-ai-track div{height:100%;width:0;background:#d5894b;transition:width .25s}.oc-ai-chat{min-height:330px;max-height:460px;overflow:auto;background:#f6f8fa;border:1px solid #eef1f4;border-radius:14px;padding:21px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}.oc-ai-chat.is-empty{min-height:245px;justify-content:center;align-items:center}.oc-ai-bubble{font-size:13px;white-space:pre-wrap;line-height:1.65;max-width:86%;padding:12px 15px;border-radius:15px}.oc-ai-bot{align-self:flex-start;background:white;color:#23384b;border:1px solid #e4e9ef}.oc-ai-user{align-self:flex-end;background:#23374d;color:white}.oc-ai-empty{max-width:360px;margin:auto;text-align:center;line-height:1.6}.oc-ai-empty-icon{display:grid;place-items:center;width:48px;height:48px;background:#fff0e5;color:#c77941;border-radius:14px;font-size:25px;margin:0 auto 14px}.oc-ai-empty strong{display:block;font-size:17px;color:#2a3a4d}.oc-ai-empty p{font-size:13px;color:#798899;margin:9px 0 0}.oc-ai-input{display:flex;gap:9px;margin-top:13px}.oc-ai-input input{min-width:0;flex:1;padding:12px;border:1px solid #d6dee8;border-radius:10px}.oc-ai-chips{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.oc-ai-warning{background:#fff4df;padding:12px;border-radius:9px;color:#82550f}.oc-ai-actions{display:flex;gap:8px;flex-wrap:wrap}.oc-ai-review{margin-top:18px;padding:20px}.oc-ai-review h3{font-size:17px;margin:0 0 12px}.oc-ai-review p{line-height:1.55}.oc-ai-catalog{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:12px}.oc-ai-catalog select{border:1px solid #d8e1e9;border-radius:9px;min-height:40px;padding:8px;max-width:100%;flex:1;min-width:190px}.oc-ai-status:not(:empty){margin-top:10px}.oc-ai-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:800px){.oc-ai-workspace{padding:20px 16px}.oc-ai-header{align-items:stretch}.oc-ai-header-actions{width:100%}.oc-ai-header-actions .btn{flex:1}.oc-ai-chat{min-height:320px;padding:13px}.oc-ai-chat.is-empty{min-height:215px}.oc-ai-bubble{max-width:95%}.oc-ai-draft{flex-basis:185px}.oc-ai-input{flex-wrap:wrap}.oc-ai-input button{width:100%}}.oc-ai-help-area{margin:13px 0 4px}.oc-ai-help-toggle{appearance:none;background:none;border:0;color:#a76539;font-size:12px;font-weight:750;padding:8px 2px;cursor:pointer}.oc-ai-help-toggle:hover{text-decoration:underline}.oc-ai-help-box{border:1px solid #e7e9ed;border-radius:11px;padding:15px;background:#fbfcfd;margin-top:7px}.oc-ai-help-box p{font-size:12px;color:#637589;margin:0 0 12px;line-height:1.55}.oc-ai-help-box form{display:flex;flex-direction:column;gap:10px}.oc-ai-help-box textarea{resize:vertical;min-height:70px;max-height:180px;border:1px solid #d5dfe9;border-radius:9px;padding:11px;font:inherit;font-size:13px;width:100%;box-sizing:border-box}.oc-ai-help-box .btn{align-self:flex-start}.oc-ai-help-box .oc-ai-help-reply{background:#fff7f0;color:#2a3848;font-size:13px;line-height:1.7;padding:10px 12px;border-radius:9px;margin:13px 0 0;white-space:pre-wrap}.oc-ai-help-reply:empty{display:none}";document.head.append(style);
 const nav=document.querySelector(".sidenav"),button=document.createElement("button");button.type="button";button.className="nav-item";button.dataset.nav="asistente";button.textContent="✦ Asistente de presupuestos";button.onclick=()=>api.show("asistente");nav.insertBefore(button,nav.querySelector('[data-nav="presupuestos"]'));
 const html="<section class=\"page hidden\" id=\"page-asistente\"><div class=\"card oc-ai-workspace\">\n <div class=\"oc-ai-header\">\n  <div><span class=\"eyebrow\">PRESUPUESTOS</span><h2>Creá tu presupuesto</h2><p class=\"oc-ai-intro\">Contame qué trabajo vas a hacer. Te voy a hacer las preguntas necesarias para preparar un presupuesto que después podés editar y compartir.</p></div>\n  <div class=\"oc-ai-header-actions\"><button type=\"button\" id=\"ocAssistantManual\" class=\"btn btn-secondary\">Crear manualmente</button><button type=\"button\" id=\"ocAssistantNew\" class=\"btn btn-primary\">+ Nuevo presupuesto</button></div>\n </div>\n <section id=\"ocAssistantSavedSection\" class=\"oc-ai-saved hidden\" aria-label=\"Presupuestos en preparación\"><div class=\"oc-ai-saved-head\"><h3>Seguir donde quedaste</h3></div><div id=\"ocAssistantDraftList\" class=\"oc-ai-draft-list\"></div></section>\n <div id=\"ocAssistantWorking\" class=\"hidden\"><div class=\"oc-ai-sessionhead\"><span class=\"oc-ai-step\" id=\"ocAssistantStep\"></span><button type=\"button\" id=\"ocAssistantDelete\" class=\"oc-ai-reset\">Eliminar borrador</button></div><div class=\"oc-ai-track\" aria-hidden=\"true\"><div id=\"ocAssistantProgress\"></div></div></div>\n <div class=\"oc-ai-chat is-empty\" id=\"ocAssistantConversation\"><div class=\"oc-ai-empty\"><span class=\"oc-ai-empty-icon\" aria-hidden=\"true\">✦</span><strong>Un presupuesto, paso a paso</strong><p>Empezá describiendo tu trabajo. Yo te voy guiando.</p></div></div>\n <form id=\"ocAssistantForm\" class=\"hidden\"><div class=\"oc-ai-input\"><input id=\"ocAssistantInput\" maxlength=\"1200\" autocomplete=\"off\" placeholder=\"Escribí tu respuesta...\" required><button class=\"btn btn-primary\">Responder</button></div><div id=\"ocAssistantChips\" class=\"oc-ai-chips\"></div><p id=\"ocAssistantHint\" class=\"subtle\"></p><div id=\"ocAssistantCatalogBlock\" class=\"oc-ai-catalog hidden\"><select id=\"ocAssistantCatalog\" aria-label=\"Conceptos de mi catálogo\"></select><button type=\"button\" id=\"ocAssistantUseCatalog\" class=\"btn btn-secondary btn-sm\">Agregar del catálogo</button></div></form>\n <div id=\"ocAssistantHelpArea\" class=\"oc-ai-help-area hidden\">\n   <button type=\"button\" id=\"ocAssistantHelpToggle\" class=\"oc-ai-help-toggle\" aria-expanded=\"false\">¿Necesitás ayuda con esta pregunta?</button>\n   <div id=\"ocAssistantHelpBox\" class=\"oc-ai-help-box hidden\">\n      <p>Contame qué necesitás aclarar. La respuesta no modificará los datos de tu presupuesto.</p>\n      <form id=\"ocAssistantHelpForm\">\n        <label class=\"oc-ai-sr-only\" for=\"ocAssistantHelpInput\">Tu consulta</label>\n        <textarea id=\"ocAssistantHelpInput\" rows=\"2\" maxlength=\"400\" placeholder=\"Ej.: ¿Qué significa esta unidad de medida?\" required></textarea>\n        <button type=\"submit\" id=\"ocAssistantHelpSend\" class=\"btn btn-secondary btn-sm\">Consultar</button>\n      </form>\n      <p id=\"ocAssistantHelpReply\" class=\"oc-ai-help-reply\" role=\"status\" aria-live=\"polite\"></p>\n   </div>\n </div>\n <div class=\"card oc-ai-review hidden\" id=\"ocAssistantReview\"><h3>Tu presupuesto está listo para revisar</h3><div id=\"ocAssistantSummary\"></div><button type=\"button\" id=\"ocAssistantGenerate\" class=\"btn btn-primary\">Guardar presupuesto editable</button><div class=\"oc-ai-actions hidden\" style=\"margin-top:14px\" id=\"ocAssistantExport\"><button type=\"button\" id=\"ocAssistantPdf\" class=\"btn btn-secondary btn-sm\">Descargar PDF</button><button type=\"button\" id=\"ocAssistantCsv\" class=\"btn btn-secondary btn-sm\">Excel (CSV)</button><button type=\"button\" id=\"ocAssistantShare\" class=\"btn btn-secondary btn-sm\">Compartir PDF</button><button type=\"button\" id=\"ocAssistantWa\" class=\"btn btn-secondary btn-sm\">WhatsApp</button><button type=\"button\" id=\"ocAssistantGmail\" class=\"btn btn-secondary btn-sm\">Gmail</button></div></div>\n <p id=\"ocAssistantNotice\" class=\"subtle oc-ai-status\" role=\"status\" aria-live=\"polite\"></p><span id=\"ocCloudStatus\" class=\"oc-ai-sr-only\" role=\"status\" aria-live=\"polite\"></span>\n </div></section>";
 const page=document.createElement("div");page.innerHTML=html;const el=page.firstElementChild,config=document.getElementById("page-config");config.parentNode.insertBefore(el,config);
 $("ocAssistantForm").onsubmit=e=>{e.preventDefault();answer($("ocAssistantInput").value)};
 $("ocAssistantHelpToggle").onclick=()=>{
   const panel=$("ocAssistantHelpBox");
   const opening=panel.classList.contains("hidden");
   panel.classList.toggle("hidden",!opening);
   $("ocAssistantHelpToggle").setAttribute("aria-expanded",String(opening));
   if(opening)$("ocAssistantHelpInput").focus();
 };
 $("ocAssistantHelpForm").onsubmit=e=>{e.preventDefault();askForHelp()};
 $("ocAssistantNew").onclick=begin;
 $("ocAssistantDelete").onclick=()=>{if(!current||!confirm(current.savedQuoteId?"¿Eliminar esta conversación? El presupuesto que ya guardaste se conservará.":"¿Eliminar este borrador? No se puede recuperar."))return;const a=history(),i=a.findIndex(x=>x.id===current.id);if(i>=0)a.splice(i,1);current=a[0]||null;api.save();render()};
 $("ocAssistantManual").onclick=()=>api.show("presupuestos");
 $("ocAssistantUseCatalog").onclick=()=>fromCatalog($("ocAssistantCatalog").value);
 $("ocAssistantGenerate").onclick=createQuote;
 ["Pdf","Csv","Share","Wa","Gmail"].forEach(k=>{$("ocAssistant"+k).onclick=()=>{const id=current?.savedQuoteId;if(!id)return msg("Guardá primero el presupuesto.");const q=api.quotes().find(x=>x.id===id);if(!q)return msg("No se encontró el presupuesto guardado.");if(k==="Pdf")api.download(q);else if(k==="Csv")api.csv(q);else api.share(q,k==="Wa"?"whatsapp":k==="Gmail"?"gmail":undefined)}});
 render();
}
window.OCAssistant={init,render,begin,validateAnswer};
})();