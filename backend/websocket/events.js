/**
 * WebSocket Event Handlers
 * Real-time updates for DAO events
 */

module.exports = (io, web3Service) => {
    // Set web3Service reference to io
    web3Service.setWebSocket(io);

    io.on('connection', (socket) => {
        console.log(`🔗 Client connected: ${socket.id}`);

        // Subscribe to proposal updates
        socket.on('subscribe:proposals', () => {
            socket.join('proposals');
            console.log(`📡 Client ${socket.id} subscribed to proposals`);
        });

        // Subscribe to voting updates
        socket.on('subscribe:voting', (proposalId) => {
            socket.join(`proposal:${proposalId}`);
            console.log(`📡 Client ${socket.id} subscribed to proposal ${proposalId}`);
        });

        // Subscribe to member updates
        socket.on('subscribe:members', () => {
            socket.join('members');
            console.log(`📡 Client ${socket.id} subscribed to members`);
        });

        // Unsubscribe handlers
        socket.on('unsubscribe:proposals', () => {
            socket.leave('proposals');
        });

        socket.on('unsubscribe:voting', (proposalId) => {
            socket.leave(`proposal:${proposalId}`);
        });

        socket.on('unsubscribe:members', () => {
            socket.leave('members');
        });

        // Request current stats
        socket.on('request:stats', async () => {
            try {
                const stats = await web3Service.getDAOStats();
                socket.emit('stats:update', stats);
            } catch (error) {
                socket.emit('error', { message: 'Failed to fetch stats' });
            }
        });

        // Request proposal details
        socket.on('request:proposal', async (proposalId) => {
            try {
                const proposal = await web3Service.getProposal(proposalId);
                socket.emit('proposal:update', proposal);
            } catch (error) {
                socket.emit('error', { message: 'Failed to fetch proposal' });
            }
        });

        // Disconnect handler
        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });

        // Error handler
        socket.on('error', (error) => {
            console.error(`❌ Socket error for ${socket.id}:`, error);
        });
    });

    // Emit DAO events to connected clients
    const emitToRoom = (room, event, data) => {
        io.to(room).emit(event, data);
    };

    return {
        emitToRoom
    };
};