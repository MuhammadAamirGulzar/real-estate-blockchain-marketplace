# Database Layer

This folder contains the source files for the backend database layer.

```text
connection.js   # PostgreSQL client and connection helpers
schema.js       # Drizzle table definitions and relations
seed.js         # Optional local seed data
```

Generated migrations live in `../drizzle/` because `backend/drizzle.config.js` uses:

```text
schema: ./db/schema.js
out: ./drizzle
```

Common commands from `backend/`:

```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
npm run db:seed
```

Keep schema changes in `schema.js`, generate matching migrations into `../drizzle/`, and keep local database dumps or runtime upload files out of Git.
