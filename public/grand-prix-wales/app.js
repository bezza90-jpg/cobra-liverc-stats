const PUBLIC_ENTRIES_URL='https://grand-prix-wales-entries.bezza90.chatgpt.site/api/public-entries';
let entryAvatarPreview;
const GPW_CLASSES=['2WD','4WD','2WD Vintage','4WD Vintage','Stadium Trucks'];
const COUNTRY_CODES={'United Kingdom':'gb','England':'gb','Wales':'gb','Scotland':'gb','Northern Ireland':'gb','Ireland':'ie','Sweden':'se','Belgium':'be','Netherlands':'nl','Finland':'fi','Denmark':'dk','Germany':'de','France':'fr','Norway':'no'};

document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener("click",()=>{
  document.querySelectorAll(".site-header nav a").forEach(item=>item.removeAttribute("aria-current"));
  if(link.closest("nav"))link.setAttribute("aria-current","page");
}));

const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char]);
const safeUrl=value=>{if(value==null||String(value).trim()==='')return'';try{const url=new URL(String(value),location.href);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}};
const countryLabel=country=>{const name=String(country||'').trim();if(!name)return'';const code=COUNTRY_CODES[name]||(/^[A-Za-z]{2}$/.test(name)?name.toLowerCase():'');if(!code)return '<small class="entry-country">'+escapeHtml(name)+'</small>';let label=name;if(/^[A-Za-z]{2}$/.test(name)){try{label=new Intl.DisplayNames(['en'],{type:'region'}).of(code.toUpperCase())||name}catch{label=name}}const emoji=String.fromCodePoint(...[...code.toUpperCase()].map(char=>127397+char.charCodeAt()));return '<span class="entry-flag" role="img" aria-label="'+escapeHtml(label)+'" title="'+escapeHtml(label)+'">'+emoji+'</span>'};
const driverAvatarKey=name=>{const key=String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');return {'MATT-HODGES':'MATTHEW-HODGES','CHRISTOPHER-LEONARD':'CHRIS-LEONARD','PAUL-CURTIS':'BRUCE','PAUL-BRUCE-CURTIS':'BRUCE','BOB-GELSTHARP':'BOBTECH','BOB-BOBTECH-GELSTHARP':'BOBTECH'}[key]||key};
const avatarClassName=className=>({'2WD':'2-Wheel Drive Buggy','4WD':'4-Wheel Drive Buggy','2WD Vintage':'Vintage','4WD Vintage':'Vintage','Stadium Trucks':'Trucks'}[className]||'default');
const avatarHtml=(entry,manifest)=>{const avatar=manifest?.[driverAvatarKey(entry.name)],path=typeof avatar==='string'?avatar:avatar?.[avatarClassName(entry.className)]||avatar?.default;if(typeof path!=='string'||!path.startsWith('assets/'))return'<span class="entry-avatar-cell" aria-hidden="true"></span>';return '<span class="entry-avatar-cell"><img class="entry-avatar" src="../'+escapeHtml(path)+'" alt="'+escapeHtml(entry.name)+' car avatar" loading="lazy" decoding="async" tabindex="0" role="button" aria-label="Enlarge '+escapeHtml(entry.name)+' car avatar" title="Enlarge car avatar"></span>'};
const ensureEntryAvatarPreview=()=>{if(entryAvatarPreview)return entryAvatarPreview;entryAvatarPreview=document.createElement('img');entryAvatarPreview.className='entry-avatar-preview';entryAvatarPreview.alt='';entryAvatarPreview.hidden=true;document.body.append(entryAvatarPreview);return entryAvatarPreview};
const showEntryAvatarPreview=image=>{const preview=ensureEntryAvatarPreview(),rect=image.getBoundingClientRect(),width=Math.min(260,window.innerWidth-24),height=window.innerWidth<=680?140:170;preview.src=image.currentSrc||image.src;preview.style.width=`${width}px`;preview.style.height=`${height}px`;preview.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,rect.left+rect.width/2-width/2))}px`;preview.style.top=`${rect.bottom+height+12<window.innerHeight?rect.bottom+8:Math.max(12,rect.top-height-8)}px`;preview.hidden=false};
const hideEntryAvatarPreview=()=>{if(entryAvatarPreview)entryAvatarPreview.hidden=true};
const hydrateEntryAvatarPreviews=root=>root.querySelectorAll('.entry-avatar').forEach(image=>{image.addEventListener('pointerenter',()=>showEntryAvatarPreview(image));image.addEventListener('pointerleave',hideEntryAvatarPreview);image.addEventListener('focus',()=>showEntryAvatarPreview(image));image.addEventListener('blur',hideEntryAvatarPreview);image.addEventListener('click',event=>{event.stopPropagation();showEntryAvatarPreview(image)});image.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();showEntryAvatarPreview(image)})});
const orderPosts=(posts,preferredOrder)=>{const priorities=new Map((Array.isArray(preferredOrder)?preferredOrder:[]).map((name,index)=>[String(name).trim().toLocaleLowerCase(),index]));return posts.map((post,index)=>({post,index,priority:priorities.get(String(post?.driverName||'').trim().toLocaleLowerCase())})).sort((a,b)=>{const aRank=a.priority??Number.MAX_SAFE_INTEGER,bRank=b.priority??Number.MAX_SAFE_INTEGER;return aRank-bRank||a.index-b.index}).map(item=>item.post)};

async function loadConfirmedEntries(){
  const message=document.querySelector('#entryMessage'),classes=document.querySelector('#entryClasses');
  if(!message||!classes)return;
  try{
    const keepOpen=Boolean(classes.querySelector('details[open]'));
    const [response,avatarResponse]=await Promise.all([fetch(PUBLIC_ENTRIES_URL,{cache:'no-store'}),fetch('../data/car-avatars.json',{cache:'no-cache'}).catch(()=>null)]);
    if(!response.ok)throw new Error('The confirmed entry list is temporarily unavailable.');
    const data=await response.json(),entries=Array.isArray(data.entries)?data.entries:[],avatarManifest=avatarResponse?.ok?await avatarResponse.json():{};
    document.querySelector('#classCount').textContent=entries.length;
    document.querySelector('#driverCount').textContent=new Set(entries.map(entry=>String(entry.name||'').trim().toLocaleLowerCase()).filter(Boolean)).size;
    const updated=data.publishedAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(data.publishedAt)):'';
    message.textContent=entries.length?(updated?'Confirmed list last updated '+updated+'.':'Confirmed paid and complimentary entries.'):'No confirmed entries have been published yet. The interest list remains private.';
    classes.innerHTML=GPW_CLASSES.map((className,index)=>{
      const rows=entries.filter(entry=>entry.className===className);
      const people=rows.map(entry=>'<li><span class="entry-driver-name">'+escapeHtml(entry.name)+'</span><span class="entry-country-cell">'+countryLabel(entry.country)+'</span>'+avatarHtml(entry,avatarManifest)+'</li>').join('');
      return '<details class="entry-class-card"'+(keepOpen?' open':'')+'><summary><span class="entry-class-number">'+String(index+1).padStart(2,'0')+'</span><span class="entry-class-heading"><strong>'+escapeHtml(className)+'</strong><small>'+rows.length+' '+(rows.length===1?'entry':'entries')+'</small></span><span class="entry-class-toggle" aria-hidden="true">⌄</span></summary><div class="entry-class-body">'+(rows.length?'<div class="entry-list-head"><span>Driver</span><span>Country</span><span>Avatar</span></div><ol class="entry-list">'+people+'</ol>':'<p>Confirmed entries will appear here.</p>')+'</div></details>';
    }).join('');
    const cards=[...classes.querySelectorAll('details.entry-class-card')];
    cards.forEach(card=>card.querySelector('summary')?.addEventListener('click',event=>{event.preventDefault();const nextOpen=!card.open;cards.forEach(item=>{item.open=nextOpen})}));
    hydrateEntryAvatarPreviews(classes);
  }catch(error){
    message.textContent=error instanceof Error?error.message:'The confirmed entry list is temporarily unavailable.';
  }
}

loadConfirmedEntries();
setInterval(loadConfirmedEntries,60000);
fetch('data/announcements.json',{cache:'no-store'}).then(response=>response.json()).then(data=>{
  const posts=orderPosts(Array.isArray(data.posts)?data.posts:[],data.preferredOrder).slice(0,3),target=document.querySelector('#latestAnnouncements');if(!target||!posts.length)return;
  target.className='announcement-grid';target.innerHTML=posts.map(post=>{const image=safeUrl(post.image),postUrl=safeUrl(post.postUrl);return `<article class="announcement-card">${image?`<img src="${escapeHtml(image)}" alt="${escapeHtml(post.imageAlt||`${post.driverName||'Driver'} announcement`)}" loading="lazy">`:'<div class="announcement-placeholder">GRAND PRIX<br>OF WALES</div>'}<div class="announcement-card-body"><time>${escapeHtml(post.publishedLabel||'Grand Prix of Wales')}</time><h2>${escapeHtml(post.driverName||post.title||'Driver announcement')}</h2><p>${escapeHtml(post.summary||'Confirmed driver announcement.')}</p>${postUrl?`<a class="text-link" href="${escapeHtml(postUrl)}" target="_blank" rel="noopener">View Facebook post ↗</a>`:''}</div></article>`}).join('');
}).catch(()=>{});
