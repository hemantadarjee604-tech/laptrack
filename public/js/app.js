// LabTrack front-end behaviour (no framework). Everything is progressive: pages still work without JS.
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Mobile sidebar
  $('#menuBtn')?.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#scrim')?.addEventListener('click', () => document.body.classList.remove('nav-open'));

  // Highlight the current page and open its sidebar group
  const here = $$('.nav a').find(a => a.pathname === location.pathname);
  if (here) { here.classList.add('on'); here.closest('details')?.setAttribute('open', ''); }

  // Flash messages: dismiss button + auto-hide
  $$('.flash').forEach(f => { $('.x', f)?.addEventListener('click', () => f.remove()); setTimeout(() => f.remove(), 7000); });

  // Confirm dialogs for forms with data-confirm
  document.addEventListener('submit', e => { const m = e.target.dataset.confirm; if (m && !confirm(m)) e.preventDefault(); });

  // Role dropdown submits itself
  $$('[data-autosubmit]').forEach(s => s.addEventListener('change', () => s.form.submit()));

  // Show chemical date fields only for chemical categories
  const cat = $('#category_id'), chem = $('#chemFields');
  if (cat && chem) { const t = () => { chem.hidden = cat.selectedOptions[0]?.dataset.chem !== 'true'; }; cat.addEventListener('change', t); t(); }

  // Show stock info under an item dropdown (and cap the quantity for requests)
  $$('select[data-info]').forEach(sel => {
    const out = $(sel.dataset.info), qty = sel.form.elements.quantity;
    const update = () => {
      const o = sel.selectedOptions[0];
      if (!o || !o.value) { out.textContent = ''; return; }
      out.textContent = `Available: ${o.dataset.qty} ${o.dataset.unit}`;
      if (sel.dataset.max === '1' && qty) qty.max = o.dataset.qty;
    };
    sel.addEventListener('change', update); update();
  });

  // Reject dialog
  $$('[data-reject]').forEach(b => b.addEventListener('click', () => { const d = $('#rejectDlg'); $('form', d).action = b.dataset.reject; d.showModal(); }));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  // Import page: show chosen file name, block double submit
  const imp = $('#importForm');
  if (imp) {
    const f = $('input[type=file]', imp), name = $('#fileName');
    f.addEventListener('change', () => { name.textContent = f.files[0] ? f.files[0].name : 'No file chosen'; });
    imp.addEventListener('submit', () => { const b = $('button', imp); b.disabled = true; b.textContent = 'Importing…'; });
  }

  // Show / hide password
  $$('[data-toggle-pw]').forEach(b => b.addEventListener('click', () => {
    const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Show' : 'Hide';
  }));
})();
