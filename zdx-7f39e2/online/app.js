import {db,configured,slug,html,price,errorView,goodUrl} from './client.js';
const root=document.getElementById('root');
let business=null, products=[], selected='Todos', cart={}, refreshed=0;
const count=()=>Object.values(cart).reduce((sum,n)=>sum+n,0);

function render(){
 if(!configured){root.innerHTML=errorView('Configuración pendiente','La tienda conectada todavía no está activada. No se mostrarán datos de demostración como si fueran reales.');return}
 if(!business){root.innerHTML=errorView('Esta tienda no está disponible','El negocio no fue encontrado o todavía no habilitó su página.');return}
 const b=business;
 const cats=['Todos',...new Set(products.map(p=>p.category))];if(!cats.includes(selected))selected='Todos';
 const visible=products.filter(p=>selected==='Todos'||p.category===selected);
 const hero=goodUrl(b.hero_image);
 document.title=`${b.name} · Tienda online`;
 document.documentElement.style.setProperty('--brand',/^#[0-9a-f]{6}$/i.test(b.accent||'')?b.accent:'#a92738');
 root.innerHTML=`<header class="site-header"><div class="wrap header-row"><a class="logotype" href="#inicio">✳ ${html(b.name)}</a><nav><a href="#catalogo">Productos</a><a href="#nosotros">Nosotros</a></nav><button class="outline" id="cartbtn">Mi pedido (${count()})</button></div></header>
 <section class="hero" id="inicio" ${hero?`style="--cover:url('${html(hero.replace(/'/g,'%27'))}')"`:''}><div class="wrap hero-content"><span class="eyebrow">${html(b.eyebrow||'Tu comercio online')}</span><h1>${html(b.headline||b.name)}</h1><p>${html(b.description||'Conocé nuestros productos.')}</p><a class="button" href="#catalogo">Ver productos ↗</a></div></section>
 <main class="wrap"><section id="catalogo" class="catalog"><p class="eyebrow">NUESTROS PRODUCTOS</p><h2>Elegí tus favoritos</h2><div class="filters">${cats.map(c=>`<button class="chip ${selected===c?'selected':''}" data-cat="${html(c)}">${html(c)}</button>`).join('')}</div>
 <div class="grid-products">${visible.map(p=>`<article class="product"><div class="photo">${goodUrl(p.image_url)?`<img src="${html(goodUrl(p.image_url))}" alt="${html(p.name)}" loading="lazy">`:'<div class="no-photo">✳</div>'}</div><div class="product-content"><small>${html(p.category)}</small><h3>${html(p.name)}</h3><p>${html(p.description)}</p><div class="buy"><strong>${price(p.price_ars)}</strong><button class="round" data-add="${p.id}" aria-label="Agregar ${html(p.name)}">+</button></div></div></article>`).join('')||'<p>No hay productos publicados.</p>'}</div>
 </section><section id="nosotros" class="about"><div><p class="eyebrow">CONOCENOS</p><h2>${html(b.about||b.name)}</h2><p>${html(b.description)}</p></div><div><strong>${html(b.address||'')}</strong><p>${html(b.phone||'')}</p></div></section></main><footer><div class="wrap"><strong>${html(b.name)}</strong><span>Tienda del comercio · Zenix Web</span></div></footer>
 ${count()?`<div class="sticky-cart"><button class="button" id="cartbottom">Ver selección · ${count()} artículos</button></div>`:''}`;
}
async function load(silent=false){
 if(!configured){render();return}
 if(!silent)root.innerHTML='<main class="center"><p>Buscando tienda…</p></main>';
 const {data:b,error:e}=await db.from('zd_businesses').select('id,slug,name,headline,description,about,eyebrow,address,phone,hero_image,accent,active,published').eq('slug',slug).eq('active',true).eq('published',true).maybeSingle();
 if(e){if(!silent)root.innerHTML=errorView('No se pudo cargar la tienda',e.message);return}
 if(!b){business=null;products=[];render();return}
 const {data:p,error:pe}=await db.from('zd_products').select('id,name,category,description,image_url,price_ars,visible').eq('business_id',b.id).eq('visible',true).order('created_at',{ascending:true});
 if(pe){if(!silent)root.innerHTML=errorView('No se pudo cargar el catálogo',pe.message);return}
 business=b;products=p||[];refreshed=Date.now();render();
}
function showCart(){
 const items=products.filter(p=>cart[p.id]);const total=items.reduce((v,p)=>v+p.price_ars*cart[p.id],0);
 const overlay=document.createElement('div');overlay.className='modal-overlay';overlay.innerHTML=`<div class="modal"><button class="close" data-close="1" aria-label="Cerrar">×</button><p class="eyebrow">TU SELECCIÓN</p><h2>Mi pedido</h2>${items.map(p=>`<div class="cartline"><span>${html(p.name)} × ${cart[p.id]}</span><strong>${price(p.price_ars*cart[p.id])}</strong></div>`).join('')||'<p>Tu selección está vacía.</p>'}<div class="cartline total"><strong>Total de productos</strong><strong>${price(total)}</strong></div><p class="soft-note">Estamos conectando el circuito de pedidos seguro. Esta selección no envía pedidos ni cobra dinero.</p><button class="button" data-close="1">Seguir viendo</button></div>`;
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-close]'))overlay.remove()});document.body.append(overlay);
}
root.addEventListener('click',e=>{
 const add=e.target.closest('[data-add]');if(add){cart[add.dataset.add]=(cart[add.dataset.add]||0)+1;render();return}
 const cat=e.target.closest('[data-cat]');if(cat){selected=cat.dataset.cat;render();document.getElementById('catalogo')?.scrollIntoView();return}
 if(e.target.closest('#cartbtn,#cartbottom'))showCart();
});
if(configured){load();document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});window.setInterval(()=>{if(!document.hidden)load(true)},15000)}else render();
