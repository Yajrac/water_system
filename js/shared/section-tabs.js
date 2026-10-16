// Switch sections without reloading, preserving filters and unfinished forms.
document.querySelectorAll('.section-tabs').forEach((navigation) => {
  const tabs = Array.from(navigation.querySelectorAll('[role="tab"]'));
  function selectTab(selected) {
    tabs.forEach((tab) => {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    });
    history.replaceState(
      null,
      '',
      location.pathname + location.search + '#' + selected.getAttribute('aria-controls'),
    );
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectTab(tabs[next]);
      tabs[next].focus();
    });
  });
  const requested = tabs.find((tab) => '#' + tab.getAttribute('aria-controls') === location.hash);
  if (requested) selectTab(requested);
});
