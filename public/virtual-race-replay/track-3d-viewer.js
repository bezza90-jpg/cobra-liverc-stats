(function(root){
'use strict';

const TAU=Math.PI*2,clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const vec=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>vec(a.x+b.x,a.y+b.y,a.z+b.z),sub=(a,b)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,n)=>vec(a.x*n,a.y*n,a.z*n),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const norm=a=>{let length=Math.hypot(a.x,a.y,a.z)||1;return mul(a,1/length);};
const mix=(a,b,t)=>a+(b-a)*t;

const CATALOG={
  bot_dot_18:{name:'Bot dot',length:.4572,width:.4572,height:.10,shape:'botdot'},
  trunk_4:{name:'White trunking · 4 m',length:4,width:.063,height:.063,shape:'trunking'},
  trunk_2:{name:'White trunking · 2 m',length:2,width:.063,height:.063,shape:'trunking'},
  corner_tt_left:{name:'Corner tabletop · left',length:4.945,width:2.44,corner:true,parts:[[0,1.325,'UP',0,0],[1.325,2.44,'TOP',0,0],[2.545,2.4,'DOWN',1.22,90]],partHeights:[.463,.446,.446]},
  corner_tt_right:{name:'Corner tabletop · right',length:4.945,width:2.44,corner:true,parts:[[0,1.325,'UP',0,0],[1.325,2.44,'TOP',0,0],[2.545,2.4,'DOWN',-1.22,-90]],partHeights:[.463,.446,.446]},
  cnc_tt:{name:'CNC tabletop',length:6.207,width:2.44,parts:[[0,1.325,'UP'],[1.325,2.44,'TABLE'],[3.765,2.442,'DOWN']],partHeights:[.463,.446,.446]},
  cnc_tt_long_up:{name:'CNC tabletop · long up',length:7.282,width:2.44,parts:[[0,2.4,'UP'],[2.4,2.44,'TABLE'],[4.84,2.442,'DOWN']],height:.446},
  long_up:{name:'Long up ramp',length:2.4,width:2.4,parts:[[0,2.4,'UP']],height:.446},
  trestle_side:{name:'Side tabletop',length:7.2,width:2.4,parts:[[0,2.4,'UP'],[2.4,2.4,'TOP'],[4.8,2.4,'DOWN']],height:.446},
  cnc_small:{name:'Small roller',length:1.299,width:2.44,parts:[[0,1.299,'SMALL ROLLER']],height:.171},
  cnc_big:{name:'Large roller',length:1.584,width:2.44,parts:[[0,1.584,'LARGE ROLLER']],height:.276},
  cnc_kick:{name:'Kicker',length:.667,width:2.44,parts:[[0,.667,'KICKER']],height:.217},
  cnc_egg:{name:'Egg lander',length:2.317,width:2.44,parts:[[0,2.317,'EGG LANDER']],height:.323},
  cnc_wedge:{name:'Wedge lander',length:2.338,width:2.44,parts:[[0,2.338,'WEDGE LANDER']],height:.276},
  cnc_ripple:{name:'Triple ripple',length:2.364,width:2.44,parts:[[0,2.364,'TRIPLE RIPPLE']],height:.16,heightEstimated:true},
  cnc_ttup:{name:'Tabletop up ramp',length:1.325,width:2.44,parts:[[0,1.325,'UP']],height:.463},
  cnc_tttop:{name:'Tabletop top',length:2.44,width:2.44,parts:[[0,2.44,'TOP']],height:.446},
  cnc_ttdown:{name:'Tabletop down ramp',length:2.442,width:2.44,parts:[[0,2.442,'DOWN']],height:.446},
  cnc_k_egg:{name:'Kicker and egg lander',length:4.484,width:2.44,parts:[[0,.667,'K'],[2.167,2.317,'EGG LAND']],partHeights:[.217,.323]},
  cnc_k_wedge:{name:'Kicker and wedge lander',length:4.505,width:2.44,parts:[[0,.667,'K'],[2.167,2.338,'WEDGE LAND']],partHeights:[.217,.276]},
  trestle_12:{name:'Trestle · 1.2 m top',length:4.8,width:2.4,parts:[[0,1.2,'LINEAR UP'],[1.2,1.2,'TOP'],[2.4,2.4,'LINEAR DOWN']],height:.396,boardThickness:.012},
  trestle_24:{name:'Trestle · 2.4 m top',length:6,width:2.4,parts:[[0,1.2,'LINEAR UP'],[1.2,2.4,'TOP'],[3.6,2.4,'LINEAR DOWN']],height:.396,boardThickness:.012},
  trestle_36:{name:'Trestle · 3.6 m top',length:7.2,width:2.4,parts:[[0,1.2,'LINEAR UP'],[1.2,3.6,'TOP'],[4.8,2.4,'LINEAR DOWN']],height:.396,boardThickness:.012},
  trestle_48:{name:'Trestle · 4.8 m top',length:8.4,width:2.4,parts:[[0,1.2,'LINEAR UP'],[1.2,4.8,'TOP'],[6,2.4,'LINEAR DOWN']],height:.396,boardThickness:.012},
  jump_trestle_12:{name:'Kicker and small trestle',length:6.967,width:2.44,parts:[[0,.667,'K'],[2.167,1.2,'LINEAR UP'],[3.367,1.2,'TOP'],[4.567,2.4,'LINEAR DOWN']],partHeights:[.217,.396,.396,.396],boardThickness:.012},
  jump_trestle_24:{name:'Kicker and trestle',length:8.167,width:2.44,parts:[[0,.667,'K'],[2.167,1.2,'LINEAR UP'],[3.367,2.4,'TOP'],[5.767,2.4,'LINEAR DOWN']],partHeights:[.217,.396,.396,.396],boardThickness:.012},
  finger_ramp:{name:'Finger ramp',length:2.4,width:.2,parts:[[0,2.4,'FINGER']],height:.023,crossSlope:true},
  mini_ramp:{name:'Mini ramp',length:.4,width:2.4,parts:[[0,.4,'MINI']],height:.08,heightEstimated:true},
  tt:{name:'Legacy tabletop',length:6.2,width:2.4,parts:[[0,1.4,'UP'],[1.4,2.4,'TABLE'],[3.8,2.4,'DOWN']],height:.446},
  k4:{name:'Legacy 4.8 m trestle jump',length:6.967,width:2.4,parts:[[0,.667,'K'],[2.167,1.2,'FLAT LANDER'],[3.367,1.2,'TOP'],[4.567,2.4,'DOWN']],partHeights:[.217,.396,.396,.396],boardThickness:.012},
  k6:{name:'Legacy 6 m trestle jump',length:8.167,width:2.4,parts:[[0,.667,'K'],[2.167,1.2,'FLAT LANDER'],[3.367,2.4,'TOP'],[5.767,2.4,'DOWN']],partHeights:[.217,.396,.396,.396],boardThickness:.012},
  roller:{name:'Legacy small roller',length:1,width:2.4,parts:[[0,1,'ROLL']],height:.171},
  kick:{name:'Legacy kicker',length:.667,width:2.4,parts:[[0,.667,'K']],height:.217}
};

function colour(value,factor=1){
  let css=String(value||'#888888'),match=css.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i),r,g,b;
  if(match){r=Number(match[1]);g=Number(match[2]);b=Number(match[3]);}
  else{let raw=css.replace('#','');if(raw.length===3)raw=raw.split('').map(c=>c+c).join('');let n=parseInt(raw,16);if(!Number.isFinite(n))n=0x888888;r=(n>>16)&255;g=(n>>8)&255;b=n&255;}
  r=clamp(Math.round(r*factor),0,255);g=clamp(Math.round(g*factor),0,255);b=clamp(Math.round(b*factor),0,255);
  return `rgb(${r},${g},${b})`;
}

function normalizeDesign(input){
  if(!input||!Array.isArray(input.points)||input.points.length<8)throw Error('Choose an editable Track Designer JSON file.');
  let points=input.points.map(point=>({x:Number(point.x),y:Number(point.y),w:Number(point.w||1.2)}));
  if(points.some(point=>![point.x,point.y,point.w].every(Number.isFinite)))throw Error('The track route contains invalid coordinates.');
  let maxX=Math.max(...points.map(point=>point.x+point.w)),maxY=Math.max(...points.map(point=>point.y+point.w));
  let carpet=input.carpet||{width:Math.max(30,Math.ceil(maxX)),height:Math.max(18,Math.ceil(maxY)),ribbon:2.4};
  carpet={width:Number(carpet.width||30),height:Number(carpet.height||18),ribbon:Number(carpet.ribbon||2.4)};
  return {...input,name:String(input.name||'COBRA track'),points,items:Array.isArray(input.items)?input.items:[],carpet};
}

function sampleRoute(points,step=.19){
  let output=[],count=points.length;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  for(let i=0;i<count;i++){
    let a=points[(i+count-1)%count],b=points[i],c=points[(i+1)%count],d=points[(i+2)%count];
    let steps=Math.max(2,Math.ceil(distance(b,c)/step));
    for(let j=0;j<steps;j++){
      let t=j/steps,t2=t*t,t3=t2*t;
      const f=key=>((1-3*t+3*t2-t3)*a[key]+(4-6*t2+3*t3)*b[key]+(1+3*t+3*t2-3*t3)*c[key]+t3*d[key])/6;
      const df=key=>((-3+6*t-3*t2)*a[key]+(-12*t+9*t2)*b[key]+(3+6*t-9*t2)*c[key]+3*t2*d[key])/6;
      output.push({x:f('x'),y:f('y'),w:f('w'),tx:df('x'),ty:df('y')});
    }
  }
  return output;
}

function routeEdges(route){
  let left=[],right=[];
  for(let point of route){
    let length=Math.hypot(point.tx,point.ty)||1,nx=-point.ty/length,ny=point.tx/length;
    left.push({x:point.x+nx*point.w,y:point.y+ny*point.w});
    right.push({x:point.x-nx*point.w,y:point.y-ny*point.w});
  }
  return {left,right};
}

function polygon(points,fill,stroke='#00000022',kind='surface',opacity=1){return{points,fill,stroke,kind,opacity};}
function localPoint(item,x,y,z){let angle=(Number(item.angle)||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);return vec(Number(item.x)+x*c-y*s,Number(item.y)+x*s+y*c,z);}

function heightProfile(label,t,height){
  label=String(label).toUpperCase();
  if(label.includes('TRIPLE')||label.includes('RIPPLE'))return height*Math.pow(Math.sin(t*Math.PI*3),2);
  if(label.includes('ROLLER')||label==='ROLL')return height*Math.sin(t*Math.PI);
  // The THR landers have no square leading wall. Their nose rises from the
  // carpet into a rounded crest before the longer landing face returns to it.
  if(label.includes('EGG')||label.includes('WEDGE')){
    let rise=label.includes('EGG')?.2:.15;
    if(t<=rise){let u=t/rise;return height*(u*u*(3-2*u));}
    let u=(t-rise)/(1-rise);
    return label.includes('EGG')?height*Math.pow(Math.cos(u*Math.PI/2),1.25):height*(1-(u*u*(3-2*u)));
  }
  if(label.includes('LINEAR')&&label.includes('UP'))return height*t;
  if(label.includes('LINEAR')&&label.includes('DOWN'))return height*(1-t);
  if(label.includes('FLAT')||label.includes('TOP')||label.includes('TABLE'))return height;
  if(label.includes('DOWN')||label.includes('LAND'))return height*Math.cos(t*Math.PI/2);
  if(label==='K'||label.includes('KICK'))return height*(1-Math.cos(t*Math.PI/2));
  if(label.includes('UP')||label.includes('MINI'))return height*(1-Math.cos(t*Math.PI/2));
  return height;
}

function addRampPart(scene,item,spec,part,index,options={}){
  let [offset,length,label]=part,width=Number(spec.width||2.4),height=Number(spec.partHeights?.[index]??spec.height??.04);
  let segments=/EGG|WEDGE/i.test(label)?28:/ROLLER|RIPPLE/i.test(label)?18:8,topRows=[];
  let shadowShift=height*.62,shadowLift=.034;
  scene.polygons.push(polygon([
    add(localPoint(item,offset,-width/2,shadowLift),vec(shadowShift,shadowShift*.48,0)),
    add(localPoint(item,offset+length,-width/2,shadowLift),vec(shadowShift,shadowShift*.48,0)),
    add(localPoint(item,offset+length,width/2,shadowLift),vec(shadowShift,shadowShift*.48,0)),
    add(localPoint(item,offset,width/2,shadowLift),vec(shadowShift,shadowShift*.48,0))
  ],'#020604',null,'shadow',.34));
  for(let i=0;i<=segments;i++){
    let t=i/segments,z=heightProfile(label,t,height)+.035,x=offset+length*t;
    topRows.push([localPoint(item,x,-width/2,z),localPoint(item,x,width/2,z)]);
  }
  for(let i=0;i<segments;i++){
    let a=topRows[i],b=topRows[i+1];
    scene.polygons.push(polygon([a[0],b[0],b[1],a[1]],'#c92731','#4a0b10','ramp'));
    if(!options.omitNegativeSide)scene.polygons.push(polygon([localPoint(item,offset+length*i/segments,-width/2,.03),a[0],b[0],localPoint(item,offset+length*(i+1)/segments,-width/2,.03)],'#761019','#3c070b','ramp-side'));
    if(!options.omitPositiveSide)scene.polygons.push(polygon([localPoint(item,offset+length*i/segments,width/2,.03),localPoint(item,offset+length*(i+1)/segments,width/2,.03),b[1],a[1]],'#8d121c','#3c070b','ramp-side'));
  }
  if(!options.omitStartCap)scene.polygons.push(polygon([localPoint(item,offset,-width/2,.03),localPoint(item,offset,width/2,.03),topRows[0][1],topRows[0][0]],'#701019','#3c070b','ramp-side'));
  if(!options.omitEndCap)scene.polygons.push(polygon([localPoint(item,offset+length,-width/2,.03),topRows.at(-1)[0],topRows.at(-1)[1],localPoint(item,offset+length,width/2,.03)],'#701019','#3c070b','ramp-side'));
}

function cornerPart(item,part){
  const [offset,length,label,lateral=0,angleOffset=0]=part,origin=localPoint(item,offset,lateral,0);
  return{item:{...item,x:origin.x,y:origin.y,angle:Number(item.angle||0)+angleOffset},part:[0,length,label]};
}

function addFingerRamp(scene,item,spec){
  let l=spec.length,w=spec.width,z0=.038,z1=.058;
  let a=localPoint(item,0,-w/2,z0),b=localPoint(item,l,-w/2,z0),c=localPoint(item,l,w/2,z1),d=localPoint(item,0,w/2,z1);
  scene.polygons.push(polygon([a,b,c,d],'#d5b47e','#4b3724','finger'));
  scene.polygons.push(polygon([localPoint(item,0,w/2,.03),localPoint(item,l,w/2,.03),c,d],'#785d39','#372919','finger-side'));
}

function addBotDot(scene,item,spec){
  let radius=(spec.width||.4572)/2,height=Number(spec.height||.10),base=.036,sectors=6,slicesPerSector=6,steps=sectors*slicesPerSector,rings=5,top=localPoint(item,0,0,base+height);
  for(let i=0;i<steps;i++){
    let a=i/steps*TAU,b=(i+1)/steps*TAU,colourValue=Math.floor(i/slicesPerSector)%2?'#f7f7f3':'#e11f2b';
    const domePoint=(angle,fraction)=>localPoint(item,Math.cos(angle)*radius*fraction,Math.sin(angle)*radius*fraction,base+height*Math.sqrt(Math.max(0,1-fraction*fraction)));
    scene.polygons.push(polygon([top,domePoint(a,1/rings),domePoint(b,1/rings)],colourValue,'#681017','dot'));
    for(let ring=1;ring<rings;ring++){
      let inner=ring/rings,outer=(ring+1)/rings;
      scene.polygons.push(polygon([domePoint(a,inner),domePoint(a,outer),domePoint(b,outer),domePoint(b,inner)],colourValue,'#681017','dot'));
    }
  }
}

function addTrunking(scene,item,spec){
  const length=Number(spec.length),half=Number(spec.width)/2,z0=.032,z1=z0+Number(spec.height),a0=localPoint(item,0,-half,z0),a1=localPoint(item,0,half,z0),b0=localPoint(item,length,-half,z0),b1=localPoint(item,length,half,z0),A0=localPoint(item,0,-half,z1),A1=localPoint(item,0,half,z1),B0=localPoint(item,length,-half,z1),B1=localPoint(item,length,half,z1);
  scene.polygons.push(polygon([A0,B0,B1,A1],'#f1f3ef','#8c9690','boundary'));
  scene.polygons.push(polygon([a0,b0,B0,A0],'#c2c8c4','#758079','boundary'));
  scene.polygons.push(polygon([a1,A1,B1,b1],'#d5dad7','#758079','boundary'));
  scene.polygons.push(polygon([a0,A0,A1,a1],'#b5bdb8','#758079','boundary'));
  scene.polygons.push(polygon([b0,b1,B1,B0],'#e1e5e2','#758079','boundary'));
}

function buildScene(design){
  design=normalizeDesign(design);
  let scene={design,route:[],routeLength:0,polygons:[],lines:[],labels:[],warnings:[],stats:{ramps:0,dots:0}};
  let {width,height}=design.carpet;
  scene.polygons.push(polygon([vec(0,0,0),vec(width,0,0),vec(width,height,0),vec(0,height,0)],'#0d1a13','#6e8a76','carpet'));
  for(let x=0;x<=width;x++)scene.lines.push({points:[vec(x,0,.004),vec(x,height,.004)],stroke:x%5===0?'#284033':'#1b2e23',width:x%5===0?1.1:.55,kind:'grid'});
  for(let y=0;y<=height;y++)scene.lines.push({points:[vec(0,y,.004),vec(width,y,.004)],stroke:y%5===0?'#284033':'#1b2e23',width:y%5===0?1.1:.55,kind:'grid'});
  let route=sampleRoute(design.points),edges=routeEdges(route),n=route.length;
  scene.route=route;for(let i=0;i<n;i++)scene.routeLength+=Math.hypot(route[i].x-route[(i+1)%n].x,route[i].y-route[(i+1)%n].y);
  for(let i=0;i<n;i++){
    let j=(i+1)%n,l0=edges.left[i],l1=edges.left[j],r0=edges.right[i],r1=edges.right[j];
    scene.polygons.push(polygon([vec(l0.x,l0.y,.03),vec(l1.x,l1.y,.03),vec(r1.x,r1.y,.03),vec(r0.x,r0.y,.03)],'#c7cecb','#87938d24','track'));
    scene.polygons.push(polygon([vec(l0.x,l0.y,0),vec(l1.x,l1.y,0),vec(l1.x,l1.y,.03),vec(l0.x,l0.y,.03)],'#707a75','#435048','track-side'));
    scene.polygons.push(polygon([vec(r0.x,r0.y,0),vec(r0.x,r0.y,.03),vec(r1.x,r1.y,.03),vec(r1.x,r1.y,0)],'#65706a','#435048','track-side'));
  }
  scene.lines.push({points:route.map(p=>vec(p.x,p.y,.045)),stroke:'#6f8c7a',width:1.15,dash:[7,8],kind:'centre'});
  for(let item of design.items){
    let spec=CATALOG[item.key];if(!spec){if(item.key!=='label'&&item.key!=='car_avatar')scene.warnings.push(`No 3D profile yet: ${item.key}`);continue;}
    if(spec.shape==='botdot'){addBotDot(scene,item,spec);scene.stats.dots++;continue;}
    if(spec.shape==='trunking'){addTrunking(scene,item,spec);continue;}
    if(spec.crossSlope){addFingerRamp(scene,item,spec);scene.stats.ramps++;scene.labels.push({point:localPoint(item,spec.length/2,0,.19),text:spec.name});continue;}
    if(spec.corner){
      for(let [index,part] of spec.parts.entries()){
        const piece=cornerPart(item,part),pieceSpec={...spec,partHeights:[spec.partHeights[index]]};
        const right=item.key==='corner_tt_right',joinOptions=index===1?(right?{omitNegativeSide:true}:{omitPositiveSide:true}):index===2?{omitStartCap:true}:{};
        addRampPart(scene,piece.item,pieceSpec,piece.part,0,joinOptions);
      }
    }else for(let [index,part] of (spec.parts||[]).entries())addRampPart(scene,item,spec,part,index);
    if(spec.parts?.length){
      scene.stats.ramps++;
      let maximum=Math.max(Number(spec.height||0),...(spec.partHeights||[]).map(Number));
      scene.labels.push({point:localPoint(item,Number(spec.length||0)/2,0,maximum+.22),text:spec.name});
    }
    if(spec.heightEstimated)scene.warnings.push(`${spec.name} height is provisional`);
  }
  if(design.loop){
    let loop=design.loop,angle=(Number(loop.angle)||0)*Math.PI/180,length=Number(loop.length||2.4),dx=Math.cos(angle)*length/2,dy=Math.sin(angle)*length/2;
    scene.lines.push({points:[vec(loop.x-dx,loop.y-dy,.065),vec(loop.x+dx,loop.y+dy,.065)],stroke:'#ffffff',width:5,dash:[5,4],kind:'loop'});
  }
  return scene;
}

class Viewer{
  constructor(container,options={}){
    this.container=container;this.options=options;this.design=null;this.scene=null;this.cars=[];this.followCarId='';this.yaw=-.8;this.elevation=.72;this.zoom=1;this.flyoverZoom=1;this.flyoverHeight=6.7;this.flyoverTilt=34;this.heightScale=1;this.showLabels=Boolean(options.showLabels);this.showCarLabels=options.carLabels!==false;this.autoRotate=false;this.flyover=false;this.flyoverPaused=false;this.flyoverProgress=0;this.flyoverStart=0;this.flyoverSpeed=4.5;this.drag=null;this.frame=0;this.lastTime=0;this.lastPaintTime=0;
    this.build();this.bind();this.resize();
    if(options.design)this.setDesign(options.design);
    this.loadFromQuery();
  }
  build(){
    this.container.classList.add('cobra3d');
    if(!document.getElementById('cobra3d-style')){let style=document.createElement('style');style.id='cobra3d-style';style.textContent=`
      .cobra3d{position:relative;overflow:hidden;border:1px solid #335443;border-radius:16px;background:#07110b;box-shadow:0 20px 55px #0007}
      .c3-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px;background:#102219;border-bottom:1px solid #355642}.c3-toolbar button,.c3-toolbar label{min-height:42px;border:1px solid #4b715c;border-radius:9px;background:#1b3024;color:#f5fff8;font-weight:800;padding:9px 13px}.c3-toolbar button{cursor:pointer}.c3-toolbar button:hover,.c3-toolbar button.active{background:#9bec39;color:#10200e;border-color:#9bec39}.c3-toolbar label{display:flex;gap:7px;align-items:center}.c3-toolbar select{background:#0c1b12;color:#fff;border:0;font:inherit}.c3-flight-controls{display:none;gap:8px;align-items:center;flex-wrap:wrap}.c3-flight-controls.active{display:flex}.c3-flight-controls label{padding:6px 10px}.c3-flight-controls input[type=range]{width:112px;accent-color:#9bec39;touch-action:pan-x}.c3-flight-controls output{min-width:46px;color:#baf478;text-align:right}.c3-replay-controls{display:flex;gap:6px;align-items:center;flex:1 1 520px}.c3-replay-controls input[type=range]{min-width:110px;flex:1;accent-color:#9bec39}.c3-replay-controls output{min-width:54px;color:#baf478;font-weight:900;text-align:center}.c3-mobile-replay-bar{display:none}.c3-grow{flex:1}.c3-file{position:absolute;clip:rect(0 0 0 0);width:1px;height:1px}.c3-canvas-wrap{position:relative;min-height:520px;height:min(72vh,850px);background:radial-gradient(circle at 50% 20%,#1c3427,#07100a 70%)}.c3-canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.c3-canvas:active{cursor:grabbing}.c3-overlay{position:absolute;left:16px;top:14px;pointer-events:none;text-shadow:0 2px 5px #000}.c3-title{font-size:clamp(17px,2.2vw,28px);font-weight:900}.c3-meta{margin-top:5px;color:#b9cebf;font-size:13px}.c3-scale{display:inline-block;margin-top:8px;padding:5px 8px;border:1px solid #9bec3980;border-radius:999px;background:#07110bd9;color:#baf478;font-size:12px;font-weight:800}.c3-help{position:absolute;right:14px;bottom:12px;background:#07110bd9;border:1px solid #365641;border-radius:8px;padding:8px 10px;color:#c7d6cc;font-size:12px;pointer-events:none}.c3-status{display:flex;gap:16px;flex-wrap:wrap;padding:9px 14px;background:#0c1a12;color:#b8cabe;font-size:13px}.c3-status strong{color:#9bec39}.c3-error{color:#ff8b8b}.c3-badge{color:#ffd079}.cobra3d:fullscreen,.cobra3d.c3-fallback-fullscreen{display:flex;flex-direction:column;width:100vw;height:100vh;height:100dvh;border:0;border-radius:0;background:#07110b}.cobra3d.c3-fallback-fullscreen{position:fixed;inset:0;z-index:2147483000}.c3-fullscreen-open{overflow:hidden}.cobra3d:fullscreen .c3-canvas-wrap,.cobra3d.c3-fallback-fullscreen .c3-canvas-wrap{height:auto;min-height:0;flex:1}
      @media(max-width:720px),(orientation:landscape) and (max-height:520px) and (max-width:1024px){.c3-toolbar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:6px;padding:7px}.c3-toolbar>button,.c3-toolbar>label{width:100%;min-width:0;min-height:40px;justify-content:center;padding:7px 8px;font-size:12px}.c3-toolbar select{min-width:0;max-width:100%}.c3-grow{display:none}.c3-flight-controls{order:20;grid-column:1/-1;width:100%}.c3-flight-controls.active{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.c3-flight-controls>button,.c3-flight-controls>label{width:100%;min-width:0;justify-content:center}.c3-flight-controls input[type=range]{flex:1;min-width:64px}.c3-replay-controls{order:21;grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%;min-width:0}.c3-replay-controls button{width:100%;min-width:0;padding:6px 5px}.c3-replay-controls input[type=range]{grid-column:1/-1;width:100%;min-width:0}.c3-replay-controls label{grid-column:span 2;min-width:0;justify-content:center}.c3-replay-controls output{min-width:0}.c3-canvas-wrap{height:62vh;height:62dvh;min-height:400px}.c3-help{display:none}.cobra3d:fullscreen .c3-mobile-replay-bar,.cobra3d.c3-fallback-fullscreen .c3-mobile-replay-bar{display:grid;grid-template-columns:.8fr 1.4fr;gap:6px;padding:7px;background:#102219;border-bottom:1px solid #355642}.c3-mobile-replay-bar button{min-height:42px;border:1px solid #4b715c;border-radius:9px;background:#1b3024;color:#f5fff8;font-weight:850}.c3-mobile-replay-bar [data-mobile-replay-play]{background:#9bec39;color:#10200e;border-color:#9bec39}.cobra3d:fullscreen:not(.c3-mobile-controls-open) .c3-toolbar,.cobra3d.c3-fallback-fullscreen:not(.c3-mobile-controls-open) .c3-toolbar{display:none}.cobra3d:fullscreen .c3-toolbar,.cobra3d.c3-fallback-fullscreen .c3-toolbar{max-height:34vh;max-height:34dvh;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}.cobra3d:fullscreen .c3-replay-controls,.cobra3d.c3-fallback-fullscreen .c3-replay-controls{order:-1;position:sticky;top:0;z-index:4;background:#102219;padding-bottom:6px}.cobra3d:fullscreen .c3-canvas-wrap,.cobra3d.c3-fallback-fullscreen .c3-canvas-wrap{min-height:200px}.cobra3d:fullscreen .c3-status,.cobra3d.c3-fallback-fullscreen .c3-status{display:none}}
      @media(orientation:landscape) and (max-height:520px) and (max-width:1024px){.cobra3d:fullscreen .c3-mobile-replay-bar,.cobra3d.c3-fallback-fullscreen .c3-mobile-replay-bar{position:relative;z-index:8}.cobra3d:fullscreen .c3-mobile-replay-bar button,.cobra3d.c3-fallback-fullscreen .c3-mobile-replay-bar button{min-height:38px;font-size:12px}.cobra3d:fullscreen.c3-mobile-controls-open .c3-toolbar,.cobra3d.c3-fallback-fullscreen.c3-mobile-controls-open .c3-toolbar{position:absolute;z-index:7;top:53px;right:0;left:0;max-height:calc(100dvh - 53px);box-shadow:0 12px 30px #000c}.cobra3d:fullscreen .c3-canvas-wrap,.cobra3d.c3-fallback-fullscreen .c3-canvas-wrap{min-height:0}}
    `;document.head.append(style);}
    this.container.innerHTML=`<div class="c3-toolbar">
      <button type="button" data-view="3d" class="active">3D view</button><button type="button" data-action="rotate">Rotate around track</button><button type="button" data-action="flyover">Follow driver</button><span class="c3-flight-controls" data-flight-controls><button type="button" data-action="flight-pause">Ⅱ Pause</button><label>Speed <select data-flight-speed><option value="2.5">Slow</option><option value="4.5" selected>Normal</option><option value="6.5">Fast</option><option value="8.5">Very fast</option></select></label><label>Height <input type="range" min="2.5" max="12" step="0.1" value="6.7" data-flight-height><output data-flight-height-value>6.7 m</output></label><label>Tilt <input type="range" min="15" max="70" step="1" value="34" data-flight-tilt><output data-flight-tilt-value>34°</output></label><button type="button" data-action="flight-reset">Reset camera</button></span><button type="button" data-action="car-labels">Driver names</button><button type="button" data-action="labels">Ramp names</button>
      <button type="button" data-action="reset">Reset</button><button type="button" data-action="zoom-out" aria-label="Zoom out">− Zoom</button><button type="button" data-action="zoom-in" aria-label="Zoom in">+ Zoom</button>
      <span class="c3-grow"></span><button type="button" data-action="open">Open design</button><button type="button" data-action="image">Export image</button><button type="button" data-action="fullscreen">Fullscreen</button><input class="c3-file" type="file" accept="application/json,.json">
    </div><div class="c3-canvas-wrap"><canvas class="c3-canvas" aria-label="Interactive 3D track view"></canvas><div class="c3-overlay"><div class="c3-title">COBRA track</div><div class="c3-meta">Waiting for a Track Designer file</div><div class="c3-scale" data-scale>2× height for clarity</div></div><div class="c3-help">Drag to orbit · right-drag to pan · scroll to zoom</div></div><div class="c3-status"><span data-stat="route">Route waiting</span><span data-stat="ramps">Ramps waiting</span><span data-stat="warning"></span></div>`;
    this.canvas=this.container.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.wrap=this.container.querySelector('.c3-canvas-wrap');this.title=this.container.querySelector('.c3-title');this.meta=this.container.querySelector('.c3-meta');this.scaleNote=this.container.querySelector('[data-scale]');this.help=this.container.querySelector('.c3-help');this.file=this.container.querySelector('.c3-file');this.flightControls=this.container.querySelector('[data-flight-controls]');this.flightHeightInput=this.container.querySelector('[data-flight-height]');this.flightTiltInput=this.container.querySelector('[data-flight-tilt]');this.flightSpeedInput=this.container.querySelector('[data-flight-speed]');this.flightPauseButton=this.container.querySelector('[data-action="flight-pause"]');
    this.container.querySelector('[data-action="car-labels"]').classList.toggle('active',this.showCarLabels);this.container.querySelector('[data-action="labels"]').classList.toggle('active',this.showLabels);this.updateScaleNote();
  }
  bind(){
    this.container.addEventListener('click',event=>{let button=event.target.closest('button');if(!button)return;let view=button.dataset.view,action=button.dataset.action;if(view)this.setView(view);if(action==='rotate')this.toggleAutoRotate();if(action==='flyover')this.followCarId?this.startFlyover(true):this.toggleFlyover();if(action==='flight-pause')this.toggleFlyoverPause();if(action==='flight-reset')this.resetFlyoverCamera();if(action==='zoom-out')this.adjustZoom(.78);if(action==='zoom-in')this.adjustZoom(1.28);if(action==='car-labels'){this.showCarLabels=!this.showCarLabels;button.classList.toggle('active',this.showCarLabels);this.draw();}if(action==='labels'){this.showLabels=!this.showLabels;button.classList.toggle('active',this.showLabels);this.draw();}if(action==='reset')this.setView('3d');if(action==='open')this.file.click();if(action==='image')this.exportImage();if(action==='mobile-controls')this.setMobileControls(!this.container.classList.contains('c3-mobile-controls-open'));if(action==='fullscreen')this.toggleFullscreen();});
    this.flightHeightInput.addEventListener('input',event=>{this.flyoverHeight=Number(event.target.value);this.updateFlyoverControls();if(this.flyover)this.draw();});
    this.flightTiltInput.addEventListener('input',event=>{this.flyoverTilt=Number(event.target.value);this.updateFlyoverControls();if(this.flyover)this.draw();});
    this.flightSpeedInput.addEventListener('change',event=>{this.flyoverSpeed=Number(event.target.value);this.updateFlyoverControls();});
    this.file.addEventListener('change',async()=>{try{let file=this.file.files[0];if(!file)return;this.setDesign(JSON.parse(await file.text()));}catch(error){this.showError(error.message);}finally{this.file.value='';}});
    this.canvas.addEventListener('contextmenu',event=>event.preventDefault());
    this.canvas.addEventListener('pointerdown',event=>{this.stopMotion();this.canvas.setPointerCapture(event.pointerId);this.drag={x:event.clientX,y:event.clientY,button:event.button,target:{...this.target}};});
    this.canvas.addEventListener('pointermove',event=>{if(!this.drag)return;let dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;if(this.drag.button===2||event.shiftKey){let scale=Math.max(this.design?.carpet.width||30,this.design?.carpet.height||18)/Math.max(380,this.canvas.clientWidth);this.target.x=this.drag.target.x-dx*scale;this.target.y=this.drag.target.y+dy*scale;}else{this.yaw-=dx*.008;this.elevation=clamp(this.elevation+dy*.006,.12,1.54);}this.drag.x=event.clientX;this.drag.y=event.clientY;this.drag.target={...this.target};this.draw();});
    this.canvas.addEventListener('pointerup',()=>this.drag=null);this.canvas.addEventListener('pointercancel',()=>this.drag=null);
    this.canvas.addEventListener('wheel',event=>{event.preventDefault();if(this.flyover){this.flyoverZoom=clamp(this.flyoverZoom*Math.exp(-event.deltaY*.001),.6,2.2);this.draw();return;}this.stopMotion();let anchor=this.groundAtPointer(event),nextZoom=clamp(this.zoom*Math.exp(-event.deltaY*.001),.45,4);if(nextZoom===this.zoom)return;this.zoom=nextZoom;if(anchor){let shifted=this.groundAtPointer(event);if(shifted){this.target.x+=anchor.x-shifted.x;this.target.y+=anchor.y-shifted.y;}}this.draw();},{passive:false});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.wrap);this.fullscreenHandler=()=>{this.updateFullscreenButton();requestAnimationFrame(()=>this.resize());};document.addEventListener('fullscreenchange',this.fullscreenHandler);
    this.messageHandler=event=>{if(window.opener&&event.source!==window.opener)return;if(event.data?.type==='cobra-3d-design'&&event.data.design)this.setDesign(event.data.design);};
    window.addEventListener('message',this.messageHandler);if(window.opener)setTimeout(()=>window.opener.postMessage({type:'cobra-3d-ready'},'*'),0);
  }
  async loadFromQuery(){let url=new URL(location.href),designUrl=url.searchParams.get('design');if(!designUrl)return;try{let response=await fetch(designUrl);if(!response.ok)throw Error(`Could not load design (${response.status})`);this.setDesign(await response.json());}catch(error){this.showError(error.message);}}
  setDesign(input){
    try{this.scene=buildScene(input);this.design=this.scene.design;this.target=vec(this.design.carpet.width/2,this.design.carpet.height/2,0);this.findFlyoverStart();this.title.textContent=this.design.name;let measured=this.design.flatReplay?'Flat replay · original jump positions were not measured':this.scene.warnings.length?'Some heights are provisional':'All placed heights are measured';this.meta.textContent=`${this.design.carpet.width} × ${this.design.carpet.height} m carpet · ${measured}`;this.updateStats();this.setView(['3d','overhead','low'].includes(this.options.view)?this.options.view:'3d');if(this.options.autoRotate&&!this.autoRotate){this.autoRotate=true;this.container.querySelector('[data-action="rotate"]').classList.add('active');this.startAnimation();}if(this.options.flyover&&!this.flyover)this.toggleFlyover();return this;}catch(error){this.showError(error.message);throw error;}
  }
  routeAt(fraction){
    let route=this.scene?.route||[],n=route.length;if(!n)return null;let value=((Number(fraction)||0)%1+1)%1,index=Math.floor(value*n),t=value*n-index,a=route[index],b=route[(index+1)%n];return{x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),tx:mix(a.tx,b.tx,t),ty:mix(a.ty,b.ty,t)};
  }
  setFollowCar(id=''){
    let next=String(id||'');if(next===this.followCarId)return this;this.followCarId=next;let button=this.container.querySelector('[data-action="flyover"]');if(button)button.textContent=this.followCarId?'Follow selected car':this.options.trackOnly?'Track flyover':'Follow driver';if(this.flyover)this.help.textContent=this.followCarId?'Following selected driver · use the race controls to pause · scroll to zoom':`${this.options.trackOnly?'Track':'Lap'} flyover running · pause, change speed, height or tilt · scroll to zoom`;this.draw();return this;
  }
  setCars(cars=[]){this.cars=Array.isArray(cars)?cars:[];this.draw();return this;}
  carFaces(car){
    let routePoint=Number.isFinite(car.fraction)?this.routeAt(car.fraction):null,centre=vec(Number(car.x??routePoint?.x)||0,Number(car.y??routePoint?.y)||0,Number(car.z)||0),yaw=Number.isFinite(car.yaw)?car.yaw:Math.atan2(routePoint?.ty||0,routePoint?.tx||1),pitch=Number(car.pitch)||0,roll=Number(car.roll)||0;
    let forward=vec(Math.cos(yaw)*Math.cos(pitch),Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch)),baseRight=vec(-Math.sin(yaw),Math.cos(yaw),0),baseUp=norm(cross(forward,baseRight)),right=add(mul(baseRight,Math.cos(roll)),mul(baseUp,Math.sin(roll))),up=norm(cross(forward,right)),length=Number(car.length)||.46,width=Number(car.width)||.30,height=Number(car.height)||.15;
    centre=add(centre,mul(up,.02+height/2));const corner=(f,r,u)=>add(centre,add(mul(forward,f*length/2),add(mul(right,r*width/2),mul(up,u*height/2))));
    let body=car.color||'#85ed40',accent=car.accentColor||car.secondaryColor||colour(body,1.12),secondary=car.secondaryColor||accent,third=car.tertiaryColor||accent||colour(body,.82),layout=car.colorLayout||'mixed',wheel=car.wheelColor||'#929b95',dark=colour(body,.52),light=colour(body,1.12),glass='#172c39',edge='#030806',faces=[];
    const quad=(points,fill,kind='car')=>faces.push(polygon(points.map(point=>corner(...point)),fill,edge,kind));
    const box=(f0,f1,r0,r1,u0,u1,fill,kind='car')=>{
      quad([[f0,r0,u0],[f1,r0,u0],[f1,r0,u1],[f0,r0,u1]],colour(fill,.66),kind);
      quad([[f0,r1,u0],[f0,r1,u1],[f1,r1,u1],[f1,r1,u0]],colour(fill,.72),kind);
      quad([[f0,r0,u0],[f0,r0,u1],[f0,r1,u1],[f0,r1,u0]],colour(fill,.60),kind);
      quad([[f1,r0,u0],[f1,r1,u0],[f1,r1,u1],[f1,r0,u1]],colour(fill,1.04),kind);
      quad([[f0,r0,u1],[f1,r0,u1],[f1,r1,u1],[f0,r1,u1]],fill,kind);
    };
    // Large faceted tyres, suspension arms and inset coloured rims give the
    // model an open-wheel 1/10 buggy silhouette without expensive 3D meshes.
    for(let f of [-.57,.60]){
      box(f-.07,f+.07,-.96,.96,-.73,-.56,dark,'car-suspension');
      for(let r of [-1.10,1.10]){
        let inner=r<0?r+.24:r-.24,outer=r<0?r-.24:r+.24,tyreOuter=r<0?outer-.01:outer+.01,hubOuter=r<0?outer-.03:outer+.03,tyre=[];
        for(let i=0;i<12;i++){
          let a=i*Math.PI*2/12,b=(i+1)*Math.PI*2/12,p0=[f+Math.cos(a)*.25,inner,-.48+Math.sin(a)*.64],p1=[f+Math.cos(b)*.25,inner,-.48+Math.sin(b)*.64],p2=[f+Math.cos(b)*.25,outer,-.48+Math.sin(b)*.64],p3=[f+Math.cos(a)*.25,outer,-.48+Math.sin(a)*.64];
          quad([p0,p1,p2,p3],i%3===0?'#1b211e':'#101512','car-wheel');tyre.push(corner(f+Math.cos(a)*.25,tyreOuter,-.48+Math.sin(a)*.64));
        }
        faces.push(polygon(tyre,'#111614','#060907','car-wheel'));
        let rim=[];for(let i=0;i<12;i++){let angle=i*Math.PI*2/12;rim.push(corner(f+Math.cos(angle)*.145,hubOuter,-.48+Math.sin(angle)*.37));}
        faces.push(polygon(rim,wheel,'#090d0b','car-hub'));
      }
    }
    // The chassis and shell stay narrow between the wheels, with a pointed
    // nose and a raised central cockpit rather than a full-width sedan body.
    box(-.78,.68,-.46,.46,-.78,-.56,dark,'car-chassis');
    box(-.72,.64,-.44,.44,-.62,-.20,body,'car-shell-base');
    const noseColor=layout==='rear-accent'?body:secondary,wingColor=layout==='front-accent'?third:accent;
    // The nose narrows and slopes towards the front instead of reading as a
    // rectangular block when the car is viewed from track level.
    quad([[.28,-.37,-.64],[.98,-.20,-.64],[.98,-.20,-.30],[.28,-.37,.02]],colour(noseColor,.82),'car-nose');
    quad([[.28,.37,-.64],[.28,.37,.02],[.98,.20,-.30],[.98,.20,-.64]],colour(noseColor,.9),'car-nose');
    quad([[.28,-.37,.02],[.98,-.20,-.30],[.98,.20,-.30],[.28,.37,.02]],noseColor,'car-nose');
    quad([[.98,-.20,-.64],[.98,.20,-.64],[.98,.20,-.30],[.98,-.20,-.30]],colour(noseColor,1.03),'car-nose');
    box(-.48,.12,-.64,-.38,-.60,-.12,secondary,'car-sidepod');
    box(-.48,.12,.38,.64,-.60,-.12,third,'car-sidepod');
    let sections=[[-.60,.38,-.18],[-.34,.45,.48],[-.04,.40,.92],[.25,.35,.62],[.48,.31,.10],[.66,.26,-.16]];
    const shellColours={
      'front-accent':[body,body,third,secondary,accent],
      'rear-accent':[accent,secondary,third,body,body],
      'top-accent':[body,third,accent,secondary,body],
      'lower-accent':[third,body,body,secondary,accent],
      mixed:[body,accent,secondary,third,body]
    }[layout]||[body,accent,third,accent,body];
    for(let i=0;i<sections.length-1;i++){
      let [fa,wa,ua]=sections[i],[fb,wb,ub]=sections[i+1];
      const shellColour=shellColours[i];quad([[fa,-wa,ua],[fb,-wb,ub],[fb,wb,ub],[fa,wa,ua]],shellColour,'car-shell');
      let leftPanel=i%2?third:shellColours[i],rightPanel=i%2?accent:shellColours[i];
      quad([[fa,-wa,-.58],[fb,-wb,-.58],[fb,-wb,ub],[fa,-wa,ua]],colour(leftPanel,.82),'car-shell');
      quad([[fa,wa,-.58],[fa,wa,ua],[fb,wb,ub],[fb,wb,-.58]],colour(rightPanel,.9),'car-shell');
    }
    // Deep coloured skirts keep the avatar scheme visible from track-level
    // cameras; only the exposed chassis beneath them remains dark.
    quad([[-.52,-.54,-.62],[.60,-.35,-.62],[.60,-.35,-.16],[-.52,-.54,.02]],colour(body,.86),'car-shell');
    quad([[-.52,.54,-.62],[-.52,.54,.02],[.60,.35,-.16],[.60,.35,-.62]],colour(secondary,.9),'car-shell');
    // A buggy wing is carried behind the rear shock tower by two swept
    // braces, rather than sitting on upright single-seater style posts.
    box(-.70,-.57,-.76,.76,-.48,.44,dark,'car-shock-tower');
    for(const r of [-.48,.48]){
      quad([[-.64,r-.065,.34],[-.64,r+.065,.34],[-.94,r+.065,.66],[-.94,r-.065,.66]],dark,'car-wing-brace');
      quad([[-.48,r-.055,-.42],[-.40,r+.055,-.42],[-.59,r+.055,.30],[-.67,r-.055,.30]],third,'car-shock');
    }
    box(-1.04,-.84,-1.14,1.14,.58,.80,wingColor,'car-wing');
    quad([[-.16,-.25,.70],[.09,-.22,.63],[.09,.22,.63],[-.16,.25,.70]],glass,'car-window');
    if(car.onFire){
      const cx=Number(car.x??routePoint?.x)||0,cy=Number(car.y??routePoint?.y)||0,phase=Number(car.firePhase)||0,base=Math.max(.52,(Number(car.z)||0)+.28),flicker=.1*Math.sin(phase+cx*7+cy*5),swayX=.07*Math.sin(phase*.73),swayY=.06*Math.cos(phase*.91),flameTop=base+.86+flicker;
      const flame=(axis,fill,height,span,opacity=.96)=>{let a=axis==='x'?vec(cx-span,cy,base):vec(cx,cy-span,base),b=axis==='x'?vec(cx+span,cy,base):vec(cx,cy+span,base);faces.push(polygon([a,b,vec(cx+swayX,cy+swayY,height)],fill,'#8d1800','car-fire',opacity));};
      flame('x','#e82b0d',flameTop,.29);flame('y','#ff5516',flameTop-.03,.28);flame('x','#ff941f',flameTop-.21,.19);flame('y','#ffd84a',flameTop-.29,.15);flame('x','#fff5a0',flameTop-.41,.08,1);
    }
    return faces;
  }
  showError(message){let warning=this.container.querySelector('[data-stat="warning"]');warning.textContent=message;warning.className='c3-error';}
  updateStats(){
    let route=this.scene.design.points,routeLength=0;for(let i=0;i<route.length;i++)routeLength+=Math.hypot(route[i].x-route[(i+1)%route.length].x,route[i].y-route[(i+1)%route.length].y);
    this.container.querySelector('[data-stat="route"]').innerHTML=`<strong>${routeLength.toFixed(1)} m</strong> centre-line data`;
    this.container.querySelector('[data-stat="ramps"]').innerHTML=`<strong>${this.scene.stats.ramps}</strong> ramp assemblies · <strong>${this.scene.stats.dots}</strong> bot dots`;
    let warning=this.container.querySelector('[data-stat="warning"]');warning.textContent=this.scene.warnings.length?[...new Set(this.scene.warnings)].join(' · '):'Measured profiles loaded';warning.className=this.scene.warnings.length?'c3-badge':'';
  }
  updateScaleNote(){this.scaleNote.textContent=this.heightScale===1?'True measured height':`${this.heightScale}× height for clarity`;}
  updateFlyoverControls(){this.flightHeightInput.value=String(this.flyoverHeight);this.flightTiltInput.value=String(this.flyoverTilt);this.flightSpeedInput.value=String(this.flyoverSpeed);this.container.querySelector('[data-flight-height-value]').textContent=`${this.flyoverHeight.toFixed(1)} m`;this.container.querySelector('[data-flight-tilt-value]').textContent=`${Math.round(this.flyoverTilt)}°`;}
  resetFlyoverCamera(){this.flyoverHeight=6.7;this.flyoverTilt=34;this.flyoverZoom=1;this.updateFlyoverControls();this.draw();}
  findFlyoverStart(){
    let route=this.scene?.route||[],loop=this.design?.loop;if(!route.length||!loop){this.flyoverStart=0;this.flyoverProgress=0;return;}
    let best=0,bestDistance=Infinity;for(let i=0;i<route.length;i++){let distance=(route[i].x-loop.x)**2+(route[i].y-loop.y)**2;if(distance<bestDistance){bestDistance=distance;best=i;}}
    this.flyoverStart=best/route.length;this.flyoverProgress=this.flyoverStart;
  }
  stopMotion(){
    this.autoRotate=false;this.flyover=false;this.flyoverPaused=false;cancelAnimationFrame(this.frame);this.frame=0;this.container.querySelector('[data-action="rotate"]')?.classList.remove('active');this.container.querySelector('[data-action="flyover"]')?.classList.remove('active');this.flightControls?.classList.remove('active');if(this.flightPauseButton){this.flightPauseButton.textContent='Ⅱ Pause';this.flightPauseButton.classList.remove('active');}if(this.help)this.help.textContent='Drag to orbit · right-drag to pan · scroll to zoom under pointer';
  }
  startAnimation(){cancelAnimationFrame(this.frame);this.lastTime=performance.now();this.lastPaintTime=this.lastTime;if(this.autoRotate||this.flyover)this.frame=requestAnimationFrame(time=>this.animate(time));}
  toggleAutoRotate(){let enable=!this.autoRotate;this.stopMotion();this.autoRotate=enable;this.container.querySelector('[data-action="rotate"]').classList.toggle('active',enable);if(enable){this.help.textContent='Automatic orbit running · drag the track to stop';this.startAnimation();}this.draw();}
  startFlyover(preserveCamera=false){
    if(this.flyover){this.flyoverPaused=false;this.flightPauseButton.textContent='Ⅱ Pause';this.flightPauseButton.classList.remove('active');this.draw();this.startAnimation();return;}
    this.stopMotion();this.flyover=true;this.flyoverPaused=false;this.flyoverProgress=this.flyoverStart;if(!preserveCamera)this.flyoverZoom=1;this.container.querySelector('[data-action="flyover"]').classList.add('active');this.flightControls.classList.add('active');this.help.textContent=this.followCarId?'Following selected driver · use the race controls to pause · scroll to zoom':`${this.options.trackOnly?'Track':'Lap'} flyover running · pause, change speed, height or tilt · scroll to zoom`;this.draw();setTimeout(()=>{if(this.flyover)this.startAnimation();},250);
  }
  toggleFlyover(){let enable=!this.flyover;this.stopMotion();this.flyover=enable;this.flyoverPaused=false;this.flyoverProgress=this.flyoverStart;this.flyoverZoom=1;this.container.querySelector('[data-action="flyover"]').classList.toggle('active',enable);this.flightControls.classList.toggle('active',enable);if(enable){this.help.textContent=this.followCarId?'Following selected driver · use the race controls to pause · scroll to zoom':`${this.options.trackOnly?'Track':'Lap'} flyover running · pause, change speed, height or tilt · scroll to zoom`;this.draw();setTimeout(()=>{if(this.flyover)this.startAnimation();},250);return;}this.draw();}
  toggleFlyoverPause(){if(!this.flyover)return;this.flyoverPaused=!this.flyoverPaused;this.flightPauseButton.textContent=this.flyoverPaused?'▶ Continue':'Ⅱ Pause';this.flightPauseButton.classList.toggle('active',this.flyoverPaused);const label=this.options.trackOnly?'Track':'Lap';this.help.textContent=this.flyoverPaused?`${label} flyover paused · camera controls remain available`:`${label} flyover running · pause, change speed, height or tilt · scroll to zoom`;this.lastTime=performance.now();this.draw();}
  setView(view){if(this.flyover)this.stopMotion();let preferred=Number(this.options.zoom)||1;if(view==='overhead'){this.yaw=-Math.PI/2;this.elevation=1.52;this.zoom=Math.max(.95,preferred*.82);}else if(view==='low'){this.yaw=-.8;this.elevation=.3;this.zoom=Math.max(.95,preferred*.72);}else{this.yaw=-.8;this.elevation=.72;this.zoom=preferred;}if(this.design)this.target=vec(this.design.carpet.width/2,this.design.carpet.height/2,0);this.container.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));this.draw();}
  resize(){let ratio=Math.min(2,devicePixelRatio||1),rect=this.wrap.getBoundingClientRect();this.canvas.width=Math.max(1,Math.round(rect.width*ratio));this.canvas.height=Math.max(1,Math.round(rect.height*ratio));this.draw();}
  camera(){
    let width=this.canvas.width,height=this.canvas.height;
    if(this.flyover&&this.scene?.route?.length){
      let route=this.scene.route,n=route.length,index=Math.floor(this.flyoverProgress*n)%n,lookSteps=Math.max(24,Math.round(n*.034)),point=route[index],before=route[(index-lookSteps+n)%n],ahead=route[(index+lookSteps)%n],follow=this.followCarId&&this.cars.find(car=>String(car.id)===this.followCarId);
      if(follow){let fraction=Number(follow.fraction)||0;point={x:Number(follow.x)||0,y:Number(follow.y)||0,z:(Number(follow.z)||0)*this.heightScale};before=this.routeAt(fraction-.008)||point;ahead=this.routeAt(fraction+.008)||point;}
      let target=vec(point.x,point.y,Number(point.z)||0),direction=norm(vec(ahead.x-before.x,ahead.y-before.y,0)),tilt=this.flyoverTilt*Math.PI/180,trailingDistance=clamp(this.flyoverHeight/Math.max(.18,Math.tan(tilt)),2.5,20),position=vec(target.x-direction.x*trailingDistance,target.y-direction.y*trailingDistance,target.z+this.flyoverHeight),forward=norm(sub(target,position)),right=norm(cross(forward,vec(0,0,1))),up=norm(cross(right,forward)),focal=Math.min(width,height)/(2*Math.tan(62*Math.PI/360))*this.flyoverZoom;
      return {width,height,position,forward,right,up,focal};
    }
    let maxSize=Math.max(this.design?.carpet.width||30,this.design?.carpet.height||18),distance=maxSize*1.3/this.zoom;
    let flat=Math.cos(this.elevation),position=add(this.target,vec(Math.cos(this.yaw)*flat*distance,Math.sin(this.yaw)*flat*distance,Math.sin(this.elevation)*distance));
    let forward=norm(sub(this.target,position)),right=norm(cross(forward,vec(0,0,1))),up=norm(cross(right,forward)),focal=Math.min(width,height)/(2*Math.tan(42*Math.PI/360));
    return {width,height,position,forward,right,up,focal};
  }
  cameraPoint(point,camera){let adjusted=vec(point.x,point.y,point.z*this.heightScale),relative=sub(adjusted,camera.position);return{x:dot(relative,camera.right),y:dot(relative,camera.up),depth:dot(relative,camera.forward)};}
  screenPoint(point,camera){return{x:camera.width/2+point.x*camera.focal/point.depth,y:camera.height/2-point.y*camera.focal/point.depth,depth:point.depth};}
  groundAtPointer(event,camera=this.camera()){
    let rect=this.canvas.getBoundingClientRect(),screenX=(event.clientX-rect.left)*camera.width/Math.max(1,rect.width),screenY=(event.clientY-rect.top)*camera.height/Math.max(1,rect.height),ray=norm(add(camera.forward,add(mul(camera.right,(screenX-camera.width/2)/camera.focal),mul(camera.up,(camera.height/2-screenY)/camera.focal))));
    if(Math.abs(ray.z)<1e-5)return null;let distance=-camera.position.z/ray.z;if(distance<=0)return null;return add(camera.position,mul(ray,distance));
  }
  nearPlane(){return this.flyover?Math.max(.45,Math.min(2.1,this.flyoverHeight*.45)):.1;}
  project(point,camera){let transformed=this.cameraPoint(point,camera);if(transformed.depth<=this.nearPlane())return null;return this.screenPoint(transformed,camera);}
  clipFaceAtCamera(points,camera){
    let near=this.nearPlane(),vertices=points.map(point=>this.cameraPoint(point,camera)),clipped=[];
    for(let i=0;i<vertices.length;i++){
      let a=vertices[i],b=vertices[(i+1)%vertices.length],aInside=a.depth>=near,bInside=b.depth>=near;
      if(aInside)clipped.push(a);
      if(aInside!==bInside){let t=(near-a.depth)/(b.depth-a.depth);clipped.push({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),depth:near});}
    }
    return clipped.length>=3?clipped.map(point=>this.screenPoint(point,camera)):null;
  }
  draw(forceBackground=false){
    let ctx=this.ctx,width=this.canvas.width,height=this.canvas.height;ctx.clearRect(0,0,width,height);if(forceBackground||!this.container.classList.contains('c3-timing-behind')){let gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,'#15281e');gradient.addColorStop(1,'#050b07');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);}if(!this.scene)return;
    let camera=this.camera(),light=norm(vec(-.45,-.65,1));
    const projectFace=face=>{let points=this.clipFaceAtCamera(face.points,camera);if(!points)return null;let depth=points.reduce((sum,point)=>sum+point.depth,0)/points.length,edge1=sub(face.points[1],face.points[0]),edge2=sub(face.points[2],face.points[0]),normal=norm(cross(edge1,edge2)),diffuse=Math.abs(dot(normal,light)),shade=.62+.38*diffuse;return{face,points,depth,fill:colour(face.fill,shade)};};
    const paintFaces=faces=>{let projected=faces.map(projectFace).filter(Boolean).sort((a,b)=>b.depth-a.depth);ctx.lineJoin='round';for(let item of projected){ctx.globalAlpha=item.face.opacity??1;ctx.beginPath();ctx.moveTo(item.points[0].x,item.points[0].y);for(let point of item.points.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();ctx.fillStyle=item.fill;ctx.fill();if(item.face.stroke){ctx.strokeStyle=item.face.stroke;ctx.lineWidth=item.face.kind==='ramp'?.7:item.face.kind==='track'?.35:1;ctx.stroke();}}ctx.globalAlpha=1;};
    const paintLines=lines=>{for(let line of lines){let points=line.points.map(point=>this.project(point,camera)),started=false;ctx.beginPath();for(let point of points){if(!point){started=false;continue;}if(!started){ctx.moveTo(point.x,point.y);started=true;}else ctx.lineTo(point.x,point.y);}if(!started)continue;ctx.strokeStyle=line.stroke;ctx.lineWidth=line.width*(devicePixelRatio||1);ctx.setLineDash((line.dash||[]).map(value=>value*(devicePixelRatio||1)));ctx.stroke();}ctx.setLineDash([]);};
    paintFaces(this.scene.polygons.filter(face=>face.kind==='carpet'));
    paintLines(this.scene.lines.filter(line=>line.kind==='grid'));
    paintFaces(this.scene.polygons.filter(face=>this.flyover?face.kind==='track':face.kind.startsWith('track')));
    paintLines(this.scene.lines.filter(line=>line.kind==='centre'));
    paintFaces(this.scene.polygons.filter(face=>face.kind==='shadow'));
    paintFaces(this.scene.polygons.filter(face=>!face.kind.startsWith('track')&&!['carpet','shadow'].includes(face.kind)));
    paintLines(this.scene.lines.filter(line=>!['grid','centre'].includes(line.kind)));
    if(this.cars.length)paintFaces(this.cars.flatMap(car=>this.carFaces(car)));
    if(this.showCarLabels&&this.cars.length){
      let ratio=devicePixelRatio||1,labelScale=this.canvas.clientWidth<=720?.72:1,followId=this.followCarId,cars=this.flyover&&followId?this.cars.filter(car=>String(car.id)===followId):this.cars;
      ctx.font=`900 ${10*ratio*labelScale}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
      let candidates=cars.map(car=>{let routePoint=Number.isFinite(car.fraction)?this.routeAt(car.fraction):null,anchor=this.project(vec(Number(car.x??routePoint?.x)||0,Number(car.y??routePoint?.y)||0,(Number(car.z)||0)+.48),camera);if(!anchor)return null;let selected=String(car.id)===followId,text=String(car.label||car.number||''),padding=(selected?5:4)*ratio*labelScale,boxHeight=(selected?20:18)*ratio*labelScale,boxWidth=Math.max(23*ratio*labelScale,ctx.measureText(text).width+padding*2),x=clamp(anchor.x,boxWidth/2+3*ratio,width-boxWidth/2-3*ratio),y=anchor.y-8*ratio*labelScale;return{car,text,selected,anchor,x,y,boxWidth,boxHeight,depth:anchor.depth};}).filter(Boolean).sort((a,b)=>Number(b.selected)-Number(a.selected)||a.depth-b.depth),accepted=[];
      for(let item of candidates){let margin=4*ratio*labelScale,box={left:item.x-item.boxWidth/2-margin,right:item.x+item.boxWidth/2+margin,top:item.y-item.boxHeight/2-margin,bottom:item.y+item.boxHeight/2+margin};if(!item.selected&&accepted.some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top))continue;accepted.push(box);ctx.strokeStyle=item.car.color||'#9bec39';ctx.lineWidth=(item.selected?1.7:1.1)*ratio*labelScale;ctx.beginPath();ctx.moveTo(item.anchor.x,item.anchor.y);ctx.lineTo(item.x,item.y+item.boxHeight/2);ctx.stroke();ctx.fillStyle='#07110bdc';ctx.beginPath();ctx.roundRect(item.x-item.boxWidth/2,item.y-item.boxHeight/2,item.boxWidth,item.boxHeight,6*ratio*labelScale);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.fillText(item.text,item.x,item.y);}
    }
    if(this.showLabels){
      ctx.font=`800 ${12*(devicePixelRatio||1)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
      for(let label of this.scene.labels){let point=this.project(label.point,camera);if(!point)continue;let padding=7*(devicePixelRatio||1),metrics=ctx.measureText(label.text),boxWidth=metrics.width+padding*2,boxHeight=25*(devicePixelRatio||1);ctx.fillStyle='#07110be6';ctx.strokeStyle='#9bec39';ctx.lineWidth=1.2*(devicePixelRatio||1);ctx.beginPath();ctx.roundRect(point.x-boxWidth/2,point.y-boxHeight/2,boxWidth,boxHeight,boxHeight/2);ctx.fill();ctx.stroke();ctx.fillStyle='#f5fff8';ctx.fillText(label.text,point.x,point.y);}
    }
  }
  animate(time=performance.now()){if(!this.autoRotate&&!this.flyover)return;if(time-this.lastPaintTime<40){this.frame=requestAnimationFrame(next=>this.animate(next));return;}let delta=Math.min(.08,(time-this.lastTime)/1000||0);this.lastTime=time;this.lastPaintTime=time;if(this.autoRotate)this.yaw-=delta*.18;if(this.flyover&&!this.flyoverPaused&&!this.followCarId)this.flyoverProgress=(this.flyoverProgress+delta*this.flyoverSpeed/Math.max(1,this.scene.routeLength))%1;this.draw();this.frame=requestAnimationFrame(next=>this.animate(next));}
  adjustZoom(factor){if(this.flyover)this.flyoverZoom=clamp(this.flyoverZoom*factor,.6,2.2);else{this.stopMotion();this.zoom=clamp(this.zoom*factor,.45,4);}this.draw();}
  exportImage(){this.draw(true);let link=document.createElement('a');link.download=(this.design?.name||'COBRA-track').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')+'-3D.png';link.href=this.canvas.toDataURL('image/png');link.click();this.draw();}
  setMobileControls(open=false){this.container.classList.toggle('c3-mobile-controls-open',open);let button=this.container.querySelector('[data-action="mobile-controls"]');if(button){button.textContent=open?'✕ Hide additional controls':'☰ Tap for additional controls';button.setAttribute('aria-expanded',String(open));}if(open){let toolbar=this.container.querySelector('.c3-toolbar');if(toolbar)toolbar.scrollTop=0;}}
  updateFullscreenButton(){let button=this.container.querySelector('[data-action="fullscreen"]'),active=document.fullscreenElement===this.container||this.container.classList.contains('c3-fallback-fullscreen');if(button){button.textContent=active?'Exit fullscreen':'Fullscreen';button.classList.toggle('active',active);}this.setMobileControls(false);}
  async toggleFullscreen(){if(document.fullscreenElement){await document.exitFullscreen();return;}if(this.container.classList.contains('c3-fallback-fullscreen')){this.container.classList.remove('c3-fallback-fullscreen');document.body.classList.remove('c3-fullscreen-open');this.updateFullscreenButton();this.resize();return;}try{if(!this.container.requestFullscreen)throw Error('Fullscreen unavailable');await this.container.requestFullscreen();}catch{this.container.classList.add('c3-fallback-fullscreen');document.body.classList.add('c3-fullscreen-open');this.updateFullscreenButton();this.resize();}}
  destroy(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();document.removeEventListener('fullscreenchange',this.fullscreenHandler);document.body.classList.remove('c3-fullscreen-open');window.removeEventListener('message',this.messageHandler);this.container.replaceChildren();}
}

function mount(container,options){if(typeof container==='string')container=document.querySelector(container);if(!container)throw Error('Choose a container for the 3D track viewer.');return new Viewer(container,options);}

root.CobraTrack3D={mount,buildScene,normalizeDesign,sampleRoute,heightProfile,CATALOG};
})(typeof window!=='undefined'?window:globalThis);
