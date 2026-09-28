if (window.self !== window.top) document.documentElement.classList.add('cobra-embedded');
const shell = document.querySelector('.cobra-site-header');
if (shell) {
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
}
