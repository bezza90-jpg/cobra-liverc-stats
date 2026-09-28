const root = new URL('../', import.meta.url);
const header = document.querySelector('body > header:not(.cobra-site-header)');
const home = header.querySelector('a');
const logo = document.createElement('img');
logo.src = new URL('assets/cobra-logo.png', root).href;
logo.alt = 'COBRA Cardiff';
logo.width = 230;
logo.style.cssText = 'display:block;max-width:75vw;height:auto;margin-bottom:18px';
home.replaceChildren(logo);
const nav = document.createElement('nav');
nav.setAttribute('aria-label', 'Chart navigation');
nav.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin:16px 0';
const links = [['Race Statistics', new URL('./#raceExplorer', root)], ['Virtual Replay', new URL('virtual-race-replay/', root)], ['Website guides', new URL('website-guides/', root)], ['COBRA home', new URL('https://www.cobracardiff.co.uk/')]];
for (const [name, url] of links) {
  const a = document.createElement('a');
  a.textContent = name;
  a.href = url.href;
  a.style.cssText = 'padding:10px 14px;border:1px solid #6c8a6d;border-radius:7px;text-decoration:none;color:#fff;background:#122b19';
  if (name === 'Virtual Replay') {
    const update = () => {
      const params = new URLSearchParams(location.search);
      const race = document.body.dataset.race || params.get('race');
      if (race) url.searchParams.set('race', race);
      url.searchParams.delete('compare');
      const checked = [...document.querySelectorAll('.lap-chart-choices input:checked')].map(input => input.value);
      const drivers = checked.length ? checked : params.getAll('compare');
      if (!drivers.length && document.body.dataset.driver) drivers.push(document.body.dataset.driver);
      drivers.forEach(driver => url.searchParams.append('compare', driver));
      a.href = url.href;
    };
    update();
    a.addEventListener('click', update);
  }
  nav.append(a);
}
header.append(nav);
