// The live build will read only paid entries from the GPW public-entry service.
// This standalone preview deliberately keeps the list empty.
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener("click",()=>{
  document.querySelectorAll(".site-header nav a").forEach(item=>item.removeAttribute("aria-current"));
  if(link.closest("nav"))link.setAttribute("aria-current","page");
}));

const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char]);
const safeUrl=value=>{if(value==null||String(value).trim()==='')return'';try{const url=new URL(String(value),location.href);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}};
fetch('data/announcements.json',{cache:'no-store'}).then(response=>response.json()).then(data=>{
  const posts=Array.isArray(data.posts)?data.posts.slice(0,3):[],target=document.querySelector('#latestAnnouncements');if(!target||!posts.length)return;
  target.className='announcement-grid';target.innerHTML=posts.map(post=>{const image=safeUrl(post.image),postUrl=safeUrl(post.postUrl);return `<article class="announcement-card">${image?`<img src="${escapeHtml(image)}" alt="${escapeHtml(post.imageAlt||`${post.driverName||'Driver'} announcement`)}" loading="lazy">`:'<div class="announcement-placeholder">GRAND PRIX<br>OF WALES</div>'}<div class="announcement-card-body"><time>${escapeHtml(post.publishedLabel||'Grand Prix of Wales')}</time><h2>${escapeHtml(post.driverName||post.title||'Driver announcement')}</h2><p>${escapeHtml(post.summary||'Confirmed driver announcement.')}</p>${postUrl?`<a class="text-link" href="${escapeHtml(postUrl)}" target="_blank" rel="noopener">View Facebook post ↗</a>`:''}</div></article>`}).join('');
}).catch(()=>{});
