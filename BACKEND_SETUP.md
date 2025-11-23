# Backend Quick Start Guide

This guide will help you set up and run the DAO backend server.

## What Was Added

A complete backend infrastructure has been added to your project:

### Backend Structure
```
backend/
├── server.js                    # Main Express server with WebSocket
├── package.json                # Backend dependencies
├── .env.example               # Environment configuration template
├── README.md                  # Detailed documentation
│
├── controllers/               # API request handlers
│   ├── dao.controller.js       # DAO operations
│   ├── proposal.controller.js  # Proposal management
│   ├── voting.controller.js    # Voting operations
│   ├── member.controller.js    # Member management
│   └── analytics.controller.js # Analytics & stats
│
├── routes/                    # API route definitions
│   ├── dao.routes.js
│   ├── proposal.routes.js
│   ├── voting.routes.js
│   ├── member.routes.js
│   └── analytics.routes.js
│
├── services/                  # Business logic
│   ├── web3.service.js        # Blockchain interactions
│   └── cache.service.js       # In-memory caching
│
├── middleware/                # Express middleware
│   ├── errorHandler.js        # Error handling
│   ├── asyncHandler.js        # Async route wrapper
│   └── validation.js          # Input validation
│
└── websocket/                # Real-time updates
    └── events.js              # Socket.IO event handlers
```

## Key Features

✅ **RESTful API** - Complete endpoints for all DAO operations
✅ **Real-time Updates** - WebSocket support for live blockchain events
✅ **Caching** - Optimized performance with in-memory caching
✅ **Security** - Rate limiting, CORS, Helmet, input validation
✅ **Error Handling** - Comprehensive error management
✅ **Blockchain Integration** - Direct interaction with your QuadraticDAO contract

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` file with your settings:

```env
# Your deployed contract address
CONTRACT_ADDRESS=0xFFBf051CaD6374c7d2A7C1D0Fff510daD95874bC

# Network RPC URL
RPC_URL=https://rpc.test2.btcs.network

# Private key for backend operations (NEVER commit this!)
PRIVATE_KEY=your_private_key_here

# Server configuration
PORT=3000
NODE_ENV=development

# CORS - Add your frontend URL
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Step 3: Compile Smart Contracts

The backend needs access to the contract ABI:

```bash
# From project root
npm run compile
```

This creates the artifacts needed by the backend.

### Step 4: Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

You should see:
```
🚀 DAO Backend Server running on port 3000
📡 Network: core-testnet-2
🔗 Contract Address: 0xFFBf...
✅ Blockchain connection established
✅ Web3Service initialized successfully
```

## Testing the API

### Health Check
```bash
curl http://localhost:3000/health
```

### Get DAO Statistics
```bash
curl http://localhost:3000/api/dao/stats
```

### Get All Proposals
```bash
curl http://localhost:3000/api/proposals
```

### Get Member Info
```bash
curl http://localhost:3000/api/members/0xYourAddress
```

## API Endpoints Overview

### DAO Operations
- `GET /api/dao/stats` - DAO statistics
- `GET /api/dao/config` - Configuration
- `GET /api/dao/block-number` - Current block

### Proposals
- `GET /api/proposals` - All proposals
- `GET /api/proposals/:id` - Single proposal
- `POST /api/proposals` - Create proposal
- `POST /api/proposals/:id/finalize` - Finalize
- `GET /api/proposals/:id/status` - Status
- `GET /api/proposals/:id/votes` - Vote counts

### Voting
- `POST /api/voting` - Cast vote
- `GET /api/voting/power/:address` - Voting power

### Members
- `GET /api/members/:address` - Member info
- `GET /api/members/:address/delegation` - Delegation

### Analytics
- `GET /api/analytics/voting-stats` - Stats
- `GET /api/analytics/participation` - Participation rate

## WebSocket Integration

Connect from your frontend:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

// Subscribe to proposal updates
socket.emit('subscribe:proposals');

// Listen for new proposals
socket.on('proposal:created', (data) => {
    console.log('New proposal:', data);
});

// Listen for votes
socket.on('vote:cast', (data) => {
    console.log('Vote cast:', data);
});
```

## Integrating with Your Frontend

Update your frontend to use the backend API instead of direct contract calls:

```javascript
// Before: Direct contract call
const proposals = await contract.getAllProposals();

// After: API call
const response = await fetch('http://localhost:3000/api/proposals');
const { data: proposals } = await response.json();
```

Benefits:
- ✅ Caching for better performance
- ✅ Rate limiting protection
- ✅ Centralized error handling
- ✅ Real-time updates via WebSocket
- ✅ Analytics and statistics

## Security Notes

⚠️ **Important Security Practices:**

1. **Never commit `.env` file** - It contains sensitive keys
2. **Use environment variables** - For all sensitive data
3. **Enable HTTPS in production** - Encrypt data in transit
4. **Restrict CORS origins** - Only allow trusted domains
5. **Implement authentication** - For write operations (future enhancement)
6. **Monitor logs** - Track suspicious activity

## Production Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name dao-backend
pm2 save
pm2 startup
```

### Using Docker
```bash
docker build -t dao-backend .
docker run -p 3000:3000 --env-file .env dao-backend
```

## Troubleshooting

### Issue: "Cannot find module 'express'"
**Solution:** Run `npm install` in the backend directory

### Issue: "CONTRACT_ADDRESS not set"
**Solution:** Add your contract address to `.env` file

### Issue: "Failed to connect to blockchain"
**Solution:** Check RPC_URL in `.env` and network connectivity

### Issue: "Port 3000 already in use"
**Solution:** Change PORT in `.env` or kill the process using port 3000

## Next Steps

1. ✅ Backend is set up and running
2. 🔨 Integrate frontend with backend API
3. 📡 Implement WebSocket updates in UI
4. 📊 Add authentication (JWT/OAuth)
5. 💾 Consider database for analytics
6. 🚀 Deploy to production server

## Additional Resources

- **Backend README**: `backend/README.md` - Detailed documentation
- **API Testing**: Use Postman or Thunder Client
- **WebSocket Testing**: Use Socket.IO client or browser console

## Support

If you encounter issues:
1. Check `backend/README.md` for detailed docs
2. Review server logs for error messages
3. Ensure contract is deployed and accessible
4. Verify environment variables are set correctly

---

**Your backend is now ready! 🎉**

Start the server with `npm run dev` and begin integrating with your frontend!