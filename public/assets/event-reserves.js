// Shared reserve availability; personal details and offer tokens never enter public data.
export function validReserveEndpoint(value) {
  return /^https://script.google.com/macros/s/[A-Za-z0-9_-]+/exec$/.test(String(value || ''));
}
export function applicationUrl(endpoint,eventId,className) {
  if (!validReserveEndpoint(endpoint)) return '';
  const url=new URL(endpoint);url.searchParams.set('eventId',String(eventId));url.searchParams.set('className',className);return url.href;
}
export function reserveAvailability(endpoint,eventId) {
  if (!validReserveEndpoint(endpoint)) return Promise.resolve(null);
  return new Promise(resolve=> {
    const callback='cobraReserve_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');let timer;
    const finish=data=>{clearTimeout(timer);script.remove();delete window[callback];resolve(data?.ok && data.mode==='live'?data:null);};
    window[callback]=finish;script.onerror=()=>finish(null);timer=setTimeout(()=>finish(null),10000);
    const url=new URL(endpoint);url.searchParams.set('action','availability');url.searchParams.set('eventId',String(eventId));url.searchParams.set('callback',callback);
    script.src=url.href;document.head.append(script);
  });
}
export async function addReserveActions(cards,meeting) {
  let config;try{const response=await fetch('../data/reserve-service.json',{cache:'no-cache'});if(!response.ok)return;config=await response.json();}catch{return;}
  if (!config.enabled || !validReserveEndpoint(config.endpoint)) return;
  const result=await reserveAvailability(config.endpoint,meeting.eventId);
  for (const card of cards.children) {
    const state=result?.classes?.find(c=>c.className===card.dataset.className);
    if (state?.held>0 && Number.isInteger(state.remaining) && state.remaining>=0) {
      const count=Math.min(Number(card.dataset.remaining),state.remaining);
      card.querySelector('b').textContent=count?`${count} spaces remaining`:'Class full / places held';
    }
    if (Number(card.dataset.remaining)===0) {
      const link=document.createElement('a');link.className='event-entry-source';link.textContent='Apply for reserve place';
      link.href=applicationUrl(config.endpoint,meeting.eventId,card.dataset.className);link.target='_top';card.append(link);
      if (meeting.type==='club') {
        const price=document.createElement('small');
        price.textContent='If offered a place: £10 for a first class, or £5 to add a second class (£15 total).';
        card.append(price);
      }
    }
    if (state?.held>0) {const note=document.createElement('small');note.textContent='A place is held for a private reserve offer.';card.append(note);}
  }
}
