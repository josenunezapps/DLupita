"use strict";
// Solo clave publica de Supabase. La autorizacion real se realiza con RLS en PostgreSQL.
const SUPABASE_URL = "https://luipqbzyfnrwplseritu.supabase.co";
const PUBLIC_KEY = "sb_publishable_SMtgZgiRe3Bqv9hQw4Kw1w_Kz4dGWF2";
const TABLE = "dona_lupita_catalog";
const $ = id => document.getElementById(id);
const fields = ["businessName","address","phone","mobile","whatsapp","email","instagram","notice","openingLunch","closingLunch","openingDinner","closingDinner"];
const labels = {empanadas:"Empanadas",pizzas:"Pizzas",cocina:"Cocina",paraCompartir:"Combos"};
let jwt = "", adminEmail = "", catalog = null, version = null, dirty = false, saving = false, category = "empanadas";
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function status(id,text,type="") {const e=$(id);e.hidden=!text;e.className="status"+(type?" "+type:"");e.textContent=text||"";}
async function request(endpoint, options={}) {
  const {auth=true,...rest}=options;
  const headers={"apikey":PUBLIC_KEY,"Content-Type":"application/json","Accept":"application/json",...(auth&&jwt?{"Authorization":"Bearer "+jwt}:{}),...(rest.headers||{})};
  const res=await fetch(SUPABASE_URL+endpoint,{...rest,headers,cache:"no-store"});
  const body=await res.json().catch(()=>null);
  if(!res.ok) throw new Error(body?.msg||body?.error_description||body?.message||"El servidor rechazó la operación (HTTP "+res.status+").");
  return body;
}
async function login(){
  const email=$("username").value.trim(), password=$("password").value;
  if(!email||!password)return status("loginStatus","Ingresá el correo y la contraseña.","error");
  $("loginBtn").disabled=true;status("loginStatus","Comprobando acceso…");
  try{
    const result=await request("/auth/v1/token?grant_type=password",{auth:false,method:"POST",body:JSON.stringify({email,password})});
    jwt=result.access_token;
    const admins=await request("/rest/v1/dona_lupita_admins?select=user_id&user_id=eq."+encodeURIComponent(result.user.id));
    if(!admins?.length){jwt="";throw new Error("La cuenta es válida, pero todavía no fue habilitada como administradora. Avisá al dueño del proyecto para autorizarla.");}
    adminEmail=result.user.email;
    await reloadData();
    $("loginPanel").hidden=true;$("dashboard").hidden=false;$("password").value="";
    $("userInfo").textContent="Sesión de "+adminEmail+" · Permisos verificados en el servidor";
    status("loginStatus","");
  }catch(error){jwt="";status("loginStatus",error.message,"error");}
  finally{$("loginBtn").disabled=false;}
}
async function signup(){
  const email=$("username").value.trim(), password=$("password").value;
  if(!email||password.length<8)return status("loginStatus","Ingresá un correo y una contraseña de al menos 8 caracteres.","error");
  $("signupBtn").disabled=true;status("loginStatus","Creando cuenta…");
  try{
    await request("/auth/v1/signup",{auth:false,method:"POST",body:JSON.stringify({email,password})});
    status("loginStatus","Solicitud registrada. Revisá el correo de confirmación. Después deberá habilitarse tu cuenta como administradora.","success");
    $("password").value="";
  }catch(error){status("loginStatus",error.message,"error");}
  finally{$("signupBtn").disabled=false;}
}
function logout(){
  jwt="";adminEmail="";catalog=null;version=null;dirty=false;
  $("password").value="";$("loginPanel").hidden=false;$("dashboard").hidden=true;
  status("loginStatus","");status("dashboardStatus","");
}
function markDirty(){dirty=true;status("dashboardStatus","");setDirty();}
function setDirty(){
  $("publishBtn").disabled=!dirty||saving;
  $("reloadBtn").disabled=saving;
  $("unsavedLabel").textContent=dirty?"Tenés cambios sin publicar":"Sin cambios pendientes";
}
function renderSettings(){
  fields.forEach(field=>{$(field).value=String(catalog.site[field]??"");});
  $("closedSunday").checked=!!catalog.site.closedSunday;
  $("whatsappVerified").checked=!!catalog.site.whatsappVerified;
}
function renderProducts(){
  document.querySelectorAll(".tab").forEach(t=>{const active=t.dataset.category===category;t.classList.toggle("active",active);t.setAttribute("aria-selected",String(active));});
  const rows=catalog.menu[category]||[];
  $("productsCount").textContent=Object.values(catalog.menu).reduce((n,a)=>n+a.length,0)+" productos";
  $("productList").innerHTML=rows.map((p,i)=>`
    <article class="product" data-index="${i}">
      <div class="product-head"><b>${i+1}. ${esc(p.name)}</b><button class="btn danger" type="button" data-remove>Eliminar</button></div>
      <div class="product-fields">
        <label>Nombre<input data-field="name" maxlength="100" value="${esc(p.name)}" required></label>
        <label>Precio ARS (opcional)<input data-field="price" type="number" step="1" min="0" max="99999999" placeholder="Sin definir" value="${p.price==null?"":esc(p.price)}"></label>
        <label class="span2">Descripción<textarea data-field="desc" maxlength="260" rows="2">${esc(p.desc)}</textarea></label>
        <label>Etiqueta<input data-field="tag" maxlength="35" value="${esc(p.tag)}"></label>
        <label class="row"><input type="checkbox" data-field="enabled" ${p.enabled===false?"":"checked"}> Visible en la web</label>
      </div>
    </article>`).join("")||"<p>No hay productos en esta categoría.</p>";
}
async function reloadData(){
  const result=await request("/rest/v1/"+TABLE+"?select=content,updated_at&id=eq.1");
  if(!Array.isArray(result)||!result.length||!result[0].content?.menu)throw new Error("El catálogo todavía no está instalado en el servidor.");
  catalog=result[0].content;version=result[0].updated_at;dirty=false;
  renderSettings();renderProducts();setDirty();
}
async function reload(){
  if(dirty&&!confirm("Se perderán los cambios sin publicar. ¿Continuar?"))return;
  try{await reloadData();status("dashboardStatus","Se recuperó la versión publicada.","success");}
  catch(e){status("dashboardStatus",e.message,"error");}
}
async function publish(){
  if(!dirty||saving)return;
  for(const [group,products] of Object.entries(catalog.menu)){
    if(products.some(p=>!String(p.name||"").trim()))return status("dashboardStatus","Todos los productos necesitan nombre: "+group,"error");
    if(products.some(p=>p.price!==null&&(!Number.isFinite(p.price)||p.price<0)))return status("dashboardStatus","Hay precios inválidos en "+group,"error");
  }
  if(catalog.site.whatsappVerified&&!/^\d{10,16}$/.test(catalog.site.whatsapp))return status("dashboardStatus","El WhatsApp debe incluir solo números y código de país.","error");
  saving=true;setDirty();status("dashboardStatus","Guardando cambios en la base de datos…");
  try{
    const next=structuredClone(catalog);next.updatedAt=new Date().toISOString();
    const timestamp=new Date().toISOString();
    const query="/rest/v1/"+TABLE+"?id=eq.1&updated_at=eq."+encodeURIComponent(version)+"&select=content,updated_at";
    const result=await request(query,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({content:next,updated_at:timestamp})});
    if(!result?.length)throw new Error("Otra sesión modificó la carta. No se sobrescribió: recargá para volver a editar.");
    catalog=next;version=result[0].updated_at;dirty=false;
    status("dashboardStatus","¡Publicado! La carta ya está guardada en el servidor.","success");
  }catch(e){status("dashboardStatus",e.message,"error");}
  finally{saving=false;setDirty();}
}
$("loginBtn").addEventListener("click",login);
$("signupBtn").addEventListener("click",signup);
$("password").addEventListener("keydown",e=>{if(e.key==="Enter")login();});
$("logoutBtn").addEventListener("click",()=>{if(!dirty||confirm("Hay cambios sin publicar. ¿Salir?"))logout();});
$("reloadBtn").addEventListener("click",reload);
$("publishBtn").addEventListener("click",publish);
fields.forEach(key=>$(key).addEventListener("input",e=>{if(!catalog)return;catalog.site[key]=e.target.value;markDirty();}));
$("closedSunday").addEventListener("change",e=>{if(!catalog)return;catalog.site.closedSunday=e.target.checked;markDirty();});
$("whatsappVerified").addEventListener("change",e=>{if(!catalog)return;catalog.site.whatsappVerified=e.target.checked;markDirty();});
$("categoryTabs").addEventListener("click",e=>{const tab=e.target.closest("[data-category]");if(!tab||!catalog)return;category=tab.dataset.category;renderProducts();});
$("productList").addEventListener("input",e=>{
  const row=e.target.closest("[data-index]"),field=e.target.dataset.field;if(!row||!field||!catalog)return;
  const item=catalog.menu[category][Number(row.dataset.index)];
  if(field==="enabled")item[field]=e.target.checked;
  else if(field==="price")item[field]=e.target.value===""?null:Number(e.target.value);
  else item[field]=e.target.value;
  if(field==="name")row.querySelector(".product-head b").textContent=(Number(row.dataset.index)+1)+". "+item.name;
  markDirty();
});
$("productList").addEventListener("change",e=>{if(e.target.dataset.field==="enabled")e.target.dispatchEvent(new Event("input",{bubbles:true}));});
$("productList").addEventListener("click",e=>{
  if(!e.target.closest("[data-remove]")||!catalog)return;
  const index=Number(e.target.closest("[data-index]").dataset.index);
  if(!confirm("¿Eliminar este producto?"))return;
  catalog.menu[category].splice(index,1);renderProducts();markDirty();
});
$("addProductBtn").addEventListener("click",()=>{
  if(!catalog)return;
  catalog.menu[category].push({name:"Nuevo producto",desc:"",tag:"Nuevo",price:null,enabled:true});
  renderProducts();markDirty();
  $("productList").lastElementChild?.querySelector("[data-field=name]")?.focus();
});
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
