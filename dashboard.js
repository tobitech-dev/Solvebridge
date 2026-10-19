(() => {
  'use strict';

  const state = { status: 'all', q: '', page: 1, pages: 1 };
  let loadToken = 0;

  const $ = (id) => document.getElementById(id);
  const ledger = $('ledger');
  const stateMsg = $('state');
  const pager = $('pager');

  function h(tag, attrs = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    kids.flat().forEach((kid) => {
      if (kid != null) node.append(kid);
    });
    return node;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 401) {
      window.location.assign('/login');
      throw new Error('Sign in to continue.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  let toastTimer;
  function toast(message) {
    const t = $('toast');
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const STATUS_LABELS = { new: 'New', reviewed: 'Reviewed', solved: 'Solved' };

  function renderEntry(item) {
    const long = item.problem.length > 360;
    const problem = h('p', { class: long ? 'problem clamp' : 'problem', text: item.problem });

    const more = long
      ? h('button', {
          type: 'button',
          class: 'link',
          'aria-expanded': 'false',
          text: 'Read all',
          onclick: (e) => {
            const clamped = problem.classList.toggle('clamp');
            e.currentTarget.textContent = clamped ? 'Read all' : 'Show less';
            e.currentTarget.setAttribute('aria-expanded', String(!clamped));
          },
        })
      : null;

    const thumb = item.hasImage
      ? h(
          'button',
          {
            type: 'button',
            class: 'thumb',
            'aria-label': `View image from ${item.name}`,
            onclick: () => openImage(`/api/image?id=${item._id}`),
          },
          h('img', { src: `/api/image?id=${item._id}`, alt: '', loading: 'lazy', width: '120', height: '90' })
        )
      : null;

    const entry = h('li', { class: `entry s-${item.status}` });

    const select = h(
      'select',
      {
        class: 'input',
        id: `status-${item._id}`,
        onchange: async (e) => {
          const next = e.currentTarget.value;
          try {
            await api('/api/submissions', { method: 'PATCH', body: JSON.stringify({ id: item._id, status: next }) });
            toast(`Marked as ${STATUS_LABELS[next].toLowerCase()}`);
            load();
          } catch (err) {
            e.currentTarget.value = item.status;
            toast(err.message);
          }
        },
      },
      Object.entries(STATUS_LABELS).map(([value, label]) =>
        h('option', { value, text: label, selected: value === item.status })
      )
    );

    const remove = h('button', {
      type: 'button',
      class: 'link danger',
      text: 'Delete',
      onclick: async () => {
        if (!window.confirm(`Delete the submission from ${item.name}? This cannot be undone.`)) return;
        try {
          await api(`/api/submissions?id=${encodeURIComponent(item._id)}`, { method: 'DELETE' });
          toast('Deleted');
          if (ledger.children.length === 1 && state.page > 1) state.page -= 1;
          load();
        } catch (err) {
          toast(err.message);
        }
      },
    });

    entry.append(
      h(
        'div',
        { class: 'who' },
        h('h2', { text: item.name }),
        h('p', {}, h('a', { href: `mailto:${item.email}`, text: item.email })),
        h('p', { text: item.country }),
        h('time', {
          datetime: item.createdAt,
          text: new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
        })
      ),
      h(
        'div',
        { class: 'body' },
        problem,
        more,
        thumb,
        h(
          'div',
          { class: 'actions' },
          h('label', { class: 'sr', for: `status-${item._id}`, text: `Status for ${item.name}` }),
          select,
          remove
        )
      )
    );
    return entry;
  }

  function emptyMessage() {
    if (state.q || state.status !== 'all') {
      return 'Nothing matches. Clear the search or choose another status.';
    }
    return 'No submissions yet. Share your site link to start receiving problems.';
  }

  async function load() {
    const token = ++loadToken;
    const params = new URLSearchParams({ status: state.status, q: state.q, page: String(state.page), limit: '20' });

    try {
      const data = await api(`/api/submissions?${params}`);
      if (token !== loadToken) return; 

      ['all', 'new', 'reviewed', 'solved'].forEach((key) => {
        $(`n-${key}`).textContent = data.counts[key];
      });

      state.pages = data.pages;
      ledger.replaceChildren(...data.items.map(renderEntry));

      stateMsg.hidden = data.items.length > 0;
      stateMsg.textContent = data.items.length ? '' : emptyMessage();

      pager.hidden = data.pages <= 1;
      $('page-label').textContent = `Page ${data.page} of ${data.pages}`;
      $('prev').disabled = data.page <= 1;
      $('next').disabled = data.page >= data.pages;
    } catch (err) {
      if (token !== loadToken) return;
      stateMsg.hidden = false;
      stateMsg.textContent = `Could not load submissions. ${err.message}`;
    }
  }

  function openImage(src) {
    $('viewer-img').src = src;
    $('viewer').showModal();
  }



  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.status = tab.dataset.status;
      state.page = 1;
      document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-pressed', String(t === tab)));
      load();
    });
  });

  let searchTimer;
  $('q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = e.target.value.trim();
      state.page = 1;
      load();
    }, 300);
  });

  $('prev').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      load();
      window.scrollTo({ top: 0 });
    }
  });

  $('next').addEventListener('click', () => {
    if (state.page < state.pages) {
      state.page += 1;
      load();
      window.scrollTo({ top: 0 });
    }
  });

  $('signout').addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      window.location.assign('/login');
    }
  });

  $('viewer').addEventListener('click', (e) => {
    if (e.target === $('viewer')) $('viewer').close();
  });

  load();
})();
