(() => {
  const grid = document.getElementById('aboutTeam');
  if (!grid) return;
  fetch('../data/about-team.json', {cache:'no-store'})
    .then(response => { if (!response.ok) throw Error('Team profiles unavailable'); return response.json(); })
    .then(data => {
      const entries = Array.isArray(data.slots) ? data.slots.slice(0,5) : [];
      grid.replaceChildren();
      entries.forEach((profile,index) => {
        if (profile.visible === false) return;
        const card = document.createElement('article');
        card.className = 'team-card';
        const photo = document.createElement('div');
        photo.className = 'team-card-photo';
        if (typeof profile.image === 'string' && /^assets\/about\/slot-[1-5]\.jpg$/.test(profile.image)) {
          const img = document.createElement('img');
          img.src = '../' + profile.image;
          img.alt = profile.name ? 'Photo of ' + profile.name : 'COBRA team member';
          img.loading = 'lazy';
          photo.append(img);
        } else {
          const placeholder = document.createElement('span');
          placeholder.textContent = 'Photo coming soon';
          photo.append(placeholder);
        }
        const content = document.createElement('div');
        content.className = 'team-card-content';
        const name = document.createElement('h3');
        name.textContent = profile.name || 'Meet team member ' + (index + 1);
        const role = document.createElement('p');
        role.className = 'team-role';
        role.textContent = profile.role || 'Role to be added';
        const bio = document.createElement('p');
        bio.textContent = profile.bio || 'Introduction coming soon.';
        content.append(name,role,bio);
        card.append(photo,content);
        grid.append(card);
      });
    })
    .catch(() => { grid.textContent = 'Team profiles are temporarily unavailable.'; });
})();
