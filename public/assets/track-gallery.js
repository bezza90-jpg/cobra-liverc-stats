const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char]);
const dateLabel=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${value}T12:00:00Z`));
let events=[],plans={},gallery={events:{},flyoverEvents:[]},activeId='',lightboxItems=[],lightboxIndex=0;

const planFor=event=>plans[event.id]||plans[`date:${event.date}`]||null;
const designAvailable=event=>gallery.flyoverEvents.includes(String(event.id));
const threeDAvailable=event=>Boolean(planFor(event)||designAvailable(event));

function actionLink(label,href,className=''){
  return `<a class="${className}" href="${escapeHtml(href)}"${href.startsWith('http')?' target="_blank" rel="noopener"':''}>${escapeHtml(label)}</a>`;
}
function photoPlaceholder(index){return `<div class="track-photo-placeholder"><div><strong>Photo ${index}</strong><span>Ready for this event’s track photograph.</span></div></div>`;}
function renderEvent(id,updateAddress=true){
  const event=events.find(item=>String(item.id)===String(id))||events[0];if(!event)return;
  activeId=String(event.id);const plan=planFor(event),entry=gallery.events?.[activeId]||{},photos=Array.isArray(entry.photos)?entry.photos:[];
  $('eventTitle').textContent=event.name;$('eventMeta').textContent=dateLabel(event.date);
  const race=encodeURIComponent(event.defaultRace||''),eventId=encodeURIComponent(event.id),links=[];
  links.push(actionLink('Event results ↗',`https://cobracardiff.liverc.com/results/?p=view_event&id=${eventId}`,'results'));
  links.push(actionLink('2D replay',`../virtual-race-replay/?event=${eventId}&race=${race}`,'primary'));
  if(threeDAvailable(event))links.push(actionLink('3D replay',`../virtual-race-replay/3d.html?event=${eventId}&race=${race}`));
  if(designAvailable(event))links.push(actionLink('Track flyover',`../virtual-race-replay/3d.html?event=${eventId}&race=${race}&flyover=track`,'flyover'));
  $('eventActions').innerHTML=links.join('');
  $('designStatus').textContent=designAvailable(event)?'Measured 3D design':plan?'Track plan available':'Awaiting plan';
  const image=plan?.image?`../virtual-race-replay/${plan.image}`:'';
  $('designImageButton').hidden=!image;$('designPlaceholder').hidden=Boolean(image);
  if(image){$('designImage').src=image;$('designImage').alt=`${event.name} track design`;$('designImageButton').dataset.image=image;$('designImageButton').dataset.caption=`${event.name} track design`;}
  $('photoSource').href=entry.sourcePost||gallery.facebookGroup||'https://www.facebook.com/groups/cobracardiff';
  $('photoScroller').innerHTML=photos.length?photos.map((photo,index)=>`<button class="track-photo" type="button" data-image="${escapeHtml(photo.image)}" data-caption="${escapeHtml(photo.caption||`${event.name} track photograph ${index+1}`)}"><img src="${escapeHtml(photo.image)}" alt="${escapeHtml(photo.caption||`${event.name} track photograph ${index+1}`)}" loading="lazy"><span>View fullscreen</span></button>`).join(''):[1,2,3].map(photoPlaceholder).join('');
  lightboxItems=[...(image?[{image,caption:`${event.name} track design`}]:[]),...photos];
  $('eventSelect').value=activeId;document.querySelectorAll('[data-event-id]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.eventId)===activeId?'true':'false'));
  if(updateAddress){const url=new URL(location.href);url.searchParams.set('event',activeId);history.replaceState({},'',url);}
}
function renderArchive(){
  const years=new Map();for(const event of events){const year=event.date.slice(0,4);if(!years.has(year))years.set(year,[]);years.get(year).push(event);}
  $('trackArchive').innerHTML=[...years].map(([year,items],index)=>`<details ${index===0?'open':''}><summary>${year}<span>${items.length}</span></summary><div>${items.map(event=>`<button type="button" data-event-id="${event.id}"><strong>${escapeHtml(event.name)}</strong><small>${dateLabel(event.date)}${designAvailable(event)?' · 3D flyover':''}</small></button>`).join('')}</div></details>`).join('');
  $('eventSelect').innerHTML=events.map(event=>`<option value="${event.id}">${dateLabel(event.date)} — ${escapeHtml(event.name)}</option>`).join('');
  $('trackArchive').addEventListener('click',event=>{const button=event.target.closest('[data-event-id]');if(button)renderEvent(button.dataset.eventId);});
  $('eventSelect').addEventListener('change',event=>renderEvent(event.target.value));
}
function openLightbox(image,caption){
  const found=lightboxItems.findIndex(item=>item.image===image);lightboxIndex=found<0?0:found;
  $('lightboxImage').src=image;$('lightboxImage').alt=caption;$('lightboxCaption').textContent=caption;$('trackLightbox').hidden=false;document.body.classList.add('track-lightbox-open');$('lightboxClose').focus();
  if(document.fullscreenEnabled&&$('trackLightbox').requestFullscreen)$('trackLightbox').requestFullscreen().catch(()=>{});
}
function showLightbox(offset){if(!lightboxItems.length)return;lightboxIndex=(lightboxIndex+offset+lightboxItems.length)%lightboxItems.length;const item=lightboxItems[lightboxIndex];$('lightboxImage').src=item.image;$('lightboxImage').alt=item.caption||'';$('lightboxCaption').textContent=item.caption||'';}
function closeLightbox(){$('trackLightbox').hidden=true;$('lightboxImage').removeAttribute('src');document.body.classList.remove('track-lightbox-open');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}

$('designImageButton').addEventListener('click',event=>openLightbox(event.currentTarget.dataset.image,event.currentTarget.dataset.caption));
$('photoScroller').addEventListener('click',event=>{const button=event.target.closest('[data-image]');if(button)openLightbox(button.dataset.image,button.dataset.caption);});
$('lightboxClose').addEventListener('click',closeLightbox);$('lightboxPrevious').addEventListener('click',()=>showLightbox(-1));$('lightboxNext').addEventListener('click',()=>showLightbox(1));
document.addEventListener('keydown',event=>{if($('trackLightbox').hidden)return;if(event.key==='Escape')closeLightbox();if(event.key==='ArrowLeft')showLightbox(-1);if(event.key==='ArrowRight')showLightbox(1);});

async function start(){
  try{const [catalogResponse,plansResponse,galleryResponse]=await Promise.all([fetch('../virtual-race-replay/catalog.json'),fetch('../virtual-race-replay/track-plans.json'),fetch('../data/track-gallery.json')]);if(!catalogResponse.ok||!plansResponse.ok||!galleryResponse.ok)throw Error('The track archive could not be loaded.');const catalog=await catalogResponse.json();plans=await plansResponse.json();gallery=await galleryResponse.json();events=Array.isArray(catalog.events)?catalog.events:[];renderArchive();const requested=new URLSearchParams(location.search).get('event');renderEvent(requested||events[0]?.id,false);}catch(error){$('eventTitle').textContent='Track gallery unavailable';$('eventMeta').textContent=error.message;}
}
start();
