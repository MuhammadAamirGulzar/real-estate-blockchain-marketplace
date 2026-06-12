# RWAChain Platform

RWAChain is a full-stack Real World Asset tokenization platform for registering properties, verifying investors, issuing blockchain-backed ownership tokens, processing investments, and supporting secondary trading and revenue distribution.

## Current Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, Radix UI, ethers.js |
| Backend | Node.js, Express, PostgreSQL, Drizzle ORM, JWT |
| Blockchain | Solidity, Foundry, OpenZeppelin, Chainlink contracts |
| DevOps | Docker Compose, PowerShell helper scripts |

## Repository Layout

```text
RWAchain/
|-- frontend/              # React + Vite application
|-- backend/               # Express API, services, database schema
|-- backend/db/            # Drizzle schema, database connection, seed data
|-- backend/drizzle/       # Generated SQL migrations and Drizzle metadata
|-- blockchain/            # Foundry contracts, scripts, tests, libraries
|-- docs/                  # Implementation notes and testing guides
|-- src/contracts/abi/     # Shared contract ABI copies
|-- tools/                 # Local maintenance utilities
|-- docker-compose.yml     # Local container orchestration
|-- start-docker.ps1       # Starts Docker development stack
|-- setup-admin.ps1        # Admin setup helper
|-- .env.example           # Root environment reference
`-- README.md
```

Runtime data is intentionally excluded from Git: `.env` files, uploaded documents, `node_modules`, build output, deployment logs, and local Anvil state.

## Quick Start With Docker

Docker is the easiest way to run the current local stack.

1. Copy environment files:

   ```bash
   copy backend\.env.example backend\.env
   copy frontend\.env.example frontend\.env
   ```

2. Start the full development stack:

   ```powershell
   .\start-docker.ps1
   ```

   This starts frontend, backend, PostgreSQL, and Anvil using the `docker-db` and `docker-chain` Compose profiles.

3. Open the services:

   ```text
   Frontend: http://localhost:5173
   Backend:  http://localhost:3001
   Anvil:    http://localhost:8545
   Postgres: localhost:5432
   ```

Useful Compose commands:

```bash
docker compose --profile docker-db --profile docker-chain up --build
docker compose --profile docker-db --profile docker-chain down
docker compose ps
docker compose logs -f backend
```

## Manual Development

Install dependencies for each workspace:

```bash
cd frontend && npm install
cd ../backend && npm install
cd ../blockchain && npm install
```

Run the services in separate terminals:

```bash
cd frontend && npm run dev
cd backend && npm run dev
cd blockchain && anvil --chain-id 31337
```

Apply database migrations:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

Build and test:

```bash
cd frontend && npm run build
cd backend && npm test
cd blockchain && forge test
```

## Database Organization

The backend database code is organized around Drizzle:

```text
backend/db/connection.js   # PostgreSQL client and connection helpers
backend/db/schema.js       # Source of truth for tables and relations
backend/db/seed.js         # Optional local seed data
backend/drizzle/*.sql      # Versioned generated migrations
backend/drizzle/meta/      # Drizzle migration metadata
```

Use these scripts from `backend/`:

```bash
npm run db:generate   # Generate a migration after schema changes
npm run db:migrate    # Apply migrations
npm run db:push       # Push schema directly during local prototyping
npm run db:studio     # Open Drizzle Studio
npm run db:seed       # Seed local data
```

Do not commit database dumps, local upload files, or generated runtime state. Keep schema changes in `backend/db/schema.js` and migration changes in `backend/drizzle/`.

## Key Features

- Wallet and password authentication
- Role-based access for admins, verifiers, sub-admins, and users
- KYC submission and review workflows
- Property onboarding and tokenization
- Fractional investment tracking
- Multi-currency payment support
- Bank transfer proof upload and admin verification
- Secondary market trading
- Revenue deposit and claim flows
- Blockchain synchronization and reconciliation services

## Environment Files

Each app owns its local environment file:

```text
backend/.env       # API, database, JWT, RPC, contract, payment, IPFS config
frontend/.env      # Vite API, wallet, contract, feature flag config
blockchain/.env    # Foundry deployment and verification config
```

Templates and references:

- Root template: [.env.example](.env.example)
- Backend template: [backend/.env.example](backend/.env.example)
- Frontend template: [frontend/.env.example](frontend/.env.example)

Never commit real `.env` files, private keys, JWT secrets, upload artifacts, or local chain state.

## Documentation

- [Backend API](backend/README.md)
- [Frontend app](frontend/README.md)
- [Smart contracts](blockchain/README.md)
- [Environment setup](docs/ENVIRONMENT_SETUP.md)
- [Testing plan](docs/TESTING_PLAN.md)
- [Testing checklist](docs/TESTING_CHECKLIST.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Tokenization summary](docs/TOKENIZATION_IMPLEMENTATION_SUMMARY.md)
- [Multi-currency summary](docs/MULTI_CURRENCY_IMPLEMENTATION_SUMMARY.md)

## Security Notes

- Rotate any token or credential that was ever committed or printed in a terminal.
- Use strong `JWT_SECRET` and `SESSION_SECRET` values outside local development.
- Treat all private keys as secrets. The sample Anvil key is only for local development.
- Use HTTPS, strict CORS, and production database credentials in deployed environments.
- Validate uploaded files and keep `backend/uploads/` outside Git.

## Project Status

Version: `0.1.0`

Status: Development

Last updated: May 2026
