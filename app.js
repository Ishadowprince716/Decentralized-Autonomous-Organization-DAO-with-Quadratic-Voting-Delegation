// Advanced DAO Application
class AdvancedDAO {
    constructor() {
        this.walletAddress = null;
        this.isMember = false;
        this.currentNetwork = null;
        this.contracts = {};
        this.charts = {};
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupTheme();
        this.setupAccessibility();
        await this.checkWalletConnection();
        this.initializeCharts();
        this.loadInitialData();
    }

    // Theme Management
    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme === 'system' ? (prefersDark ? 'dark' : 'light') : savedTheme;
        
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.body.setAttribute('data-theme', theme);
    }

    // Accessibility Features
    setupAccessibility() {
        // High contrast
        const highContrast = localStorage.getItem('high-contrast') === 'true';
        if (highContrast) document.body.classList.add('high-contrast');

        // Large text
        const largeText = localStorage.getItem('large-text') === 'true';
        if (largeText) document.body.classList.add('large-text');

        // Reduced motion
        const reduceMotion = localStorage.getItem('reduce-motion') === 'true';
        if (reduceMotion) document.body.classList.add('reduce-motion');
    }

    // Wallet Integration
    async checkWalletConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.handleWalletConnected(accounts[0]);
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error);
            }
        }
    }

    async connectWallet() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ 
                    method: 'eth_requestAccounts' 
                });
                await this.handleWalletConnected(accounts[0]);
                this.showNotification('Wallet connected successfully!', 'success');
            } catch (error) {
                this.showNotification('Failed to connect wallet', 'error');
                console.error('Wallet connection error:', error);
            }
        } else {
            this.showNotification('Please install MetaMask!', 'error');
        }
    }

    async handleWalletConnected(address) {
        this.walletAddress = address;
        this.updateWalletUI();
        await this.checkNetwork();
        await this.checkMembership();
        this.loadMemberData();
    }

    // Network Management
    async checkNetwork() {
        if (typeof window.ethereum !== 'undefined') {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            this.currentNetwork = this.getNetworkName(chainId);
            
            if (chainId !== '0x45B') { // Core Testnet
                this.showNetworkWarning();
            } else {
                this.hideNetworkWarning();
            }
        }
    }

    getNetworkName(chainId) {
        const networks = {
            '0x1': 'Ethereum Mainnet',
            '0x45B': 'Core Testnet',
            '0x89': 'Polygon',
            '0x13881': 'Mumbai Testnet'
        };
        return networks[chainId] || `Unknown (${chainId})`;
    }

    async switchNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x45B' }], // Core Testnet
            });
        } catch (error) {
            if (error.code === 4902) {
                await this.addCoreNetwork();
            }
        }
    }

    async addCoreNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x45B',
                    chainName: 'Core Testnet',
                    rpcUrls: ['https://rpc.test.btcs.network/'],
                    nativeCurrency: {
                        name: 'Core',
                        symbol: 'CORE',
                        decimals: 18
                    },
                    blockExplorerUrls: ['https://scan.test.btcs.network/']
                }]
            });
        } catch (error) {
            this.showNotification('Failed to add Core network', 'error');
        }
    }

    // DAO Membership
    async checkMembership() {
        try {
            // Mock API call - replace with actual contract call
            const response = await this.apiCall('/api/members/check', {
                address: this.walletAddress
            });
            this.isMember = response.isMember;
            this.updateMembershipUI();
        } catch (error) {
            console.error('Error checking membership:', error);
        }
    }

    async joinDAO() {
        try {
            this.showLoading('btn-join-dao', 'Joining DAO...');
            
            // Mock transaction - replace with actual contract interaction
            const txHash = await this.mockTransaction('joinDAO', {
                value: '0.01'
            });

            this.isMember = true;
            this.updateMembershipUI();
            this.showNotification('🎉 Successfully joined the DAO!', 'success');
            
            // Show onboarding tour
            this.showOnboardingTour();
            
        } catch (error) {
            this.showNotification('Failed to join DAO', 'error');
            console.error('Join DAO error:', error);
        } finally {
            this.hideLoading('btn-join-dao', 'Join DAO (0.01 ETH)');
        }
    }

    // Proposal Management
    async createProposal(proposalData) {
        try {
            this.showLoading('btn-submit-proposal', 'Creating Proposal...');

            const response = await this.apiCall('/api/proposals/create', {
                ...proposalData,
                proposer: this.walletAddress
            });

            this.showNotification('Proposal created successfully!', 'success');
            this.switchTab('tab-proposals');
            this.loadProposals();

        } catch (error) {
            this.showNotification('Failed to create proposal', 'error');
            throw error;
        } finally {
            this.hideLoading('btn-submit-proposal', 'Create Proposal');
        }
    }

    async voteOnProposal(proposalId, votes, support) {
        try {
            // Calculate quadratic cost
            const cost = votes * votes;
            const availablePower = await this.getVotingPower();

            if (cost > availablePower) {
                throw new Error('Insufficient voting power');
            }

            const response = await this.apiCall('/api/proposals/vote', {
                proposalId,
                voter: this.walletAddress,
                votes,
                support,
                cost
            });

            this.showNotification('Vote cast successfully!', 'success');
            return response;

        } catch (error) {
            this.showNotification('Failed to cast vote: ' + error.message, 'error');
            throw error;
        }
    }

    // Delegation System
    async delegateVotingPower(delegateAddress, duration = null, powerCap = null) {
        try {
            const delegation = {
                delegator: this.walletAddress,
                delegate: delegateAddress,
                duration,
                powerCap
            };

            const response = await this.apiCall('/api/delegation/delegate', delegation);
            this.showNotification('Voting power delegated successfully!', 'success');
            return response;

        } catch (error) {
            this.showNotification('Failed to delegate voting power', 'error');
            throw error;
        }
    }

    async revokeDelegation() {
        try {
            const response = await this.apiCall('/api/delegation/revoke', {
                delegator: this.walletAddress
            });
            this.showNotification('Delegation revoked successfully!', 'success');
            return response;
        } catch (error) {
            this.showNotification('Failed to revoke delegation', 'error');
            throw error;
        }
    }

    // Analytics and Charts
    initializeCharts() {
        // Participation Chart
        const participationCtx = document.getElementById('participation-chart');
        if (participationCtx) {
            this.charts.participation = new Chart(participationCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Voting Participation %',
                        data: [65, 59, 80, 81, 56, 72],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    }
                }
            });
        }

        // Success Rate Chart
        const successCtx = document.getElementById('success-chart');
        if (successCtx) {
            this.charts.success = new Chart(successCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Passed', 'Failed', 'Pending'],
                    datasets: [{
                        data: [42, 35, 23],
                        backgroundColor: [
                            '#10b981',
                            '#ef4444',
                            '#f59e0b'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                        }
                    }
                }
            });
        }
    }

    // Multi-signature Treasury
    async proposeTransaction(transactionData) {
        try {
            const proposal = {
                type: 'transaction',
                ...transactionData,
                proposer: this.walletAddress,
                signaturesRequired: 3 // Configurable
            };

            const response = await this.apiCall('/api/treasury/propose', proposal);
            this.showNotification('Transaction proposal created!', 'success');
            return response;

        } catch (error) {
            this.showNotification('Failed to create transaction proposal', 'error');
            throw error;
        }
    }

    async signTransaction(proposalId) {
        try {
            const response = await this.apiCall('/api/treasury/sign', {
                proposalId,
                signer: this.walletAddress
            });
            this.showNotification('Transaction signed!', 'success');
            return response;
        } catch (error) {
            this.showNotification('Failed to sign transaction', 'error');
            throw error;
        }
    }

    // Gas Optimization
    async getGasEstimation(method, params) {
        try {
            const response = await this.apiCall('/api/gas/estimate', {
                method,
                params
            });
            return response;
        } catch (error) {
            console.error('Gas estimation failed:', error);
            return { gasLimit: 300000, gasPrice: '20000000000' }; // Fallback values
        }
    }

    async getOptimalGasTime() {
        try {
            const response = await this.apiCall('/api/gas/optimal-time');
            return response;
        } catch (error) {
            console.error('Failed to get optimal gas time:', error);
            return { optimal: false, waitTime: 0 };
        }
    }

    // Reputation System
    async calculateReputation(address) {
        try {
            const response = await this.apiCall('/api/reputation/calculate', { address });
            return response.reputationScore;
        } catch (error) {
            console.error('Reputation calculation failed:', error);
            return 0;
        }
    }

    // Data Export
    async exportData(type, format = 'json') {
        try {
            const response = await this.apiCall(`/api/export/${type}`, { format });
            
            if (format === 'csv') {
                this.downloadCSV(response.data, `${type}-export.csv`);
            } else {
                this.downloadJSON(response.data, `${type}-export.json`);
            }
            
            this.showNotification(`Data exported successfully as ${format.toUpperCase()}`, 'success');
        } catch (error) {
            this.showNotification('Failed to export data', 'error');
            throw error;
        }
    }

    // Utility Methods
    async apiCall(endpoint, data = null) {
        const config = {
            method: data ? 'POST' : 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(endpoint, config);
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }

        return await response.json();
    }

    showNotification(message, type = 'info') {
        // Implementation for showing notifications
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-transform transform translate-x-full ${this.getNotificationClass(type)}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span>${message}</span>
                <button class="ml-4" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.remove('translate-x-full'), 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationClass(type) {
        const classes = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            info: 'bg-blue-500 text-white',
            warning: 'bg-yellow-500 text-white'
        };
        return classes[type] || classes.info;
    }

    showLoading(buttonId, loadingText) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = true;
            button.innerHTML = `
                <span class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    ${loadingText}
                </span>
            `;
        }
    }

    hideLoading(buttonId, originalText) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Wallet connection
        document.getElementById('btn-connect-wallet').addEventListener('click', () => this.connectWallet());
        
        // Network switching
        document.getElementById('switch-network').addEventListener('click', () => this.switchNetwork());
        
        // DAO membership
        document.getElementById('btn-join-dao').addEventListener('click', () => this.joinDAO());
        
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.id));
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Window events
        window.addEventListener('resize', () => this.handleResize());
        
        // Ethereum events
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    this.handleWalletConnected(accounts[0]);
                } else {
                    this.handleWalletDisconnected();
                }
            });

            window.ethereum.on('chainChanged', (chainId) => {
                window.location.reload();
            });
        }
    }

    // UI Update Methods
    updateWalletUI() {
        const connectBtn = document.getElementById('btn-connect-wallet');
        const connectedDiv = document.getElementById('connected-wallet');
        const walletAddress = document.getElementById('wallet-address');

        if (this.walletAddress) {
            connectBtn.classList.add('hidden');
            connectedDiv.classList.remove('hidden');
            walletAddress.textContent = `${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(this.walletAddress.length - 4)}`;
        } else {
            connectBtn.classList.remove('hidden');
            connectedDiv.classList.add('hidden');
        }
    }

    updateMembershipUI() {
        const joinSection = document.getElementById('join-dao-section');
        const mainContent = document.getElementById('main-content');

        if (this.isMember) {
            joinSection.classList.add('hidden');
            mainContent.classList.remove('hidden');
        } else {
            joinSection.classList.remove('hidden');
            mainContent.classList.add('hidden');
        }
    }

    showNetworkWarning() {
        const networkStatus = document.getElementById('network-status');
        const networkMessage = document.getElementById('network-message');
        
        networkMessage.textContent = `Connected to ${this.currentNetwork}. Please switch to Core Testnet for full functionality.`;
        networkStatus.classList.remove('hidden');
    }

    hideNetworkWarning() {
        document.getElementById('network-status').classList.add('hidden');
    }

    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.id === tabId);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId.replace('tab-', '') + '-content');
        });
    }

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    showOnboardingTour() {
        // Implementation for interactive onboarding tour
        this.showNotification('Welcome to the DAO! Take a tour to learn about features.', 'info');
    }

    // Mock methods (replace with actual implementations)
    async mockTransaction(method, params) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(`0x${Math.random().toString(16).substr(2)}`);
            }, 2000);
        });
    }

    async getVotingPower() {
        // Mock implementation
        return 100;
    }

    downloadCSV(data, filename) {
        const blob = new Blob([data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    handleResize() {
        // Handle window resize for responsive charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.resize();
        });
    }

    handleWalletDisconnected() {
        this.walletAddress = null;
        this.isMember = false;
        this.updateWalletUI();
        this.updateMembershipUI();
        this.showNotification('Wallet disconnected', 'info');
    }

    async loadInitialData() {
        if (this.isMember) {
            await this.loadProposals();
            await this.loadMemberData();
            await this.loadAnalytics();
        }
    }

    async loadProposals() {
        // Implementation for loading proposals
    }

    async loadMemberData() {
        // Implementation for loading member-specific data
    }

    async loadAnalytics() {
        // Implementation for loading analytics data
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.daoApp = new AdvancedDAO();
});

// Utility functions for accessibility panel
document.getElementById('accessibility-toggle')?.addEventListener('click', function() {
    const panel = document.getElementById('accessibility-panel');
    panel.classList.toggle('hidden');
});

// Close accessibility panel when clicking outside
document.addEventListener('click', function(event) {
    const panel = document.getElementById('accessibility-panel');
    const toggle = document.getElementById('accessibility-toggle');
    
    if (!panel.contains(event.target) && !toggle.contains(event.target)) {
        panel.classList.add('hidden');
    }
});

// Accessibility options handlers
document.getElementById('high-contrast')?.addEventListener('change', function(e) {
    document.body.classList.toggle('high-contrast', e.target.checked);
    localStorage.setItem('high-contrast', e.target.checked);
});

document.getElementById('large-text')?.addEventListener('change', function(e) {
    document.body.classList.toggle('large-text', e.target.checked);
    localStorage.setItem('large-text', e.target.checked);
});

document.getElementById('reduce-motion')?.addEventListener('change', function(e) {
    document.body.classList.toggle('reduce-motion', e.target.checked);
    localStorage.setItem('reduce-motion', e.target.checked);
});
