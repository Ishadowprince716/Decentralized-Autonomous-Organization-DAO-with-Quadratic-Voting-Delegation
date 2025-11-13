/**
 * ============================================================================
 * Web3Manager - Enterprise-Grade Web3 Wallet Management Library (All-in-One)
 * ============================================================================
 * 
 * A production-ready Ethereum wallet management service with:
 * - Multi-wallet support (MetaMask, Coinbase, Trust Wallet, etc.)
 * - Automatic reconnection & network switching
 * - Advanced transaction management with gas estimation
 * - Comprehensive error handling with custom Web3Error class
 * - Smart caching with configurable TTL
 * - Security-first design with rate limiting
 * - Full ethers.js v6 compatibility
 * - Event-driven architecture for reactive UIs
 * 
 * @version 2.0.0
 * @license MIT
 * @author Your Name
 * 
 * Installation: npm install ethers@6.x
 * Usage: import Web3Manager from './web3-manager.js';
 * 
 * ============================================================================
 */

import { ethers } from 'ethers';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Contract and Network Configuration
 * Update these values based on your target blockchain
 */
const CONTRACT_CONFIG = {
  network: {
    chainId: 1, // Ethereum Mainnet (11155111 for Sepolia)
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  contracts: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  tokens: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  },
};

/**
 * Standard Error Codes for Web3 Operations
 */
const ERROR_CODES = {
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  WALLET_LOCKED: 'WALLET_LOCKED',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  USER_REJECTED: 'USER_REJECTED',
  ACTION_REJECTED: 'ACTION_REJECTED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONFIG_ERROR: 'NETWORK_CONFIG_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  INVALID_KEY: 'INVALID_KEY',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  SIGNER_ERROR: 'SIGNER_ERROR',
  NO_ACCOUNTS: 'NO_ACCOUNTS',
  GAS_ESTIMATION_ERROR: 'GAS_ESTIMATION_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  FETCH_ERROR: 'FETCH_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  SIGNING_ERROR: 'SIGNING_ERROR',
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND',
};

/**
 * Transaction Timeout Values (in milliseconds)
 */
const TRANSACTION_TIMEOUTS = {
  GAS_ESTIMATION: 10_000,
  SEND_TX: 30_000,
  TX_RECEIPT: 60_000,
  FAST_CONFIRMATION: 30_000,
  STANDARD_CONFIRMATION: 60_000,
  SLOW_CONFIRMATION: 120_000,
  DEFAULT: 120_000,
  LONG_WAIT: 300_000,
};

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

/**
 * Custom error class for Web3 operations with structured error handling
 * @class Web3Error
 * @extends Error
 */
class Web3Error extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', originalError = null) {
    super(message);
    this.name = 'Web3Error';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

// ============================================================================
// MAIN WEB3MANAGER CLASS
// ============================================================================

/**
 * Enterprise-Grade Web3 Manager
 * Manages wallet connections, transactions, and blockchain interactions
 * @class Web3Manager
 * @extends EventTarget
 */
export class Web3Manager extends EventTarget {
  /**
   * Creates a new Web3Manager instance
   * @param {Object} options - Configuration options
   * @param {number} [options.maxConnectionAttempts=3] - Max connection attempts
   * @param {number} [options.connectionTimeout=30000] - Connection timeout in ms
   * @param {number} [options.cacheExpiry=30000] - Balance cache expiry in ms
   * @param {boolean} [options.autoReconnect=true] - Auto-reconnect on visibility change
   * @param {Function} [options.logger=console] - Logger instance for debugging
   */
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      maxConnectionAttempts: options.maxConnectionAttempts ?? 3,
      connectionTimeout: options.connectionTimeout ?? 30_000,
      cacheExpiry: options.cacheExpiry ?? 30_000,
      autoReconnect: options.autoReconnect ?? true,
      logger: options.logger ?? console,
    };

    // Public State
    this.provider = null;
    this.signer = null;
    this.userAddress = null;
    this.chainId = null;
    this.isConnected = false;
    this.isConnecting = false;

    // Enhanced State Tracking
    this.connectionAttempts = 0;
    this.lastConnectionTime = null;
    this.lastErrorTime = null;
    this.connectionStartTime = null;

    // Cache Management
    this.balanceCache = new Map();
    this.tokenBalanceCache = new Map();

    // Transaction Management
    this.transactionHistory = [];
    this.pendingTransactions = new Map();
    this.maxHistorySize = 100;

    // Performance Monitoring
    this.metrics = {
      connectionTime: 0,
      totalConnections: 0,
      failedConnectionAttempts: 0,
      transactionCount: 0,
      failedTransactions: 0,
      averageGasUsed: 0,
      averageGasPrice: '0',
      lastTransactionTime: null,
    };

    // Rate Limiting
    this.rateLimiter = new Map();
    this.rateLimitConfig = {
      requestsPerSecond: 10,
      requestWindow: 1000,
    };

    // Event Listeners (Bound)
    this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
    this.handleChainChanged = this.handleChainChanged.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleConnect = this.handleConnect.bind(this);

    // Initialization
    this.setupEventListeners();
    this.initializeAutoReconnect();
  }

  // ========== SETUP / CLEANUP ==========

  /**
   * Setup ethereum provider event listeners
   * @private
   */
  setupEventListeners() {
    if (typeof window === 'undefined' || !window.ethereum) {
      this.config.logger.warn('[Web3Manager] window.ethereum not available');
      return;
    }

    this.removeEventListeners();

    const provider = window.ethereum;
    provider.on?.('accountsChanged', this.handleAccountsChanged);
    provider.on?.('chainChanged', this.handleChainChanged);
    provider.on?.('disconnect', this.handleDisconnect);
    provider.on?.('connect', this.handleConnect);
    provider.on?.('message', this.handleMessage);

    this.config.logger.debug('[Web3Manager] Event listeners setup');
  }

  /**
   * Safely remove all ethereum provider event listeners
   * @private
   */
  removeEventListeners() {
    if (typeof window === 'undefined' || !window.ethereum) return;

    try {
      const provider = window.ethereum;
      provider.removeListener?.('accountsChanged', this.handleAccountsChanged);
      provider.removeListener?.('chainChanged', this.handleChainChanged);
      provider.removeListener?.('disconnect', this.handleDisconnect);
      provider.removeListener?.('connect', this.handleConnect);
      provider.removeListener?.('message', this.handleMessage);
    } catch (error) {
      this.config.logger.warn('[Web3Manager] Error removing listeners:', error?.message);
    }
  }

  /**
   * Initialize auto-reconnect functionality
   * @private
   */
  initializeAutoReconnect() {
    if (!this.config.autoReconnect) return;

    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => this.checkConnection().catch(() => {}));
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && this.isConnected) {
          const isValid = await this.verifyConnection().catch(() => false);
          if (!isValid) {
            this.config.logger.info('[Web3Manager] Reconnecting...');
            await this.connectWallet().catch(() => {});
          }
        }
      });
    }
  }

  // ========== WALLET / CONNECTION ==========

  /**
   * Check if wallet provider is available
   * @returns {boolean}
   */
  isWalletAvailable() {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  /**
   * Get information about available wallets
   * @returns {Object}
   */
  getAvailableWallets() {
    const wallets = { metamask: false, coinbase: false, trustwallet: false, other: false };

    if (!this.isWalletAvailable()) return wallets;

    const provider = window.ethereum;
    wallets.metamask = !!provider.isMetaMask;
    wallets.coinbase = !!provider.isCoinbaseWallet;
    wallets.trustwallet = !!provider.isTrust;
    wallets.other = !wallets.metamask && !wallets.coinbase && !wallets.trustwallet;

    return wallets;
  }

  /**
   * Connect wallet with comprehensive error handling and retry logic
   * @async
   * @returns {Promise<boolean>}
   */
  async connectWallet() {
    const startTime = Date.now();

    if (this.isConnecting) {
      this.config.logger.warn('[Web3Manager] Connection in progress');
      return false;
    }

    if (this.isConnected) {
      this.config.logger.info('[Web3Manager] Already connected');
      return true;
    }

    if (!this.isWalletAvailable()) {
      const error = new Web3Error(
        'Wallet provider not found. Install MetaMask or another provider.',
        ERROR_CODES.WALLET_NOT_FOUND
      );
      this.handleConnectionError(error);
      throw error;
    }

    if (!this.checkRateLimit('connectWallet')) {
      const error = new Web3Error('Too many connection attempts.', ERROR_CODES.RATE_LIMITED);
      throw error;
    }

    if (this.connectionAttempts >= this.config.maxConnectionAttempts) {
      const timeSinceLastAttempt = Date.now() - (this.lastConnectionTime ?? 0);
      if (timeSinceLastAttempt < 60_000) {
        const error = new Web3Error(
          `Max connection attempts (${this.connectionAttempts}) reached.`,
          ERROR_CODES.CONNECTION_TIMEOUT
        );
        throw error;
      }
      this.connectionAttempts = 0;
    }

    this.isConnecting = true;
    this.connectionAttempts++;
    this.lastConnectionTime = Date.now();
    this.connectionStartTime = startTime;

    try {
      const accounts = await Promise.race([
        window.ethereum.request({ method: 'eth_requestAccounts' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Web3Error('Connection timeout', ERROR_CODES.CONNECTION_TIMEOUT)), this.config.connectionTimeout)
        ),
      ]);

      if (!accounts || accounts.length === 0) {
        throw new Web3Error('No accounts returned', ERROR_CODES.NO_ACCOUNTS);
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.userAddress = ethers.getAddress(accounts[0]);

      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId);

      if (this.chainId !== CONTRACT_CONFIG.network.chainId) {
        try {
          await this.switchNetwork();
        } catch (switchError) {
          this.config.logger.warn('[Web3Manager] Network switch failed:', switchError.message);
          return false;
        }
      }

      this.isConnected = true;
      this.connectionAttempts = 0;
      this.metrics.connectionTime = Date.now() - startTime;
      this.metrics.totalConnections++;

      this.dispatchEvent(
        new CustomEvent('wallet:connected', {
          detail: {
            address: this.userAddress,
            chainId: this.chainId,
            timestamp: Date.now(),
            connectionTime: this.metrics.connectionTime,
            walletInfo: this.getAvailableWallets(),
          },
        })
      );

      this.getBalance(true).catch(() => {});
      return true;
    } catch (error) {
      this.handleConnectionError(error);
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Check if wallet is currently connected
   * @async
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    try {
      if (!this.isWalletAvailable()) return false;

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        return await this.connectWallet();
      }
      return false;
    } catch (error) {
      this.config.logger.error('[Web3Manager] Check connection error:', error);
      return false;
    }
  }

  /**
   * Verify that current connection is still valid
   * @async
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    if (!this.isConnected || !this.provider) return false;

    try {
      const network = await this.provider.getNetwork();
      const accounts = await this.provider.listAccounts();

      const isValid = accounts.length > 0 && network.chainId === BigInt(this.chainId);

      if (!isValid) {
        this.config.logger.warn('[Web3Manager] Connection verification failed');
        this.disconnect();
        return false;
      }

      return true;
    } catch (error) {
      this.config.logger.error('[Web3Manager] Verification error:', error);
      this.disconnect();
      return false;
    }
  }

  /**
   * Disconnect wallet and clear all state
   */
  disconnect() {
    this.provider = null;
    this.signer = null;
    this.userAddress = null;
    this.chainId = null;
    this.isConnected = false;
    this.isConnecting = false;

    this.balanceCache.clear();
    this.tokenBalanceCache.clear();
    this.pendingTransactions.clear();

    this.dispatchEvent(new CustomEvent('wallet:disconnected', { detail: { timestamp: Date.now() } }));

    this.config.logger.info('[Web3Manager] Disconnected');
  }

  // ========== NETWORK HELPERS ==========

  /**
   * Switch to target network configured in CONTRACT_CONFIG
   * @async
   * @throws {Web3Error}
   */
  async switchNetwork() {
    const target = CONTRACT_CONFIG.network;
    if (!target?.chainId) {
      throw new Web3Error('Target network not configured', ERROR_CODES.NETWORK_CONFIG_ERROR);
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${target.chainId.toString(16)}` }],
      });

      await this.waitForNetworkSwitch(target.chainId, 12, 500);
      this.config.logger.info('[Web3Manager] Network switched');
    } catch (error) {
      const errorCode = error?.code;

      if (errorCode === 4902 || errorCode === -32603) {
        this.config.logger.info('[Web3Manager] Adding network');
        await this.addNetwork();
      } else if (errorCode === 4001) {
        throw new Web3Error('Network switch rejected by user', ERROR_CODES.USER_REJECTED, error);
      } else {
        throw new Web3Error(`Network switch failed: ${error?.message}`, ERROR_CODES.NETWORK_ERROR, error);
      }
    }
  }

  /**
   * Wait for network to switch with polling
   * @async
   * @private
   */
  async waitForNetworkSwitch(targetChainId, maxAttempts = 10, delayMs = 500) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const network = await this.provider.getNetwork();
        if (Number(network.chainId) === targetChainId) {
          this.chainId = targetChainId;
          return;
        }
      } catch (error) {
        this.config.logger.debug(`[Web3Manager] Network check ${i + 1} failed`);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Web3Error('Network switch timeout', ERROR_CODES.NETWORK_TIMEOUT);
  }

  /**
   * Add new network to wallet
   * @async
   * @throws {Web3Error}
   */
  async addNetwork() {
    const config = CONTRACT_CONFIG.network;
    if (!config?.chainId || !config?.rpcUrl || !config?.name) {
      throw new Web3Error('Invalid network config', ERROR_CODES.NETWORK_CONFIG_ERROR);
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${config.chainId.toString(16)}`,
            chainName: config.name,
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: config.explorer ? [config.explorer] : [],
            nativeCurrency: config.nativeCurrency ?? { name: 'ETH', symbol: 'ETH', decimals: 18 },
          },
        ],
      });

      this.config.logger.info(`[Web3Manager] Network ${config.name} added`);
    } catch (error) {
      if (error?.code === 4001) {
        throw new Web3Error('Network addition rejected', ERROR_CODES.USER_REJECTED);
      }
      throw new Web3Error(`Failed to add network: ${error?.message}`, ERROR_CODES.NETWORK_ERROR, error);
    }
  }

  // ========== BALANCE / TOKENS ==========

  /**
   * Get native token balance for connected wallet
   * @async
   * @param {boolean} fresh - Force fresh fetch, bypass cache
   * @returns {Promise<string>}
   */
  async getBalance(fresh = false) {
    if (!this.provider || !this.userAddress) {
      throw new Web3Error('Wallet not connected', ERROR_CODES.WALLET_NOT_CONNECTED);
    }

    const cacheKey = `balance_${this.userAddress}_${this.chainId}`;
    const cached = this.balanceCache.get(cacheKey);

    if (!fresh && cached && this.isCacheValid(cached.timestamp)) {
      this.config.logger.debug('[Web3Manager] Returning cached balance');
      return cached.balance;
    }

    try {
      const blockTag = fresh ? 'latest' : 'pending';
      const raw = await this.provider.getBalance(this.userAddress, blockTag);
      const formatted = ethers.formatEther(raw);

      this.balanceCache.set(cacheKey, { balance: formatted, timestamp: Date.now() });
      return formatted;
    } catch (error) {
      throw new Web3Error('Failed to fetch balance', ERROR_CODES.FETCH_ERROR, error);
    }
  }

  /**
   * Get ERC20 token balance
   * @async
   * @param {string} tokenAddress - Token contract address
   * @param {string} [userAddress] - User address (defaults to connected wallet)
   * @returns {Promise<Object>}
   */
  async getTokenBalance(tokenAddress, userAddress = null) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    const addr = userAddress ?? this.userAddress;
    if (!Web3Manager.isValidAddress(addr)) {
      throw new Web3Error('Invalid user address', ERROR_CODES.INVALID_ADDRESS);
    }
    if (!Web3Manager.isValidAddress(tokenAddress)) {
      throw new Web3Error('Invalid token address', ERROR_CODES.INVALID_ADDRESS);
    }

    const ERC20_ABI = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)',
    ];

    try {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const [balance, decimals, symbol, name] = await Promise.all([
        token.balanceOf(addr),
        token.decimals(),
        token.symbol(),
        token.name(),
      ]);

      const formatted = ethers.formatUnits(balance, decimals);
      const cacheKey = `token_${tokenAddress}_${addr}_${this.chainId}`;

      this.tokenBalanceCache.set(cacheKey, { balance: formatted, timestamp: Date.now() });

      return { balance: formatted, decimals: Number(decimals), symbol, name, raw: balance.toString() };
    } catch (error) {
      throw new Web3Error('Failed to fetch token balance', ERROR_CODES.FETCH_ERROR, error);
    }
  }

  /**
   * Get balances for multiple tokens
   * @async
   * @param {string[]} tokenAddresses - Array of token addresses
   * @returns {Promise<Array>}
   */
  async getMultipleTokenBalances(tokenAddresses = []) {
    const results = await Promise.allSettled(tokenAddresses.map((addr) => this.getTokenBalance(addr)));

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { address: tokenAddresses[index], success: true, ...result.value };
      }
      return { address: tokenAddresses[index], success: false, error: result.reason?.message ?? String(result.reason) };
    });
  }

  // ========== GAS / ESTIMATES ==========

  /**
   * Estimate gas for a transaction with buffer
   * @async
   * @param {Object} transaction - Transaction object
   * @param {number} bufferPercent - Buffer percentage (default 20%)
   * @returns {Promise<Object>}
   */
  async estimateGas(transaction, bufferPercent = 20) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    if (bufferPercent < 0 || bufferPercent > 500) {
      throw new Web3Error('Buffer must be 0-500%', ERROR_CODES.INVALID_PARAMETER);
    }

    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      const buffer = (gasEstimate * BigInt(bufferPercent)) / BigInt(100);
      const gasWithBuffer = gasEstimate + buffer;

      return { estimate: gasEstimate, withBuffer: gasWithBuffer, buffer, bufferPercent };
    } catch (error) {
      if (error?.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Web3Error(
          'Unpredictable gas limit - transaction may fail',
          ERROR_CODES.GAS_ESTIMATION_ERROR,
          error
        );
      }
      throw new Web3Error('Gas estimation failed', ERROR_CODES.GAS_ESTIMATION_ERROR, error);
    }
  }

  /**
   * Get current gas prices
   * @async
   * @returns {Promise<Object>}
   */
  async getGasPrice() {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || (await this.provider.getGasPrice());
      const gasPriceGwei = Number(ethers.formatUnits(gasPrice, 'gwei'));

      this.metrics.averageGasPrice = gasPriceGwei.toFixed(2);

      return {
        slow: (gasPriceGwei * 0.9).toFixed(2),
        standard: gasPriceGwei.toFixed(2),
        fast: (gasPriceGwei * 1.2).toFixed(2),
        instant: (gasPriceGwei * 1.5).toFixed(2),
        wei: gasPrice.toString(),
      };
    } catch (error) {
      throw new Web3Error('Failed to fetch gas price', ERROR_CODES.FETCH_ERROR, error);
    }
  }

  /**
   * Estimate transaction cost including gas and buffer
   * @async
   * @param {Object} transaction - Transaction object
   * @param {string} speed - Gas speed ('slow', 'standard', 'fast', 'instant')
   * @returns {Promise<Object>}
   */
  async estimateTransactionCost(transaction, speed = 'standard') {
    try {
      const gasEstimate = await this.estimateGas(transaction);
      const gasPrices = await this.getGasPrice();

      const gasPriceStr = gasPrices[speed] ?? gasPrices.standard;
      const gasPriceWei = ethers.parseUnits(gasPriceStr, 'gwei');
      const totalCostWei = gasPriceWei * gasEstimate.withBuffer;

      return {
        gasLimit: gasEstimate.withBuffer.toString(),
        gasPrice: gasPriceStr,
        gasPriceWei: gasPriceWei.toString(),
        totalCost: ethers.formatEther(totalCostWei),
        totalCostWei: totalCostWei.toString(),
        speed,
      };
    } catch (error) {
      throw new Web3Error('Transaction cost estimation failed', ERROR_CODES.FETCH_ERROR, error);
    }
  }

  // ========== TRANSACTIONS ==========

  /**
   * Wait for transaction confirmation with progress callbacks
   * @async
   * @param {string} txHash - Transaction hash
   * @param {number} confirmations - Required confirmations
   * @param {number} timeout - Timeout in ms
   * @param {Function} onUpdate - Progress callback
   * @returns {Promise<Object>}
   */
  async waitForTransaction(txHash, confirmations = 1, timeout = TRANSACTION_TIMEOUTS.DEFAULT, onUpdate = null) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    if (!ethers.isBytesLike(txHash)) {
      throw new Web3Error('Invalid transaction hash', ERROR_CODES.INVALID_PARAMETER);
    }

    this.pendingTransactions.set(txHash, {
      startTime: Date.now(),
      confirmations: 0,
      status: 'pending',
    });

    try {
      const receipt = await Promise.race([
        this.provider.waitForTransaction(txHash, confirmations),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Web3Error('Confirmation timeout', ERROR_CODES.TIMEOUT)),
            timeout
          )
        ),
      ]);

      if (!receipt || receipt.status === 0) {
        this.metrics.failedTransactions++;
        throw new Web3Error('Transaction failed or reverted', ERROR_CODES.TRANSACTION_FAILED);
      }

      this.metrics.transactionCount++;
      this.metrics.lastTransactionTime = Date.now();
      this.updateAverageGasUsed(receipt.gasUsed?.toString?.() ?? '0');

      this.addToHistory({
        hash: txHash,
        receipt,
        timestamp: Date.now(),
        confirmations: receipt.confirmations || confirmations,
        status: 'confirmed',
      });

      return receipt;
    } catch (error) {
      this.metrics.failedTransactions++;
      throw error;
    } finally {
      this.pendingTransactions.delete(txHash);
    }
  }

  /**
   * Get transaction receipt
   * @async
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object|null>}
   */
  async getTransactionReceipt(txHash) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    if (!ethers.isBytesLike(txHash)) {
      throw new Web3Error('Invalid transaction hash', ERROR_CODES.INVALID_PARAMETER);
    }

    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      throw new Web3Error('Failed to fetch receipt', ERROR_CODES.FETCH_ERROR, error);
    }
  }

  /**
   * Get transaction by hash
   * @async
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object|null>}
   */
  async getTransaction(txHash) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    if (!ethers.isBytesLike(txHash)) {
      throw new Web3Error('Invalid transaction hash', ERROR_CODES.INVALID_PARAMETER);
    }

    try {
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      throw new Web3Error('Failed to fetch transaction', ERROR_CODES.FETCH_ERROR, error);
    }
  }

  /**
   * Replace (speed up) or cancel pending transaction
   * @async
   * @param {string} txHash - Original transaction hash
   * @param {string} action - 'speedup' or 'cancel'
   * @param {number} gasPriceMultiplier - Price multiplier
   * @returns {Promise<Object>}
   */
  async replaceTransaction(txHash, action = 'speedup', gasPriceMultiplier = 1.2) {
    if (!this.signer) {
      throw new Web3Error('Signer not available', ERROR_CODES.SIGNER_ERROR);
    }

    if (gasPriceMultiplier < 1.0) {
      throw new Web3Error('Multiplier must be >= 1.0', ERROR_CODES.INVALID_PARAMETER);
    }

    try {
      const tx = await this.getTransaction(txHash);
      if (!tx) {
        throw new Web3Error('Transaction not found', ERROR_CODES.NOT_FOUND);
      }

      if (tx.blockNumber !== null) {
        throw new Web3Error('Cannot replace confirmed transaction', ERROR_CODES.INVALID_OPERATION);
      }

      const oldGasPrice = tx.gasPrice ?? (await this.provider.getGasPrice());
      const multiplierBigInt = BigInt(Math.round(gasPriceMultiplier * 100));
      const newGasPrice = (oldGasPrice * multiplierBigInt) / BigInt(100);

      let sentTx;

      if (action === 'cancel') {
        sentTx = await this.signer.sendTransaction({
          to: this.userAddress,
          value: 0n,
          nonce: tx.nonce,
          gasLimit: 21_000n,
          gasPrice: newGasPrice,
        });
      } else {
        sentTx = await this.signer.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          nonce: tx.nonce,
          gasLimit: tx.gasLimit,
          gasPrice: newGasPrice,
        });
      }

      return {
        oldHash: txHash,
        newHash: sentTx.hash,
        action,
        gasPriceGwei: ethers.formatUnits(newGasPrice, 'gwei'),
        multiplier: gasPriceMultiplier,
      };
    } catch (error) {
      throw new Web3Error(`Failed to ${action} transaction`, ERROR_CODES.TRANSACTION_ERROR, error);
    }
  }

  // ========== SIGNING / UTILITIES ==========

  /**
   * Sign a message with connected wallet
   * @async
   * @param {string} message - Message to sign
   * @returns {Promise<string>}
   */
  async signMessage(message) {
    if (!this.signer) {
      throw new Web3Error('Signer not available', ERROR_CODES.SIGNER_ERROR);
    }

    if (typeof message !== 'string') {
      throw new Web3Error('Message must be a string', ERROR_CODES.INVALID_PARAMETER);
    }

    try {
      return await this.signer.signMessage(message);
    } catch (error) {
      if (error?.code === 'ACTION_REJECTED') {
        throw new Web3Error('Signature rejected by user', ERROR_CODES.USER_REJECTED);
      }
      throw new Web3Error('Message signing failed', ERROR_CODES.SIGNING_ERROR, error);
    }
  }

  /**
   * Sign EIP-712 typed data
   * @async
   * @param {Object} domain - EIP-712 domain
   * @param {Object} types - EIP-712 types
   * @param {Object} value - Data to sign
   * @returns {Promise<string>}
   */
  async signTypedData(domain, types, value) {
    if (!this.signer) {
      throw new Web3Error('Signer not available', ERROR_CODES.SIGNER_ERROR);
    }

    try {
      return await this.signer.signTypedData(domain, types, value);
    } catch (error) {
      if (error?.code === 'ACTION_REJECTED') {
        throw new Web3Error('Signature rejected by user', ERROR_CODES.USER_REJECTED);
      }
      throw new Web3Error('Typed data signing failed', ERROR_CODES.SIGNING_ERROR, error);
    }
  }

  /**
   * Verify message signature (static)
   * @static
   * @param {string} message - Original message
   * @param {string} signature - Signature to verify
   * @returns {string}
   */
  static verifyMessage(message, signature) {
    try {
      return ethers.verifyMessage(message, signature);
    } catch (error) {
      throw new Web3Error('Message verification failed', ERROR_CODES.SIGNING_ERROR, error);
    }
  }

  /**
   * Get current block number
   * @async
   * @returns {Promise<number>}
   */
  async getBlockNumber() {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    return await this.provider.getBlockNumber();
  }

  /**
   * Get block by hash or number
   * @async
   * @param {string|number} blockHashOrNumber - Block hash or number
   * @returns {Promise<Object>}
   */
  async getBlock(blockHashOrNumber) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    return await this.provider.getBlock(blockHashOrNumber);
  }

  /**
   * Lookup ENS name for address
   * @async
   * @param {string} address - Ethereum address
   * @returns {Promise<string|null>}
   */
  async lookupAddress(address) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    if (!Web3Manager.isValidAddress(address)) {
      throw new Web3Error('Invalid address', ERROR_CODES.INVALID_ADDRESS);
    }

    try {
      return await this.provider.lookupAddress(address);
    } catch (error) {
      this.config.logger.debug('[Web3Manager] ENS lookup failed');
      return null;
    }
  }

  /**
   * Resolve ENS name to address
   * @async
   * @param {string} ensName - ENS name
   * @returns {Promise<string|null>}
   */
  async resolveName(ensName) {
    if (!this.provider) {
      throw new Web3Error('Provider not available', ERROR_CODES.PROVIDER_ERROR);
    }

    try {
      return await this.provider.resolveName(ensName);
    } catch (error) {
      this.config.logger.debug('[Web3Manager] ENS resolution failed');
      return null;
    }
  }

  // ========== HISTORY / METRICS ==========

  /**
   * Add transaction to history
   * @private
   * @param {Object} transaction - Transaction data
   */
  addToHistory(transaction) {
    this.transactionHistory.unshift(transaction);

    if (this.transactionHistory.length > this.maxHistorySize) {
      this.transactionHistory = this.transactionHistory.slice(0, this.maxHistorySize);
    }

    this.dispatchEvent(new CustomEvent('transaction:added', { detail: transaction }));
  }

  /**
   * Get transaction history
   * @param {number} limit - Number of transactions to return
   * @returns {Array}
   */
  getTransactionHistory(limit = 50) {
    return this.transactionHistory.slice(0, Math.min(limit, this.maxHistorySize));
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
   * @private
   * @param {string|bigint} gasUsed - Gas used
   */
  updateAverageGasUsed(gasUsed) {
    const num = parseInt(gasUsed?.toString?.() ?? '0', 10) || 0;
    const count = Math.max(1, this.metrics.transactionCount);
    this.metrics.averageGasUsed = Math.round((this.metrics.averageGasUsed * (count - 1) + num) / count);
  }

  /**
   * Get current metrics
   * @returns {Object}
   */
  getMetrics() {
    const successRate =
      this.metrics.transactionCount > 0
        ? (((this.metrics.transactionCount - this.metrics.failedTransactions) / this.metrics.transactionCount) * 100).toFixed(2)
        : '0';

    return {
      ...this.metrics,
      pendingTransactions: this.pendingTransactions.size,
      historySize: this.transactionHistory.length,
      balanceCacheSize: this.balanceCache.size,
      tokenCacheSize: this.tokenBalanceCache.size,
      successRate: `${successRate}%`,
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.balanceCache.clear();
    this.tokenBalanceCache.clear();
    this.dispatchEvent(new CustomEvent('cache:cleared'));
    this.config.logger.info('[Web3Manager] Caches cleared');
  }

  // ========== EVENT HANDLERS ==========

  handleAccountsChanged(accounts) {
    try {
      if (!accounts || accounts.length === 0) {
        this.config.logger.info('[Web3Manager] Accounts cleared');
        this.disconnect();
        return;
      }

      const newAddr = ethers.getAddress(accounts[0]);
      if (newAddr !== this.userAddress) {
        this.config.logger.info('[Web3Manager] Account changed:', newAddr);
        this.userAddress = newAddr;
        this.balanceCache.clear();

        this.dispatchEvent(new CustomEvent('wallet:accountChanged', { detail: { address: this.userAddress, timestamp: Date.now() } }));

        this.getBalance(true).catch(() => {});
      }
    } catch (error) {
      this.config.logger.error('[Web3Manager] handleAccountsChanged error:', error);
    }
  }

  handleChainChanged(chainIdHex) {
    try {
      const newChainId = parseInt(chainIdHex, 16);
      if (Number.isNaN(newChainId)) {
        this.config.logger.error('[Web3Manager] Invalid chainId:', chainIdHex);
        return;
      }

      if (newChainId === this.chainId) {
        return;
      }

      this.config.logger.info('[Web3Manager] Network changed to:', newChainId);
      this.chainId = newChainId;
      this.balanceCache.clear();
      this.tokenBalanceCache.clear();

      const isCorrectNetwork = this.chainId === CONTRACT_CONFIG.network.chainId;

      this.dispatchEvent(
        new CustomEvent('network:changed', {
          detail: { chainId: this.chainId, isCorrectNetwork, timestamp: Date.now() },
        })
      );

      if (!isCorrectNetwork && typeof window !== 'undefined') {
        this.config.logger.warn('[Web3Manager] Wrong network detected');
      }
    } catch (error) {
      this.config.logger.error('[Web3Manager] handleChainChanged error:', error);
    }
  }

  handleDisconnect(error) {
    this.config.logger.warn('[Web3Manager] Provider disconnected:', error?.message);
    this.disconnect();
  }

  handleConnect(connectInfo) {
    this.config.logger.info('[Web3Manager] Provider connected:', connectInfo?.chainId);
  }

  handleMessage(message) {
    this.config.logger.debug('[Web3Manager] Provider message:', message);
    this.dispatchEvent(new CustomEvent('wallet:message', { detail: { message, timestamp: Date.now() } }));
  }

  // ========== ERROR HANDLING ==========

  /**
   * Handle connection errors with standardized messages
   * @private
   * @param {Error} error - Error to handle
   */
  handleConnectionError(error) {
    let errorCode = error?.code ?? ERROR_CODES.NETWORK_ERROR ?? 'NETWORK_ERROR';
    let message = error?.message ?? String(error);

    this.lastErrorTime = Date.now();
    this.metrics.failedConnectionAttempts++;

    switch (error?.code) {
      case 4001:
      case 'ACTION_REJECTED':
        errorCode = ERROR_CODES.USER_REJECTED ?? 'USER_REJECTED';
        message = 'Connection rejected by user';
        break;

      case -32002:
        errorCode = ERROR_CODES.WALLET_LOCKED ?? 'WALLET_LOCKED';
        message = 'Wallet is locked. Please unlock and try again.';
        break;

      case -32603:
        errorCode = ERROR_CODES.NETWORK_ERROR ?? 'NETWORK_ERROR';
        message = 'Internal wallet error. Please try again.';
        break;

      case -32601:
        errorCode = ERROR_CODES.METHOD_NOT_FOUND;
        message = 'Wallet does not support this method';
        break;

      default:
        if ((message || '').toLowerCase().includes('timeout')) {
          errorCode = ERROR_CODES.CONNECTION_TIMEOUT ?? 'CONNECTION_TIMEOUT';
        }
    }

    this.dispatchEvent(
      new CustomEvent('wallet:error', {
        detail: { error: message, errorCode, timestamp: Date.now(), originalError: error?.originalError },
      })
    );

    this.config.logger.error(`[Web3Manager] Wallet error [${errorCode}]:`, message);
  }

  /**
   * Get current network information
   * @returns {Object}
   */
  getNetworkInfo() {
    return {
      chainId: this.chainId,
      name: CONTRACT_CONFIG.network.name,
      rpcUrl: CONTRACT_CONFIG.network.rpcUrl,
      explorer: CONTRACT_CONFIG.network.explorer,
      isCorrectNetwork: this.chainId === CONTRACT_CONFIG.network.chainId,
      hexChainId: this.chainId ? `0x${this.chainId.toString(16)}` : null,
    };
  }

  /**
   * Get current connection status
   * @returns {Object}
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      address: this.userAddress,
      chainId: this.chainId,
      networkInfo: this.getNetworkInfo(),
      walletAvailable: this.isWalletAvailable(),
      wallets: this.getAvailableWallets(),
      pendingTransactions: this.pendingTransactions.size,
      connectionAttempts: this.connectionAttempts,
      lastConnectionTime: this.lastConnectionTime,
      lastErrorTime: this.lastErrorTime,
    };
  }

  /**
   * Get wallet capabilities
   * @async
   * @returns {Promise<Object>}
   */
  async getWalletCapabilities() {
    if (!this.isWalletAvailable()) {
      return { supported: false };
    }

    const methodsToCheck = [
      'eth_accounts',
      'eth_requestAccounts',
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
      'eth_sign',
      'personal_sign',
      'eth_signTypedData_v4',
    ];

    return {
      supported: true,
      ...this.getAvailableWallets(),
      version: window.ethereum.version ?? 'unknown',
      methods: methodsToCheck,
    };
  }

  // ========== STATIC UTILITIES ==========

  /**
   * Validate if string is a valid Ethereum address
   * @static
   * @param {string} address - Address to validate
   * @returns {boolean}
   */
  static isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return ethers.isAddress(address);
  }

  /**
   * Get checksum address
   * @static
   * @param {string} address - Address to checksum
   * @returns {string|null}
   */
  static getChecksumAddress(address) {
    try {
      return ethers.getAddress(address);
    } catch {
      return null;
    }
  }

  /**
   * Compare two addresses (case-insensitive)
   * @static
   * @param {string} a - First address
   * @param {string} b - Second address
   * @returns {boolean}
   */
  static compareAddresses(a, b) {
    try {
      return ethers.getAddress(a) === ethers.getAddress(b);
    } catch {
      return false;
    }
  }

  /**
   * Format address for display
   * @static
   * @param {string} address - Address to format
   * @param {number} prefixLength - Characters from start
   * @param {number} suffixLength - Characters from end
   * @returns {string}
   */
  static formatAddress(address, prefixLength = 6, suffixLength = 4) {
    if (!address || typeof address !== 'string') return '';
    if (!ethers.isAddress(address)) return address;
    return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
  }

  /**
   * Format token amount with decimals
   * @static
   * @param {bigint|string} amount - Token amount
   * @param {number} decimals - Token decimals
   * @param {number} displayDecimals - Display decimals
   * @returns {string}
   */
  static formatTokenAmount(amount, decimals = 18, displayDecimals = 4) {
    try {
      const formatted = ethers.formatUnits(amount, decimals);
      const num = parseFloat(formatted);
      if (num === 0) return '0';
      if (num < 0.0001) return '<0.0001';
      return num.toFixed(displayDecimals).replace(/\.?0+$/, '');
    } catch {
      return '0';
    }
  }

  /**
   * Parse token amount to wei
   * @static
   * @param {string|number} amount - Amount to parse
   * @param {number} decimals - Token decimals
   * @returns {string}
   */
  static parseTokenAmount(amount, decimals = 18) {
    try {
      return ethers.parseUnits(String(amount), decimals).toString();
    } catch {
      throw new Web3Error('Invalid token amount', ERROR_CODES.INVALID_PARAMETER);
    }
  }

  /**
   * Convert wei to ether
   * @static
   * @param {bigint|string} wei - Wei amount
   * @param {number} decimals - Display decimals
   * @returns {string}
   */
  static weiToEther(wei, decimals = 4) {
    try {
      const ether = ethers.formatEther(wei);
      const num = parseFloat(ether);
      return num.toFixed(decimals).replace(/\.?0+$/, '');
    } catch {
      return '0';
    }
  }

  /**
   * Convert ether to wei
   * @static
   * @param {string|number} ether - Ether amount
   * @returns {string}
   */
  static etherToWei(ether) {
    try {
      return ethers.parseEther(String(ether)).toString();
    } catch {
      throw new Web3Error('Invalid ether amount', ERROR_CODES.INVALID_PARAMETER);
    }
  }

  /**
   * Generate random wallet
   * @static
   * @returns {Object}
   */
  static generateRandomWallet() {
    const wallet = ethers.Wallet.createRandom();
    return { address: wallet.address, privateKey: wallet.privateKey, mnemonic: wallet.mnemonic.phrase };
  }

  /**
   * Create wallet from private key
   * @static
   * @param {string} privateKey - Private key
   * @returns {ethers.Wallet}
   */
  static createWalletFromPrivateKey(privateKey) {
    try {
      return new ethers.Wallet(privateKey);
    } catch {
      throw new Web3Error('Invalid private key', ERROR_CODES.INVALID_KEY);
    }
  }

  /**
   * Create wallet from mnemonic
   * @static
   * @param {string} mnemonic - BIP39 mnemonic
   * @param {string} path - Derivation path
   * @returns {ethers.Wallet}
   */
  static createWalletFromMnemonic(mnemonic, path = "m/44'/60'/0'/0/0") {
    try {
      return ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
    } catch {
      throw new Web3Error('Invalid mnemonic', ERROR_CODES.INVALID_KEY);
    }
  }

  /**
   * Get block explorer URL for address
   * @param {string} address - Address
   * @returns {string}
   */
  getExplorerUrl(address) {
    const explorer = CONTRACT_CONFIG.network.explorer;
    if (!explorer || !Web3Manager.isValidAddress(address)) return '';
    return `${explorer}/address/${address}`;
  }

  /**
   * Get block explorer URL for transaction
   * @param {string} txHash - Transaction hash
   * @returns {string}
   */
  getTransactionExplorerUrl(txHash) {
    const explorer = CONTRACT_CONFIG.network.explorer;
    if (!explorer || !ethers.isBytesLike(txHash)) return '';
    return `${explorer}/tx/${txHash}`;
  }

  /**
   * Get block explorer URL for token
   * @param {string} tokenAddress - Token address
   * @returns {string}
   */
  getTokenExplorerUrl(tokenAddress) {
    const explorer = CONTRACT_CONFIG.network.explorer;
    if (!explorer || !Web3Manager.isValidAddress(tokenAddress)) return '';
    return `${explorer}/token/${tokenAddress}`;
  }

  /**
   * Export state for persistence
   * @returns {Object}
   */
  exportState() {
    return {
      address: this.userAddress,
      chainId: this.chainId,
      isConnected: this.isConnected,
      lastConnectionTime: this.lastConnectionTime,
      metrics: this.metrics,
      connectionAttempts: this.connectionAttempts,
    };
  }

  /**
   * Import previously saved state
   * @param {Object} state - State to import
   */
  importState(state = {}) {
    if (state.address) this.userAddress = state.address;
    if (state.chainId) this.chainId = state.chainId;
    if (state.lastConnectionTime) this.lastConnectionTime = state.lastConnectionTime;
    if (state.metrics) this.metrics = { ...this.metrics, ...state.metrics };
    if (typeof state.connectionAttempts === 'number') this.connectionAttempts = state.connectionAttempts;
  }

  // ========== PRIVATE HELPERS ==========

  /**
   * Check if cache entry is still valid
   * @private
   * @param {number} timestamp - Cache timestamp
   * @returns {boolean}
   */
  isCacheValid(timestamp) {
    return Date.now() - timestamp < this.config.cacheExpiry;
  }

  /**
   * Rate limiting check
   * @private
   * @param {string} operation - Operation name
   * @returns {boolean}
   */
  checkRateLimit(operation) {
    const now = Date.now();
    const key = `${operation}:${Math.floor(now / this.rateLimitConfig.requestWindow)}`;

    const current = (this.rateLimiter.get(key) ?? 0) + 1;
    this.rateLimiter.set(key, current);

    for (const [k] of this.rateLimiter) {
      const [, window] = k.split(':');
      if (Math.floor(now / this.rateLimitConfig.requestWindow) - parseInt(window) > 1) {
        this.rateLimiter.delete(k);
      }
    }

    const limit = (this.rateLimitConfig.requestsPerSecond * this.rateLimitConfig.requestWindow) / 1000;
    return current <= limit;
  }

  /**
   * Cleanup and destroy manager
   */
  cleanup() {
    this.removeEventListeners();
    this.disconnect();
    this.clearCaches();
    this.clearTransactionHistory();
    this.pendingTransactions.clear();
    this.rateLimiter.clear();
    this.config.logger.info('[Web3Manager] Cleanup complete');
  }

  /**
   * Destroy manager (alias for cleanup)
   */
  destroy() {
    this.cleanup();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Web3Manager;
export { Web3Error, CONTRACT_CONFIG, ERROR_CODES, TRANSACTION_TIMEOUTS };
