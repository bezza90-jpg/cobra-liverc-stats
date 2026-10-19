const START_RATING=1500, K_FACTOR=1200, RATING_DIVISOR=3200, PROVISIONAL_FINALS=5, PROVISIONAL_MULTIPLIER=1.5;
const key=(driver,className)=>driver+'|'+className;
const clamp=value=>Math.max(100,Math.min(10000,value));
export function buildCRatings(eventResults=[]){
 const ratings=new Map(),races=new Map(),history=new Map(),groups=new Map();
 for(const row of eventResults){const position=Number(row[4]),tier=String(row[7]||'');if(!(position>0)||!/(?:main|final)/i.test(tier))continue;const groupKey=row[1]+'|'+row[0]+'|'+row[2];if(!groups.has(groupKey))groups.set(groupKey,[]);groups.get(groupKey).push(row);}
 const ordered=[...groups.entries()].sort((a,b)=>a[1][0][1].localeCompare(b[1][0][1])||a[0].localeCompare(b[0]));
 for(const [,rows] of ordered){const unique=[...new Map(rows.map(row=>[row[3],row])).values()].sort((a,b)=>Number(a[4])-Number(b[4])),fieldSize=unique.length;if(fieldSize<2)continue;
  const before=new Map(unique.map(row=>[row[3],ratings.get(key(row[3],row[2]))??START_RATING]));
  const changes=new Map();
  for(const row of unique){const driver=row[3],rating=before.get(driver),position=Number(row[4]),actual=(fieldSize-position)/(fieldSize-1);let expected=0;for(const opponent of unique){if(opponent[3]===driver)continue;expected+=1/(1+Math.pow(10,(before.get(opponent[3])-rating)/RATING_DIVISOR));}expected/=(fieldSize-1);const completed=races.get(key(driver,row[2]))||0,k=K_FACTOR*(completed<PROVISIONAL_FINALS?PROVISIONAL_MULTIPLIER:1);changes.set(driver,Math.round(k*(actual-expected)));}
  for(const row of unique){const driver=row[3],className=row[2],ratingKey=key(driver,className),count=(races.get(ratingKey)||0)+1,next=clamp(before.get(driver)+changes.get(driver));ratings.set(ratingKey,next);races.set(ratingKey,count);if(!history.has(ratingKey))history.set(ratingKey,[]);history.get(ratingKey).push({date:row[1],eventId:row[0],className,position:Number(row[4]),fieldSize,rating:next,change:changes.get(driver),races:count,provisional:count<PROVISIONAL_FINALS});}
 }
 return{ratings,races,history,startRating:START_RATING};
}
export function driverRatingClasses(result,driverKey){return[...result.history.entries()].filter(([ratingKey])=>ratingKey.startsWith(driverKey+'|')).map(([ratingKey,history])=>({className:ratingKey.slice(driverKey.length+1),history,current:history.at(-1)?.rating??START_RATING,peak:Math.max(START_RATING,...history.map(item=>item.rating)),finals:history.length,provisional:history.length<PROVISIONAL_FINALS})).sort((a,b)=>b.current-a.current||a.className.localeCompare(b.className));}
