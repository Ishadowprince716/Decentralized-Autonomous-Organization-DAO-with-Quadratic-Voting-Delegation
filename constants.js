// Constants and Configuration
// js/utils/constants.js

export const CONTRACT_CONFIG = {
    address: "0xFFBf051CaD6374c7d2A7C1D0Fff510daD95874bC",
    network: {
        name: "Core Testnet 2",
        chainId: 1115,
        rpcUrl: "https://rpc.test2.btcs.network",
        explorer: "https://scan.test2.btcs.network"
    },
    abi: [
        {
            "inputs": [],
            "name": "joinDAO",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "string", "name": "_title", "type": "string"},
                {"internalType": "string", "name": "_description", "type": "string"}
            ],
            "name": "createProposal",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "uint256", "name": "_proposalId", "type": "uint256"},
                {"internalType": "uint256", "name": "_credits", "type": "uint256"},
                {"internalType": "bool", "name": "_support", "type": "bool"}
            ],
            "name": "castQuadraticVote",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "address", "name": "_delegate", "type": "address"}],
            "name": "delegate",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "address", "name": "", "type": "address"}],
            "name": "members",
            "outputs": [
                {"internalType": "bool", "name": "isMember", "type": "bool"},
                {"internalType": "uint256", "name": "contribution", "type": "uint256"},
                {"internalType": "uint256", "name": "votingPower", "type": "uint256"},
                {"internalType": "address", "name": "delegatedTo", "type": "address"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "name": "proposals",
            "outputs": [
                {"internalType": "string", "name": "title", "type": "string"},
                {"internalType": "string", "name": "description", "type": "string"},
                {"internalType": "address", "name": "proposer", "type": "address"},
                {"internalType": "uint256", "name": "forVotes", "type": "uint256"},
                {"internalType": "uint256", "name": "againstVotes", "type": "uint256"},
                {"internalType": "bool", "name": "executed", "type": "bool"},
                {"internalType": "uint256", "name": "endTime", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "proposalCount",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "memberCount",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        }
    ]
};

export const TRANSACTION_TIMEOUTS = {
    DEFAULT: 30000, // 30 seconds
    JOIN_DAO: 60000, // 1 minute
    CREATE_PROPOSAL: 45000, // 45 seconds
    CAST_VOTE: 30000, // 30 seconds
    DELEGATE: 30000 // 30 seconds
};

export const RATE_LIMITS = {
    PROPOSALS_PER_HOUR: 5,
    VOTES_PER_MINUTE: 10,
    DELEGATIONS_PER_HOUR: 3
};

export const ERROR_CODES = {
    // Web3 Errors
    WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
    WALLET_LOCKED: 'WALLET_LOCKED',
    USER_REJECTED: 'USER_REJECTED',
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    NETWORK_ERROR: 'NETWORK_ERROR',
    WRONG_NETWORK: 'WRONG_NETWORK',
    
    // Contract Errors
    CONTRACT_ERROR: 'CONTRACT_ERROR',
    NOT_MEMBER: 'NOT_MEMBER',
    ALREADY_MEMBER: 'ALREADY_MEMBER',
    PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
    VOTING_ENDED: 'VOTING_ENDED',
    ALREADY_VOTED: 'ALREADY_VOTED',
    
    // Validation Errors
    INVALID_INPUT: 'INVALID_INPUT',
    INVALID_ADDRESS: 'INVALID_ADDRESS',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
    
    // Rate Limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

export const PROPOSAL_CATEGORIES = [
    { value: 'governance', label: 'Governance' },
    { value: 'treasury', label: 'Treasury' },
    { value: 'technical', label: 'Technical' },
    { value: 'community', label: 'Community' }
];

export const PROPOSAL_STATUSES = {
    ACTIVE: 'active',
    PENDING: 'pending',
    EXECUTED: 'executed',
    FAILED: 'failed'
};

export const QUADRATIC_VOTING = {
    MIN_CREDITS: 1,
    MAX_CREDITS: 100,
    calculatePower: (credits) => Math.sqrt(credits),
    calculateCost: (credits) => credits * credits
};

export const STORAGE_KEYS = {
    USER_PREFERENCES: 'dao_user_preferences',
    THEME: 'dao_theme',
    WALLET_CONNECTION: 'dao_wallet_connected'
};

export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
};

export const TOAST_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

export const CHART_COLORS = {
    PRIMARY: '#4a90e2',
    SUCCESS: '#28a745',
    WARNING: '#ffc107',
    DANGER: '#dc3545',
    INFO: '#17a2b8',
    SECONDARY: '#6c757d'
};

export const ANIMATION_DURATIONS = {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
};

export const BREAKPOINTS = {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280
};

// Default delegates for demonstration
export const DEFAULT_DELEGATES = [
    { 
        address: "0x742d35Cc6634C0532925a3b8D0Ed6b2d9C302d19", 
        name: "Alice Chen",
        reputation: 95,
        specialties: ["Governance", "Technical"]
    },
    { 
        address: "0x8ba1f109551bD432803012645Hac136c45b9c23", 
        name: "Bob Martinez",
        reputation: 87,
        specialties: ["Treasury", "Community"]
    },
    { 
        address: "0x123456789abcdef123456789abcdef123456789", 
        name: "Carol Johnson",
        reputation: 92,
        specialties: ["Technical", "Community"]
    }
];

export const MEMBERSHIP_FEE = {
    AMOUNT: "0.1", // ETH
    MIN_AMOUNT: "0.01",
    MAX_AMOUNT: "10.0"
};

export const PROPOSAL_LIMITS = {
    TITLE_MIN_LENGTH: 3,
    TITLE_MAX_LENGTH: 100,
    DESCRIPTION_MIN_LENGTH: 10,
    DESCRIPTION_MAX_LENGTH: 2000,
    VOTING_PERIOD_DAYS: 7
};

export const GAS_LIMITS = {
    JOIN_DAO: 150000,
    CREATE_PROPOSAL: 200000,
    CAST_VOTE: 100000,
    DELEGATE: 80000
};

export const REFRESH_INTERVALS = {
    USER_DATA: 30000, // 30 seconds
    PROPOSALS: 60000, // 1 minute
    ANALYTICS: 120000 // 2 minutes
};

// Feature flags for gradual rollout
export const FEATURE_FLAGS = {
    ADVANCED_ANALYTICS: true,
    MOBILE_NOTIFICATIONS: false,
    DARK_MODE: true,
    MULTI_SIGNATURE: false,
    CONVICTION_VOTING: false
};

// API endpoints (if using external services)
export const API_ENDPOINTS = {
    PRICE_FEED: 'https://api.coingecko.com/api/v3/simple/price',
    GOVERNANCE_METRICS: '/api/governance/metrics',
    DELEGATE_RANKINGS: '/api/delegates/rankings'
};

// Utility functions
export const UTILS = {
    formatAddress: (address) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    },
    
    formatNumber: (number, decimals = 2) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        }).format(number);
    },
    
    formatCurrency: (amount, currency = 'ETH') => {
        return `${UTILS.formatNumber(amount, 4)} ${currency}`;
    },
    
    formatPercentage: (value) => {
        return `${UTILS.formatNumber(value * 100, 1)}%`;
    },
    
    formatTimeAgo: (timestamp) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    },
    
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle: (func, limit) => {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};
throttle: (func, limit) => {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    isValidAddress: (address) => {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    },
    
    isValidAmount: (amount, min = 0, max = Infinity) => {
        const num = parseFloat(amount);
        return !isNaN(num) && num >= min && num <= max;
    },
    
    truncateText: (text, maxLength) => {
        if (!text || text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    },
    
    calculateQuorumPercentage: (forVotes, againstVotes, totalMembers) => {
        const totalVotes = forVotes + againstVotes;
        return totalMembers > 0 ? (totalVotes / totalMembers) * 100 : 0;
    },
    
    hasProposalPassed: (forVotes, againstVotes, quorumRequired = 0.1) => {
        const totalVotes = forVotes + againstVotes;
        if (totalVotes === 0) return false;
        return forVotes > againstVotes && (forVotes / totalVotes) >= quorumRequired;
    },
    
    getRemainingTime: (endTime) => {
        const now = Date.now();
        const remaining = endTime - now;
        
        if (remaining <= 0) return 'Ended';
        
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },
    
    sortByKey: (array, key, ascending = true) => {
        return [...array].sort((a, b) => {
            const valueA = a[key];
            const valueB = b[key];
            const comparison = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
            return ascending ? comparison : -comparison;
        });
    },
    
    groupBy: (array, key) => {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) {
                result[group] = [];
            }
            result[group].push(item);
            return result;
        }, {});
    },
    
    parseError: (error) => {
        if (!error) return 'Unknown error occurred';
        
        // Handle MetaMask/wallet errors
        if (error.code === 4001) return 'Transaction rejected by user';
        if (error.code === -32002) return 'Request already pending in wallet';
        if (error.code === -32603) return 'Internal error in wallet';
        
        // Handle contract revert errors
        if (error.message?.includes('insufficient funds')) return 'Insufficient funds for transaction';
        if (error.message?.includes('already voted')) return 'You have already voted on this proposal';
        if (error.message?.includes('not a member')) return 'You must be a DAO member to perform this action';
        if (error.message?.includes('voting ended')) return 'Voting period has ended';
        
        // Default to the error message
        return error.message || error.toString();
    },
    
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    },
    
    generateTransactionLink: (txHash) => {
        return `${CONTRACT_CONFIG.network.explorer}/tx/${txHash}`;
    },
    
    generateAddressLink: (address) => {
        return `${CONTRACT_CONFIG.network.explorer}/address/${address}`;
    },
    
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    retryAsync: async (fn, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                await UTILS.sleep(delay * Math.pow(2, i)); // Exponential backoff
            }
        }
    },
    
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return input;
        return input.trim().replace(/[<>]/g, '');
    },
    
    validateProposalInput: (title, description) => {
        const errors = {};
        
        if (!title || title.length < PROPOSAL_LIMITS.TITLE_MIN_LENGTH) {
            errors.title = `Title must be at least ${PROPOSAL_LIMITS.TITLE_MIN_LENGTH} characters`;
        }
        if (title && title.length > PROPOSAL_LIMITS.TITLE_MAX_LENGTH) {
            errors.title = `Title must be less than ${PROPOSAL_LIMITS.TITLE_MAX_LENGTH} characters`;
        }
        if (!description || description.length < PROPOSAL_LIMITS.DESCRIPTION_MIN_LENGTH) {
            errors.description = `Description must be at least ${PROPOSAL_LIMITS.DESCRIPTION_MIN_LENGTH} characters`;
        }
        if (description && description.length > PROPOSAL_LIMITS.DESCRIPTION_MAX_LENGTH) {
            errors.description = `Description must be less than ${PROPOSAL_LIMITS.DESCRIPTION_MAX_LENGTH} characters`;
        }
        
        return { isValid: Object.keys(errors).length === 0, errors };
    }
};
// Environment configuration
export const ENV = {
    isDevelopment: () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    isProduction: () => !ENV.isDevelopment(),
    getVersion: () => '1.0.0', // Could be injected during build
    getBuildDate: () => new Date().toISOString() // Could be injected during build
};
