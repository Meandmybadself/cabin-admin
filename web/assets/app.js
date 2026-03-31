// ── Config ──────────────────────────────────────────────────
const API = 'https://admin.benwaldencab.in/api';

// ── Auth stubs (auth handled by HTTP Basic Auth at the network layer) ────
function getToken() { return true; }
function setToken() {}
function clearToken() {}
function showGate() {}
function showAuthModal(cb) { if (typeof cb === 'function') cb(); }

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  return res;
}

// ── ULID (tiny impl) ─────────────────────────────────────────
function ulid() {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const t = Date.now();
  let r = '', tmp = t;
  for (let i = 9; i >= 0; i--) { r = chars[tmp % 32] + r; tmp = Math.floor(tmp / 32); }
  for (let i = 0; i < 16; i++) r += chars[Math.floor(Math.random() * 32)];
  return r;
}

// ── Simple markdown → HTML ────────────────────────────────────
function renderMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/^- (.+)$/gm,  '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[h|u|o|l])/gm, '')
    .trim();
}

// ── Markdown editor ───────────────────────────────────────────
function makeMdEditor(textarea) {
  if (textarea.closest('.md-editor')) return; // already enhanced

  const wrapper = document.createElement('div');
  wrapper.className = 'md-editor';
  textarea.parentNode.insertBefore(wrapper, textarea);
  wrapper.appendChild(textarea);

  const toolbar = document.createElement('div');
  toolbar.className = 'md-toolbar';
  toolbar.innerHTML = `
    <button type="button" data-cmd="bold"    title="Bold (Ctrl+B)"><strong>B</strong></button>
    <button type="button" data-cmd="italic"  title="Italic (Ctrl+I)"><em>I</em></button>
    <button type="button" data-cmd="heading" title="Heading">H</button>
    <button type="button" data-cmd="ul"      title="Bullet list">• List</button>
    <span class="md-sep"></span>
    <button type="button" data-cmd="preview" title="Toggle preview">Preview</button>`;
  wrapper.insertBefore(toolbar, textarea);

  const preview = document.createElement('div');
  preview.className = 'md-preview hidden';
  wrapper.appendChild(preview);

  function wrap(before, after, placeholder) {
    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const sel   = textarea.value.slice(start, end) || placeholder;
    textarea.value = textarea.value.slice(0, start) + before + sel + after + textarea.value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + before.length, start + before.length + sel.length);
    textarea.dispatchEvent(new Event('input'));
  }

  function prependLine(prefix) {
    const start     = textarea.selectionStart;
    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    textarea.value  = textarea.value.slice(0, lineStart) + prefix + textarea.value.slice(lineStart);
    textarea.focus();
    textarea.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
    textarea.dispatchEvent(new Event('input'));
  }

  toolbar.addEventListener('click', e => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    switch (btn.dataset.cmd) {
      case 'bold':    wrap('**', '**', 'bold text');   break;
      case 'italic':  wrap('*',  '*',  'italic text'); break;
      case 'heading': prependLine('## ');              break;
      case 'ul':      prependLine('- ');               break;
      case 'preview': {
        const closing = !preview.classList.contains('hidden');
        if (closing) {
          preview.classList.add('hidden');
          textarea.classList.remove('hidden');
          btn.textContent = 'Preview';
          btn.classList.remove('active');
        } else {
          preview.innerHTML = renderMarkdown(textarea.value)
            || '<span style="color:var(--text-muted);font-size:.88rem">Nothing to preview.</span>';
          preview.classList.remove('hidden');
          textarea.classList.add('hidden');
          btn.textContent = 'Edit';
          btn.classList.add('active');
        }
        break;
      }
    }
  });

  textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); wrap('**', '**', 'bold text'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); wrap('*', '*', 'italic text'); }
  });
}

function resetMdEditor(textarea) {
  const wrapper = textarea?.closest('.md-editor');
  if (!wrapper) return;
  const preview = wrapper.querySelector('.md-preview');
  const btn     = wrapper.querySelector('[data-cmd="preview"]');
  if (preview && !preview.classList.contains('hidden')) {
    preview.classList.add('hidden');
    textarea.classList.remove('hidden');
  }
  if (btn) { btn.textContent = 'Preview'; btn.classList.remove('active'); }
}

// Auto-enhance any textarea[data-md] on the page
document.querySelectorAll('textarea[data-md]').forEach(makeMdEditor);

// ── Export for page scripts ───────────────────────────────────
window.CabinOS = { API, apiFetch, getToken, setToken, clearToken, showGate, showAuthModal, ulid, renderMarkdown, makeMdEditor, resetMdEditor };

// ── Global Escape key to close modals ────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
});

// ── Nav active state ──────────────────────────────────────────
document.querySelectorAll('.nav-links a').forEach(a => {
  if (location.pathname.startsWith(a.getAttribute('href'))) a.classList.add('active');
});
