let races=[];
fetch('../data/gpw-races.json',{cache:'no-store'}).then(r=>r.json()).then(data=>{races=Array.isArray(data.races)?data.races:[]}).catch(()=>{});
document.querySelector('#driverFinder').addEventListener('submit',event=>{
  event.preventDefault();const query=document.querySelector('#driverSearch').value.trim().toLowerCase();const output=document.querySelector('#driverResults');
  if(!query){output.innerHTML='<div class="empty-state">Enter a driver name to search.</div>';return}
  const matches=[];for(const race of races){for(const driver of race.drivers||[]){if(String(driver.name||'').toLowerCase().includes(query))matches.push({race,driver})}}
  if(!matches.length){output.innerHTML=`<div class="empty-state">No GPW races currently match “${query.replace(/[<>]/g,'')}”. Results will appear as LiveRC data is imported.</div>`;return}
  output.innerHTML=matches.map(({race,driver})=>`<article class="driver-result">${driver.avatarUrl?`<img src="${driver.avatarUrl}" alt="${driver.name} car avatar">`:'<div class="avatar-placeholder">Car avatar<br>not yet available</div>'}<div><strong>${driver.name}</strong><h3>${race.name}</h3><p>${race.className||''}${driver.position?` · P${driver.position}`:''}</p>${race.resultUrl?`<a class="text-link" target="_blank" rel="noopener" href="${race.resultUrl}">Open race result ↗</a>`:''}</div></article>`).join('');
});
