'use strict';
(function(){
  const OWNER='josenunezapps', REPO='DLupita', BRANCH='main', ROOT='morfotrazo';
  const $=sel=>document.querySelector(sel);
  const icon=id=>'<svg aria-hidden="true"><use href="#i-'+id+'"></use></svg>';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'imagen';
  const safeUrl=v=>{try{const u=new URL(String(v||''),document.baseURI);return ['http:','https:','blob:'].includes(u.protocol)?u.href:''}catch{return ''}};
  let wallpapers=[],filter='Todas',query='',showMode='normal',favoriteOnly=false,active=null,uploadObjectURL=null;
  let toastTimer;
  let favorites=new Set();
  try{const stored=JSON.parse(localStorage.getItem('morfotrazo:favs:v1')||'[]');favorites=new Set(Array.isArray(stored)?stored:[])}catch{}
  const fmtDevice=d=>d==='Ambos'?'Celular y PC':d==='PC'?'Computadora':'Celular';
  const imageUrl=p=>safeUrl(p.localUrl||p.image);
  const hasPhone=p=>p.device!=='PC';
  const hasPC=p=>p.device!=='Celular';
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
    const hay=(p.title+' '+p.category+' '+fmtDevice(p.device)).toLocaleLowerCase('es');
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
  function preview(id){
    const p=findPhoto(id);if(!p)return;active=p;
    $('#previewImage').src=imageUrl(p);$('#previewImage').alt=p.title;$('#previewTitle').textContent=p.title;
    $('#previewMeta').textContent=p.category+' · '+fmtDevice(p.device)+' · '+(p.quality||'HD')+(p.source?' · '+p.source:'');
    updateModalFavorite();
    openModal('previewModal');
  }
  async function download(id){
    const p=findPhoto(id);if(!p)return;
    const link=safeUrl(p.download||p.image);if(!link){toast('La imagen no está disponible');return}
    const filename='morfotrazo-'+slug(p.title)+'.'+(link.includes('.webp')?'webp':link.includes('.png')?'png':'jpg');
    try{
      toast('Preparando descarga...');
      const result=await fetch(link,{mode:'cors'});
      if(!result.ok)throw Error('HTTP '+result.status);
      const blob=await result.blob();
      const temporary=URL.createObjectURL(blob);
      const anchor=document.createElement('a');anchor.href=temporary;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(temporary),2500);
      toast('¡Descarga lista!');
    }catch(e){
      const anchor=document.createElement('a');anchor.href=link;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
      toast('Abrimos el fondo para que puedas guardarlo');
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
  $('#modalDownload').addEventListener('click',()=>{if(active)download(active.id)});
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
      const path=ROOT+'/uploads/'+id+'.'+extension;
      const original=await githubRequest(ROOT+'/data.json',token);
      const data=JSON.parse(decodeGithub(original.content));
      if(!Array.isArray(data.wallpapers))throw Error('Formato del catálogo inválido');
      await githubRequest(path,token,'PUT',{message:'MORFOTRAZO: publicar imagen '+title,content:String(imageData).split(',')[1],branch:BRANCH});
      resultBox.textContent='Imagen subida. Actualizando la galería...';
      const item={id,title,category:$('#imageCategory').value,device:$('#imageDevice').value,featured:false,createdAt:new Date().toISOString(),quality:'Original',image:'./uploads/'+id+'.'+extension,download:'./uploads/'+id+'.'+extension,source:'MORFOTRAZO'};
      data.wallpapers.unshift(item);
      await githubRequest(ROOT+'/data.json',token,'PUT',{message:'MORFOTRAZO: agregar '+title+' al catálogo',content:encodeGithub(JSON.stringify(data,null,2)+'\n'),sha:original.sha,branch:BRANCH});
      item.localUrl=URL.createObjectURL(file);
      wallpapers.unshift(item);render();
      resultBox.textContent='¡Publicado en GitHub! Aparecerá para todos cuando se actualice GitHub Pages.';
      $('#githubToken').value='';$('#imageTitle').value='';imageFile.value='';
      $('#dropTitle').textContent='Elegí una imagen o arrastrala acá';$('#uploadPreview').hidden=true;
      toast('Fondo publicado correctamente');
    }catch(err){resultBox.classList.add('error');resultBox.textContent='No se pudo publicar: '+(err.message||'error inesperado')}
    finally{publishBtn.disabled=false;publishBtn.innerHTML=icon('upload')+' Publicar fondo'}
  });
  $('#year').textContent=String(new Date().getFullYear());
  load();
})();