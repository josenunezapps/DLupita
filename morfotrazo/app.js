'use strict';
(function(){
  const OWNER='josenunezapps', REPO='DLupita', BRANCH='main', ROOT='morfotrazo';
  const $=sel=>document.querySelector(sel);
  const icon=id=>'<svg aria-hidden="true"><use href="#i-'+id+'"></use></svg>';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'imagen';
  const safeUrl=v=>{try{const u=new URL(String(v||''),document.baseURI);return ['http:','https:','blob:'].includes(u.protocol)?u.href:''}catch{return ''}};
  let wallpapers=[],filter='Todas',query='',showMode='normal',favoriteOnly=false,active=null,uploadObjectURL=null;
  const collections=[
    {name:'Fantasía',slug:'fantasia',icon:'spark'},
    {name:'Fantasía espacial',slug:'fantasia-espacial',icon:'spark'},
    {name:'Blanco y negro',slug:'blanco-y-negro',icon:'moon'},
    {name:'Oscuro',slug:'oscuro',icon:'moon'},
    {name:'Arte',slug:'arte',icon:'palette'},
    {name:'Espacio',slug:'espacio',icon:'spark'},
    {name:'Naturaleza',slug:'naturaleza',icon:'leaf'},
    {name:'Abstracto',slug:'abstracto',icon:'layers'},
    {name:'Ciudades',slug:'ciudades',icon:'home'},
    {name:'Minimalista',slug:'minimalista',icon:'layers'},
    {name:'Ciencia ficción',slug:'ciencia-ficcion',icon:'spark'}
  ];
  const folderSlug=name=>collections.find(c=>c.name===name)?.slug||slug(name);
  let toastTimer;
  let favorites=new Set();
  try{const stored=JSON.parse(localStorage.getItem('morfotrazo:favs:v1')||'[]');favorites=new Set(Array.isArray(stored)?stored:[])}catch{}
  const fmtDevice=d=>d==='Ambos'?'Celular y PC':d==='PC'?'Computadora':'Celular';
  const imageUrl=p=>safeUrl(p.localUrl||p.image);
  const hasPhone=p=>p.variantsEnabled===true||p.device!=='PC';
  const hasPC=p=>p.variantsEnabled===true||p.device!=='Celular';
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3700)}
  function saveFav(){try{localStorage.setItem('morfotrazo:favs:v1',JSON.stringify([...favorites]))}catch{}}
  function openModal(id){$('#'+id).hidden=false;document.body.classList.add('modal-open')}
  function closeModal(id){$('#'+id).hidden=true;if(!document.querySelector('.modal-backdrop:not([hidden])'))document.body.classList.remove('modal-open');if(id==='uploadModal'){$('#githubToken').value='';$('#uploadResult').textContent=''}}
  function card(p){
    const fav=favorites.has(p.id);
    const img=imageUrl(p);
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
    image.addEventListener('error',()=>{image.style.display='none';wrapper.querySelector('.wall-image-wrap').style.background='radial-gradient(circle at 30% 20%,#ec640b,#11364c 42%,#07111b 85%)'});
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
  function renderFolders(){
    const container=$('#folderGrid');
    const cards=collections.map(c=>{
      const works=wallpapers.filter(p=>p.folder===c.slug||(!p.folder&&p.category===c.name));
      if(!works.length)return null;
      const button=document.createElement('button');button.type='button';button.className='folder-card';button.dataset.category=c.name;
      button.setAttribute('aria-label','Abrir carpeta '+c.name+', '+works.length+' fondos');
      const image=document.createElement('img');image.loading='lazy';image.decoding='async';image.alt='';
      image.src=imageUrl(works[0]);button.appendChild(image);
      const left=document.createElement('span');left.className='folder-label';left.innerHTML=icon(c.icon);
      const title=document.createElement('span');title.textContent=c.name;left.appendChild(title);
      const count=document.createElement('span');count.className='folder-count';count.textContent=works.length+' fondos';
      button.append(left,count);return button;
    }).filter(Boolean);
    container.replaceChildren(...cards);
  }
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
    document.querySelectorAll('.folder-card').forEach(b=>b.classList.toggle('is-selected',b.dataset.category===filter));
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
      renderFolders();render();
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
  $('#folderGrid').addEventListener('click',e=>{
    const button=e.target.closest('.folder-card');if(!button)return;
    query='';$('#searchInput').value='';setCategory(button.dataset.category);
    $('#destacados').hidden?$('#recientes').scrollIntoView({behavior:'smooth'}):$('#destacados').scrollIntoView({behavior:'smooth'});
  });
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
  ['topUpload','heroUpload'].forEach(id=>$('#'+id).addEventListener('click',()=>openModal('uploadModal')));
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
  let thumbUrl;
  const imageFile=$('#imageFile');
  const readDataURL=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('No se pudo leer el archivo'));reader.readAsDataURL(file)});
  imageFile.addEventListener('change',()=>{
    const f=imageFile.files[0];
    if(thumbUrl)URL.revokeObjectURL(thumbUrl);
    if(!f){$('#uploadPreview').hidden=true;$('#dropTitle').textContent='Elegí una imagen o arrastrala acá';return}
    thumbUrl=URL.createObjectURL(f);$('#uploadPreview').src=thumbUrl;$('#uploadPreview').hidden=false;
    $('#dropTitle').textContent=f.name;
    if(!$('#imageTitle').value.trim())$('#imageTitle').value=f.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ');
    const im=new Image();im.onload=()=>{$('#imageDevice').value=im.width>im.height?'PC':im.width<im.height?'Celular':'Ambos'};im.src=thumbUrl;
  });
  const drop=$('#dropZone');
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');const files=e.dataTransfer&&e.dataTransfer.files;if(files&&files.length){const transfer=new DataTransfer();transfer.items.add(files[0]);imageFile.files=transfer.files;imageFile.dispatchEvent(new Event('change'))}});
  const apiBase='https://api.github.com/repos/'+OWNER+'/'+REPO+'/contents/';
  const apiHeaders=token=>({'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'});
  function decodeGithub(base64){
    const binary=atob(base64.replace(/\s/g,'')),array=Uint8Array.from(binary,c=>c.charCodeAt(0));
    return new TextDecoder().decode(array);
  }
  function encodeGithub(text){
    const bytes=new TextEncoder().encode(text);let binary='';
    for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    return btoa(binary);
  }
  async function githubRequest(path,token,method='GET',body){
    const result=await fetch(apiBase+path+(method==='GET'?'?ref='+BRANCH:''),{method,headers:apiHeaders(token),body:body?JSON.stringify(body):undefined,cache:'no-store'});
    if(!result.ok){
      let message='Error '+result.status;try{const data=await result.json();if(data.message)message=data.message}catch{}
      if(result.status===401||result.status===403)message='Token sin autorización. Revisá sus permisos sobre DLupita.';
      if(result.status===409)message='Hubo un cambio simultáneo. Reintentá la publicación.';
      throw Error(message);
    }
    return result.json();
  }
  const resultBox=$('#uploadResult'),publishBtn=$('#publishButton');
  $('#uploadForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const file=imageFile.files&&imageFile.files[0],title=$('#imageTitle').value.trim(),token=$('#githubToken').value.trim();
    resultBox.classList.remove('error');
    if(!file||!title||!token){resultBox.textContent='Completá todos los campos.';resultBox.classList.add('error');return}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){resultBox.textContent='Formato no admitido. Usá JPG, PNG o WebP.';resultBox.classList.add('error');return}
    if(file.size>15*1024*1024){resultBox.textContent='La imagen supera los 15 MB.';resultBox.classList.add('error');return}
    publishBtn.disabled=true;publishBtn.textContent='Publicando imagen...';resultBox.textContent='Validando acceso y subiendo el archivo...';
    try{
      const imageData=await readDataURL(file);
      const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
      const id='obra-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
      const category=$('#imageCategory').value,folder=folderSlug(category);
      const path=ROOT+'/imagenes/'+folder+'/'+id+'.'+extension;
      const original=await githubRequest(ROOT+'/data.json',token);
      const data=JSON.parse(decodeGithub(original.content));
      if(!Array.isArray(data.wallpapers))throw Error('Formato del catálogo inválido');
      await githubRequest(path,token,'PUT',{message:'MORFOTRAZO: publicar imagen '+title,content:String(imageData).split(',')[1],branch:BRANCH});
      resultBox.textContent='Imagen subida. Actualizando la galería...';
      const nativeWidth=$('#uploadPreview').naturalWidth||0,nativeHeight=$('#uploadPreview').naturalHeight||0;
      const item={id,title,category,folder,device:'Ambos',originalOrientation:$('#imageDevice').value==='PC'?'horizontal':'vertical',variantsEnabled:true,featured:false,createdAt:new Date().toISOString(),quality:nativeWidth&&nativeHeight?nativeWidth+' × '+nativeHeight:'Original',width:nativeWidth,height:nativeHeight,image:'./imagenes/'+folder+'/'+id+'.'+extension,download:'./imagenes/'+folder+'/'+id+'.'+extension,source:'MORFOTRAZO'};
      data.wallpapers.unshift(item);
      await githubRequest(ROOT+'/data.json',token,'PUT',{message:'MORFOTRAZO: agregar '+title+' al catálogo',content:encodeGithub(JSON.stringify(data,null,2)+'\n'),sha:original.sha,branch:BRANCH});
      let catalogFolderUpdated=true;
      try{
        const manifestPath=ROOT+'/colecciones/'+folder+'/catalogo.json';
        const manifest=await githubRequest(manifestPath,token);
        const manifestData=JSON.parse(decodeGithub(manifest.content));
        if(!Array.isArray(manifestData.works))manifestData.works=[];
        manifestData.works.unshift({id:item.id,title:item.title,category:item.category,device:item.device,quality:item.quality,image:item.image,download:item.download});
        manifestData.count=manifestData.works.length;
        await githubRequest(manifestPath,token,'PUT',{message:'MORFOTRAZO: actualizar carpeta '+category,content:encodeGithub(JSON.stringify(manifestData,null,2)+'\n'),sha:manifest.sha,branch:BRANCH});
      }catch(folderError){catalogFolderUpdated=false}
      item.localUrl=URL.createObjectURL(file);
      wallpapers.unshift(item);renderFolders();render();
      resultBox.textContent=catalogFolderUpdated?'¡Publicado en GitHub y guardado en la carpeta '+category+'! Aparecerá para todos al actualizarse GitHub Pages.':'Imagen publicada y visible en el catálogo. No se pudo actualizar el índice de la carpeta.';
      $('#githubToken').value='';$('#imageTitle').value='';imageFile.value='';
      $('#dropTitle').textContent='Elegí una imagen o arrastrala acá';$('#uploadPreview').hidden=true;
      toast('Fondo publicado correctamente');
    }catch(err){resultBox.classList.add('error');resultBox.textContent='No se pudo publicar: '+(err.message||'error inesperado')}
    finally{publishBtn.disabled=false;publishBtn.innerHTML=icon('upload')+' Publicar fondo'}
  });
  $('#year').textContent=String(new Date().getFullYear());
  load();
})();