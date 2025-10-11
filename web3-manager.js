// Web3 Connection Manager
// js/services/web3-manager.js

import { CONTRACT_CONFIG, ERROR_CODES, TRANSACTION_TIMEOUTS } from '../utils/constants.js';

/**
 * Manages Web3 connection, wallet integration, and network handling
 */
export class Web3Manager extends EventTarget {
    constructor() {
        super();
        
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.chainId = null;
        this.isConnected = false;
        
        this.setupEventListeners();
    }

    /**
     * Set up MetaMask event listeners
     */
    setupEventListeners() {
        if (typeof window.ethereum !== 'undefined') {
            window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
            window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
            window.ethereum.on('disconnect', this.handleDisconnect.bind(this));
        }
    }

    /**
     * Connect to user's wallet
     * @returns {Promise<boolean>} Success status
     */
    async connectWallet() {
        try {
            if (!this.isWalletAvailable()) {
                throw new Error('MetaMask not detected. Please install MetaMask extension.');
            }

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found. Please connect your wallet.');
            }

            // Set up provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.userAddress = accounts[0];

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
                detail: { address: this.userAddress, chainId: this.chainId }
            }));

            return true;

        } catch (error) {
            this.handleConnectionError(error);
            return false;
        }
    }

    /**
     * Check if wallet is available
     * @returns {boolean} Wallet availability
     */
    isWalletAvailable() {
        return typeof window.ethereum !== 'undefined';
    }

    /**
     * Check existing connection
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

            if (accounts.length > 0) {
                return await this.connectWallet();
            }

            return false;
        } catch (error) {
            console.error('Failed to check connection:', error);
            return false;
        }
    }

    /**
     * Switch to the correct network
     */
    async switchNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ 
                    chainId: `0x${CONTRACT_CONFIG.network.chainId.toString(16)}` 
                }]
            });
        } catch (switchError) {
            // Network doesn't exist, add it
            if (switchError.code === 4902) {
                await this.addNetwork();
            } else {
                throw switchError;
            }
        }
    }

    /**
     * Add the network to MetaMask
     */
    async addNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${CONTRACT_CONFIG.network.chainId.toString(16)}`,
                    chainName: CONTRACT_CONFIG.network.name,
                    rpcUrls: [CONTRACT_CONFIG.network.rpcUrl],
                    blockExplorerUrls: [CONTRACT_CONFIG.network.explorer],
                    nativeCurrency: {
                        name: 'CORE',
                        symbol: 'CORE',
                        decimals: 18
                    }
                }]
            });
        } catch (error) {
            throw new Error(`Failed to add ${CONTRACT_CONFIG.network.name} network`);
        }
    }

    /**
     * Disconnect wallet
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.chainId = null;
        this.isConnected = false;

        this.dispatchEvent(new CustomEvent('wallet:disconnected'));
    }

    /**
     * Get user's ETH balance
     * @returns {Promise<string>} Balance in ETH
     */
    async getBalance() {
        try {
            if (!this.provider || !this.userAddress) {
                throw new Error('Wallet not connected');
            }

            const balance = await this.provider.getBalance(this.userAddress);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('Failed to get balance:', error);
            throw error;
        }
    }

    /**
     * Estimate gas for a transaction
     * @param {Object} transaction - Transaction object
     * @returns {Promise<string>} Gas estimate
     */
    async estimateGas(transaction) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            const gasEstimate = await this.provider.estimateGas(transaction);
            return gasEstimate.toString();
        } catch (error) {
            console.error('Failed to estimate gas:', error);
            throw error;
        }
    }

    /**
     * Get current gas price
     * @returns {Promise<string>} Gas price in gwei
     */
    async getGasPrice() {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            const gasPrice = await this.provider.getGasPrice();
            return ethers.utils.formatUnits(gasPrice, 'gwei');
        } catch (error) {
            console.error('Failed to get gas price:', error);
            throw error;
        }
    }

    /**
     * Wait for transaction confirmation
     * @param {string} txHash - Transaction hash
     * @param {number} confirmations - Number of confirmations to wait for
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Object>} Transaction receipt
     */
    async waitForTransaction(txHash, confirmations = 1, timeout = TRANSACTION_TIMEOUTS.DEFAULT) {
        try {
            if (!this.provider) {
                throw new Error('Provider not available');
            }

            const receipt = await Promise.race([
                this.provider.waitForTransaction(txHash, confirmations),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transaction timeout')), timeout)
                )
            ]);

            return receipt;
        } catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }

    /**
     * Sign a message
     * @param {string} message - Message to sign
     * @returns {Promise<string>} Signed message
     */
    async signMessage(message) {
        try {
            if (!this.signer) {
                throw new Error('Signer not available');
            }

            return await this.signer.signMessage(message);
        } catch (error) {
            console.error('Failed to sign message:', error);
            throw error;
        }
    }

    /**
     * Handle account changes
     * @param {string[]} accounts - New accounts
     */
    handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            this.disconnect();
        } else if (accounts[0] !== this.userAddress) {
            this.userAddress = accounts[0];
            this.dispatchEvent(new CustomEvent('wallet:accountChanged', {
                detail: { address: this.userAddress }
            }));
        }
    }

    /**
     * Handle chain changes
     * @param {string} chainId - New chain ID
     */
    handleChainChanged(chainId) {
        this.chainId = parseInt(chainId, 16);
        
        this.dispatchEvent(new CustomEvent('network:changed', {
            detail: { chainId: this.chainId }
        }));

        // Reload page on network change for consistency
        window.location.reload();
    }

    /**
     * Handle disconnect
     */
    handleDisconnect() {
        this.disconnect();
    }

    /**
     * Handle connection errors
     * @param {Error} error - Connection error
     */
    handleConnectionError(error) {
        let errorCode = ERROR_CODES.NETWORK_ERROR;
        let message = error.message;

        // Map specific error codes
        if (error.code === 4001) {
            errorCode = ERROR_CODES.USER_REJECTED;
            message = 'Connection rejected by user';
        } else if (error.code === -32002) {
            errorCode = ERROR_CODES.WALLET_LOCKED;
            message = 'Wallet is locked. Please unlock and try again.';
        } else if (error.message.includes('MetaMask')) {
            errorCode = ERROR_CODES.WALLET_NOT_FOUND;
        }

        this.dispatchEvent(new CustomEvent('wallet:error', {
            detail: { error, errorCode, message }
        }));

        throw { code: errorCode, message };
    }

    /**
     * Get network information
     * @returns {Object} Network details
     */
    getNetworkInfo() {
        return {
            chainId: this.chainId,
            name: CONTRACT_CONFIG.network.name,
            rpcUrl: CONTRACT_CONFIG.network.rpcUrl,
            explorer: CONTRACT_CONFIG.network.explorer,
            isCorrectNetwork: this.chainId === CONTRACT_CONFIG.network.chainId
        };
    }

    /**
     * Get connection status
     * @returns {Object} Connection information
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            address: this.userAddress,
            chainId: this.chainId,
            networkInfo: this.getNetworkInfo()
        };
    }

    /**
     * Format address for display
     * @param {string} address - Ethereum address
     * @returns {string} Formatted address
     */
    static formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Check if address is valid
     * @param {string} address - Address to validate
     * @returns {boolean} Validity
     */
    static isValidAddress(address) {
        return ethers.utils.isAddress(address);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (typeof window.ethereum !== 'undefined') {
            window.ethereum.removeAllListeners('accountsChanged');
            window.ethereum.removeAllListeners('chainChanged');
            window.ethereum.removeAllListeners('disconnect');
        }
        
        this.disconnect();
    }
}

export default Web3Manager;
