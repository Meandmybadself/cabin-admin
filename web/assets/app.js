// ── Config ──────────────────────────────────────────────────
const API = 'https://admin.benwaldencab.in/api';
const TOKEN_KEY = 'cabin_token';

// ── Auth helpers ─────────────────────────────────────────────
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function tokenValid() {
  const t = getToken();
  if (!t) return false;
  try {
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

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
    showGate();
    throw new Error('Unauthorized');
  }
  return res;
}

// ── Full-site gate ────────────────────────────────────────────
function showGate() {
  // Remove existing gate if present
  document.getElementById('site-gate')?.remove();

  const gate = document.createElement('div');
  gate.id = 'site-gate';
  gate.innerHTML = `
    <div class="gate-card">
      <div class="gate-brand">Cabin OS</div>
      <form id="gate-form">
        <input type="password" id="gate-password" placeholder="Password"
               autocomplete="current-password" required autofocus>
        <button type="submit">Unlock</button>
        <p id="gate-error" class="gate-error hidden">Incorrect password</p>
      </form>
    </div>`;
  document.body.appendChild(gate);

  document.getElementById('gate-form').addEventListener('submit', async e => {
    e.preventDefault();
    const password = document.getElementById('gate-password').value;
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const { token } = await res.json();
      setToken(token);
      gate.remove();
    } else {
      const err = document.getElementById('gate-error');
      err.classList.remove('hidden');
      document.getElementById('gate-password').value = '';
      document.getElementById('gate-password').focus();
    }
  });
}

// Gate on every page load
if (!tokenValid()) showGate();

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
window.CabinOS = { API, apiFetch, getToken, setToken, clearToken, tokenValid, showGate, ulid, renderMarkdown };

// ── Nav active state ──────────────────────────────────────────
document.querySelectorAll('.nav-links a').forEach(a => {
  if (location.pathname.startsWith(a.getAttribute('href'))) a.classList.add('active');
});
