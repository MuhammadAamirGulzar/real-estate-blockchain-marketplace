# EstateChain Marketplace Backend

Node.js + Express based REST API server for the Real World Asset (RWA) tokenization platform.

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Server runs at `http://localhost:3001`

### Environment Variables

Copy `.env.example` to `.env` and update with your configuration:

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (change in production!)
- `RPC_URL` - Blockchain RPC endpoint
- `DEPLOYER_PRIVATE_KEY` - Deployment account private key
- `PINATA_*` - IPFS Pinata API credentials

### Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### Project Structure

```
backend/
├── index.js                    # Express server entry point
├── routes/                     # API route handlers
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── kycRoutes.js
│   ├── investmentRoutes.js
│   ├── propertiesRoutes.js
│   ├── tradingRoutes.js
│   ├── adminRoutes.js
│   └── verifierRoutes.js
├── controllers/                # Business logic
│   ├── authController.js
│   ├── userController.js
│   ├── kycController.js
│   ├── investmentController.js
│   ├── propertiesController.js
│   ├── tradingController.js
│   ├── adminController.js
│   └── verifierController.js
├── services/                   # Service layer
│   ├── userService.js
│   ├── kycService.js
│   ├── investmentService.js
│   ├── propertyService.js
│   ├── walletAuthService.js
│   ├── web3Service.js          # Blockchain interaction
│   ├── tokenization.service.js # Tokenization logic
│   ├── ipfsService.js          # IPFS/Pinata integration
│   ├── FractionalTokenService.js
│   └── PropertyNFTService.js
├── middleware/                 # Express middleware
│   ├── auth.js
│   ├── authMiddleware.js
│   └── roleMiddleware.js
├── db/                         # Database layer
│   ├── connection.js           # PostgreSQL connection
│   ├── schema.js               # Drizzle ORM schema
│   ├── migrations/             # SQL migration files
│   ├── migrate.js              # Migration runner
│   └── seed.js                 # Database seeder
├── scripts/                    # Utility scripts
│   ├── assign-admin-wallet.js
│   ├── check-user-kyc.js
│   └── dump-users.js
├── uploads/                    # File upload directory
├── drizzle/                    # Drizzle ORM metadata
├── jest.config.js              # Testing configuration
├── drizzle.config.js           # Drizzle migration config
├── jsconfig.json               # Path aliases
├── package.json                # Backend dependencies
├── .env                        # Environment variables (local)
├── .env.example                # Environment template
└── README.md                   # This file
```

## Technologies

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Drizzle Kit
- **Authentication**: JWT
- **Password**: bcryptjs
- **Web3**: ethers.js, web3.js
- **File Upload**: Multer
- **HTTP Client**: Axios
- **Testing**: Jest, Supertest

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/wallet-login` - Wallet-based login
- `POST /api/auth/logout` - User logout

### Users

- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `GET /api/users/:id/kyc` - Get user KYC status

### KYC

- `POST /api/kyc/submit` - Submit KYC documents
- `GET /api/kyc/status` - Get KYC verification status
- `POST /api/kyc/verify` - Verify KYC (admin)

### Properties

- `GET /api/properties` - List all properties
- `GET /api/properties/:id` - Get property details
- `POST /api/properties` - Create property (admin)

### Investments

- `POST /api/investments` - Create investment
- `GET /api/investments/:id` - Get investment details
- `GET /api/investments/user/:userId` - Get user investments

### Trading

- `POST /api/trading/sell` - List tokens for sale
- `POST /api/trading/buy` - Purchase tokens
- `GET /api/trading/:id` - Get trading order details

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with initial data

### Database Migrations

Using Drizzle Kit:

```bash
# Create new migration
drizzle-kit generate:pg --out ./db/migrations

# Run migrations
npm run db:migrate
```

## Web3 Integration

Backend interacts with smart contracts via ethers.js:

1. **Contract ABIs** - Located in `src/contracts/abi/` (frontend)
2. **RPC Connection** - Via `RPC_URL` environment variable
3. **Private Key** - `DEPLOYER_PRIVATE_KEY` for transactions
4. **Services** - See `services/web3Service.js` for contract interactions

See [../blockchain/README.md](../blockchain/README.md) for contract details.

## Security

⚠️ **Important Security Notes:**

- Never commit `.env` file with real credentials
- Rotate `JWT_SECRET` regularly in production
- Use strong PostgreSQL passwords
- Protect `DEPLOYER_PRIVATE_KEY` - never expose in logs
- Enable HTTPS in production
- Validate all user inputs
- Implement rate limiting for public endpoints

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "error_code"
}
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Performance Considerations

- Database queries use Drizzle ORM with proper indexing
- Implement caching for frequently accessed data
- Use connection pooling for database
- Async/await for non-blocking operations

## Contributing

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes and test
3. Commit with clear messages
4. Push and create PR

## Documentation

See `docs/` folder for:

- API specification and examples
- Database schema documentation
- Service layer documentation

## License

Part of EstateChain Marketplace.
Licensed under PolyForm Noncommercial License 1.0.0.
