/* Doña Lupita - categorías, variedades y lista de consulta */
const CATEGORIES = [
  {id:'pizzas',name:'Pizzas',description:'A la piedra, en horno de barro',image:'https://img.carta.menu/storage/media/company_gallery/4568481/conversions/contribution_gallery.jpg',href:'pizzas.html'},
  {id:'empanadas',name:'Empanadas',description:'Al horno o fritas; sabores tradicionales y especiales',image:'https://www.airial.travel/_next/image?q=70&url=https%3A%2F%2Fcoinventmediastorage.blob.core.windows.net%2Frestaurant%2Feb254b849873cecb652ab5c0841c26e09feea8e34a3716d5701905a39a17c606&w=3840',href:'empanadas.html'},
  {id:'milanesas',name:'Milanesas',description:'Variedades al plato con guarnición',image:'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=900&auto=format&fit=crop',href:'milanesas.html'},
  {id:'pastas',name:'Pastas',description:'Opciones de pasta y especialidades del día',image:'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=900&auto=format&fit=crop',href:'pastas.html'}
];
const VARIETIES = [
  {id:'pizza-muzzarella',category:'pizzas',name:'Muzzarella',description:'Salsa y muzzarella.'},
  {id:'pizza-napolitana',category:'pizzas',name:'Napolitana',description:'Tomate, ajo, perejil y muzzarella.'},
  {id:'pizza-jamon-morron',category:'pizzas',name:'Jamón y morrón',description:'Jamón, muzzarella y morrón.'},
  {id:'pizza-margarita',category:'pizzas',name:'Margarita',description:'Muzzarella, albahaca y tomates cherry.'},
  {id:'pizza-jamon-huevo',category:'pizzas',name:'Jamón y huevo',description:'Muzzarella, jamón y huevo.'},
  {id:'pizza-rucula',category:'pizzas',name:'Rúcula',description:'Rúcula, jamón crudo y parmesano.'},
  {id:'pizza-provolone',category:'pizzas',name:'Provolone',description:'Muzzarella, provolone y aceitunas negras.'},
  {id:'pizza-champinones',category:'pizzas',name:'Champiñones',description:'Champiñones, jamón y morrón.'},
  {id:'pizza-del-mar',category:'pizzas',name:'Del mar',description:'Langostinos y mejillones con vegetales.'},
  {id:'pizza-americana',category:'pizzas',name:'Americana',description:'Papas fritas, panceta y huevo.'},
  {id:'emp-carne-cuchillo',category:'empanadas',name:'Carne a cuchillo',description:'Carne, vegetales y huevo duro.'},
  {id:'emp-matambre',category:'empanadas',name:'Matambre a cuchillo',description:'Matambre cocido lentamente y vegetales.'},
  {id:'emp-cordero',category:'empanadas',name:'Cordero',description:'Cordero y cebolla salteada.'},
  {id:'emp-pollo',category:'empanadas',name:'Pollo',description:'Pollo salteado con morrones y cebolla.'},
  {id:'emp-jamon-queso',category:'empanadas',name:'Jamón y queso',description:'Clásica de jamón y queso.'},
  {id:'emp-caprese',category:'empanadas',name:'Caprese',description:'Tomate, queso y albahaca.'},
  {id:'emp-roquefort',category:'empanadas',name:'Roquefort',description:'Queso azul y queso de barra.'},
  {id:'emp-panceta',category:'empanadas',name:'Panceta',description:'Panceta, cebolla caramelizada y queso.'},
  {id:'emp-choclo',category:'empanadas',name:'Choclo',description:'Choclo cremoso y queso.'},
  {id:'emp-cebolla-queso',category:'empanadas',name:'Cebolla y queso',description:'Cebolla caramelizada y queso.'},
  {id:'emp-mariscos',category:'empanadas',name:'Mariscos',description:'Relleno de mariscos.'},
  {id:'emp-bondiola',category:'empanadas',name:'Bondiola desmechada',description:'Bondiola al horno, verduras y especias.'},
  {id:'mila-napolitana',category:'milanesas',name:'Napolitana',description:'Salsa napolitana, jamón y muzzarella.'},
  {id:'mila-margarita',category:'milanesas',name:'Margarita',description:'Muzzarella, tomates cherry y albahaca.'},
  {id:'mila-solitara',category:'milanesas',name:'Solitária',description:'Milanesa tradicional con guarnición.'},
  {id:'mila-linea-tres',category:'milanesas',name:'Línea de tres',description:'Muzzarella y tres tipos de cebolla.'},
  {id:'mila-del-94',category:'milanesas',name:'Del 94',description:'Salsa, huevos fritos y panceta.'},
  {id:'mila-popeye',category:'milanesas',name:'La de Popeye',description:'Espinaca, salsa blanca y queso.'},
  {id:'pasta-noquis',category:'pastas',name:'Ñoquis con estofado',description:'Ñoquis caseros con estofado de carne.'},
  {id:'pasta-sorrentinos',category:'pastas',name:'Sorrentinos',description:'Mencionados en reseñas; confirmá la variedad y su disponibilidad.'}
];
const getProduct=id=>VARIETIES.find(x=>x.id===id);
const getCategory=id=>CATEGORIES.find(x=>x.id===id);
const read=()=>{try{const o=JSON.parse(localStorage.getItem('lupita-cart')||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch{return {}}};
const save=cart=>{try{localStorage.setItem('lupita-cart',JSON.stringify(cart))}catch{}refresh()};
function refresh(){const n=Object.values(read()).reduce((a,b)=>a+(Number.isFinite(Number(b))?Math.max(0,Number(b)):0),0);document.querySelectorAll('.cartcount').forEach(el=>el.textContent=String(n))}
function notify(message){let el=document.getElementById('shop-toast');if(!el){el=document.createElement('div');el.id='shop-toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el)}el.textContent=message;el.classList.add('visible');if(window.shopToastTimeout)clearTimeout(window.shopToastTimeout);window.shopToastTimeout=setTimeout(()=>el.classList.remove('visible'),2400)}
function add(id){const p=getProduct(id);if(!p)return;const cart=read();cart[id]=(Number(cart[id])||0)+1;save(cart);notify(p.name+' agregado al carrito')}
function change(id,delta){const cart=read();const n=Math.max(0,(Number(cart[id])||0)+delta);if(n)cart[id]=n;else delete cart[id];save(cart);renderCart()}
function renderCart(){
 const el=document.getElementById('cartitems');if(!el)return;
 const items=Object.entries(read()).filter(([_,n])=>Number(n)>0);
 if(!items.length){el.innerHTML='<p>Tu carrito está vacío. <a class="textlink" href="productos.html">Elegí una categoría para comenzar →</a></p>';return}
 el.innerHTML=items.map(([id,n])=>{
   const p=getProduct(id);const c=getCategory(id==='pizza'?'pizzas':id);
   const label=p?p.name:(c?c.name+' · selección anterior':'Producto anterior');
   const sub=p?getCategory(p.category).name:'Seleccioná una variedad para reemplazar esta selección';
   return '<div class="cartitem"><span><strong>'+label+'</strong><small>'+sub+'</small></span><span class="qty"><button type="button" aria-label="Quitar uno de '+label+'" onclick="change(\''+id+'\',-1)">−</button><b>'+Number(n)+'</b><button type="button" aria-label="Agregar uno de '+label+'" onclick="change(\''+id+'\',1)">+</button></span></div>'
 }).join('');
}
function renderCategories(){
 const el=document.getElementById('products');if(!el)return;
 el.innerHTML=CATEGORIES.map(c=>'<a class="product category-card" href="'+c.href+'"><img loading="lazy" src="'+c.image+'" alt="Imagen de la categoría '+c.name+'"><div><h2>'+c.name+'</h2><p>'+c.description+'</p><span class="category-link">Ver variedades <span aria-hidden="true">↗</span></span></div></a>').join('');
}
function renderVarieties(){
 const el=document.getElementById('variety-products');if(!el)return;
 const categoryId=document.querySelector('[data-category]')?.getAttribute('data-category');
 const cat=getCategory(categoryId);
 if(!cat){el.innerHTML='<p>Esta categoría no existe.</p>';return}
 const entries=VARIETIES.filter(p=>p.category===categoryId);
 el.innerHTML=entries.map((p,i)=>'<article class="product variety-card"><img loading="lazy" style="object-position:'+(['50% 50%','55% 38%','40% 60%','60% 50%'][i%4])+'" src="'+cat.image+'" alt="Imagen representativa de '+cat.name+'"><div><h2>'+p.name+'</h2><p>'+p.description+'</p><button type="button" onclick="add(\''+p.id+'\')">Agregar al carrito +</button></div></article>').join('');
}
document.addEventListener('DOMContentLoaded',()=>{
 refresh();renderCart();renderCategories();renderVarieties();
 const overlay=document.getElementById('menuoverlay');
 document.querySelectorAll('[data-menu]').forEach(b=>b.addEventListener('click',()=>{const isOpen=overlay.classList.toggle('open');b.setAttribute('aria-expanded',String(isOpen))}));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay?.classList.remove('open')});
});