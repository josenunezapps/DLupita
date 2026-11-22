import {normalize,number,safeURL} from '@/lib/analysis';
const reply=(body:any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function get(url:string,key:string,init:any={}){const r=await fetch(url,{...init,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(25000)});const d:any=await r.json();if(!r.ok)throw new Error(r.status===401||r.status===403?'Credencial inválida, permisos insuficientes o cuota agotada.':`El proveedor respondió con error ${r.status}. Revisá su panel antes de reintentar.`);return d}
export async function POST(req:Request){try{
 const b:any=await req.json();if(JSON.stringify(b).length>20000)return reply({error:'Solicitud demasiado grande'},400);
 const {platform,key,action}=b;if(!['YouTube','TikTok','Instagram'].includes(platform)||typeof key!=='string'||!key.trim())return reply({error:'Conectá la clave del proveedor en Configuración.'},400);
 let q=String(b.query||'').trim();if(q.length>200)return reply({error:'Nombre o enlace demasiado largo.'},400);
 if(platform==='YouTube'){
 const yt=async(resource:string,p:any)=>get('https://www.googleapis.com/youtube/v3/'+resource+'?'+new URLSearchParams(p), '',{headers:{Authorization:'','X-Goog-Api-Key':key}});
 let id=b.channelId,handle='';if(!id){if(/^https?:/.test(q)){const u=new URL(q);if(!['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname))throw new Error('Usá un enlace de canal de YouTube.');const paths=u.pathname.split('/').filter(Boolean);if(paths[0]==='channel')id=paths[1];else if(paths[0]?.startsWith('@'))handle=paths[0];else throw new Error('Usá el enlace del canal con @usuario o /channel/ID.');}else if(q.startsWith('@'))handle=q;else if(/^UC[\w-]{22}$/.test(q))id=q;
 if(!id&&!handle){const s=await yt('search',{part:'snippet',type:'channel',q,maxResults:'5'});return reply({candidates:s.items.map((x:any)=>({id:x.id.channelId,name:x.snippet.title,description:x.snippet.description,avatar:x.snippet.thumbnails?.default?.url}))});}}
 const c=(await yt('channels',{part:'snippet,statistics',...(id?{id}:{forHandle:handle})})).items?.[0];if(!c)throw new Error('No se encontró ese canal.');
 const searches=await Promise.all(['viewCount','date'].map(order=>yt('search',{part:'id',channelId:c.id,type:'video',order,maxResults:'50'})));
 const ids=[...new Set<string>(searches.flatMap(s=>s.items.map((x:any)=>x.id.videoId)))];let items:any[]=[];for(let i=0;i<ids.length;i+=50)items.push(...(await yt('videos',{part:'snippet,statistics,contentDetails',id:ids.slice(i,i+50).join(',')})).items);
 return reply({report:{platform,name:c.snippet.title,description:c.snippet.description,avatar:c.snippet.thumbnails?.default?.url,followers:c.statistics.hiddenSubscriberCount?null:number(c.statistics.subscriberCount),totalViews:number(c.statistics.viewCount),totalVideos:number(c.statistics.videoCount),fetched:new Date().toISOString(),scope:'Muestra combinada: hasta 50 videos ordenados por vistas y 50 recientes, sin duplicados. Puede excluir videos privados, eliminados o no devueltos por búsqueda.',videos:items.map(v=>({id:v.id,title:v.snippet.title,url:'https://www.youtube.com/watch?v='+v.id,thumbnail:safeURL(v.snippet.thumbnails?.high?.url),views:number(v.statistics.viewCount),likes:number(v.statistics.likeCount),comments:number(v.statistics.commentCount),date:v.snippet.publishedAt,duration:v.contentDetails.duration}))}});
 }
 const base='https://api.apify.com/v2/';
 if(action==='poll'){
 if(!/^[A-Za-z0-9]{5,40}$/.test(b.runId))throw new Error('Ejecución inválida.');const run=(await get(base+'actor-runs/'+b.runId,key)).data;
 if(['FAILED','ABORTED','TIMED-OUT'].includes(run.status))throw new Error('La recolección terminó sin éxito. Revisá la ejecución en Apify.');
 if(run.status!=='SUCCEEDED')return reply({runId:b.runId,status:run.status});const rows=await get(base+'datasets/'+run.defaultDatasetId+'/items?clean=true&limit=50',key);return reply({report:normalize(rows,platform,q)});
 }
 if(/^https?:/.test(q)){const u=new URL(q);const host=platform==='TikTok'?'tiktok.com':'instagram.com';if(u.hostname!==host&&u.hostname!=='www.'+host)throw new Error('El enlace no corresponde a la plataforma seleccionada.');q=u.pathname.split('/').filter(Boolean)[0]||'';}q=q.replace(/^@/,'');if(!/^[\w.]{1,60}$/.test(q)||['p','reel','reels','video','explore'].includes(q))throw new Error('Ingresá el @usuario exacto o un enlace de perfil, no de una publicación.');
 const actor=platform==='TikTok'?'clockworks~tiktok-scraper':'apify~instagram-scraper';const input=platform==='TikTok'?{profiles:[q],resultsPerPage:50,profileSorting:'latest',shouldDownloadVideos:false,shouldDownloadCovers:false}:{directUrls:['https://www.instagram.com/'+q+'/'],resultsType:'posts',resultsLimit:50};
 const run=(await get(base+'acts/'+actor+'/runs',key,{method:'POST',body:JSON.stringify(input)})).data;return reply({runId:run.id,status:run.status});
 }catch(e:any){return reply({error:e.name==='TimeoutError'?'El proveedor tardó demasiado. Revisá el estado antes de iniciar otra consulta.':e.message||'No se pudo obtener información.'},400)}}
