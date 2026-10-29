// Draft mobile filters separately so search continues using applied values.
(() => {
  const mobile = window.matchMedia('(max-width: 600px)');
  document.querySelectorAll('.inline-record-toolbar, .service-toolbar').forEach((toolbar, index) => {
    const search = toolbar.querySelector('input[type="search"], input[id$="Search"]');
    if (!search) return;
    const searchLabel = search.closest('label');
    let originals = toolbar.querySelector('.inline-record-filter-fields');
    if (!originals) {
      const children = [...toolbar.children].filter((child) => child !== searchLabel);
      if (!children.some((child) => child.querySelector('input, select'))) return;
      originals = document.createElement('div');
      originals.className = 'mobile-filter-originals';
      children.forEach((child) => originals.appendChild(child));
      toolbar.appendChild(originals);
    }
    const fields = [...originals.querySelectorAll('input, select')];
    if (!fields.length) return;
    originals.classList.add('mobile-filter-source');
    toolbar.classList.add('has-mobile-filters');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn mobile-filter-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    const icon = document.createElement('i');
    icon.className = 'bi bi-funnel';
    icon.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('span');
    toggle.append(icon, caption);
    const panel = document.createElement('div');
    panel.id = 'mobile-filter-panel-' + index;
    panel.className = 'mobile-filter-panel';
    panel.hidden = true;
    toggle.setAttribute('aria-controls', panel.id);
    let drafts = [];
    const updateCount = () => {
      const count = fields.filter((field) => {
        const neutral = field.tagName === 'SELECT' ? field.options[0]?.value || '' : '';
        return field.value !== neutral;
      }).length;
      caption.textContent = count ? 'Filters (' + count + ')' : 'Filters';
    };
    const close = () => {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };
    const apply = (clear = false) => {
      const changed = [];
      fields.forEach((field, i) => {
        const value = clear ? (field.tagName === 'SELECT' ? field.options[0]?.value || '' : '') : drafts[i].value;
        if (field.value !== value) { field.value = value; changed.push(field); }
      });
      // Existing page handlers read all updated values, retaining their validation.
      changed.forEach((field) => field.dispatchEvent(new Event('change', { bubbles: true })));
      updateCount();
      close();
      toggle.focus();
    };
    const open = () => {
      panel.replaceChildren();
      drafts = fields.map((field) => {
        const originalLabel = field.closest('label');
        const label = originalLabel.cloneNode(true);
        label.removeAttribute('for');
        label.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
        const draft = label.querySelector('input, select');
        draft.removeAttribute('name');
        draft.value = field.value;
        panel.appendChild(label);
        return draft;
      });
      const actions = document.createElement('div');
      actions.className = 'mobile-filter-actions';
      for (const [text, clear] of [['Clear', true], ['Apply filters', false]]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn' + (clear ? '' : ' btn-primary');
        button.textContent = text;
        button.addEventListener('click', () => apply(clear));
        actions.appendChild(button);
      }
      panel.appendChild(actions);
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    };
    toggle.addEventListener('click', () => panel.hidden ? open() : close());
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { close(); toggle.focus(); }
      if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); apply(); }
    });
    toolbar.insertBefore(toggle, originals);
    toolbar.appendChild(panel);
    fields.forEach((field) => field.addEventListener('change', updateCount));
    originals.querySelectorAll('button').forEach((button) => button.addEventListener('click', updateCount));
    mobile.addEventListener('change', () => { close(); updateCount(); });
    // Select options and default dates may arrive from the API after page startup.
    new MutationObserver(updateCount).observe(originals, { childList: true, subtree: true });
    updateCount();
  });
})();
