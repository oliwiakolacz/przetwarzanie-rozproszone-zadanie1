# System Zgłoszeń

Projekt z przedmiotu "Przetwarzanie rozproszone".

## Opis 
System obsługi zgłoszeń (CRUD) oparty na 4 serwisach: api-gateway, auth-service, tickets-service, logs-service i kliencie (aplikacja webowa). Komunikacja odbywa się przez api-gateway (założono że tylko ten serwis jest publiczny). Token JWT jest uzyskiwany podczas logowania użytkownika, trzymany jest w sessionStorage i dołączany do każdego żądania w nagłówku: Authorization: Bearer <token>.

Technologie: Node.js 22, Express, SQLite (wbudowany moduł node:sqlite), JWT (jsonwebtoken), bcrypt (bcryptjs), http-proxy-middleware.

Autor: Oliwia Kołacz

## Komponenty

| Komponent        | Port | Rola                                                   | Baza danych   |
|------------------|------|--------------------------------------------------------|---------------|
| api-gateway      | 8080 | jedyny punkt wejścia, routing, sprawdzanie tokena, klient www | –      |
| auth-service     | 3001 | rejestracja, logowanie, wydawanie i weryfikacja JWT    | `users.db`    |
| tickets-service  | 3002 | CRUD zgłoszeń                                          | `tickets.db`  |
| logs-service     | 3003 | zapis i odczyt logów zdarzeń                           | `logs.db`     |
| client           | –    | strona www (HTML, JS) udostępniana przez gateway         | –             |

## Endpointy dostępne przez gateway

| Metoda | Ścieżka                | Token | Opis                     |
|--------|------------------------|-------|--------------------------|
| POST   | /api/auth/register     | nie   | rejestracja              |
| POST   | /api/auth/login        | nie   | logowanie, token JWT    |
| GET    | /api/tickets           | tak   | lista zgłoszeń           |
| GET    | /api/tickets/:id       | tak   | jedno zgłoszenie         |
| POST   | /api/tickets           | tak   | dodanie zgłoszenia       |
| PUT    | /api/tickets/:id       | tak   | edycja zgłoszenia        |
| DELETE | /api/tickets/:id       | tak   | usunięcie zgłoszenia     |
| GET    | /api/logs[?service=]   | tak   | podgląd logów            |

## Uruchomienie

W czterech terminalach:

```bash
cd logs-service    && npm install && npm start
cd auth-service    && npm install && npm start
cd tickets-service && npm install && npm start
cd api-gateway     && npm install && npm start
```

Otwórz http://localhost:8080


