// ==============================================
//  TICKETS-SERVICE (ZGŁOSZENIA) to serwis odpowiedzialny za pełny CRUD dla zgłoszeń (np. awariach, prośbach do helpdesku).
//
//  Serwis nie sprawdza tokena sam. Sprawdzenia dokonuje API Gateway, który po weryfikacji dokleja nagłówek "x-username" z nazwą użytkownika.
//
//  Endpointy serwisu:
//  POST /tickets        -> dodanie zgłoszenia
//  GET  /tickets        -> odczyt wszystkich zgłoszeń
//  GET  /tickets/:id    -> odczyt zgłoszenia o podanym ID
//  PUT  /tickets/:id    -> aktualizacja zgłoszenia o podanym ID
//  DELETE /tickets/:id  -> usunięcie zgłoszenia o podanym ID
//
// Własna baza danych - plik SQLite tickets.db
// ==============================================

const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3002;
const DB_PATH = process.env.DB_PATH || 'tickets.db';
const LOGS_URL = process.env.LOGS_URL || 'http://localhost:3003';
const STATUSES = ['nowe', 'w trakcie', 'zamknięte'];

// Baza danych
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'nowe',
    author      TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )
`);

function sendLog(action, username, details) {
  fetch(`${LOGS_URL}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: 'tickets', action, username, details }),
  }).catch(() => console.warn('[tickets-service] serwis logów niedostępny'));
}

const app = express();
app.use(express.json());

// Każde żądanie musi przyjść przez Gateway (z nagłówkiem x-username)
app.use('/tickets', (req, res, next) => {
  req.username = req.headers['x-username'];
  if (!req.username) return res.status(401).json({ error: 'Brak użytkownika – użyj API Gateway' });
  next();
});

// CREATE – POST /tickets
app.post('/tickets', (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Tytuł jest wymagany' });
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO tickets (title, description, status, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(title, description || '', 'nowe', req.username, now, now);
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid);

  sendLog('TICKET_CREATED', req.username, `Dodano zgłoszenie #${ticket.id}: ${title}`);
  res.status(201).json(ticket);
});

// READ (lista) – GET /tickets
app.get('/tickets', (req, res) => {
  res.json(db.prepare('SELECT * FROM tickets ORDER BY id DESC').all());
});

// READ (jedno) – GET /tickets/:id
app.get('/tickets/:id', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Nie znaleziono zgłoszenia' });
  res.json(ticket);
});

// UPDATE – PUT /tickets/:id
app.put('/tickets/:id', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Nie znaleziono zgłoszenia' });

  const title = req.body.title ?? ticket.title;
  const description = req.body.description ?? ticket.description;
  const status = req.body.status ?? ticket.status;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status musi być jednym z: ${STATUSES.join(', ')}` });
  }
  db.prepare('UPDATE tickets SET title = ?, description = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(title, description, status, new Date().toISOString(), ticket.id);

  sendLog('TICKET_UPDATED', req.username, `Zmieniono zgłoszenie #${ticket.id} (status: ${status})`);
  res.json(db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id));
});

// DELETE – DELETE /tickets/:id
app.delete('/tickets/:id', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Nie znaleziono zgłoszenia' });
  db.prepare('DELETE FROM tickets WHERE id = ?').run(ticket.id);

  sendLog('TICKET_DELETED', req.username, `Usunięto zgłoszenie #${ticket.id}: ${ticket.title}`);
  res.status(204).end();
});

app.listen(PORT, () => console.log(`[tickets-service] działa na porcie ${PORT}`));
