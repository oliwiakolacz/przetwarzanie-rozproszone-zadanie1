// ==============================================
//  API-GATEWAY to serwis jedyny punkt wejścia dla klienta. Przekierowuje żądania do serwisów:
//     /api/auth/*     -> auth-service     (publiczne)
//     /api/tickets/*  -> tickets-service  (wymaga tokena JWT)
//     /api/logs/*     -> logs-service     (wymaga tokena JWT)
//
//  Dodatkowo udostępnia użytkownikowi pliki aplikacji klienta WWW (client).
// ==============================================

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.PORT || 8080;
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:3001';
const TICKETS_URL = process.env.TICKETS_URL || 'http://localhost:3002';
const LOGS_URL = process.env.LOGS_URL || 'http://localhost:3003';
const CLIENT_DIR = process.env.CLIENT_DIR || path.join(__dirname, '..', 'client');

const app = express();

// Prosty log każdego żądania w konsoli gatewaya
app.use((req, res, next) => {
  console.log(`[gateway] ${req.method} ${req.originalUrl}`);
  next();
});

// Sprawdzenie tokena, pytamy serwis autoryzacji (auth-service)
async function requireAuth(req, res, next) {
  try {
    const response = await fetch(`${AUTH_URL}/verify`, {
      headers: { authorization: req.headers.authorization || '' },
    });
    if (!response.ok) return res.status(401).json({ error: 'Nieautoryzowany – zaloguj się' });

    const user = await response.json();
    // Przekazujemy dalej informację, kto wykonuje żądanie
    req.headers['x-user-id'] = String(user.id);
    req.headers['x-username'] = user.username;
    next();
  } catch (err) {
    res.status(503).json({ error: 'Serwis autoryzacji niedostępny' });
  }
}

// Funkcja pomocnicza, która tworzy proxy i przekierowuje żądania do podanego serwisu.
const proxy = (target, rewrite) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: rewrite,
    on: { error: (err, req, res) => res.status(503).json({ error: 'Serwis niedostępny' }) },
  });

// Routing
app.use('/api/auth',    proxy(AUTH_URL,    { '^/': '/' }));                    // /api/auth/login -> /login
app.use('/api/tickets', requireAuth, proxy(TICKETS_URL, { '^/': '/tickets/' })); // /api/tickets/5 -> /tickets/5
app.use('/api/logs',    requireAuth, proxy(LOGS_URL,    { '^/': '/logs/' }));    // /api/logs -> /logs/

// Aplikacja klienta (strona WWW)
app.use(express.static(CLIENT_DIR));

app.listen(PORT, () => console.log(`[gateway] działa na http://localhost:${PORT}`));
