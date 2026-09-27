// Convert elapsed lap fraction to distance fraction, weighting tight bends more heavily.
// The mapping is monotonic and returns exactly 0/1 at the timing loop.
export function paceMap(points){
 const n=points.length-1;if(n<8)throw Error('Insufficient route samples');
 const turn=[];
 for(let i=0;i<n;i++){const a=points[(i-3+n)%n],b=points[i],c=points[(i+3)%n];const u=Math.atan2(b.y-a.y,b.x-a.x),v=Math.atan2(c.y-b.y,c.x-b.x);const angle=Math.abs(Math.atan2(Math.sin(v-u),Math.cos(v-u)));turn.push(1+Math.min(5,angle*10));}
 const weights=turn.map((_,i)=>{let sum=0;for(let j=-5;j<=5;j++)sum+=turn[(i+j+n)%n];return sum/11;});
 // Cap straight speed at 1.65 times the lap's average speed. Redistribute
 // the saved time without changing total lap duration or crossing times.
 const mean=weights.reduce((a,b)=>a+b,0)/n,minWeight=1/1.65;
 let low=0,high=1;
 for(let step=0;step<45;step++){const scale=(low+high)/2;const avg=weights.reduce((sum,w)=>sum+Math.max(minWeight,w/mean*scale),0)/n;if(avg>1)high=scale;else low=scale;}
 weights.forEach((w,i)=>weights[i]=Math.max(minWeight,w/mean*(low+high)/2));
 const cumulative=[0];for(let i=0;i<n;i++)cumulative.push(cumulative.at(-1)+weights[i]);const total=cumulative.at(-1);
 return fraction=>{if(fraction<=0)return 0;if(fraction>=1)return 1;const target=fraction*total;let lo=0,hi=n;while(hi-lo>1){const mid=(lo+hi)>>1;if(cumulative[mid]<=target)lo=mid;else hi=mid;}return (lo+(target-cumulative[lo])/weights[lo])/n;};
}
