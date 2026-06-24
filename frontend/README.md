# EstateChain Marketplace Frontend

React + Vite based frontend application for the Real World Asset (RWA) tokenization platform.

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Server runs at `http://localhost:5173`

### Build

```bash
npm build
```

### Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

Required variables:

- `VITE_API_URL` - Backend API endpoint (default: http://localhost:3001/api)
- `VITE_BLOCKCHAIN_EXPLORER` - Local blockchain RPC endpoint

### Project Structure

```
frontend/
├── src/
│   ├── components/        # React components (UI, layout, features)
│   ├── pages/            # Page components (routes)
│   ├── contexts/         # React Context (global state)
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API service layers
│   ├── config/           # Configuration files
│   ├── contracts/        # Smart contract ABIs
│   ├── lib/              # Utilities and helpers
│   ├── App.jsx           # Main app component
│   ├── main.jsx          # Vite entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS config
├── postcss.config.js     # PostCSS config
├── components.json       # Shadcn component config
├── jsconfig.json         # JavaScript path aliases
├── package.json          # Frontend dependencies
├── .env                  # Environment variables (local)
└── .env.example          # Environment template
```

## Technologies

- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **State Management**: React Context + React Query
- **Web3**: ethers.js, web3.js
- **Animations**: Framer Motion
- **Notifications**: react-hot-toast, sonner

## Key Features

- User authentication & KYC verification
- Property marketplace
- Investment portfolio tracking
- Admin dashboard
- Real World Asset tokenization interface
- Wallet integration

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style

- Uses ESLint for code quality
- Prettier configuration included
- Tailwind CSS for styling

## Component Library

See `docs/` for:

- [DESIGN_SYSTEM_GUIDE.md](../DESIGN_SYSTEM_GUIDE.md) - UI design system documentation
- [PROFESSIONAL_REDESIGN_COMPLETE.md](../PROFESSIONAL_REDESIGN_COMPLETE.md) - Recent UI/UX improvements

## Backend Integration

Frontend communicates with backend via REST API at `VITE_API_URL`.

See [../backend/README.md](../backend/README.md) for API documentation.

## Smart Contract Integration

Contract ABIs are located in `src/contracts/abi/`. These are synced from blockchain deployment artifacts.

See [../blockchain/README.md](../blockchain/README.md) for contract information.

## Contributing

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes
3. Run linter: `npm run lint`
4. Commit with clear messages
5. Push and create PR

## License

Part of EstateChain Marketplace.
Licensed under PolyForm Noncommercial License 1.0.0.
