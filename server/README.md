# AniMan server

NestJS API using PostgreSQL and TypeORM.

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Set `DATABASE_USERNAME` and `DATABASE_PASSWORD` in `.env` for your local PostgreSQL instance. Never commit `.env`.

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

## Checks

```powershell
npm test
npm run lint
npm run build
```
