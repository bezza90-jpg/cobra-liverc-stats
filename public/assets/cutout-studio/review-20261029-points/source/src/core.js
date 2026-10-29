export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function normaliseRegion(a,b,width,height){const x=clamp(Math.floor(Math.min(a.x,b.x)),0,width),y=clamp(Math.floor(Math.min(a.y,b.y)),0,height),right=clamp(Math.ceil(Math.max(a.x,b.x)),0,width),bottom=clamp(Math.ceil(Math.max(a.y,b.y)),0,height);return{x,y,width:right-x,height:bottom-y};}
export function blendRegionAlpha(before,after,width,height,rect,feather=4){const out=new Uint8ClampedArray(before),x0=clamp(rect.x,0,width),y0=clamp(rect.y,0,height),x1=clamp(rect.x+rect.width,0,width),y1=clamp(rect.y+rect.height,0,height);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*width+x,t=feather?clamp(Math.min(x-x0,y-y0,x1-1-x,y1-1-y)/feather,0,1):1;out[i]=Math.round(before[i]*(1-t)+after[i]*t);}return out;}
export function alphaToRgba(alpha){const out=new Uint8ClampedArray(alpha.length*4);for(let i=0;i<alpha.length;i++){out[i*4]=out[i*4+1]=out[i*4+2]=255;out[i*4+3]=alpha[i];}return out;}
export function simplify(points,tolerance=2){
 if(points.length<4)return points;const a=points[0],b=points.at(-1);let far=0,index=0;
 for(let i=1;i<points.length-1;i++){const p=points[i],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1),d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);if(d>far){far=d;index=i;}}
 return far>tolerance?[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]:[a,b];
}
// Extract the largest exterior contour; the actual alpha mask keeps every
// component and interior gap. The outline is an optional editing aid only.
export function exteriorContour(alpha,w,h,options={}){
 const edges=new Map(),at=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&alpha[y*w+x]>=128;
 const add=(x,y,xx,yy)=>{const k=y*(w+1)+x;if(!edges.has(k))edges.set(k,[]);edges.get(k).push({x:xx,y:yy});};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(at(x,y)){if(!at(x,y-1))add(x,y,x+1,y);if(!at(x+1,y))add(x+1,y,x+1,y+1);if(!at(x,y+1))add(x+1,y+1,x,y+1);if(!at(x-1,y))add(x,y+1,x,y);}
 let best=[],bestArea=0;
 while(edges.size){const start=edges.keys().next().value;let k=start,loop=[],guard=0;do{const x=k%(w+1),y=Math.floor(k/(w+1));loop.push({x,y});const list=edges.get(k);if(!list?.length)break;const next=list.pop();if(!list.length)edges.delete(k);k=next.y*(w+1)+next.x;}while(k!==start&&++guard<=w*h*4);
  if(k!==start||loop.length<4)continue;const area=Math.abs(loop.reduce((s,a,i)=>{const b=loop[(i+1)%loop.length];return s+a.x*b.y-b.x*a.y;},0));if(area>bestArea){bestArea=area;best=loop;}}
 if(!best.length)return[];let tolerance=options.tolerance??1.1,reduced;do{reduced=simplify([...best,best[0]],tolerance).slice(0,-1);tolerance*=1.35;}while(reduced.length>(options.maxPoints??160));return reduced;
}
export function enclosedHoles(alpha,w,h){
 const outside=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 const put=i=>{if(!outside[i]&&alpha[i]<128){outside[i]=1;queue[tail++]=i;}};
 for(let x=0;x<w;x++){put(x);put((h-1)*w+x);}for(let y=0;y<h;y++){put(y*w);put(y*w+w-1);}
 while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);if(x)put(i-1);if(x<w-1)put(i+1);if(y)put(i-w);if(y<h-1)put(i+w);}
 return Uint8ClampedArray.from(alpha,(a,i)=>outside[i]?0:255-a);
}
export function nearestPoint(p,points,radius){let best=p,d=radius;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1),q={x:a.x+t*dx,y:a.y+t*dy},n=Math.hypot(q.x-p.x,q.y-p.y);if(n<d){d=n;best=q;}}return {...best};}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(a){let c=0xffffffff;for(const b of a)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
// Store-only ZIP avoids repeated browser download prompts and dependencies.
export async function makeZip(files){let offset=0;const parts=[],central=[];for(const f of files){const name=new TextEncoder().encode(f.name),data=new Uint8Array(await f.blob.arrayBuffer()),crc=crc32(data),local=new Uint8Array(30+name.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=local.length+data.length;}
 const size=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
}
// Move a neighbourhood of an outline without snapping it back to the old edge.
export function pushContour(points, start, end, radius, bounds) {
 return points.map(p=>{const d=Math.hypot(p.x-start.x,p.y-start.y),weight=d<radius?Math.pow(1-d/radius,2):0;
  return {x:clamp(p.x+(end.x-start.x)*weight,bounds?.x??0,(bounds?.x??0)+(bounds?.width??Infinity)),y:clamp(p.y+(end.y-start.y)*weight,bounds?.y??0,(bounds?.y??0)+(bounds?.height??Infinity))};});
}
export function exportDimensions(width,height,maxEdge=0){const ratio=maxEdge>0?Math.min(1,maxEdge/Math.max(width,height)):1;return{width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};}
export function pruneContour(points,start,end,radius,closed=true){
 const dx=end.x-start.x,dy=end.y-start.y,den=dx*dx+dy*dy;
 const kept=points.filter((p,i)=>{if(!closed&&(i===0||i===points.length-1))return true;const t=den?clamp(((p.x-start.x)*dx+(p.y-start.y)*dy)/den,0,1):0;return Math.hypot(p.x-start.x-t*dx,p.y-start.y-t*dy)>radius;});
 return kept.length>=(closed?3:2)?kept:points;
}
export function simplifyContourRegion(points,rect,tolerance=2,closed=true){
 if(points.length<4||!rect)return points;
 const inside=p=>p.x>=rect.x&&p.x<=rect.x+rect.width&&p.y>=rect.y&&p.y<=rect.y+rect.height;
 if(points.every(inside)){const reduced=closed?simplify([...points,points[0]],tolerance).slice(0,-1):simplify(points,tolerance);return reduced.length>=(closed?3:2)?reduced:points;}
 // Start at an unselected vertex so a selected run spanning the closing edge
 // is simplified together. Keep the first/last selected point as boundary
 // anchors: no changed segment can extend outside this convex rectangle.
 const first=closed?points.findIndex(p=>!inside(p)):0,ordered=closed?[...points.slice(first),...points.slice(0,first)]:points;
 const keep=new Set(points);let i=0;
 while(i<ordered.length){if(!inside(ordered[i])){i++;continue;}const start=i;while(i<ordered.length&&inside(ordered[i]))i++;const run=ordered.slice(start,i);if(run.length<3)continue;const reduced=new Set(simplify(run,tolerance));for(const p of run)if(!reduced.has(p))keep.delete(p);}
 const result=points.filter(p=>keep.has(p));return result.length>=(closed?3:2)?result:points;
}
