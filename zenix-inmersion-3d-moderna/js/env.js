import * as THREE from 'three';
import { PAL, rng, clamp, smooth } from './util.js';

// Entorno global de la experiencia: iluminación basada en imagen (un entorno por tipo de espacio), cielo nocturno,
// polvo atmosférico muy tenue, niebla controlada por capítulo y un rig mínimo de luces reales que cada escena orienta.
export function buildEnvironment(renderer, scene, Q) {
  const out = {};

  // ---------- Entornos PMREM: estudios de luz abstractos, uno por tipo de espacio (reflejos creíbles en metal/cristal)
  const pm = new THREE.PMREMGenerator(renderer);
  const dome = (top, hor, bot) => new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { t: { value: new THREE.Color(top) }, h: { value: new THREE.Color(hor) }, b: { value: new THREE.Color(bot) } },
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 d; uniform vec3 t,h,b; void main(){ float y = d.y; vec3 c = y > 0. ? mix(h, t, pow(y, .6)) : mix(h, b, pow(-y, .5)); gl_FragColor = vec4(c, 1.); }',
  }));
  const makeEnv = (spec) => {
    const s = new THREE.Scene();
    s.add(dome(...spec.dome));
    for (const [color, k, w, h, pos] of spec.panels) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
    }
    const rt = pm.fromScene(s, 0.02);
    return rt.texture;
  };
  out.envs = {
    // Noche exterior: cielo casi negro, horizonte violeta apagado, una luz fría alta (luna lejana) y un filo frío lateral.
    night: makeEnv({ dome: [0x040406, 0x16171c, 0x010102], panels: [
      [0xdfe6ff, 5.0, 12, 12, [-16, 24, 20]], [0x9aa3c8, 0.9, 70, 4, [0, 2, -32]], [0xcfd8ff, 2.0, 3, 24, [26, 10, -6]], [0xffffff, 1.2, 40, 3, [0, 4, 30]],
    ] }),
    // Estudio: caja de luz blanca difusa arriba, tiras laterales y un contraluz violeta contenido.
    studio: makeEnv({ dome: [0x1c1c20, 0x131316, 0x070708], panels: [
      [0xffffff, 3.6, 30, 30, [0, 26, 0]], [0xffffff, 2.4, 3, 20, [-24, 8, 0]], [0xffe8d4, 1.8, 3, 18, [24, 6, 6]], [0x8b5cff, 1.1, 24, 2.5, [0, -3, -26]], [0xdcd8ff, 1.2, 30, 3, [0, 3, 28]],
    ] }),
    // Nave industrial: luminarias lineales en el techo, rebote frío del suelo y un acento violeta lateral.
    industrial: makeEnv({ dome: [0x0f0f12, 0x0b0b0d, 0x1b1c22], panels: [
      [0xffffff, 3.4, 2, 40, [-8, 24, 0]], [0xffffff, 3.4, 2, 40, [0, 24, 0]], [0xffffff, 3.4, 2, 40, [8, 24, 0]],
      [0x8b5cff, 0.8, 2, 12, [-24, 4, 0]], [0x8b5cff, 0.8, 2, 12, [24, 4, 0]], [0xe9e8ff, 0.9, 30, 3, [0, 3, 28]],
    ] }),
    // Sala final: negro profundo, gran caja de luz violeta-blanca cenital y dos tiras verticales para columnas pulidas.
    hall: makeEnv({ dome: [0x050408, 0x07060b, 0x020204], panels: [
      [0xd6ccff, 3.4, 24, 24, [0, 30, -6]], [0xffffff, 2.6, 2.6, 28, [-22, 8, 0]], [0xffffff, 2.6, 2.6, 28, [22, 8, 0]], [0xb4b2c8, 0.5, 44, 3, [0, 0, -30]], [0xcfc6ff, 1.0, 30, 3, [0, 3, 28]],
    ] }),
  };
  pm.dispose();
  out.setEnv = (name) => { if (out.envName !== name) { out.envName = name; scene.environment = out.envs[name]; } };
  out.setEnv('night');
  if ('environmentIntensity' in scene) scene.environmentIntensity = 1;

  scene.background = new THREE.Color(0x050409);
  scene.fog = new THREE.FogExp2(0x07060c, 0.012);
  out.fog = scene.fog;

  // ---------- Cielo nocturno: degradado horizonte→cenit y estrellas finas (sin nebulosas): sobrio y creíble.
  const backMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uHor: { value: new THREE.Color(0x15161d) }, uZen: { value: new THREE.Color(0x020207) }, uStars: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform float uTime, uStars; uniform vec3 uHor, uZen;
      float h(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0., 1.);
        vec3 col = mix(uHor, uZen, pow(up, .45));
        col += uHor * 0.9 * exp(-pow(d.y * 7., 2.)) * (0.6 + 0.4 * smoothstep(-.4, .4, d.x));   // resplandor bajo el horizonte
        vec3 g = floor(d * 420.); float s = h(g);
        float st = step(.9985, s) * (.35 + .65 * h(g + 7.)) * smoothstep(.02, .25, d.y);
        col += vec3(.85,.88,1.) * st * uStars * (.65 + .35 * sin(uTime * .5 + s * 40.));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const back = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), backMat);
  back.frustumCulled = false; back.renderOrder = -10;
  scene.add(back);
  out.back = back; out.backMat = backMat;

  // ---------- Polvo atmosférico: partículas pequeñas, poco contrastadas, que solo se notan al cruzar haces de luz.
  const N = Q.particles;
  const r = rng(1234);
  const pos = new Float32Array(N * 3), size = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (r() - 0.5) * 70;
    pos[i * 3 + 1] = 0.5 + r() * 18;
    pos[i * 3 + 2] = 70 - r() * 700;
    size[i] = 0.5 + r() * r() * 1.8;
    ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 120 * (Q.dpr || 1) }, uTint: { value: new THREE.Color(0xcfc6ff) }, uAmt: { value: 0.6 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aPhase; uniform float uTime, uScale; varying float vA;
      void main(){
        vec3 p = position; p.x += sin(uTime*.12 + aPhase*6.283) * .6; p.y += cos(uTime*.1 + aPhase*12.9) * .5 + uTime*.02*aPhase;
        p.y = mod(p.y, 19.) + .3;
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        float d = -mv.z; gl_PointSize = clamp(aSize * uScale / max(d, .1), 1., 14.);
        vA = smoothstep(.6, 5., d) * (1. - smoothstep(60., 140., d));
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTint; uniform float uAmt; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); a *= a;
        gl_FragColor = vec4(uTint * a * vA * uAmt, a * vA * uAmt);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, pMat);
  pts.frustumCulled = false;
  scene.add(pts);
  out.particles = pts; out.pMat = pMat;

  // ---------- Rig de luces reales (cantidad constante para no recompilar shaders): relleno, luz de cámara, clave y dos acentos.
  const hemi = new THREE.HemisphereLight(0xc9c9d3, 0x0a0a0e, 0.25);
  const camLight = new THREE.PointLight(0xf1f1f4, 10, 30, 1.6);
  const key = new THREE.SpotLight(0xffffff, 0, 140, 0.85, 0.9, 1.4);
  const acc1 = new THREE.PointLight(0xffffff, 0, 60, 1.6);
  const acc2 = new THREE.PointLight(0x8b5cff, 0, 60, 1.6);
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  scene.add(hemi, camLight, key, key.target, acc1, acc2, sun, sun.target);
  if (Q.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.05;
    key.shadow.camera.near = 2; key.shadow.camera.far = 140;
  }
  out.lights = { hemi, camLight, key, acc1, acc2, sun };

  // Valores por defecto: cada escena los sobrescribe mientras es la protagonista.
  const _v = new THREE.Vector3();
  out.update = (cam, look, time, a) => {
    backMat.uniforms.uTime.value = time;
    pMat.uniforms.uTime.value = time;
    back.position.copy(cam.position);
    camLight.position.copy(cam.position).add(_v.set(0, 1.6, 2).applyQuaternion(cam.quaternion));
    hemi.intensity = a.hemi;
    camLight.intensity = a.camLight;
  };

  // Aplica la atmósfera interpolada del capítulo (niebla, fondo, exposición, entorno).
  out.applyAtmos = (a) => {
    scene.fog.color.setRGB(a.fog[0], a.fog[1], a.fog[2]);
    scene.fog.density = a.fogDensity;
    scene.background.setRGB(a.fog[0], a.fog[1], a.fog[2]);
    backMat.uniforms.uHor.value.setRGB(a.hor[0], a.hor[1], a.hor[2]);
    backMat.uniforms.uStars.value = a.stars;
    pMat.uniforms.uAmt.value = a.dust;
    if ('environmentIntensity' in scene) scene.environmentIntensity = a.envI;
    out.setEnv(a.env);
  };
  return out;
}
