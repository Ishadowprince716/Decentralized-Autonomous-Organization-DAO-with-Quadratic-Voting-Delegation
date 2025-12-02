/**
 * DAO Backend Server
 * Complete REST API for interacting with QuadraticDAO smart contract
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');
require('dotenv').config();

// Import routes
const daoRoutes = require('./routes/dao.routes');
const proposalRoutes = require('./routes/proposal.routes');
const votingRoutes = require('./routes/voting.routes');
const memberRoutes = require('./routes/member.routes');
const analyticsRoutes = require('./routes/analytics.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { validateRequest } = require('./middleware/validation');

// Import services
const Web3Service = require('./services/web3.service');
const CacheService = require('./services/cache.service');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Initialize services
const web3Service = new Web3Service();
const cacheService = new CacheService();

// Make services available to routes
app.locals.web3Service = web3Service;
app.locals.cacheService = cacheService;

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        network: process.env.NETWORK || 'unknown'
    });
});

// API Routes
app.use('/api/dao', daoRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/analytics', analyticsRoutes);

// WebSocket support for real-time updates
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST']
    }
});

// WebSocket event handlers
require('./websocket/events')(io, web3Service);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource does not exist',
        path: req.path
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    http.close(() => {
        console.log('HTTP server closed');
        web3Service.cleanup();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    http.close(() => {
        console.log('HTTP server closed');
        web3Service.cleanup();
        process.exit(0);
    });
});

// Start server
http.listen(PORT, async () => {
    console.log(`🚀 DAO Backend Server running on port ${PORT}`);
    console.log(`📡 Network: ${process.env.NETWORK || 'localhost'}`);
    console.log(`🔗 Contract Address: ${process.env.CONTRACT_ADDRESS}`);
    
    // Initialize blockchain connection
    try {
        await web3Service.initialize();
        console.log('✅ Blockchain connection established');
    } catch (error) {
        console.error('❌ Failed to connect to blockchain:', error.message);
    }
});

module.exports = { app, io };