import test from 'node:test';
import assert from 'node:assert/strict';
import {jumpProfile} from '../public/virtual-race-replay/jumps.js';
import {prepare,visualFraction} from '../public/virtual-race-replay/engine.js';
import {paceMap} from '../public/virtual-race-replay/pace.js';
import {trackPlanFromDesign,designFromTrackPlan,hasMeasuredJumpMotion} from '../public/virtual-race-replay/track-designs.js';
import {readFile} from 'node:fs/promises';
import {analyseAvatarPixels,avatarThumbnailPath} from '../public/virtual-race-replay/avatar-colours.js';
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

test('SWORD trestle launch keeps fast cars clearly airborne and lands near the far end',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],feature={name:'jump_trestle_24',takeoffProfile:'kicker',takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:217,landingHeightMm:396,gravity:9.81,minimumClearanceMetres:.7,landingAtEnd:true,landingInsetMetres:.2};
 const lift=jumpProfile(samples,[],396,[feature],{routeLengthMetres:10,referenceHeightMm:396,kickerFlightTimeScale:1.55});
 let peak=0;for(let fraction=.26;fraction<=.5;fraction+=.001)peak=Math.max(peak,lift(fraction,16));
 assert(peak>=1.09,'fast cars should clear the trestle by about 70 cm');assert.equal(lift(.2,16),0);assert(lift(.58,16)>0);assert.equal(lift(.61,16),0);
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
 assert(plan.jumpSurfaces.some(surface=>surface.profile==='tabletop-up'&&surface.heightMm===463));
 assert(plan.jumpFeatures.some(feature=>feature.name==='cnc_tt'&&feature.landingProfile==='tabletop-down'));
});

test('SWORD Round 1 design supplies measured 3D ramps to every race',async()=>{
 const design=JSON.parse(await readFile(new URL('../public/virtual-race-replay/designs/518554.json',import.meta.url),'utf8'));
 const plan=trackPlanFromDesign(design,{date:'2026-10-04'});
 assert.equal(plan.name,'SWORD R1 04/10/26');assert.equal(plan.jumpFeatures.length,2);assert(hasMeasuredJumpMotion(plan));
 assert.deepEqual(plan.jumpFeatures.map(feature=>feature.name),['jump_trestle_24','cnc_k_wedge']);
 const trestle=plan.jumpFeatures[0];assert.equal(trestle.landingProfile,'up');assert.equal(trestle.landingAtEnd,true);assert.equal(trestle.landingInsetMetres,.2);
 assert(plan.jumpSurfaces.some(surface=>surface.name==='trestle_12'&&surface.profile==='up'));
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
 const colours=analyseAvatarPixels(data,width,height);assert.match(colours.color,/^#[0-9a-f]{6}$/);assert.notEqual(colours.color,colours.accentColor);assert.notEqual(colours.color,colours.wheelColor);
 assert.equal(avatarThumbnailPath({DRIVER:{'2-Wheel Drive Buggy':'assets/car-avatars/DRIVER-AUTO-2WD.png'}},'DRIVER','2-Wheel Drive Buggy'),'../assets/car-avatar-thumbnails/DRIVER-AUTO-2WD.webp');
});
