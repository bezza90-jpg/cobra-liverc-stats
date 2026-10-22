const readJson=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error(`Could not load ${path}`);return response.json()};
const activate=(element,url,label)=>{if(!url)return;element.href=url;element.textContent=label;element.removeAttribute('aria-disabled');element.target='_blank';element.rel='noopener'};
Promise.all([readJson('../data/event-config.json'),readJson('../data/gpw-races.json')]).then(([config,data])=>{
  const races=Array.isArray(data.races)?data.races:[];
  document.querySelector('#raceCount').textContent=String(races.length);
  document.querySelector('#raceStatusText').textContent=races.length?`Updated race information is available for ${races.length} races.`:(config.liveRcEventUrl?'Connected to the GPW LiveRC event; waiting for published races.':'Waiting for the GPW LiveRC event URL.');
  activate(document.querySelector('#liveRcLink'),config.liveRcEventUrl,'Open official LiveRC results ↗');
  activate(document.querySelector('#replay2dLink'),config.replay2dUrl,'Open 2D replay →');
  activate(document.querySelector('#replay3dLink'),config.replay3dUrl,'Open 3D replay →');
  if(!races.length)return;
  document.querySelector('#raceList').innerHTML=races.map(r=>`<article class="info-card"><span class="status-chip ready">${r.day||'Race day'}</span><h3>${r.name||'Race'}</h3><p>${r.className||''}${r.round?` · ${r.round}`:''}</p><div class="link-row">${r.resultUrl?`<a class="text-link" target="_blank" rel="noopener" href="${r.resultUrl}">Official result ↗</a>`:''}${r.replayUrl?`<a class="text-link" href="${r.replayUrl}">Watch replay →</a>`:''}</div></article>`).join('');
}).catch(()=>{document.querySelector('#raceStatusText').textContent='Race data is not available yet.'});
