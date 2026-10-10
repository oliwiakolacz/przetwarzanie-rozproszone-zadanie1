// ==============================================
//  AUTH-SERVICE to serwis odpowiedzialny za rejestracja i logowanie użytkowników, wydawanie i weryfikacja JsonWebToken (JWT).
//
//  Endpointy serwisu:
//    POST /register  -> rejestracja użytkownika
//    POST /login     -> logowanie użytkownika (wydaje JWT)
//
//    GET  /verify    -> weryfikacja tokena (używa go serwis api-gateway)
//
//  Własna baza danych - plik SQLite users.db
// ==============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || 'users.db';
const JWT_SECRET = process.env.JWT_SECRET || 'tajny_klucz_do_zmiany';
const LOGS_URL = process.env.LOGS_URL || 'http://localhost:3003';

// Baza danych - hasło przechowywane jako hash
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, 
    created_at    TEXT NOT NULL
  )
`);

// Wysłanie zdarzenia do serwisu logów (logs-service)
function sendLog(action, username, details) {
  fetch(`${LOGS_URL}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: 'auth', action, username, details }),
  }).catch(() => console.warn('[auth-service] serwis logów niedostępny'));
}

const app = express();
app.use(express.json());

// POST /register  – utworzenie konta
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 4) {
    return res.status(400).json({ error: 'Podaj login i hasło (min. 4 znaki)' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    return res.status(409).json({ error: 'Taki użytkownik już istnieje' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
    .run(username, hash, new Date().toISOString());

  sendLog('REGISTER', username, 'Utworzono nowe konto');
  res.status(201).json({ id: Number(result.lastInsertRowid), username });
});

// POST /login  – sprawdzenie hasła i wydanie tokena JWT
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username || '');

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    sendLog('LOGIN_FAILED', username, 'Błędny login lub hasło');
    return res.status(401).json({ error: 'Błędny login lub hasło' });
  }

  // Token zawiera id i login użytkownika (ważny 1 godzinę)
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  sendLog('LOGIN', username, 'Zalogowano pomyślnie');
  res.json({ token, username: user.username });
});

// GET /verify  – weryfikacja tokena (używane przez API Gateway)
app.get('/verify', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Brak tokena' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, id: payload.id, username: payload.username });
  } catch (err) {
    res.status(401).json({ valid: false, error: 'Token nieprawidłowy lub wygasł' });
  }
});

app.listen(PORT, () => console.log(`[auth-service] działa na porcie ${PORT}`));
