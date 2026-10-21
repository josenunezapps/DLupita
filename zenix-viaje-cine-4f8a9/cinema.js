import * as THREE from './vendor/three.module.min.js';

export function createCinema(renderer){
  const gl=renderer.getContext();
  const counts=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES));
  const samples=counts.find(n=>n<=(innerWidth<=700?2:4))||0;
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples,depthBuffer:true});
  target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const uniforms={image:{value:target.texture},depthImage:{value:target.depthTexture},near:{value:.08},far:{value:115},focus:{value:12},aspect:{value:1},time:{value:0},blur:{value:.65},pixelHeight:{value:900}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:`
      uniform sampler2D image,depthImage;
      uniform float near,far,focus,aspect,time,blur,pixelHeight;
      varying vec2 vUv;
      float depthAt(vec2 uv){float d=texture2D(depthImage,uv).r;return near*far/(far-(far-near)*d);}
      float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        float distance=depthAt(vUv);
        float coc=clamp(abs(distance-focus)/max(distance,.01)*.014,0.0,.007)*blur;
        coc=max(coc,.30/pixelHeight);
        vec3 c=texture2D(image,vUv).rgb*.28;
        for(int i=0;i<8;i++){
          float a=float(i)*.78539816;
          vec2 offset=vec2(cos(a)/aspect,sin(a))*coc;
          c+=texture2D(image,clamp(vUv+offset,vec2(.001),vec2(.999))).rgb*.09;
        }
        vec2 edge=(vUv-.5)*vec2(.9,1.0);
        c*=1.0-smoothstep(.25,.71,length(edge))*.19;
        c+=(noise(gl_FragCoord.xy+floor(time*24.0))-.5)*.0015;
        gl_FragColor=vec4(max(c,0.0),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  const size=new THREE.Vector2();
  function resize(){renderer.getDrawingBufferSize(size);target.setSize(size.x,size.y);uniforms.aspect.value=size.x/size.y;uniforms.pixelHeight.value=size.y;}
  resize();
  return {resize,render(world,view,focus,time,portrait){
    uniforms.focus.value=focus;uniforms.time.value=time;uniforms.near.value=view.near;uniforms.far.value=view.far;uniforms.blur.value=portrait?.32:.68;
    renderer.setRenderTarget(target);renderer.clear();renderer.render(world,view);renderer.setRenderTarget(null);renderer.render(scene,camera);
  }};
}
