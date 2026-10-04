// Decorative lift depends only on route distance, so seeking and exports agree.
// It never changes the timing engine, car heading or centreline position.
export function insidePolygon(point,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[i],[bx,by]=polygon[j];
  if((ay>point.y)!=(by>point.y)&&point.x<(bx-ax)*(point.y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
export function jumpProfile(samples,polygons=[],height=6,features=[]){
 if((!polygons.length&&!features.length)||samples.length<2)return()=>0;
 const intervals=[];let start=null;
 for(let i=0;i<samples.length;i++){
  const active=polygons.some(p=>insidePolygon(samples[i],p));
  if(active&&start===null)start=i;
  if(start!==null&&(!active||i===samples.length-1)){
   const end=active?i:i-1;
   if(end>start)intervals.push([start/(samples.length-1),end/(samples.length-1)]);
   start=null;
  }
 }
 const region=polygon=>{
  const indices=samples.map((point,i)=>insidePolygon(point,polygon)?i:-1).filter(i=>i>=0);
  return indices.length>1?[indices[0]/(samples.length-1),indices.at(-1)/(samples.length-1)]:null;
 };
 const elevated=features.map(feature=>{
  const takeoff=region(feature.takeoff),landing=region(feature.landing);
  return takeoff&&landing&&landing[0]>takeoff[1]?{takeoff,landing}:null;
 }).filter(Boolean);
 return fraction=>{
  const f=((fraction%1)+1)%1;
  for(const {takeoff,landing} of elevated){
   if(f<takeoff[0]||f>landing[1])continue;
   if(f<takeoff[1]){const u=(f-takeoff[0])/(takeoff[1]-takeoff[0]);return height*Math.sin(Math.PI*u/2)**2;}
   if(f<=landing[0])return height;
   const u=(f-landing[0])/(landing[1]-landing[0]);return height*Math.cos(Math.PI*u/2)**2;
  }
  const interval=intervals.find(([a,b])=>f>=a&&f<=b);
  if(!interval)return 0;
  const u=(f-interval[0])/(interval[1]-interval[0]);
  return height*Math.sin(Math.PI*u)**2;
 };
}
