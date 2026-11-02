const track=document.querySelector('.player .track'),bar=document.querySelector('.player .bar'),source=document.getElementById('rows');
if(track&&bar&&source){
 const button=document.createElement('button');button.type='button';button.className='timings-overlay-toggle';button.textContent='Race timings';button.setAttribute('aria-controls','track-timings-overlay');button.setAttribute('aria-pressed','true');button.title='Show or hide race timings over the track';bar.append(button);
 const overlay=document.createElement('section');overlay.id='track-timings-overlay';overlay.className='track-timings-overlay';overlay.setAttribute('aria-label','Race timings over the track');
 const heading=document.createElement('h2');heading.textContent='Race timings';const scroll=document.createElement('div');scroll.className='track-timings-scroll';const table=document.createElement('table');const head=document.querySelector('.standings thead');if(head)table.append(head.cloneNode(true));const body=document.createElement('tbody');table.append(body);scroll.append(table);overlay.append(heading,scroll);track.append(overlay);
 const update=()=>body.replaceChildren(...[...source.children].map(row=>row.cloneNode(true)));
 update();new MutationObserver(update).observe(source,{childList:true,subtree:true,characterData:true});
 button.addEventListener('click',()=>{overlay.hidden=!overlay.hidden;button.setAttribute('aria-pressed',String(!overlay.hidden));});
}
