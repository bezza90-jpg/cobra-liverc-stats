const track=document.querySelector('.player .track'),bar=document.querySelector('.player .bar'),source=document.getElementById('rows');
if(track&&bar&&source){
 const button=document.createElement('button');button.type='button';button.className='timings-overlay-toggle';button.textContent='Race timings';button.setAttribute('aria-controls','track-timings-overlay');button.setAttribute('aria-pressed','true');button.title='Show or hide race timings. You can also tap the track.';bar.append(button);
 const overlay=document.createElement('section');overlay.id='track-timings-overlay';overlay.className='track-timings-overlay';overlay.setAttribute('aria-label','Race timings over the track');
 const heading=document.createElement('h2');heading.textContent='Race timings';const scroll=document.createElement('div');scroll.className='track-timings-scroll';const table=document.createElement('table');const head=document.querySelector('.standings thead');if(head)table.append(head.cloneNode(true));const body=document.createElement('tbody');table.append(body);scroll.append(table);overlay.append(heading,scroll);track.append(overlay);
 let timer=0,introDone=false,touched=false,inView=false,ghost=null,motion=null,press=null;
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const cancelIntro=()=>{touched=true;clearTimeout(timer);timer=0;motion?.cancel();ghost?.remove();ghost=null;button.classList.remove('timings-toggle-hint');};
 const setVisible=visible=>{overlay.hidden=!visible;button.setAttribute('aria-pressed',String(visible));};
 const hideIntro=()=>{timer=0;if(touched||introDone||overlay.hidden||!inView||document.visibilityState==='hidden')return;introDone=true;button.dataset.introComplete='true';
  const from=overlay.getBoundingClientRect(),to=button.getBoundingClientRect();
  if(!reduced()&&from.width&&from.height){ghost=overlay.cloneNode(true);ghost.removeAttribute('id');ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.style.cssText='position:fixed;z-index:2147483000;pointer-events:none;left:'+from.left+'px;top:'+from.top+'px;width:'+from.width+'px;height:'+from.height+'px;max-height:none;margin:0;transform-origin:center;';(document.fullscreenElement||document.body).append(ghost);const dx=to.left+to.width/2-from.left-from.width/2,dy=to.top+to.height/2-from.top-from.height/2;motion=ghost.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px) scale(.035)',opacity:0}],{duration:650,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});motion.finished.then(()=>{ghost?.remove();ghost=null;if(!touched&&overlay.hidden){button.classList.add('timings-toggle-hint');setTimeout(()=>button.classList.remove('timings-toggle-hint'),2200)}}).catch(()=>{});}
  setVisible(false);
 };
 const ready=()=>{if(!timer&&!introDone&&!touched&&inView&&source.children.length&&document.visibilityState!=='hidden')timer=setTimeout(hideIntro,2200);};
 const update=()=>{body.replaceChildren(...[...source.children].map(row=>row.cloneNode(true)));ready();};update();new MutationObserver(update).observe(source,{childList:true,subtree:true,characterData:true});
 const observer=new IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.15);ready()},{threshold:.15});observer.observe(track);document.addEventListener('visibilitychange',ready);
 button.addEventListener('click',()=>{cancelIntro();setVisible(overlay.hidden);});button.addEventListener('focus',cancelIntro);
 track.addEventListener('pointerdown',event=>{press=null;if(event.button!==0||event.target.closest('button,a,input,select,label,[role="button"]'))return;cancelIntro();press={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()};});
 track.addEventListener('pointerup',event=>{const p=press;press=null;if(!p||event.pointerId!==p.id||Math.hypot(event.clientX-p.x,event.clientY-p.y)>8||performance.now()-p.time>600||event.target.closest('button,a,input,select,label,[role="button"]'))return;setVisible(overlay.hidden);});track.addEventListener('pointercancel',()=>{press=null;});scroll.addEventListener('scroll',cancelIntro,{passive:true});
}
