# AniMan server

NestJS API using PostgreSQL and TypeORM.

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Set `DATABASE_USERNAME` and `DATABASE_PASSWORD` in `.env` for your local PostgreSQL instance. Never commit `.env`.
Generate a private access-token signing key of at least 32 characters and set it as `JWT_ACCESS_SECRET`; do not use the example placeholder in a real environment.

## Development

```powershell
npm run start:dev
```

## Database migrations

Schema synchronization is disabled. Run reviewed migrations explicitly:

```powershell
npm run migration:show
npm run migration:run
```

Only revert a migration after reviewing its `down` operation:

```powershell
npm run migration:revert
```

## Authentication endpoints

- `POST /auth/register` accepts `displayName`, `username`, `password`, `confirmPassword`, and `agree: true`. It creates the account and starts a default one-day session, returning a 15-minute bearer access token and setting the refresh token as an `HttpOnly` cookie.
- `POST /auth/login` accepts `username`, `password`, and optional boolean `rememberMe`. It returns a 15-minute bearer access token and sets a refresh token as an `HttpOnly` cookie; the raw refresh token is not returned in JSON or stored in the database.
- `POST /auth/refresh` rotates the refresh cookie and returns a new access token. Reuse of an already rotated token revokes its refresh-token family.
- `POST /auth/logout` revokes the current refresh session and clears the cookie.
- `GET /auth/me` requires `Authorization: Bearer <access-token>`.

Refresh sessions expire after one day by default or 30 days when `rememberMe` is true; each successful refresh renews that inactivity window. Cookies use `SameSite=Lax`, `Path=/auth`, and `Secure` in production. Configure allowed frontend origins and CSRF protections before exposing the API outside local development.

## Checks

```powershell
npm test
npm run lint
npm run build
```
