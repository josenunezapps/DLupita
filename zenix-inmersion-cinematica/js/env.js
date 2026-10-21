import * as THREE from 'three';
import { PAL, rng } from './util.js';

// Entorno global: reflejos (PMREM), fondo de nebulosa, partículas en el espacio y rig de luces que acompaña a la cámara.
export function buildEnvironment(renderer, scene, Q) {
  const out = {};

  // --- Mapa de entorno personalizado: cuarto negro con paneles violeta/cian/blanco (para reflejos metálicos creíbles)
  const envScene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), new THREE.MeshBasicMaterial({ color: 0x07040f, side: THREE.BackSide }));
  envScene.add(room);
  const panel = (color, k, w, h, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); envScene.add(m);
  };
  panel(PAL.violet, 9, 18, 3, [-14, 10, -6], [0, 0, 0]);
  panel(PAL.cyan, 7, 3, 16, [16, 2, 4], [0, 0, 0]);
  panel(0xffffff, 6, 10, 4, [0, 22, 0], [0, 0, 0]);
  panel(PAL.electric, 5, 14, 2, [4, -6, -16], [0, 0, 0]);
  panel(0xcdbfff, 4, 2, 12, [-18, 0, 10], [0, 0, 0]);
  const pm = new THREE.PMREMGenerator(renderer);
  const envRT = pm.fromScene(envScene, 0.03);
  scene.environment = envRT.texture;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.9;
  pm.dispose();
  out.envRT = envRT;

  scene.background = new THREE.Color(PAL.bg);
  scene.fog = new THREE.FogExp2(0x070314, 0.0105);
  out.fog = scene.fog;

  // --- Fondo: nebulosa + estrellas, siempre centrado en la cámara (como si estuviera en el infinito)
  const backMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uProg: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform float uTime, uProg;
      float h(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float n(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float neb = fbm(d*2.4 + vec3(0., uProg*0.8, 0.));
        float neb2 = fbm(d*5.0 - vec3(3.1, uProg*0.5, 1.7));
        vec3 violet = vec3(.30,.10,.70), cyan = vec3(.04,.38,.62), deep = vec3(.012,.006,.045);
        vec3 col = deep + violet * smoothstep(.45,.9,neb) * .55 + cyan * smoothstep(.55,1.,neb2) * .22;
        // banda tipo vía láctea
        float band = exp(-pow(d.y*2.2 + .25*sin(d.x*3.), 2.) * 5.);
        col += vec3(.18,.08,.42) * band * .35 * (.4 + neb);
        // estrellas
        vec3 g = floor(d*260.); float s = h(g);
        float st = step(.9965, s) * (.4 + .6*h(g+7.));
        col += vec3(.8,.85,1.) * st * (.5 + .5*sin(uTime*.6 + s*40.));
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const back = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), backMat);
  back.frustumCulled = false; back.renderOrder = -10;
  scene.add(back);
  out.back = back; out.backMat = backMat;

  // --- Partículas: polvo de datos distribuido a lo largo de todo el recorrido
  const N = Q.particles;
  const r = rng(1234);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), ph = new Float32Array(N);
  const cV = new THREE.Color(PAL.electric), cC = new THREE.Color(PAL.cyan), cW = new THREE.Color(0xffffff);
  for (let i = 0; i < N; i++) {
    const z = 60 - Math.pow(r(), 1.0) * 640;
    const a = r() * Math.PI * 2;
    const rad = 2.6 + Math.pow(r(), 1.7) * 46;
    pos[i * 3] = Math.cos(a) * rad * 1.25;
    pos[i * 3 + 1] = 1.5 + Math.sin(a) * rad * 0.7;
    pos[i * 3 + 2] = z;
    const k = r();
    const c = k < 0.5 ? cV : k < 0.82 ? cC : cW;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    size[i] = 0.5 + r() * r() * 2.6;
    ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 160 * (Q.dpr || 1) } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute vec3 aColor; attribute float aPhase;
      uniform float uTime, uScale; varying vec3 vC; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime*.18 + aPhase*6.283) * .7;
        p.y += cos(uTime*.14 + aPhase*12.9) * .7;
        vec4 mv = modelViewMatrix * vec4(p,1.);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = clamp(aSize * uScale / max(d, .1), 1., 22.);
        vC = aColor;
        vA = smoothstep(.4, 4., d) * (1. - smoothstep(110., 230., d));
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - .5);
        float a = smoothstep(.5, .0, d); a *= a;
        gl_FragColor = vec4(vC * a * vA * 1.4, a * vA);
      }`,
  });
  const pts = new THREE.Points(g, pMat);
  pts.frustumCulled = false;
  scene.add(pts);
  out.particles = pts; out.pMat = pMat;

  // Haces atmosféricos físicos en espacio 3D (no filtros en pantalla): la cámara pasa entre ellos.
  // La transparencia baja y el depth test hacen que respeten objetos y profundidad.
  const shaftGeo = new THREE.CylinderGeometry(0.22, 5.2, 20, 20, 1, true);
  const makeShaftMat = (color) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW;
      void main() { vUv = uv; vW = (modelMatrix * vec4(position, 1.)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW; uniform float uTime; uniform vec3 uColor;
      void main() {
        float along = smoothstep(0., .18, vUv.y) * (1. - smoothstep(.66, 1., vUv.y));
        float folds = .86 + .14 * sin(vW.z * .37 + vUv.x * 18. + uTime * .22);
        float haze = along * folds * .09;
        gl_FragColor = vec4(uColor * haze, haze);
      }`,
  });
  const shaftMats = [makeShaftMat(PAL.violet), makeShaftMat(PAL.cyan)];
  const stations = [-86, -122, -181, -238, -285, -316, -367, -410, -487, -530];
  stations.forEach((z, i) => {
    if (Q.detail === 'low' && i % 2) return;
    for (const side of [-1, 1]) {
      const shaft = new THREE.Mesh(shaftGeo, shaftMats[(i + (side > 0 ? 1 : 0)) % 2]);
      shaft.position.set(side * (13 + (i % 3) * 2), 7.6, z);
      shaft.rotation.z = side * .12;
      shaft.renderOrder = 2;
      scene.add(shaft);
    }
  });

  // --- Rig de luces que acompaña a la cámara (iluminación local consistente en todos los capítulos)
  const hemi = new THREE.HemisphereLight(0x8f6dff, 0x07030f, 0.55);
  const camLight = new THREE.PointLight(0xcfdcff, 60, 46, 1.4);
  const aheadLight = new THREE.PointLight(0x8b4dff, 140, 60, 1.3);
  const rimLight = new THREE.PointLight(0x22d3ee, 70, 46, 1.4);
  scene.add(hemi, camLight, aheadLight, rimLight);
  out.lights = { hemi, camLight, aheadLight, rimLight };

  if (Q.shadows) {
    const sp = new THREE.SpotLight(0xd8c8ff, 420, 90, 0.75, 0.7, 1.3);
    sp.castShadow = true;
    sp.shadow.mapSize.set(1024, 1024);
    sp.shadow.bias = -0.0004;
    sp.shadow.normalBias = 0.04;
    sp.shadow.camera.near = 2; sp.shadow.camera.far = 100;
    scene.add(sp, sp.target);
    out.lights.spot = sp;
  }

  // Reutilizamos vectores temporales: mismo cálculo de luces, sin crear objetos en cada fotograma.
  const lightOffset = new THREE.Vector3();
  const spotOffset = new THREE.Vector3(0, 9, 4);
  out.update = (cam, look, time, prog, dt) => {
    backMat.uniforms.uTime.value = time;
    backMat.uniforms.uProg.value = prog;
    pMat.uniforms.uTime.value = time;
    shaftMats[0].uniforms.uTime.value = time;
    shaftMats[1].uniforms.uTime.value = time;
    back.position.copy(cam.position);
    camLight.position.copy(cam.position).add(lightOffset.set(0, 2.2, 3).applyQuaternion(cam.quaternion));
    rimLight.position.copy(cam.position).add(lightOffset.set(5.5, 3, -4).applyQuaternion(cam.quaternion));
    // La luz violeta se coloca delante del punto de mira (hacia la cámara) para que las caras visibles queden iluminadas
    aheadLight.position.copy(look).lerp(cam.position, Math.min(0.35, 14 / Math.max(1, look.distanceTo(cam.position))));
    if (out.lights.spot) {
      const sp = out.lights.spot;
      sp.position.copy(cam.position).add(spotOffset);
      sp.target.position.copy(look);
    }
  };
  return out;
}
