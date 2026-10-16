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
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=t=>t*t*(3-2*t);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function surfaceProfile(name,t){
 t=clamp(t,0,1);name=String(name||'').toLowerCase();
 if(name.includes('triple')||name.includes('ripple'))return Math.sin(t*Math.PI*3)**2;
 if(name.includes('roller'))return Math.sin(t*Math.PI);
 if(name.includes('kicker')||name.includes('up'))return smooth(t);
 if(name.includes('egg')||name.includes('wedge')||name.includes('down'))return 1-smooth(t);
 if(name.includes('flat')||name.includes('top'))return 1;
 return Math.sin(t*Math.PI)**2;
}
export function jumpProfile(samples,polygons=[],height=6,features=[],options={}){
 const surfaces=options.surfaces||[];
 if((!polygons.length&&!features.length&&!surfaces.length)||samples.length<2)return()=>0;
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
 const region=(polygon,direction)=>{
  const indices=samples.map((point,i)=>insidePolygon(point,polygon)?i:-1).filter(i=>i>=0);
  if(indices.length<2)return null;
  const first=indices[0],last=indices.at(-1),reverse=direction&&distance(samples[first],{x:direction[1][0],y:direction[1][1]})<distance(samples[first],{x:direction[0][0],y:direction[0][1]});
  return{from:first/(samples.length-1),to:last/(samples.length-1),reverse};
 };
 const elevated=features.map(feature=>{
  const takeoff=region(feature.takeoff),landing=region(feature.landing);
  return takeoff&&landing&&landing.from>takeoff.to?{...feature,takeoff,landing}:null;
 }).filter(Boolean);
 const shaped=surfaces.map(surface=>{const interval=region(surface.polygon,surface.direction);return interval?{...surface,interval}:null;}).filter(Boolean);
 const routeLengthMetres=Number(options.routeLengthMetres)||1,referenceHeightMetres=(Number(options.referenceHeightMm)||323)/1000,pixelsPerMetre=height/referenceHeightMetres;
 return(fraction,speedMps=8)=>{
  const f=((fraction%1)+1)%1;
  for(const feature of elevated){
   const {takeoff,landing}=feature;if(f<takeoff.from||f>landing.to)continue;
   const startHeight=(Number(feature.takeoffHeightMm)||217)/1000,endHeight=(Number(feature.landingHeightMm)||startHeight*1000)/1000;
   if(f<takeoff.to){const u=(f-takeoff.from)/(takeoff.to-takeoff.from);return surfaceProfile('kicker',u)*startHeight*pixelsPerMetre;}
   if(f<=landing.from){
    const gap=(landing.from-takeoff.to)*routeLengthMetres,x=(f-takeoff.to)*routeLengthMetres,speed=clamp(Number(speedMps)||8,2,25),flightTime=gap/speed,time=x/speed,gravity=Number(feature.gravity)||Number(options.gravity)||9.81;
    const verticalSpeed=(endHeight-startHeight+.5*gravity*flightTime*flightTime)/Math.max(.001,flightTime);
    return Math.max(0,startHeight+verticalSpeed*time-.5*gravity*time*time)*pixelsPerMetre;
   }
   const u=(f-landing.from)/(landing.to-landing.from);return surfaceProfile('down',u)*endHeight*pixelsPerMetre;
  }
  for(const surface of shaped){
   const {from,to,reverse}=surface.interval;if(f<from||f>to)continue;
   let u=(f-from)/(to-from);if(reverse)u=1-u;
   return surfaceProfile(surface.profile,u)*(Number(surface.heightMm)||referenceHeightMetres*1000)/1000*pixelsPerMetre;
  }
  const interval=intervals.find(([a,b])=>f>=a&&f<=b);
  if(!interval)return 0;
  const u=(f-interval[0])/(interval[1]-interval[0]);
  return height*Math.sin(Math.PI*u)**2;
 };
}

