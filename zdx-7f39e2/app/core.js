// Zenix Web + Core · local prototype only. No production authorization.
export const STORE_KEY = 'zenix_suite_demo_v2';
const demoProducts = [
 {id:'m1',name:'Pizza Muzzarella',category:'Pizzas',description:'Nuestra masa artesanal, salsa de tomate y abundante muzzarella.',price:18500,image:'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=85',visible:true},
 {id:'m2',name:'Pizza Napolitana',category:'Pizzas',description:'Muzzarella, tomate fresco, ajo y un toque de orégano.',price:21500,image:'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85',visible:true},
 {id:'m3',name:'Pizza Especial',category:'Pizzas',description:'Jamón, morrón, muzzarella y aceitunas.',price:24500,image:'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=85',visible:true},
 {id:'m4',name:'Empanadas artesanales',category:'Empanadas',description:'Docena surtida de nuestra cocina.',price:21000,image:'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85',visible:true},
 {id:'m5',name:'Papas fritas',category:'Minutas',description:'Doradas, crocantes y recién hechas.',price:8500,image:'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85',visible:true},
 {id:'m6',name:'Hamburguesa completa',category:'Minutas',description:'Carne, queso, vegetales frescos y salsa de la casa.',price:16000,image:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85',visible:true}
];
const initial = () => ({version:2,site:{name:'Doña Lupita',tagline:'El gusto es nuestro',eyebrow:'Ushuaia · Tierra del Fuego',headline:'El sabor de encontrarnos.',description:'Pizzas al horno, empanadas y esos sabores que siempre dan ganas de volver a compartir.',about:'Hecho con amor, pensado para disfrutar.',address:'Don Bosco 314 · Ushuaia',phone:'+54 2901 43-7675',whatsapp:'',heroImage:'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1800&q=90',accent:'#A92738',deliveryFee:2500,pointsPer:1000,open:true},products:demoProducts,orders:[],customers:[]});
export function getData(){let data;try{data=JSON.parse(localStorage.getItem(STORE_KEY))}catch{};return data&&data.version===2&&data.site&&Array.isArray(data.products)&&Array.isArray(data.orders)?data:initial()}
export function putData(data){localStorage.setItem(STORE_KEY,JSON.stringify(data));window.dispatchEvent(new CustomEvent('zenix-update'))}
export function resetDemo(){localStorage.removeItem(STORE_KEY);window.dispatchEvent(new CustomEvent('zenix-update'))}
export function id(){return globalThis.crypto?.randomUUID?.()||`zd-${Date.now()}-${Math.random().toString(16).slice(2)}`}
export function format(n){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n)||0)}
export function safe(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]))}
export function cleanPhone(v){return String(v||'').replace(/[^\d]/g,'')}
export function getPoints(data,phone){return data.customers.find(c=>c.phone===cleanPhone(phone))?.points||0}
export const orderStates={nuevo:'Recibido',aceptado:'Aceptado',preparando:'En preparación',listo:'Listo para retirar',en_camino:'En camino',entregado:'Entregado',cancelado:'Cancelado'};
export const nextStates={nuevo:['aceptado','cancelado'],aceptado:['preparando','cancelado'],preparando:['listo','cancelado'],listo:['en_camino','entregado','cancelado'],en_camino:['entregado','cancelado'],entregado:[],cancelado:[]};
export function setOrderStatus(data,orderId,next){const o=data.orders.find(o=>o.id===orderId);if(!o||!nextStates[o.status]?.includes(next))return false;o.status=next;o.updatedAt=new Date().toISOString();if(next==='entregado'&&!o.pointsAdded){const number=cleanPhone(o.phone);let customer=data.customers.find(c=>c.phone===number);if(!customer){customer={phone:number,name:o.customer,points:0};data.customers.push(customer)}customer.points+=Math.floor(o.subtotal/Math.max(1,Number(data.site.pointsPer)||1000));o.pointsAdded=true}putData(data);return true}
