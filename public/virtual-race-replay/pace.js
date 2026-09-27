// Equal-distance samples of a closed route, including the repeated endpoint.
// Normalisation preserves every recorded timing-loop crossing.
export function paceMap(points, {mainStraight,straightSpeed=1.65} = {}) {
 const n=points.length-1;
 if(n<8)throw Error('Insufficient route samples');
 const wrap=i=>(i%n+n)%n;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const boost=points.slice(0,n).map(p=>{
  if(!mainStraight)return 0;
  const {from,to}=mainStraight,dx=to.x-from.x,dy=to.y-from.y,length2=dx*dx+dy*dy;
  if(!length2)return 0;
  const t=((p.x-from.x)*dx+(p.y-from.y)*dy)/length2;
  const offset=Math.abs((p.x-from.x)*dy-(p.y-from.y)*dx)/Math.sqrt(length2);
  // Ease onto the designated straight, then brake before its end.
  return smooth(t/.25)*smooth((1-t)/.2)*(1-smooth(offset/8));
 });
 const reach=Math.max(1,Math.round(n*.005));
 const bend=points.slice(0,n).map((b,i)=>{
  const a=points[wrap(i-reach)],c=points[wrap(i+reach)];
  const u=Math.atan2(b.y-a.y,b.x-a.x),v=Math.atan2(c.y-b.y,c.x-b.x);
  return Math.min(.22,Math.abs(Math.atan2(Math.sin(v-u),Math.cos(v-u)))*1.2);
 });
 const radius=Math.max(1,Math.round(n*.025));
 const weights=bend.map((_,i)=>{
  let sum=0,total=0;
  for(let j=-radius;j<=radius;j++){const w=radius+1-Math.abs(j);sum+=bend[wrap(i+j)]*w;total+=w;}
  return (1+sum/total)*(1-(1-.52*1.65/straightSpeed)*boost[i]);
 });
 // Technical sections stay near average pace; only the main straight can
 // reach its configured cap. The shorter illustrative oval needs a larger
 // relative boost for a comparable straight transit. Nothing crawls below .75x.
 const minimum=boost.map(b=>1/(1.1+(straightSpeed-1.1)*b));
 const bounded=(w,i,scale)=>Math.min(1/.75,Math.max(minimum[i],w*scale));
 let low=0,high=2;
 for(let step=0;step<60;step++){
  const scale=(low+high)/2;
  const mean=weights.reduce((sum,w,i)=>sum+bounded(w,i,scale),0)/n;
  if(mean>1)high=scale;else low=scale;
 }
 weights.forEach((w,i)=>weights[i]=bounded(w,i,(low+high)/2));
 const cumulative=[0];
 for(let i=0;i<n;i++)cumulative.push(cumulative[i]+(weights[i]+weights[wrap(i+1)])/2);
 const total=cumulative[n];
 const mapping=fraction=>{
  if(fraction<=0)return 0;if(fraction>=1)return 1;
  const target=fraction*total;let lo=0,hi=n;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(cumulative[mid]<=target)lo=mid;else hi=mid;}
  // Integrate linear weights to keep speed continuous, including at the seam.
  const w=weights[lo],delta=weights[wrap(lo+1)]-w,area=target-cumulative[lo];
  const offset=2*area/(w+Math.sqrt(w*w+2*delta*area));
  return (lo+offset)/n;
 };
 mapping.timeAtDistance=distance=>{
  const sample=Math.max(0,Math.min(1,distance))*n,i=Math.min(n-1,Math.floor(sample)),t=sample-i;
  return (cumulative[i]+weights[i]*t+(weights[wrap(i+1)]-weights[i])*t*t/2)/total;
 };
 return mapping;
}
