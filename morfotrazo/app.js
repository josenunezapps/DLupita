'use strict';
(function(){
  const $=sel=>document.querySelector(sel);
  const icon=id=>'<svg aria-hidden="true"><use href="#i-'+id+'"></use></svg>';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'imagen';
  const safeUrl=v=>{try{const u=new URL(String(v||''),document.baseURI);return ['http:','https:','blob:'].includes(u.protocol)?u.href:''}catch{return ''}};
  let wallpapers=[],filter='Todas',query='',showMode='normal',favoriteOnly=false,active=null;
  let toastTimer;
  let favorites=new Set();
  try{const stored=JSON.parse(localStorage.getItem('morfotrazo:favs:v1')||'[]');favorites=new Set(Array.isArray(stored)?stored:[])}catch{}
  const fmtDevice=d=>d==='Ambos'?'Celular y PC':d==='PC'?'Computadora':'Celular';
  const imageUrl=p=>safeUrl(p.localUrl||p.image);
  const thumbnailUrl=p=>{
    const source=imageUrl(p);
    if(!source||!source.startsWith('https://'))return source;
    return 'https://wsrv.nl/?url='+encodeURIComponent(source)+'&w=520&h=650&fit=cover&output=webp&q=78';
  };
  const hasPhone=p=>p.variantsEnabled===true||p.device!=='PC';
  const hasPC=p=>p.variantsEnabled===true||p.device!=='Celular';
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3700)}
  function saveFav(){try{localStorage.setItem('morfotrazo:favs:v1',JSON.stringify([...favorites]))}catch{}}
  function openModal(id){$('#'+id).hidden=false;document.body.classList.add('modal-open')}
  function closeModal(id){$('#'+id).hidden=true;if(!document.querySelector('.modal-backdrop:not([hidden])'))document.body.classList.remove('modal-open')}
  function card(p){
    const fav=favorites.has(p.id);
    const img=thumbnailUrl(p);
    const wrapper=document.createElement('article');
    wrapper.className='wall-card';
    wrapper.dataset.id=p.id;
    wrapper.innerHTML=
      '<div class="wall-image-wrap">'+
        '<button class="wall-image-btn" data-action="preview" data-id="'+esc(p.id)+'" aria-label="Ver '+esc(p.title)+'">'+
          '<img class="wall-image" loading="lazy" decoding="async" src="'+esc(img)+'" alt="'+esc(p.title)+'">'+
        '</button>'+
        '<button class="favorite '+(fav?'is-favorite':'')+'" data-action="favorite" data-id="'+esc(p.id)+'" aria-label="'+(fav?'Quitar de favoritos':'Agregar a favoritos')+'" aria-pressed="'+fav+'">'+icon('heart')+'</button>'+
        '<div class="wall-overlay"><div class="devices">'+(hasPhone(p)?icon('phone'):'')+(hasPC(p)?icon('monitor'):'')+'</div><span class="quality">'+esc(p.quality||'HD')+'</span></div>'+
      '</div>'+
      '<div class="wall-bottom"><p class="wall-name" title="'+esc(p.title)+'">'+esc(p.title)+'</p><button class="download-btn" data-action="download" data-id="'+esc(p.id)+'">'+icon('download')+' Descargar</button></div>';
    const image=wrapper.querySelector('img');
    image.addEventListener('error',()=>{
      if(!image.dataset.originalFallback){image.dataset.originalFallback='1';image.src=imageUrl(p);return}
      image.style.display='none';
      wrapper.querySelector('.wall-image-wrap').style.background='radial-gradient(circle at 30% 20%,#ec640b,#11364c 42%,#07111b 85%)';
    });
    return wrapper;
  }
  function match(p){
    if(favoriteOnly&&!favorites.has(p.id))return false;
    const inCat=filter==='Todas'||(filter==='Celular'&&hasPhone(p))||(filter==='PC'&&hasPC(p))||p.category===filter;
    if(!inCat)return false;
    const hay=(p.title+' '+p.category+' '+fmtDevice(p.device)+' '+(p.tags||[]).join(' ')).toLocaleLowerCase('es');
    return !query||hay.includes(query.toLocaleLowerCase('es'));
  }
  function appendCards(container,items){container.replaceChildren(...items.map(card))}
  function render(){
    const matched=wallpapers.filter(match);
    let featured=matched.filter(p=>p.featured);
    let recent=matched.filter(p=>!p.featured).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    if(showMode==='allFeatured'){featured=matched;recent=[]}
    if(showMode==='allRecent'){featured=[];recent=matched.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
    appendCards($('#featuredGrid'),featured);
    appendCards($('#recentGrid'),recent);
    $('#destacados').hidden=!featured.length;
    $('#recientes').hidden=!recent.length;
    $('#emptyState').hidden=matched.length!==0;
    $('#filterStatus').textContent=matched.length+' fondo'+(matched.length===1?'':'s')+(favoriteOnly?' en tus favoritos':filter==='Todas'?' para explorar':' · '+filter)+(query?' · búsqueda: '+query:'');
    $('#clearFilters').hidden=filter==='Todas'&&!favoriteOnly&&!query;
    $('#moreFeatured').innerHTML=(showMode==='allFeatured'?'Ver menos':'Ver más')+' '+icon('arrow');
    $('#moreRecent').innerHTML=(showMode==='allRecent'?'Ver menos':'Ver más')+' '+icon('arrow');
    document.querySelectorAll('.category').forEach(b=>{const selected=b.dataset.filter===filter;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});
    $('#favoritesBtn').style.color=favoriteOnly?'#ff8a20':'';
    $('#favoritesBtn').setAttribute('aria-pressed',String(favoriteOnly));
  }
  function setCategory(next){filter=next;showMode='normal';favoriteOnly=false;render()}
  function reset(){filter='Todas';query='';showMode='normal';favoriteOnly=false;$('#searchInput').value='';render()}
  function findPhoto(id){return wallpapers.find(p=>p.id===id)}
  function toggleFav(id){
    if(favorites.has(id)){favorites.delete(id);toast('Quitado de favoritos')}
    else{favorites.add(id);toast('Guardado en favoritos')}
    saveFav();render();
    if(active&&active.id===id)updateModalFavorite();
  }
  function updateModalFavorite(){
    const liked=active&&favorites.has(active.id);
    $('#modalFavorite').innerHTML=icon('heart')+(liked?' Guardado':' Guardar');
  }
  const downloadSizes={
    phone:[
      {key:'phone-720',w:720,h:1280,label:'HD · 720 × 1280'},
      {key:'phone-1080',w:1080,h:1920,label:'Full HD · 1080 × 1920'},
      {key:'phone-1440',w:1440,h:2560,label:'QHD · 1440 × 2560'},
      {key:'phone-2160',w:2160,h:3840,label:'4K (reescalado) · 2160 × 3840'}
    ],
    pc:[
      {key:'pc-1366',w:1366,h:768,label:'HD · 1366 × 768'},
      {key:'pc-1920',w:1920,h:1080,label:'Full HD · 1920 × 1080'},
      {key:'pc-2560',w:2560,h:1440,label:'QHD · 2560 × 1440'},
      {key:'pc-3840',w:3840,h:2160,label:'4K (reescalado) · 3840 × 2160'}
    ]
  };
  let selectedDevice='phone',downloadBusy=false;
  const originalDimensions=p=>p.width&&p.height?p.width+' × '+p.height:(p.quality||'desconocida');
  function setDownloadDevice(device){
    selectedDevice=device==='pc'?'pc':'phone';
    const select=$('#downloadSize');select.replaceChildren();
    for(const size of downloadSizes[selectedDevice]){
      const option=document.createElement('option');option.value=size.key;option.textContent=size.label;select.appendChild(option);
    }
    select.value=selectedDevice==='phone'?'phone-1080':'pc-1920';
    document.querySelectorAll('.device-option').forEach(button=>{
      const active=button.dataset.device===selectedDevice;
      button.classList.toggle('is-selected',active);button.setAttribute('aria-pressed',String(active));
    });
    updateDownloadHelp();
  }
  function updateDownloadHelp(){
    if(!active)return;
    const mode=$('#downloadFit').value;
    $('#downloadHelp').textContent='Original: '+originalDimensions(active)+
      (mode==='cover'?'. El fondo se ajustará recortando los bordes si es necesario.':'. La composición se conserva y los bordes libres se completan con un fondo suavizado.')+
      ' Las dimensiones mayores se reescalan: no agregan detalle real.';
  }
  function preview(id){
    const p=findPhoto(id);if(!p)return;active=p;
    $('#previewImage').src=imageUrl(p);$('#previewImage').alt=p.title;$('#previewTitle').textContent=p.title;
    $('#previewMeta').textContent=p.category+' · Original '+originalDimensions(p)+(p.source?' · '+p.source:'');
    $('#downloadResult').textContent='';
    $('#downloadFit').value='contain';
    setDownloadDevice(window.matchMedia&&window.matchMedia('(max-width:600px)').matches?'phone':'pc');
    updateModalFavorite();openModal('previewModal');
  }
  function download(id){preview(id)}
  function deliverBlob(blob,filename){
    const temporary=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=temporary;anchor.download=filename;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(temporary),3000);
  }
  async function downloadOriginal(){
    if(!active)return;
    const source=safeUrl(active.download||active.image);if(!source){toast('El archivo original no está disponible');return}
    const path=new URL(source).pathname.toLowerCase();
    const extension=path.endsWith('.png')?'png':path.endsWith('.webp')?'webp':'jpg';
    const filename='morfotrazo-'+slug(active.title)+'-original.'+extension;
    try{
      $('#downloadResult').textContent='Preparando archivo original...';
      const response=await fetch(source,{mode:'cors'});
      if(!response.ok)throw Error('No se pudo obtener la imagen');
      const blob=await response.blob();deliverBlob(blob,filename);
      $('#downloadResult').textContent='Archivo original descargado.';
      toast('¡Descarga lista!');
    }catch(e){
      const a=document.createElement('a');a.href=source;a.target='_blank';a.rel='noopener noreferrer';
      document.body.appendChild(a);a.click();a.remove();
      $('#downloadResult').textContent='Se abrió el original en otra pestaña. Desde allí podés guardarlo.';
      toast('Abrimos el original para guardarlo');
    }
  }
  function imageFromUrl(url){
    return new Promise((resolve,reject)=>{
      const image=new Image();image.crossOrigin='anonymous';
      image.onload=()=>{image.width&&image.height?resolve(image):reject(Error('Imagen sin dimensiones'))};
      image.onerror=()=>reject(Error('El servidor de imágenes no permite procesar este archivo'));
      image.src=url;
    });
  }
  async function loadForCanvas(source){
    try{return await imageFromUrl(source)}catch(firstError){
      if(!source.startsWith('https://'))throw firstError;
      // La copia CORS permite redimensionar imágenes externas sin modificar la original.
      const proxy='https://wsrv.nl/?url='+encodeURIComponent(source)+'&output=jpg&q=95';
      return imageFromUrl(proxy);
    }
  }
  function drawAdapted(canvas,image,fit){
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw Error('Este navegador no admite el procesador de imágenes');
    const w=canvas.width,h=canvas.height,iw=image.naturalWidth,ih=image.naturalHeight;
    if(!iw||!ih)throw Error('La imagen no tiene dimensiones válidas');
    const cover=Math.max(w/iw,h/ih),contain=Math.min(w/iw,h/ih);
    if(fit==='cover'||Math.abs(w/h-iw/ih)<.015){
      const dw=iw*cover,dh=ih*cover;
      ctx.drawImage(image,(w-dw)/2,(h-dh)/2,dw,dh);
      return;
    }
    // Relleno de vidrio desenfocado: preserva toda la ilustración sin deformarla.
    ctx.fillStyle='#061019';ctx.fillRect(0,0,w,h);
    ctx.save();
    ctx.filter='blur('+Math.ceil(Math.min(w,h)*.043)+'px) brightness(.65) saturate(1.18)';
    const dw=iw*cover*1.13,dh=ih*cover*1.13;
    ctx.drawImage(image,(w-dw)/2,(h-dh)/2,dw,dh);
    ctx.restore();
    const fgW=iw*contain,fgH=ih*contain;
    ctx.drawImage(image,(w-fgW)/2,(h-fgH)/2,fgW,fgH);
  }
  async function downloadSized(){
    if(!active||downloadBusy)return;
    const size=downloadSizes[selectedDevice].find(item=>item.key===$('#downloadSize').value);
    if(!size)return;
    const p=active,source=safeUrl(p.download||p.image),mode=$('#downloadFit').value;
    const button=$('#modalDownload'),note=$('#downloadResult');
    if(!source){note.textContent='No se encontró la imagen original.';return}
    downloadBusy=true;button.disabled=true;button.textContent='Preparando '+size.w+' × '+size.h+'...';
    note.textContent='Creando el fondo con la resolución elegida...';
    try{
      const image=await loadForCanvas(source);
      const canvas=document.createElement('canvas');canvas.width=size.w;canvas.height=size.h;
      drawAdapted(canvas,image,mode);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No fue posible exportar el archivo')),'image/jpeg',.94));
      if(!blob)throw Error('No se pudo exportar la imagen');
      deliverBlob(blob,'morfotrazo-'+slug(p.title)+'-'+selectedDevice+'-'+size.w+'x'+size.h+'.jpg');
      note.textContent='Descarga lista: '+size.w+' × '+size.h+'.';
      toast('Fondo descargado en '+size.w+' × '+size.h);
      canvas.width=1;canvas.height=1;
    }catch(e){
      // Último recurso: pedir el tamaño exacto a un servicio de redimensionamiento CORS.
      const variantUrl='https://wsrv.nl/?url='+encodeURIComponent(source)+'&w='+size.w+'&h='+size.h+
        '&fit='+(mode==='cover'?'cover':'contain')+'&cbg=061019&output=jpg&q=93';
      try{
        const response=await fetch(variantUrl,{mode:'cors'});
        if(!response.ok)throw Error('Imagen no disponible');
        const resized=await response.blob();
        if(!resized.type.startsWith('image/'))throw Error('Respuesta no válida');
        deliverBlob(resized,'morfotrazo-'+slug(p.title)+'-'+selectedDevice+'-'+size.w+'x'+size.h+'.jpg');
        note.textContent='Descarga lista: '+size.w+' × '+size.h+' (adaptación básica).';
        toast('Fondo descargado en '+size.w+' × '+size.h);
      }catch(fallbackError){
        const anchor=document.createElement('a');anchor.href=variantUrl;anchor.target='_blank';anchor.rel='noopener noreferrer';
        document.body.appendChild(anchor);anchor.click();anchor.remove();
        note.textContent='No se pudo iniciar la descarga directa. Abrimos una versión redimensionada en otra pestaña. También podés usar el original.';
        toast('Abrimos el tamaño elegido en otra pestaña');
      }
    }finally{
      downloadBusy=false;button.disabled=false;button.innerHTML=icon('download')+' Descargar tamaño elegido';
    }
  }
  async function load(){
    try{
      const response=await fetch('./data.json?v='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw Error('No se pudo obtener el catálogo');
      const data=await response.json();
      wallpapers=Array.isArray(data.wallpapers)?data.wallpapers.filter(p=>p&&p.id&&p.title&&p.image):[];
      render();
    }catch(err){
      $('#filterStatus').textContent='El catálogo no está disponible en este momento.';
      toast('No pudimos cargar la galería. Volvé a intentar.');
    }
  }
  document.body.addEventListener('click',e=>{
    const action=e.target.closest('[data-action]');
    if(action){
      const id=action.dataset.id;
      if(action.dataset.action==='favorite')toggleFav(id);
      if(action.dataset.action==='preview')preview(id);
      if(action.dataset.action==='download')download(id);
    }
    const closer=e.target.closest('[data-close]');if(closer)closeModal(closer.dataset.close);
  });
  document.querySelectorAll('.modal-backdrop').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeModal(el.id)}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(el=>closeModal(el.id))});
  $('#categories').addEventListener('click',e=>{const button=e.target.closest('.category');if(button)setCategory(button.dataset.filter)});
  $('#searchForm').addEventListener('submit',e=>{e.preventDefault();query=$('#searchInput').value.trim();showMode='normal';render();$('#explorar').scrollIntoView({behavior:'smooth'})});
  $('#searchInput').addEventListener('input',e=>{query=e.target.value.trim();showMode='normal';render()});
  $('#clearFilters').addEventListener('click',reset);
  $('#emptyClear').addEventListener('click',reset);
  $('#favoritesBtn').addEventListener('click',()=>{favoriteOnly=!favoriteOnly;showMode='normal';render();$('#explorar').scrollIntoView({behavior:'smooth'})});
  $('#moreFeatured').addEventListener('click',()=>{showMode=showMode==='allFeatured'?'normal':'allFeatured';render();$('#destacados').scrollIntoView({behavior:'smooth'})});
  $('#moreRecent').addEventListener('click',()=>{showMode=showMode==='allRecent'?'normal':'allRecent';render();(showMode==='allRecent'?$('#recientes'):$('#explorar')).scrollIntoView({behavior:'smooth'})});
  $('#closingExplore').addEventListener('click',()=>{reset();$('#explorar').scrollIntoView({behavior:'smooth'})});
  $('#modalFavorite').addEventListener('click',()=>{if(active)toggleFav(active.id)});
  $('#modalDownload').addEventListener('click',downloadSized);
  $('#downloadOriginal').addEventListener('click',downloadOriginal);
  $('#downloadDevice').addEventListener('click',e=>{
    const button=e.target.closest('[data-device]');if(button)setDownloadDevice(button.dataset.device);
  });
  $('#downloadFit').addEventListener('change',updateDownloadHelp);
  $('#menuToggle').addEventListener('click',()=>{
    const nav=$('#mainNav'),expanded=nav.classList.toggle('is-open');
    $('#menuToggle').setAttribute('aria-expanded',String(expanded));
    $('#menuToggle').innerHTML=icon(expanded?'close':'menu');
  });
  document.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',()=>{
    $('#mainNav').classList.remove('is-open');
    $('#menuToggle').setAttribute('aria-expanded','false');$('#menuToggle').innerHTML=icon('menu');
    document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active',l===link));
    if(link.dataset.nav==='explorar'){reset()}
    if(link.dataset.nav==='populares'){filter='Todas';showMode='normal';favoriteOnly=false;query='';$('#searchInput').value='';render()}
  }));
  $('#year').textContent=String(new Date().getFullYear());
  load();
})();