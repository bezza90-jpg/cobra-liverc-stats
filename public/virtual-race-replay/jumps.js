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
// Preserve the original 2D replay effect: a fixed-height hop based only on
// the drawn jump zones. The measured gravity model below remains available
// for the 3D replay and its ramp-specific motion.
export function legacyJumpProfile(samples,polygons=[],height=6,features=[]){
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
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=t=>t*t*(3-2*t);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function ballisticPeak(startHeight,endHeight,flightTime,gravity){
 const verticalSpeed=(endHeight-startHeight+.5*gravity*flightTime*flightTime)/Math.max(.001,flightTime),peakTime=clamp(verticalSpeed/gravity,0,flightTime);
 return startHeight+verticalSpeed*peakTime-.5*gravity*peakTime*peakTime;
}
function flightTimeForClearance(startHeight,endHeight,flightTime,gravity,minimumPeak){
 if(ballisticPeak(startHeight,endHeight,flightTime,gravity)>=minimumPeak)return flightTime;
 let low=flightTime,high=Math.max(.1,flightTime);
 while(high<4&&ballisticPeak(startHeight,endHeight,high,gravity)<minimumPeak)high*=1.25;
 for(let i=0;i<24;i++){
  const middle=(low+high)/2;
  if(ballisticPeak(startHeight,endHeight,middle,gravity)<minimumPeak)low=middle;else high=middle;
 }
 return high;
}
function surfaceProfile(name,t){
 t=clamp(t,0,1);name=String(name||'').toLowerCase();
 if(name.includes('ground'))return 0;
 if(name.includes('tabletop')&&name.includes('up'))return 1-Math.cos(t*Math.PI/2);
 if(name.includes('tabletop')&&name.includes('down'))return Math.cos(t*Math.PI/2);
 if(name.includes('roller-launch'))return Math.sin(t*Math.PI/2);
 if(name.includes('triple')||name.includes('ripple'))return Math.sin(t*Math.PI*3)**2;
 if(name.includes('roller'))return Math.sin(t*Math.PI);
 if(name.includes('linear')&&name.includes('up'))return t;
 if(name.includes('linear')&&name.includes('down'))return 1-t;
 if(name.includes('kicker')||name.includes('up'))return smooth(t);
 if(name.includes('egg')||name.includes('wedge')){
  const rise=name.includes('egg')?.2:.15;
  if(t<=rise)return smooth(t/rise);
  const u=(t-rise)/(1-rise);
  return name.includes('egg')?Math.pow(Math.cos(u*Math.PI/2),1.25):1-smooth(u);
 }
 if(name.includes('down'))return 1-smooth(t);
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
 const shaped=surfaces.map(surface=>{const interval=region(surface.polygon,surface.direction);return interval?{...surface,interval}:null;}).filter(Boolean);
 const rollerFlights=shaped.filter(surface=>surface.launchCars).map(surface=>{
  const crest=(surface.interval.from+surface.interval.to)/2,maxDistance=Math.max(.1,Number(surface.maximumFlightDistanceMetres)||2.4),landingFrom=crest+maxDistance/(Number(options.routeLengthMetres)||1),landingTo=Math.max(landingFrom+.0001,surface.interval.to);
  return{name:`${surface.name||'roller'}-flight`,takeoffRange:[surface.interval.from,crest],landingRange:[landingFrom,landingTo],takeoffProfile:'roller-launch',landingProfile:'ground',takeoffHeightMm:surface.heightMm,landingHeightMm:0,gravity:Number(surface.gravity)||9.81,speedFlightRatio:Number(surface.speedFlightRatio)||.08,minimumFlightDistanceMetres:Number(surface.minimumFlightDistanceMetres)||.72,maximumFlightDistanceMetres:maxDistance};
 });
 const elevated=[...features,...rollerFlights].map(feature=>{
  const takeoff=Array.isArray(feature.takeoffRange)?{from:Number(feature.takeoffRange[0]),to:Number(feature.takeoffRange[1]),reverse:false}:region(feature.takeoff),landing=Array.isArray(feature.landingRange)?{from:Number(feature.landingRange[0]),to:Number(feature.landingRange[1]),reverse:false}:region(feature.landing);
  return takeoff&&landing&&landing.from>takeoff.to?{...feature,takeoff,landing}:null;
 }).filter(Boolean);
 const routeLengthMetres=Number(options.routeLengthMetres)||1,referenceHeightMetres=(Number(options.referenceHeightMm)||323)/1000,pixelsPerMetre=height/referenceHeightMetres;
 return(fraction,speedMps=8)=>{
  const f=((fraction%1)+1)%1;
  for(const feature of elevated){
   const {takeoff,landing}=feature;if(f<takeoff.from||f>landing.to)continue;
   const takeoffHeight=Number(feature.takeoffHeightMm),landingHeight=Number(feature.landingHeightMm),startHeight=(Number.isFinite(takeoffHeight)?takeoffHeight:217)/1000,endHeight=(Number.isFinite(landingHeight)?landingHeight:startHeight*1000)/1000;
   const profileName=String(feature.takeoffProfile||feature.name||'').toLowerCase();
   if(f<takeoff.to){const u=(f-takeoff.from)/(takeoff.to-takeoff.from),takeoffShape=profileName.includes('roller')?'roller-launch':profileName.includes('tabletop')?profileName:'kicker';return surfaceProfile(takeoffShape,u)*startHeight*pixelsPerMetre;}
   const landingName=String(feature.landingProfile||'').toLowerCase(),isKicker=profileName.includes('kicker'),isTabletop=profileName.includes('tabletop'),roundedLander=landingName.includes('egg')||landingName.includes('wedge'),rise=landingName.includes('egg')?.2:.15,landNearEnd=isTabletop||feature.landingAtEnd,landingInset=Math.max(0,Number(feature.landingInsetMetres)||(isTabletop?.2:0)),touchdownProgress=Number(feature.touchdownProgress),hasTouchdownProgress=feature.touchdownProgress!==null&&feature.touchdownProgress!==undefined&&Number.isFinite(touchdownProgress),speed=clamp(Number(speedMps)||8,2,25),gravity=Number(feature.gravity)||Number(options.gravity)||9.81,launchRatio=Math.max(0,Number(feature.speedFlightRatio)||0),naturalTime=launchRatio?(speed*launchRatio+Math.sqrt((speed*launchRatio)**2+2*gravity*Math.max(0,startHeight-endHeight)))/gravity:0,naturalGap=speed*naturalTime,dynamicGap=launchRatio?clamp(naturalGap,Number(feature.minimumFlightDistanceMetres)||0,Number(feature.maximumFlightDistanceMetres)||Infinity):0,flightEnd=launchRatio?Math.min(landing.from,takeoff.to+dynamicGap/routeLengthMetres):hasTouchdownProgress?landing.from+(landing.to-landing.from)*clamp(touchdownProgress,0,1):landNearEnd?Math.max(landing.from,landing.to-landingInset/routeLengthMetres):roundedLander?landing.from+(landing.to-landing.from)*rise:landing.from;
   if(f<=flightEnd){
    const landingProgress=(flightEnd-landing.from)/Math.max(.000001,landing.to-landing.from),followsLandingProfile=isTabletop||landingName.includes('linear'),targetHeight=followsLandingProfile?surfaceProfile(feature.landingProfile||'down',landingProgress)*endHeight:endHeight,gap=(flightEnd-takeoff.to)*routeLengthMetres,x=(f-takeoff.to)*routeLengthMetres,viewScale=Math.max(1,Number(options.flightTimeScale)||1),specifiedScale=Number(feature.flightTimeScale),featureScale=specifiedScale>0?Math.max(.4,specifiedScale):isKicker?Math.max(1,Number(options.kickerFlightTimeScale)||1):isTabletop?Math.max(1,Number(options.tabletopFlightTimeScale)||1):1,minimumClearance=Math.max(0,Number(feature.minimumClearanceMetres)||(isTabletop?Number(options.tabletopMinimumClearanceMetres)||0:0)),baseFlightTime=gap/speed*viewScale*featureScale,flightTime=minimumClearance?flightTimeForClearance(startHeight,targetHeight,baseFlightTime,gravity,Math.max(startHeight,endHeight)+minimumClearance):baseFlightTime,time=x/Math.max(.001,gap)*flightTime;
    const verticalSpeed=(targetHeight-startHeight+.5*gravity*flightTime*flightTime)/Math.max(.001,flightTime);
    return Math.max(0,startHeight+verticalSpeed*time-.5*gravity*time*time)*pixelsPerMetre;
   }
   const u=(f-landing.from)/(landing.to-landing.from);return surfaceProfile(feature.landingProfile||'down',u)*endHeight*pixelsPerMetre;
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
