import {createWorld} from './world.js?v=2';

const $=s=>document.querySelector(s);
const stories=[...document.querySelectorAll('.story')],chapterLinks=[...document.querySelectorAll('.chapters a')];
const anchors=[0,.36,.70,1],titles=['La idea','La forma','La conexión','Lo que viene'];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const p=clamp((x-a)/(b-a));return p*p*(3-2*p);};
let world=null,maxScroll=1,desired=0,position=0,clock=0,last=0,raf=0,active=-1;
let paused=reduced.matches,playing=false,visible=!document.hidden;
const pointer={x:0,y:0},targetPointer={x:0,y:0};
function measure(){maxScroll=Math.max(1,$('#recorrido').offsetHeight-innerHeight);world?.resize();readScroll();}
function readScroll(){desired=clamp(scrollY/maxScroll);$('#progress').style.width=`${desired*100}%`;}
function setPlaying(value){playing=value;$('#tour').setAttribute('aria-pressed',String(playing));$('#tour-label').textContent=playing?'Pausar recorrido':desired>.995?'Volver a recorrer':'Ver recorrido';$('.play-symbol').textContent=playing?'Ⅱ':desired>.995?'↻':'▷';document.documentElement.style.scrollBehavior=playing?'auto':'';}
function startTour(){if(playing){setPlaying(false);return;}if(desired>.995){window.scrollTo({top:0,behavior:'instant'});desired=position=0;}if(paused){paused=false;updateMotion();}setPlaying(true);}
function updateMotion(){const b=$('#motion');b.setAttribute('aria-pressed',String(paused));b.setAttribute('aria-label',paused?'Reanudar movimiento':'Pausar movimiento');b.innerHTML=paused?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5 8 5-8 5Z"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 5v10M14 5v10"/></svg>';}
function interrupt(){if(playing)setPlaying(false);}
document.querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',startTour));$('#tour').addEventListener('click',startTour);
$('#motion').addEventListener('click',()=>{paused=!paused;if(paused)interrupt();updateMotion();});
window.addEventListener('wheel',interrupt,{passive:true});window.addEventListener('touchstart',interrupt,{passive:true});
window.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))interrupt();});
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',interrupt));
window.addEventListener('scroll',readScroll,{passive:true});window.addEventListener('resize',measure,{passive:true});
window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){targetPointer.x=(e.clientX/innerWidth-.5)*2;targetPointer.y=(.5-e.clientY/innerHeight)*2;}},{passive:true});
document.addEventListener('pointerleave',()=>{targetPointer.x=targetPointer.y=0;});
reduced.addEventListener('change',()=>{paused=reduced.matches;if(paused)interrupt();updateMotion();});
function fail(error){console.error('Zenix journey:',error);world=null;document.body.classList.add('fallback');document.body.classList.remove('ready');}
try{world=createWorld($('#world'));}catch(error){fail(error);}
$('#world').addEventListener('webglcontextlost',e=>{e.preventDefault();fail('WebGL context lost');});
$('#world').addEventListener('webglcontextrestored',()=>location.reload());
measure();updateMotion();position=desired;
document.fonts?.ready.then(measure);
function narrative(p){
  document.body.style.setProperty('--format',smooth(.47,.645,p).toFixed(4));document.body.style.setProperty('--lite-turn',`${Math.sin(p*Math.PI*4)*12}deg`);
  const weights=[1-smooth(.045,.145,p),smooth(.235,.29,p)*(1-smooth(.445,.515,p)),smooth(.60,.65,p)*(1-smooth(.77,.825,p)),smooth(.887,.935,p)];
  stories.forEach((s,i)=>{const w=weights[i];s.style.opacity=w.toFixed(4);s.classList.toggle('current',w>.05);s.setAttribute('aria-hidden',String(w<.05));});
  let next=0;for(let i=1;i<4;i++)if(p>(anchors[i-1]+anchors[i])/2)next=i;
  if(next!==active){active=next;document.body.dataset.chapter=String(next);$('#chapter-number').textContent=String(next).padStart(2,'0');$('#chapter-name').textContent=titles[next];chapterLinks.forEach((a,i)=>{a.classList.toggle('current',i===next);if(i===next)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
}
function draw(timestamp){
  if(!visible)return;
  const dt=Math.min((timestamp-last)/1000||.016,.06);last=timestamp;
  if(playing){desired=clamp(desired+dt/56);window.scrollTo({top:desired*maxScroll,behavior:'instant'});if(desired>=1)setPlaying(false);}
  if(!paused)clock+=dt;
  position+=(desired-position)*(1-Math.exp(-dt*(reduced.matches?22:6.5)));if(Math.abs(position-desired)<.000015)position=desired;
  pointer.x+=(targetPointer.x-pointer.x)*(1-Math.exp(-dt*2));pointer.y+=(targetPointer.y-pointer.y)*(1-Math.exp(-dt*2));
  narrative(position);
  if(world){try{world.render(position,clock,pointer,dt,paused||reduced.matches);if(!document.body.classList.contains('ready')){document.body.classList.add('ready');document.body.classList.remove('fallback');}}catch(error){fail(error);}}
  raf=requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible){last=performance.now();raf=requestAnimationFrame(draw);}else cancelAnimationFrame(raf);});
window.addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
raf=requestAnimationFrame(draw);
