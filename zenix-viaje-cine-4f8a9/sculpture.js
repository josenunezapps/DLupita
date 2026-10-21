import * as THREE from './vendor/three.module.min.js';

// A closed, solid metal ribbon. Shared vertices keep its rounded cross-section smooth.
export function createRibbon(points,material,width=.53,depth=.09){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
 const steps=150,sides=24,frames=curve.computeFrenetFrames(steps,false),positions=[],indices=[],colors=[];
 const light=new THREE.Color('#d4c4e3'),dark=new THREE.Color('#795094'),color=new THREE.Color();
 for(let i=0;i<=steps;i++){
   const t=i/steps,center=curve.getPointAt(t),roll=t*2.4+Math.sin(t*Math.PI*2)*.32;
   const n=frames.normals[i].clone().multiplyScalar(Math.cos(roll)).addScaledVector(frames.binormals[i],Math.sin(roll));
   const b=frames.binormals[i].clone().multiplyScalar(Math.cos(roll)).addScaledVector(frames.normals[i],-Math.sin(roll));
   for(let j=0;j<sides;j++){
     const a=j/sides*Math.PI*2,p=center.clone().addScaledVector(n,Math.cos(a)*width).addScaledVector(b,Math.sin(a)*depth);
     positions.push(...p);color.copy(dark).lerp(light,.30+Math.sin(t*Math.PI)*.7);colors.push(color.r,color.g,color.b);
   }
 }
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;indices.push(a,b,c,b,d,c);}
 for(const end of [0,steps]){const p=curve.getPointAt(end/steps),center=positions.length/3;positions.push(...p);colors.push(dark.r,dark.g,dark.b);for(let j=0;j<sides;j++){const a=end*sides+j,b=end*sides+(j+1)%sides;end===0?indices.push(center,b,a):indices.push(center,a,b);}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;return {mesh,curve};
}
