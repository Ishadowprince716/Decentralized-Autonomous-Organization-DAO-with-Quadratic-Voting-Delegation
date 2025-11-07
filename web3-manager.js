// js/services/web3-manager.js
import { ethers } from 'ethers';
import { CONTRACT_CONFIG, ERROR_CODES, TRANSACTION_TIMEOUTS } from '../utils/constants.js';

/**
 * Manages Web3 connection, wallet integration, and network handling
 * @extends EventTarget
 */
export class Web3Manager extends EventTarget {
  constructor(options = {}) {
    super();

    // Public state
    this.provider = null;
    this.signer = null;
    this.userAddress = null;
    this.chainId = null;
    this.isConnected = false;
    this.isConnecting = false;

    // Enhanced state tracking
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = options.maxConnectionAttempts ?? 3;
    this.lastConnectionTime = null;
    this.balanceCache = new Map();
    this.transactionHistory = [];
    this.pendingTransactions = new Set();

    // Performance monitoring
    this.metrics = {
      connectionTime: 0,
      transactionCount: 0,
      failedTransactions: 0,
      averageGasUsed: 0,
    };

    // Bound handlers
    this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
    this.handleChainChanged = this.handleChainChanged.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);

    // init
    this.setupEventListeners();
    this.initializeAutoReconnect();
  }

  /* ---------- Setup / Cleanup ---------- */

  setupEventListeners() {
    if (typeof window === 'undefined' || !window.ethereum) return;
    // remove then add to avoid duplicates
    this.removeEventListeners();

    window.ethereum.on?.('accountsChanged', this.handleAccountsChanged);
    window.ethereum.on?.('chainChanged', this.handleChainChanged);
    window.ethereum.on?.('disconnect', this.handleDisconnect);
    window.ethereum.on?.('message', this.handleMessage);
  }

  removeEventListeners() {
    if (typeof window === 'undefined' || !window.ethereum) return;

    try {
      window.ethereum.removeListener?.('accountsChanged', this.handleAccountsChanged);
      window.ethereum.removeListener?.('chainChanged', this.handleChainChanged);
      window.ethereum.removeListener?.('disconnect', this.handleDisconnect);
      window.ethereum.removeListener?.('message', this.handleMessage);
    } catch (e) {
      // Some providers may throw on removeListener; ignore safely
      console.warn('removeEventListeners warning:', e?.message || e);
    }
  }

  initializeAutoReconnect() {
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => void this.checkConnection());
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && this.isConnected) {
          await this.verifyConnection().catch(() => {});
        }
      });
    }
  }

  /* ---------- Wallet / Connection ---------- */

  isWalletAvailable() {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  getAvailableWallets() {
    const wallets = { metamask: false, coinbase: false, trustwallet: false, other: false };
    if (typeof window === 'undefined' || !window.ethereum) return wallets;

    wallets.metamask = !!window.ethereum.isMetaMask;
    wallets.coinbase = !!window.ethereum.isCoinbaseWallet;
    wallets.trustwallet = !!window.ethereum.isTrust;
    wallets.other = !wallets.metamask && !wallets.coinbase && !wallets.trustwallet;
    return wallets;
  }

  async connectWallet() {
    const start = Date.now();

    if (this.isConnecting) {
      console.warn('Connection attempt already in progress');
      return false;
    }

    if (this.isConnected) {
      console.info('Already connected');
      return true;
    }

    if (!this.isWalletAvailable()) {
      throw new Error('Wallet provider (window.ethereum) not found. Please install MetaMask or another provider.');
    }

    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      const since = Date.now() - (this.lastConnectionTime ?? 0);
      if (since < 60_000) {
        throw new Error('Too many connection attempts. Please wait a moment.');
      }
      this.connectionAttempts = 0;
    }

    this.isConnecting = true;
    this.connectionAttempts++;
    this.lastConnectionTime = Date.now();

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) throw new Error('No accounts returned from provider.');

      // provider: use 'any' network to allow chain switch
      this.provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
      this.signer = this.provider.getSigner();
      this.userAddress = ethers.utils.getAddress(accounts[0]);
      const network = await this.provider.getNetwork();
      this.chainId = network.chainId;

      // if network mismatch, try switching
      if (this.chainId !== CONTRACT_CONFIG.network.chainId) {
        try {
          await this.switchNetwork();
        } catch (err) {
          // If user rejects or switch fails, still mark disconnected
          this.handleConnectionError(err);
          return false;
        }
      }

      this.isConnected = true;
      this.connectionAttempts = 0;
      this.metrics.connectionTime = Date.now() - start;

      this.dispatchEvent(
        new CustomEvent('wallet:connected', {
          detail: {
            address: this.userAddress,
            chainId: this.chainId,
            timestamp: Date.now(),
            connectionTime: this.metrics.connectionTime,
          },
        })
      );

      // Pre-fetch balance (non-blocking)
      void this.getBalance(true).catch(() => {});

      return true;
    } catch (error) {
      this.handleConnectionError(error);
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  async checkConnection() {
    try {
      if (!this.isWalletAvailable()) return false;
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) return await this.connectWallet();
      return false;
    } catch (e) {
      console.error('checkConnection error', e);
      return false;
    }
  }

  async verifyConnection() {
    if (!this.isConnected || !this.provider) return false;
    try {
      const network = await this.provider.getNetwork();
      const accounts = await this.provider.listAccounts();
      if (accounts.length === 0 || network.chainId !== this.chainId) {
        this.disconnect();
        return false;
      }
      return true;
    } catch (e) {
      console.error('verifyConnection failed', e);
      this.disconnect();
      return false;
    }
  }

  disconnect() {
    this.provider = null;
    this.signer = null;
    this.userAddress = null;
    this.chainId = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.balanceCache.clear();

    this.dispatchEvent(new CustomEvent('wallet:disconnected', { detail: { timestamp: Date.now() } }));
  }

  /* ---------- Network helpers ---------- */

  async switchNetwork() {
    const target = CONTRACT_CONFIG.network;
    if (!target || !target.chainId) throw new Error('Target network not configured.');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${target.chainId.toString(16)}` }],
      });

      // wait for provider to report new network
      await this.waitForNetworkSwitch(target.chainId, 12, 500);
    } catch (err) {
      // 4902 = unknown chain, -32603 sometimes for EIP-1193 implementations
      const code = err?.code;
      if (code === 4902 || code === -32603) {
        await this.addNetwork();
      } else if (code === 4001) {
        throw new Error('Network switch rejected by user');
      } else {
        throw err;
      }
    }
  }

  async waitForNetworkSwitch(targetChainId, maxAttempts = 10, delayMs = 500) {
    if (!this.provider) throw new Error('Provider not available');
    for (let i = 0; i < maxAttempts; i++) {
      const net = await this.provider.getNetwork();
      if (net.chainId === targetChainId) return;
      // small delay
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error('Network switch timeout');
  }

  async addNetwork() {
    const cfg = CONTRACT_CONFIG.network;
    if (!cfg || !cfg.chainId || !cfg.rpcUrl || !cfg.name) {
      throw new Error('Invalid network config for adding chain');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${cfg.chainId.toString(16)}`,
            chainName: cfg.name,
            rpcUrls: [cfg.rpcUrl],
            blockExplorerUrls: cfg.explorer ? [cfg.explorer] : [],
            nativeCurrency: cfg.nativeCurrency ?? { name: 'CORE', symbol: 'CORE', decimals: 18 },
          },
        ],
      });
    } catch (err) {
      if (err?.code === 4001) throw new Error('Network addition rejected by user');
      throw new Error(`Failed to add network ${cfg.name}: ${err?.message ?? String(err)}`);
    }
  }

  /* ---------- Balance / tokens ---------- */

  async getBalance(fresh = false) {
    if (!this.provider || !this.userAddress) throw new Error('Wallet not connected');
    const cacheKey = `balance_${this.userAddress}_${this.chainId}`;
    const cached = this.balanceCache.get(cacheKey);
    if (!fresh && cached && Date.now() - cached.timestamp < 30_000) return cached.balance;

    const blockTag = fresh ? 'latest' : 'pending';
    const raw = await this.provider.getBalance(this.userAddress, blockTag);
    const formatted = ethers.utils.formatEther(raw);

    this.balanceCache.set(cacheKey, { balance: formatted, timestamp: Date.now() });
    return formatted;
  }

  async getTokenBalance(tokenAddress, userAddress = null) {
    if (!this.provider) throw new Error('Provider not available');
    const addr = userAddress ?? this.userAddress;
    if (!Web3Manager.isValidAddress(addr)) throw new Error('Invalid user address');
    if (!Web3Manager.isValidAddress(tokenAddress)) throw new Error('Invalid token address');

    const token = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function name() view returns (string)'],
      this.provider
    );

    const [balance, decimals, symbol, name] = await Promise.all([token.balanceOf(addr), token.decimals(), token.symbol(), token.name()]);
    return {
      balance: ethers.utils.formatUnits(balance, decimals),
      decimals,
      symbol,
      name,
      raw: balance.toString(),
    };
  }

  async getMultipleTokenBalances(tokenAddresses = []) {
    const res = await Promise.allSettled(tokenAddresses.map((t) => this.getTokenBalance(t)));
    return res.map((r, i) => (r.status === 'fulfilled' ? { address: tokenAddresses[i], success: true, ...r.value } : { address: tokenAddresses[i], success: false, error: r.reason?.message ?? String(r.reason) }));
  }

  /* ---------- Gas / estimates ---------- */

  /**
   * Returns BigNumber gas estimate and BigNumber gasWithBuffer
   * @param {Object} transaction - tx object
   * @param {number} bufferPercent - percent to add (default 20)
   * @returns {Promise<{estimate: BigNumber, withBuffer: BigNumber, buffer: BigNumber, bufferPercent: number}>}
   */
  async estimateGas(transaction, bufferPercent = 20) {
    if (!this.provider) throw new Error('Provider not available');

    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      const buffer = gasEstimate.mul(bufferPercent).div(100);
      const gasWithBuffer = gasEstimate.add(buffer);
      return { estimate: gasEstimate, withBuffer: gasWithBuffer, buffer, bufferPercent };
    } catch (error) {
      // more helpful error for unpredictable gas
      if (error?.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error('Transaction may fail — unpredictable gas limit. Check contract state and parameters.');
      }
      throw error;
    }
  }

  async getGasPrice() {
    if (!this.provider) throw new Error('Provider not available');

    const gasPriceBN = await this.provider.getGasPrice();
    const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPriceBN, 'gwei'));

    return {
      slow: (gasPriceGwei * 0.9).toFixed(2),
      standard: gasPriceGwei.toFixed(2),
      fast: (gasPriceGwei * 1.2).toFixed(2),
      instant: (gasPriceGwei * 1.5).toFixed(2),
      wei: gasPriceBN.toString(),
    };
  }

  /**
   * Returns cost estimate. gasEstimate.withBuffer is BigNumber
   */
  async estimateTransactionCost(transaction, speed = 'standard') {
    const gasEstimateObj = await this.estimateGas(transaction);
    const gasPrices = await this.getGasPrice();

    const gasPriceStr = gasPrices[speed] ?? gasPrices.standard;
    const gasPriceWei = ethers.utils.parseUnits(gasPriceStr.toString(), 'gwei'); // BigNumber

    const totalCostWei = gasPriceWei.mul(gasEstimateObj.withBuffer);
    return {
      gasLimit: gasEstimateObj.withBuffer.toString(),
      gasPrice: gasPriceStr,
      gasPriceWei: gasPriceWei.toString(),
      totalCost: ethers.utils.formatEther(totalCostWei),
      totalCostWei: totalCostWei.toString(),
      speed,
    };
  }

  /* ---------- Transactions ---------- */

  /**
   * Wait for transaction with confirmations and periodic onUpdate callbacks.
   * Uses polling on each new block for progress so it works with most providers.
   *
   * @param {string} txHash
   * @param {number} confirmations
   * @param {number} timeout ms
   * @param {(progress: {confirmations:number, required:number, progress:number})=>void} onUpdate
   */
  async waitForTransaction(txHash, confirmations = 1, timeout = TRANSACTION_TIMEOUTS.DEFAULT, onUpdate = null) {
    if (!this.provider) throw new Error('Provider not available');
    if (!ethers.utils.isHexString(txHash)) throw new Error('Invalid transaction hash');

    this.pendingTransactions.add(txHash);
    const start = Date.now();

    try {
      // Polling approach to provide progress updates:
      const pollInterval = 1_500; // ms for fallback if 'block' event isn't supported
      let lastReceipt = null;

      const checkReceipt = async () => {
        const receipt = await this.provider.getTransactionReceipt(txHash);
        if (!receipt) return null;
        // calculate confirmations using current block number
        const currentBlock = await this.provider.getBlockNumber();
        const confs = receipt.confirmations ?? Math.max(0, currentBlock - receipt.blockNumber + 1);
        return { receipt, confirmations: confs };
      };

      // Promise that resolves when confirmations achieved
      const confirmationPromise = (async () => {
        // fast path: provider.waitForTransaction is available; we'll still poll for onUpdate
        const waitPromise = this.provider.waitForTransaction(txHash, confirmations).then((r) => ({ receipt: r, confirmations: confirmations }));
        // but we want to support onUpdate => poll blocks in parallel
        let poll;
        if (onUpdate) {
          poll = setInterval(async () => {
            try {
              const res = await checkReceipt();
              if (res) {
                onUpdate({ confirmations: res.confirmations, required: confirmations, progress: Math.min(100, (res.confirmations / confirmations) * 100) });
              }
            } catch (e) {
              // ignore poll errors
            }
          }, pollInterval);
        }

        const result = await waitPromise;
        if (poll) clearInterval(poll);
        return result;
      })();

      const timed = await Promise.race([
        confirmationPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeout)),
      ]);

      const receipt = timed.receipt;
      if (!receipt || receipt.status === 0) {
        this.metrics.failedTransactions++;
        throw new Error('Transaction failed or was reverted');
      }

      // update metrics and history
      this.metrics.transactionCount++;
      this.updateAverageGasUsed(receipt.gasUsed?.toString?.() ?? '0');

      this.addToHistory({ hash: txHash, receipt, timestamp: Date.now(), confirmations });

      return receipt;
    } catch (err) {
      this.metrics.failedTransactions++;
      throw err;
    } finally {
      this.pendingTransactions.delete(txHash);
    }
  }

  async getTransactionReceipt(txHash) {
    if (!this.provider) throw new Error('Provider not available');
    if (!ethers.utils.isHexString(txHash)) throw new Error('Invalid transaction hash');
    return await this.provider.getTransactionReceipt(txHash);
  }

  async getTransaction(txHash) {
    if (!this.provider) throw new Error('Provider not available');
    if (!ethers.utils.isHexString(txHash)) throw new Error('Invalid transaction hash');
    return await this.provider.getTransaction(txHash);
  }

  /**
   * Replace (speed up) or cancel a pending transaction.
   * NOTE: gasPrice and tx object are BigNumbers; use BigNumber arithmetic.
   */
  async replaceTransaction(txHash, action = 'speedup', gasPriceMultiplier = 1.2) {
    if (!this.signer) throw new Error('Signer not available');

    const tx = await this.getTransaction(txHash);
    if (!tx) throw new Error('Transaction not found');

    if (tx.confirmations && tx.confirmations > 0) throw new Error('Transaction already confirmed');

    const oldGasPrice = tx.gasPrice ?? (await this.provider.getGasPrice());
    // gasPriceMultiplier applied using BigNumber math:
    const multiplierBN = ethers.BigNumber.from(Math.round(gasPriceMultiplier * 100));
    const newGasPrice = oldGasPrice.mul(multiplierBN).div(100);

    let sentTx;
    if (action === 'cancel') {
      // send 0 ETH to self with same nonce to replace
      sentTx = await this.signer.sendTransaction({
        to: this.userAddress,
        value: 0,
        nonce: tx.nonce,
        gasLimit: ethers.BigNumber.from(21_000),
        gasPrice: newGasPrice,
      });
    } else {
      // speed up: resend original tx fields but with higher gas price
      const txRequest = {
        to: tx.to,
        data: tx.data,
        value: tx.value,
        nonce: tx.nonce,
        gasLimit: tx.gasLimit ?? undefined,
        gasPrice: newGasPrice,
      };
      sentTx = await this.signer.sendTransaction(txRequest);
    }

    return {
      oldHash: txHash,
      newHash: sentTx.hash,
      action,
      gasPriceGwei: ethers.utils.formatUnits(newGasPrice, 'gwei'),
    };
  }

  /* ---------- Signing / utilities ---------- */

  async signMessage(message) {
    if (!this.signer) throw new Error('Signer not available');
    if (typeof message !== 'string') throw new Error('Message must be a string');

    try {
      return await this.signer.signMessage(message);
    } catch (err) {
      if (err?.code === 4001) throw new Error('Signature rejected by user');
      throw err;
    }
  }

  async signTypedData(domain, types, value) {
    if (!this.signer) throw new Error('Signer not available');
    try {
      // _signTypedData is ethers v5 signer helper
      return await this.signer._signTypedData(domain, types, value);
    } catch (err) {
      if (err?.code === 4001) throw new Error('Signature rejected by user');
      throw err;
    }
  }

  static verifyMessage(message, signature) {
    return ethers.utils.verifyMessage(message, signature);
  }

  async getBlockNumber() {
    if (!this.provider) throw new Error('Provider not available');
    return await this.provider.getBlockNumber();
  }

  async getBlock(blockHashOrNumber) {
    if (!this.provider) throw new Error('Provider not available');
    return await this.provider.getBlock(blockHashOrNumber);
  }

  async lookupAddress(address) {
    if (!this.provider) throw new Error('Provider not available');
    if (!Web3Manager.isValidAddress(address)) throw new Error('Invalid address');
    return await this.provider.lookupAddress(address);
  }

  async resolveName(ensName) {
    if (!this.provider) throw new Error('Provider not available');
    return await this.provider.resolveName(ensName);
  }

  /* ---------- History / metrics ---------- */

  addToHistory(transaction) {
    this.transactionHistory.unshift(transaction);
    if (this.transactionHistory.length > 100) this.transactionHistory.length = 100;
    this.dispatchEvent(new CustomEvent('transaction:added', { detail: transaction }));
  }

  getTransactionHistory(limit = 50) {
    return this.transactionHistory.slice(0, limit);
  }

  clearTransactionHistory() {
    this.transactionHistory = [];
    this.dispatchEvent(new CustomEvent('transaction:historyCleared'));
  }

  updateAverageGasUsed(gasUsed) {
    // gasUsed expected as string or BigNumber-like
    const num = parseInt(gasUsed?.toString?.() ?? '0', 10) || 0;
    const count = Math.max(1, this.metrics.transactionCount);
    this.metrics.averageGasUsed = (this.metrics.averageGasUsed * (count - 1) + num) / count;
  }

  getMetrics() {
    return {
      ...this.metrics,
      pendingTransactions: this.pendingTransactions.size,
      historySize: this.transactionHistory.length,
      cacheSize: this.balanceCache.size,
      successRate:
        this.metrics.transactionCount > 0
          ? `${(((this.metrics.transactionCount - this.metrics.failedTransactions) / this.metrics.transactionCount) * 100).toFixed(2)}%`
          : '0%',
    };
  }

  clearCaches() {
    this.balanceCache.clear();
    this.dispatchEvent(new CustomEvent('cache:cleared'));
  }

  /* ---------- Event handlers ---------- */

  handleAccountsChanged(accounts) {
    try {
      if (!accounts || accounts.length === 0) {
        this.disconnect();
        return;
      }
      const newAddr = ethers.utils.getAddress(accounts[0]);
      if (newAddr !== this.userAddress) {
        this.userAddress = newAddr;
        this.balanceCache.clear();
        this.dispatchEvent(new CustomEvent('wallet:accountChanged', { detail: { address: this.userAddress, timestamp: Date.now() } }));
        void this.getBalance(true).catch(() => {});
      }
    } catch (e) {
      console.error('handleAccountsChanged error', e);
    }
  }

  handleChainChanged(chainIdHex) {
    try {
      const newChainId = parseInt(chainIdHex, 16);
      if (Number.isNaN(newChainId)) {
        console.error('Invalid chainId from provider:', chainIdHex);
        return;
      }
      this.chainId = newChainId;
      this.balanceCache.clear();
      this.dispatchEvent(
        new CustomEvent('network:changed', {
          detail: { chainId: this.chainId, isCorrectNetwork: this.chainId === CONTRACT_CONFIG.network.chainId, timestamp: Date.now() },
        })
      );
      // Reload app for consistency (optional - keep if your app requires it)
      if (typeof window !== 'undefined') window.location.reload();
    } catch (e) {
      console.error('handleChainChanged error', e);
    }
  }

  handleDisconnect(error) {
    console.warn('Provider disconnected', error);
    this.disconnect();
  }

  handleMessage(message) {
    this.dispatchEvent(new CustomEvent('wallet:message', { detail: { message, timestamp: Date.now() } }));
  }

  /* ---------- Errors / misc ---------- */

  handleConnectionError(error) {
    let errorCode = ERROR_CODES.NETWORK_ERROR ?? 'NETWORK_ERROR';
    let message = error?.message ?? String(error);

    switch (error?.code) {
      case 4001:
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
      default:
        if ((message || '').toLowerCase().includes('metamask')) {
          errorCode = ERROR_CODES.WALLET_NOT_FOUND ?? 'WALLET_NOT_FOUND';
        }
    }

    this.dispatchEvent(new CustomEvent('wallet:error', { detail: { error: message, errorCode, timestamp: Date.now() } }));
    console.error(`Wallet error [${errorCode}]:`, message);
    // throw standardized Error so callers can `catch`
    throw new Error(message);
  }

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

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      address: this.userAddress,
      chainId: this.chainId,
      networkInfo: this.getNetworkInfo(),
      walletAvailable: this.isWalletAvailable(),
      pendingTransactions: this.pendingTransactions.size,
      connectionAttempts: this.connectionAttempts,
    };
  }

  async getWalletCapabilities() {
    if (typeof window === 'undefined' || !window.ethereum) return { supported: false };
    const methodsToCheck = ['eth_accounts', 'eth_requestAccounts', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'eth_sign', 'personal_sign', 'eth_signTypedData_v4'];
    return { supported: true, metamask: !!window.ethereum.isMetaMask, version: window.ethereum.version ?? 'unknown', methods: methodsToCheck };
  }

  watchContractEvent(contract, eventName, callback) {
    try {
      const filter = contract.filters[eventName]?.() ?? null;
      if (!filter) throw new Error('Event filter not available');

      const listener = (...args) => {
        const event = args[args.length - 1];
        callback({ ...event, args: args.slice(0, -1), timestamp: Date.now() });
      };

      contract.on(filter, listener);
      return () => contract.off(filter, listener);
    } catch (err) {
      console.error('watchContractEvent error', err);
      throw err;
    }
  }

  async getContractEvents(contract, eventName, fromBlock = null, toBlock = 'latest') {
    if (!this.provider) throw new Error('Provider not available');

    const currentBlock = await this.getBlockNumber();
    const start = fromBlock ?? Math.max(0, currentBlock - 1000);
    const filter = contract.filters[eventName]?.();
    if (!filter) return [];

    const events = await contract.queryFilter(filter, start, toBlock);
    return events.map((e) => ({ ...e, blockNumber: e.blockNumber, transactionHash: e.transactionHash, args: e.args, timestamp: Date.now() }));
  }

  async batchRead(calls = []) {
    if (!this.provider) throw new Error('Provider not available');
    const promises = calls.map(({ contract, method, args = [] }) => contract[method](...args));
    return await Promise.allSettled(promises);
  }

  static parseTransactionLogs(receipt, contract) {
    try {
      const parsed = [];
      if (!receipt || !receipt.logs) return parsed;
      for (const log of receipt.logs) {
        try {
          const p = contract.interface.parseLog(log);
          parsed.push({ name: p.name, args: p.args, signature: p.signature, topic: p.topic, logIndex: log.logIndex });
        } catch {
          // ignore logs not belonging to this interface
        }
      }
      return parsed;
    } catch (err) {
      console.error('parseTransactionLogs error', err);
      return [];
    }
  }

  static formatTokenAmount(amount, decimals = 18, displayDecimals = 4) {
    try {
      const formatted = ethers.utils.formatUnits(amount, decimals);
      const num = parseFloat(formatted);
      if (num === 0) return '0';
      if (num < 0.0001) return '<0.0001';
      return num.toFixed(displayDecimals).replace(/\.?0+$/, '');
    } catch (e) {
      console.error('formatTokenAmount error', e);
      return '0';
    }
  }

  static parseTokenAmount(amount, decimals = 18) {
    try {
      return ethers.utils.parseUnits(String(amount), decimals).toString();
    } catch (e) {
      console.error('parseTokenAmount error', e);
      throw new Error('Invalid token amount');
    }
  }

  static formatAddress(address, prefixLength = 6, suffixLength = 4) {
    if (!address || typeof address !== 'string') return '';
    if (!ethers.utils.isAddress(address)) return address;
    return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
  }

  static isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return ethers.utils.isAddress(address);
  }

  static getChecksumAddress(address) {
    try {
      return ethers.utils.getAddress(address);
    } catch {
      return null;
    }
  }

  static compareAddresses(a, b) {
    try {
      return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
    } catch {
      return false;
    }
  }

  async isContract(address) {
    if (!this.provider) throw new Error('Provider not available');
    if (!Web3Manager.isValidAddress(address)) return false;
    const code = await this.provider.getCode(address);
    return code !== '0x';
  }

  static weiToEther(wei, decimals = 4) {
    try {
      const ether = ethers.utils.formatEther(wei);
      const num = parseFloat(ether);
      return num.toFixed(decimals).replace(/\.?0+$/, '');
    } catch (e) {
      console.error('weiToEther error', e);
      return '0';
    }
  }

  static etherToWei(ether) {
    try {
      return ethers.utils.parseEther(String(ether)).toString();
    } catch (e) {
      console.error('etherToWei error', e);
      throw new Error('Invalid ether amount');
    }
  }

  static generateRandomWallet() {
    const wallet = ethers.Wallet.createRandom();
    return { address: wallet.address, privateKey: wallet.privateKey, mnemonic: wallet.mnemonic.phrase };
  }

  static createWalletFromPrivateKey(privateKey) {
    try {
      return new ethers.Wallet(privateKey);
    } catch (e) {
      console.error('createWalletFromPrivateKey error', e);
      throw new Error('Invalid private key');
    }
  }

  static createWalletFromMnemonic(mnemonic, path = "m/44'/60'/0'/0/0") {
    try {
      return ethers.Wallet.fromMnemonic(mnemonic, path);
    } catch (e) {
      console.error('createWalletFromMnemonic error', e);
      throw new Error('Invalid mnemonic');
    }
  }

  getExplorerUrl(address) {
    const explorer = CONTRACT_CONFIG.network.explorer;
    if (!explorer) return '';
    return `${explorer}/address/${address}`;
  }

  getTransactionExplorerUrl(txHash) {
    const explorer = CONTRACT_CONFIG.network.explorer;
    if (!explorer) return '';
    return `${explorer}/tx/${txHash}`;
  }

  getTokenExplorerUrl(tokenAddress) {
    const explorer = CONTRACT_CONFIG.network.explorer;
    if (!explorer) return '';
    return `${explorer}/token/${tokenAddress}`;
  }

  exportState() {
    return { address: this.userAddress, chainId: this.chainId, isConnected: this.isConnected, lastConnectionTime: this.lastConnectionTime, metrics: this.metrics };
  }

  importState(state = {}) {
    if (state.address) this.userAddress = state.address;
    if (state.chainId) this.chainId = state.chainId;
    if (state.lastConnectionTime) this.lastConnectionTime = state.lastConnectionTime;
    if (state.metrics) this.metrics = { ...this.metrics, ...state.metrics };
  }

  cleanup() {
    this.removeEventListeners();
    this.disconnect();
    this.clearCaches();
    this.clearTransactionHistory();
    this.pendingTransactions.clear();
  }
}

export default Web3Manager;
