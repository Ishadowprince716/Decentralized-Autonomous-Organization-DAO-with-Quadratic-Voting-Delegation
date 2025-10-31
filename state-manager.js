// State Manager - Production Ready
// js/services/state-manager.js

import { STORAGE_KEYS, THEMES } from '../utils/constants.js';

/**
 * Enhanced State Manager with History, Validation, Middleware, and Performance Optimizations
 */
export class StateManager extends EventTarget {
    constructor(options = {}) {
        super();
        
        this.maxHistorySize = options.maxHistorySize || 50;
        this.debounceDelay = options.debounceDelay || 300;
        this.enableDevTools = options.enableDevTools || false;
        
        this.state = {
            user: {
                address: null,
                isConnected: false,
                chainId: null,
                ensName: null,
                balance: '0'
            },
            member: {
                isMember: false,
                contribution: null,
                votingPower: null,
                delegatedTo: null,
                joinedAt: null,
                totalVotesCast: 0,
                proposalsCreated: 0
            },
            proposals: [],
            analytics: {
                totalMembers: 0,
                totalProposals: 0,
                activeProposals: 0,
                totalVotes: 0,
                totalContributed: '0',
                averageVotingPower: 0
            },
            ui: {
                theme: THEMES.AUTO,
                sidebarCollapsed: false,
                notifications: true,
                notificationLevel: 'info', // 'error', 'warning', 'info', 'success'
                isLoading: false,
                error: null,
                toast: null
            },
            delegation: {
                currentDelegate: null,
                isDelegating: false,
                votingPower: null,
                delegators: [],
                delegationHistory: []
            },
            cache: {
                lastProposalFetch: null,
                lastAnalyticsFetch: null,
                cachedProposals: null
            }
        };

        this.listeners = new Map();
        this.middleware = [];
        this.validators = new Map();
        this.persistedKeys = ['ui', 'cache'];
        this.history = [];
        this.historyIndex = -1;
        this.debounceTimers = new Map();
        this.stateSnapshots = new Map();
        this.computedValues = new Map();
        this.performanceMetrics = {};
        
        // Lock for batch operations
        this.isLocked = false;
        this.pendingChanges = [];
        
        this.loadPersistedState();
        this.setupThemeWatcher();
        this.setupDevTools();
        this.registerDefaultValidators();
    }

    /**
     * Register middleware function
     * @param {Function} fn - Middleware function
     */
    use(fn) {
        this.middleware.push(fn);
        return this;
    }

    /**
     * Register validator for a state key
     * @param {string} key - State key
     * @param {Function} validatorFn - Validator function
     */
    registerValidator(key, validatorFn) {
        this.validators.set(key, validatorFn);
    }

    /**
     * Register default validators
     */
    registerDefaultValidators() {
        this.registerValidator('user.address', (value) => {
            if (value && typeof value !== 'string') {
                throw new Error('Address must be a string');
            }
            if (value && !value.match(/^0x[a-fA-F0-9]{40}$/)) {
                throw new Error('Invalid Ethereum address format');
            }
            return true;
        });

        this.registerValidator('user.chainId', (value) => {
            if (value && !Number.isInteger(value)) {
                throw new Error('ChainId must be an integer');
            }
            return true;
        });

        this.registerValidator('member.votingPower', (value) => {
            if (value !== null && isNaN(value)) {
                throw new Error('Voting power must be a number');
            }
            return true;
        });

        this.registerValidator('analytics.totalMembers', (value) => {
            if (!Number.isInteger(value) || value < 0) {
                throw new Error('Total members must be a non-negative integer');
            }
            return true;
        });
    }

    /**
     * Validate state value
     * @param {string} key - State key
     * @param {*} value - Value to validate
     * @returns {boolean} Validation result
     */
    validate(key, value) {
        const validator = this.validators.get(key);
        if (validator) {
            return validator(value);
        }
        return true;
    }

    /**
     * Run middleware pipeline
     * @param {Object} context - Middleware context
     * @returns {Promise<Object>} Modified context
     */
    async runMiddleware(context) {
        let result = context;
        for (const middleware of this.middleware) {
            result = await middleware(result);
            if (result.cancelled) {
                return result;
            }
        }
        return result;
    }

    /**
     * Set user address with validation
     * @param {string} address - User address
     */
    async setUserAddress(address) {
        return this.setState('user.address', address);
    }

    /**
     * Get user address
     * @returns {string|null}
     */
    getUserAddress() {
        return this.state.user.address;
    }

    /**
     * Set user balance
     * @param {string} balance - Balance in wei
     */
    async setUserBalance(balance) {
        return this.setState('user.balance', balance);
    }

    /**
     * Get user balance
     * @returns {string}
     */
    getUserBalance() {
        return this.state.user.balance;
    }

    /**
     * Set ENS name
     * @param {string} ensName - ENS name
     */
    async setENSName(ensName) {
        return this.setState('user.ensName', ensName);
    }

    /**
     * Set chain ID
     * @param {number} chainId - Chain ID
     */
    async setChainId(chainId) {
        return this.setState('user.chainId', chainId);
    }

    /**
     * Get chain ID
     * @returns {number|null}
     */
    getChainId() {
        return this.state.user.chainId;
    }

    /**
     * Set member information
     * @param {Object} memberInfo - Member information
     */
    async setMemberInfo(memberInfo) {
        const oldMemberInfo = { ...this.state.member };
        
        const updatedInfo = {
            isMember: memberInfo.isMember !== undefined ? memberInfo.isMember : this.state.member.isMember,
            contribution: memberInfo.contribution !== undefined ? memberInfo.contribution : this.state.member.contribution,
            votingPower: memberInfo.votingPower !== undefined ? memberInfo.votingPower : this.state.member.votingPower,
            delegatedTo: memberInfo.delegatedTo !== undefined ? memberInfo.delegatedTo : this.state.member.delegatedTo,
            joinedAt: memberInfo.joinedAt !== undefined ? memberInfo.joinedAt : this.state.member.joinedAt,
            totalVotesCast: memberInfo.totalVotesCast !== undefined ? memberInfo.totalVotesCast : this.state.member.totalVotesCast,
            proposalsCreated: memberInfo.proposalsCreated !== undefined ? memberInfo.proposalsCreated : this.state.member.proposalsCreated
        };

        this.state.member = updatedInfo;
        this.recordHistory();
        
        if (JSON.stringify(oldMemberInfo) !== JSON.stringify(updatedInfo)) {
            this.dispatchStateChange('member', updatedInfo, oldMemberInfo);
        }
    }

    /**
     * Get member information
     * @returns {Object}
     */
    getMemberInfo() {
        return { ...this.state.member };
    }

    /**
     * Check if user is member
     * @returns {boolean}
     */
    isMember() {
        return this.state.member.isMember;
    }

    /**
     * Set proposals
     * @param {Array} proposals - Array of proposals
     */
    async setProposals(proposals) {
        const oldProposals = [...this.state.proposals];
        this.state.proposals = proposals || [];
        this.state.cache.cachedProposals = JSON.parse(JSON.stringify(proposals));
        this.state.cache.lastProposalFetch = new Date().toISOString();
        this.recordHistory();

        if (JSON.stringify(oldProposals) !== JSON.stringify(this.state.proposals)) {
            this.dispatchStateChange('proposals', this.state.proposals, oldProposals);
        }
    }

    /**
     * Get proposals
     * @returns {Array}
     */
    getProposals() {
        return [...this.state.proposals];
    }

    /**
     * Filter proposals by status
     * @param {string} status - Proposal status
     * @returns {Array}
     */
    getProposalsByStatus(status) {
        return this.state.proposals.filter(p => p.status === status);
    }

    /**
     * Get active proposals
     * @returns {Array}
     */
    getActiveProposals() {
        return this.getProposalsByStatus('active');
    }

    /**
     * Update or add proposal
     * @param {Object} proposal - Proposal data
     */
    async updateProposal(proposal) {
        const index = this.state.proposals.findIndex(p => p.id === proposal.id);
        
        if (index >= 0) {
            this.state.proposals[index] = { ...proposal };
        } else {
            this.state.proposals.push({ ...proposal });
        }

        this.recordHistory();
        this.dispatchStateChange('proposals', this.state.proposals);
    }

    /**
     * Remove proposal by ID
     * @param {number} proposalId - Proposal ID
     */
    async removeProposal(proposalId) {
        const initialLength = this.state.proposals.length;
        this.state.proposals = this.state.proposals.filter(p => p.id !== proposalId);
        
        if (this.state.proposals.length < initialLength) {
            this.recordHistory();
            this.dispatchStateChange('proposals', this.state.proposals);
        }
    }

    /**
     * Get proposal by ID
     * @param {number} proposalId - Proposal ID
     * @returns {Object|null}
     */
    getProposal(proposalId) {
        return this.state.proposals.find(p => p.id === proposalId) || null;
    }

    /**
     * Set analytics data
     * @param {Object} analytics - Analytics data
     */
    async setAnalytics(analytics) {
        const oldAnalytics = { ...this.state.analytics };
        
        this.state.analytics = {
            totalMembers: analytics.totalMembers !== undefined ? analytics.totalMembers : this.state.analytics.totalMembers,
            totalProposals: analytics.totalProposals !== undefined ? analytics.totalProposals : this.state.analytics.totalProposals,
            activeProposals: analytics.activeProposals !== undefined ? analytics.activeProposals : this.state.analytics.activeProposals,
            totalVotes: analytics.totalVotes !== undefined ? analytics.totalVotes : this.state.analytics.totalVotes,
            totalContributed: analytics.totalContributed !== undefined ? analytics.totalContributed : this.state.analytics.totalContributed,
            averageVotingPower: analytics.averageVotingPower !== undefined ? analytics.averageVotingPower : this.state.analytics.averageVotingPower
        };

        this.state.cache.lastAnalyticsFetch = new Date().toISOString();
        this.recordHistory();

        if (JSON.stringify(oldAnalytics) !== JSON.stringify(this.state.analytics)) {
            this.dispatchStateChange('analytics', this.state.analytics, oldAnalytics);
        }
    }

    /**
     * Get analytics data
     * @returns {Object}
     */
    getAnalytics() {
        return { ...this.state.analytics };
    }

    /**
     * Set delegation information
     * @param {Object} delegationInfo - Delegation information
     */
    async setDelegationInfo(delegationInfo) {
        const oldDelegation = { ...this.state.delegation };
        
        this.state.delegation = {
            currentDelegate: delegationInfo.currentDelegate !== undefined ? delegationInfo.currentDelegate : this.state.delegation.currentDelegate,
            isDelegating: delegationInfo.isDelegating !== undefined ? delegationInfo.isDelegating : this.state.delegation.isDelegating,
            votingPower: delegationInfo.votingPower !== undefined ? delegationInfo.votingPower : this.state.delegation.votingPower,
            delegators: delegationInfo.delegators || this.state.delegation.delegators,
            delegationHistory: delegationInfo.delegationHistory || this.state.delegation.delegationHistory
        };

        this.recordHistory();

        if (JSON.stringify(oldDelegation) !== JSON.stringify(this.state.delegation)) {
            this.dispatchStateChange('delegation', this.state.delegation, oldDelegation);
        }
    }

    /**
     * Get delegation information
     * @returns {Object}
     */
    getDelegationInfo() {
        return { ...this.state.delegation };
    }

    /**
     * Add delegator
     * @param {string} delegatorAddress - Delegator address
     * @param {number} votingPower - Voting power amount
     */
    addDelegator(delegatorAddress, votingPower) {
        if (!this.state.delegation.delegators.find(d => d.address === delegatorAddress)) {
            this.state.delegation.delegators.push({
                address: delegatorAddress,
                votingPower,
                delegatedAt: new Date().toISOString()
            });
            this.recordHistory();
            this.dispatchStateChange('delegation.delegators', this.state.delegation.delegators);
        }
    }

    /**
     * Remove delegator
     * @param {string} delegatorAddress - Delegator address
     */
    removeDelegator(delegatorAddress) {
        const initialLength = this.state.delegation.delegators.length;
        this.state.delegation.delegators = this.state.delegation.delegators.filter(
            d => d.address !== delegatorAddress
        );
        
        if (this.state.delegation.delegators.length < initialLength) {
            this.recordHistory();
            this.dispatchStateChange('delegation.delegators', this.state.delegation.delegators);
        }
    }

    /**
     * Set theme
     * @param {string} theme - Theme name
     */
    async setTheme(theme) {
        const oldTheme = this.state.ui.theme;
        this.state.ui.theme = theme;

        if (oldTheme !== theme) {
            this.persistState();
            this.applyTheme(theme);
            this.dispatchStateChange('ui.theme', theme, oldTheme);
        }
    }

    /**
     * Get current theme
     * @returns {string}
     */
    getTheme() {
        return this.state.ui.theme;
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        this.state.ui.sidebarCollapsed = !this.state.ui.sidebarCollapsed;
        this.persistState();
        this.dispatchStateChange('ui.sidebar', this.state.ui.sidebarCollapsed);
    }

    /**
     * Set notifications enabled
     * @param {boolean} enabled - Notifications enabled
     */
    async setNotificationsEnabled(enabled) {
        const oldValue = this.state.ui.notifications;
        this.state.ui.notifications = enabled;

        if (oldValue !== enabled) {
            this.persistState();
            this.dispatchStateChange('ui.notifications', enabled, oldValue);
        }
    }

    /**
     * Get notifications enabled
     * @returns {boolean}
     */
    getNotificationsEnabled() {
        return this.state.ui.notifications;
    }

    /**
     * Set loading state
     * @param {boolean} isLoading - Loading state
     */
    setLoading(isLoading) {
        const oldValue = this.state.ui.isLoading;
        this.state.ui.isLoading = isLoading;

        if (oldValue !== isLoading) {
            this.dispatchStateChange('ui.isLoading', isLoading, oldValue);
        }
    }

    /**
     * Set error
     * @param {string|null} error - Error message
     */
    setError(error) {
        const oldValue = this.state.ui.error;
        this.state.ui.error = error;

        if (oldValue !== error) {
            this.dispatchStateChange('ui.error', error, oldValue);
        }
    }

    /**
     * Show toast notification
     * @param {Object} toast - Toast object {message, type, duration}
     */
    showToast(toast) {
        this.state.ui.toast = {
            ...toast,
            id: Date.now(),
            createdAt: new Date().toISOString()
        };
        this.dispatchStateChange('ui.toast', this.state.ui.toast);

        if (toast.duration) {
            setTimeout(() => {
                this.state.ui.toast = null;
                this.dispatchStateChange('ui.toast', null);
            }, toast.duration);
        }
    }

    /**
     * Generic setState with middleware and validation
     * @param {string} key - State key (supports nested keys like 'user.address')
     * @param {*} value - Value to set
     * @returns {Promise<boolean>}
     */
    async setState(key, value) {
        try {
            // Validate
            this.validate(key, value);

            // Run middleware
            const context = await this.runMiddleware({
                key,
                value,
                state: this.state,
                oldValue: this.getNestedValue(key),
                cancelled: false
            });

            if (context.cancelled) {
                return false;
            }

            // Update state
            this.setNestedValue(key, context.value);
            this.recordHistory();

            // Dispatch change
            this.dispatchStateChange(key, context.value, context.oldValue);
            return true;
        } catch (error) {
            console.error(`Error setting state for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Get nested value from state
     * @param {string} key - Dot-notation key
     * @returns {*}
     */
    getNestedValue(key) {
        const keys = key.split('.');
        let value = this.state;
        
        for (const k of keys) {
            value = value?.[k];
        }
        
        return value;
    }

    /**
     * Set nested value in state
     * @param {string} key - Dot-notation key
     * @param {*} value - Value to set
     */
    setNestedValue(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let obj = this.state;
        
        for (const k of keys) {
            if (!obj[k]) {
                obj[k] = {};
            }
            obj = obj[k];
        }
        
        obj[lastKey] = value;
    }

    /**
     * Subscribe to state changes
     * @param {string} key - State key to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        
        this.listeners.get(key).add(callback);

        return () => {
            const keyListeners = this.listeners.get(key);
            if (keyListeners) {
                keyListeners.delete(callback);
                if (keyListeners.size === 0) {
                    this.listeners.delete(key);
                }
            }
        };
    }

    /**
     * Subscribe with debounce
     * @param {string} key - State key
     * @param {Function} callback - Callback function
     * @param {number} delay - Debounce delay
     * @returns {Function} Unsubscribe function
     */
    subscribeDebounced(key, callback, delay = this.debounceDelay) {
        return this.subscribe(key, (newValue, oldValue, changedKey) => {
            clearTimeout(this.debounceTimers.get(key));
            
            const timer = setTimeout(() => {
                callback(newValue, oldValue, changedKey);
            }, delay);
            
            this.debounceTimers.set(key, timer);
        });
    }

    /**
     * Subscribe once
     * @param {string} key - State key
     * @param {Function} callback - Callback function
     */
    subscribeOnce(key, callback) {
        const unsubscribe = this.subscribe(key, (newValue, oldValue, changedKey) => {
            callback(newValue, oldValue, changedKey);
            unsubscribe();
        });
        
        return unsubscribe;
    }

    /**
     * Dispatch state change event
     * @param {string} key - Changed key
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    dispatchStateChange(key, newValue, oldValue = null) {
        const keyListeners = this.listeners.get(key);
        if (keyListeners) {
            keyListeners.forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (error) {
                    console.error('Error in state change callback:', error);
                }
            });
        }

        this.dispatchEvent(new CustomEvent('stateChange', {
            detail: { key, newValue, oldValue }
        }));

        // Trigger computed values
        this.computedValues.forEach((config) => {
            if (config.dependencies.includes(key)) {
                try {
                    const result = config.computeFn(this.state);
                    this.dispatchEvent(new CustomEvent('computed', {
                        detail: { name: config.name, result }
                    }));
                } catch (error) {
                    console.error('Error computing value:', error);
                }
            }
        });
    }

    /**
     * Get complete state
     * @returns {Object}
     */
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Get state at specific history index
     * @param {number} index - History index
     * @returns {Object|null}
     */
    getHistoryState(index) {
        return this.history[index]?.state || null;
    }

    /**
     * Record state to history
     */
    recordHistory() {
        if (this.isLocked) {
            return;
        }

        // Remove any future history if we're not at the end
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Add current state to history
        this.history.push({
            state: JSON.parse(JSON.stringify(this.state)),
            timestamp: new Date().toISOString()
        });

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.recordPerformance('history_recorded');
    }

    /**
     * Undo to previous state
     * @returns {boolean} Success
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const previousState = this.history[this.historyIndex].state;
            this.state = JSON.parse(JSON.stringify(previousState));
            this.dispatchStateChange('undo', this.state);
            return true;
        }
        return false;
    }

    /**
     * Redo to next state
     * @returns {boolean} Success
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const nextState = this.history[this.historyIndex].state;
            this.state = JSON.parse(JSON.stringify(nextState));
            this.dispatchStateChange('redo', this.state);
            return true;
        }
        return false;
    }

    /**
     * Get history
     * @returns {Array}
     */
    getHistory() {
        return this.history.map((entry, index) => ({
            index,
            timestamp: entry.timestamp,
            isCurrent: index === this.historyIndex
        }));
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.history = [];
        this.historyIndex = -1;
    }

    /**
     * Create state snapshot
     * @param {string} name - Snapshot name
     */
    createSnapshot(name) {
        this.stateSnapshots.set(name, JSON.parse(JSON.stringify(this.state)));
        this.recordPerformance(`snapshot_created_${name}`);
    }

    /**
     * Restore snapshot
     * @param {string} name - Snapshot name
     * @returns {boolean} Success
     */
    restoreSnapshot(name) {
        const snapshot = this.stateSnapshots.get(name);
        if (snapshot) {
            this.state = JSON.parse(JSON.stringify(snapshot));
            this.recordHistory();
            this.dispatchStateChange('snapshot_restored', this.state);
            return true;
        }
        return false;
    }

    /**
     * Delete snapshot
     * @param {string} name - Snapshot name
     */
    deleteSnapshot(name) {
        this.stateSnapshots.delete(name);
    }

    /**
     * Get snapshot names
     * @returns {Array}
     */
    getSnapshots() {
        return Array.from(this.stateSnapshots.keys());
    }

    /**
     * Create computed value
     * @param {string} name - Computed value name
     * @param {Array} dependencies - Dependency keys
     * @param {Function} computeFn - Computation function
     * @returns {Function} Unsubscribe function
     */
    createComputed(name, dependencies, computeFn) {
        const config = { name, dependencies, computeFn };
        this.computedValues.set(name, config);

        // Initial computation
        try {
            const result = computeFn(this.state);
            this.dispatchEvent(new CustomEvent('computed', {
                detail: { name, result }
            }));
        } catch (error) {
            console.error('Error in computed value:', error);
        }

        return () => {
            this.computedValues.delete(name);
        };
    }

    /**
     * Batch multiple updates
     * @param {Function} updateFn - Update function
     */
    batch(updateFn) {
        this.isLocked = true;
        this.pendingChanges = [];

        try {
            updateFn();
        } finally {
            this.isLocked = false;
            
            // Record history once for all changes
            if (this.pendingChanges.length > 0) {
                this.recordHistory();
                
                // Dispatch all changes
                this.pendingChanges.forEach(({ key, newValue, oldValue }) => {
                    this.dispatchStateChange(key, newValue, oldValue);
                });
                
                this.pendingChanges = [];
            }
        }
    }

    /**
     * Batch update with rollback on error
     * @param {Function} updateFn - Update function
     * @returns {Promise<boolean>}
     */
    async batchWithRollback(updateFn) {
        const snapshot = JSON.parse(JSON.stringify(this.state));
        
        try {
            await this.batch(updateFn);
            return true;
        } catch (error) {
            console.error('Batch operation failed, rolling back:', error);
            this.state = snapshot;
            this.dispatchStateChange('rollback', this.state);
            return false;
        }
    }

    /**
     * Reset to initial state
     */
    reset() {
        const initialState = {
            user: {
                address: null,
                isConnected: false,
                chainId: null,
                ensName: null,
                balance: '0'
            },
            member: {
                isMember: false,
                contribution: null,
                votingPower: null,
                delegatedTo: null,
                joinedAt: null,
                totalVotesCast: 0,
                proposalsCreated: 0
            },
            proposals: [],
            analytics: {
                totalMembers: 0,
                totalProposals: 0,
                activeProposals: 0,
                totalVotes: 0,
                totalContributed: '0',
                averageVotingPower: 0
            },
            delegation: {
                currentDelegate: null,
                isDelegating: false,
                votingPower: null,
                delegators: [],
                delegationHistory: []
            },
            cache: {
                lastProposalFetch: null,
                lastAnalyticsFetch: null,
                cachedProposals: null
            }
        };

        const uiSettings = { ...this.state.ui };
        this.state = { ...initialState, ui: uiSettings };
        
        this.recordHistory();
        this.dispatchStateChange('reset', this.state);
    }

    /**
     * Clear user data on disconnect
     */
    clearUserData() {
        this.state.user = {
            address: null,
            isConnected: false,
            chainId: null,
            ensName: null,
            balance: '0'
        };
        
        this.state.member = {
            isMember: false,
            contribution: null,
            votingPower: null,
            delegatedTo: null,
            joinedAt: null,
            totalVotesCast: 0,
            proposalsCreated: 0
        };

        this.state.delegation = {
            currentDelegate: null,
            isDelegating: false,
            votingPower: null,
            delegators: [],
            delegationHistory: []
        };

        this.recordHistory();
        this.dispatchStateChange('user.disconnected', null);
    }

    /**
     * Load persisted state
     */
    loadPersistedState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
            if (saved) {
                const parsed = JSON.parse(saved);
                
                this.persistedKeys.forEach(key => {
                    if (parsed[key]) {
                        this.state[key] = { ...this.state[key], ...parsed[key] };
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load persisted state:', error);
        }
    }

    /**
     * Persist state
     */
    persistState() {
        try {
            const toPersist = {};
            this.persistedKeys.forEach(key => {
                toPersist[key] = this.state[key];
            });
            
            localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(toPersist));
        } catch (error) {
            console.warn('Failed to persist state:', error);
        }
    }

    /**
     * Setup theme watcher
     */
    setupThemeWatcher() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            const handleThemeChange = () => {
                if (this.state.ui.theme === THEMES.AUTO) {
                    this.applyTheme(THEMES.AUTO);
                }
            };

            mediaQuery.addEventListener('change', handleThemeChange);
            this.applyTheme(this.state.ui.theme);
        }
    }

    /**
     * Apply theme
     * @param {string} theme - Theme to apply
     */
    applyTheme(theme) {
        const root = document.documentElement;
        
        root.classList.remove('theme-light', 'theme-dark');
        
        let effectiveTheme = theme;
        
        if (theme === THEMES.AUTO) {
            effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 
                THEMES.DARK : THEMES.LIGHT;
        }
        
        root.classList.add(`theme-${effectiveTheme}`);
        
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', 
                effectiveTheme === THEMES.DARK ? '#1f2937' : '#4a90e2'
            );
        }
    }

    /**
     * Check if can undo
     * @returns {boolean}
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if can redo
     * @returns {boolean}
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Get cache age in milliseconds
     * @param {string} key - Cache key
     * @returns {number|null}
     */
    getCacheAge(key) {
        const timestamp = this.state.cache[`last${key.charAt(0).toUpperCase() + key.slice(1)}Fetch`];
        if (!timestamp) return null;
        
        return Date.now() - new Date(timestamp).getTime();
    }

    /**
     * Is cache fresh
     * @param {string} key - Cache key
     * @param {number} maxAge - Max age in milliseconds
     * @returns {boolean}
     */
    isCacheFresh(key, maxAge = 60000) {
        const age = this.getCacheAge(key);
        return age !== null && age < maxAge;
    }

    /**
     * Record performance metric
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     */
    recordPerformance(metric, value = 1) {
        if (!this.performanceMetrics[metric]) {
            this.performanceMetrics[metric] = 0;
        }
        this.performanceMetrics[metric] += value;
    }

    /**
     * Get performance metrics
     * @returns {Object}
     */
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * Export state for debugging
     * @returns {Object}
     */
    exportState() {
        return {
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            state: this.getState(),
            history: this.getHistory(),
            snapshots: this.getSnapshots(),
            metrics: this.getPerformanceMetrics()
        };
    }

    /**
     * Import state
     * @param {Object} stateData - State data to import
     */
    importState(stateData) {
        if (stateData && stateData.state) {
            this.state = { ...this.state, ...stateData.state };
            this.recordHistory();
            this.dispatchStateChange('imported', this.state);
        }
    }

    /**
     * Setup dev tools integration
     */
    setupDevTools() {
        if (this.enableDevTools && window.__REDUX_DEVTOOLS_EXTENSION__) {
            window.__REDUX_DEVTOOLS_EXTENSION__.connect();
        }
    }

    /**
     * Deep state comparison
     * @param {Object} stateA - State A
     * @param {Object} stateB - State B
     * @returns {Object} Differences
     */
    compareStates(stateA, stateB) {
        const differences = {};
        
        const compare = (a, b, path = '') => {
            for (const key in a) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (typeof a[key] === 'object' && a[key] !== null && typeof b[key] === 'object' && b[key] !== null) {
                    compare(a[key], b[key], currentPath);
                } else if (a[key] !== b[key]) {
                    differences[currentPath] = { old: a[key], new: b[key] };
                }
            }
        };
        
        compare(stateA, stateB);
        return differences;
    }

    /**
     * Get state diff from history
     * @param {number} fromIndex - From history index
     * @param {number} toIndex - To history index
     * @returns {Object|null}
     */
    getHistoryDiff(fromIndex, toIndex) {
        const fromState = this.getHistoryState(fromIndex);
        const toState = this.getHistoryState(toIndex);
        
        if (!fromState || !toState) return null;
        
        return this.compareStates(fromState, toState);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.listeners.clear();
        this.middleware = [];
        this.validators.clear();
        this.computedValues.clear();
        this.stateSnapshots.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }

    /**
     * Print debug info
     */
    debug() {
        console.group('StateManager Debug Info');
        console.log('Current State:', this.getState());
        console.log('History:', this.getHistory());
        console.log('Snapshots:', this.getSnapshots());
        console.log('Computed Values:', Array.from(this.computedValues.keys()));
        console.log('Performance Metrics:', this.getPerformanceMetrics());
        console.log('Cache Status:', {
            lastProposalFetch: this.state.cache.lastProposalFetch,
            lastAnalyticsFetch: this.state.cache.lastAnalyticsFetch
        });
        console.groupEnd();
    }
}

export default StateManager;
