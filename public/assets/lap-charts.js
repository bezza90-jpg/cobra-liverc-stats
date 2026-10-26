import {facebookComposerUrl} from './mobile-share.js?v=20261026-native-share';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const lapHighlightThresholds = { near: 0.3, slow: 1.5 };
export function lapPerformanceClass(seconds, best) {
 const delta=Number(seconds)-Number(best);
 if(!Number.isFinite(delta))return'';
 if(Math.abs(delta)<.0005)return'lap-fastest';
 if(delta<=lapHighlightThresholds.near)return'lap-near-fastest';
 if(delta>=lapHighlightThresholds.slow)return'lap-slow';
 return'';
}
export function lapLineColour(seconds,best) {
 const delta=Number(seconds)-Number(best);
 if(!Number.isFinite(delta))return'#1fe05b';
 if(delta<=lapHighlightThresholds.near+.0005)return'#1fe05b';
 if(delta>=lapHighlightThresholds.slow-.0005)return'#e32636';
 const mix=(delta-lapHighlightThresholds.near)/(lapHighlightThresholds.slow-lapHighlightThresholds.near);
 return `hsl(${Math.round(128*(1-mix))} 78% 48%)`;
}
export function chartData(race) {
  const drivers = [...(race?.drivers || [])].sort((a,b)=>(a.finalPosition || Infinity)-(b.finalPosition || Infinity)).map(d=>({...d,laps:(d.laps || []).filter(l=>Number.isInteger(l.lap)&&l.lap>0&&Number.isFinite(l.seconds)&&l.seconds>0).sort((a,b)=>a.lap-b.lap)}));
  const laps=drivers.flatMap(d=>d.laps);
  const low=laps.length?Math.min(...laps.map(l=>l.seconds)):0, high=laps.length?Math.max(...laps.map(l=>l.seconds)):1;
  const pad=Math.max(1,(high-low)*.1), min=Math.max(0,Math.floor(low-pad)), max=Math.ceil(high+pad);
  return {drivers,min,max,lastLap:Math.max(2,...laps.map(l=>l.lap))};
}
function quantile(values,fraction){if(!values.length)return 0;const index=(values.length-1)*fraction,lower=Math.floor(index),upper=Math.ceil(index);return values[lower]+(values[upper]-values[lower])*(index-lower);}
export function focusedLapScale(driver, includeOpening=false){
 const all=(driver?.laps||[]).filter(lap=>Number.isInteger(lap.lap)&&lap.lap>0&&Number.isFinite(lap.seconds)&&lap.seconds>0).sort((a,b)=>a.lap-b.lap),fullLaps=all.filter(lap=>lap.lap>1),plottedLaps=includeOpening?all:(fullLaps.length?fullLaps:all),values=plottedLaps.map(lap=>lap.seconds).sort((a,b)=>a-b);
 if(!values.length)return{min:0,max:1,plottedLaps:[]};
 const lower=values.length>=8?quantile(values,.1):values[0],upper=values.length>=8?quantile(values,.9):values.at(-1),coreSpan=Math.max(.6,upper-lower),padding=Math.max(.2,coreSpan*.18);
 let min=Math.max(0,Math.floor((lower-padding)*10)/10),max=Math.ceil((upper+padding)*10)/10;
 if(max-min<.8){const centre=(min+max)/2;min=Math.max(0,Math.floor((centre-.4)*10)/10);max=Math.ceil((centre+.4)*10)/10;}
 return{min,max,plottedLaps};
}
export function fullLapScale(driver, includeOpening=false){
 const all=(driver?.laps||[]).filter(lap=>Number.isInteger(lap.lap)&&lap.lap>0&&Number.isFinite(lap.seconds)&&lap.seconds>0).sort((a,b)=>a.lap-b.lap),fullLaps=all.filter(lap=>lap.lap>1),plottedLaps=includeOpening?all:(fullLaps.length?fullLaps:all),values=plottedLaps.map(lap=>lap.seconds);
 if(!values.length)return{min:0,max:1,plottedLaps:[]};
 const low=Math.min(...values),high=Math.max(...values),span=Math.max(.6,high-low),padding=Math.max(.2,span*.08);
 let min=Math.max(0,Math.floor((low-padding)*10)/10),max=Math.ceil((high+padding)*10)/10;
 if(max-min<.8){const centre=(min+max)/2;min=Math.max(0,Math.floor((centre-.4)*10)/10);max=Math.ceil((centre+.4)*10)/10;}
 return{min,max,plottedLaps};
}
function positionLaps(driver){
 const recorded=(driver.laps||[]).filter(l=>Number.isInteger(l.lap)&&l.lap>0&&Number.isInteger(l.position)&&l.position>0);
 const start=Number(driver.startPosition);
 return Number.isInteger(start)&&start>0?[{lap:0,position:start,start:true},...recorded]:recorded;
}
export function chartUrl(raceId,driver='') {const url=new URL('../lap-charts/',import.meta.url);url.searchParams.set('race',raceId);if(driver)url.searchParams.set('driver',driver);return url.href;}
export function chartShareUrl(raceId,driver='') {
 const suffix=encodeURIComponent(raceId)+'/'+(driver?encodeURIComponent(driver)+'/':'');
 return new URL('../lap-charts/share/'+suffix,import.meta.url).href;
}
export function facebookShareLink(raceId,driver='') {
 const target=chartShareUrl(raceId,driver),share=facebookComposerUrl(target);
 return '<a class="facebook-share" target="_blank" rel="noopener" href="'+share+'" data-native-share-url="'+escape(target)+'" aria-label="Share this result" title="Share this result"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.7 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.7-.1-1.5-.2-2.3-.2-2.3 0-3.9 1.4-3.9 4v2.3H8.2V13h2.6v8h2.9Z"/></svg></a>';
}
export function replayComparisonUrl(raceId,keys) {const url=new URL('../virtual-race-replay/',import.meta.url);url.searchParams.set('race',raceId);keys.forEach(k=>url.searchParams.append('compare',k));return url.href;}
export function positionChartMarkup(race,comparison=false){
 const {drivers,lastLap}=chartData(race),positionSeries=drivers.map(positionLaps),count=Math.max(2,drivers.length,...positionSeries.flatMap(laps=>laps.map(l=>l.position)));
 const {min,max}=chartData(race);const x=n=>comparison?55+(n-1)/(lastLap-1)*675:55+n/lastLap*675,y=n=>comparison?280-(n-min)/(max-min)*250:30+(n-1)/(count-1)*250;
 const colors=['#a3f329','#ffffff','#08cc48','#91bfa0','#d5edbb','#52dfbb','#c3c9c5','#5bb377','#e2f883','#68a995'];
 const step=Math.max(1,Math.ceil(lastLap/18));
 let hasPoints=false;
 const lines=drivers.map((d,i)=>{const color=colors[i%colors.length],segments=[],series=comparison?d.laps:positionSeries[i];for(const l of series){if(!comparison&&(!Number.isInteger(l.position)||l.position<1))continue;hasPoints=true;const prev=segments.at(-1)?.at(-1);if(!prev||l.lap!==prev.lap+1)segments.push([]);segments.at(-1).push(l);}return segments.map(a=>'<polyline fill="none" stroke="'+color+'" stroke-width="2.5" stroke-dasharray="'+(i%2?'7 3':'none')+'" points="'+a.map(l=>x(l.lap)+','+y(comparison?l.seconds:l.position)).join(' ')+'"><title>'+escape(d.name)+'</title></polyline>'+a.map(l=>'<circle tabindex="0" role="img" aria-label="'+escape(d.name)+', '+(l.start?'start position':`lap ${l.lap}`)+(comparison?', time '+l.seconds.toFixed(3)+' seconds':', position '+l.position)+'" cx="'+x(l.lap)+'" cy="'+y(comparison?l.seconds:l.position)+'" r="3" fill="'+color+'"><title>'+escape(d.name)+' · '+(l.start?'Start':`Lap ${l.lap}`)+(comparison?' · '+l.seconds.toFixed(3)+' s':' · P'+l.position)+'</title></circle>').join('')).join('');}).join('');
 if(!hasPoints)return '<h2>Race positions by lap</h2><p>Position records are unavailable for this race.</p>';
 const grid=(comparison?Array.from({length:5},(_,i)=>min+(max-min)*i/4):Array.from({length:count},(_,i)=>i+1)).map(n=>'<line x1="55" x2="730" y1="'+y(n)+'" y2="'+y(n)+'"/><text x="43" y="'+(y(n)+4)+'" text-anchor="end">'+(comparison?n.toFixed(1)+'s':'P'+n)+'</text>').join('');
 const axis=(comparison?Array.from({length:lastLap},(_,i)=>i+1):Array.from({length:lastLap+1},(_,i)=>i)).filter(n=>n===0||n===1||n===lastLap||n%step===0).map(n=>'<text x="'+x(n)+'" y="302" text-anchor="middle">'+n+'</text>').join('');
 const values=drivers.flatMap((d,i)=>(comparison?d.laps:positionSeries[i]).filter(l=>comparison||(Number.isInteger(l.position)&&l.position>0)).map(l=>'<tr><th scope="row">'+escape(d.name)+'</th><td>'+(l.start?'Start':l.lap)+'</td><td>'+(comparison?l.seconds.toFixed(3):l.position)+'</td></tr>')).join('');
 return '<div class="lap-position-summary"><h2>'+(comparison?'Compare lap times':'Race positions by lap')+'</h2><p class="lap-chart-intro">'+(comparison?'Selected drivers’ recorded lap times in seconds. Lap 1 includes the start-to-loop crossing.':'Lap 0 shows the qualifying or recorded start position; later points show the recorded position at each lap crossing, with first place at the top. Lines stop at each driver’s last recorded lap; this is not an elapsed-time replay.')+'</p>'+ (comparison?'':'<a class="lap-chart-open" href="'+escape(chartUrl(race.id))+'" target="_self" rel="noopener">Open full race charts ↗</a> '+shareLink(race.id))+' <div class="lap-chart-scroll lap-chart-expand" tabindex="0" role="region" aria-label="'+(comparison?'Compare lap times':'Race positions by lap')+'"><svg viewBox="0 0 760 330" role="group" aria-label="'+(comparison?'Compare lap times':'Race positions by lap')+'"><g class="lap-chart-grid">'+grid+axis+'<text x="390" y="326" text-anchor="middle">Lap number</text></g>'+lines+'</svg></div><ul class="lap-chart-legend">'+drivers.map((d,i)=>'<li><span style="background:'+colors[i%colors.length]+'"></span>'+escape(d.name)+(i%2?' (dashed)':'')+'</li>').join('')+'</ul><details class="lap-chart-values"><summary>View exact '+(comparison?'lap times':'positions')+'</summary><div class="lap-chart-scroll"><table><thead><tr><th>Driver</th><th>Lap</th><th>'+(comparison?'Time (seconds)':'Position')+'</th></tr></thead><tbody>'+values+'</tbody></table></div></details></div>';
}
export function lapChartMarkup(race,scaleRace=race,{showExactLaps=false,fitFullRange=false}={}) {
 const {drivers}=chartData(race),scaleData=chartData(scaleRace),lastLap=scaleData.lastLap,includeOpening=scaleRace?.isFinal===false||race?.isFinal===false,sharedScale=fitFullRange?fullLapScale({laps:drivers.flatMap(d=>d.laps)},includeOpening):focusedLapScale({laps:scaleData.drivers.flatMap(d=>d.laps)},includeOpening),min=sharedScale.min,max=sharedScale.max,x=lap=>50+(lap-1)/(lastLap-1)*680,step=Math.max(1,Math.ceil(lastLap/18)),lapTicks=Array.from({length:lastLap},(_,i)=>i+1).filter(n=>n===1||n===lastLap||n%step===0);
 const scaleDescription=fitFullRange?'This opened chart is scaled to show the selected driver’s full recorded lap-time range.':'Every driver chart in this heat uses the same focused scale, so their lap-time changes are directly comparable.';
 return '<h2>Lap times by driver</h2><p class="lap-chart-intro">'+escape(race.name||'Selected race')+' · '+scaleDescription+' '+(includeOpening?'Lap 1 is a full timed lap and counts towards the chart and averages.':fitFullRange?'Lap 1 is connected to Lap 2; the opening crossing does not set the time scale.':'Lap 1 is shown as a separate start-to-loop point but does not set the scale or connect to Lap 2.')+(fitFullRange?'':' Unusually fast or slow laps are pinned to the chart edge and remain available below.')+'</p>'+(!drivers.length?'<p>No individual lap records are available for this race.</p>':drivers.map(d=>{
  const {plottedLaps}=focusedLapScale(d,includeOpening),rawY=seconds=>155-(seconds-min)/(max-min)*130,y=seconds=>Math.max(25,Math.min(155,rawY(seconds))),ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4),segments=[];
  // Only the dedicated full chart connects the opening crossing to lap two.
  // Retain the timed-lap-only scale and fastest-lap calculations.
  const lineLaps = fitFullRange || includeOpening ? d.laps : plottedLaps;
  for(const lap of lineLaps){const previous=segments.at(-1)?.at(-1);if(!previous||lap.lap!==previous.lap+1)segments.push([]);segments.at(-1).push(lap);}
  const best=Math.min(...plottedLaps.map(l=>l.seconds)),grid=ticks.map(v=>'<line x1="50" x2="730" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="42" y="'+(y(v)+4)+'" text-anchor="end">'+v.toFixed(1)+'</text>').join(''),axis=lapTicks.map(n=>'<text x="'+x(n)+'" y="176" text-anchor="middle">'+n+'</text>').join(''),gradientPrefix=('lap-'+race.id+'-'+(d.key||d.id||d.name)).replace(/[^a-z0-9_-]/gi,'-'),gradientParts=[],lineParts=[];
  segments.forEach((series,seriesIndex)=>series.slice(1).forEach((lap,index)=>{const previous=series[index],id=gradientPrefix+'-'+seriesIndex+'-'+index;gradientParts.push('<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+x(previous.lap)+'" y1="'+y(previous.seconds)+'" x2="'+x(lap.lap)+'" y2="'+y(lap.seconds)+'"><stop offset="0" stop-color="'+lapLineColour(previous.seconds,best)+'"/><stop offset="1" stop-color="'+lapLineColour(lap.seconds,best)+'"/></linearGradient>');lineParts.push('<line class="lap-chart-line" x1="'+x(previous.lap)+'" y1="'+y(previous.seconds)+'" x2="'+x(lap.lap)+'" y2="'+y(lap.seconds)+'" style="stroke:url(#'+id+')"/>');}));
  const paths='<defs>'+gradientParts.join('')+'</defs>'+lineParts.join(''),points=d.laps.map(l=>{const classes=[(!includeOpening&&l.lap===1)||l.seconds<min||l.seconds>max?'lap-chart-outlier':'',(!includeOpening&&l.lap===1)?'':lapPerformanceClass(l.seconds,best)].filter(Boolean).join(' ');return'<circle'+(classes?' class="'+classes+'"':'')+' tabindex="0" role="button" data-chart-lap="'+l.lap+'" data-chart-time="'+l.seconds.toFixed(3)+'" aria-label="Lap '+l.lap+': '+l.seconds.toFixed(3)+' seconds" cx="'+x(l.lap)+'" cy="'+y(l.seconds)+'" r="4"><title>Lap '+l.lap+' · '+l.seconds.toFixed(3)+' s'+(l.seconds<min||l.seconds>max?' · outside focused scale':'')+'</title></circle>';}).join('');
  return '<article class="lap-chart-row"><div class="lap-chart-driver"><h3>'+escape(d.name)+'</h3><p>'+(d.finalPosition?'Finish P'+escape(d.finalPosition)+' · ':'')+d.laps.length+' recorded laps</p><a class="lap-chart-open" href="'+escape(chartUrl(race.id,d.key||d.id))+'" target="_self" rel="noopener">Open full chart ↗</a> '+shareLink(race.id,d.key||d.id)+' </div><div class="lap-chart-content">'+(!d.laps.length?'<p>No lap times recorded.</p>':'<p class="lap-point-readout" aria-live="polite">Select a point to see its lap time.</p><div class="lap-chart-scroll lap-chart-expand" tabindex="0" role="region" aria-label="'+escape(d.name)+' lap chart"><svg viewBox="0 0 760 200" role="group" aria-label="'+escape(d.name)+' lap times"><g class="lap-chart-grid">'+grid+axis+'<text x="50" y="14">Seconds</text><text x="390" y="196" text-anchor="middle">Lap number</text></g>'+paths+'<g class="lap-chart-points">'+points+'</g></svg></div><details class="lap-chart-values"'+(showExactLaps?' open':'')+'><summary>View exact lap times</summary><div class="lap-chart-scroll"><table><caption>'+escape(d.name)+' — recorded lap times</caption><thead><tr><th scope="col">Lap</th><th scope="col">Time (seconds)</th></tr></thead><tbody>'+d.laps.map(l=>'<tr class="'+(!includeOpening&&l.lap===1?'':lapPerformanceClass(l.seconds,best))+'"><th scope="row">'+l.lap+'</th><td>'+l.seconds.toFixed(3)+'</td></tr>').join('')+'</tbody></table></div></details>')+'</div></article>';
 }).join(''))+(race.omitted?.length?'<p class="lap-chart-intro">Lap records unavailable or incomplete for: '+race.omitted.map(escape).join(', ')+'. See official results for the full classification.</p>':'');
}
export function shareLink(raceId,driver=''){return facebookShareLink(raceId,driver);}
export function bindLapChartInteractions(container){
 const select=point=>{const row=point.closest('.lap-chart-row');if(!row)return;row.querySelectorAll('[data-chart-lap].lap-chart-selected').forEach(item=>item.classList.remove('lap-chart-selected'));point.classList.add('lap-chart-selected');const readout=row.querySelector('.lap-point-readout');if(readout)readout.textContent='Lap '+point.dataset.chartLap+' · '+point.dataset.chartTime+'s';};
 container.addEventListener('click',event=>{const point=event.target.closest('[data-chart-lap]');if(point&&container.contains(point))select(point);});
 container.addEventListener('keydown',event=>{const point=event.target.closest('[data-chart-lap]');if(!point||!['Enter',' '].includes(event.key))return;event.preventDefault();select(point);});
}
export function renderLapCharts(container,race,initial=[]){
 container.innerHTML=positionChartMarkup(race)+'<fieldset class="lap-chart-choices"><legend>Compare drivers</legend><p>Select two or more drivers to overlay their lap times.</p>'+race.drivers.map(d=>'<label><input type="checkbox" value="'+escape(d.key||d.id)+'" '+(initial.includes(String(d.key||d.id))?'checked':'')+'> '+escape(d.name)+'</label>').join('')+'</fieldset><div class="lap-comparison" aria-live="polite"></div>'+lapChartMarkup(race);
 const update=()=>{const keys=[...container.querySelectorAll('.lap-chart-choices input:checked')].map(e=>e.value),area=container.querySelector('.lap-comparison');if(!keys.length){area.innerHTML='';return;}const selected={...race,drivers:race.drivers.filter(d=>keys.includes(String(d.key||d.id)))},url=new URL(chartUrl(race.id)),shareUrl=chartShareUrl(race.id);keys.forEach(k=>url.searchParams.append('compare',k));area.innerHTML=positionChartMarkup(selected,true)+'<p><a class="lap-chart-open" target="_self" rel="noopener" href="'+escape(replayComparisonUrl(race.id,keys))+'">Open comparison in Virtual Replay ↗</a> · <a class="lap-chart-open" target="_self" rel="noopener" href="'+escape(url.href)+'">Open selected comparison ↗</a> · <a class="lap-chart-open" target="_blank" rel="noopener" href="'+facebookComposerUrl(shareUrl)+'" data-native-share-url="'+escape(shareUrl)+'">Share selected comparison ↗</a></p><p class="lap-chart-intro">On phones this opens the share sheet with the race overview preview attached.</p>';};
 container.onchange=e=>{if(e.target.matches('.lap-chart-choices input'))update();};bindLapChartInteractions(container);update();
}
