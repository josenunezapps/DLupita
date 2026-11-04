"use strict";
window.Demo = {
  money(value){return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(value)||0)},
  load(key,fallback){try{const v=localStorage.getItem(key);return v===null?structuredClone(fallback):JSON.parse(v)}catch{return JSON.parse(JSON.stringify(fallback))}},
  save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{this.toast("No se pudo guardar en el navegador");return false}},
  escape(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))},
  toast(message){let el=document.querySelector(".app-toast");if(!el){el=document.createElement("div");el.className="app-toast";el.setAttribute("role","status");document.body.append(el)}el.textContent=message;el.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2900)},
  modal(open){document.querySelector(".app-modal-backdrop")?.classList.toggle("open",open);document.body.style.overflow=open?"hidden":""},
  drawer(open){document.querySelector(".drawer")?.classList.toggle("open",open);document.querySelector(".drawer-overlay")?.classList.toggle("open",open);document.body.style.overflow=open?"hidden":""},
  async copy(text){try{await navigator.clipboard.writeText(text);this.toast("Texto copiado al portapapeles")}catch{const box=document.createElement("textarea");box.value=text;box.style.position="fixed";box.style.opacity="0";document.body.append(box);box.select();let ok=false;try{ok=document.execCommand("copy")}catch{}box.remove();this.toast(ok?"Texto copiado":"Seleccioná y copiá el texto manualmente")}},
  download(name,content,type="text/plain;charset=utf-8"){const file=new Blob(["\uFEFF",content],{type});const url=URL.createObjectURL(file);const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)},
  today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
};
document.addEventListener("DOMContentLoaded",()=>{
 const toggle=document.querySelector(".app-mobile-menu"),side=document.querySelector(".sidebar"),overlay=document.querySelector(".app-overlay");
 function close(){side?.classList.remove("open");overlay?.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}
 toggle?.addEventListener("click",()=>{const active=side.classList.toggle("open");overlay?.classList.toggle("open",active);toggle.setAttribute("aria-expanded",String(active))});
 overlay?.addEventListener("click",close);
 side?.querySelectorAll("a").forEach(a=>a.addEventListener("click",close));
 document.querySelector(".drawer-overlay")?.addEventListener("click",()=>Demo.drawer(false));
 document.querySelector(".app-modal-backdrop")?.addEventListener("click",e=>{if(e.target===e.currentTarget)Demo.modal(false)});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){Demo.modal(false);Demo.drawer(false);close()}});
});
