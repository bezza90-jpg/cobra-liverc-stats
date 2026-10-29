const PUBLIC_ENTRIES_URL='https://grand-prix-wales-entries.bezza90.chatgpt.site/api/public-entries';
let entryAvatarPreview;
let confirmedEntries=[];
let confirmedAvatarManifest={};
let confirmedEntriesFingerprint='';
const GPW_CLASSES=['2WD','4WD','2WD Vintage','4WD Vintage','Stadium Trucks'];
const COUNTRY_CODES={'United Kingdom':'gb','England':'gb','Wales':'gb','Scotland':'gb','Northern Ireland':'gb','Ireland':'ie','Sweden':'se','Belgium':'be','Netherlands':'nl','Finland':'fi','Denmark':'dk','Germany':'de','France':'fr','Norway':'no'};
const CHASSIS_LOGOS={'team associated':'team-associated','associated':'team-associated','schumacher':'schumacher','kyosho':'kyosho','xray':'xray','yokomo':'yokomo','tlr':'tlr','team losi racing':'tlr','sworkz':'sworkz','agama':'agama','tamiya':'tamiya','pr':'pr','pr racing':'pr','r1 wurks':'r1-wurks'};

document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener("click",()=>{
  document.querySelectorAll(".site-header nav a").forEach(item=>item.removeAttribute("aria-current"));
  if(link.closest("nav"))link.setAttribute("aria-current","page");
}));

const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char]);
const safeUrl=value=>{if(value==null||String(value).trim()==='')return'';try{const url=new URL(String(value),location.href);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}};
const countryLabel=country=>{const name=String(country||'').trim();if(!name)return'';const code=COUNTRY_CODES[name]||(/^[A-Za-z]{2}$/.test(name)?name.toLowerCase():'');if(!code)return '<small class="entry-country">'+escapeHtml(name)+'</small>';let label=name;if(/^[A-Za-z]{2}$/.test(name)){try{label=new Intl.DisplayNames(['en'],{type:'region'}).of(code.toUpperCase())||name}catch{label=name}}const supported=['gb','ie','se','be','nl','fi','dk','de','fr','no'];if(!supported.includes(code))return '<small class="entry-country">'+escapeHtml(code.toUpperCase())+'</small>';return '<img class="entry-flag-image" src="assets/flags/'+escapeHtml(code)+'.svg" alt="'+escapeHtml(label)+'" title="'+escapeHtml(label)+'" width="32" height="20" loading="lazy" decoding="async">'};
const chassisHtml=entry=>{const name=String(entry?.chassis||'').trim(),slug=CHASSIS_LOGOS[name.toLocaleLowerCase()];if(!name)return'<span class="entry-chassis-cell entry-chassis-missing" aria-label="Chassis not supplied">—</span>';if(!slug)return'<span class="entry-chassis-cell entry-chassis-text" title="'+escapeHtml(name)+'">'+escapeHtml(name)+'</span>';return '<span class="entry-chassis-cell"><img class="entry-chassis-logo" src="../assets/manufacturers/'+escapeHtml(slug)+'.png" alt="'+escapeHtml(name)+'" title="'+escapeHtml(name)+'" loading="lazy" decoding="async" onerror="this.parentNode.classList.add(\'entry-chassis-text\');this.parentNode.textContent=this.alt"></span>'};
const driverAvatarKey=name=>{const key=String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');return {'MATT-HODGES':'MATTHEW-HODGES','CHRISTOPHER-LEONARD':'CHRIS-LEONARD','PAUL-CURTIS':'BRUCE','PAUL-BRUCE-CURTIS':'BRUCE','BOB-GELSTHARP':'BOBTECH','BOB-BOBTECH-GELSTHARP':'BOBTECH'}[key]||key};
const avatarClassName=className=>({'2WD':'2-Wheel Drive Buggy','4WD':'4-Wheel Drive Buggy','2WD Vintage':'Vintage','4WD Vintage':'Vintage','Stadium Trucks':'Trucks'}[className]||'default');
const avatarThumbnailPath=path=>String(path||'').replace(/^assets\/car-avatars\//,'assets/car-avatar-thumbnails/').replace(/\.[^.]+$/,'.webp');
const avatarHtml=(entry,manifest)=>{const avatar=manifest?.[driverAvatarKey(entry.name)],path=typeof avatar==='string'?avatar:avatar?.[avatarClassName(entry.className)]||avatar?.default;if(typeof path!=='string'||!path.startsWith('assets/'))return'<span class="entry-avatar-cell" aria-hidden="true"></span>';const thumbnail=avatarThumbnailPath(path);return '<span class="entry-avatar-cell"><img class="entry-avatar" src="../'+escapeHtml(thumbnail)+'" data-full-src="../'+escapeHtml(path)+'" alt="'+escapeHtml(entry.name)+' car avatar" loading="lazy" decoding="async" tabindex="0" role="button" aria-label="Enlarge '+escapeHtml(entry.name)+' car avatar" title="Enlarge car avatar"></span>'};
const ensureEntryAvatarPreview=()=>{if(entryAvatarPreview)return entryAvatarPreview;entryAvatarPreview=document.createElement('img');entryAvatarPreview.className='entry-avatar-preview';entryAvatarPreview.alt='';entryAvatarPreview.hidden=true;document.body.append(entryAvatarPreview);return entryAvatarPreview};
const showEntryAvatarPreview=image=>{const preview=ensureEntryAvatarPreview(),rect=image.getBoundingClientRect(),width=Math.min(260,window.innerWidth-24),height=window.innerWidth<=680?140:170,fullSrc=image.dataset.fullSrc||image.currentSrc||image.src;if(preview.src!==new URL(fullSrc,location.href).href)preview.src=fullSrc;preview.style.width=`${width}px`;preview.style.height=`${height}px`;preview.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,rect.left+rect.width/2-width/2))}px`;preview.style.top=`${rect.bottom+height+12<window.innerHeight?rect.bottom+8:Math.max(12,rect.top-height-8)}px`;preview.hidden=false};
const hideEntryAvatarPreview=()=>{if(entryAvatarPreview)entryAvatarPreview.hidden=true};
const hydrateEntryAvatarPreviews=root=>root.querySelectorAll('.entry-avatar').forEach(image=>{image.addEventListener('pointerenter',()=>showEntryAvatarPreview(image));image.addEventListener('pointerleave',hideEntryAvatarPreview);image.addEventListener('focus',()=>showEntryAvatarPreview(image));image.addEventListener('blur',hideEntryAvatarPreview);image.addEventListener('click',event=>{event.stopPropagation();showEntryAvatarPreview(image)});image.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();showEntryAvatarPreview(image)})});
const orderPosts=(posts,preferredOrder)=>{const priorities=new Map((Array.isArray(preferredOrder)?preferredOrder:[]).map((name,index)=>[String(name).trim().toLocaleLowerCase(),index]));return posts.map((post,index)=>({post,index,priority:priorities.get(String(post?.driverName||'').trim().toLocaleLowerCase())})).sort((a,b)=>{const aRank=a.priority??Number.MAX_SAFE_INTEGER,bRank=b.priority??Number.MAX_SAFE_INTEGER;return aRank-bRank||a.index-b.index}).map(item=>item.post)};

function renderConfirmedEntries(){
  const classes=document.querySelector('#entryClasses'),search=document.querySelector('#entrySearch'),status=document.querySelector('#entrySearchStatus');
  if(!classes)return;
  const query=String(search?.value||'').trim().toLocaleLowerCase();
  const entries=query?confirmedEntries.filter(entry=>String(entry.name||'').toLocaleLowerCase().includes(query)):confirmedEntries;
  const isMobile=window.matchMedia('(max-width:760px)').matches;
  const existingCards=[...classes.querySelectorAll('details.entry-class-card')];
  const openClasses=new Set(existingCards.filter(card=>card.open).map(card=>card.dataset.class));
  const hadCards=existingCards.length>0;
  classes.innerHTML=GPW_CLASSES.map((className,index)=>{
    const rows=entries.filter(entry=>entry.className===className);
    const people=rows.map(entry=>'<li><span class="entry-driver-name">'+escapeHtml(entry.name)+'</span>'+chassisHtml(entry)+'<span class="entry-country-cell">'+countryLabel(entry.country)+'</span>'+avatarHtml(entry,confirmedAvatarManifest)+'</li>').join('');
    const shouldOpen=rows.length&&(!isMobile||query||openClasses.has(className)||(!hadCards&&index===0));
    return '<details class="entry-class-card" data-class="'+escapeHtml(className)+'"'+(shouldOpen?' open':'')+'><summary><span class="entry-class-number">'+String(index+1).padStart(2,'0')+'</span><span class="entry-class-heading"><strong>'+escapeHtml(className)+'</strong><small>'+rows.length+' '+(rows.length===1?'entry':'entries')+'</small></span><span class="entry-class-toggle" aria-hidden="true">⌄</span></summary><div class="entry-class-body">'+(rows.length?'<div class="entry-list-head"><span>Driver</span><span>Chassis</span><span>Flag</span><span>Car</span></div><ol class="entry-list">'+people+'</ol>':'<p>'+(query?'No matching drivers in this class.':'Confirmed entries will appear here.')+'</p>')+'</div></details>';
  }).join('');
  if(status)status.textContent=query?(entries.length?entries.length+' matching class '+(entries.length===1?'entry':'entries')+'.':'No confirmed drivers match “'+String(search.value).trim()+'”.'):'';
  const cards=[...classes.querySelectorAll('details.entry-class-card')];
  cards.forEach(card=>card.querySelector('summary')?.addEventListener('click',event=>{event.preventDefault();const nextOpen=!card.open;if(window.matchMedia('(max-width:760px)').matches){cards.forEach(item=>{item.open=item===card?nextOpen:false});return}cards.forEach(item=>{item.open=nextOpen})}));
  hydrateEntryAvatarPreviews(classes);
}

const avatarManifestPromise=fetch('../data/car-avatars.json',{cache:'no-cache'}).then(response=>response.ok?response.json():{}).catch(()=>({}));
avatarManifestPromise.then(manifest=>{confirmedAvatarManifest=manifest;if(confirmedEntries.length)renderConfirmedEntries()});

async function loadConfirmedEntries(){
  const message=document.querySelector('#entryMessage'),classes=document.querySelector('#entryClasses');
  if(!message||!classes)return;
  try{
    const response=await fetch(PUBLIC_ENTRIES_URL,{cache:'no-store'});
    if(!response.ok)throw new Error('The confirmed entry list is temporarily unavailable.');
    const data=await response.json(),entries=Array.isArray(data.entries)?data.entries:[];
    const fingerprint=JSON.stringify([data.publishedAt||'',entries]);
    const entriesChanged=fingerprint!==confirmedEntriesFingerprint;
    confirmedEntries=entries;
    confirmedEntriesFingerprint=fingerprint;
    document.querySelector('#classCount').textContent=entries.length;
    document.querySelector('#driverCount').textContent=new Set(entries.map(entry=>String(entry.name||'').trim().toLocaleLowerCase()).filter(Boolean)).size;
    const updated=data.publishedAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(data.publishedAt)):'';
    message.textContent=entries.length?(updated?'Confirmed list last updated '+updated+'.':'Confirmed paid and complimentary entries.'):'No confirmed entries have been published yet. The interest list remains private.';
    if(entriesChanged||!classes.querySelector('.entry-class-card'))renderConfirmedEntries();
  }catch(error){
    message.textContent=error instanceof Error?error.message:'The confirmed entry list is temporarily unavailable.';
  }
}

document.querySelector('#entrySearch')?.addEventListener('input',renderConfirmedEntries);
loadConfirmedEntries();
setInterval(loadConfirmedEntries,60000);
fetch('data/announcements.json',{cache:'no-store'}).then(response=>response.json()).then(data=>{
  const posts=orderPosts(Array.isArray(data.posts)?data.posts:[],data.preferredOrder).slice(0,3),target=document.querySelector('#latestAnnouncements');if(!target||!posts.length)return;
  target.className='announcement-grid';target.innerHTML=posts.map(post=>{const image=safeUrl(post.image),postUrl=safeUrl(post.postUrl);return `<article class="announcement-card">${image?`<img src="${escapeHtml(image)}" alt="${escapeHtml(post.imageAlt||`${post.driverName||'Driver'} announcement`)}" loading="lazy">`:'<div class="announcement-placeholder">GRAND PRIX<br>OF WALES</div>'}<div class="announcement-card-body"><time>${escapeHtml(post.publishedLabel||'Grand Prix of Wales')}</time><h2>${escapeHtml(post.driverName||post.title||'Driver announcement')}</h2><p>${escapeHtml(post.summary||'Confirmed driver announcement.')}</p>${postUrl?`<a class="text-link" href="${escapeHtml(postUrl)}" target="_blank" rel="noopener">View Facebook post ↗</a>`:''}</div></article>`}).join('');
}).catch(()=>{});
