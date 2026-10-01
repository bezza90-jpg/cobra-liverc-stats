const feed = document.querySelector('#newsFeed');
const status = document.querySelector('#newsStatus');
const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'H3', 'UL', 'LI', 'A']);

function safeContent(source) {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  function copy(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE || !allowed.has(node.tagName)) return document.createTextNode(node.textContent || '');
    const result = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === 'A') {
      try {
        const url = new URL(node.getAttribute('href'));
        if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
          result.href = url.href; result.target = '_blank'; result.rel = 'noopener noreferrer';
        }
      } catch {}
    }
    result.append(...Array.from(node.childNodes, copy));
    return result;
  }
  return Array.from(parsed.body.childNodes, copy);
}

async function load() {
  // Show the current item without waiting for a network round trip; the live
  // feed refresh immediately below replaces it whenever publishing changes.
  if (!feed.children.length) feed.innerHTML = '<article class="news-card"><time datetime="2026-09-30">30 September 2026</time><h2>New website and features</h2><div class="news-body"><p>As you can now see, the new COBRA website is up and running, with some hopefully interesting stats and features for you.</p><p>Anyone who has not yet, please upload an image of your car to the <a href="https://racehub.cobracardiff.co.uk/avatar-upload/" target="_blank" rel="noopener noreferrer">Driver Car Avatars Upload Page</a>.</p><p>These are used in an increasing number of areas of the site, from driver profiles to virtual race replays and the podium gallery.</p></div></article>';
  status.textContent = '';
  try {
    const response = await fetch('../data/club-news.json', {cache: 'no-cache'});
    if (!response.ok) throw Error('News unavailable');
    const data = await response.json();
    if (!Array.isArray(data.posts)) throw Error('Invalid news');
    const posts = [...data.posts].sort((a, b) => b.date.localeCompare(a.date) || (b.publishedAt || '').localeCompare(a.publishedAt || '') || b.id.localeCompare(a.id));
    feed.replaceChildren();
    for (const post of posts) {
      const article = document.createElement('article'); article.className = 'news-card';
      article.id = 'post-' + post.id;
      const time = document.createElement('time'); time.dateTime = post.date;
      time.textContent = new Date(post.date + 'T12:00:00').toLocaleDateString('en-GB', {day:'2-digit', month:'long', year:'numeric'});
      const heading = document.createElement('h2'); heading.textContent = post.title;
      const body = document.createElement('div'); body.className = 'news-body';
      body.append(...safeContent(post.html || ''));
      article.append(time, heading, body); feed.append(article);
    }
    status.textContent = posts.length ? '' : 'Club updates will appear here soon.';
  } catch {
    status.textContent = 'Club news could not be loaded. ';
    const retry = document.createElement('button'); retry.textContent = 'Try again';
    retry.addEventListener('click', load); status.append(retry);
  }
}
load();
