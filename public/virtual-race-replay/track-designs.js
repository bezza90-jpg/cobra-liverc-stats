const RAMP_CATALOG={
 corner_tt_left:{width:2.44,parts:[[0,1.325,'tabletop-up',463,0,0],[1.325,2.44,'flat',446,0,0],[2.545,2.4,'tabletop-down',446,1.22,90]],flight:[0,2],flightTimeScale:.8,minimumClearanceMetres:.1,touchdownProgress:.12},
 corner_tt_right:{width:2.44,parts:[[0,1.325,'tabletop-up',463,0,0],[1.325,2.44,'flat',446,0,0],[2.545,2.4,'tabletop-down',446,-1.22,-90]],flight:[0,2],flightTimeScale:.8,minimumClearanceMetres:.1,touchdownProgress:.12},
 cnc_tt:{width:2.44,parts:[[0,1.325,'tabletop-up',463],[1.325,2.44,'flat',446],[3.765,2.442,'tabletop-down',446]],flight:[0,2]},
 cnc_tt_long_up:{width:2.44,parts:[[0,2.4,'tabletop-up',446],[2.4,2.44,'flat',446],[4.84,2.442,'tabletop-down',446]],flight:[0,2]},
 cnc_small:{width:2.44,parts:[[0,1.299,'roller',171]],rollerFlight:{speedFlightRatio:.06,minimumFlightDistanceMetres:.7,maximumFlightDistanceMetres:4.8}},
 cnc_big:{width:2.44,parts:[[0,1.584,'roller',276]]},
 cnc_kick:{width:2.44,parts:[[0,.667,'kicker',217]]},
 cnc_egg:{width:2.44,parts:[[0,2.317,'egg-lander',323]]},
 cnc_wedge:{width:2.44,parts:[[0,2.338,'wedge-lander',276]]},
 cnc_ripple:{width:2.44,parts:[[0,2.364,'triple-ripple',160]]},
 cnc_ttup:{width:2.44,parts:[[0,1.325,'tabletop-up',463]]},
 cnc_tttop:{width:2.44,parts:[[0,2.44,'flat',446]]},
 cnc_ttdown:{width:2.44,parts:[[0,2.442,'tabletop-down',446]]},
 cnc_k_egg:{width:2.44,parts:[[0,.667,'kicker',217],[2.167,2.317,'egg-lander',323]],flight:[0,1]},
 cnc_k_wedge:{width:2.44,parts:[[0,.667,'kicker',217],[2.167,2.338,'wedge-lander',276]],flight:[0,1]},
 trestle_12:{width:2.4,parts:[[0,1.2,'linear-up',396],[1.2,1.2,'flat',396],[2.4,2.4,'linear-down',396]]},
 trestle_24:{width:2.4,parts:[[0,1.2,'linear-up',396],[1.2,2.4,'flat',396],[3.6,2.4,'linear-down',396]]},
 trestle_36:{width:2.4,parts:[[0,1.2,'linear-up',396],[1.2,3.6,'flat',396],[4.8,2.4,'linear-down',396]]},
 trestle_48:{width:2.4,parts:[[0,1.2,'linear-up',396],[1.2,4.8,'flat',396],[6,2.4,'linear-down',396]]},
 jump_trestle_12:{width:2.44,parts:[[0,.667,'kicker',217],[2.167,1.2,'linear-up',396],[3.367,1.2,'flat',396],[4.567,2.4,'linear-down',396]],flight:[0,2],landingAtEnd:true,landingInsetMetres:.2,flightTimeScale:1.7,minimumClearanceMetres:1.05},
 jump_trestle_24:{width:2.44,parts:[[0,.667,'kicker',217],[2.167,1.2,'linear-up',396],[3.367,2.4,'flat',396],[5.767,2.4,'linear-down',396]],flight:[0,2],landingAtEnd:true,landingInsetMetres:.2,flightTimeScale:1.8,minimumClearanceMetres:1.25}
};

const routeLength=points=>points.reduce((total,point,index)=>{
 const next=points[(index+1)%points.length];return total+Math.hypot(next.x-point.x,next.y-point.y);
},0);

function transform(item,x,y){
 const angle=(Number(item.angle)||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return{x:Number(item.x)+x*c-y*s,y:Number(item.y)+x*s+y*c};
}

export function trackPlanFromDesign(input,base={}){
 if(!input||!Array.isArray(input.points)||input.points.length<8)throw Error('The published track design is incomplete.');
 const width=Number(input.carpet?.width||30),height=Number(input.carpet?.height||18);
 const toPlan=point=>[point.x/width*1000,(height-point.y)/height*650];
 const box=(item,offset,length,itemWidth)=>{
  const half=itemWidth/2,corners=[transform(item,offset,-half),transform(item,offset+length,-half),transform(item,offset+length,half),transform(item,offset,half)];
  return corners.map(toPlan);
 };
 const jumpSurfaces=[],jumpFeatures=[];
 for(const item of input.items||[]){
  const spec=RAMP_CATALOG[item.key];if(!spec)continue;
  const built=spec.parts.map(([offset,length,profile,heightMm,lateral=0,angleOffset=0])=>{
   const origin=transform(item,offset,lateral),piece={...item,x:origin.x,y:origin.y,angle:Number(item.angle||0)+angleOffset};
   const start=transform(piece,0,0),end=transform(piece,length,0);
   const rollerFlight=profile==='roller'&&spec.rollerFlight;
   const surface={name:item.key,profile,heightMm,polygon:box(piece,0,length,spec.width),direction:[toPlan(start),toPlan(end)],launchCars:Boolean(rollerFlight),speedFlightRatio:Number(rollerFlight?.speedFlightRatio)||0,minimumFlightDistanceMetres:Number(rollerFlight?.minimumFlightDistanceMetres)||0,maximumFlightDistanceMetres:Number(rollerFlight?.maximumFlightDistanceMetres)||0};
   jumpSurfaces.push(surface);return surface;
  });
  if(spec.flight){
   const takeoff=built[spec.flight[0]],landing=built[spec.flight[1]];
   jumpFeatures.push({name:item.key,takeoff:takeoff.polygon,landing:landing.polygon,takeoffProfile:takeoff.profile,landingProfile:landing.profile,takeoffHeightMm:takeoff.heightMm,landingHeightMm:landing.heightMm,gravity:9.81,landingAtEnd:Boolean(spec.landingAtEnd),landingInsetMetres:Number(spec.landingInsetMetres)||0,touchdownProgress:Number.isFinite(Number(spec.touchdownProgress))?Number(spec.touchdownProgress):null,flightTimeScale:Number(spec.flightTimeScale)||0,minimumClearanceMetres:Number(spec.minimumClearanceMetres)||0});
  }
 }
 const points=input.points.map(point=>toPlan({x:Number(point.x),y:Number(point.y)}));
 const loop=input.loop?toPlan({x:Number(input.loop.x),y:Number(input.loop.y)}):points[0];
 return {...base,
  eventId:String(input.eventId||base.eventId||''),
  date:String(input.eventDate||base.date||''),name:String(input.eventName||input.name||base.name||'COBRA track'),
  routeStatus:'confirmed',points,loopRoute:loop,jumpSurfaces,jumpFeatures,
  routeLengthMetres:Number(input.routeLengthMetres||base.routeLengthMetres)||routeLength(input.points),
  designVersion:Number(input.version??1)
 };
}

export function designFromTrackPlan(input){
 if(!input||!Array.isArray(input.points)||input.points.length<8)throw Error('A confirmed track route is required.');
 const width=30,height=18,toDesign=point=>({x:Number(point[0])/1000*width,y:height-Number(point[1])/650*height,w:1.2});
 const points=input.points.map(toDesign),first=points[0],next=points[1],heading=Math.atan2(next.y-first.y,next.x-first.x)*180/Math.PI;
 let length=0;for(let i=0;i<points.length;i++){const nextPoint=points[(i+1)%points.length];length+=Math.hypot(nextPoint.x-points[i].x,nextPoint.y-points[i].y);}
 return{
  version:0,flatReplay:true,name:String(input.name||'COBRA track'),eventDate:String(input.date||''),
  carpet:{width,height,ribbon:2.4},points,items:[],routeLengthMetres:Number(input.routeLengthMetres)||length,
  loop:{x:first.x,y:first.y,angle:heading+90,length:2.4}
 };
}

export const hasMeasuredJumpMotion=plan=>Number(plan?.designVersion)>0;

export {RAMP_CATALOG};
