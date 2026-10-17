import test from 'node:test';
import assert from 'node:assert/strict';
import {jumpProfile} from '../public/virtual-race-replay/jumps.js';
import {prepare,visualFraction} from '../public/virtual-race-replay/engine.js';
import {paceMap} from '../public/virtual-race-replay/pace.js';
import {trackPlanFromDesign,designFromTrackPlan,hasMeasuredJumpMotion} from '../public/virtual-race-replay/track-designs.js';
import {readFile} from 'node:fs/promises';
import {analyseAvatarPixels,avatarThumbnailPath,avatarColourOverride} from '../public/virtual-race-replay/avatar-colours.js';
const samples=Array.from({length:101},(_,i)=>({x:i,y:0}));
const zones=[[[20,-5],[40,-5],[40,5],[20,5]]];
test('jump is bounded, smooth at entry/exit and absent on ordinary track',()=>{
 const lift=jumpProfile(samples,zones);
 assert.equal(lift(.1),0);assert.equal(lift(.5),0);assert.equal(lift(.2),0);
 assert(Math.abs(lift(.39))<1e-10);assert(lift(.3)>5.9);
 for(let i=0;i<=1000;i++)assert(lift(i/1000)>=0&&lift(i/1000)<=6);
 assert.equal(lift(.3),lift(1.3));assert.equal(jumpProfile(samples)(.3),0);
});
test('local lift rotates with car orientation and preserves recorded crossings',()=>{
 const lift=jumpProfile(samples,zones)(.3);
 const worldOffset=angle=>({x:lift*Math.sin(angle),y:-lift*Math.cos(angle)});
 assert(worldOffset(0).y<0);assert(worldOffset(Math.PI).y>0);
 assert(worldOffset(Math.PI/2).x>0);assert(worldOffset(-Math.PI/2).x<0);
 const driver=prepare({laps:[{seconds:12},{seconds:15},{seconds:16}]});
 const pace=paceMap(samples,{mainStraight:{from:{x:0,y:0},to:{x:100,y:0}},straightSpeed:1.65});
 for(const t of driver.crossings){const distance=visualFraction(driver,t,pace);jumpProfile(samples,zones)(distance);assert.equal(distance,0);}
});

test('kicker stays elevated through the gap and lowers only on the landing ramp',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]];
 const lift=jumpProfile(samples,[],6,[{takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:217,landingHeightMm:323}],{routeLengthMetres:100});
 assert.equal(lift(.2),0);assert(lift(.23)>0&&lift(.23)<6);
 assert(lift(.35,8)>lift(.26,8));assert(lift(.45,8)>lift(.26,8));
 assert(lift(.55)>0&&lift(.55)<6);assert(Math.abs(lift(.6))<1e-10);
 assert.equal(lift(.7),0);assert.equal(lift(.35),lift(1.35));
});

test('airborne arc accelerates downward at 9.81 metres per second squared',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],lift=jumpProfile(samples,[],323,[{takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:217,landingHeightMm:323,gravity:9.81}],{routeLengthMetres:10,referenceHeightMm:323});
 const speed=5,dt=.1,at=x=>lift(.26+x/10,speed)/1000;
 const secondDifference=at(speed*dt*2)-2*at(speed*dt)+at(0);
 assert(Math.abs(secondDifference+9.81*dt*dt)<1e-6);
});

test('3D kicker boost raises the middle of the flight without moving either landing point',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],feature={name:'kicker-and-lander',takeoffProfile:'kicker',takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:217,landingHeightMm:323,gravity:9.81};
 const normal=jumpProfile(samples,[],323,[feature],{routeLengthMetres:10,referenceHeightMm:323});
 const higher=jumpProfile(samples,[],323,[feature],{routeLengthMetres:10,referenceHeightMm:323,kickerFlightTimeScale:1.55});
 assert(higher(.38,8)>normal(.38,8));
 assert.equal(higher(.25,8),normal(.25,8));assert(Math.abs(higher(.50,8)-normal(.50,8))<1e-9);
});

test('trestle kicker rule keeps cars clearly airborne and lands near the far end',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],feature={name:'jump_trestle_24',takeoffProfile:'kicker',takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:217,landingHeightMm:396,gravity:9.81,flightTimeScale:1.8,minimumClearanceMetres:1.25,landingAtEnd:true,landingInsetMetres:.2};
 const lift=jumpProfile(samples,[],396,[feature],{routeLengthMetres:10,referenceHeightMm:396,kickerFlightTimeScale:1.55});
 let peak=0;for(let fraction=.26;fraction<=.5;fraction+=.001)peak=Math.max(peak,lift(fraction,16));
 assert(peak>=1.64,'cars should visibly clear the trestle throughout the long flight');assert.equal(lift(.2,16),0);assert(lift(.58,16)>0);assert.equal(lift(.61,16),0);
});

test('3D tabletop flight clears the down ramp and touches down 20 cm before its end',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],feature={name:'cnc_tt',takeoffProfile:'tabletop-up',takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:463,landingHeightMm:446,gravity:9.81};
 const normal=jumpProfile(samples,[],323,[feature],{routeLengthMetres:10,referenceHeightMm:323});
 const higher=jumpProfile(samples,[],323,[feature],{routeLengthMetres:10,referenceHeightMm:323,tabletopFlightTimeScale:1.8,tabletopMinimumClearanceMetres:.65});
 assert(higher(.38,8)>normal(.38,8));
 assert(higher(.40,8)>850,'tabletop arc should visibly clear the flat top');
 assert(higher(.40,16)>1000,'a fast car must still leave a visible gap above the tabletop');
 assert(higher(.55,8)>0);assert(higher(.58,8)>higher(.60,8));assert.equal(higher(.25,8),normal(.25,8));assert(Math.abs(higher(.61,8))<1e-9);assert.equal(higher(.62,8),0);
});

test('2D tabletop uses a slightly lower arc without changing its touchdown',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],feature={name:'cnc_tt',takeoffProfile:'tabletop-up',landingProfile:'tabletop-down',takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:463,landingHeightMm:446,gravity:9.81};
 const original=jumpProfile(samples,[],50,[feature],{routeLengthMetres:10,referenceHeightMm:323,tabletopFlightTimeScale:1.8,tabletopMinimumClearanceMetres:.65});
 const tuned=jumpProfile(samples,[],50,[feature],{routeLengthMetres:10,referenceHeightMm:323,tabletopFlightTimeScale:1.65,tabletopMinimumClearanceMetres:.55});
 let originalPeak=0,tunedPeak=0;for(let fraction=.26;fraction<=.61;fraction+=.001){originalPeak=Math.max(originalPeak,original(fraction,8));tunedPeak=Math.max(tunedPeak,tuned(fraction,8));}
 assert(tunedPeak<originalPeak*.93&&tunedPeak>originalPeak*.88,'2D tabletop peak should be around nine percent lower');
 assert.equal(tuned(.25,8),original(.25,8));assert(Math.abs(tuned(.61,8)-original(.61,8))<1e-9);assert.equal(tuned(.62,8),original(.62,8));
});

test('corner tabletop uses a low hop and touches down near the top of its down ramp',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],base={name:'corner_tt_right',takeoffProfile:'tabletop-up',landingProfile:'tabletop-down',takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:463,landingHeightMm:446,gravity:9.81};
 const main=jumpProfile(samples,[],323,[base],{routeLengthMetres:10,referenceHeightMm:323,tabletopFlightTimeScale:1.8,tabletopMinimumClearanceMetres:.65});
 const corner=jumpProfile(samples,[],323,[{...base,flightTimeScale:.8,minimumClearanceMetres:.1,touchdownProgress:.12}],{routeLengthMetres:10,referenceHeightMm:323,tabletopFlightTimeScale:1.8,tabletopMinimumClearanceMetres:.65});
 let mainPeak=0,cornerPeak=0;for(let fraction=.26;fraction<=.59;fraction+=.001){mainPeak=Math.max(mainPeak,main(fraction,8));cornerPeak=Math.max(cornerPeak,corner(fraction,8));}
 assert(cornerPeak>=560&&cornerPeak<580);assert(mainPeak>1000);assert(cornerPeak<mainPeak*.6);
 assert(corner(.50,8)>440,'car should remain above the tabletop until the corner');assert(corner(.52,8)>350&&corner(.52,8)<440,'car should be riding down the ramp after its early touchdown');assert.equal(corner(.61,8),0);
});

test('corner tabletop wheel path follows the rendered up and down ramp profiles',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],upSurface={polygon:box(20,40),direction:[[20,0],[40,0]],profile:'tabletop-up',heightMm:463},downSurface={polygon:box(50,70),direction:[[50,0],[70,0]],profile:'tabletop-down',heightMm:446};
 const ride=jumpProfile(samples,[],323,[],{routeLengthMetres:10,referenceHeightMm:323,surfaces:[upSurface,downSurface]});
 assert(Math.abs(ride(.295)-463*(1-Math.cos(Math.PI/4)))<1,'up-ramp height must match the curved 3D ramp');
 assert(Math.abs(ride(.595)-446*Math.cos(Math.PI/4))<1,'down-ramp height must match the curved 3D ramp');
});

test('clearer height views progressively raise airborne arcs without moving their endpoints',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],feature={name:'tabletop',takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:217,landingHeightMm:323,gravity:9.81};
 const trueScale=jumpProfile(samples,[],323,[feature],{routeLengthMetres:10,referenceHeightMm:323,flightTimeScale:1});
 const twice=jumpProfile(samples,[],323,[feature],{routeLengthMetres:10,referenceHeightMm:323,flightTimeScale:1.08});
 const threeTimes=jumpProfile(samples,[],323,[feature],{routeLengthMetres:10,referenceHeightMm:323,flightTimeScale:1.15});
 assert(threeTimes(.38,8)>twice(.38,8));assert(twice(.38,8)>trueScale(.38,8));
 assert.equal(threeTimes(.25,8),trueScale(.25,8));assert(Math.abs(threeTimes(.59,8)-trueScale(.59,8))<1e-9);
});

test('measured ramp surfaces use their own heights and direction',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],lift=jumpProfile(samples,[],323,[],{routeLengthMetres:10,referenceHeightMm:323,surfaces:[{polygon:box(20,40),direction:[[20,0],[40,0]],profile:'roller',heightMm:171}]});
 assert.equal(lift(.2),0);assert(lift(.3)>170);assert(Math.abs(lift(.39))<1e-10);
});

test('roller airtime grows with run-up speed and remains capped before the corner',()=>{
 const fineSamples=Array.from({length:1001},(_,i)=>({x:i/10,y:0})),box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],lift=jumpProfile(fineSamples,[],171,[],{routeLengthMetres:100,referenceHeightMm:171,gravity:9.81,surfaces:[{name:'measured roller',polygon:box(20,30),direction:[[20,0],[30,0]],profile:'roller',heightMm:171,launchCars:true,speedFlightRatio:.06,minimumFlightDistanceMetres:.7,maximumFlightDistanceMetres:4.8}]});
 const lastAirborne=speed=>{let last=.25;for(let f=.25;f<=.31;f+=.00005)if(lift(f,speed)>0)last=f;return last;};
 const slow=lastAirborne(4),fast=lastAirborne(8),veryFast=lastAirborne(16);
 assert(slow>.255&&slow<.26,'a slow car should plop down shortly after the roller');
 assert(fast>slow+.01,'a faster run-up should carry the car materially farther');
 assert(veryFast>=.295&&veryFast<=.299,'a fast car should be able to clear a close roller pair');
 assert.equal(lift(.28,4),0);assert(lift(.28,16)>0,'only the fast approach should still be airborne over the second roller');
 assert.equal(lift(.30,16),0);
});

test('trestle boards use straight planar slopes',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],up=jumpProfile(samples,[],396,[],{routeLengthMetres:10,referenceHeightMm:396,surfaces:[{polygon:box(20,60),direction:[[20,0],[60,0]],profile:'linear-up',heightMm:396}]}),down=jumpProfile(samples,[],396,[],{routeLengthMetres:10,referenceHeightMm:396,surfaces:[{polygon:box(20,60),direction:[[20,0],[60,0]],profile:'linear-down',heightMm:396}]});
 assert(up(.3)>80&&up(.3)<130);assert(up(.4)>180&&up(.4)<220);assert(up(.5)>280&&up(.5)<330);
 assert(down(.3)>270&&down(.3)<330);assert(down(.4)>180&&down(.4)<220);assert(down(.5)>80&&down(.5)<130);
});

test('small trestle launches over its top and lands near the bottom of its down ramp',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],feature={name:'trestle_12',takeoffProfile:'linear-up',landingProfile:'linear-down',takeoff:box(20,32),landing:box(44,68),takeoffHeightMm:396,landingHeightMm:396,gravity:9.81,landingAtEnd:true,landingInsetMetres:.2,flightTimeScale:1,minimumClearanceMetres:.1};
 const lift=jumpProfile(samples,[],396,[feature],{routeLengthMetres:10,referenceHeightMm:396,surfaces:[{polygon:box(20,32),direction:[[20,0],[32,0]],profile:'linear-up',heightMm:396},{polygon:box(32,44),direction:[[32,0],[44,0]],profile:'flat',heightMm:396},{polygon:box(44,68),direction:[[44,0],[68,0]],profile:'linear-down',heightMm:396}]});
 assert(lift(.25)>160&&lift(.25)<185,'car follows the straight up board');
 assert(lift(.38)>396,'car is airborne above the flat top');
 assert(lift(.60)>80,'car remains airborne over most of the down ramp');
 assert(lift(.655)>15&&lift(.655)<60,'car touches down near the bottom of the down ramp');
 assert.equal(lift(.69),0,'car is back on the carpet after the ramp');
});

test('egg and wedge landers rise from the floor without a square leading wall',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],lift=jumpProfile(samples,[],323,[],{routeLengthMetres:10,referenceHeightMm:323,surfaces:[{polygon:box(20,60),direction:[[20,0],[60,0]],profile:'egg-lander',heightMm:323}]});
 const wedge=jumpProfile(samples,[],276,[],{routeLengthMetres:10,referenceHeightMm:276,surfaces:[{polygon:box(20,60),direction:[[20,0],[60,0]],profile:'wedge-lander',heightMm:276}]});
 assert.equal(lift(.2),0);assert(lift(.22)>0&&lift(.22)<lift(.26));assert(lift(.28)>315);assert(lift(.36)>lift(.48));assert(Math.abs(lift(.59))<15);
 assert.equal(wedge(.2),0);assert(wedge(.22)>0&&wedge(.22)<wedge(.25));assert(wedge(.26)>260);assert(wedge(.36)>wedge(.5));assert(Math.abs(wedge(.59))<15);
});

test('event design automatically supplies its measured ramp profiles',async()=>{
 const design=JSON.parse(await readFile(new URL('../public/virtual-race-replay/designs/518555.json',import.meta.url),'utf8'));
 const plan=trackPlanFromDesign(design,{date:'2026-10-11'});
 assert.equal(plan.date,'2026-10-11');assert.equal(plan.routeLengthMetres,151.5);assert.equal(plan.jumpFeatures.length,3);
 assert(hasMeasuredJumpMotion(plan));
 assert.deepEqual(plan.jumpFeatures.map(feature=>[feature.takeoffHeightMm,feature.landingHeightMm]),[[217,276],[463,446],[217,323]]);
 assert.equal(plan.jumpSurfaces.filter(surface=>surface.profile==='roller').length,2);
 assert.equal(plan.jumpSurfaces.filter(surface=>surface.launchCars).length,2);
 assert(plan.jumpSurfaces.filter(surface=>surface.launchCars).every(surface=>surface.maximumFlightDistanceMetres===4.8));
 assert(plan.jumpSurfaces.some(surface=>surface.profile==='tabletop-up'&&surface.heightMm===463));
 assert(plan.jumpFeatures.some(feature=>feature.name==='cnc_tt'&&feature.landingProfile==='tabletop-down'));
});

test('SWORD Round 1 design supplies measured 3D ramps to every race',async()=>{
 const design=JSON.parse(await readFile(new URL('../public/virtual-race-replay/designs/518554.json',import.meta.url),'utf8'));
 const plan=trackPlanFromDesign(design,{date:'2026-10-04'});
 assert.equal(plan.name,'SWORD R1 04/10/26');assert.equal(plan.jumpFeatures.length,4);assert(hasMeasuredJumpMotion(plan));
 assert.deepEqual(plan.jumpFeatures.map(feature=>feature.name),['jump_trestle_24','cnc_k_wedge','corner_tt_right','trestle_12']);
 const corner=plan.jumpFeatures.find(feature=>feature.name==='corner_tt_right');assert.equal(corner.takeoffProfile,'tabletop-up');assert.equal(corner.landingProfile,'tabletop-down');assert.equal(corner.flightTimeScale,.8);assert.equal(corner.minimumClearanceMetres,.1);assert.equal(corner.touchdownProgress,.12);
 assert(Math.abs(corner.takeoff[0][0]-82.583)<.01);assert(Math.abs(corner.landing[0][0]-82.544)<.01);assert(corner.landing[1][0]-corner.landing[0][0]>79.9);
 const trestle=plan.jumpFeatures.find(feature=>feature.name==='jump_trestle_24');assert.equal(trestle.landingProfile,'flat');assert.equal(trestle.landingAtEnd,true);assert.equal(trestle.landingInsetMetres,.2);assert.equal(trestle.flightTimeScale,1.8);assert.equal(trestle.minimumClearanceMetres,1.25);
 const smallTrestle=plan.jumpFeatures.find(feature=>feature.name==='trestle_12');assert.equal(smallTrestle.takeoffProfile,'linear-up');assert.equal(smallTrestle.landingProfile,'linear-down');assert.equal(smallTrestle.landingAtEnd,true);assert.equal(smallTrestle.landingInsetMetres,.2);assert.equal(smallTrestle.flightTimeScale,1);assert.equal(smallTrestle.minimumClearanceMetres,.1);
 assert.equal(plan.jumpSurfaces.filter(surface=>surface.launchCars).length,2);assert(plan.jumpSurfaces.filter(surface=>surface.launchCars).every(surface=>surface.maximumFlightDistanceMetres===4.8));
 assert(plan.jumpSurfaces.some(surface=>surface.name==='trestle_12'&&surface.profile==='linear-up'));
 assert(plan.jumpSurfaces.some(surface=>surface.name==='jump_trestle_24'&&surface.profile==='linear-down'));
});

test('confirmed hand-drawn plans become flat 3D designs without inferred ramps',()=>{
 const design=designFromTrackPlan({name:'Historic circuit',date:'2026-02-01',routeStatus:'confirmed',points:[[0,0],[250,0],[500,0],[750,0],[1000,0],[1000,325],[1000,650],[500,650],[0,650],[0,325]]});
 assert.equal(design.flatReplay,true);assert.equal(design.version,0);assert.equal(design.items.length,0);assert.equal(design.carpet.width,30);assert.equal(design.carpet.height,18);assert.equal(design.points[0].y,18);
});

test('September season opener has a flat 3D route and no invented jumps',async()=>{
 const design=JSON.parse(await readFile(new URL('../public/virtual-race-replay/designs/518551.json',import.meta.url),'utf8'));
 const plan=trackPlanFromDesign(design,{date:'2026-09-20'});
 assert.equal(design.flatReplay,true);assert.equal(plan.designVersion,0);assert.equal(plan.jumpFeatures.length,0);assert.equal(plan.jumpSurfaces.length,0);assert.equal(hasMeasuredJumpMotion(plan),false);
});

test('historic hand-drawn plans retain ordinary flat car motion',async()=>{
 const historic=JSON.parse(await readFile(new URL('../public/virtual-race-replay/track-plans.json',import.meta.url),'utf8'));
 for(const [id,plan] of Object.entries(historic))assert.equal(hasMeasuredJumpMotion(plan),false,`${id} must not infer jumps from a hand-drawn plan`);
});

test('3D avatar colours retain shell, accent and wheel cues',()=>{
 const width=10,height=10,data=new Uint8ClampedArray(width*height*4);
 const paint=(from,to,r,g,b)=>{for(let y=from;y<to;y++)for(let x=0;x<width;x++){let i=(y*width+x)*4;data.set([r,g,b,255],i);}};
 paint(0,6,225,35,30);paint(6,10,245,210,25);for(let y=2;y<5;y++)for(let x=0;x<2;x++){let i=(y*width+x)*4;data.set([25,70,220,255],i);}
 const colours=analyseAvatarPixels(data,width,height);assert.match(colours.color,/^#[0-9a-f]{6}$/);assert.notEqual(colours.color,colours.accentColor);assert.notEqual(colours.color,colours.wheelColor);assert.match(colours.secondaryColor,/^#[0-9a-f]{6}$/);assert.match(colours.tertiaryColor,/^#[0-9a-f]{6}$/);assert.match(colours.colorLayout,/^(front-accent|rear-accent|top-accent|lower-accent|mixed)$/);
 assert.equal(avatarThumbnailPath({DRIVER:{'2-Wheel Drive Buggy':'assets/car-avatars/DRIVER-AUTO-2WD.png'}},'DRIVER','2-Wheel Drive Buggy'),'../assets/car-avatar-thumbnails/DRIVER-AUTO-2WD.webp');
 assert.equal(avatarThumbnailPath({DRIVER:{'4-Wheel Drive Buggy':'assets/car-avatars/DRIVER-AUTO-4WD.png'}},'DRIVER','2-Wheel Drive Buggy'),'../assets/car-avatar-thumbnails/DRIVER-AUTO-4WD.webp');
});

test('Russ Williams retains the reviewed fuchsia, white and grey 3D scheme',()=>{
 assert.deepEqual(avatarColourOverride('RUSS-WILLIAMS'),{color:'#e31886',accentColor:'#f4f5f2',secondaryColor:'#f4f5f2',tertiaryColor:'#969b9d',wheelColor:'#f1f2ed',colorLayout:'front-accent'});
});

test('Lewis Hopkins retains the reviewed green, purple, white and blue 3D scheme',()=>{
 assert.deepEqual(avatarColourOverride('LEWIS-HOPKINS'),{color:'#20ef4f',accentColor:'#5b1298',secondaryColor:'#f3f1e8',tertiaryColor:'#174cb7',wheelColor:'#eeeae0',colorLayout:'mixed'});
});

test('reviewed avatar outliers have complete four-colour buggy schemes',()=>{
 for(const key of ['JON-TUCKER','HARRY-DAVIS','MARK-GIAQUINTO','MATT-WOODIWISS','MIKE-DRISCOLL','RICHARD-HARRISON','SEB-FISHER','STEVE-CURTIS-RICH','STUART-IRONS']){
  const colours=avatarColourOverride(key);assert(colours,`${key} needs a reviewed colour mapping`);
  for(const field of ['color','accentColor','secondaryColor','tertiaryColor','wheelColor'])assert.match(colours[field],/^#[0-9a-f]{6}$/i,`${key} ${field}`);
 }
});
