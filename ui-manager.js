// UI Manager
// js/services/ui-manager.js

import { UTILS, TOAST_TYPES, ANIMATION_DURATIONS } from '../utils/constants.js';

/**
 * Manages UI state, rendering, and user interactions
 */
export class UIManager extends EventTarget {
    constructor() {
        super();
        
        this.elements = new Map();
        this.modals = new Map();
        this.toasts = [];
        this.isInitialized = false;
        
        // Debounced functions
        this.debouncedSearch = UTILS.debounce(this.handleSearch.bind(this), 300);
        this.throttledScroll = UTILS.throttle(this.handleScroll.bind(this), 100);
    }

    /**
     * Initialize UI manager
     */
    async init() {
        try {
            this.cacheElements();
            this.setupEventListeners();
            this.setupAccessibility();
            
            this.isInitialized = true;
            this.dispatchEvent(new CustomEvent('ui:initialized'));
        } catch (error) {
            console.error('Failed to initialize UI manager:', error);
            throw error;
        }
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        const selectors = {
            // Navigation
            connectWallet: '#connectWallet',
            
            // Member info
            memberInfo: '#memberInfo',
            votingPowerDisplay: '#votingPowerDisplay',
            delegationInfo: '#delegationInfo',
            
            // Stats
            totalMembers: '#totalMembers',
            activeProposals: '#activeProposals',
            totalVotes: '#totalVotes',
            
            // Hero actions
            joinDAO: '#joinDAO',
            createProposal: '#createProposal',
            
            // Proposal creation
            proposalCreation: '#proposalCreation',
            proposalForm: '#proposalForm',
            proposalTitle: '#proposalTitle',
            proposalDescription: '#proposalDescription',
            proposalCategory: '#proposalCategory',
            
            // Proposals list
            proposalsList: '#proposalsList',
            proposalFilter: '#proposalFilter',
            
            // Voting
            votingSection: '#votingSection',
            votingForm: '#votingForm',
            votingProposalTitle: '#votingProposalTitle',
            votingProposalDescription: '#votingProposalDescription',
            voteCredits: '#voteCredits',
            creditsDisplay: '#creditsDisplay',
            votingPowerCalc: '#votingPowerCalc',
            votingCost: '#votingCost',
            delegateVote: '#delegateVote',
            delegateSelect: '#delegateSelect',
            
            // Delegation modal
            delegationModal: '#delegationModal',
            delegationForm: '#delegationForm',
            delegateAddress: '#delegateAddress',
            currentDelegate: '#currentDelegate',
            
            // Loading and notifications
            loadingOverlay: '#loadingOverlay',
            loadingMessage: '#loadingMessage',
            toastContainer: '#toastContainer'
        };

        for (const [key, selector] of Object.entries(selectors)) {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(key, element);
            }
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Wallet connection
        this.addEventListenerSafe('connectWallet', 'click', () => {
            this.dispatchEvent(new CustomEvent('ui:walletConnectRequested'));
        });

        // DAO actions
        this.addEventListenerSafe('joinDAO', 'click', () => {
            this.dispatchEvent(new CustomEvent('ui:joinDAORequested'));
        });

        this.addEventListenerSafe('createProposal', 'click', () => {
            this.showProposalForm();
        });

        // Proposal form
        this.addEventListenerSafe('proposalForm', 'submit', (e) => {
            e.preventDefault();
            this.handleProposalSubmit();
        });

        this.addEventListenerSafe('cancelProposal', 'click', () => {
            this.hideProposalForm();
        });

        // Voting form
        this.addEventListenerSafe('votingForm', 'submit', (e) => {
            e.preventDefault();
            this.handleVoteSubmit();
        });

        this.addEventListenerSafe('cancelVote', 'click', () => {
            this.hideVotingSection();
        });

        // Credits slider
        this.addEventListenerSafe('voteCredits', 'input', (e) => {
            this.updateVotingCalculations(parseInt(e.target.value));
        });

        // Delegation checkbox
        this.addEventListenerSafe('delegateVote', 'change', (e) => {
            const delegateSelect = this.elements.get('delegateSelect');
            if (delegateSelect) {
                delegateSelect.disabled = !e.target.checked;
            }
        });

        // Delegation modal
        this.addEventListenerSafe('manageDelegation', 'click', () => {
            this.showDelegationModal();
        });

        this.addEventListenerSafe('delegationForm', 'submit', (e) => {
            e.preventDefault();
            this.handleDelegationSubmit();
        });

        this.addEventListenerSafe('revokeDelegate', 'click', () => {
            this.handleDelegationRevoke();
        });

        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-close-modal]') || e.target.closest('[data-close-modal]')) {
                this.closeModals();
            }
        });

        // Proposal filter
        this.addEventListenerSafe('proposalFilter', 'change', (e) => {
            this.filterProposals(e.target.value);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    /**
     * Safely add event listener to element
     */
    addEventListenerSafe(elementKey, event, handler) {
        const element = this.elements.get(elementKey) || document.getElementById(elementKey);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    /**
     * Set up accessibility features
     */
    setupAccessibility() {
        // Focus management for modals
        document.addEventListener('focusin', this.handleFocusManagement.bind(this));
        
        // Skip link functionality
        const skipLink = document.querySelector('.skip-nav');
        if (skipLink) {
            skipLink.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector('#main-content');
                if (target) {
                    target.focus();
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    }

    /**
     * Update connection status
     * @param {boolean} isConnected - Connection status
     * @param {string} address - User address
     */
    updateConnectionStatus(isConnected, address = null) {
        const connectButton = this.elements.get('connectWallet');
        const joinButton = this.elements.get('joinDAO');
        const createButton = this.elements.get('createProposal');

        if (connectButton) {
            if (isConnected && address) {
                connectButton.innerHTML = `
                    <i class="fas fa-check-circle" aria-hidden="true"></i>
                    <span>${UTILS.formatAddress(address)}</span>
                `;
                connectButton.classList.add('btn-success');
                connectButton.classList.remove('btn-primary');
                connectButton.disabled = true;
            } else {
                connectButton.innerHTML = `
                    <i class="fas fa-wallet" aria-hidden="true"></i>
                    <span>Connect Wallet</span>
                `;
                connectButton.classList.remove('btn-success');
                connectButton.classList.add('btn-primary');
                connectButton.disabled = false;
            }
        }

        if (joinButton) joinButton.disabled = !isConnected;
        if (createButton) createButton.disabled = !isConnected;
    }

    /**
     * Update member information display
     * @param {Object} memberInfo - Member information
     */
    updateMemberInfo(memberInfo) {
        const memberInfoElement = this.elements.get('memberInfo');
        const votingPowerElement = this.elements.get('votingPowerDisplay');
        const joinButton = this.elements.get('joinDAO');

        if (memberInfo && memberInfo.isMember) {
            // Update member info
            if (memberInfoElement) {
                memberInfoElement.innerHTML = `
                    <div class="member-status">
                        <i class="fas fa-check-circle text-success" aria-hidden="true"></i>
                        <span class="status-text">Active Member</span>
                    </div>
                    <div class="member-details">
                        <p><strong>Contribution:</strong> ${UTILS.formatCurrency(ethers.utils.formatEther(memberInfo.contribution))}</p>
                    </div>
                `;
            }

            // Update voting power
            if (votingPowerElement) {
                const credits = Math.floor(Math.sqrt(parseFloat(ethers.utils.formatEther(memberInfo.votingPower)) * 100));
                const powerDisplay = votingPowerElement.querySelector('.power-display');
                if (powerDisplay) {
                    powerDisplay.textContent = credits;
                }
            }

            // Hide join button
            if (joinButton) {
                joinButton.style.display = 'none';
            }
        } else {
            // Show non-member state
            if (memberInfoElement) {
                memberInfoElement.innerHTML = `
                    <p class="status-text">Not a member</p>
                    <p class="text-muted">Join the DAO to participate in governance</p>
                `;
            }

            if (votingPowerElement) {
                const powerDisplay = votingPowerElement.querySelector('.power-display');
                if (powerDisplay) {
                    powerDisplay.textContent = '0';
                }
            }
        }
    }

    /**
     * Update delegation information
     * @param {Object} delegationInfo - Delegation information
     */
    updateDelegationInfo(delegationInfo) {
        const delegationElement = this.elements.get('delegationInfo');
        
        if (delegationElement) {
            const statusElement = delegationElement.querySelector('#delegationStatus');
            if (statusElement) {
                if (delegationInfo.isDelegating) {
                    statusElement.textContent = `Delegated to ${UTILS.formatAddress(delegationInfo.currentDelegate)}`;
                } else {
                    statusElement.textContent = 'No active delegation';
                }
            }
        }
    }

    /**
     * Render proposals list
     * @param {Array} proposals - Array of proposals
     */
    renderProposals(proposals) {
        const proposalsElement = this.elements.get('proposalsList');
        if (!proposalsElement) return;

        if (proposals.length === 0) {
            proposalsElement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox" aria-hidden="true"></i>
                    <h3>No proposals yet</h3>
                    <p>Be the first to create a proposal and start the governance process!</p>
                </div>
            `;
            return;
        }

        const proposalsHTML = proposals.map(proposal => this.renderProposalCard(proposal)).join('');
        proposalsElement.innerHTML = proposalsHTML;

        // Add event listeners to proposal actions
        proposalsElement.querySelectorAll('[data-action="vote"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const proposalId = parseInt(e.target.dataset.proposalId);
                this.showVotingSection(proposalId, proposals);
            });
        });

        proposalsElement.querySelectorAll('[data-action="view"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const proposalId = parseInt(e.target.dataset.proposalId);
                this.viewProposalDetails(proposalId, proposals);
            });
        });
    }

    /**
     * Render individual proposal card
     * @param {Object} proposal - Proposal data
     * @returns {string} HTML string
     */
    renderProposalCard(proposal) {
        const totalVotes = parseInt(proposal.forVotes) + parseInt(proposal.againstVotes);
        const forPercentage = totalVotes > 0 ? (parseInt(proposal.forVotes) / totalVotes * 100).toFixed(1) : 0;
        const againstPercentage = totalVotes > 0 ? (parseInt(proposal.againstVotes) / totalVotes * 100).toFixed(1) : 0;

        return `
            <div class="proposal-card" data-id="${proposal.id}">
                <div class="proposal-header">
                    <div>
                        <h3 class="proposal-title">${this.escapeHtml(proposal.title)}</h3>
                        <span class="proposal-status status-${proposal.status}">${proposal.status}</span>
                    </div>
                </div>
                <p class="proposal-description">${this.escapeHtml(this.truncateText(proposal.description, 200))}</p>
                <div class="proposal-stats">
                    <div class="proposal-stat">
                        <span class="stat-value">${proposal.forVotes}</span>
                        <span class="stat-label">For (${forPercentage}%)</span>
                    </div>
                    <div class="proposal-stat">
                        <span class="stat-value">${proposal.againstVotes}</span>
                        <span class="stat-label">Against (${againstPercentage}%)</span>
                    </div>
                    <div class="proposal-stat">
                        <span class="stat-value">${new Date(proposal.endTime * 1000).toLocaleDateString()}</span>
                        <span class="stat-label">End Date</span>
                    </div>
                </div>
                <div class="proposal-actions">
                    ${proposal.status === 'active' ? `
                        <button class="btn btn-primary" data-action="vote" data-proposal-id="${proposal.id}">
                            <i class="fas fa-vote-yea" aria-hidden="true"></i>
                            Vote
                        </button>
                    ` : ''}
                    <button class="btn btn-outline" data-action="view" data-proposal-id="${proposal.id}">
                        <i class="fas fa-eye" aria-hidden="true"></i>
                        View Details
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Show proposal creation form
     */
    showProposalForm() {
        const form = this.elements.get('proposalCreation');
        if (form) {
            form.style.display = 'block';
            form.scrollIntoView({ behavior: 'smooth' });
            
            // Focus first input
            const titleInput = this.elements.get('proposalTitle');
            if (titleInput) {
                titleInput.focus();
            }
        }
    }

    /**
     * Hide proposal creation form
     */
    hideProposalForm() {
        const form = this.elements.get('proposalCreation');
        if (form) {
            form.style.display = 'none';
            
            // Reset form
            const formElement = this.elements.get('proposalForm');
            if (formElement) {
                formElement.reset();
            }
        }
    }

    /**
     * Show voting section for a proposal
     * @param {number} proposalId - Proposal ID
     * @param {Array} proposals - All proposals
     */
    showVotingSection(proposalId, proposals) {
        const proposal = proposals.find(p => p.id === proposalId);
        if (!proposal) return;

        const votingSection = this.elements.get('votingSection');
        const titleElement = this.elements.get('votingProposalTitle');
        const descriptionElement = this.elements.get('votingProposalDescription');

        if (votingSection) {
            if (titleElement) titleElement.textContent = proposal.title;
            if (descriptionElement) descriptionElement.textContent = proposal.description;
            
            votingSection.style.display = 'block';
            votingSection.dataset.proposalId = proposalId;
            votingSection.scrollIntoView({ behavior: 'smooth' });
            
            // Initialize voting calculations
            this.updateVotingCalculations(1);
        }
    }

    /**
     * Hide voting section
     */
    hideVotingSection() {
        const votingSection = this.elements.get('votingSection');
        if (votingSection) {
            votingSection.style.display = 'none';
            
            // Reset form
            const formElement = this.elements.get('votingForm');
            if (formElement) {
                formElement.reset();
            }
        }
    }

    /**
     * Update voting power calculations
     * @param {number} credits - Credits to spend
     */
    updateVotingCalculations(credits) {
        const creditsDisplay = this.elements.get('creditsDisplay');
        const powerDisplay = this.elements.get('votingPowerCalc');
        const costDisplay = this.elements.get('votingCost');

        if (creditsDisplay) creditsDisplay.textContent = credits;
        if (powerDisplay) powerDisplay.textContent = Math.sqrt(credits).toFixed(2);
        if (costDisplay) costDisplay.textContent = credits * credits;
    }

    /**
     * Show delegation modal
     */
    showDelegationModal() {
        const modal = this.elements.get('delegationModal');
        if (modal) {
            modal.setAttribute('aria-hidden', 'false');
            modal.classList.add('show');
            
            // Focus first input
            const addressInput = this.elements.get('delegateAddress');
            if (addressInput) {
                addressInput.focus();
            }
        }
    }

    /**
     * Hide delegation modal
     */
    hideDelegationModal() {
        const modal = this.elements.get('delegationModal');
        if (modal) {
            modal.setAttribute('aria-hidden', 'true');
            modal.classList.remove('show');
            
            // Reset form
            const formElement = this.elements.get('delegationForm');
            if (formElement) {
                formElement.reset();
            }
        }
    }

    /**
     * Close all modals
     */
    closeModals() {
        this.hideDelegationModal();
        // Add other modals here as needed
    }

    /**
     * Handle proposal form submission
     */
    handleProposalSubmit() {
        const title = this.elements.get('proposalTitle')?.value;
        const description = this.elements.get('proposalDescription')?.value;
        const category = this.elements.get('proposalCategory')?.value;

        this.dispatchEvent(new CustomEvent('ui:proposalCreateRequested', {
            detail: { title, description, category }
        }));
    }

    /**
     * Handle vote form submission
     */
    handleVoteSubmit() {
        const proposalId = parseInt(this.elements.get('votingSection')?.dataset.proposalId);
        const credits = parseInt(this.elements.get('voteCredits')?.value);
        const support = document.querySelector('input[name="voteType"]:checked')?.value === 'for';
        const delegateAddress = this.elements.get('delegateVote')?.checked ? 
            this.elements.get('delegateSelect')?.value : null;

        this.dispatchEvent(new CustomEvent('ui:voteRequested', {
            detail: { proposalId, credits, support, delegateAddress }
        }));
    }

    /**
     * Handle delegation form submission
     */
    handleDelegationSubmit() {
        const delegateAddress = this.elements.get('delegateAddress')?.value;

        this.dispatchEvent(new CustomEvent('ui:delegationRequested', {
            detail: { delegateAddress }
        }));
    }

    /**
     * Handle delegation revocation
     */
    handleDelegationRevoke() {
        this.dispatchEvent(new CustomEvent('ui:delegationRequested', {
            detail: { delegateAddress: null }
        }));
    }

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    showLoading(message = 'Loading...') {
        const overlay = this.elements.get('loadingOverlay');
        const messageElement = this.elements.get('loadingMessage');
        
        if (messageElement) messageElement.textContent = message;
        if (overlay) overlay.style.display = 'flex';
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = this.elements.get('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    /**
     * Show toast notification
     * @param {string} message - Message to show
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds
     */
    showToast(message, type = TOAST_TYPES.INFO, duration = 5000) {
        const container = this.elements.get('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        container.appendChild(toast);

        // Show animation
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, ANIMATION_DURATIONS.NORMAL);
        }, duration);

        this.toasts.push(toast);
    }

    /**
     * Update analytics display
     * @param {Object} analytics - Analytics data
     */
    updateAnalytics(analytics) {
        const elements = {
            totalMembers: this.elements.get('totalMembers'),
            activeProposals: this.elements.get('activeProposals'),
            totalVotes: this.elements.get('totalVotes')
        };

        if (elements.totalMembers) elements.totalMembers.textContent = analytics.totalMembers || 0;
        if (elements.activeProposals) elements.activeProposals.textContent = analytics.activeProposals || 0;
        if (elements.totalVotes) elements.totalVotes.textContent = analytics.totalVotes || 0;
    }

    /**
     * Filter proposals by status
     * @param {string} filter - Filter value
     */
    filterProposals(filter) {
        const proposalCards = document.querySelectorAll('.proposal-card');
        
        proposalCards.forEach(card => {
            const status = card.querySelector('.proposal-status')?.textContent?.toLowerCase();
            const shouldShow = filter === 'all' || status === filter;
            card.style.display = shouldShow ? 'block' : 'none';
        });
    }

    /**
     * View proposal details
     * @param {number} proposalId - Proposal ID
     * @param {Array} proposals - All proposals
     */
    viewProposalDetails(proposalId, proposals) {
        const proposal = proposals.find(p => p.id === proposalId);
        if (proposal) {
            // Could implement a detailed modal or navigate to detail page
            this.showToast(`Viewing details for: ${proposal.title}`, TOAST_TYPES.INFO);
        }
    }

    /**
     * Handle focus management for accessibility
     * @param {Event} e - Focus event
     */
    handleFocusManagement(e) {
        // Ensure focus stays within modals when they're open
        const activeModal = document.querySelector('.modal[aria-hidden="false"]');
        if (activeModal && !activeModal.contains(e.target)) {
            const focusableElements = activeModal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Truncate text to specified length
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @returns {string} Truncated text
     */
    truncateText(text, length) {
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }

    /**
     * Show validation errors
     * @param {Array} errors - Array of error messages
     */
    showValidationErrors(errors) {
        errors.forEach(error => {
            this.showToast(error, TOAST_TYPES.ERROR);
        });
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Clear all toasts
        this.toasts.forEach(toast => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
        this.toasts = [];

        // Clear cached elements
        this.elements.clear();
        this.modals.clear();
    }
}

export default UIManager;