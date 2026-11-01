/* Doña Lupita - categorías, variedades y lista de consulta */
const CATEGORIES = [
  {id:'pizzas',name:'Pizzas',description:'A la piedra, en horno de barro',image:'https://img.carta.menu/storage/media/company_gallery/4568481/conversions/contribution_gallery.jpg',href:'pizzas.html'},
  {id:'empanadas',name:'Empanadas',description:'Al horno o fritas; sabores tradicionales',image:'https://media-cdn.tripadvisor.com/media/photo-s/19/35/fc/58/empanadas-de-carne-queijo.jpg',href:'empanadas.html'},
  {id:'minutas',name:'Minutas',description:'Milanesas y sándwiches',image:'https://media.0221.com.ar/p/0e7d23a2d078151f83c22f0948dfcb80/adjuntos/357/imagenes/100/247/0100247840/1400x0/smart/milanesas-2.jpg',href:'minutas.html'},
  {id:'menu',name:'Menú',description:'Platos caseros y del día',image:'https://infomiba.com.ar/uploads/noticias/5/2024/11/20241101144534_sorrentinos-rellenos-de-jamon-y-queso-con-salsa-marinara.jpg',href:'menu.html'},
  {id:'papas-fritas',name:'Papas fritas',description:'Papas y acompañamientos',image:'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=850&q=80',href:'papas-fritas.html'},
  {id:'bebidas',name:'Bebidas',description:'Sin alcohol y cervezas',image:'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=850&q=80',href:'bebidas.html'}
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
  {id:'mila-napolitana',category:'minutas',name:'Napolitana',description:'Salsa napolitana, jamón y muzzarella.'},
  {id:'mila-margarita',category:'minutas',name:'Margarita',description:'Muzzarella, tomates cherry y albahaca.'},
  {id:'mila-solitara',category:'minutas',name:'Solitaria',description:'Milanesa tradicional con guarnición.'},
  {id:'mila-linea-tres',category:'minutas',name:'Línea de tres',description:'Muzzarella y tres tipos de cebolla.'},
  {id:'mila-del-94',category:'minutas',name:'Del 94',description:'Salsa, huevos fritos y panceta.'},
  {id:'mila-popeye',category:'minutas',name:'La de Popeye',description:'Espinaca, salsa blanca y queso.'},
  {id:'pasta-noquis',category:'menu',name:'Ñoquis con estofado',description:'Ñoquis caseros con estofado de carne.'},
  {id:'pasta-sorrentinos',category:'menu',name:'Sorrentinos',description:'Mencionados en reseñas; confirmá la variedad y su disponibilidad.'}
];

/* Productos adicionales de la carta pública; precios y stock sujetos a confirmación */
VARIETIES.push(
 {id:'minuta-lomo',category:'minutas',name:'Sándwich de lomo completo',description:'Pan casero, lomo, jamón, queso, huevo y vegetales; con fritas.'},
 {id:'minuta-sandwich-milanesa',category:'minutas',name:'Sándwich de milanesa',description:'En pan casero, con jamón, queso, huevo y vegetales; con fritas.'},
 {id:'minuta-hamburguesa',category:'minutas',name:'Hamburguesa completa',description:'Pan casero, queso, jamón, huevo y vegetales; con fritas.'},
 {id:'menu-pollo-pure',category:'menu',name:'Pollo al horno con puré',description:'Pata muslo con verduras al horno y puré.'},
 {id:'menu-pollo-grille',category:'menu',name:'Pollo grillé',description:'Filet a la plancha con guarnición a elección.'},
 {id:'menu-matambre',category:'menu',name:'Matambre a la pizza',description:'Matambre, salsa, jamón y queso; con guarnición.'},
 {id:'menu-locro',category:'menu',name:'Locro',description:'Plato tradicional; confirmar si está disponible hoy.'},
 {id:'bebida-coca-500',category:'bebidas',name:'Coca-Cola 500 ml',description:'Gaseosa, consultar presentación disponible.'},
 {id:'bebida-sprite-500',category:'bebidas',name:'Sprite 500 ml',description:'Gaseosa lima-limón.'},
 {id:'bebida-agua-500',category:'bebidas',name:'Agua mineral 500 ml',description:'Con o sin gas, consultar disponibilidad.'},
 {id:'bebida-beagle',category:'bebidas',name:'Cerveza Beagle',description:'Cerveza regional, presentación a confirmar.'},
 {id:'bebida-brahma',category:'bebidas',name:'Cerveza Brahma',description:'Presentaciones sujetas a disponibilidad.'},
 {id:'papas-porcion',category:'papas-fritas',name:'Papas fritas',description:'Consultar porción y disponibilidad.'}
);

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
   const p=getProduct(id);const c=getCategory(id==='pizza'?'pizzas':id==='milanesas'?'minutas':id==='pastas'?'menu':id);
   const label=p?p.name:(c?c.name+' · selección anterior':'Producto anterior');
   const sub=p?(getCategory(p.category)?.name||'Variedades'):'Seleccioná una variedad para reemplazar esta selección';
   return '<div class="cartitem"><span><strong>'+label+'</strong><small>'+sub+'</small></span><span class="qty"><button type="button" aria-label="Quitar uno de '+label+'" onclick="change(\''+id+'\',-1)">−</button><b>'+Number(n)+'</b><button type="button" aria-label="Agregar uno de '+label+'" onclick="change(\''+id+'\',1)">+</button></span></div>'
 }).join('');
}

/* La categoría presenta la familia; las fotos de variedades son ilustrativas,
   salvo las imágenes públicas auténticas identificadas de Doña Lupita. */
const PHOTO_SETS={
  pizzas:[
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=850&q=82',
    'https://img.carta.menu/storage/media/company_gallery/4568481/conversions/contribution_gallery.jpg',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=850&q=82',
    'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=850&q=82',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=850&q=82',
    'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=850&q=82',
    'https://images.unsplash.com/photo-1548365328-9f547fb0953a?auto=format&fit=crop&w=850&q=82',
    'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=850&q=82'
  ],
  empanadas:[
    'https://media-cdn.tripadvisor.com/media/photo-s/19/35/fc/58/empanadas-de-carne-queijo.jpg',
    'https://media-cdn.tripadvisor.com/media/photo-s/10/2f/0c/96/20170806-223329-largejpg.jpg',
    'https://media-cdn.tripadvisor.com/media/photo-s/18/8d/99/59/photo2jpg.jpg'
  ],
  milanesas:[
    'https://media.0221.com.ar/p/0e7d23a2d078151f83c22f0948dfcb80/adjuntos/357/imagenes/100/247/0100247840/1400x0/smart/milanesas-2.jpg',
    'https://3copas.com.ar/wp-content/uploads/2024/04/mila11.jpeg'
  ],
  pastas:[
    'https://infomiba.com.ar/uploads/noticias/5/2024/11/20241101144534_sorrentinos-rellenos-de-jamon-y-queso-con-salsa-marinara.jpg',
    'https://media.losandes.com.ar/adjuntos/368/migration/resizer/v2/SXB3R2NHKZGLVMJRJHMVS5QXAY.jpg?auth=dabe63a368dee17b34efb972fd83b9ba727ed97d675c5df6797fea105ed92c8b&height=955&width=1125'
  ]
};

/* Enlaces existentes para categorías antes separadas; se conservan las imágenes.
   Las fotos externas pueden no representar los platos reales del restaurante. */
PHOTO_SETS.minutas=PHOTO_SETS.milanesas;
PHOTO_SETS.menu=PHOTO_SETS.pastas;
PHOTO_SETS.bebidas=[
 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=850&q=80',
 'https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?auto=format&fit=crop&w=850&q=80'
];
PHOTO_SETS['papas-fritas']=[
 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=850&q=80',
 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=850&q=80'
];

function imageMarkup(source,label,backup){
 const src=String(source).replaceAll('"','&quot;');
 const alt=String(label).replaceAll('"','&quot;');
 const fall=String(backup||'').replaceAll('"','&quot;');
 return '<img loading="lazy" decoding="async" src="'+src+'" data-fallback="'+fall+'" alt="'+alt+'">';
}
function handleImageFailures(scope){
 scope.querySelectorAll('img').forEach(img=>{
   const retry=()=>{
     const next=img.dataset.fallback;
     if(next&&img.src!==next&&!img.dataset.retried){img.dataset.retried='yes';img.src=next}
     else{img.style.display='none';img.closest('.product')?.classList.add('image-missing')}
   };
   img.addEventListener('error',retry);
   if(img.complete && !img.naturalWidth)retry();
 });
}

function renderCategories(){
 const el=document.getElementById('products');if(!el)return;
 el.innerHTML=CATEGORIES.map(c=>'<a class="product category-card" href="'+c.href+'">'+imageMarkup(c.image,'Imagen ilustrativa de '+c.name,PHOTO_SETS[c.id]?.[1])+'<div class="card-bottom"><div class="card-text"><h2>'+c.name+'</h2><p>'+c.description+'</p></div><span class="category-link">Ver variedades <span aria-hidden="true">↗</span></span></div></a>').join('');
 handleImageFailures(el);
}
function renderVarieties(){
 const el=document.getElementById('variety-products');if(!el)return;
 const rawCategory=document.querySelector('[data-category]')?.getAttribute('data-category');
 const categoryId=rawCategory==='milanesas'?'minutas':rawCategory==='pastas'?'menu':rawCategory;
 const cat=getCategory(categoryId);
 if(!cat){el.innerHTML='<p>Esta categoría no existe.</p>';return}
 const entries=VARIETIES.filter(p=>p.category===categoryId);
 const imgs=PHOTO_SETS[categoryId]||[cat.image];
 el.innerHTML=entries.map((p,i)=>{
  const picture=imgs[i%imgs.length];
  const backup=picture===cat.image?imgs[(i+1)%imgs.length]:cat.image;
  return '<article class="product variety-card">'+imageMarkup(picture,'Imagen ilustrativa de '+cat.name,backup)+'<div class="card-bottom" style="padding-left:7px!important;padding-right:11px!important"><div class="card-text" style="padding-left:0!important;margin-left:0!important"><h2>'+p.name+'</h2><p>'+p.description+'</p></div><button type="button" class="add-plus" style="background:transparent!important;background-color:transparent!important;color:#ffffff!important;border:1px solid rgba(255,255,255,.82)!important;box-shadow:none!important;width:36px!important;height:36px!important;min-width:36px!important;max-width:36px!important;min-height:36px!important;padding:0!important" aria-label="Agregar '+p.name+' al carrito" title="Agregar '+p.name+' al carrito" onclick="add(\''+p.id+'\')"><span aria-hidden="true">+</span></button></div></article>';
 }).join('');
 handleImageFailures(el);
}
document.addEventListener('DOMContentLoaded',()=>{
 refresh();renderCart();renderCategories();renderVarieties();
 const overlay=document.getElementById('menuoverlay');
 document.querySelectorAll('[data-menu]').forEach(b=>b.addEventListener('click',()=>{const isOpen=overlay.classList.toggle('open');b.setAttribute('aria-expanded',String(isOpen))}));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay?.classList.remove('open')});
});