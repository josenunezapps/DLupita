// Zenix Delivery: mapa de selección para demo (Ushuaia).
// Georef Argentina es para la búsqueda explícita; el usuario confirma el punto en el mapa.
const ORIGIN=[-54.8019,-68.3030];
let map=null,marker=null,position=null,loading=null;
const form=()=>document.getElementById('checkout-form');
const info=()=>document.getElementById('gps-info');
const msg=(text)=>{const node=info();if(node)node.textContent=text};
export const selectedPoint=()=>position?{...position}:null;
function syncForm(){
 const f=form();if(!f)return;
 f.elements.latitude.value=position?.lat??'';
 f.elements.longitude.value=position?.lng??'';
 const label=document.getElementById('gps-coordinates');
 if(label)label.textContent=position?'Punto elegido: '+position.lat.toFixed(6)+', '+position.lng.toFixed(6):'Todavía no seleccionaste un punto.';
}
export function clearPoint(){
 position=null;
 if(marker){marker.remove();marker=null;}
 syncForm();
}
export function destroyAddressMap(){if(map){map.remove();map=null;marker=null;}}
function style(id,url,integrity){
 if(document.getElementById(id))return;
 const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=url;
 if(integrity){link.integrity=integrity;link.crossOrigin='anonymous';}
 document.head.append(link);
}
style('zenix-address-css',new URL('./address-map.css',import.meta.url).href);
function getLeaflet(){
 if(window.L)return Promise.resolve(window.L);
 if(loading)return loading;
 style('zenix-leaflet-css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=');
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
  script.crossOrigin='anonymous';
  script.onload=()=>window.L?resolve(window.L):reject(new Error('Mapa no disponible'));
  script.onerror=()=>reject(new Error('No se pudo cargar el mapa'));
  document.head.append(script);
 }).catch(err=>{loading=null;throw err});
 return loading;
}
function setPoint(lat,lng,source){
 const a=Number(lat),b=Number(lng);
 if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180)return;
 position={lat:a,lng:b};
 syncForm();
 if(map){
  if(marker)marker.setLatLng([a,b]);
  else marker=window.L.marker([a,b],{draggable:true}).addTo(map);
  marker.off('dragend');
  marker.on('dragend',()=>{const p=marker.getLatLng();setPoint(p.lat,p.lng,'manual');msg('Punto ajustado. Verificá la dirección antes de registrar el pedido de prueba.')});
  map.setView([a,b],Math.max(map.getZoom(),16));
 }
 msg(source==='gps'?'GPS obtenido. Comprobá en el mapa que esté sobre tu domicilio.':source==='search'?'Dirección encontrada aproximadamente: verificá y ajustá el marcador en el mapa.':'Punto elegido. Podés arrastrar el marcador para ajustar la ubicación.');
}
export async function openAddressMap(){
 const area=document.getElementById('zenix-map-area');
 if(!area)return;
 area.hidden=false;
 msg('Cargando mapa…');
 try{
  const L=await getLeaflet();
  const el=document.getElementById('zenix-address-map');
  if(!el||!el.isConnected)return;
  if(!map){
   map=L.map(el,{scrollWheelZoom:false}).setView(position?[position.lat,position.lng]:ORIGIN,position?16:13);
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
   }).addTo(map);
   map.on('click',e=>setPoint(e.latlng.lat,e.latlng.lng,'manual'));
  }
  if(position)setPoint(position.lat,position.lng,'manual');
  map.invalidateSize();
  msg('Tocá el mapa o arrastrá el marcador hasta la entrada de tu domicilio.');
 }catch(e){
  msg('No se pudo cargar el mapa. Podés escribir tu dirección igualmente.');
  const el=document.getElementById('zenix-address-map');if(el)el.innerHTML='<p class="zenix-map-error">Mapa no disponible en este momento.</p>';
 }
}
export async function searchAddress(){
 const addr=String(form()?.elements?.address?.value||'').trim();
 if(addr.length<5){msg('Escribí la calle y, si la conocés, la altura antes de buscar.');return}
 msg('Buscando dirección en Ushuaia…');
 try{
  // Consulta solamente bajo acción del cliente. Sin autocompletado ni búsquedas en segundo plano.
  const params=new URLSearchParams({direccion:addr,provincia:'94',departamento:'Ushuaia',max:'5'});
  const response=await fetch('https://apis.datos.gob.ar/georef/api/direcciones?'+params.toString(),{headers:{'Accept':'application/json'}});
  if(!response.ok)throw new Error('El servicio de direcciones no respondió');
  const data=await response.json();
  const results=Array.isArray(data.direcciones)?data.direcciones:[];
  const valid=results.filter(x=>Number.isFinite(Number(x.ubicacion?.lat))&&Number.isFinite(Number(x.ubicacion?.lon))&&x.ubicacion?.lat!=null&&x.ubicacion?.lon!=null);
  if(!valid.length){
   await openAddressMap();
   msg('No se encontró una posición confiable. Agregá la altura o tocá el mapa para marcar tu casa.');
   return;
  }
  const result=valid[0];
  await openAddressMap();
  setPoint(result.ubicacion.lat,result.ubicacion.lon,'search');
  const label=document.getElementById('zenix-search-result');
  if(label)label.textContent='Resultado aproximado: '+(result.nomenclatura||addr)+'. Confirmá el punto en el mapa.';
 }catch(e){
  await openAddressMap();
  msg('La búsqueda automática no está disponible. Tocá el mapa para seleccionar tu domicilio.');
 }
}
export function requestDeviceLocation(){
 if(!navigator.geolocation){msg('Este navegador no permite GPS. Marcá el domicilio en el mapa.');openAddressMap();return}
 msg('Solicitando ubicación al teléfono…');
 navigator.geolocation.getCurrentPosition(async p=>{
  await openAddressMap();
  setPoint(p.coords.latitude,p.coords.longitude,'gps');
 },async err=>{
  await openAddressMap();
  const messages={
   1:'El navegador no tiene permiso de ubicación. Podés habilitarlo en Chrome o elegir el punto en el mapa.',
   2:'El teléfono no pudo determinar tu ubicación. Elegí el punto en el mapa.',
   3:'La ubicación tardó demasiado. Probá nuevamente o señalá tu casa en el mapa.'
  };
  msg(messages[err.code]||'No se pudo obtener la ubicación. Elegí tu casa en el mapa.');
 },{enableHighAccuracy:true,timeout:16000,maximumAge:30000});
}
