import {Vector3,CatmullRomCurve3,MathUtils} from './vendor/three.module.min.js';

export const times=[0,.07,.16,.23,.30,.36,.44,.53,.60,.68,.73,.81,.88,.94,1];
const desktop=[
 [[.45,1.0,12],[-.7,.45,-2]],
 [[1.9,1.15,8.0],[.8,.35,-1]],
 [[4.8,.95,2.4],[1.2,.15,-3.8]],
 [[3.5,1.1,-4.4],[-.7,.35,-16]],
 [[2.7,.85,-6.6],[-3.0,.25,-18]],
 [[2.8,.65,-6.8],[-3.3,.2,-18]],
 [[3.5,.7,-8.8],[-2.5,.1,-18]],
 [[5.5,.9,-16.3],[-.2,.15,-20]],
 [[4.7,1.05,-23.0],[.9,.4,-33]],
 [[3.1,.8,-25.5],[2.1,.35,-34]],
 [[2.5,.7,-26.0],[2.0,.3,-34]],
 [[-3.5,.95,-31.0],[0,.3,-34.5]],
 [[-3.2,1.0,-39.0],[1.2,.5,-53]],
 [[.1,.9,-41.8],[-.9,.4,-54]],
 [[.45,.85,-42.3],[-.7,.35,-54]],
];
const portrait=[
 [[.45,1.6,17],[1.55,2.65,0]],
 [[2.1,1.3,12.2],[1.4,1.8,-1]],
 [[4.8,1.1,3.4],[.5,.4,-4]],
 [[4.6,1.1,-4.2],[-.8,2.25,-18]],
 [[-.1,1.35,-6.5],[-1,2.7,-18]],
 [[-.25,1.3,-6.8],[-1,2.7,-18]],
 [[1.6,1.0,-9.5],[-1,2.25,-18]],
 [[5.4,1.2,-16.2],[-.1,1.1,-23]],
 [[3.4,1.3,-22.6],[.2,2.6,-34]],
 [[.5,1.2,-23.4],[.65,2.25,-34]],
 [[.2,1.2,-23.8],[.65,2.25,-34]],
 [[-3.4,1.1,-31.0],[0,.8,-34.5]],
 [[-3.3,1.45,-36.5],[1.1,2.3,-54]],
 [[.2,1.6,-37.3],[1.6,3.1,-54]],
 [[.4,1.6,-37.7],[1.6,3.1,-54]],
];
function curves(data){return {position:new CatmullRomCurve3(data.map(k=>new Vector3(...k[0])),false,'centripetal'),target:new CatmullRomCurve3(data.map(k=>new Vector3(...k[1])),false,'centripetal')};}
const paths={desktop:curves(desktop),portrait:curves(portrait)};
export function sampleCamera(progress,isPortrait,position=new Vector3(),target=new Vector3()){
 const p=MathUtils.clamp(progress,0,1);let segment=0;while(segment<times.length-2&&p>times[segment+1])segment++;
 const local=(p-times[segment])/(times[segment+1]-times[segment]);
 const u=(segment+local)/(times.length-1),path=isPortrait?paths.portrait:paths.desktop;
 path.position.getPoint(u,position);path.target.getPoint(u,target);
 return {position,target};
}
