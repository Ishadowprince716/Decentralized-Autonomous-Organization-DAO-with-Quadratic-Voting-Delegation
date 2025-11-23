/**
 * Error Handler Middleware
 * Centralized error handling for the API
 */

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            details: errors
        });
    }

    // Ethers errors
    if (err.code) {
        let message = 'Blockchain transaction failed';
        let statusCode = 500;

        switch (err.code) {
            case 'CALL_EXCEPTION':
                message = 'Contract call failed: ' + (err.reason || 'Unknown reason');
                statusCode = 400;
                break;
            case 'INSUFFICIENT_FUNDS':
                message = 'Insufficient funds for transaction';
                statusCode = 400;
                break;
            case 'NETWORK_ERROR':
                message = 'Network connection error';
                statusCode = 503;
                break;
            case 'TIMEOUT':
                message = 'Transaction timeout';
                statusCode = 408;
                break;
            case 'UNPREDICTABLE_GAS_LIMIT':
                message = 'Cannot estimate gas limit';
                statusCode = 400;
                break;
        }

        return res.status(statusCode).json({
            success: false,
            error: message,
            code: err.code,
            details: err.reason || err.message
        });
    }

    // Default error
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;