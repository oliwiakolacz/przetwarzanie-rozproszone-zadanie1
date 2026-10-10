// ==============================================
//  CLIENT (WWW) komunikuje się wyłączmie z API Gateway.
//  Token JWT po zalogowaniu trzymany jest w sessionStorage i dołączany do każdego żądania w nagłówku: Authorization: Bearer <token>
// ==============================================

const $ = (id) => document.getElementById(id);
let token = sessionStorage.getItem('token');
let currentUser = sessionStorage.getItem('username');
const apiHistory = [];

// Jedna funkcja do wszystkich wywołań API
async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = res.status === 204 ? null : await res.json().catch(() => null);

  // Pokazujemy żądanie i odpowiedź w panelu "Ostatnie wywołania API" (3 najnowsze)
  const json = data ? JSON.stringify(data, null, 2) : '(brak treści)';
  apiHistory.unshift(
    `${method} ${url}\n` +
    (body ? `Body: ${JSON.stringify(body)}\n` : '') +
    `← ${res.status} ${res.statusText}\n` +
    (json.length > 400 ? json.slice(0, 400) + '\n  …' : json)
  );
  apiHistory.length = Math.min(apiHistory.length, 3);
  $('api-log').textContent = apiHistory.join('\n\n────────────────────────\n\n');

  if (res.status === 401 && token && !url.startsWith('/api/auth')) logout();
  if (!res.ok) throw new Error(data?.error || `Błąd ${res.status}`);
  return data;
}

// Logowanie / rejestracja
$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const action = e.submitter.dataset.action; // "login" albo "register"
  const creds = { username: $('username').value.trim(), password: $('password').value };
  const msg = $('auth-msg');
  try {
    if (action === 'register') {
      await api('POST', '/api/auth/register', creds);
      msg.className = 'msg ok';
      msg.textContent = 'Konto utworzone – możesz się zalogować.';
    } else {
      const data = await api('POST', '/api/auth/login', creds);
      token = data.token;
      currentUser = data.username;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('username', currentUser);
      msg.textContent = '';
      showApp();
    }
  } catch (err) {
    msg.className = 'msg error';
    msg.textContent = err.message;
  }
});

function logout() {
  token = null;
  currentUser = null;
  sessionStorage.clear();
  $('app-section').classList.add('hidden');
  $('user-box').classList.add('hidden');
  $('auth-section').classList.remove('hidden');
}
$('logout-btn').addEventListener('click', logout);

function showApp() {
  $('auth-section').classList.add('hidden');
  $('app-section').classList.remove('hidden');
  $('user-box').classList.remove('hidden');
  $('current-user').textContent = currentUser;
  loadTickets();
}

// Zakładki
document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    $(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    if (tab.dataset.tab === 'logs') loadLogs();
    else loadTickets();
  })
);

// CRUD Zgłoszenia
// Escapowanie HTML (zamiana znaków specjalnych na ich odpowiedniki HTML)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function loadTickets() {
  const tickets = await api('GET', '/api/tickets');
  $('tickets-body').innerHTML = tickets.length
    ? tickets.map((t) => `
      <tr>
        <td>${t.id}</td>
        <td>${esc(t.title)}</td>
        <td>${esc(t.description)}</td>
        <td><span class="badge" data-s="${esc(t.status)}">${esc(t.status)}</span></td>
        <td>${esc(t.author)}</td>
        <td class="row">
          <button class="small secondary" onclick="editTicket(${t.id})">Edytuj</button>
          <button class="small danger" onclick="deleteTicket(${t.id})">Usuń</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6">Brak zgłoszeń</td></tr>';
}

$('ticket-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('ticket-id').value;
  const body = { title: $('ticket-title').value, description: $('ticket-desc').value };
  try {
    if (id) {
      body.status = $('ticket-status').value;
      await api('PUT', `/api/tickets/${id}`, body);   // UPDATE
    } else {
      await api('POST', '/api/tickets', body);        // CREATE
    }
    resetForm();
    loadTickets();
  } catch (err) { alert(err.message); }
});

async function editTicket(id) {
  const t = await api('GET', `/api/tickets/${id}`);   // READ (jedno)
  $('ticket-id').value = t.id;
  $('ticket-title').value = t.title;
  $('ticket-desc').value = t.description;
  $('ticket-status').value = t.status;
  $('form-title').textContent = `Edycja zgłoszenia #${t.id}`;
  $('ticket-submit').textContent = 'Zapisz zmiany';
  $('status-label').classList.remove('hidden');
  $('ticket-cancel').classList.remove('hidden');
}

async function deleteTicket(id) {
  if (!confirm(`Usunąć zgłoszenie #${id}?`)) return;
  await api('DELETE', `/api/tickets/${id}`);          // DELETE
  loadTickets();
}

function resetForm() {
  $('ticket-form').reset();
  $('ticket-id').value = '';
  $('form-title').textContent = 'Nowe zgłoszenie';
  $('ticket-submit').textContent = 'Dodaj';
  $('status-label').classList.add('hidden');
  $('ticket-cancel').classList.add('hidden');
}
$('ticket-cancel').addEventListener('click', resetForm);
$('refresh-tickets').addEventListener('click', loadTickets);

// Logi
async function loadLogs() {
  const service = $('log-filter').value;
  const logs = await api('GET', `/api/logs${service ? `?service=${service}` : ''}`);
  $('logs-body').innerHTML = logs.map((l) => `
    <tr>
      <td>${l.id}</td>
      <td>${new Date(l.timestamp).toLocaleString('pl-PL')}</td>
      <td>${esc(l.service)}</td>
      <td><code>${esc(l.action)}</code></td>
      <td>${esc(l.username)}</td>
      <td>${esc(l.details)}</td>
    </tr>`).join('') || '<tr><td colspan="6">Brak logów</td></tr>';
}
$('refresh-logs').addEventListener('click', loadLogs);
$('log-filter').addEventListener('change', loadLogs);

// Odświeżenie strony, jeśli token jest już zapisany od razu pokaż panel
if (token) showApp();
