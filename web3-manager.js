// Enhanced Web3 Connection Manager
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
        
        // Bind methods to maintain context
        this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
        this.handleChainChanged = this.handleChainChanged.bind(this);
        this.handleDisconnect = this.handleDisconnect.bind(this);
        
        this.setupEventListeners();
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
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        if (!window.ethereum) return;

        window.ethereum.removeListener('accountsChanged', this.handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', this.handleChainChanged);
        window.ethereum.removeListener('disconnect', this.handleDisconnect);
    }

    /**
     * Connect to user's wallet with improved state management
     * @returns {Promise<boolean>} Success status
     */
    async connectWallet() {
        // Prevent concurrent connection attempts
        if (this.isConnecting) {
            console.warn('Connection already in progress');
            return false;
        }

        if (this.isConnected) {
            console.warn('Wallet already connected');
            return true;
        }

        this.isConnecting = true;

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

            // Dispatch connection event
            this.dispatchEvent(new CustomEvent('wallet:connected', {
                detail: { 
                    address: this.userAddress, 
                    chainId: this.chainId,
                    timestamp: Date.now()
                }
            }));

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

            const blockTag = fresh ? 'latest' : 'pending';
            const balance = await this.provider.getBalance(this.userAddress, blockTag);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('Failed to get balance:', error);
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
                buffer: buffer.toString()
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
            const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');

            // Provide options for different speeds
            return {
                standard: gasPriceGwei,
                fast: (parseFloat(gasPriceGwei) * 1.2).toFixed(2),
                instant: (parseFloat(gasPriceGwei) * 1.5).toFixed(2)
            };
        } catch (error) {
            console.error('Failed to get gas price:', error);
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

            let currentConfirmations = 0;

            // Set up confirmation listener
            const confirmationListener = (conf) => {
                currentConfirmations = conf;
                if (onUpdate) {
                    onUpdate({ confirmations: conf, required: confirmations });
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

            if (!receipt || !receipt.status) {
                throw new Error('Transaction failed or was reverted');
            }

            return receipt;
        } catch (error) {
            console.error('Transaction failed:', error);
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
                
                this.dispatchEvent(new CustomEvent('wallet:accountChanged', {
                    detail: { 
                        address: this.userAddress,
                        timestamp: Date.now()
                    }
                }));
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
            walletAvailable: this.isWalletAvailable()
        };
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
     * Clean up resources and event listeners
     */
    cleanup() {
        this.removeEventListeners();
        this.disconnect();
    }
}

export default Web3Manager;
