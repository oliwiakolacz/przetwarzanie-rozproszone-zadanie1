// ==============================================
//  LOGS-SERVICE to serwis odpowiedzialny za zapisywanie w bazie zdarzen przysyłanych przez inne serwisy i pozwala je odczytać.
//
//  Endpointy serwisu:
//    POST /logs  -> dodanie wpisu logu
//    GET  /logs  -> odczyt logów
//
//  Własna baza danych - plik SQLite logs.db
// ==============================================

const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3003;
const DB_PATH = process.env.DB_PATH || 'logs.db';

// Baza danych
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    service   TEXT NOT NULL,   -- serwis ktory zgłosił zdarzenie
    action    TEXT NOT NULL,   -- co się stało, np. LOGIN, TICKET_CREATED
    username  TEXT,            -- kto
    details   TEXT             -- dodatkowe informacje
  )
`);

const app = express();
app.use(express.json());

// POST /logs  – zapisanie nowego wpisu (wywoływane przez inne serwisy)
app.post('/logs', (req, res) => {
  const { service, action, username, details } = req.body;
  if (!service || !action) {
    return res.status(400).json({ error: 'Pola service i action są wymagane' });
  }
  const timestamp = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO logs (timestamp, service, action, username, details) VALUES (?, ?, ?, ?, ?)')
    .run(timestamp, service, action, username || null, details || null);
  res.status(201).json({ id: Number(result.lastInsertRowid), timestamp });
});

// GET /logs  – odczyt logów (najnowsze pierwsze), opcjonalny filtr ?service=auth
app.get('/logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = req.query.service
    ? db.prepare('SELECT * FROM logs WHERE service = ? ORDER BY id DESC LIMIT ?').all(req.query.service, limit)
    : db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(limit);
  res.json(rows);
});

app.listen(PORT, () => console.log(`[logs-service] działa na porcie ${PORT}`));
