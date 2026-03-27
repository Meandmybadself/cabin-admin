// ── Config ──────────────────────────────────────────────────
const API = 'https://admin.benwaldencab.in/api';
const TOKEN_KEY = 'cabin_token';

// ── Auth helpers ─────────────────────────────────────────────
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    clearToken();
    showAuthModal(() => apiFetch(path, opts));
    throw new Error('Unauthorized');
  }
  return res;
}

// ── Auth modal ───────────────────────────────────────────────
let _authResolve = null;

function showAuthModal(onSuccess) {
  const modal = document.getElementById('auth-modal');
  const form  = document.getElementById('auth-form');
  const err   = document.getElementById('auth-error');
  const input = document.getElementById('auth-password');
  if (!modal) return;
  modal.classList.remove('hidden');
  input.value = '';
  err.classList.add('hidden');
  input.focus();

  const handler = async (e) => {
    e.preventDefault();
    const password = input.value;
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const { token } = await res.json();
      setToken(token);
      modal.classList.add('hidden');
      form.removeEventListener('submit', handler);
      if (onSuccess) onSuccess();
    } else {
      err.classList.remove('hidden');
      input.value = '';
      input.focus();
    }
  };
  form.addEventListener('submit', handler);
}

// ── ULID (tiny impl) ─────────────────────────────────────────
function ulid() {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const t = Date.now();
  let r = '';
  let tmp = t;
  for (let i = 9; i >= 0; i--) {
    r = chars[tmp % 32] + r;
    tmp = Math.floor(tmp / 32);
  }
  for (let i = 0; i < 16; i++) r += chars[Math.floor(Math.random() * 32)];
  return r;
}

// ── Simple markdown → HTML (headings, bold, lists, paragraphs) ─
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
window.CabinOS = { API, apiFetch, getToken, setToken, clearToken, showAuthModal, ulid, renderMarkdown };

// ── Nav active state ──────────────────────────────────────────
document.querySelectorAll('.nav-links a').forEach(a => {
  if (location.pathname.startsWith(a.getAttribute('href'))) a.classList.add('active');
});
