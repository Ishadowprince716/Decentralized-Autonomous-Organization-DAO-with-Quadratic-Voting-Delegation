# DAO Backend API

Comprehensive REST API and WebSocket server for the Quadratic DAO with Delegation smart contract.

## Features

- RESTful API - Complete CRUD operations for DAO management
- Real-time Updates - WebSocket support for live blockchain events
- Caching Layer - In-memory caching for improved performance
- Rate Limiting - Protection against API abuse
- Security - Helmet.js, CORS, input validation
- Error Handling - Centralized error management

## Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Deployed QuadraticDAO contract
- Access to Core Blockchain RPC endpoint

## Installation

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
```

## Configuration

Edit `.env` file:

```env
NETWORK=core-testnet-2
RPC_URL=https://rpc.test2.btcs.network
CONTRACT_ADDRESS=0xYourContractAddress
PRIVATE_KEY=your_private_key
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000
```

## Running

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### DAO Operations
- `GET /api/dao/stats` - Get DAO statistics
- `GET /api/dao/config` - Get DAO configuration
- `GET /api/dao/block-number` - Get current block

### Proposals
- `GET /api/proposals` - Get all proposals
- `GET /api/proposals/:id` - Get single proposal
- `POST /api/proposals` - Create proposal
- `POST /api/proposals/:id/finalize` - Finalize proposal
- `GET /api/proposals/:id/status` - Get proposal status
- `GET /api/proposals/:id/votes` - Get proposal votes

### Voting
- `POST /api/voting` - Cast vote
- `GET /api/voting/power/:address` - Get voting power
- `GET /api/voting/has-voted/:proposalId/:address` - Check if voted

### Members
- `GET /api/members/:address` - Get member info
- `GET /api/members` - Get all members
- `GET /api/members/:address/delegation` - Get delegation info

### Analytics
- `GET /api/analytics/voting-stats` - Voting statistics
- `GET /api/analytics/proposal-trends` - Proposal trends
- `GET /api/analytics/participation` - Participation rate

## WebSocket Events

Connect to `ws://localhost:3000`

### Subscribe
```javascript
socket.emit('subscribe:proposals');
socket.emit('subscribe:voting', proposalId);
socket.emit('subscribe:members');
```

### Receive
```javascript
socket.on('proposal:created', data => {});
socket.on('vote:cast', data => {});
socket.on('proposal:finalized', data => {});
socket.on('stake:added', data => {});
socket.on('member:added', data => {});
```

## Project Structure

```
backend/
├── server.js
├── controllers/
├── routes/
├── services/
├── middleware/
└── websocket/
```

## License

MIT