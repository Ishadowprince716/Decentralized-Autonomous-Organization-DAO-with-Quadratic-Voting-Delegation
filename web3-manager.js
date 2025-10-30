// Enhanced Web3 Connection Manager with Advanced Features
// js/services/web3-manager.js

import { CONTRACT_CONFIG, ERROR_CODES, TRANSACTION_TIMEOUTS } from '../utils/constants.js';

/**
 * Manages Web3 connection, wallet integration, and network handling
 * @extends EventTarget
 */
export class Web3Manager extends EventTarget {
    constructor() {
        super();
        
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.chainId = null;
        this.isConnected = false;
        this.isConnecting = false;
        
        // Enhanced state tracking
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.lastConnectionTime = null;
        this.balanceCache = new Map();
        this.transactionHistory = [];
        this.pendingTransactions = new Set();
        
        // Performance monitoring
        this.metrics = {
            connectionTime: 0,
            transactionCount: 0,
            failedTransactions: 0,
            averageGasUsed: 0
        };
        
        // Bind methods to maintain context
        this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
        this.handleChainChanged = this.handleChainChanged.bind(this);
        this.handleDisconnect = this.handleDisconnect.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        
        this.setupEventListeners();
        this.initializeAutoReconnect();
    }

    /**
     * Set up MetaMask event listeners with proper cleanup
     */
    setupEventListeners() {
        if (!this.isWalletAvailable()) return;

        // Remove existing listeners to prevent duplicates
        this.removeEventListeners();

        window.ethereum.on('accountsChanged', this.handleAccountsChanged);
        window.ethereum.on('chainChanged', this.handleChainChanged);
        window.ethereum.on('disconnect', this.handleDisconnect);
        window.ethereum.on('message', this.handleMessage);
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        if (!window.ethereum) return;

        window.ethereum.removeListener('accountsChanged', this.handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', this.handleChainChanged);
        window.ethereum.removeListener('disconnect', this.handleDisconnect);
        window.ethereum.removeListener('message', this.handleMessage);
    }

    /**
     * Initialize auto-reconnect functionality
     */
    initializeAutoReconnect() {
        // Check for existing connection on page load
        if (typeof window !== 'undefined') {
            window.addEventListener('load', () => {
                this.checkConnection();
            });
        }

        // Handle visibility changes
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.isConnected) {
                    this.verifyConnection();
                }
            });
        }
    }

    /**
     * Connect to user's wallet with improved state management
     * @returns {Promise<boolean>} Success status
     */
    async connectWallet() {
        const startTime = Date.now();

        // Prevent concurrent connection attempts
        if (this.isConnecting) {
            console.warn('Connection already in progress');
            return false;
        }

        if (this.isConnected) {
            console.warn('Wallet already connected');
            return true;
        }

        // Check connection attempt limits
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            const timeSinceLastAttempt = Date.now() - this.lastConnectionTime;
            if (timeSinceLastAttempt < 60000) { // 1 minute cooldown
                throw new Error('Too many connection attempts. Please wait a moment.');
            }
            this.connectionAttempts = 0;
        }

        this.isConnecting = true;
        this.connectionAttempts++;
        this.lastConnectionTime = Date.now();

        try {
            if (!this.isWalletAvailable()) {
                throw new Error('MetaMask not detected. Please install MetaMask extension.');
            }

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please connect your wallet.');
            }

            // Set up provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
            this.signer = this.provider.getSigner();
            this.userAddress = ethers.utils.getAddress(accounts[0]); // Checksum address

            // Get network information
            const network = await this.provider.getNetwork();
            this.chainId = network.chainId;

            // Check if we're on the correct network
            if (this.chainId !== CONTRACT_CONFIG.network.chainId) {
                await this.switchNetwork();
            }

            this.isConnected = true;
            this.connectionAttempts = 0; // Reset on success
            
            // Track connection time
            this.metrics.connectionTime = Date.now() - startTime;

            // Dispatch connection event
            this.dispatchEvent(new CustomEvent('wallet:connected', {
                detail: { 
                    address: this.userAddress, 
                    chainId: this.chainId,
                    timestamp: Date.now(),
                    connectionTime: this.metrics.connectionTime
                }
            }));

            // Pre-fetch balance
            this.getBalance(true).catch(console.error);

            return true;

        } catch (error) {
            this.handleConnectionError(error);
            return false;
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Check if wallet is available
     * @returns {boolean} Wallet availability
     */
    isWalletAvailable() {
        return typeof window !== 'undefined' && 
               typeof window.ethereum !== 'undefined' &&
               window.ethereum.isMetaMask === true;
    }

    /**
     * Get available wallet providers
     * @returns {Object} Available wallet information
     */
    getAvailableWallets() {
        const wallets = {
            metamask: false,
            coinbase: false,
            trustwallet: false,
            other: false
        };

        if (typeof window === 'undefined' || !window.ethereum) {
            return wallets;
        }

        wallets.metamask = window.ethereum.isMetaMask === true;
        wallets.coinbase = window.ethereum.isCoinbaseWallet === true;
        wallets.trustwallet = window.ethereum.isTrust === true;
        wallets.other = !wallets.metamask && !wallets.coinbase && !wallets.trustwallet;

        return wallets;
    }

    /**
     * Check existing connection without requesting access
     * @returns {Promise<boolean>} Connection status
     */
    async checkConnection() {
        try {
            if (!this.isWalletAvailable()) {
                return false;
            }

            const accounts = await window.ethereum.request({
                method: 'eth_accounts'
            });

            if (accounts && accounts.length > 0) {
                // Silently reconnect if already authorized
                return await this.connectWallet();
            }

            return false;
        } catch (error) {
            console.error('Failed to check connection:', error);
            return false;
        }
    }

    /**
     * Verify connection is still active
     * @returns {Promise<boolean>} Connection validity
     */
    async verifyConnection() {
        if (!this.isConnected || !this.provider) {
            return false;
        }

        try {
            const network = await this.provider.getNetwork();
            const accounts = await this.provider.listAccounts();
            
            if (accounts.length === 0 || network.chainId !== this.chainId) {
                this.disconnect();
                return false;
            }

            return true;
        } catch (error) {
            console.error('Connection verification failed:', error);
            this.disconnect();
            return false;
        }
    }

    /**
     * Switch to the correct network with better error handling
     */
    async switchNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ 
                    chainId: `0x${CONTRACT_CONFIG.network.chainId.toString(16)}` 
                }]
            });

            // Wait for the switch to complete
            await this.waitForNetworkSwitch(CONTRACT_CONFIG.network.chainId);

        } catch (switchError) {
            // Network doesn't exist, add it
            if (switchError.code === 4902 || switchError.code === -32603) {
                await this.addNetwork();
            } else if (switchError.code === 4001) {
                throw new Error('Network switch rejected by user');
            } else {
                throw switchError;
            }
        }
    }

    /**
     * Wait for network switch to complete
     * @param {number} targetChainId - Expected chain ID
     * @param {number} maxAttempts - Maximum retry attempts
     */
    async waitForNetworkSwitch(targetChainId, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
            const network = await this.provider.getNetwork();
            if (network.chainId === targetChainId) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error('Network switch timeout');
    }

    /**
     * Add the network to MetaMask with validation
     */
    async addNetwork() {
        const config = CONTRACT_CONFIG.network;

        if (!config.chainId || !config.name || !config.rpcUrl) {
            throw new Error('Invalid network configuration');
        }

        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${config.chainId.toString(16)}`,
                    chainName: config.name,
                    rpcUrls: [config.rpcUrl],
                    blockExplorerUrls: config.explorer ? [config.explorer] : null,
                    nativeCurrency: {
                        name: 'CORE',
                        symbol: 'CORE',
                        decimals: 18
                    }
                }]
            });
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('Network addition rejected by user');
            }
            throw new Error(`Failed to add ${config.name} network: ${error.message}`);
        }
    }

    /**
     * Disconnect wallet and clean up state
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.chainId = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.balanceCache.clear();

        this.dispatchEvent(new CustomEvent('wallet:disconnected', {
            detail: { timestamp: Date.now() }
        }));
    }

    /**
     * Get user's native token balance with caching
     * @param {boolean} fresh - Force fresh fetch
     * @returns {Promise<string>} Balance in ETH
     */
    async getBalance(fresh = false) {
        try {
            if (!this.provider || !this.userAddress) {
                throw new Error('Wallet not connected');
            }

            const cacheKey = `balance_${this.userAddress}_${this.chainId}`;
            const cachedData = this.balanceCache.get(cacheKey);

            // Return cached balance if valid (less than 30 seconds old)
            if (!fresh && cachedData && Date.now() - cachedData.timestamp < 30000) {
                return cachedData.balance;
            }

            const blockTag = fresh ? 'latest' : 'pending';
            const balance = await this.provider.getBalance(this.userAddress, blockTag);
            const formattedBalance = ethers.utils.formatEther(balance);

            // Cache the balance
            this.balanceCache.set(cacheKey, {
                balance: formattedBalance,
                timestamp: Date.now()
            });

            return formattedBalance;
        } catch (error) {
            console.error('Failed to get balance:', error);
            throw error;
        }
    }

    /**
     * Get ERC20 token balance
     * @param {string} tokenAddress - Token contract address
     * @param {string} userAddress - User address (optional, defaults to connected address)
     * @returns {Promise<Object>} Token balance and details
     */
    async getTokenBalance(tokenAddress, userAddress = null) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            const address = userAddress || this.userAddress;
            if (!Web3Manager.isValidAddress(address)) {
                throw new Error('Invalid user address');
            }

            if (!Web3Manager.isValidAddress(tokenAddress)) {
                throw new Error('Invalid token address');
            }

            const tokenContract = new ethers.Contract(
                tokenAddress,
                [
                    'function balanceOf(address) view returns (uint256)',
                    'function decimals() view returns (uint8)',
                    'function symbol() view returns (string)',
                    'function name() view returns (string)'
                ],
                this.provider
            );

            const [balance, decimals, symbol, name] = await Promise.all([
                tokenContract.balanceOf(address),
                tokenContract.decimals(),
                tokenContract.symbol(),
                tokenContract.name()
            ]);

            return {
                balance: ethers.utils.formatUnits(balance, decimals),
                decimals,
                symbol,
                name,
                raw: balance.toString()
            };
        } catch (error) {
            console.error('Failed to get token balance:', error);
            throw error;
        }
    }

    /**
     * Get multiple token balances in parallel
     * @param {string[]} tokenAddresses - Array of token addresses
     * @returns {Promise<Object[]>} Array of token balances
     */
    async getMultipleTokenBalances(tokenAddresses) {
        try {
            const balances = await Promise.allSettled(
                tokenAddresses.map(addr => this.getTokenBalance(addr))
            );

            return balances.map((result, index) => ({
                address: tokenAddresses[index],
                ...(result.status === 'fulfilled' 
                    ? { success: true, ...result.value }
                    : { success: false, error: result.reason.message })
            }));
        } catch (error) {
            console.error('Failed to get multiple token balances:', error);
            throw error;
        }
    }

    /**
     * Estimate gas with buffer for safety
     * @param {Object} transaction - Transaction object
     * @param {number} bufferPercent - Gas buffer percentage (default 20%)
     * @returns {Promise<Object>} Gas estimate with buffer
     */
    async estimateGas(transaction, bufferPercent = 20) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            const gasEstimate = await this.provider.estimateGas(transaction);
            const buffer = gasEstimate.mul(bufferPercent).div(100);
            const gasWithBuffer = gasEstimate.add(buffer);

            return {
                estimate: gasEstimate.toString(),
                withBuffer: gasWithBuffer.toString(),
                buffer: buffer.toString(),
                bufferPercent
            };
        } catch (error) {
            console.error('Failed to estimate gas:', error);
            
            // Provide more specific error messages
            if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
                throw new Error('Transaction may fail - check contract state and parameters');
            }
            throw error;
        }
    }

    /**
     * Get current gas price with different speed options
     * @returns {Promise<Object>} Gas prices in gwei
     */
    async getGasPrice() {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            const gasPrice = await this.provider.getGasPrice();
            const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));

            // Provide options for different speeds
            return {
                slow: (gasPriceGwei * 0.9).toFixed(2),
                standard: gasPriceGwei.toFixed(2),
                fast: (gasPriceGwei * 1.2).toFixed(2),
                instant: (gasPriceGwei * 1.5).toFixed(2),
                wei: gasPrice.toString()
            };
        } catch (error) {
            console.error('Failed to get gas price:', error);
            throw error;
        }
    }

    /**
     * Get estimated transaction cost
     * @param {Object} transaction - Transaction object
     * @param {string} speed - Gas speed option (slow/standard/fast/instant)
     * @returns {Promise<Object>} Transaction cost estimate
     */
    async estimateTransactionCost(transaction, speed = 'standard') {
        try {
            const [gasEstimate, gasPrices] = await Promise.all([
                this.estimateGas(transaction),
                this.getGasPrice()
            ]);

            const gasPrice = gasPrices[speed];
            const gasPriceWei = ethers.utils.parseUnits(gasPrice, 'gwei');
            const totalCost = gasPriceWei.mul(gasEstimate.withBuffer);

            return {
                gasLimit: gasEstimate.withBuffer,
                gasPrice: gasPrice,
                gasPriceWei: gasPriceWei.toString(),
                totalCost: ethers.utils.formatEther(totalCost),
                totalCostWei: totalCost.toString(),
                speed
            };
        } catch (error) {
            console.error('Failed to estimate transaction cost:', error);
            throw error;
        }
    }

    /**
     * Wait for transaction confirmation with detailed updates
     * @param {string} txHash - Transaction hash
     * @param {number} confirmations - Number of confirmations to wait for
     * @param {number} timeout - Timeout in milliseconds
     * @param {Function} onUpdate - Progress callback
     * @returns {Promise<Object>} Transaction receipt
     */
    async waitForTransaction(
        txHash, 
        confirmations = 1, 
        timeout = TRANSACTION_TIMEOUTS.DEFAULT,
        onUpdate = null
    ) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            if (!ethers.utils.isHexString(txHash, 32)) {
                throw new Error('Invalid transaction hash');
            }

            // Add to pending transactions
            this.pendingTransactions.add(txHash);

            let currentConfirmations = 0;

            // Set up confirmation listener
            const confirmationListener = (conf) => {
                currentConfirmations = conf;
                if (onUpdate) {
                    onUpdate({ 
                        confirmations: conf, 
                        required: confirmations,
                        progress: (conf / confirmations) * 100
                    });
                }
            };

            const receipt = await Promise.race([
                (async () => {
                    this.provider.on(txHash, confirmationListener);
                    const result = await this.provider.waitForTransaction(txHash, confirmations);
                    this.provider.off(txHash, confirmationListener);
                    return result;
                })(),
                new Promise((_, reject) => 
                    setTimeout(() => {
                        this.provider.off(txHash, confirmationListener);
                        reject(new Error('Transaction confirmation timeout'));
                    }, timeout)
                )
            ]);

            // Remove from pending transactions
            this.pendingTransactions.delete(txHash);

            if (!receipt || receipt.status === 0) {
                this.metrics.failedTransactions++;
                throw new Error('Transaction failed or was reverted');
            }

            // Update metrics
            this.metrics.transactionCount++;
            this.updateAverageGasUsed(receipt.gasUsed.toString());

            // Add to transaction history
            this.addToHistory({
                hash: txHash,
                receipt,
                timestamp: Date.now(),
                confirmations
            });

            return receipt;
        } catch (error) {
            this.pendingTransactions.delete(txHash);
            console.error('Transaction failed:', error);
            throw error;
        }
    }

    /**
     * Get transaction receipt with caching
     * @param {string} txHash - Transaction hash
     * @returns {Promise<Object>} Transaction receipt
     */
    async getTransactionReceipt(txHash) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            if (!ethers.utils.isHexString(txHash, 32)) {
                throw new Error('Invalid transaction hash');
            }

            return await this.provider.getTransactionReceipt(txHash);
        } catch (error) {
            console.error('Failed to get transaction receipt:', error);
            throw error;
        }
    }

    /**
     * Get transaction details
     * @param {string} txHash - Transaction hash
     * @returns {Promise<Object>} Transaction details
     */
    async getTransaction(txHash) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            if (!ethers.utils.isHexString(txHash, 32)) {
                throw new Error('Invalid transaction hash');
            }

            return await this.provider.getTransaction(txHash);
        } catch (error) {
            console.error('Failed to get transaction:', error);
            throw error;
        }
    }

    /**
     * Cancel or speed up a pending transaction
     * @param {string} txHash - Transaction hash to replace
     * @param {string} action - 'cancel' or 'speedup'
     * @param {number} gasPriceMultiplier - Gas price multiplier (default 1.2)
     * @returns {Promise<Object>} New transaction
     */
    async replaceTransaction(txHash, action = 'speedup', gasPriceMultiplier = 1.2) {
        try {
            if (!this.signer) {
                throw new Error('Signer not available');
            }

            const tx = await this.getTransaction(txHash);
            if (!tx) {
                throw new Error('Transaction not found');
            }

            if (tx.confirmations > 0) {
                throw new Error('Transaction already confirmed');
            }

            const newGasPrice = tx.gasPrice.mul(Math.floor(gasPriceMultiplier * 100)).div(100);

            let newTx;
            if (action === 'cancel') {
                // Send 0 value to self to cancel
                newTx = await this.signer.sendTransaction({
                    to: this.userAddress,
                    value: 0,
                    nonce: tx.nonce,
                    gasPrice: newGasPrice,
                    gasLimit: 21000
                });
            } else {
                // Speed up by increasing gas price
                newTx = await this.signer.sendTransaction({
                    ...tx,
                    gasPrice: newGasPrice
                });
            }

            return {
                oldHash: txHash,
                newHash: newTx.hash,
                action,
                gasPrice: ethers.utils.formatUnits(newGasPrice, 'gwei')
            };
        } catch (error) {
            console.error('Failed to replace transaction:', error);
            throw error;
        }
    }

    /**
     * Sign a message with EIP-191 standard
     * @param {string} message - Message to sign
     * @returns {Promise<string>} Signed message
     */
    async signMessage(message) {
        try {
            if (!this.signer) {
                throw new Error('Signer not available');
            }

            if (!message || typeof message !== 'string') {
                throw new Error('Invalid message format');
            }

            return await this.signer.signMessage(message);
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('Signature rejected by user');
            }
            console.error('Failed to sign message:', error);
            throw error;
        }
    }

    /**
     * Sign typed data (EIP-712)
     * @param {Object} domain - Domain separator
     * @param {Object} types - Type definitions
     * @param {Object} value - Data to sign
     * @returns {Promise<string>} Signed data
     */
    async signTypedData(domain, types, value) {
        try {
            if (!this.signer) {
                throw new Error('Signer not available');
            }

            return await this.signer._signTypedData(domain, types, value);
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('Signature rejected by user');
            }
            console.error('Failed to sign typed data:', error);
            throw error;
        }
    }

    /**
     * Verify a signed message
     * @param {string} message - Original message
     * @param {string} signature - Signature to verify
     * @returns {string} Recovered address
     */
    static verifyMessage(message, signature) {
        try {
            return ethers.utils.verifyMessage(message, signature);
        } catch (error) {
            console.error('Failed to verify message:', error);
            throw error;
        }
    }

    /**
     * Get current block number
     * @returns {Promise<number>} Block number
     */
    async getBlockNumber() {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            return await this.provider.getBlockNumber();
        } catch (error) {
            console.error('Failed to get block number:', error);
            throw error;
        }
    }

    /**
     * Get block details
     * @param {number|string} blockHashOrNumber - Block hash or number
     * @returns {Promise<Object>} Block details
     */
    async getBlock(blockHashOrNumber) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            return await this.provider.getBlock(blockHashOrNumber);
        } catch (error) {
            console.error('Failed to get block:', error);
            throw error;
        }
    }

    /**
     * Get ENS name for address
     * @param {string} address - Ethereum address
     * @returns {Promise<string|null>} ENS name or null
     */
    async lookupAddress(address) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            if (!Web3Manager.isValidAddress(address)) {
                throw new Error('Invalid address');
            }

            return await this.provider.lookupAddress(address);
        } catch (error) {
            console.error('Failed to lookup address:', error);
            return null;
        }
    }

    /**
     * Resolve ENS name to address
     * @param {string} ensName - ENS name
     * @returns {Promise<string|null>} Address or null
     */
    async resolveName(ensName) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            return await this.provider.resolveName(ensName);
        } catch (error) {
            console.error('Failed to resolve name:', error);
            return null;
        }
    }

    /**
     * Add transaction to history
     * @param {Object} transaction - Transaction data
     */
    addToHistory(transaction) {
        this.transactionHistory.unshift(transaction);
        
        // Keep only last 100 transactions
        if (this.transactionHistory.length > 100) {
            this.transactionHistory = this.transactionHistory.slice(0, 100);
        }

        this.dispatchEvent(new CustomEvent('transaction:added', {
            detail: transaction
        }));
    }

    /**
     * Get transaction history
     * @param {number} limit - Maximum number of transactions
     * @returns {Array} Transaction history
     */
    getTransactionHistory(limit = 50) {
        return this.transactionHistory.slice(0, limit);
    }

    /**
     * Clear transaction history
     */
    clearTransactionHistory() {
        this.transactionHistory = [];
        this.dispatchEvent(new CustomEvent('transaction:historyCleared'));
    }

    /**
     * Update average gas used metric
     * @param {string} gasUsed - Gas used in transaction
     */
    updateAverageGasUsed(gasUsed) {
        const currentAvg = this.metrics.averageGasUsed;
        const count = this.metrics.transactionCount;
        
        this.metrics.averageGasUsed = 
            (currentAvg * (count - 1) + parseInt(gasUsed)) / count;
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            pendingTransactions: this.pendingTransactions.size,
            historySize: this.transactionHistory.length,
            cacheSize: this.balanceCache.size,
            successRate: this.metrics.transactionCount > 0
                ? ((this.metrics.transactionCount - this.metrics.failedTransactions) / 
                   this.metrics.transactionCount * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Clear all caches
     */
    clearCaches() {
        this.balanceCache.clear();
        this.dispatchEvent(new CustomEvent('cache:cleared'));
    }

    /**
     * Handle account changes with proper state updates
     * @param {string[]} accounts - New accounts
     */
    handleAccountsChanged(accounts) {
        if (!accounts || accounts.length === 0) {
            console.log('No accounts available, disconnecting');
            this.disconnect();
        } else {
            const newAddress = ethers.utils.getAddress(accounts[0]);
            if (newAddress !== this.userAddress) {
                this.userAddress = newAddress;
                this.balanceCache.clear(); // Clear cache on account change
                
                this.dispatchEvent(new CustomEvent('wallet:accountChanged', {
                    detail: { 
                        address: this.userAddress,
                        timestamp: Date.now()
                    }
                }));

                // Fetch new balance
                this.getBalance(true).catch(console.error);
            }
        }
    }

    /**
     * Handle chain changes with validation
     * @param {string} chainId - New chain ID (hex string)
     */
    handleChainChanged(chainId) {
        const newChainId = parseInt(chainId, 16);
        
        if (isNaN(newChainId)) {
            console.error('Invalid chain ID received:', chainId);
            return;
        }

        this.chainId = newChainId;
        this.balanceCache.clear(); // Clear cache on network change
        
        this.dispatchEvent(new CustomEvent('network:changed', {
            detail: { 
                chainId: this.chainId,
                isCorrectNetwork: this.chainId === CONTRACT_CONFIG.network.chainId,
                timestamp: Date.now()
            }
        }));

        // Reload page on network change for consistency
        window.location.reload();
    }

    /**
     * Handle disconnect event
     */
    handleDisconnect(error) {
        console.log('Wallet disconnected', error);
        this.disconnect();
    }

    /**
     * Handle wallet messages
     * @param {Object} message - Wallet message
     */
    handleMessage(message) {
        this.dispatchEvent(new CustomEvent('wallet:message', {
            detail: { message, timestamp: Date.now() }
        }));
    }

    /**
     * Handle connection errors with specific error codes
     * @param {Error} error - Connection error
     */
    handleConnectionError(error) {
        let errorCode = ERROR_CODES.NETWORK_ERROR;
        let message = error.message || 'Unknown error occurred';

        // Map specific error codes
        switch (error.code) {
            case 4001:
                errorCode = ERROR_CODES.USER_REJECTED;
                message = 'Connection rejected by user';
                break;
            case -32002:
                errorCode = ERROR_CODES.WALLET_LOCKED;
                message = 'Wallet is locked. Please unlock and try again.';
                break;
            case -32603:
                errorCode = ERROR_CODES.NETWORK_ERROR;
                message = 'Internal wallet error. Please try again.';
                break;
            default:
                if (message.toLowerCase().includes('metamask')) {
                    errorCode = ERROR_CODES.WALLET_NOT_FOUND;
                }
        }

        this.dispatchEvent(new CustomEvent('wallet:error', {
            detail: { 
                error, 
                errorCode, 
                message,
                timestamp: Date.now()
            }
        }));

        console.error(`Wallet error [${errorCode}]:`, message);
        throw { code: errorCode, message, originalError: error };
    }

    /**
     * Get detailed network information
     * @returns {Object} Network details
     */
    getNetworkInfo() {
        return {
            chainId: this.chainId,
            name: CONTRACT_CONFIG.network.name,
            rpcUrl: CONTRACT_CONFIG.network.rpcUrl,
            explorer: CONTRACT_CONFIG.network.explorer,
            isCorrectNetwork: this.chainId === CONTRACT_CONFIG.network.chainId,
            hexChainId: this.chainId ? `0x${this.chainId.toString(16)}` : null
        };
    }

    /**
     * Get comprehensive connection status
     * @returns {Object} Connection information
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            address: this.userAddress,
            chainId: this.chainId,
            networkInfo: this.getNetworkInfo(),
            walletAvailable: this.isWalletAvailable(),
            pendingTransactions: this.pendingTransactions.size,
            connectionAttempts: this.connectionAttempts
        };
    }

    /**
     * Get wallet capabilities
     * @returns {Promise<Object>} Wallet capabilities
     */
    async getWalletCapabilities() {
        try {
            if (!window.ethereum) {
                return { supported: false };
            }

            const capabilities = {
                supported: true,
                metamask: window.ethereum.isMetaMask || false,
                version: window.ethereum.version || 'unknown',
                methods: []
            };

            // Check for common methods
            const methodsToCheck = [
                'eth_accounts',
                'eth_requestAccounts',
                'wallet_switchEthereumChain',
                'wallet_addEthereumChain',
                'eth_sign',
                'personal_sign',
                'eth_signTypedData_v4'
            ];

            // Note: Can't directly check method support, but we list expected ones
            capabilities.methods = methodsToCheck;

            return capabilities;
        } catch (error) {
            console.error('Failed to get wallet capabilities:', error);
            return { supported: false, error: error.message };
        }
    }

    /**
     * Watch for specific events on a contract
     * @param {Object} contract - Ethers contract instance
     * @param {string} eventName - Event name to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    watchContractEvent(contract, eventName, callback) {
        try {
            const filter = contract.filters[eventName]();
            
            const listener = (...args) => {
                const event = args[args.length - 1];
                callback({
                    ...event,
                    args: args.slice(0, -1),
                    timestamp: Date.now()
                });
            };

            contract.on(filter, listener);

            // Return unsubscribe function
            return () => {
                contract.off(filter, listener);
            };
        } catch (error) {
            console.error('Failed to watch contract event:', error);
            throw error;
        }
    }

    /**
     * Get past events from a contract
     * @param {Object} contract - Ethers contract instance
     * @param {string} eventName - Event name
     * @param {number} fromBlock - Starting block (default: current - 1000)
     * @param {number} toBlock - Ending block (default: latest)
     * @returns {Promise<Array>} Array of events
     */
    async getContractEvents(contract, eventName, fromBlock = null, toBlock = 'latest') {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            const currentBlock = await this.getBlockNumber();
            const startBlock = fromBlock || Math.max(0, currentBlock - 1000);

            const filter = contract.filters[eventName]();
            const events = await contract.queryFilter(filter, startBlock, toBlock);

            return events.map(event => ({
                ...event,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                args: event.args,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Failed to get contract events:', error);
            throw error;
        }
    }

    /**
     * Batch multiple read calls into one
     * @param {Array} calls - Array of {contract, method, args}
     * @returns {Promise<Array>} Results array
     */
    async batchRead(calls) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            const promises = calls.map(({ contract, method, args = [] }) => 
                contract[method](...args)
            );

            return await Promise.allSettled(promises);
        } catch (error) {
            console.error('Failed to batch read:', error);
            throw error;
        }
    }

    /**
     * Parse transaction logs
     * @param {Object} receipt - Transaction receipt
     * @param {Object} contract - Contract instance with interface
     * @returns {Array} Parsed logs
     */
    static parseTransactionLogs(receipt, contract) {
        try {
            const parsedLogs = [];

            for (const log of receipt.logs) {
                try {
                    const parsed = contract.interface.parseLog(log);
                    parsedLogs.push({
                        name: parsed.name,
                        args: parsed.args,
                        signature: parsed.signature,
                        topic: parsed.topic,
                        logIndex: log.logIndex
                    });
                } catch (e) {
                    // Log might be from another contract
                    continue;
                }
            }

            return parsedLogs;
        } catch (error) {
            console.error('Failed to parse transaction logs:', error);
            return [];
        }
    }

    /**
     * Format token amount for display
     * @param {string} amount - Amount in smallest unit
     * @param {number} decimals - Token decimals
     * @param {number} displayDecimals - Decimals to display
     * @returns {string} Formatted amount
     */
    static formatTokenAmount(amount, decimals = 18, displayDecimals = 4) {
        try {
            const formatted = ethers.utils.formatUnits(amount, decimals);
            const num = parseFloat(formatted);
            
            if (num === 0) return '0';
            if (num < 0.0001) return '<0.0001';
            
            return num.toFixed(displayDecimals).replace(/\.?0+$/, '');
        } catch (error) {
            console.error('Failed to format token amount:', error);
            return '0';
        }
    }

    /**
     * Parse token amount to smallest unit
     * @param {string} amount - Human readable amount
     * @param {number} decimals - Token decimals
     * @returns {string} Amount in smallest unit
     */
    static parseTokenAmount(amount, decimals = 18) {
        try {
            return ethers.utils.parseUnits(amount.toString(), decimals).toString();
        } catch (error) {
            console.error('Failed to parse token amount:', error);
            throw new Error('Invalid token amount');
        }
    }

    /**
     * Format address for display with customizable length
     * @param {string} address - Ethereum address
     * @param {number} prefixLength - Length of prefix (default 6)
     * @param {number} suffixLength - Length of suffix (default 4)
     * @returns {string} Formatted address
     */
    static formatAddress(address, prefixLength = 6, suffixLength = 4) {
        if (!address || typeof address !== 'string') return '';
        if (!ethers.utils.isAddress(address)) return address;
        
        return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
    }

    /**
     * Check if address is valid with checksum validation
     * @param {string} address - Address to validate
     * @returns {boolean} Validity
     */
    static isValidAddress(address) {
        if (!address || typeof address !== 'string') return false;
        
        try {
            return ethers.utils.isAddress(address);
        } catch {
            return false;
        }
    }

    /**
     * Get checksummed address
     * @param {string} address - Address to checksum
     * @returns {string|null} Checksummed address or null
     */
    static getChecksumAddress(address) {
        try {
            return ethers.utils.getAddress(address);
        } catch {
            return null;
        }
    }

    /**
     * Compare two addresses ignoring case
     * @param {string} address1 - First address
     * @param {string} address2 - Second address
     * @returns {boolean} Whether addresses match
     */
    static compareAddresses(address1, address2) {
        try {
            return ethers.utils.getAddress(address1) === ethers.utils.getAddress(address2);
        } catch {
            return false;
        }
    }

    /**
     * Check if address is contract
     * @param {string} address - Address to check
     * @returns {Promise<boolean>} Whether address is a contract
     */
    async isContract(address) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            if (!Web3Manager.isValidAddress(address)) {
                return false;
            }

            const code = await this.provider.getCode(address);
            return code !== '0x';
        } catch (error) {
            console.error('Failed to check if address is contract:', error);
            return false;
        }
    }

    /**
     * Convert wei to ether with formatting
     * @param {string|BigNumber} wei - Amount in wei
     * @param {number} decimals - Decimal places to show
     * @returns {string} Formatted ether amount
     */
    static weiToEther(wei, decimals = 4) {
        try {
            const ether = ethers.utils.formatEther(wei);
            const num = parseFloat(ether);
            return num.toFixed(decimals).replace(/\.?0+$/, '');
        } catch (error) {
            console.error('Failed to convert wei to ether:', error);
            return '0';
        }
    }

    /**
     * Convert ether to wei
     * @param {string|number} ether - Amount in ether
     * @returns {string} Amount in wei
     */
    static etherToWei(ether) {
        try {
            return ethers.utils.parseEther(ether.toString()).toString();
        } catch (error) {
            console.error('Failed to convert ether to wei:', error);
            throw new Error('Invalid ether amount');
        }
    }

    /**
     * Generate random wallet (for testing only)
     * @returns {Object} Wallet with address and private key
     */
    static generateRandomWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic.phrase
        };
    }

    /**
     * Create wallet from private key
     * @param {string} privateKey - Private key
     * @returns {Object} Wallet instance
     */
    static createWalletFromPrivateKey(privateKey) {
        try {
            return new ethers.Wallet(privateKey);
        } catch (error) {
            console.error('Failed to create wallet from private key:', error);
            throw new Error('Invalid private key');
        }
    }

    /**
     * Create wallet from mnemonic
     * @param {string} mnemonic - Mnemonic phrase
     * @param {string} path - Derivation path (default: m/44'/60'/0'/0/0)
     * @returns {Object} Wallet instance
     */
    static createWalletFromMnemonic(mnemonic, path = "m/44'/60'/0'/0/0") {
        try {
            return ethers.Wallet.fromMnemonic(mnemonic, path);
        } catch (error) {
            console.error('Failed to create wallet from mnemonic:', error);
            throw new Error('Invalid mnemonic');
        }
    }

    /**
     * Get explorer URL for address
     * @param {string} address - Ethereum address
     * @returns {string} Explorer URL
     */
    getExplorerUrl(address) {
        const explorer = CONTRACT_CONFIG.network.explorer;
        if (!explorer) return '';
        return `${explorer}/address/${address}`;
    }

    /**
     * Get explorer URL for transaction
     * @param {string} txHash - Transaction hash
     * @returns {string} Explorer URL
     */
    getTransactionExplorerUrl(txHash) {
        const explorer = CONTRACT_CONFIG.network.explorer;
        if (!explorer) return '';
        return `${explorer}/tx/${txHash}`;
    }

    /**
     * Get explorer URL for token
     * @param {string} tokenAddress - Token address
     * @returns {string} Explorer URL
     */
    getTokenExplorerUrl(tokenAddress) {
        const explorer = CONTRACT_CONFIG.network.explorer;
        if (!explorer) return '';
        return `${explorer}/token/${tokenAddress}`;
    }

    /**
     * Export connection state for persistence
     * @returns {Object} Serializable state
     */
    exportState() {
        return {
            address: this.userAddress,
            chainId: this.chainId,
            isConnected: this.isConnected,
            lastConnectionTime: this.lastConnectionTime,
            metrics: this.metrics
        };
    }

    /**
     * Import connection state (for restoration)
     * @param {Object} state - Previously exported state
     */
    importState(state) {
        if (state.address) this.userAddress = state.address;
        if (state.chainId) this.chainId = state.chainId;
        if (state.lastConnectionTime) this.lastConnectionTime = state.lastConnectionTime;
        if (state.metrics) this.metrics = { ...this.metrics, ...state.metrics };
    }

    /**
     * Clean up resources and event listeners
     */
    cleanup() {
        this.removeEventListeners();
        this.disconnect();
        this.clearCaches();
        this.clearTransactionHistory();
        this.pendingTransactions.clear();
    }
}

export default Web3Manager;
