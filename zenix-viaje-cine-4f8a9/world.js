import * as THREE from './vendor/three.module.min.js';
import {Reflector} from './vendor/Reflector.js';
import {sampleCamera} from './camera-path.js';

const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export function createWorld(canvas){
  let portrait=innerWidth<=700;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,portrait?1.35:1.65));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#0c0811');scene.fog=new THREE.FogExp2('#0c0811',.023);
  const camera=new THREE.PerspectiveCamera(portrait?50:40,innerWidth/innerHeight,.08,115);
  const environmentScene=new THREE.Scene();environmentScene.background=new THREE.Color('#211825');
  function softbox(w,h,color,power,pos,ry=0,rx=0){const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));panel.position.set(...pos);panel.rotation.set(rx,ry,0);environmentScene.add(panel);}
  softbox(4,9,'#fff4eb',5,[-5,3,4],.7);softbox(2,8,'#d5c0ff',4,[5,1,2],-.8);softbox(9,3,'#fff9f7',5,[0,6,0],0,Math.PI/2);softbox(2,7,'#9b62d9',4,[-5,1,-4],-.4);softbox(4,5,'#ead3ff',2,[0,1,6]);
  const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(environmentScene,.025,.1,40);scene.environment=env.texture;scene.environmentIntensity=.85;pmrem.dispose();environmentScene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  const physical=p=>new THREE.MeshPhysicalMaterial(p);
  const mat={pearl:physical({color:'#d2bfeb',metalness:.72,roughness:.19,clearcoat:1,clearcoatRoughness:.12}),edge:physical({color:'#786286',metalness:.95,roughness:.17,clearcoat:1}),chrome:physical({color:'#bcb4c3',metalness:1,roughness:.2}),violet:physical({color:'#693a8f',metalness:.7,roughness:.22,clearcoat:1}),black:physical({color:'#141019',metalness:.65,roughness:.28,clearcoat:.8}),dark:physical({color:'#211a26',metalness:.55,roughness:.42}),stone:physical({color:'#322637',metalness:.3,roughness:.48}),light:new THREE.MeshBasicMaterial({color:'#dac7ee'}),accent:new THREE.MeshBasicMaterial({color:'#a373c7'})};
  scene.add(new THREE.AmbientLight('#d8c3e8',.52));
  const key=new THREE.DirectionalLight('#fff0e7',4.5);key.position.set(-4,7,6);scene.add(key);
  const fill=new THREE.DirectionalLight('#c3a1ef',2.6);fill.position.set(5,3,0);scene.add(fill);
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


  function logo(){const s=new THREE.Shape();s.moveTo(-1.21,1.22);s.lineTo(1.21,1.22);s.lineTo(1.21,.69);s.lineTo(-.24,-.66);s.lineTo(1.21,-.66);s.lineTo(1.21,-1.22);s.lineTo(-1.21,-1.22);s.lineTo(-1.21,-.69);s.lineTo(.24,.66);s.lineTo(-1.21,.66);s.closePath();const geo=new THREE.ExtrudeGeometry(s,{depth:.39,bevelEnabled:true,bevelThickness:.085,bevelSize:.085,bevelSegments:16,steps:1,curveSegments:24});geo.translate(0,0,-.195);const m=new THREE.Mesh(geo,[mat.pearl,mat.edge]);m.castShadow=true;m.receiveShadow=true;return m;}
  function plinth(w,d,h){const m=box(w,d,h,.16,mat.black);m.rotation.x=-Math.PI/2;m.position.y=-2.5+h/2+.025;return m;}
  function emblem(x,z){const g=new THREE.Group();g.position.set(x,0,z);const zed=logo();zed.scale.setScalar(1.75);zed.position.y=.13;zed.rotation.set(0,-.15,-.055);g.add(zed,plinth(5.5,2.8,.31));scene.add(g);return g;}
  const origin=emblem(1.8,0),finale=emblem(1.65,-54);origin.name='Origin';finale.name='Finale';
  const brandTexture=canvasTexture(1000,180,(c,w,h)=>{c.clearRect(0,0,w,h);txt(c,'zenix',320,133,133,'#d7c2e9',700);txt(c,'AR',650,131,45,'#a487bd',600);});
  [origin,finale].forEach(g=>{const name=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.47),new THREE.MeshBasicMaterial({map:brandTexture,transparent:true,toneMapped:false,depthWrite:false}));name.position.set(0,-2.35,1.445);g.add(name);});

  function doorway(z,width=12.6,height=8.2){
    const outer=rounded(width,height,.70),inner=rounded(width-.42,height-.42,.50);outer.holes.push(new THREE.Path(inner.getPoints(36).reverse()));
    const geo=new THREE.ExtrudeGeometry(outer,{depth:.35,bevelEnabled:true,bevelThickness:.065,bevelSize:.065,bevelSegments:5,curveSegments:22,steps:1});
    const arch=new THREE.Mesh(geo,mat.stone);arch.position.set(0,height/2-2.5,z);arch.castShadow=true;arch.receiveShadow=true;scene.add(arch);
    const stripShape=rounded(width-.12,height-.12,.64);stripShape.holes.push(new THREE.Path(rounded(width-.15,height-.15,.625).getPoints(36).reverse()));
    const strip=new THREE.Mesh(new THREE.ShapeGeometry(stripShape,30),mat.light);strip.position.set(0,height/2-2.5,z+.43);scene.add(strip);
  }
  doorway(-5);doorway(-25);doorway(-43);doorway(-60);
  for(const z of [-2,-14,-30,-49]){
    for(const side of [-1,1]){const wall=box(2.0,8.8,.62,.12,mat.dark);wall.position.set(side*8.0,1.9,z);wall.rotation.y=side*-.18;scene.add(wall);const lamp=new THREE.Mesh(new THREE.BoxGeometry(.035,6.7,.05),mat.accent);lamp.position.set(side*6.94,1.6,z+.35);scene.add(lamp);}
  }
  for(const x of [-4.35,4.35]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.017,.006,80),new THREE.MeshBasicMaterial({color:'#6b4d7e'}));rail.position.set(x,-2.486,-24);scene.add(rail);}

  // The browser remains at a fixed place in the gallery. Its six solid pieces assemble with scroll.
  const website=new THREE.Group();website.name='Website';website.position.set(-1.0,.2,-18);website.rotation.set(.015,.10,-.025);scene.add(website);
  const frame=box(7.55,4.80,.20,.15,mat.chrome);website.add(frame);
  const recess=box(7.39,4.64,.03,.10,mat.black);recess.position.z=.145;website.add(recess);
  const regions=[[0,0,1500,155],[0,155,760,565],[760,155,740,565],[0,720,500,210],[500,720,500,210],[1000,720,500,210]];
  const tiles=regions.map(([x,y,w,h],i)=>{
    const width=w/1500*7.20,height=h/930*4.46;
    const tile=new THREE.Group(),tileBody=box(width-.004,height-.004,.043,.003,mat.dark);tile.add(tileBody);
    const geometry=new THREE.PlaneGeometry(width+.001,height+.001),uv=geometry.attributes.uv;
    for(let j=0;j<uv.count;j++){uv.setXY(j,(x+uv.getX(j)*w)/1500,1-(y+(1-uv.getY(j))*h)/930);}
    const face=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:webTexture,toneMapped:false}));face.position.z=.05;tile.add(face);
    const home=new THREE.Vector3(-3.60+(x+w/2)/1500*7.20,2.23-(y+h/2)/930*4.46,.20);
    website.add(tile);return {tile,home,offset:new THREE.Vector3((i%2?-.7:1.0)*(1+i*.10),(i<3?.7:-.75),1.1+(i%3)*.45),delay:i*.009};
  });
  const webPlinth=plinth(6.9,2.0,.17);webPlinth.position.set(-1,-2.39,-18.2);scene.add(webPlinth);

  const phoneRoot=new THREE.Group();phoneRoot.name='Phone';phoneRoot.position.set(0,0,-34);scene.add(phoneRoot);
  const phone=new THREE.Group();phone.rotation.y=-.14;phoneRoot.add(phone);
  const shell=box(2.10,4.32,.27,.25,mat.chrome);phone.add(shell);
  const back=box(2.00,4.22,.045,.22,mat.violet);back.position.z=-.18;phone.add(back);
  const bezel=box(2.02,4.24,.024,.23,mat.black);bezel.position.z=.17;phone.add(bezel);
  const display=screen(1.88,3.99,.16,phoneTexture);display.position.z=.212;phone.add(display);
  const island=box(.62,.16,.018,.07,mat.black);island.position.set(0,1.83,.238);phone.add(island);
  const power=box(.04,.51,.08,.01,mat.chrome);power.position.set(1.085,.53,0);phone.add(power);
  const volume=box(.04,.44,.08,.01,mat.chrome);volume.position.set(-1.085,.72,0);phone.add(volume);
  for(const [x,y] of [[-.50,1.43],[-.12,1.03],[-.53,.75]]){const lens=new THREE.Mesh(new THREE.CylinderGeometry(.155,.155,.075,32),mat.black);lens.rotation.x=Math.PI/2;lens.position.set(x,y,-.257);phone.add(lens);const glass=new THREE.Mesh(new THREE.CircleGeometry(.114,32),physical({color:'#181126',metalness:.75,roughness:.08,clearcoat:1,side:THREE.DoubleSide}));glass.position.set(x,y,-.298);phone.add(glass);}
  const card=new THREE.Group();card.add(box(3.0,1.02,.095,.11,mat.edge));const cardFace=screen(2.94,.96,.08,cardTexture);cardFace.position.z=.081;card.add(cardFace);card.position.set(1.37,-.83,.85);card.rotation.set(.025,-.07,.045);phoneRoot.add(card);
  const phoneBase=plinth(4.7,2.3,.16);phoneBase.position.z=-34;scene.add(phoneBase);

  const shader={uniforms:THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),vertexShader:Reflector.ReflectorShader.vertexShader,fragmentShader:Reflector.ReflectorShader.fragmentShader
    .replace('vec4 base = texture2DProj( tDiffuse, vUv );',`vec2 uv=vUv.xy/vUv.w;vec2 d=vec2(.0015);vec4 base=texture2D(tDiffuse,uv)*.4; base+=texture2D(tDiffuse,uv+vec2(d.x,0.0))*.15; base+=texture2D(tDiffuse,uv-vec2(d.x,0.0))*.15; base+=texture2D(tDiffuse,uv+vec2(0.0,d.y))*.15; base+=texture2D(tDiffuse,uv-vec2(0.0,d.y))*.15;`)
    .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor=vec4(mix(vec3(.018,.011,.025),base.rgb,.22),1.0);')};
  const floor=new Reflector(new THREE.PlaneGeometry(60,110),{textureWidth:portrait?512:1024,textureHeight:portrait?512:1024,color:'#1d1424',clipBias:.003,multisample:0,shader});floor.rotation.x=-Math.PI/2;floor.position.set(0,-2.5,-23);scene.add(floor);
  const shadows=new THREE.Mesh(new THREE.PlaneGeometry(60,110),new THREE.ShadowMaterial({color:'#000000',opacity:.38}));shadows.rotation.x=-Math.PI/2;shadows.position.set(0,-2.493,-23);shadows.receiveShadow=true;scene.add(shadows);
  const particles=new Float32Array((portrait?65:110)*3);for(let i=0;i<particles.length/3;i++){const r=Math.sin(i*127.1+7)*43758.5453;particles[i*3]=(r-Math.floor(r)-.5)*14;particles[i*3+1]=((i*7.771)%1)*7-1.5;particles[i*3+2]=10-(i*3.347)%72;}
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(particles,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({size:.012,color:'#d4b9e7',transparent:true,opacity:.32,depthWrite:false}));scene.add(dust);
  const viewPosition=new THREE.Vector3(),viewTarget=new THREE.Vector3();let frameCount=0,average=16,ratio=renderer.getPixelRatio();
  function resize(){portrait=innerWidth<=700;camera.aspect=innerWidth/innerHeight;camera.fov=portrait?50:40;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);website.scale.setScalar(portrait?.58:.90);phoneRoot.scale.setScalar(portrait?.73:.90);}
  resize();
  function render(progress,time,pointer,delta,reduced){
    sampleCamera(progress,portrait,viewPosition,viewTarget);
    if(!reduced){viewPosition.x+=pointer.x*(portrait?0:.15);viewPosition.y+=pointer.y*(portrait?0:.065);}
    camera.position.copy(viewPosition);camera.lookAt(viewTarget);
    // No scene swaps: the same camera flies through the four physical installations.
    tiles.forEach(({tile,home,offset,delay},i)=>{const a=smooth(.225+delay,.345+delay,progress),n=1-a;tile.position.copy(home).addScaledVector(offset,n);tile.rotation.set(n*(i%2?.10:-.14),n*(i%2?-.16:.12),n*(i%2?.025:-.025));});
    phone.position.y=Math.sin(time*.55)*.035;card.position.y=-.83+Math.sin(time*.72+.6)*.05;card.rotation.y=-.07+Math.sin(time*.33)*.025;
    const lightingZ=mix(0,-54,smooth(0,1,progress));spot.position.set(-2.5,7,lightingZ+4);spot.target.position.set(0,-1,lightingZ-3);
    key.position.z=camera.position.z+3;key.target.position.set(0,0,camera.position.z-8);key.target.updateMatrixWorld();fill.position.z=camera.position.z-2;fill.target.position.set(0,0,camera.position.z-9);fill.target.updateMatrixWorld();
    renderer.render(scene,camera);
    frameCount++;if(frameCount>25&&frameCount<120)average=mix(average,delta*1000,.06);if(frameCount===120&&average>32&&ratio>1){ratio=Math.max(1,ratio*.75);renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);}
  }
  return {render,resize,camera,scene,renderer};
}
