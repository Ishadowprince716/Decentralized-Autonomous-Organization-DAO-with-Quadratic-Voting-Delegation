// Optimized and Modular JavaScript Application
// app-optimized.js - Main application entry point

import { CONTRACT_CONFIG } from './js/utils/constants.js';
import { InputValidator } from './js/utils/validators.js';
import { Web3Manager } from './js/services/web3-manager.js';
import { ContractManager } from './js/services/contract-manager.js';
import { UIManager } from './js/services/ui-manager.js';
import { ChartManager } from './js/services/chart-manager.js';
import { StateManager } from './js/services/state-manager.js';

/**
 * Main DAO Application Class
 * Coordinates all services and manages application lifecycle
 */
class DAOApp extends EventTarget {
    constructor() {
        super();
        
        // Service instances
        this.web3Manager = new Web3Manager();
        this.contractManager = new ContractManager(this.web3Manager);
        this.uiManager = new UIManager();
        this.chartManager = new ChartManager();
        this.stateManager = new StateManager();
        
        // Application state
        this.isInitialized = false;
        this.refreshInterval = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.showLoading('Initializing application...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize UI components
            await this.uiManager.init();
            
            // Initialize charts
            await this.chartManager.init();
            
            // Check for existing wallet connection
            await this.checkExistingConnection();
            
            // Set up periodic data refresh
            this.setupDataRefresh();
            
            this.isInitialized = true;
            this.hideLoading();
            
            this.dispatchEvent(new CustomEvent('app:initialized'));
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.uiManager.showToast('Failed to initialize application', 'error');
            this.hideLoading();
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Wallet connection events
        this.web3Manager.addEventListener('wallet:connected', this.handleWalletConnected.bind(this));
        this.web3Manager.addEventListener('wallet:disconnected', this.handleWalletDisconnected.bind(this));
        this.web3Manager.addEventListener('network:changed', this.handleNetworkChanged.bind(this));
        
        // Contract events
        this.contractManager.addEventListener('member:joined', this.handleMemberJoined.bind(this));
        this.contractManager.addEventListener('proposal:created', this.handleProposalCreated.bind(this));
        this.contractManager.addEventListener('vote:cast', this.handleVoteCast.bind(this));
        this.contractManager.addEventListener('delegation:set', this.handleDelegationSet.bind(this));
        
        // UI events
        this.uiManager.addEventListener('ui:walletConnectRequested', this.handleConnectWallet.bind(this));
        this.uiManager.addEventListener('ui:joinDAORequested', this.handleJoinDAO.bind(this));
        this.uiManager.addEventListener('ui:proposalCreateRequested', this.handleCreateProposal.bind(this));
        this.uiManager.addEventListener('ui:voteRequested', this.handleCastVote.bind(this));
        this.uiManager.addEventListener('ui:delegationRequested', this.handleSetDelegation.bind(this));
        
        // Browser events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('online', this.handleConnectionChange.bind(this));
        window.addEventListener('offline', this.handleConnectionChange.bind(this));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    /**
     * Handle wallet connection
     */
    async handleConnectWallet() {
        try {
            this.showLoading('Connecting wallet...');
            
            const connected = await this.web3Manager.connectWallet();
            if (connected) {
                await this.contractManager.initialize();
                await this.loadUserData();
                this.uiManager.showToast('Wallet connected successfully!', 'success');
            }
            
        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.uiManager.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Handle wallet connected event
     */
    async handleWalletConnected(event) {
        const { address } = event.detail;
        this.stateManager.setUserAddress(address);
        this.uiManager.updateConnectionStatus(true, address);
        
        // Load user-specific data
        await this.loadUserData();
    }

    /**
     * Handle wallet disconnected event
     */
    handleWalletDisconnected() {
        this.stateManager.clearUserData();
        this.uiManager.updateConnectionStatus(false);
        this.uiManager.showToast('Wallet disconnected', 'info');
    }

    /**
     * Handle network change
     */
    async handleNetworkChanged(event) {
        const { chainId } = event.detail;
        
        if (chainId !== CONTRACT_CONFIG.network.chainId) {
            this.uiManager.showToast('Please switch to Core Testnet 2', 'warning');
            await this.web3Manager.switchNetwork();
        }
    }

    /**
     * Handle join DAO request
     */
    async handleJoinDAO() {
        try {
            if (!this.web3Manager.isConnected) {
                this.uiManager.showToast('Please connect your wallet first', 'error');
                return;
            }

            this.showLoading('Joining DAO...');
            
            const membershipFee = '0.1'; // ETH
            const result = await this.contractManager.joinDAO(membershipFee);
            
            if (result.success) {
                this.uiManager.showToast('Successfully joined the DAO!', 'success');
                await this.loadUserData();
                await this.loadProposals();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Join DAO failed:', error);
            this.uiManager.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Handle create proposal request
     */
    async handleCreateProposal(event) {
        try {
            const { title, description, category } = event.detail;
            
            // Validate input
            const validation = InputValidator.validateProposal({ title, description, category });
            if (!validation.isValid) {
                this.uiManager.showValidationErrors(validation.errors);
                return;
            }

            this.showLoading('Creating proposal...');
            
            const result = await this.contractManager.createProposal(title, description, category);
            
            if (result.success) {
                this.uiManager.showToast('Proposal created successfully!', 'success');
                this.uiManager.hideProposalForm();
                await this.loadProposals();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Create proposal failed:', error);
            this.uiManager.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Handle cast vote request
     */
    async handleCastVote(event) {
        try {
            const { proposalId, credits, support, delegateAddress } = event.detail;
            
            // Validate input
            if (!InputValidator.validateVoteParameters(proposalId, credits, support)) {
                this.uiManager.showToast('Invalid vote parameters', 'error');
                return;
            }

            this.showLoading('Casting vote...');
            
            const result = await this.contractManager.castVote(
                proposalId, 
                credits, 
                support, 
                delegateAddress
            );
            
            if (result.success) {
                this.uiManager.showToast('Vote cast successfully!', 'success');
                this.uiManager.hideVotingSection();
                await this.loadProposals();
                await this.loadUserData();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Cast vote failed:', error);
            this.uiManager.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Handle set delegation request
     */
    async handleSetDelegation(event) {
        try {
            const { delegateAddress } = event.detail;
            
            // Validate address
            if (delegateAddress && !InputValidator.validateEthereumAddress(delegateAddress)) {
                this.uiManager.showToast('Invalid Ethereum address', 'error');
                return;
            }

            this.showLoading('Setting delegation...');
            
            const result = await this.contractManager.setDelegate(delegateAddress);
            
            if (result.success) {
                this.uiManager.showToast('Delegation updated successfully!', 'success');
                this.uiManager.hideDelegationModal();
                await this.loadUserData();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Set delegation failed:', error);
            this.uiManager.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Load user-specific data
     */
    async loadUserData() {
        try {
            const userAddress = this.stateManager.getUserAddress();
            if (!userAddress) return;

            // Load member info
            const memberInfo = await this.contractManager.getMemberInfo(userAddress);
            this.stateManager.setMemberInfo(memberInfo);
            this.uiManager.updateMemberInfo(memberInfo);

            // Load delegation info
            const delegationInfo = await this.contractManager.getDelegationInfo(userAddress);
            this.stateManager.setDelegationInfo(delegationInfo);
            this.uiManager.updateDelegationInfo(delegationInfo);

        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    /**
     * Load proposals data
     */
    async loadProposals() {
        try {
            const proposals = await this.contractManager.getProposals();
            this.stateManager.setProposals(proposals);
            this.uiManager.renderProposals(proposals);
            this.chartManager.updateProposalCharts(proposals);

        } catch (error) {
            console.error('Failed to load proposals:', error);
        }
    }

    /**
     * Load analytics data
     */
    async loadAnalytics() {
        try {
            const analytics = await this.contractManager.getAnalytics();
            this.stateManager.setAnalytics(analytics);
            this.uiManager.updateAnalytics(analytics);
            this.chartManager.updateAnalyticsCharts(analytics);

        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    /**
     * Check for existing wallet connection
     */
    async checkExistingConnection() {
        try {
            const isConnected = await this.web3Manager.checkConnection();
            if (isConnected) {
                await this.contractManager.initialize();
                await this.loadUserData();
                await this.loadProposals();
                await this.loadAnalytics();
            }
        } catch (error) {
            console.error('Failed to check existing connection:', error);
        }
    }

    /**
     * Set up periodic data refresh
     */
    setupDataRefresh() {
        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(async () => {
            if (this.web3Manager.isConnected) {
                await this.refreshData();
            }
        }, 30000);
    }

    /**
     * Refresh all data
     */
    async refreshData() {
        try {
            await Promise.all([
                this.loadProposals(),
                this.loadAnalytics(),
                this.loadUserData()
            ]);
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // ESC to close modals
        if (event.key === 'Escape') {
            this.uiManager.closeModals();
        }
        
        // Ctrl/Cmd + K for quick actions
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            // Could implement a command palette here
        }
    }

    /**
     * Handle connection change (online/offline)
     */
    handleConnectionChange() {
        if (navigator.onLine) {
            this.uiManager.showToast('Connection restored', 'success');
            this.refreshData();
        } else {
            this.uiManager.showToast('Connection lost - some features may not work', 'warning');
        }
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload() {
        this.cleanup();
    }

    /**
     * Show loading overlay
     */
    showLoading(message = 'Loading...') {
        this.uiManager.showLoading(message);
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.uiManager.hideLoading();
    }

    /**
     * Get user-friendly error message
     */
    getErrorMessage(error) {
        // Map common error codes to user-friendly messages
        const errorMessages = {
            'INSUFFICIENT_FUNDS': 'Insufficient funds for this transaction',
            'USER_REJECTED': 'Transaction was rejected',
            'NETWORK_ERROR': 'Network connection error',
            'CONTRACT_ERROR': 'Smart contract error',
            'INVALID_ADDRESS': 'Invalid Ethereum address',
            'NOT_MEMBER': 'You must be a DAO member to perform this action',
            'PROPOSAL_NOT_FOUND': 'Proposal not found',
            'VOTING_ENDED': 'Voting period for this proposal has ended'
        };

        if (error.code && errorMessages[error.code]) {
            return errorMessages[error.code];
        }

        if (error.message) {
            return error.message;
        }

        return 'An unexpected error occurred';
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Clear intervals
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Clean up services
        this.chartManager.cleanup();
        this.uiManager.cleanup();
        this.web3Manager.cleanup();

        // Remove event listeners
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('online', this.handleConnectionChange);
        window.removeEventListener('offline', this.handleConnectionChange);
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            connected: this.web3Manager.isConnected,
            memberInfo: this.stateManager.getMemberInfo(),
            proposals: this.stateManager.getProposals(),
            analytics: this.stateManager.getAnalytics()
        };
    }
}

// Error boundary for unhandled errors
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    // Could send to error reporting service
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Could send to error reporting service
});

// Initialize application when DOM is ready
let app;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    try {
        app = new DAOApp();
        
        // Make app globally available for debugging
        if (process.env.NODE_ENV === 'development') {
            window.daoApp = app;
        }
        
    } catch (error) {
        console.error('Failed to initialize DAO application:', error);
        
        // Show fallback error message
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; text-align: center; padding: 2rem;">
                <h2>Application Error</h2>
                <p>Failed to initialize the DAO application. Please refresh the page and try again.</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; border: none; background: #4a90e2; color: white; border-radius: 4px; cursor: pointer;">
                    Refresh Page
                </button>
            </div>
        `;
    }
}

// Export for module systems
export { DAOApp };
export default DAOApp;
