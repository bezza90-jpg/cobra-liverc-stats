// Plan coordinates are normalized in the original image. Crop first, rotate
// second, then stretch into the template's track border. No aspect-fit padding.
export const planBorder={x:87,y:125,width:1438,height:766};
const identity={x:0,y:0,width:1,height:1};
export function gridPositions(straight,count){
 const dx=straight.to.x-straight.from.x,dy=straight.to.y-straight.from.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
 // Alternating sides: a one-metre stagger gives two metres between cars on
 // each side, using the template's thirty-metre width as the scale reference.
 const step=planBorder.width/30,heading=Math.atan2(dy,dx)*180/Math.PI;
 return Array.from({length:count},(_,i)=>({x:straight.to.x-ux*(35+i*step),y:straight.to.y-uy*(35+i*step),lane:i%2?18:-18,heading}));
}
export function planPoint(point,plan){
 const c=plan.crop||identity;let x=(point.x-c.x)/c.width,y=(point.y-c.y)/c.height;
 switch(plan.rotation||0){case 90:[x,y]=[1-y,x];break;case 180:[x,y]=[1-x,1-y];break;case 270:[x,y]=[y,1-x];break;}
 return{x:planBorder.x+x*planBorder.width,y:planBorder.y+y*planBorder.height};
}
export function routePoint(point){return{x:planBorder.x+point[0]/1000*planBorder.width,y:planBorder.y+point[1]/650*planBorder.height};}
export function routePath(points){
 if(!points||points.length<6)throw Error('A complete confirmed route is required');
 const p=points.map(routePoint),fmt=p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
 let d='M'+fmt(p[0]);
 // Round each interior corner with bounded quadratic curves. The start/end
 // stays exactly at the confirmed loop, preserving every lap crossing.
 for(let i=1;i<p.length;i++){
  const a=p[i-1],b=p[i],c=p[(i+1)%p.length],ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y),r=Math.min(24,ab*.22,bc*.22);
  if(!ab||!bc)continue;
  const before={x:b.x+(a.x-b.x)*r/ab,y:b.y+(a.y-b.y)*r/ab},after={x:b.x+(c.x-b.x)*r/bc,y:b.y+(c.y-b.y)*r/bc};
  d+=' L'+fmt(before)+' Q'+fmt(b)+' '+fmt(after);
 }
 return d+' L'+fmt(p[0])+' Z';
}
export function straightFor(points){
 // Confirmed drafts/drawings include the left-to-right top straight. Select
 // its longest near-horizontal segment, rather than boosting every straight.
 const exact=points.slice(1).map((b,i)=>({a:points[i],b})).filter(({a,b})=>b[0]-a[0]>=300&&Math.abs(b[1]-a[1])<30&&Math.max(a[1],b[1])<160).sort((a,b)=>(b.b[0]-b.a[0])-(a.b[0]-a.a[0]));
 if(exact.length)return{from:routePoint(exact[0].a),to:routePoint(exact[0].b)};
 const choices=[];let run=null;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(b[0]>a[0]&&Math.abs(b[1]-a[1])<30&&Math.max(a[1],b[1])<160){
   if(!run)run={a,b};else if(Math.abs(b[1]-run.a[1])<30)run.b=b;else{choices.push(run);run={a,b};}
  }else if(run){choices.push(run);run=null;}
 }
 if(run)choices.push(run);
 const usable=choices.filter(({a,b})=>b[0]-a[0]>100);
 usable.sort((a,b)=>(b.b[0]-b.a[0])-(a.b[0]-a.a[0]));
 if(!usable.length)throw Error('Confirm the left-to-right main straight');
 return{from:routePoint(usable[0].a),to:routePoint(usable[0].b)};
}
export function renderPlan(svg,plan){
 const ns='http://www.w3.org/2000/svg',node=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 svg.querySelector('#drawn-plan')?.remove();if(!plan)return;
 const g=node('g',{id:'drawn-plan','aria-hidden':'true'}),crop=plan.crop||identity;
 const viewport=node('svg',{...planBorder,viewBox:'0 0 1 1',preserveAspectRatio:'none',overflow:'hidden'});
 const transforms={0:'1 0 0 1 0 0',90:'0 1 -1 0 1 0',180:'-1 0 0 -1 1 1',270:'0 -1 1 0 0 1'};
 const rotation=node('g',{transform:`matrix(${transforms[plan.rotation||0]})`});
 const image=node('image',{href:plan.image,x:-crop.x/crop.width,y:-crop.y/crop.height,width:1/crop.width,height:1/crop.height,preserveAspectRatio:'none'});
 rotation.append(image);viewport.append(rotation);g.append(viewport);
 // Replace the template date as well as its original track artwork.
 g.append(node('rect',{x:490,y:8,width:950,height:73,fill:'#0b0c0c'}));
 const title=node('text',{x:970,y:51,'text-anchor':'middle',fill:'#fff','font-size':32,'font-family':'system-ui,sans-serif'});title.textContent=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(plan.date+'T12:00:00Z'));g.append(title);
 // The template's surveyed length belongs only to its original circuit.
 g.append(node('rect',{x:630,y:949,width:650,height:29,fill:'#0b0c0c'}));
 const footer=node('text',{x:955,y:971,'text-anchor':'middle',fill:'#fff','font-size':19,'font-family':'system-ui,sans-serif'});footer.textContent='CONFIRMED EVENT LAYOUT';g.append(footer);
 svg.prepend(g);
}
