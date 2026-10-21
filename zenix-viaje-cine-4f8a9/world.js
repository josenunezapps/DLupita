import * as THREE from './vendor/three.module.min.js';
import {Reflector} from './vendor/Reflector.js';
import {sampleCamera} from './camera-path.js?v=2';
import {createCinema} from './cinema.js?v=2';
import {createRibbon} from './sculpture.js?v=2';

const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export function createWorld(canvas){
  let portrait=innerWidth<=700;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,portrait?1.25:1.60));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#100c16');scene.fog=new THREE.FogExp2('#100c16',.027);
  const camera=new THREE.PerspectiveCamera(portrait?50:40,innerWidth/innerHeight,.08,115);
  const environmentScene=new THREE.Scene();environmentScene.background=new THREE.Color('#211825');
  function softbox(w,h,color,power,pos,ry=0,rx=0){const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));panel.position.set(...pos);panel.rotation.set(rx,ry,0);environmentScene.add(panel);}
  softbox(4,9,'#fff4eb',5,[-5,3,4],.7);softbox(2,8,'#d5c0ff',4,[5,1,2],-.8);softbox(9,3,'#fff9f7',5,[0,6,0],0,Math.PI/2);softbox(2,7,'#9b62d9',4,[-5,1,-4],-.4);softbox(4,5,'#ead3ff',2,[0,1,6]);
  const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(environmentScene,.025,.1,40);scene.environment=env.texture;scene.environmentIntensity=.85;pmrem.dispose();environmentScene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  const physical=p=>new THREE.MeshPhysicalMaterial(p);
  const mat={pearl:physical({color:'#d7cadf',metalness:.82,roughness:.17,clearcoat:1,clearcoatRoughness:.12}),edge:physical({color:'#786286',metalness:.95,roughness:.17,clearcoat:1}),chrome:physical({color:'#bcb4c3',metalness:1,roughness:.2}),violet:physical({color:'#693a8f',metalness:.7,roughness:.22,clearcoat:1}),black:physical({color:'#141019',metalness:.65,roughness:.28,clearcoat:.8}),dark:physical({color:'#211a26',metalness:.55,roughness:.42}),stone:physical({color:'#322637',metalness:.3,roughness:.48}),light:new THREE.MeshBasicMaterial({color:'#dac7ee'}),accent:new THREE.MeshBasicMaterial({color:'#a373c7'})};
  scene.add(new THREE.AmbientLight('#d8c3e8',.42));
  const key=new THREE.DirectionalLight('#fff0e7',3.6);key.position.set(-4,7,6);scene.add(key);
  const fill=new THREE.DirectionalLight('#c3a1ef',1.9);fill.position.set(5,3,0);scene.add(fill);
  const rim=new THREE.DirectionalLight('#9455c1',3.1);rim.position.set(-2,3,-6);scene.add(rim);
  const spot=new THREE.SpotLight('#f3e3ff',80,30,Math.PI*.27,.85,1.1);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.00035;spot.shadow.normalBias=.03;scene.add(spot,spot.target);

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


  function extruded(shape,depth=.39){const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.085,bevelSize:.085,bevelSegments:16,steps:1,curveSegments:24});geo.translate(0,0,-depth/2);const m=new THREE.Mesh(geo,[mat.pearl,mat.edge]);m.castShadow=true;m.receiveShadow=true;return m;}
  function logo(){const s=new THREE.Shape();s.moveTo(-1.21,1.22);s.lineTo(1.21,1.22);s.lineTo(1.21,.69);s.lineTo(-.24,-.66);s.lineTo(1.21,-.66);s.lineTo(1.21,-1.22);s.lineTo(-1.21,-1.22);s.lineTo(-1.21,-.69);s.lineTo(.24,.66);s.lineTo(-1.21,.66);s.closePath();return extruded(s);}
  function plinth(w,d,h){const m=box(w,d,h,.16,mat.black);m.rotation.x=-Math.PI/2;m.position.y=-2.5+h/2+.025;return m;}
  function emblem(x,z){const g=new THREE.Group();g.position.set(x,0,z);const zed=logo();zed.scale.setScalar(1.82);zed.position.y=.18;zed.rotation.set(.02,-.17,-.055);g.add(zed,plinth(5.5,2.8,.31));scene.add(g);return g;}
  const origin=emblem(1.8,0);origin.name='Origin';
  const ribbonMaterial=physical({color:'#eee4f4',metalness:.94,roughness:.18,clearcoat:1,clearcoatRoughness:.1,vertexColors:true,side:THREE.FrontSide});
  const aurora=createRibbon([[.6,-1.9,-3.1],[1.0,.5,-3.2],[2.4,3.45,-3.7],[5.3,3.0,-4.1],[6.1,.7,-3.8],[5.7,-2.0,-3.0]],ribbonMaterial,.63,.10);aurora.mesh.name='Aurora';scene.add(aurora.mesh);
  const rake=new THREE.PointLight('#e5c7ff',18,12,2);scene.add(rake);

  const finale=new THREE.Group();finale.name='Finale';finale.position.set(1.65,0,-54);scene.add(finale);
  const finalMark=new THREE.Group();finalMark.scale.setScalar(1.82);finalMark.position.y=.18;finalMark.rotation.set(.02,-.14,-.055);finale.add(finalMark,plinth(5.5,2.8,.31));
  const finalParts=[];
  for(const points of [[[-1.21,.68],[1.21,.68],[1.21,1.22],[-1.21,1.22]],[[.24,.68],[1.21,.68],[-.24,-.68],[-1.21,-.68]],[[-1.21,-1.22],[1.21,-1.22],[1.21,-.68],[-1.21,-.68]]]){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const part=extruded(s);finalMark.add(part);finalParts.push(part);}
  const brandTexture=canvasTexture(1000,180,(c,w,h)=>{c.clearRect(0,0,w,h);txt(c,'zenix',320,133,133,'#e5d8ef',700);txt(c,'AR',650,131,45,'#c3a3d8',600);});
  for(const group of [origin,finale]){const plate=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.47),new THREE.MeshBasicMaterial({map:brandTexture,transparent:true,toneMapped:false,depthWrite:false}));plate.position.set(0,-2.35,1.445);group.add(plate);}
  const finalRibbon=createRibbon([[-2,-1.7,-57],[-1.4,1.7,-57.5],[2,3.3,-58],[5.4,1.7,-58],[5.8,-1.8,-57]],ribbonMaterial,.45,.075);scene.add(finalRibbon.mesh);

  // The same solid object grows from a website into a mobile app as the camera moves around it.
  const device=new THREE.Group();device.name='Device';scene.add(device);
  const shell=box(1,1,.25,.062,mat.chrome);device.add(shell);
  const back=box(1,1,.035,.06,mat.violet);back.position.z=-.17;device.add(back);
  const bezel=box(1,1,.027,.062,mat.black);bezel.position.z=.164;device.add(bezel);
  const displayGeo=new THREE.ShapeGeometry(rounded(1,1,.058),28);const pos=displayGeo.attributes.position,uv=displayGeo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)+.5,pos.getY(i)+.5);
  const displayMaterial=new THREE.ShaderMaterial({uniforms:{web:{value:webTexture},app:{value:phoneTexture},morph:{value:0}},toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform sampler2D web,app;uniform float morph;varying vec2 vUv;void main(){float axis=vUv.y*.85+vUv.x*.15;float edge=morph*1.3-.15;float a=smoothstep(-.15,.15,edge-axis);vec3 color=mix(texture2D(web,vUv).rgb,texture2D(app,vUv).rgb,a);float seam=(1.0-smoothstep(.0,.018,abs(edge-axis)))*sin(morph*3.14159265);color+=vec3(.26,.15,.36)*seam*.48;gl_FragColor=vec4(color,1.0);}'});
  const display=new THREE.Mesh(displayGeo,displayMaterial);display.position.z=.216;device.add(display);
  const island=box(.62,.16,.025,.065,mat.black);island.position.z=.242;device.add(island);
  const power=box(.038,.50,.08,.01,mat.chrome),volume=box(.038,.44,.08,.01,mat.chrome);device.add(power,volume);
  const lenses=new THREE.Group();device.add(lenses);
  for(const [x,y] of [[-.50,1.43],[-.12,1.03],[-.53,.75]]){const ring=new THREE.Mesh(new THREE.CylinderGeometry(.155,.155,.075,32),mat.chrome);ring.rotation.x=Math.PI/2;ring.position.set(x,y,-.245);lenses.add(ring);const lens=new THREE.Mesh(new THREE.CircleGeometry(.12,32),physical({color:'#120e1b',metalness:.65,roughness:.07,clearcoat:1,side:THREE.DoubleSide}));lens.position.set(x,y,-.289);lenses.add(lens);}
  const card=new THREE.Group();card.add(box(2.9,1.01,.085,.11,mat.edge));const cardFace=screen(2.84,.95,.08,cardTexture);cardFace.position.z=.077;card.add(cardFace);card.rotation.set(.015,-.08,.045);device.add(card);

  const wings=[];
  for(const side of [-1,1]){
    const hinge=new THREE.Group(),geometry=new THREE.PlaneGeometry(3.60,4.46),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)+(side>0?1:0))*.5);
    const front=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:webTexture,toneMapped:false,side:THREE.DoubleSide}));front.position.set(side*1.80,0,.222);
    const backing=box(3.60,4.46,.035,.008,mat.edge);backing.position.set(side*1.80,0,.19);hinge.add(backing,front);device.add(hinge);wings.push({hinge,side});
  }

  // Two framed interface layers peel away and reunite before the device changes format.
  const layers=[];
  for(let i=0;i<2;i++){const mesh=box(7.4-i*.13,4.62-i*.09,.045,.18,physical({color:i?'#4b2f60':'#88609d',metalness:.86,roughness:.23,clearcoat:1}));mesh.name='Interface layer';scene.add(mesh);layers.push(mesh);}

  const shader={uniforms:THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),vertexShader:Reflector.ReflectorShader.vertexShader,fragmentShader:Reflector.ReflectorShader.fragmentShader
    .replace('vec4 base = texture2DProj( tDiffuse, vUv );',`vec2 uv=vUv.xy/vUv.w;vec2 d=vec2(.0018);vec4 base=texture2D(tDiffuse,uv)*.4;base+=texture2D(tDiffuse,uv+vec2(d.x,0.0))*.15;base+=texture2D(tDiffuse,uv-vec2(d.x,0.0))*.15;base+=texture2D(tDiffuse,uv+vec2(0.0,d.y))*.15;base+=texture2D(tDiffuse,uv-vec2(0.0,d.y))*.15;`)
    .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor=vec4(mix(vec3(.020,.013,.028),base.rgb,.20),1.0);')};
  const floor=new Reflector(new THREE.PlaneGeometry(60,110),{textureWidth:portrait?512:1024,textureHeight:portrait?512:1024,color:'#211629',clipBias:.003,multisample:0,shader});floor.rotation.x=-Math.PI/2;floor.position.set(0,-2.5,-23);floor.name='Floor';scene.add(floor);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(60,110),new THREE.ShadowMaterial({color:'#000000',opacity:.40}));shadow.rotation.x=-Math.PI/2;shadow.position.set(0,-2.493,-23);shadow.receiveShadow=true;scene.add(shadow);
  const haloTexture=canvasTexture(128,128,(c)=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(196,143,238,.30)');g.addColorStop(.45,'rgba(137,81,173,.12)');g.addColorStop(1,'rgba(80,45,110,0)');c.fillStyle=g;c.fillRect(0,0,128,128);});
  for(const [x,z,scale] of [[1.8,0,7],[0,-28,8],[1.65,-54,7]]){const h=new THREE.Mesh(new THREE.PlaneGeometry(scale,scale),new THREE.MeshBasicMaterial({map:haloTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));h.rotation.x=-Math.PI/2;h.position.set(x,-2.485,z);scene.add(h);}
  const positions=new Float32Array((portrait?48:80)*3);for(let i=0;i<positions.length/3;i++){const r=Math.sin(i*127.1+7)*43758.5453;positions[i*3]=(r-Math.floor(r)-.5)*14;positions[i*3+1]=((i*7.771)%1)*7-1.5;positions[i*3+2]=10-(i*3.347)%72;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));scene.add(new THREE.Points(dustGeometry,new THREE.PointsMaterial({size:.010,color:'#deccec',transparent:true,opacity:.25,depthWrite:false})));
  const cinema=createCinema(renderer),viewPosition=new THREE.Vector3(),viewTarget=new THREE.Vector3(),focusPoint=new THREE.Vector3(),focusView=new THREE.Vector3();
  let frameCount=0,average=16,ratio=renderer.getPixelRatio();
  function resize(){portrait=innerWidth<=700;camera.aspect=innerWidth/innerHeight;camera.fov=portrait?50:40;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);cinema.resize();}
  resize();
  function render(progress,time,pointer,delta,reduced){
    sampleCamera(progress,portrait,viewPosition,viewTarget);
    if(!reduced){viewPosition.x+=pointer.x*(portrait?0:.12);viewPosition.y+=pointer.y*(portrait?0:.05);}
    camera.position.copy(viewPosition);camera.lookAt(viewTarget);camera.updateMatrixWorld();
    const morph=smooth(.47,.645,progress),travel=smooth(.43,.66,progress),width=mix(7.55,2.10,morph),height=mix(4.80,4.32,morph),size=mix(portrait?.53:.86,portrait?.70:.85,morph);
    device.position.set(mix(-1,0,travel),mix(.2,.03,travel),mix(-18,-34,travel));device.scale.setScalar(size);device.rotation.set(.015+Math.sin(morph*Math.PI)*.12,.10+Math.sin(morph*Math.PI)*1.1-morph*.24,-.025-Math.sin(morph*Math.PI)*.16-morph*.035);
    shell.scale.set(width,height,1);back.scale.set(width-.085,height-.085,1);bezel.scale.set(width-.075,height-.075,1);display.scale.set(width-.22,height-.22,1);displayMaterial.uniforms.morph.value=morph;
    island.scale.setScalar(Math.max(.001,morph));island.position.y=height/2-.30;power.scale.setScalar(Math.max(.001,morph));volume.scale.copy(power.scale);power.position.set(width/2+.035,.5,0);volume.position.set(-width/2-.035,.7,0);lenses.scale.setScalar(Math.max(.001,morph));
    const cardAmount=smooth(.64,.685,progress)*(1-smooth(.79,.83,progress));card.visible=cardAmount>.002;card.scale.setScalar(Math.max(.001,cardAmount));card.position.set(1.32,-.83+Math.sin(time*.65)*.04,.86);
    wings.forEach(({hinge,side})=>{hinge.visible=morph>.002&&morph<.60;hinge.rotation.y=-side*smooth(0,.6,morph)*Math.PI*.72;hinge.scale.x=1-smooth(.12,.6,morph)*.95;});
    const spread=(1-smooth(.26,.37,progress))*.75;
    layers.forEach((m,i)=>{m.visible=progress<.47;m.scale.setScalar(portrait?.58:.9);m.position.copy(device.position).add(new THREE.Vector3((i?1:-1)*spread*.55,spread*(i?.35:-.35),-.18-(i+1)*(.10+spread*.40)));m.rotation.copy(device.rotation);});
    const offsets=[[.55,.65,.55],[-1.0,.12,-.7],[.45,-.45,.4]];
    finalParts.forEach((part,i)=>{const n=1-smooth(.855+i*.012,.930+i*.012,progress);part.position.set(offsets[i][0]*n,offsets[i][1]*n,offsets[i][2]*n);part.rotation.y=n*(i-1)*.12;});
    rake.position.copy(aurora.curve.getPointAt(.47+Math.sin(time*.24)*.18));rake.position.z+=1.3;
    const lightingZ=mix(0,-54,smooth(0,1,progress));spot.position.set(-2.5,7,lightingZ+4);spot.target.position.set(0,-1,lightingZ-3);
    key.position.z=camera.position.z+3;key.target.position.set(0,0,camera.position.z-8);key.target.updateMatrixWorld();fill.position.z=camera.position.z-2;fill.target.position.set(0,0,camera.position.z-9);fill.target.updateMatrixWorld();
    focusPoint.copy(progress<.23?origin.position:progress<.84?device.position:finale.position);focusView.copy(focusPoint).applyMatrix4(camera.matrixWorldInverse);
    cinema.render(scene,camera,Math.max(2,-focusView.z),time,portrait);
    frameCount++;if(frameCount>25&&frameCount<120)average=mix(average,delta*1000,.06);if(frameCount===120&&average>32&&ratio>1){ratio=Math.max(1,ratio*.75);renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);cinema.resize();}
  }
  return {render,resize,camera,scene,renderer};
}
