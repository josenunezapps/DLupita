import * as THREE from './vendor/three.module.min.js';
import { Reflector } from './vendor/Reflector.js';

const $ = (s) => document.querySelector(s);
const chapters = [...document.querySelectorAll('.chapter')];
const chapterLinks = [...document.querySelectorAll('.chapter-nav a')];
const labels = ['El origen de una idea', 'Una presencia que se siente', 'Tu mundo, más simple', 'Hagámoslo realidad'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches;
let progress = 0, desiredProgress = 0, active = -1, lastFrame = 0, elapsed = 0;
let mobile = innerWidth <= 700, sectionTops = [], mobileBottoms = [];
const pointer = new THREE.Vector2(), smoothPointer = new THREE.Vector2();
const ease = (a, b, x) => { x = THREE.MathUtils.clamp((x-a)/(b-a),0,1); return x*x*(3-2*x); };
const mix = THREE.MathUtils.lerp;
function measure() {
  sectionTops = chapters.map(el=>el.offsetTop); mobile=innerWidth<=700;
  mobileBottoms=chapters.map(el=>{const c=el.querySelector('.copy');return parseFloat(getComputedStyle(c).top)+c.offsetHeight;});
}
function scrollState() {
  const y=window.scrollY;
  let i=0; while(i<3 && y>=sectionTops[i+1]) i++;
  desiredProgress=Math.min(3,i+(i<3?(y-sectionTops[i])/(sectionTops[i+1]-sectionTops[i]):0));
  $('#progress').style.width=`${Math.min(100,100*y/Math.max(1,document.documentElement.scrollHeight-innerHeight))}%`;
  const next = Math.round(desiredProgress);
  if(next!==active){
    active=next; $('#scene-number').textContent=String(next+1).padStart(2,'0'); $('#scene-label').textContent=labels[next];
    chapterLinks.forEach((a,j)=>{a.classList.toggle('current',j===next); if(j===next)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  }
}
function updatePause(){ $('#motion').setAttribute('aria-pressed',String(paused)); $('#motion').setAttribute('aria-label',paused?'Reanudar animación':'Pausar animación'); $('#motion-label').textContent=paused?'Reanudar':'Pausar'; }
$('#motion').addEventListener('click',()=>{paused=!paused;updatePause();});
reduced.addEventListener('change',()=>{paused=reduced.matches;updatePause();});
window.addEventListener('scroll',scrollState,{passive:true});
window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){pointer.x=(e.clientX/innerWidth-.5)*2;pointer.y=(e.clientY/innerHeight-.5)*2;}},{passive:true});
document.addEventListener('pointerleave',()=>pointer.set(0,0));
measure();scrollState();updatePause();

try { start(); } catch(error) { document.body.classList.add('fallback'); $('#motion').hidden=true; console.error('Zenix 3D:',error); }

function start(){
  const canvas=$('#world');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:1.75));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.10;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2('#0b0811',.024);
  const camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.1,65);
  camera.position.set(0,.6,10.6);
  camera.lookAt(0,.05,0);

  // A photographed-studio style environment: broad white softboxes and one violet fill.
  // It is baked once into the roughness-filtered environment, rather than animated every frame.
  const room=new THREE.Scene();room.background=new THREE.Color('#19131f');
  const addPanel=(w,h,color,intensity,x,y,z,ry=0)=>{
    const mat=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide});
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);panel.position.set(x,y,z);panel.rotation.y=ry;room.add(panel);
  };
  addPanel(4,7,'#fff7f0',5,-5,3,4,.7);
  addPanel(2.3,6,'#d7c3ff',4,5,2,3,-.7);
  addPanel(7,2,'#ffffff',3,0,6,-2,0);
  addPanel(1.4,5,'#a66bff',3,-4,0,-4,-.5);
  addPanel(3,3,'#f6e9ff',2,1,2,6,0);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(room,.04,.1,30);
  scene.environment=environment.texture;scene.environmentIntensity=.85;
  pmrem.dispose(); room.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});

  scene.add(new THREE.AmbientLight('#c9b3e3',.55));
  const key=new THREE.DirectionalLight('#fff4ec',4.2);key.position.set(-3,6,5);scene.add(key);
  const fill=new THREE.DirectionalLight('#b495ff',3);fill.position.set(5,2,1);scene.add(fill);
  const rim=new THREE.DirectionalLight('#9960f8',3.5);rim.position.set(0,3,-5);scene.add(rim);
  const spot=new THREE.SpotLight('#e9d4ff',45,30,Math.PI/4,.8,1.2);spot.position.set(1,7,3);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.0004;spot.shadow.normalBias=.035;spot.shadow.blurSamples=6;scene.add(spot,spot.target);

  const physical=(p)=>new THREE.MeshPhysicalMaterial(p);
  const mat={
    pearl:physical({color:'#cdb5f0',metalness:.72,roughness:.19,clearcoat:1,clearcoatRoughness:.10,envMapIntensity:1.1}),
    edge:physical({color:'#655078',metalness:.94,roughness:.19,clearcoat:1,envMapIntensity:1.2}),
    chrome:physical({color:'#bbb6c2',metalness:1,roughness:.19,envMapIntensity:1.2}),
    violet:physical({color:'#6d2bc2',metalness:.62,roughness:.19,clearcoat:1,clearcoatRoughness:.13,envMapIntensity:1.2}),
    black:physical({color:'#16121c',metalness:.67,roughness:.26,clearcoat:1,clearcoatRoughness:.23}),
    dark:physical({color:'#1b1722',metalness:.58,roughness:.33}),
    key:new THREE.MeshStandardMaterial({color:'#16131d',metalness:.25,roughness:.6}),
    light:new THREE.MeshBasicMaterial({color:'#c99bff'}),
  };

  function rounded(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
  function box(w,h,d,r,material){const g=new THREE.ExtrudeGeometry(rounded(w,h,r),{depth:d,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:4,steps:1,curveSegments:16});g.translate(0,0,-d/2);const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;return m;}
  function screen(w,h,r,texture){const g=new THREE.ShapeGeometry(rounded(w,h,r),24);const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+w/2)/w,(p.getY(i)+h/2)/h);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));return m;}
  function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return t;}
  function rr(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function txt(ctx,text,x,y,size,color='#fff',weight=500){ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial, sans-serif`;ctx.fillText(text,x,y);}
  function ballGraphic(ctx,x,y,r){const g=ctx.createRadialGradient(x-r*.4,y-r*.55,r*.05,x,y,r);g.addColorStop(0,'#f2dbff');g.addColorStop(.28,'#d6a7ff');g.addColorStop(.67,'#8845cc');g.addColorStop(1,'#32124c');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f3d9ff77';ctx.lineWidth=2;ctx.stroke();}

  const webTexture=canvasTexture(1500,930,(c,w,h)=>{
    c.fillStyle='#100d17';c.fillRect(0,0,w,h);
    rr(c,0,0,w,50,0,'#211a2b');['#75556c','#8e7566','#657c6a'].forEach((v,i)=>{c.fillStyle=v;c.beginPath();c.arc(25+i*21,25,5,0,Math.PI*2);c.fill();});
    rr(c,520,13,460,25,6,'#16111f');txt(c,'tunegocio.com.ar',669,31,14,'#9989ad');
    txt(c,'tu negocio.',70,124,28,'#eee5fa',700);txt(c,'Inicio',940,119,16,'#b4a6c7');txt(c,'Colecciones',1030,119,16,'#b4a6c7');rr(c,1222,89,205,47,24,'#d6c0f0');txt(c,'Hablemos  ↗',1265,120,17,'#23132f',600);
    txt(c,'IDEAS QUE MERECEN VERSE',78,224,15,'#b895dd',600);
    txt(c,'Tu marca.',72,330,84,'#f1e8fa',600);txt(c,'Tu universo.',72,425,84,'#b992df',600);
    txt(c,'Un espacio digital que habla de vos.',78,488,22,'#ada0bb');txt(c,'Diseñado para conectar.',78,524,22,'#ada0bb');
    rr(c,78,571,259,62,10,'#d9c4f0');txt(c,'Explorar colección   ↗',107,610,20,'#241433',600);
    const g=c.createLinearGradient(800,140,1350,650);g.addColorStop(0,'#342244');g.addColorStop(1,'#1c122a');rr(c,830,182,600,482,22,g);
    c.save();c.translate(1130,422);c.rotate(-.15);c.shadowColor='#08030f';c.shadowBlur=40;c.shadowOffsetY=30;ballGraphic(c,0,0,158);c.restore();
    txt(c,'01 / Una nueva perspectiva',862,633,15,'#a88aba');
    c.fillStyle='#352b40';c.fillRect(78,721,1350,1);
    ['Diseño con identidad','Simple por naturaleza','Hecho para vos'].forEach((t,i)=>{const x=78+i*470;txt(c,String(i+1).padStart(2,'0'),x,784,17,'#9a7eb6');txt(c,t,x,833,25,'#e7dcf3',600);txt(c,['Tu esencia en cada detalle.','Una experiencia que fluye.','A tu ritmo. A tu medida.'][i],x,871,17,'#a18fb2');});
  });
  const phoneTexture=canvasTexture(700,1400,(c,w,h)=>{
    c.fillStyle='#f4eff8';c.fillRect(0,0,w,h);txt(c,'9:41',48,55,22,'#231a2c',700);txt(c,'•••  ▰',560,55,22,'#231a2c');
    txt(c,'tu negocio.',48,150,31,'#281532',700);rr(c,586,118,62,49,14,'#e6d9ef');txt(c,'≡',605,152,30,'#623e7b');
    txt(c,'TU ESPACIO',48,243,17,'#a37ebd',600);txt(c,'Tu catálogo,',46,313,53,'#261633',700);txt(c,'a tu manera.',46,376,53,'#79449c',700);
    rr(c,48,421,604,69,16,'#e9e0ef');txt(c,'⌕   Buscar en tu colección',72,466,23,'#9b86aa');
    rr(c,48,526,120,49,24,'#40214e');txt(c,'Todo',82,558,20,'#fff',600);txt(c,'Colecciones',203,558,20,'#9886a4');txt(c,'Destacados',425,558,20,'#9886a4');
    for(let i=0;i<4;i++){const x=48+(i%2)*316,y=616+Math.floor(i/2)*322;rr(c,x,y,288,230,18,['#e5d8ef','#ddd4e7','#e2dced','#dfd4e8'][i]);c.save();c.shadowColor='#9d78b944';c.shadowBlur=20;c.shadowOffsetY=14;ballGraphic(c,x+144,y+108,65-i*5);c.restore();txt(c,`Colección 0${i+1}`,x+3,y+268,23,'#3b254b',600);txt(c,'Ver detalles  ↗',x+3,y+301,18,'#9676ab');}
    rr(c,29,1298,642,77,25,'#2f1a3b');txt(c,'⌂',98,1351,31,'#eedcff');txt(c,'♡',266,1351,31,'#ad91be');txt(c,'☰',433,1351,31,'#ad91be');txt(c,'◯',579,1351,31,'#ad91be');
  });
  const cardTexture=canvasTexture(800,270,(c,w,h)=>{
    c.fillStyle='#251a31';c.fillRect(0,0,w,h);rr(c,35,52,75,75,22,'#9c76c5');txt(c,'↗',53,104,42,'#f2e4ff');txt(c,'Todo, más conectado.',144,90,30,'#f3e7ff',600);txt(c,'Tu negocio. Tu propio espacio.',144,137,23,'#b49ac9');c.fillStyle='#483253';c.fillRect(35,177,730,1);txt(c,'Simple. Cercano. A tu medida.',40,225,21,'#c8addc');
  });

  function logo(){
    const s=new THREE.Shape();s.moveTo(-1.21,1.22);s.lineTo(1.21,1.22);s.lineTo(1.21,.69);s.lineTo(-.24,-.66);s.lineTo(1.21,-.66);s.lineTo(1.21,-1.22);s.lineTo(-1.21,-1.22);s.lineTo(-1.21,-.69);s.lineTo(.24,.66);s.lineTo(-1.21,.66);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:.34,bevelEnabled:true,bevelThickness:.085,bevelSize:.085,bevelSegments:8,curveSegments:20});g.translate(0,0,-.17);g.computeVertexNormals();
    const m=new THREE.Mesh(g,[mat.pearl,mat.edge]);m.castShadow=true;m.receiveShadow=true;return m;
  }
  function pedestal(){
    const p=new THREE.Group();
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.73,1.79,.15,128),mat.black);base.position.y=-1.53;base.castShadow=true;base.receiveShadow=true;p.add(base);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.70,.012,10,128),mat.light);ring.rotation.x=Math.PI/2;ring.position.y=-1.47;p.add(ring);
    const lower=new THREE.Mesh(new THREE.CylinderGeometry(1.78,1.75,.05,128),mat.edge);lower.position.y=-1.63;p.add(lower);
    return p;
  }
  const groups=[], sculptures=[];
  for(let i=0;i<4;i++){const g=new THREE.Group();groups.push(g);scene.add(g);}
  const hero=logo();hero.position.y=.18;hero.rotation.set(.08,-.28,-.12);groups[0].add(hero,pedestal());sculptures.push(hero);
  const satellite=new THREE.Mesh(new THREE.SphereGeometry(.29,48,32),mat.chrome);satellite.position.set(1.63,.84,-.48);satellite.castShadow=true;groups[0].add(satellite);
  const satellite2=new THREE.Mesh(new THREE.SphereGeometry(.15,32,24),mat.violet);satellite2.position.set(-1.52,-.51,.33);satellite2.castShadow=true;groups[0].add(satellite2);

  // Solid aluminum laptop, including a back shell, hinge, keys and recessed display.
  const laptop=new THREE.Group();groups[1].add(laptop);
  const lid=new THREE.Group();lid.position.set(0,.35,-.12);lid.rotation.x=-.09;laptop.add(lid);
  const shell=box(4.58,2.95,.16,.13,mat.chrome);lid.add(shell);
  const bezel=box(4.49,2.86,.025,.11,mat.black);bezel.position.z=.102;lid.add(bezel);
  const display=screen(4.29,2.66,.05,webTexture);display.position.set(0,-.025,.148);lid.add(display);
  const webcam=new THREE.Mesh(new THREE.SphereGeometry(.018,12,8),mat.key);webcam.position.set(0,1.406,.148);lid.add(webcam);
  const base=box(4.74,1.66,.105,.12,mat.chrome);base.rotation.x=-Math.PI/2;base.position.set(0,-1.155,.69);laptop.add(base);
  const keyboard=new THREE.InstancedMesh(new THREE.BoxGeometry(.286,.012,.138),mat.key,52);let k=0;
  for(let row=0;row<4;row++)for(let col=0;col<13;col++){const m=new THREE.Matrix4().makeTranslation(-1.96+col*.325,-1.084,.15+row*.185);keyboard.setMatrixAt(k++,m);}laptop.add(keyboard);
  const trackpad=new THREE.Mesh(new THREE.PlaneGeometry(1.40,.42),mat.dark);trackpad.rotation.x=-Math.PI/2;trackpad.position.set(0,-1.076,1.12);laptop.add(trackpad);
  const laptopBall=new THREE.Mesh(new THREE.SphereGeometry(.58,48,36),mat.violet);laptopBall.position.set(2.0,-.74,-.6);laptopBall.castShadow=true;groups[1].add(laptopBall);

  const phone=new THREE.Group();groups[2].add(phone);
  const phoneFrame=box(1.88,3.80,.22,.24,mat.chrome);phone.add(phoneFrame);
  const phoneBezel=box(1.80,3.72,.028,.22,mat.black);phoneBezel.position.z=.145;phone.add(phoneBezel);
  const phoneDisplay=screen(1.69,3.49,.15,phoneTexture);phoneDisplay.position.z=.19;phone.add(phoneDisplay);
  const island=box(.57,.14,.025,.065,mat.black);island.position.set(0,1.59,.205);phone.add(island);
  const volume=box(.035,.42,.07,.014,mat.chrome);volume.position.set(-.973,.68,0);phone.add(volume);
  const power=box(.035,.50,.07,.014,mat.chrome);power.position.set(.973,.47,0);phone.add(power);
  const floatCard=new THREE.Group();floatCard.add(box(2.90,.98,.08,.13,mat.edge));const floatDisplay=screen(2.84,.92,.10,cardTexture);floatDisplay.position.z=.07;floatCard.add(floatDisplay);floatCard.position.set(1.17,-.47,1.0);floatCard.rotation.set(.02,.09,.06);groups[2].add(floatCard);
  const phoneBall=new THREE.Mesh(new THREE.SphereGeometry(.38,48,32),mat.pearl);phoneBall.position.set(-1.24,-1.2,.55);phoneBall.castShadow=true;groups[2].add(phoneBall);

  const finale=logo();finale.rotation.set(.03,-.16,-.1);finale.position.y=.18;groups[3].add(finale,pedestal());sculptures.push(finale);
  const finaleSphere=new THREE.Mesh(new THREE.SphereGeometry(.22,48,32),mat.chrome);finaleSphere.position.set(1.60,.9,-.2);groups[3].add(finaleSphere);

  // A real reflected camera image on the floor, softened with a five-tap filter.
  const mirrorShader=THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms);
  const shader={uniforms:mirrorShader,vertexShader:Reflector.ReflectorShader.vertexShader,fragmentShader:Reflector.ReflectorShader.fragmentShader
    .replace('vec4 base = texture2DProj( tDiffuse, vUv );',`vec2 uv = vUv.xy / vUv.w;
      vec2 d = vec2(0.0018);
      vec4 base = texture2D(tDiffuse, uv) * 0.4;
      base += texture2D(tDiffuse, uv + vec2(d.x, 0.0)) * 0.15;
      base += texture2D(tDiffuse, uv - vec2(d.x, 0.0)) * 0.15;
      base += texture2D(tDiffuse, uv + vec2(0.0, d.y)) * 0.15;
      base += texture2D(tDiffuse, uv - vec2(0.0, d.y)) * 0.15;`)
    .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor = vec4(mix(vec3(0.014,0.009,0.023), base.rgb, 0.17), 1.0);')};
  const floor=new Reflector(new THREE.PlaneGeometry(70,70),{color:'#21182f',textureWidth:mobile?512:1024,textureHeight:mobile?512:1024,clipBias:.003,shader,multisample:0});floor.rotation.x=-Math.PI/2;floor.position.y=-1.91;scene.add(floor);
  const shadowFloor=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.ShadowMaterial({color:'#000000',opacity:.30}));shadowFloor.rotation.x=-Math.PI/2;shadowFloor.position.y=-1.902;shadowFloor.receiveShadow=true;scene.add(shadowFloor);
  const glowTexture=canvasTexture(128,128,(c)=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(162,77,255,.45)');g.addColorStop(.4,'rgba(124,50,210,.18)');g.addColorStop(1,'rgba(99,30,180,0)');c.fillStyle=g;c.fillRect(0,0,128,128);});
  const groundGlow=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));groundGlow.rotation.x=-Math.PI/2;groundGlow.position.y=-1.895;scene.add(groundGlow);

  const dustCount=mobile?20:38,dustPositions=new Float32Array(dustCount*3);
  for(let i=0;i<dustCount;i++){const n=Math.sin(i*127.1+13)*43758.5453,fract=n-Math.floor(n);dustPositions[i*3]=(fract-.5)*17;dustPositions[i*3+1]=((i*3.731)%1-.35)*9;dustPositions[i*3+2]=-2-(i%7);}
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({size:.014,color:'#c1a6dc',transparent:true,opacity:.32,depthWrite:false}));scene.add(dust);

  let visible=true,raf=0,averageFrame=16,frameCount=0,ratio=renderer.getPixelRatio();
  const home = () => mobile ? [
    {x:0,ry:-.10,rz:0,height:3.40,center:-.05,limit:.75},
    {x:0,ry:-.17,rz:.035,height:3.40,center:.27,limit:.67},
    {x:-.65,ry:.22,rz:-.06,height:4.00,center:0,limit:.67},
    {x:0,ry:-.03,rz:0,height:3.40,center:-.05,limit:.80},
  ].map((h,i)=>{
    const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*10.6;
    const top=mobileBottoms[i]+12,bottom=innerHeight-68,space=Math.max(110,bottom-top);
    const s=Math.min(h.limit,space*viewHeight/innerHeight/h.height);
    return {...h,s,x:h.x*s,y:(.5-(top+space/2)/innerHeight)*viewHeight+.05-h.center*s};
  }) : [
    {x:2.35,y:-.02,s:1.08,ry:-.06,rz:0},
    {x:2.45,y:-.08,s:.94,ry:-.19,rz:.035},
    {x:-2.40,y:-.05,s:1.02,ry:.22,rz:-.06},
    {x:2.4,y:-.02,s:1.09,ry:-.05,rz:0},
  ];

  function draw(timestamp){
    if(!visible)return;
    const delta=Math.min((timestamp-lastFrame)/1000||.016,.06);lastFrame=timestamp;
    if(!paused)elapsed+=delta;
    progress=mix(progress,desiredProgress,1-Math.exp(-delta*6));
    if(Math.abs(progress-desiredProgress)<.0002)progress=desiredProgress;
    smoothPointer.lerp(pointer,1-Math.exp(-delta*2.2));
    const t=elapsed, positions=home();
    groups.forEach((g,i)=>{
      const offset=i-progress,weight=1-ease(.14,.86,Math.abs(offset)),h=positions[i];
      g.visible=weight>.003;
      if(!g.visible)return;
      g.scale.setScalar(h.s*Math.max(.001,weight));
      g.position.set(h.x+offset*(mobile?1.5:3.8),h.y+(1-weight)*-.5,-(1-weight)*1.9);
      g.rotation.set(Math.sin(t*.29+i)*.018,h.ry+offset*.35+(reduced.matches?0:smoothPointer.x*.065),h.rz);
    });
    hero.position.y=.18+Math.sin(t*.85)*.085;hero.rotation.y=-.28+Math.sin(t*.32)*.11;hero.rotation.z=-.12+Math.sin(t*.28)*.018;
    finale.position.y=.18+Math.sin(t*.75)*.09;finale.rotation.y=-.16+Math.sin(t*.30)*.14;
    satellite.position.y=.84+Math.sin(t*.6)*.12;satellite2.position.y=-.51+Math.sin(t*.7+1)*.09;
    phone.position.y=Math.sin(t*.6)*.04;floatCard.position.y=-.47+Math.sin(t*.8+.8)*.075;floatCard.rotation.y=.09+Math.sin(t*.42)*.035;
    laptop.rotation.y=Math.sin(t*.30)*.025;laptopBall.position.y=-.74+Math.sin(t*.6)*.07;
    finaleSphere.position.y=.9+Math.sin(t*.67)*.12;
    dust.rotation.y=t*.009;
    const floorY=mobile?(.5-(innerHeight-58)/innerHeight)*(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*10.6)+.05:-1.91;
    floor.position.y=floorY;shadowFloor.position.y=floorY+.008;groundGlow.position.y=floorY+.015;
    const a=Math.floor(progress),b=Math.min(a+1,3),p=progress-a;
    groundGlow.position.x=mix(positions[a].x,positions[b].x,ease(0,1,p));
    groundGlow.material.opacity=.35+.35*(1-ease(0,.7,Math.min(Math.abs(progress),Math.abs(progress-3))));
    spot.target.position.set(groundGlow.position.x,-1,0);
    camera.position.set((reduced.matches?0:smoothPointer.x*.13)+Math.sin(progress*Math.PI)*.09,.6-(reduced.matches?0:smoothPointer.y*.07),mobile?10.6:10.25);
    camera.lookAt(0,.05,0);
    chapters.forEach((el,i)=>{const d=Math.abs(desiredProgress-i);el.querySelector('.copy').style.opacity=String(1-ease(.28,.85,d));});
    renderer.render(scene,camera);
    if(!document.body.classList.contains('ready')){document.body.classList.add('ready');document.body.classList.remove('fallback');$('#motion').hidden=false;}
    // Once per session, lower only the pixel count if a device cannot sustain the render.
    frameCount++;if(frameCount>20&&frameCount<120)averageFrame=mix(averageFrame,delta*1000,.05);
    if(frameCount===120&&averageFrame>31&&ratio>1){ratio=Math.max(1,ratio*.75);renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);}
    raf=requestAnimationFrame(draw);
  }
  function resize(){measure();scrollState();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
  window.addEventListener('resize',resize,{passive:true});
  if(document.fonts)document.fonts.ready.then(()=>{measure();scrollState();});
  document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible){lastFrame=performance.now();raf=requestAnimationFrame(draw);}else cancelAnimationFrame(raf);});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();visible=false;cancelAnimationFrame(raf);document.body.classList.add('fallback');document.body.classList.remove('ready');$('#motion').hidden=true;});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);},{once:true});
  raf=requestAnimationFrame(draw);
}
