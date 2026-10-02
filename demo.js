const ORDERS_KEY = "zenix-dlupita-demo-orders-v1";
const HUMAN_KEY = "zenix-dlupita-demo-human-v1";

const catalog = [
  { id:"emp-carne", name:"Empanada de carne cortada a cuchillo", aliases:["carne","carne cortada","empanada de carne"] },
  { id:"emp-matambre", name:"Empanada de matambre", aliases:["matambre","empanada de matambre"] },
  { id:"emp-pollo", name:"Empanada de pollo", aliases:["pollo","empanada de pollo"] },
  { id:"emp-roque", name:"Empanada de roquefort", aliases:["roquefort","roque"] },
  { id:"emp-cordero", name:"Empanada de cordero", aliases:["cordero","empanada de cordero"] },
  { id:"pizza-muzza", name:"Pizza muzzarella", aliases:["muzzarella","muzza","pizza de muzzarella"] },
  { id:"pizza-jamon", name:"Pizza jamón y huevo", aliases:["jamón y huevo","jamon y huevo","pizza jamon"] },
  { id:"pizza-quesos", name:"Pizza cuatro quesos", aliases:["cuatro quesos","4 quesos"] },
  { id:"mila", name:"Milanesa", aliases:["milanesa","milanesas"] },
  { id:"pasta", name:"Pastas", aliases:["pasta","pastas","ñoquis","noquis"] },
  { id:"lomito", name:"Sándwich / lomito", aliases:["lomito","sandwich","sándwich"] },
  { id:"hamb", name:"Hamburguesa", aliases:["hamburguesa","hamburguesas"] }
];

const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const orderBuilder = document.getElementById("orderBuilder");
const orderState = document.getElementById("orderState");
const confirmOrder = document.getElementById("confirmOrder");
const handoffButton = document.getElementById("handoffButton");
const resetDemo = document.getElementById("resetDemo");
const ordersList = document.getElementById("ordersList");
const clearOrders = document.getElementById("clearOrders");
const metricOrders = document.getElementById("metricOrders");
const metricPending = document.getElementById("metricPending");
const metricHuman = document.getElementById("metricHuman");

let draft = { items:[], mode:"Retiro en el local", name:"", notes:"" };
let awaitingOrder = false;

function esc(value){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function normalize(value){return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function nowId(){return `DL-${Date.now().toString(36).slice(-6).toUpperCase()}`;}
function loadOrders(){try{return JSON.parse(localStorage.getItem(ORDERS_KEY)||"[]")}catch{return []}}
function saveOrders(items){localStorage.setItem(ORDERS_KEY,JSON.stringify(items));}
function humanCount(){return Number(localStorage.getItem(HUMAN_KEY)||0)}
function setHumanCount(n){localStorage.setItem(HUMAN_KEY,String(n));}

function addMessage(text,type="bot"){
  const div=document.createElement("div");
  div.className=`msg ${type}`;
  div.innerHTML=esc(text).replace(/\n/g,"<br>");
  chatLog.appendChild(div);
  chatLog.scrollTop=chatLog.scrollHeight;
}

function businessStatus(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Argentina/Ushuaia",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t)?.value;
  const day={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[get("weekday")];
  const mins=Number(get("hour"))*60+Number(get("minute"));
  if(day===0)return {open:false,text:"Hoy figura cerrado. El horario habitual publicado es lunes a sábado de 12:00 a 15:00 y de 20:00 a 00:00."};
  if(mins>=720&&mins<900)return {open:true,text:"Sí. Según el horario configurado, ahora estamos dentro del turno de 12:00 a 15:00."};
  if(mins>=1200)return {open:true,text:"Sí. Según el horario configurado, ahora estamos dentro del turno de 20:00 a 00:00."};
  if(mins<720)return {open:false,text:"Ahora figura cerrado. El próximo turno comienza hoy a las 12:00."};
  return {open:false,text:"Ahora figura cerrado. El próximo turno comienza hoy a las 20:00."};
}

function qtyFromText(text,alias){
  const clean=normalize(text);
  const pos=clean.indexOf(normalize(alias));
  if(pos<0)return 1;
  const before=clean.slice(Math.max(0,pos-18),pos);
  const match=before.match(/(\d{1,2})\s*(x|de|)?\s*$/);
  return match?Math.min(24,Math.max(1,Number(match[1]))):1;
}

function extractItems(text){
  const clean=normalize(text);
  const found=[];
  catalog.forEach(item=>{
    const alias=item.aliases.find(a=>clean.includes(normalize(a)));
    if(alias)found.push({id:item.id,name:item.name,qty:qtyFromText(text,alias)});
  });
  return found;
}

function mergeItems(items){
  items.forEach(item=>{
    const existing=draft.items.find(x=>x.id===item.id);
    if(existing)existing.qty=Math.min(99,existing.qty+item.qty); else draft.items.push({...item});
  });
  renderDraft();
}

function renderDraft(){
  const hasItems=draft.items.length>0;
  confirmOrder.disabled=!hasItems;
  orderState.textContent=hasItems?"Listo para confirmar":(awaitingOrder?"Esperando productos":"Sin iniciar");
  orderState.className=`rule-pill ${hasItems?"ready":(awaitingOrder?"pending":"")}`;
  if(!hasItems){
    orderBuilder.innerHTML='<p class="empty-copy">Usá “Hacer pedido” o escribí lo que querés pedir. El sistema te va a pedir sólo los datos necesarios.</p>';
    return;
  }
  orderBuilder.innerHTML=`
    ${draft.items.map((item,i)=>`<div class="order-row"><div><strong>${esc(item.name)}</strong><br><span>Precio: pendiente de configuración</span></div><div class="qty"><button type="button" data-delta="-1" data-index="${i}">−</button><b>${item.qty}</b><button type="button" data-delta="1" data-index="${i}">+</button></div></div>`).join("")}
    <div class="order-note-field"><label for="demoName">Nombre (opcional)</label><input id="demoName" maxlength="60" value="${esc(draft.name)}" placeholder="Nombre del cliente"></div>
    <div class="order-note-field"><label for="demoMode">Modalidad</label><select id="demoMode"><option${draft.mode==="Retiro en el local"?" selected":""}>Retiro en el local</option><option${draft.mode==="Consultar delivery"?" selected":""}>Consultar delivery</option><option${draft.mode==="Comer en el local"?" selected":""}>Comer en el local</option></select></div>
    <div class="order-note-field"><label for="demoNotes">Aclaraciones</label><input id="demoNotes" maxlength="180" value="${esc(draft.notes)}" placeholder="Ej: sin cebolla"></div>`;
}

orderBuilder.addEventListener("click",e=>{
  const btn=e.target.closest("[data-delta]"); if(!btn)return;
  const i=Number(btn.dataset.index),delta=Number(btn.dataset.delta); if(!draft.items[i])return;
  draft.items[i].qty+=delta; if(draft.items[i].qty<=0)draft.items.splice(i,1); else draft.items[i].qty=Math.min(99,draft.items[i].qty);
  renderDraft();
});
orderBuilder.addEventListener("input",e=>{if(e.target.id==="demoName")draft.name=e.target.value;if(e.target.id==="demoNotes")draft.notes=e.target.value;});
orderBuilder.addEventListener("change",e=>{if(e.target.id==="demoMode")draft.mode=e.target.value;});

function menuReply(){return "Hoy la demo reconoce empanadas de carne cortada a cuchillo, matambre, pollo, roquefort y cordero; pizzas muzzarella, jamón y huevo y cuatro quesos; además milanesas, pastas, lomitos y hamburguesas. Los precios no se muestran porque no hay una lista 2026 verificada cargada en el sistema.";}

function processMessage(text){
  addMessage(text,"user");
  const clean=normalize(text);
  const items=extractItems(text);
  if(items.length){
    mergeItems(items); awaitingOrder=true;
    addMessage(`Agregué ${items.map(i=>`${i.qty} × ${i.name}`).join(", ")} al pedido. Podés seguir agregando productos o confirmar el pedido. El precio final queda pendiente porque no hay precios verificados cargados.`);
    return;
  }
  if(/reclamo|queja|problema|mal|cobro|pago|persona|humano|encargado/.test(clean)){
    requestHuman("La consulta requiere intervención humana."); return;
  }
  if(/horario|abiert|cerrad|hora/.test(clean)){addMessage(businessStatus().text);return;}
  if(/direccion|ubicacion|donde|mapa|llegar/.test(clean)){addMessage("Doña Lupita figura en Don Bosco 314, Ushuaia, esquina Gobernador Paz.");return;}
  if(/delivery|envio|entrega/.test(clean)){draft.mode="Consultar delivery";renderDraft();addMessage("Puedo dejar la modalidad como “Consultar delivery”. La disponibilidad y zona deben confirmarse con el comercio; la demo no las inventa.");return;}
  if(/menu|carta|comida|venden|tienen/.test(clean)){addMessage(menuReply());return;}
  if(/pedido|pedir|quiero comprar|orden/.test(clean)){awaitingOrder=true;renderDraft();addMessage("Perfecto. Decime qué querés pedir y, si podés, la cantidad. Ejemplo: “2 empanadas de carne y 1 pizza muzzarella”.");return;}
  if(/hola|buenas|buen dia|buenas tardes|buenas noches/.test(clean)){addMessage("¡Hola! Soy la demo de atención de Doña Lupita. Puedo mostrarte el menú, consultar horarios, ayudarte a armar un pedido o derivarte a una persona.");return;}
  if(awaitingOrder){addMessage("No pude identificar un producto concreto en ese mensaje. Probá con algo como “3 empanadas de cordero” o “1 pizza cuatro quesos”. Si preferís, te derivo a una persona.");return;}
  addMessage("Puedo ayudarte con menú, horarios, ubicación, pedido o derivación humana. Esta demo no inventa datos comerciales que no estén configurados.");
}

function requestHuman(reason="El cliente pidió hablar con una persona."){
  setHumanCount(humanCount()+1); updateMetrics();
  addMessage(`${reason} Marcado para derivación humana. En producción, el comercio recibiría la conversación y continuaría desde el canal configurado.`,"system");
}

function confirmDraft(){
  if(!draft.items.length)return;
  const order={id:nowId(),createdAt:new Date().toISOString(),status:"new",name:draft.name.trim()||"Cliente demo",mode:draft.mode,notes:draft.notes.trim(),items:draft.items.map(x=>({...x})),total:null};
  const orders=loadOrders(); orders.unshift(order); saveOrders(orders);
  addMessage(`Pedido ${order.id} confirmado y registrado. El comercio ya puede aceptarlo, rechazarlo o ajustar el tiempo desde el panel. El total queda pendiente hasta cargar precios oficiales.`,"system");
  draft={items:[],mode:"Retiro en el local",name:"",notes:""}; awaitingOrder=false; renderDraft(); renderOrders();
}

function renderOrders(){
  const orders=loadOrders();
  if(!orders.length){ordersList.innerHTML='<div class="empty-orders">Todavía no hay pedidos registrados.<br>Confirmá uno desde la demo para verlo acá.</div>';updateMetrics();return;}
  ordersList.innerHTML=orders.map(order=>{
    const labels={new:"Pendiente",accepted:"Aceptado",rejected:"Rechazado",human:"Derivado"};
    const cls={new:"status-new",accepted:"status-accepted",rejected:"status-rejected",human:"status-human"};
    const when=new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit"}).format(new Date(order.createdAt));
    return `<article class="order-card" data-id="${esc(order.id)}"><div class="order-card-head"><strong>${esc(order.id)} · ${esc(order.name)}</strong><span class="${cls[order.status]||"status-new"}">${labels[order.status]||"Pendiente"}</span></div><p>${order.items.map(i=>`${i.qty} × ${esc(i.name)}`).join(" · ")}<br>${esc(order.mode)} · ${when}${order.notes?`<br>Aclaración: ${esc(order.notes)}`:""}<br><b>Total:</b> pendiente de precios configurados</p><div class="order-card-actions"><button data-action="accept">Aceptar</button><button data-action="15">+15 min</button><button data-action="30">+30 min</button><button data-action="human">Derivar</button><button data-action="reject">Rechazar</button></div></article>`;
  }).join("");
  updateMetrics();
}

ordersList.addEventListener("click",e=>{
  const btn=e.target.closest("[data-action]"),card=e.target.closest("[data-id]"); if(!btn||!card)return;
  const orders=loadOrders(),order=orders.find(o=>o.id===card.dataset.id); if(!order)return;
  const action=btn.dataset.action;
  if(action==="accept")order.status="accepted";
  if(action==="reject")order.status="rejected";
  if(action==="human"){order.status="human";setHumanCount(humanCount()+1);}
  if(action==="15"||action==="30"){order.status="accepted";order.eta=Number(action);}
  saveOrders(orders); renderOrders();
});

function updateMetrics(){const orders=loadOrders();metricOrders.textContent=orders.length;metricPending.textContent=orders.filter(o=>o.status==="new").length;metricHuman.textContent=humanCount();}

chatForm.addEventListener("submit",e=>{e.preventDefault();const text=chatInput.value.trim();if(!text)return;chatInput.value="";processMessage(text);});
document.querySelectorAll("[data-quick]").forEach(btn=>btn.addEventListener("click",()=>processMessage(btn.dataset.quick)));
confirmOrder.addEventListener("click",confirmDraft);
handoffButton.addEventListener("click",()=>requestHuman());
resetDemo.addEventListener("click",()=>{draft={items:[],mode:"Retiro en el local",name:"",notes:""};awaitingOrder=false;chatLog.innerHTML="";addMessage("¡Hola! Esta es la demo de Zenix Gastronomía aplicada a Doña Lupita. Probá una consulta o armá un pedido.");renderDraft();});
clearOrders.addEventListener("click",()=>{localStorage.removeItem(ORDERS_KEY);localStorage.removeItem(HUMAN_KEY);renderOrders();});

addMessage("¡Hola! Esta es la demo de Zenix Gastronomía aplicada a Doña Lupita. Probá una consulta, consultá horarios, armá un pedido o pedí hablar con una persona.");
renderDraft();
renderOrders();
