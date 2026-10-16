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
  trestle_12:{name:'Trestle · 1.2 m top',length:4.8,width:2.4,parts:[[0,1.2,'FLAT LANDER'],[1.2,1.2,'TOP'],[2.4,2.4,'DOWN']],height:.396,boardThickness:.012},
  trestle_24:{name:'Trestle · 2.4 m top',length:6,width:2.4,parts:[[0,1.2,'FLAT LANDER'],[1.2,2.4,'TOP'],[3.6,2.4,'DOWN']],height:.396,boardThickness:.012},
  trestle_36:{name:'Trestle · 3.6 m top',length:7.2,width:2.4,parts:[[0,1.2,'FLAT LANDER'],[1.2,3.6,'TOP'],[4.8,2.4,'DOWN']],height:.396,boardThickness:.012},
  trestle_48:{name:'Trestle · 4.8 m top',length:8.4,width:2.4,parts:[[0,1.2,'FLAT LANDER'],[1.2,4.8,'TOP'],[6,2.4,'DOWN']],height:.396,boardThickness:.012},
  jump_trestle_12:{name:'Kicker and small trestle',length:6.967,width:2.44,parts:[[0,.667,'K'],[2.167,1.2,'FLAT LANDER'],[3.367,1.2,'TOP'],[4.567,2.4,'DOWN']],partHeights:[.217,.396,.396,.396],boardThickness:.012},
  jump_trestle_24:{name:'Kicker and trestle',length:8.167,width:2.44,parts:[[0,.667,'K'],[2.167,1.2,'FLAT LANDER'],[3.367,2.4,'TOP'],[5.767,2.4,'DOWN']],partHeights:[.217,.396,.396,.396],boardThickness:.012},
  finger_ramp:{name:'Finger ramp',length:2.4,width:.2,parts:[[0,2.4,'FINGER']],height:.023,crossSlope:true},
  mini_ramp:{name:'Mini ramp',length:.4,width:2.4,parts:[[0,.4,'MINI']],height:.08,heightEstimated:true},
  tt:{name:'Legacy tabletop',length:6.2,width:2.4,parts:[[0,1.4,'UP'],[1.4,2.4,'TABLE'],[3.8,2.4,'DOWN']],height:.446},
  k4:{name:'Legacy 4.8 m trestle jump',length:6.967,width:2.4,parts:[[0,.667,'K'],[2.167,1.2,'FLAT LANDER'],[3.367,1.2,'TOP'],[4.567,2.4,'DOWN']],partHeights:[.217,.396,.396,.396],boardThickness:.012},
  k6:{name:'Legacy 6 m trestle jump',length:8.167,width:2.4,parts:[[0,.667,'K'],[2.167,1.2,'FLAT LANDER'],[3.367,2.4,'TOP'],[5.767,2.4,'DOWN']],partHeights:[.217,.396,.396,.396],boardThickness:.012},
  roller:{name:'Legacy small roller',length:1,width:2.4,parts:[[0,1,'ROLL']],height:.171},
  kick:{name:'Legacy kicker',length:.667,width:2.4,parts:[[0,.667,'K']],height:.217}
};

function colour(hex,factor=1){
  let raw=(hex||'#888888').replace('#','');if(raw.length===3)raw=raw.split('').map(c=>c+c).join('');
  let n=parseInt(raw,16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
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
  if(label.includes('FLAT')||label.includes('TOP')||label.includes('TABLE'))return height;
  if(label.includes('DOWN')||label.includes('LAND'))return height*Math.cos(t*Math.PI/2);
  if(label==='K'||label.includes('KICK'))return height*(1-Math.cos(t*Math.PI/2));
  if(label.includes('UP')||label.includes('MINI'))return height*(1-Math.cos(t*Math.PI/2));
  return height;
}

function addRampPart(scene,item,spec,part,index){
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
    scene.polygons.push(polygon([localPoint(item,offset+length*i/segments,-width/2,.03),a[0],b[0],localPoint(item,offset+length*(i+1)/segments,-width/2,.03)],'#761019','#3c070b','ramp-side'));
    scene.polygons.push(polygon([localPoint(item,offset+length*i/segments,width/2,.03),localPoint(item,offset+length*(i+1)/segments,width/2,.03),b[1],a[1]],'#8d121c','#3c070b','ramp-side'));
  }
  scene.polygons.push(polygon([localPoint(item,offset,-width/2,.03),localPoint(item,offset,width/2,.03),topRows[0][1],topRows[0][0]],'#701019','#3c070b','ramp-side'));
  scene.polygons.push(polygon([localPoint(item,offset+length,-width/2,.03),topRows.at(-1)[0],topRows.at(-1)[1],localPoint(item,offset+length,width/2,.03)],'#701019','#3c070b','ramp-side'));
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
    if(spec.crossSlope){addFingerRamp(scene,item,spec);scene.stats.ramps++;scene.labels.push({point:localPoint(item,spec.length/2,0,.19),text:spec.name});continue;}
    for(let [index,part] of (spec.parts||[]).entries())addRampPart(scene,item,spec,part,index);
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
    let requestedHeight=Number(options.heightScale);
    this.container=container;this.options=options;this.design=null;this.scene=null;this.cars=[];this.followCarId='';this.yaw=-.8;this.elevation=.72;this.zoom=1;this.flyoverZoom=1;this.flyoverHeight=6.7;this.flyoverTilt=34;this.heightScale=[1,2,3].includes(requestedHeight)?requestedHeight:2;this.showLabels=Boolean(options.showLabels);this.showCarLabels=options.carLabels!==false;this.autoRotate=false;this.flyover=false;this.flyoverPaused=false;this.flyoverProgress=0;this.flyoverStart=0;this.flyoverSpeed=4.5;this.drag=null;this.frame=0;this.lastTime=0;this.lastPaintTime=0;
    this.build();this.bind();this.resize();
    if(options.design)this.setDesign(options.design);
    this.loadFromQuery();
  }
  build(){
    this.container.classList.add('cobra3d');
    if(!document.getElementById('cobra3d-style')){let style=document.createElement('style');style.id='cobra3d-style';style.textContent=`
      .cobra3d{position:relative;overflow:hidden;border:1px solid #335443;border-radius:16px;background:#07110b;box-shadow:0 20px 55px #0007}
      .c3-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px;background:#102219;border-bottom:1px solid #355642}.c3-toolbar button,.c3-toolbar label{min-height:42px;border:1px solid #4b715c;border-radius:9px;background:#1b3024;color:#f5fff8;font-weight:800;padding:9px 13px}.c3-toolbar button{cursor:pointer}.c3-toolbar button:hover,.c3-toolbar button.active{background:#9bec39;color:#10200e;border-color:#9bec39}.c3-toolbar label{display:flex;gap:7px;align-items:center}.c3-toolbar select{background:#0c1b12;color:#fff;border:0;font:inherit}.c3-flight-controls{display:none;gap:8px;align-items:center;flex-wrap:wrap}.c3-flight-controls.active{display:flex}.c3-flight-controls label{padding:6px 10px}.c3-flight-controls input[type=range]{width:112px;accent-color:#9bec39;touch-action:pan-x}.c3-flight-controls output{min-width:46px;color:#baf478;text-align:right}.c3-grow{flex:1}.c3-file{position:absolute;clip:rect(0 0 0 0);width:1px;height:1px}.c3-canvas-wrap{position:relative;min-height:520px;height:min(72vh,850px);background:radial-gradient(circle at 50% 20%,#1c3427,#07100a 70%)}.c3-canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.c3-canvas:active{cursor:grabbing}.c3-overlay{position:absolute;left:16px;top:14px;pointer-events:none;text-shadow:0 2px 5px #000}.c3-title{font-size:clamp(17px,2.2vw,28px);font-weight:900}.c3-meta{margin-top:5px;color:#b9cebf;font-size:13px}.c3-scale{display:inline-block;margin-top:8px;padding:5px 8px;border:1px solid #9bec3980;border-radius:999px;background:#07110bd9;color:#baf478;font-size:12px;font-weight:800}.c3-help{position:absolute;right:14px;bottom:12px;background:#07110bd9;border:1px solid #365641;border-radius:8px;padding:8px 10px;color:#c7d6cc;font-size:12px;pointer-events:none}.c3-status{display:flex;gap:16px;flex-wrap:wrap;padding:9px 14px;background:#0c1a12;color:#b8cabe;font-size:13px}.c3-status strong{color:#9bec39}.c3-error{color:#ff8b8b}.c3-badge{color:#ffd079}.cobra3d:fullscreen{display:flex;flex-direction:column;height:100vh;border:0;border-radius:0}.cobra3d:fullscreen .c3-canvas-wrap{height:auto;min-height:0;flex:1}
      @media(max-width:720px){.c3-toolbar{gap:5px;padding:7px}.c3-toolbar button,.c3-toolbar label{min-height:38px;padding:7px 9px;font-size:12px}.c3-flight-controls{order:20;width:100%}.c3-flight-controls label{flex:1 1 145px}.c3-flight-controls input[type=range]{flex:1;min-width:76px}.c3-canvas-wrap{height:66vh;min-height:430px}.c3-help{display:none}}
    `;document.head.append(style);}
    this.container.innerHTML=`<div class="c3-toolbar">
      <button type="button" data-view="3d" class="active">3D view</button><button type="button" data-view="overhead">Overhead</button><button type="button" data-view="low">Low angle</button><button type="button" data-action="rotate">Rotate around track</button><button type="button" data-action="flyover">Lap flyover</button><span class="c3-flight-controls" data-flight-controls><button type="button" data-action="flight-pause">Ⅱ Pause</button><label>Speed <select data-flight-speed><option value="2.5">Slow</option><option value="4.5" selected>Normal</option><option value="6.5">Fast</option><option value="8.5">Very fast</option></select></label><label>Height <input type="range" min="2.5" max="12" step="0.1" value="6.7" data-flight-height><output data-flight-height-value>6.7 m</output></label><label>Tilt <input type="range" min="15" max="70" step="1" value="34" data-flight-tilt><output data-flight-tilt-value>34°</output></label><button type="button" data-action="flight-reset">Reset camera</button></span><button type="button" data-action="car-labels">Driver names</button><button type="button" data-action="labels">Ramp names</button>
      <button type="button" data-action="reset">Reset</button><label>Height <select data-height><option value="1">True scale</option><option value="2" selected>2× clearer</option><option value="3">3× clearer</option></select></label>
      <span class="c3-grow"></span><button type="button" data-action="open">Open design</button><button type="button" data-action="image">Export image</button><button type="button" data-action="fullscreen">Fullscreen</button><input class="c3-file" type="file" accept="application/json,.json">
    </div><div class="c3-canvas-wrap"><canvas class="c3-canvas" aria-label="Interactive 3D track view"></canvas><div class="c3-overlay"><div class="c3-title">COBRA track</div><div class="c3-meta">Waiting for a Track Designer file</div><div class="c3-scale" data-scale>2× height for clarity</div></div><div class="c3-help">Drag to orbit · right-drag to pan · scroll to zoom</div></div><div class="c3-status"><span data-stat="route">Route waiting</span><span data-stat="ramps">Ramps waiting</span><span data-stat="warning"></span></div>`;
    this.canvas=this.container.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.wrap=this.container.querySelector('.c3-canvas-wrap');this.title=this.container.querySelector('.c3-title');this.meta=this.container.querySelector('.c3-meta');this.scaleNote=this.container.querySelector('[data-scale]');this.help=this.container.querySelector('.c3-help');this.file=this.container.querySelector('.c3-file');this.flightControls=this.container.querySelector('[data-flight-controls]');this.flightHeightInput=this.container.querySelector('[data-flight-height]');this.flightTiltInput=this.container.querySelector('[data-flight-tilt]');this.flightSpeedInput=this.container.querySelector('[data-flight-speed]');this.flightPauseButton=this.container.querySelector('[data-action="flight-pause"]');
    this.container.querySelector('[data-height]').value=String(this.heightScale);this.container.querySelector('[data-action="car-labels"]').classList.toggle('active',this.showCarLabels);this.container.querySelector('[data-action="labels"]').classList.toggle('active',this.showLabels);this.updateScaleNote();
  }
  bind(){
    this.container.addEventListener('click',event=>{let button=event.target.closest('button');if(!button)return;let view=button.dataset.view,action=button.dataset.action;if(view)this.setView(view);if(action==='rotate')this.toggleAutoRotate();if(action==='flyover')this.toggleFlyover();if(action==='flight-pause')this.toggleFlyoverPause();if(action==='flight-reset')this.resetFlyoverCamera();if(action==='car-labels'){this.showCarLabels=!this.showCarLabels;button.classList.toggle('active',this.showCarLabels);this.draw();}if(action==='labels'){this.showLabels=!this.showLabels;button.classList.toggle('active',this.showLabels);this.draw();}if(action==='reset')this.setView('3d');if(action==='open')this.file.click();if(action==='image')this.exportImage();if(action==='fullscreen')this.toggleFullscreen();});
    this.container.querySelector('[data-height]').addEventListener('change',event=>{this.heightScale=Number(event.target.value);this.updateScaleNote();this.draw();});
    this.flightHeightInput.addEventListener('input',event=>{this.flyoverHeight=Number(event.target.value);this.updateFlyoverControls();if(this.flyover)this.draw();});
    this.flightTiltInput.addEventListener('input',event=>{this.flyoverTilt=Number(event.target.value);this.updateFlyoverControls();if(this.flyover)this.draw();});
    this.flightSpeedInput.addEventListener('change',event=>{this.flyoverSpeed=Number(event.target.value);this.updateFlyoverControls();});
    this.file.addEventListener('change',async()=>{try{let file=this.file.files[0];if(!file)return;this.setDesign(JSON.parse(await file.text()));}catch(error){this.showError(error.message);}finally{this.file.value='';}});
    this.canvas.addEventListener('contextmenu',event=>event.preventDefault());
    this.canvas.addEventListener('pointerdown',event=>{this.stopMotion();this.canvas.setPointerCapture(event.pointerId);this.drag={x:event.clientX,y:event.clientY,button:event.button,target:{...this.target}};});
    this.canvas.addEventListener('pointermove',event=>{if(!this.drag)return;let dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;if(this.drag.button===2||event.shiftKey){let scale=Math.max(this.design?.carpet.width||30,this.design?.carpet.height||18)/Math.max(380,this.canvas.clientWidth);this.target.x=this.drag.target.x-dx*scale;this.target.y=this.drag.target.y+dy*scale;}else{this.yaw+=dx*.008;this.elevation=clamp(this.elevation+dy*.006,.12,1.54);}this.drag.x=event.clientX;this.drag.y=event.clientY;this.drag.target={...this.target};this.draw();});
    this.canvas.addEventListener('pointerup',()=>this.drag=null);this.canvas.addEventListener('pointercancel',()=>this.drag=null);
    this.canvas.addEventListener('wheel',event=>{event.preventDefault();if(this.flyover){this.flyoverZoom=clamp(this.flyoverZoom*Math.exp(-event.deltaY*.001),.6,2.2);this.draw();return;}this.stopMotion();this.zoom=clamp(this.zoom*Math.exp(-event.deltaY*.001),.45,4);this.draw();},{passive:false});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.wrap);
    this.messageHandler=event=>{if(window.opener&&event.source!==window.opener)return;if(event.data?.type==='cobra-3d-design'&&event.data.design)this.setDesign(event.data.design);};
    window.addEventListener('message',this.messageHandler);if(window.opener)setTimeout(()=>window.opener.postMessage({type:'cobra-3d-ready'},'*'),0);
  }
  async loadFromQuery(){let url=new URL(location.href),designUrl=url.searchParams.get('design');if(!designUrl)return;try{let response=await fetch(designUrl);if(!response.ok)throw Error(`Could not load design (${response.status})`);this.setDesign(await response.json());}catch(error){this.showError(error.message);}}
  setDesign(input){
    try{this.scene=buildScene(input);this.design=this.scene.design;this.target=vec(this.design.carpet.width/2,this.design.carpet.height/2,0);this.findFlyoverStart();this.title.textContent=this.design.name;let measured=this.scene.warnings.length?'Some heights are provisional':'All placed heights are measured';this.meta.textContent=`${this.design.carpet.width} × ${this.design.carpet.height} m carpet · ${measured}`;this.updateStats();this.setView(['3d','overhead','low'].includes(this.options.view)?this.options.view:'3d');if(this.options.autoRotate&&!this.autoRotate){this.autoRotate=true;this.container.querySelector('[data-action="rotate"]').classList.add('active');this.startAnimation();}if(this.options.flyover&&!this.flyover)this.toggleFlyover();return this;}catch(error){this.showError(error.message);throw error;}
  }
  routeAt(fraction){
    let route=this.scene?.route||[],n=route.length;if(!n)return null;let value=((Number(fraction)||0)%1+1)%1,index=Math.floor(value*n),t=value*n-index,a=route[index],b=route[(index+1)%n];return{x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),tx:mix(a.tx,b.tx,t),ty:mix(a.ty,b.ty,t)};
  }
  setFollowCar(id=''){
    let next=String(id||'');if(next===this.followCarId)return this;this.followCarId=next;let button=this.container.querySelector('[data-action="flyover"]');if(button)button.textContent=this.followCarId?'Follow selected car':'Lap flyover';if(this.flyover)this.help.textContent=this.followCarId?'Following selected driver · use the race controls to pause · scroll to zoom':'Lap flyover running · pause, change speed, height or tilt · scroll to zoom';this.draw();return this;
  }
  setCars(cars=[]){this.cars=Array.isArray(cars)?cars:[];this.draw();return this;}
  carFaces(car){
    let routePoint=Number.isFinite(car.fraction)?this.routeAt(car.fraction):null,centre=vec(Number(car.x??routePoint?.x)||0,Number(car.y??routePoint?.y)||0,Number(car.z)||0),yaw=Number.isFinite(car.yaw)?car.yaw:Math.atan2(routePoint?.ty||0,routePoint?.tx||1),pitch=Number(car.pitch)||0;
    let forward=vec(Math.cos(yaw)*Math.cos(pitch),Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch)),right=vec(-Math.sin(yaw),Math.cos(yaw),0),up=norm(cross(forward,right)),length=Number(car.length)||.46,width=Number(car.width)||.30,height=Number(car.height)||.15;
    centre=add(centre,mul(up,.02+height/2));const corner=(f,r,u)=>add(centre,add(mul(forward,f*length/2),add(mul(right,r*width/2),mul(up,u*height/2))));
    let body=car.color||'#85ed40',accent=car.accentColor||colour(body,1.12),wheel=car.wheelColor||'#929b95',dark=colour(body,.52),light=colour(body,1.12),glass='#172c39',edge='#030806',faces=[];
    const quad=(points,fill,kind='car')=>faces.push(polygon(points.map(point=>corner(...point)),fill,edge,kind));
    const box=(f0,f1,r0,r1,u0,u1,fill,kind='car')=>{
      quad([[f0,r0,u0],[f1,r0,u0],[f1,r0,u1],[f0,r0,u1]],colour(fill,.66),kind);
      quad([[f0,r1,u0],[f0,r1,u1],[f1,r1,u1],[f1,r1,u0]],colour(fill,.72),kind);
      quad([[f0,r0,u0],[f0,r0,u1],[f0,r1,u1],[f0,r1,u0]],colour(fill,.60),kind);
      quad([[f1,r0,u0],[f1,r1,u0],[f1,r1,u1],[f1,r0,u1]],colour(fill,1.04),kind);
      quad([[f0,r0,u1],[f1,r0,u1],[f1,r1,u1],[f0,r1,u1]],fill,kind);
    };
    // Large exposed tyres, suspension arms and coloured rims give the model
    // the open-wheel silhouette of a 1/10 off-road buggy.
    for(let f of [-.57,.60]){
      box(f-.07,f+.07,-.96,.96,-.73,-.56,dark,'car-suspension');
      for(let r of [-1.10,1.10]){
      box(f-.25,f+.25,r-.24,r+.24,-1.12,.16,'#111614','car-wheel');
      let side=r<0?r-.255:r+.255,ring=[];for(let i=0;i<12;i++){let angle=i*Math.PI*2/12;ring.push(corner(f+Math.cos(angle)*.17,side,-.47+Math.sin(angle)*.43));}
      faces.push(polygon(ring,wheel,'#090d0b','car-hub'));
      }
    }
    // The chassis and shell stay narrow between the wheels, with a pointed
    // nose and a raised central cockpit rather than a full-width sedan body.
    box(-.78,.68,-.46,.46,-.78,-.31,dark,'car-chassis');
    box(.36,.94,-.34,.34,-.69,-.18,accent,'car-nose');
    box(-.48,.12,-.64,-.38,-.60,-.12,body,'car-sidepod');
    box(-.48,.12,.38,.64,-.60,-.12,body,'car-sidepod');
    let sections=[[-.60,.38,-.18],[-.34,.45,.48],[-.04,.40,.92],[.25,.35,.62],[.48,.31,.10],[.66,.26,-.16]];
    for(let i=0;i<sections.length-1;i++){
      let [fa,wa,ua]=sections[i],[fb,wb,ub]=sections[i+1];
      quad([[fa,-wa,ua],[fb,-wb,ub],[fb,wb,ub],[fa,wa,ua]],i===1?glass:body,'car-shell');
      quad([[fa,-wa,-.25],[fb,-wb,-.25],[fb,-wb,ub],[fa,-wa,ua]],dark,'car-shell');
      quad([[fa,wa,-.25],[fa,wa,ua],[fb,wb,ub],[fb,wb,-.25]],colour(body,.74),'car-shell');
    }
    // Rear wing and mounts, proportioned like a 1/10 off-road buggy.
    box(-1.02,-.84,-1.18,1.18,.58,.80,accent,'car-wing');
    box(-.89,-.82,-.48,-.36,-.24,.62,dark,'car-wing-mount');
    box(-.89,-.82,.36,.48,-.24,.62,dark,'car-wing-mount');
    quad([[-.25,-.37,.69],[.20,-.32,.57],[.20,.32,.57],[-.25,.37,.69]],glass,'car-window');
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
    this.autoRotate=false;this.flyover=false;this.flyoverPaused=false;cancelAnimationFrame(this.frame);this.frame=0;this.container.querySelector('[data-action="rotate"]')?.classList.remove('active');this.container.querySelector('[data-action="flyover"]')?.classList.remove('active');this.flightControls?.classList.remove('active');if(this.flightPauseButton){this.flightPauseButton.textContent='Ⅱ Pause';this.flightPauseButton.classList.remove('active');}if(this.help)this.help.textContent='Drag to orbit · right-drag to pan · scroll to zoom';
  }
  startAnimation(){cancelAnimationFrame(this.frame);this.lastTime=performance.now();this.lastPaintTime=this.lastTime;if(this.autoRotate||this.flyover)this.frame=requestAnimationFrame(time=>this.animate(time));}
  toggleAutoRotate(){let enable=!this.autoRotate;this.stopMotion();this.autoRotate=enable;this.container.querySelector('[data-action="rotate"]').classList.toggle('active',enable);if(enable){this.help.textContent='Automatic orbit running · drag the track to stop';this.startAnimation();}this.draw();}
  toggleFlyover(){let enable=!this.flyover;this.stopMotion();this.flyover=enable;this.flyoverPaused=false;this.flyoverProgress=this.flyoverStart;this.flyoverZoom=1;this.container.querySelector('[data-action="flyover"]').classList.toggle('active',enable);this.flightControls.classList.toggle('active',enable);if(enable){this.help.textContent=this.followCarId?'Following selected driver · use the race controls to pause · scroll to zoom':'Lap flyover running · pause, change speed, height or tilt · scroll to zoom';this.draw();setTimeout(()=>{if(this.flyover)this.startAnimation();},250);return;}this.draw();}
  toggleFlyoverPause(){if(!this.flyover)return;this.flyoverPaused=!this.flyoverPaused;this.flightPauseButton.textContent=this.flyoverPaused?'▶ Continue':'Ⅱ Pause';this.flightPauseButton.classList.toggle('active',this.flyoverPaused);this.help.textContent=this.flyoverPaused?'Lap flyover paused · camera controls remain available':'Lap flyover running · pause, change speed, height or tilt · scroll to zoom';this.lastTime=performance.now();this.draw();}
  setView(view){if(this.flyover)this.stopMotion();let preferred=Number(this.options.zoom)||1;if(view==='overhead'){this.yaw=-Math.PI/2;this.elevation=1.52;this.zoom=Math.max(.95,preferred*.82);}else if(view==='low'){this.yaw=-.8;this.elevation=.3;this.zoom=Math.max(.95,preferred*.72);}else{this.yaw=-.8;this.elevation=.72;this.zoom=preferred;}if(this.design)this.target=vec(this.design.carpet.width/2,this.design.carpet.height/2,0);this.container.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));this.draw();}
  resize(){let ratio=Math.min(2,devicePixelRatio||1),rect=this.wrap.getBoundingClientRect();this.canvas.width=Math.max(1,Math.round(rect.width*ratio));this.canvas.height=Math.max(1,Math.round(rect.height*ratio));this.draw();}
  camera(){
    let width=this.canvas.width,height=this.canvas.height;
    if(this.flyover&&this.scene?.route?.length){
      let route=this.scene.route,n=route.length,index=Math.floor(this.flyoverProgress*n)%n,lookSteps=Math.max(24,Math.round(n*.034)),point=route[index],before=route[(index-lookSteps+n)%n],ahead=route[(index+lookSteps)%n],follow=this.followCarId&&this.cars.find(car=>String(car.id)===this.followCarId);
      if(follow){let fraction=Number(follow.fraction)||0;point={x:Number(follow.x)||0,y:Number(follow.y)||0,z:(Number(follow.z)||0)*this.heightScale};before=this.routeAt(fraction-.012)||point;ahead=this.routeAt(fraction+.025)||point;}
      let direction=norm(vec(ahead.x-before.x,ahead.y-before.y,0)),position=vec(point.x-direction.x*(follow?3.3:4.1),point.y-direction.y*(follow?3.3:4.1),(point.z||0)+this.flyoverHeight),horizontalAim=norm(vec(ahead.x-position.x,ahead.y-position.y,0)),tilt=this.flyoverTilt*Math.PI/180,forward=norm(vec(horizontalAim.x*Math.cos(tilt),horizontalAim.y*Math.cos(tilt),-Math.sin(tilt))),right=norm(cross(forward,vec(0,0,1))),up=norm(cross(right,forward)),focal=Math.min(width,height)/(2*Math.tan(62*Math.PI/360))*this.flyoverZoom;
      return {width,height,position,forward,right,up,focal};
    }
    let maxSize=Math.max(this.design?.carpet.width||30,this.design?.carpet.height||18),distance=maxSize*1.3/this.zoom;
    let flat=Math.cos(this.elevation),position=add(this.target,vec(Math.cos(this.yaw)*flat*distance,Math.sin(this.yaw)*flat*distance,Math.sin(this.elevation)*distance));
    let forward=norm(sub(this.target,position)),right=norm(cross(forward,vec(0,0,1))),up=norm(cross(right,forward)),focal=Math.min(width,height)/(2*Math.tan(42*Math.PI/360));
    return {width,height,position,forward,right,up,focal};
  }
  cameraPoint(point,camera){let adjusted=vec(point.x,point.y,point.z*this.heightScale),relative=sub(adjusted,camera.position);return{x:dot(relative,camera.right),y:dot(relative,camera.up),depth:dot(relative,camera.forward)};}
  screenPoint(point,camera){return{x:camera.width/2+point.x*camera.focal/point.depth,y:camera.height/2-point.y*camera.focal/point.depth,depth:point.depth};}
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
  draw(){
    let ctx=this.ctx,width=this.canvas.width,height=this.canvas.height;ctx.clearRect(0,0,width,height);let gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,'#15281e');gradient.addColorStop(1,'#050b07');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);if(!this.scene)return;
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
      let ratio=devicePixelRatio||1,followId=this.followCarId,cars=this.flyover&&followId?this.cars.filter(car=>String(car.id)===followId):this.cars;
      ctx.font=`900 ${10*ratio}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
      let candidates=cars.map(car=>{let routePoint=Number.isFinite(car.fraction)?this.routeAt(car.fraction):null,anchor=this.project(vec(Number(car.x??routePoint?.x)||0,Number(car.y??routePoint?.y)||0,(Number(car.z)||0)+.48),camera);if(!anchor)return null;let selected=String(car.id)===followId,text=String(car.label||car.number||''),padding=(selected?5:4)*ratio,boxHeight=(selected?20:18)*ratio,boxWidth=Math.max(23*ratio,ctx.measureText(text).width+padding*2),x=clamp(anchor.x,boxWidth/2+3*ratio,width-boxWidth/2-3*ratio),y=anchor.y-8*ratio;return{car,text,selected,anchor,x,y,boxWidth,boxHeight,depth:anchor.depth};}).filter(Boolean).sort((a,b)=>Number(b.selected)-Number(a.selected)||a.depth-b.depth),accepted=[];
      for(let item of candidates){let margin=4*ratio,box={left:item.x-item.boxWidth/2-margin,right:item.x+item.boxWidth/2+margin,top:item.y-item.boxHeight/2-margin,bottom:item.y+item.boxHeight/2+margin};if(!item.selected&&accepted.some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top))continue;accepted.push(box);ctx.strokeStyle=item.car.color||'#9bec39';ctx.lineWidth=(item.selected?1.7:1.1)*ratio;ctx.beginPath();ctx.moveTo(item.anchor.x,item.anchor.y);ctx.lineTo(item.x,item.y+item.boxHeight/2);ctx.stroke();ctx.fillStyle='#07110bdc';ctx.beginPath();ctx.roundRect(item.x-item.boxWidth/2,item.y-item.boxHeight/2,item.boxWidth,item.boxHeight,6*ratio);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.fillText(item.text,item.x,item.y);}
    }
    if(this.showLabels){
      ctx.font=`800 ${12*(devicePixelRatio||1)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
      for(let label of this.scene.labels){let point=this.project(label.point,camera);if(!point)continue;let padding=7*(devicePixelRatio||1),metrics=ctx.measureText(label.text),boxWidth=metrics.width+padding*2,boxHeight=25*(devicePixelRatio||1);ctx.fillStyle='#07110be6';ctx.strokeStyle='#9bec39';ctx.lineWidth=1.2*(devicePixelRatio||1);ctx.beginPath();ctx.roundRect(point.x-boxWidth/2,point.y-boxHeight/2,boxWidth,boxHeight,boxHeight/2);ctx.fill();ctx.stroke();ctx.fillStyle='#f5fff8';ctx.fillText(label.text,point.x,point.y);}
    }
  }
  animate(time=performance.now()){if(!this.autoRotate&&!this.flyover)return;if(time-this.lastPaintTime<40){this.frame=requestAnimationFrame(next=>this.animate(next));return;}let delta=Math.min(.08,(time-this.lastTime)/1000||0);this.lastTime=time;this.lastPaintTime=time;if(this.autoRotate)this.yaw+=delta*.18;if(this.flyover&&!this.flyoverPaused&&!this.followCarId)this.flyoverProgress=(this.flyoverProgress+delta*this.flyoverSpeed/Math.max(1,this.scene.routeLength))%1;this.draw();this.frame=requestAnimationFrame(next=>this.animate(next));}
  exportImage(){this.draw();let link=document.createElement('a');link.download=(this.design?.name||'COBRA-track').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')+'-3D.png';link.href=this.canvas.toDataURL('image/png');link.click();}
  async toggleFullscreen(){if(document.fullscreenElement)await document.exitFullscreen();else await this.container.requestFullscreen();}
  destroy(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();window.removeEventListener('message',this.messageHandler);this.container.replaceChildren();}
}

function mount(container,options){if(typeof container==='string')container=document.querySelector(container);if(!container)throw Error('Choose a container for the 3D track viewer.');return new Viewer(container,options);}

root.CobraTrack3D={mount,buildScene,normalizeDesign,sampleRoute,heightProfile,CATALOG};
})(typeof window!=='undefined'?window:globalThis);
