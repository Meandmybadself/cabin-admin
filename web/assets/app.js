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

// ── Export for page scripts ───────────────────────────────────
window.CabinOS = { API, apiFetch, getToken, setToken, clearToken, showGate, showAuthModal, ulid, renderMarkdown };

// ── Nav active state ──────────────────────────────────────────
document.querySelectorAll('.nav-links a').forEach(a => {
  if (location.pathname.startsWith(a.getAttribute('href'))) a.classList.add('active');
});
