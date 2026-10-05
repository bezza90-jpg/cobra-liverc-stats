// Calculate distances once; each moving marker then needs only a binary search.
export function createDistanceRoute(points,distanceKm){
 const radians=Math.PI/180,cumulative=[0];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],q=Math.sin((b[0]-a[0])*radians/2)**2+Math.cos(a[0]*radians)*Math.cos(b[0]*radians)*Math.sin((b[1]-a[1])*radians/2)**2;
  cumulative.push(cumulative.at(-1)+6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q)));
 }
 return function routeAt(km,includeTravelled=true){
  const capped=Math.max(0,Math.min(Number.isFinite(km)?km:0,distanceKm));
  if(capped>=distanceKm)return{point:points.at(-1),...(includeTravelled?{travelled:points.slice()}: {})};
  const target=cumulative.at(-1)*capped/distanceKm;
  let low=1,high=points.length-1;
  while(low<high){const mid=(low+high)>>1;if(cumulative[mid]<target)low=mid+1;else high=mid;}
  const before=low-1,length=cumulative[low]-cumulative[before],fraction=length?(target-cumulative[before])/length:0;
  const a=points[before],b=points[low],point=[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];
  return{point,...(includeTravelled?{travelled:[...points.slice(0,low),point]}:{})};
 };
}
