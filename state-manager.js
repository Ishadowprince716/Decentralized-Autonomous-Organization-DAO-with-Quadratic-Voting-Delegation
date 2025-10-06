// State Manager
// js/services/state-manager.js

import { STORAGE_KEYS, THEMES } from '../utils/constants.js';

/**
 * Manages application state and persistence
 */
export class StateManager extends EventTarget {
    constructor() {
        super();
        
        this.state = {
            user: {
                address: null,
                isConnected: false,
                chainId: null
            },
            member: {
                isMember: false,
                contribution: null,
                votingPower: null,
                delegatedTo: null
            },
            proposals: [],
            analytics: {
                totalMembers: 0,
                totalProposals: 0,
                activeProposals: 0,
                totalVotes: 0
            },
            ui: {
                theme: THEMES.AUTO,
                sidebarCollapsed: false,
                notifications: true
            },
            delegation: {
                currentDelegate: null,
                isDelegating: false,
                votingPower: null
            }
        };

        this.listeners = new Map();
        this.persistedKeys = ['ui']; // Keys to persist in localStorage
        
        this.loadPersistedState();
        this.setupThemeWatcher();
    }

    /**
     * Set user address
     * @param {string} address - User address
     */
    setUserAddress(address) {
        const oldAddress = this.state.user.address;
        this.state.user.address = address;
        this.state.user.isConnected = !!address;

        if (oldAddress !== address) {
            this.dispatchStateChange('user.address', address, oldAddress);
        }
    }

    /**
     * Get user address
     * @returns {string|null} User address
     */
    getUserAddress() {
        return this.state.user.address;
    }

    /**
     * Set network chain ID
     * @param {number} chainId - Chain ID
     */
    setChainId(chainId) {
        const oldChainId = this.state.user.chainId;
        this.state.user.chainId = chainId;

        if (oldChainId !== chainId) {
            this.dispatchStateChange('user.chainId', chainId, oldChainId);
        }
    }

    /**
     * Get chain ID
     * @returns {number|null} Chain ID
     */
    getChainId() {
        return this.state.user.chainId;
    }

    /**
     * Set member information
     * @param {Object} memberInfo - Member information
     */
    setMemberInfo(memberInfo) {
        const oldMemberInfo = { ...this.state.member };
        
        this.state.member = {
            isMember: memberInfo.isMember || false,
            contribution: memberInfo.contribution || null,
            votingPower: memberInfo.votingPower || null,
            delegatedTo: memberInfo.delegatedTo || null,
            address: memberInfo.address || null
        };

        if (JSON.stringify(oldMemberInfo) !== JSON.stringify(this.state.member)) {
            this.dispatchStateChange('member', this.state.member, oldMemberInfo);
        }
    }

    /**
     * Get member information
     * @returns {Object} Member information
     */
    getMemberInfo() {
        return { ...this.state.member };
    }

    /**
     * Check if user is a member
     * @returns {boolean} Membership status
     */
    isMember() {
        return this.state.member.isMember;
    }

    /**
     * Set proposals
     * @param {Array} proposals - Array of proposals
     */
    setProposals(proposals) {
        const oldProposals = [...this.state.proposals];
        this.state.proposals = proposals || [];

        if (JSON.stringify(oldProposals) !== JSON.stringify(this.state.proposals)) {
            this.dispatchStateChange('proposals', this.state.proposals, oldProposals);
        }
    }

    /**
     * Get proposals
     * @returns {Array} Array of proposals
     */
    getProposals() {
        return [...this.state.proposals];
    }

    /**
     * Add or update a proposal
     * @param {Object} proposal - Proposal data
     */
    updateProposal(proposal) {
        const index = this.state.proposals.findIndex(p => p.id === proposal.id);
        
        if (index >= 0) {
            this.state.proposals[index] = { ...proposal };
        } else {
            this.state.proposals.push({ ...proposal });
        }

        this.dispatchStateChange('proposals', this.state.proposals);
    }

    /**
     * Get proposal by ID
     * @param {number} proposalId - Proposal ID
     * @returns {Object|null} Proposal data
     */
    getProposal(proposalId) {
        return this.state.proposals.find(p => p.id === proposalId) || null;
    }

    /**
     * Set analytics data
     * @param {Object} analytics - Analytics data
     */
    setAnalytics(analytics) {
        const oldAnalytics = { ...this.state.analytics };
        
        this.state.analytics = {
            totalMembers: analytics.totalMembers || 0,
            totalProposals: analytics.totalProposals || 0,
            activeProposals: analytics.activeProposals || 0,
            totalVotes: analytics.totalVotes || 0,
            ...analytics
        };

        if (JSON.stringify(oldAnalytics) !== JSON.stringify(this.state.analytics)) {
            this.dispatchStateChange('analytics', this.state.analytics, oldAnalytics);
        }
    }

    /**
     * Get analytics data
     * @returns {Object} Analytics data
     */
    getAnalytics() {
        return { ...this.state.analytics };
    }

    /**
     * Set delegation information
     * @param {Object} delegationInfo - Delegation information
     */
    setDelegationInfo(delegationInfo) {
        const oldDelegation = { ...this.state.delegation };
        
        this.state.delegation = {
            currentDelegate: delegationInfo.currentDelegate || null,
            isDelegating: delegationInfo.isDelegating || false,
            votingPower: delegationInfo.votingPower || null
        };

        if (JSON.stringify(oldDelegation) !== JSON.stringify(this.state.delegation)) {
            this.dispatchStateChange('delegation', this.state.delegation, oldDelegation);
        }
    }

    /**
     * Get delegation information
     * @returns {Object} Delegation information
     */
    getDelegationInfo() {
        return { ...this.state.delegation };
    }

    /**
     * Set UI theme
     * @param {string} theme - Theme name
     */
    setTheme(theme) {
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
     * @returns {string} Current theme
     */
    getTheme() {
        return this.state.ui.theme;
    }

    /**
     * Toggle sidebar collapsed state
     */
    toggleSidebar() {
        this.state.ui.sidebarCollapsed = !this.state.ui.sidebarCollapsed;
        this.persistState();
        this.dispatchStateChange('ui.sidebar', this.state.ui.sidebarCollapsed);
    }

    /**
     * Set notifications enabled state
     * @param {boolean} enabled - Notifications enabled
     */
    setNotificationsEnabled(enabled) {
        const oldValue = this.state.ui.notifications;
        this.state.ui.notifications = enabled;

        if (oldValue !== enabled) {
            this.persistState();
            this.dispatchStateChange('ui.notifications', enabled, oldValue);
        }
    }

    /**
     * Get notifications enabled state
     * @returns {boolean} Notifications enabled
     */
    getNotificationsEnabled() {
        return this.state.ui.notifications;
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

        // Return unsubscribe function
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
     * Dispatch state change event
     * @param {string} key - Changed key
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    dispatchStateChange(key, newValue, oldValue = null) {
        // Notify specific key listeners
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

        // Dispatch global event
        this.dispatchEvent(new CustomEvent('stateChange', {
            detail: { key, newValue, oldValue }
        }));
    }

    /**
     * Get complete application state
     * @returns {Object} Complete state
     */
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Reset state to initial values
     */
    reset() {
        const initialState = {
            user: {
                address: null,
                isConnected: false,
                chainId: null
            },
            member: {
                isMember: false,
                contribution: null,
                votingPower: null,
                delegatedTo: null
            },
            proposals: [],
            analytics: {
                totalMembers: 0,
                totalProposals: 0,
                activeProposals: 0,
                totalVotes: 0
            },
            delegation: {
                currentDelegate: null,
                isDelegating: false,
                votingPower: null
            }
        };

        // Preserve UI settings
        const uiSettings = { ...this.state.ui };
        this.state = { ...initialState, ui: uiSettings };

        this.dispatchStateChange('reset', this.state);
    }

    /**
     * Clear user data (on disconnect)
     */
    clearUserData() {
        this.state.user = {
            address: null,
            isConnected: false,
            chainId: null
        };
        
        this.state.member = {
            isMember: false,
            contribution: null,
            votingPower: null,
            delegatedTo: null
        };

        this.state.delegation = {
            currentDelegate: null,
            isDelegating: false,
            votingPower: null
        };

        this.dispatchStateChange('user.disconnected', null);
    }

    /**
     * Load persisted state from localStorage
     */
    loadPersistedState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
            if (saved) {
                const parsed = JSON.parse(saved);
                
                // Only load persisted keys
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
     * Persist state to localStorage
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
     * Set up system theme watcher
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
            
            // Apply initial theme
            this.applyTheme(this.state.ui.theme);
        }
    }

    /**
     * Apply theme to document
     * @param {string} theme - Theme to apply
     */
    applyTheme(theme) {
        const root = document.documentElement;
        
        // Remove existing theme classes
        root.classList.remove('theme-light', 'theme-dark');
        
        let effectiveTheme = theme;
        
        if (theme === THEMES.AUTO) {
            // Use system preference
            effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 
                THEMES.DARK : THEMES.LIGHT;
        }
        
        // Apply theme class
        root.classList.add(`theme-${effectiveTheme}`);
        
        // Update meta theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', 
                effectiveTheme === THEMES.DARK ? '#1f2937' : '#4a90e2'
            );
        }
    }

    /**
     * Export state for debugging
     * @returns {Object} Serialized state
     */
    exportState() {
        return {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            state: this.getState()
        };
    }

    /**
     * Import state (for debugging/testing)
     * @param {Object} stateData - State data to import
     */
    importState(stateData) {
        if (stateData && stateData.state) {
            this.state = { ...this.state, ...stateData.state };
            this.dispatchStateChange('imported', this.state);
        }
    }

    /**
     * Create a computed value that updates when dependencies change
     * @param {Array} dependencies - Array of state keys to watch
     * @param {Function} computeFn - Function to compute value
     * @returns {Function} Unsubscribe function
     */
    createComputed(dependencies, computeFn) {
        const unsubscribers = [];
        
        const update = () => {
            try {
                const result = computeFn(this.state);
                this.dispatchEvent(new CustomEvent('computed', {
                    detail: { dependencies, result }
                }));
            } catch (error) {
                console.error('Error in computed value:', error);
            }
        };

        // Subscribe to all dependencies
        dependencies.forEach(key => {
            const unsubscribe = this.subscribe(key, update);
            unsubscribers.push(unsubscribe);
        });

        // Initial computation
        update();

        // Return cleanup function
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }

    /**
     * Batch multiple state updates
     * @param {Function} updateFn - Function that performs updates
     */
    batch(updateFn) {
        const originalDispatch = this.dispatchStateChange;
        const changes = [];

        // Temporarily replace dispatch to collect changes
        this.dispatchStateChange = (key, newValue, oldValue) => {
            changes.push({ key, newValue, oldValue });
        };

        try {
            updateFn();
        } finally {
            // Restore original dispatch
            this.dispatchStateChange = originalDispatch;
        }

        // Dispatch all changes
        changes.forEach(({ key, newValue, oldValue }) => {
            this.dispatchStateChange(key, newValue, oldValue);
        });
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Clear all listeners
        this.listeners.clear();
        
        // Remove theme watcher
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.removeEventListener('change', this.handleThemeChange);
        }
    }
}

export default StateManager;