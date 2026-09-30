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
  status.textContent = 'Loading club news…';
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
