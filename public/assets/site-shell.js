if (window.self !== window.top) document.documentElement.classList.add('cobra-embedded');
export function initSiteHeader(shell = document.querySelector('.cobra-site-header')) {
if (!shell || shell.dataset.initialized) return;
shell.dataset.initialized = 'true';
  const mobile = shell.querySelector('.cobra-mobile-menu');
  const groups = [...shell.querySelectorAll('.cobra-menu-group')];
  const desktop = matchMedia('(min-width:1051px)');
  const sync = () => { mobile.open = desktop.matches; groups.forEach(group => { group.open = false; }); };
  sync();
  desktop.addEventListener('change', sync);
  groups.forEach(group => group.addEventListener('toggle', () => {
    if (group.open) groups.filter(other => other !== group).forEach(other => { other.open = false; });
  }));
  document.addEventListener('click', event => {
    if (!shell.contains(event.target)) { groups.forEach(group => { group.open = false; }); if (!desktop.matches) mobile.open = false; }
  });
  shell.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const group = event.target.closest('.cobra-menu-group');
      if (group?.open) { group.open = false; group.querySelector('summary').focus(); }
      else if (!desktop.matches) { mobile.open = false; mobile.querySelector('summary').focus(); }
    }
  });
  initSiteSearch(shell);
}

const SEARCH_PAGES = [
  ['Home','COBRA indoor RC racing in Cardiff, club information and the latest highlights.','', 'club racing cardiff home'],
  ['Events and booking','See future COBRA meetings and book your place.','https://www.cobracardiff.co.uk/event-list','events entries guests booking book in'],
  ['Current event','Everything for the next race meeting, including entries and useful links.','event/','next meeting entries transponder chassis country'],
  ['Race day schedule','Club-day and SWORD timetables, heat order and race-day timings.','schedule/','timetable times heats finals race order'],
  ['Drivers briefing','Read the safety and race-day briefing before arrival and check-in.','briefing/','rules safety marshalling check in book in'],
  ['Race statistics','Explore LiveRC results, drivers, laps, consistency and race summaries.','','results live rc liverc laps fastest potential consistency'],
  ['Club Series','COBRA Club Series championship standings and rounds.','club/','championship table points standings 2wd 4wd'],
  ['SWORD Championship','SWORD championship standings, rounds and classes.','sword/','championship table points standings'],
  ['Podium gallery','Race winners and podium results from COBRA meetings.','podiums/','winner second third trophies results'],
  ['Virtual Race Replay','Replay races, compare drivers, view track gaps and download a replay video.','virtual-race-replay/','animation track timings download video compare race'],
  ['Driver car avatars','Browse uploaded driver cars and open driver profiles.','car-avatars/','cars buggy profile gallery drivers'],
  ['Driver distance tracker','Follow driver attendance and distance travelled to COBRA.','?tracker=1','map miles travel attendance drivers'],
  ['Setups and tips','Find shared car setups by manufacturer, class and event.','setups/','setup sheets tuning chassis car'],
  ['Upload car avatar','Send a car photograph for background removal and approval.','avatar-upload/','photo image upload cutout background car'],
  ['About COBRA','Club team, venue, location, food and nearby hotels.','about/','address directions house of sport team committee venue'],
  ['Website guides and videos','Watch help videos and read guides to the COBRA website features.','website-guides/','help tutorial instructions reel feature showcase'],
  ['Track gallery','Browse COBRA track layouts and event photographs.','https://www.cobracardiff.co.uk/track-gallery','track layout pictures photos'],
  ['Club news','Read the latest COBRA announcements and updates.','club-news/','news updates announcements'],
  ['Media','Watch and browse COBRA race media.','https://www.cobracardiff.co.uk/media','video photos gallery'],
  ['Contact COBRA','Send the club a question or request.','https://www.cobracardiff.co.uk/contact','email message enquiry question help']
];

const normalise = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const distance = (a,b) => { const row=[...Array(b.length+1).keys()]; for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const saved=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=saved;}} return row[b.length]; };
const aliases = {booking:'entries book in',book:'booking entries',entry:'entries booking',entries:'booking book in',live:'liverc results',timing:'schedule replay laps',timings:'schedule replay laps',graph:'chart laps positions',graphs:'charts laps positions',photo:'avatar gallery',photos:'avatars gallery',car:'avatar setup',cars:'avatars setups',rules:'briefing',map:'tracker location',championship:'standings points'};

function searchScore(item, query) {
  const title=normalise(item.title), body=normalise(`${item.description} ${item.keywords}`), rawTokens=normalise(query).split(' ').filter(Boolean);
  const tokens=[...new Set(rawTokens.flatMap(token=>[token,...normalise(aliases[token]).split(' ').filter(Boolean)]))];
  if(!rawTokens.length) return item.featured ? 1 : 0;
  let score=0;
  for(const token of tokens){
    if(title===token) score+=1000; else if(title.startsWith(token)) score+=650; else if(title.split(' ').some(word=>word.startsWith(token))) score+=430; else if(title.includes(token)) score+=320;
    else if(body.split(' ').some(word=>word.startsWith(token))) score+=170; else if(body.includes(token)) score+=110;
    else if(token.length>3 && `${title} ${body}`.split(' ').some(word=>Math.abs(word.length-token.length)<=1 && distance(word,token)<=1)) score+=65;
  }
  if(rawTokens.every(token=>title.includes(token)||body.includes(token))) score+=240;
  return score;
}

function initSiteSearch(shell) {
  if(!shell || shell.querySelector('.cobra-search-button')) return;
  const logo=shell.querySelector('.cobra-site-logo img');
  const root=logo ? new URL('../',logo.src) : new URL('/',location.href);
  const pages=SEARCH_PAGES.map(([title,description,href,keywords],index)=>({title,description,href:new URL(href||'./',root).href,keywords,type:'Page',featured:index<6}));
  const button=document.createElement('button');button.type='button';button.className='cobra-search-button';button.setAttribute('aria-label','Search the COBRA website');button.innerHTML='<span aria-hidden="true">⌕</span><b>Search</b>';
  shell.querySelector('.cobra-site-menu')?.append(button);
  const panel=document.createElement('div');panel.className='cobra-search-panel';panel.hidden=true;panel.innerHTML='<div class="cobra-search-backdrop"></div><section role="dialog" aria-modal="true" aria-labelledby="cobraSearchTitle"><header><div><p>COBRA WEBSITE</p><h2 id="cobraSearchTitle">Search</h2></div><button type="button" class="cobra-search-close" aria-label="Close search">×</button></header><label><span class="cobra-search-icon" aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" placeholder="Search results, drivers, replay, setups…" aria-label="Search the COBRA website"></label><p class="cobra-search-help">Type a keyword or driver name. Press <kbd>Esc</kbd> to close.</p><div class="cobra-search-results" role="list"></div><p class="cobra-search-status" role="status" aria-live="polite"></p></section>';
  document.body.append(panel);
  const input=panel.querySelector('input'),results=panel.querySelector('.cobra-search-results'),status=panel.querySelector('.cobra-search-status');let loadedDrivers=false,lastFocus=null;
  const render=()=>{const query=input.value.trim();const found=pages.map(item=>({item,score:searchScore(item,query)})).filter(match=>match.score>0).sort((a,b)=>b.score-a.score||a.item.title.localeCompare(b.item.title)).slice(0,10);results.replaceChildren();for(const {item} of found){const link=document.createElement('a');link.href=item.href;link.setAttribute('role','listitem');const copy=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('small'),type=document.createElement('em');title.textContent=item.title;description.textContent=item.description;type.textContent=item.type;copy.append(title,description);link.append(copy,type);results.append(link);}status.textContent=query?(found.length?`${found.length} best ${found.length===1?'result':'results'}`:'No matches. Try a driver name or a broader keyword.'):'Popular destinations';};
  const loadDrivers=async()=>{if(loadedDrivers)return;loadedDrivers=true;try{const response=await fetch(new URL('data/driver-directory.json',root));if(!response.ok)throw Error();const data=await response.json();for(const driver of data.drivers||[]) pages.push({title:driver.n.replace(/\b\w/g,char=>char.toUpperCase()),description:'Open driver profile, results and statistics.',href:new URL(`?driver=${encodeURIComponent(driver.k)}`,root).href,keywords:`driver racer ${driver.k}`,type:'Driver'});render();}catch{loadedDrivers=false;}};
  const close=()=>{panel.hidden=true;document.documentElement.classList.remove('cobra-search-open');lastFocus?.focus();};
  const open=()=>{lastFocus=document.activeElement;panel.hidden=false;document.documentElement.classList.add('cobra-search-open');input.value='';render();input.focus();loadDrivers();};
  button.addEventListener('click',open);panel.querySelector('.cobra-search-close').addEventListener('click',close);panel.querySelector('.cobra-search-backdrop').addEventListener('click',close);input.addEventListener('input',render);
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='ArrowDown'&&document.activeElement===input){event.preventDefault();results.querySelector('a')?.focus();}else if(event.key==='ArrowUp'&&document.activeElement?.matches('.cobra-search-results a')){event.preventDefault();(document.activeElement.previousElementSibling||input).focus();}});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();panel.hidden?open():close();}else if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)){event.preventDefault();open();}});
}

initSiteHeader();
