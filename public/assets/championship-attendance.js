export const attendanceEndpoint='https://script.google.com/macros/s/AKfycbxH8QavOqFCSQ93veQCyW18VJKN2bbWpDAinnSsYuh5_alhKDMiTYKBSuZtQ_m8U2T3MQ/exec';
export function currentAttendanceRound(payload,{held,remaining,today,series}){
 if(!payload?.available||payload.event?.date!==today||payload.event?.series!==series)return -1;
 const round=Number(payload.event.roundNumber);return Number.isInteger(round)&&round>held&&round<=held+remaining?round-held-1:-1;
}
export function effectiveAbsences(keys,remaining,overrides,live,round,useLive=true){
 const checked=new Set(live?.checkedInDriverKeys||[]);return Object.fromEntries(keys.map(key=>[key,Array.from({length:remaining},(_,r)=>typeof overrides[key]?.[r]==='boolean'?overrides[key][r]:Boolean(useLive&&round===r&&!checked.has(key)))]));
}
export function fetchAttendance(series,className,{timeout=15000}={}){
 return new Promise((resolve,reject)=>{const callback='cobraAttendance_'+crypto.randomUUID().replaceAll('-',''),script=document.createElement('script');let timer;const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];};window[callback]=value=>{cleanup();resolve(value)};script.onerror=()=>{cleanup();reject(Error('Live check-in could not be reached.'))};const url=new URL(attendanceEndpoint);url.search=new URLSearchParams({page:'championship-attendance',series,className,callback});script.src=url;timer=setTimeout(()=>{cleanup();reject(Error('Live check-in timed out.'))},timeout);document.head.append(script);});
}
