// Visual separation only: never changes progress, lap clocks or results.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export function passingOffsets(cars,routeLength,time=0){
 const offsets=cars.map(()=>0),length=Number(routeLength),start=smooth((time-2)/2);if(!(length>0)||!start)return offsets;
 for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
  const a=cars[i],b=cars[j];if(!a.active||!b.active||!Number.isFinite(a.fraction)||!Number.isFinite(b.fraction))continue;
  // Wrapped distance also handles lapping and passes across the timing loop.
  const difference=((a.fraction-b.fraction)%1+1)%1,distance=Math.min(difference,1-difference)*length;
  const proximity=1-smooth((distance-1.25)/3.75);if(!proximity)continue;
  // A stable side prevents cars swapping lanes at the instant their order changes.
  const side=String(a.id)<String(b.id)?1:-1,separation=.48*proximity*start;
  offsets[i]+=side*separation;offsets[j]-=side*separation;
 }
 return offsets.map((offset,i)=>{const margin=Math.max(0,Number(cars[i].halfWidth||1.2)-.4),base=Number(cars[i].baseLane)||0;return clamp(base+offset,-margin,margin)-base;});
}
