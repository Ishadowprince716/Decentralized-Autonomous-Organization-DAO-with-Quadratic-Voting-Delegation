// UI Manager - Enhanced Version
// js/services/ui-manager.js

import { UTILS, TOAST_TYPES, ANIMATION_DURATIONS } from '../utils/constants.js';

/**
 * Manages UI state, rendering, and user interactions with improved performance
 * and better error handling
 */
export class UIManager extends EventTarget {
    constructor() {
        super();
        
        this.elements = new Map();
        this.modals = new Map();
        this.toasts = new Set();
        this.eventListeners = new Map();
        this.isInitialized = false;
        this.activeModal = null;
        this.previousFocus = null;
        
        // Debounced and throttled functions
        this.debouncedSearch = UTILS.debounce(this.handleSearch.bind(this), 300);
        this.throttledScroll = UTILS.throttle(this.handleScroll.bind(this), 100);
        
        // Bind methods for event listeners
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleFocusManagement = this.handleFocusManagement.bind(this);
    }

    /**
     * Initialize UI manager with error handling
     */
    async init() {
        if (this.isInitialized) {
            console.warn('UI Manager already initialized');
            return;
        }

        try {
            this.cacheElements();
            this.setupEventListeners();
            this.setupAccessibility();
            this.setupIntersectionObserver();
            
            this.isInitialized = true;
            this.dispatchEvent(new CustomEvent('ui:initialized'));
            console.log('UI Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize UI manager:', error);
            this.showToast('Failed to initialize interface', TOAST_TYPES.ERROR);
            throw error;
        }
    }

    /**
     * Cache DOM elements with validation
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
            cancelProposal: '#cancelProposal',
            
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
            cancelVote: '#cancelVote',
            
            // Delegation modal
            delegationModal: '#delegationModal',
            delegationForm: '#delegationForm',
            delegateAddress: '#delegateAddress',
            currentDelegate: '#currentDelegate',
            manageDelegation: '#manageDelegation',
            revokeDelegate: '#revokeDelegate',
            
            // Loading and notifications
            loadingOverlay: '#loadingOverlay',
            loadingMessage: '#loadingMessage',
            toastContainer: '#toastContainer'
        };

        let missingElements = [];

        for (const [key, selector] of Object.entries(selectors)) {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(key, element);
            } else {
                missingElements.push(selector);
            }
        }

        if (missingElements.length > 0) {
            console.warn('Missing UI elements:', missingElements);
        }
    }

    /**
     * Get element safely with fallback
     */
    getElement(key) {
        if (this.elements.has(key)) {
            return this.elements.get(key);
        }
        
        const element = document.getElementById(key);
        if (element) {
            this.elements.set(key, element);
        }
        return element;
    }

    /**
     * Set up event listeners with cleanup tracking
     */
    setupEventListeners() {
        // Wallet connection
        this.addListener('connectWallet', 'click', () => {
            this.dispatchEvent(new CustomEvent('ui:walletConnectRequested'));
        });

        // DAO actions
        this.addListener('joinDAO', 'click', () => {
            this.dispatchEvent(new CustomEvent('ui:joinDAORequested'));
        });

        this.addListener('createProposal', 'click', () => {
            this.showProposalForm();
        });

        // Proposal form
        this.addListener('proposalForm', 'submit', (e) => {
            e.preventDefault();
            this.handleProposalSubmit();
        });

        this.addListener('cancelProposal', 'click', () => {
            this.hideProposalForm();
        });

        // Voting form
        this.addListener('votingForm', 'submit', (e) => {
            e.preventDefault();
            this.handleVoteSubmit();
        });

        this.addListener('cancelVote', 'click', () => {
            this.hideVotingSection();
        });

        // Credits slider with debounce
        this.addListener('voteCredits', 'input', 
            UTILS.debounce((e) => {
                this.updateVotingCalculations(parseInt(e.target.value) || 1);
            }, 100)
        );

        // Delegation checkbox
        this.addListener('delegateVote', 'change', (e) => {
            this.toggleDelegateSelect(e.target.checked);
        });

        // Delegation modal
        this.addListener('manageDelegation', 'click', () => {
            this.showDelegationModal();
        });

        this.addListener('delegationForm', 'submit', (e) => {
            e.preventDefault();
            this.handleDelegationSubmit();
        });

        this.addListener('revokeDelegate', 'click', () => {
            this.handleDelegationRevoke();
        });

        // Proposal filter
        this.addListener('proposalFilter', 'change', (e) => {
            this.filterProposals(e.target.value);
        });

        // Global event listeners
        document.addEventListener('click', this.handleClickOutside);
        document.addEventListener('keydown', this.handleKeydown);
        document.addEventListener('focusin', this.handleFocusManagement);
    }

    /**
     * Add event listener with cleanup tracking
     */
    addListener(elementKey, event, handler, options = {}) {
        const element = this.getElement(elementKey);
        if (!element) return;

        element.addEventListener(event, handler, options);
        
        const key = `${elementKey}-${event}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }
        this.eventListeners.get(key).push({ element, handler, options });
    }

    /**
     * Handle keyboard events
     */
    handleKeydown(e) {
        if (e.key === 'Escape') {
            this.closeModals();
        }
    }

    /**
     * Handle clicks outside modals
     */
    handleClickOutside(e) {
        if (e.target.matches('[data-close-modal]') || 
            e.target.closest('[data-close-modal]') ||
            e.target.classList.contains('modal')) {
            this.closeModals();
        }
    }

    /**
     * Set up accessibility features
     */
    setupAccessibility() {
        // Skip link functionality
        const skipLink = document.querySelector('.skip-nav');
        if (skipLink) {
            skipLink.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector('#main-content');
                if (target) {
                    target.setAttribute('tabindex', '-1');
                    target.focus();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }

        // Add live region for dynamic content
        this.setupLiveRegion();
    }

    /**
     * Set up ARIA live region for announcements
     */
    setupLiveRegion() {
        if (!document.getElementById('aria-live-region')) {
            const liveRegion = document.createElement('div');
            liveRegion.id = 'aria-live-region';
            liveRegion.setAttribute('role', 'status');
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }
    }

    /**
     * Announce to screen readers
     */
    announce(message) {
        const liveRegion = document.getElementById('aria-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }

    /**
     * Set up Intersection Observer for lazy loading
     */
    setupIntersectionObserver() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            },
            { threshold: 0.1, rootMargin: '50px' }
        );
    }

    /**
     * Update connection status with improved UI feedback
     */
    updateConnectionStatus(isConnected, address = null) {
        const connectButton = this.getElement('connectWallet');
        const joinButton = this.getElement('joinDAO');
        const createButton = this.getElement('createProposal');

        if (connectButton) {
            if (isConnected && address) {
                connectButton.innerHTML = `
                    <i class="fas fa-check-circle" aria-hidden="true"></i>
                    <span>${UTILS.formatAddress(address)}</span>
                `;
                connectButton.classList.add('btn-success');
                connectButton.classList.remove('btn-primary');
                connectButton.disabled = true;
                connectButton.setAttribute('aria-label', `Wallet connected: ${UTILS.formatAddress(address)}`);
                
                this.announce('Wallet connected successfully');
            } else {
                connectButton.innerHTML = `
                    <i class="fas fa-wallet" aria-hidden="true"></i>
                    <span>Connect Wallet</span>
                `;
                connectButton.classList.remove('btn-success');
                connectButton.classList.add('btn-primary');
                connectButton.disabled = false;
                connectButton.setAttribute('aria-label', 'Connect your wallet');
            }
        }

        // Update dependent buttons
        const buttonsToUpdate = [
            { element: joinButton, label: 'Join DAO' },
            { element: createButton, label: 'Create Proposal' }
        ];

        buttonsToUpdate.forEach(({ element, label }) => {
            if (element) {
                element.disabled = !isConnected;
                element.setAttribute('aria-disabled', !isConnected);
                if (!isConnected) {
                    element.title = 'Connect wallet first';
                } else {
                    element.title = label;
                }
            }
        });
    }

    /**
     * Update member information with enhanced display
     */
    updateMemberInfo(memberInfo) {
        const memberInfoElement = this.getElement('memberInfo');
        const votingPowerElement = this.getElement('votingPowerDisplay');
        const joinButton = this.getElement('joinDAO');

        if (memberInfo?.isMember) {
            // Update member info with proper formatting
            if (memberInfoElement) {
                const contribution = ethers.utils.formatEther(memberInfo.contribution);
                memberInfoElement.innerHTML = `
                    <div class="member-status" role="status">
                        <i class="fas fa-check-circle text-success" aria-hidden="true"></i>
                        <span class="status-text">Active Member</span>
                    </div>
                    <div class="member-details">
                        <p><strong>Contribution:</strong> ${UTILS.formatCurrency(contribution)}</p>
                    </div>
                `;
                this.announce('You are an active member');
            }

            // Update voting power display
            if (votingPowerElement) {
                const votingPower = parseFloat(ethers.utils.formatEther(memberInfo.votingPower));
                const credits = Math.floor(Math.sqrt(votingPower * 100));
                const powerDisplay = votingPowerElement.querySelector('.power-display');
                
                if (powerDisplay) {
                    powerDisplay.textContent = credits;
                    powerDisplay.setAttribute('aria-label', `${credits} voting credits available`);
                }
            }

            // Hide join button with animation
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
                    powerDisplay.setAttribute('aria-label', 'No voting credits');
                }
            }

            if (joinButton) {
                joinButton.style.display = '';
            }
        }
    }

    /**
     * Update delegation information with better formatting
     */
    updateDelegationInfo(delegationInfo) {
        const delegationElement = this.getElement('delegationInfo');
        
        if (delegationElement) {
            const statusElement = delegationElement.querySelector('#delegationStatus');
            if (statusElement) {
                if (delegationInfo?.isDelegating && delegationInfo.currentDelegate) {
                    const formattedAddress = UTILS.formatAddress(delegationInfo.currentDelegate);
                    statusElement.innerHTML = `
                        <i class="fas fa-user-check" aria-hidden="true"></i>
                        Delegated to <strong>${formattedAddress}</strong>
                    `;
                    statusElement.setAttribute('aria-label', `Votes delegated to ${formattedAddress}`);
                } else {
                    statusElement.innerHTML = `
                        <i class="fas fa-user-slash" aria-hidden="true"></i>
                        No active delegation
                    `;
                    statusElement.setAttribute('aria-label', 'No active delegation');
                }
            }
        }
    }

    /**
     * Render proposals with improved performance using DocumentFragment
     */
    renderProposals(proposals) {
        const proposalsElement = this.getElement('proposalsList');
        if (!proposalsElement) return;

        if (!proposals || proposals.length === 0) {
            proposalsElement.innerHTML = `
                <div class="empty-state" role="status">
                    <i class="fas fa-inbox" aria-hidden="true"></i>
                    <h3>No proposals yet</h3>
                    <p>Be the first to create a proposal and start the governance process!</p>
                </div>
            `;
            this.announce('No proposals found');
            return;
        }

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        proposals.forEach(proposal => {
            const cardElement = this.createProposalCard(proposal);
            fragment.appendChild(cardElement);
        });

        proposalsElement.innerHTML = '';
        proposalsElement.appendChild(fragment);

        // Use event delegation instead of individual listeners
        this.setupProposalEventDelegation(proposalsElement, proposals);
        
        this.announce(`${proposals.length} proposals loaded`);
    }

    /**
     * Create proposal card DOM element
     */
    createProposalCard(proposal) {
        const card = document.createElement('div');
        card.className = 'proposal-card';
        card.dataset.id = proposal.id;
        card.setAttribute('role', 'article');
        card.setAttribute('aria-label', `Proposal: ${proposal.title}`);

        const totalVotes = parseInt(proposal.forVotes) + parseInt(proposal.againstVotes);
        const forPercentage = totalVotes > 0 ? 
            (parseInt(proposal.forVotes) / totalVotes * 100).toFixed(1) : 0;
        const againstPercentage = totalVotes > 0 ? 
            (parseInt(proposal.againstVotes) / totalVotes * 100).toFixed(1) : 0;

        card.innerHTML = `
            <div class="proposal-header">
                <div>
                    <h3 class="proposal-title">${this.escapeHtml(proposal.title)}</h3>
                    <span class="proposal-status status-${proposal.status}" role="status">
                        ${this.capitalizeFirst(proposal.status)}
                    </span>
                </div>
            </div>
            <p class="proposal-description">${this.escapeHtml(this.truncateText(proposal.description, 200))}</p>
            <div class="proposal-stats" role="group" aria-label="Proposal statistics">
                <div class="proposal-stat">
                    <span class="stat-value">${proposal.forVotes}</span>
                    <span class="stat-label">For (${forPercentage}%)</span>
                </div>
                <div class="proposal-stat">
                    <span class="stat-value">${proposal.againstVotes}</span>
                    <span class="stat-label">Against (${againstPercentage}%)</span>
                </div>
                <div class="proposal-stat">
                    <span class="stat-value">${this.formatDate(proposal.endTime * 1000)}</span>
                    <span class="stat-label">End Date</span>
                </div>
            </div>
            <div class="proposal-actions">
                ${proposal.status === 'active' ? `
                    <button class="btn btn-primary" data-action="vote" data-proposal-id="${proposal.id}"
                            aria-label="Vote on ${this.escapeHtml(proposal.title)}">
                        <i class="fas fa-vote-yea" aria-hidden="true"></i>
                        Vote
                    </button>
                ` : ''}
                <button class="btn btn-outline" data-action="view" data-proposal-id="${proposal.id}"
                        aria-label="View details of ${this.escapeHtml(proposal.title)}">
                    <i class="fas fa-eye" aria-hidden="true"></i>
                    View Details
                </button>
            </div>
        `;

        return card;
    }

    /**
     * Set up event delegation for proposals
     */
    setupProposalEventDelegation(container, proposals) {
        container.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const proposalId = parseInt(button.dataset.proposalId);

            if (action === 'vote') {
                this.showVotingSection(proposalId, proposals);
            } else if (action === 'view') {
                this.viewProposalDetails(proposalId, proposals);
            }
        });
    }

    /**
     * Show proposal creation form with animation
     */
    showProposalForm() {
        const form = this.getElement('proposalCreation');
        if (!form) return;

        form.style.display = 'block';
        requestAnimationFrame(() => {
            form.classList.add('show');
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Focus first input
            const titleInput = this.getElement('proposalTitle');
            if (titleInput) {
                setTimeout(() => titleInput.focus(), 300);
            }
        });

        this.announce('Proposal creation form opened');
    }

    /**
     * Hide proposal creation form
     */
    hideProposalForm() {
        const form = this.getElement('proposalCreation');
        if (!form) return;

        form.classList.remove('show');
        setTimeout(() => {
            form.style.display = 'none';
            
            // Reset form
            const formElement = this.getElement('proposalForm');
            if (formElement) {
                formElement.reset();
            }
        }, ANIMATION_DURATIONS.NORMAL);

        this.announce('Proposal creation cancelled');
    }

    /**
     * Show voting section with validation
     */
    showVotingSection(proposalId, proposals) {
        const proposal = proposals.find(p => p.id === proposalId);
        if (!proposal) {
            this.showToast('Proposal not found', TOAST_TYPES.ERROR);
            return;
        }

        const votingSection = this.getElement('votingSection');
        const titleElement = this.getElement('votingProposalTitle');
        const descriptionElement = this.getElement('votingProposalDescription');

        if (votingSection) {
            if (titleElement) titleElement.textContent = proposal.title;
            if (descriptionElement) descriptionElement.textContent = proposal.description;
            
            votingSection.style.display = 'block';
            votingSection.dataset.proposalId = proposalId;
            
            requestAnimationFrame(() => {
                votingSection.classList.add('show');
                votingSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            
            // Initialize voting calculations
            this.updateVotingCalculations(1);
            
            this.announce(`Voting on proposal: ${proposal.title}`);
        }
    }

    /**
     * Hide voting section
     */
    hideVotingSection() {
        const votingSection = this.getElement('votingSection');
        if (!votingSection) return;

        votingSection.classList.remove('show');
        setTimeout(() => {
            votingSection.style.display = 'none';
            
            // Reset form
            const formElement = this.getElement('votingForm');
            if (formElement) {
                formElement.reset();
            }
        }, ANIMATION_DURATIONS.NORMAL);

        this.announce('Voting cancelled');
    }

    /**
     * Update voting power calculations with validation
     */
    updateVotingCalculations(credits) {
        credits = Math.max(1, Math.min(credits, 1000)); // Clamp between 1-1000

        const creditsDisplay = this.getElement('creditsDisplay');
        const powerDisplay = this.getElement('votingPowerCalc');
        const costDisplay = this.getElement('votingCost');

        if (creditsDisplay) creditsDisplay.textContent = credits;
        if (powerDisplay) powerDisplay.textContent = Math.sqrt(credits).toFixed(2);
        if (costDisplay) costDisplay.textContent = credits * credits;
    }

    /**
     * Toggle delegate select dropdown
     */
    toggleDelegateSelect(enabled) {
        const delegateSelect = this.getElement('delegateSelect');
        if (delegateSelect) {
            delegateSelect.disabled = !enabled;
            delegateSelect.setAttribute('aria-disabled', !enabled);
        }
    }

    /**
     * Show delegation modal with focus trap
     */
    showDelegationModal() {
        const modal = this.getElement('delegationModal');
        if (!modal) return;

        this.previousFocus = document.activeElement;
        this.activeModal = modal;

        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('show');
        modal.style.display = 'block';
        
        // Focus first input
        requestAnimationFrame(() => {
            const addressInput = this.getElement('delegateAddress');
            if (addressInput) {
                addressInput.focus();
            }
        });

        this.announce('Delegation management opened');
    }

    /**
     * Hide delegation modal
     */
    hideDelegationModal() {
        const modal = this.getElement('delegationModal');
        if (!modal) return;

        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
            
            // Reset form
            const formElement = this.getElement('delegationForm');
            if (formElement) {
                formElement.reset();
            }

            // Restore focus
            if (this.previousFocus) {
                this.previousFocus.focus();
                this.previousFocus = null;
            }
        }, ANIMATION_DURATIONS.NORMAL);

        this.activeModal = null;
        this.announce('Delegation management closed');
    }

    /**
     * Close all modals
     */
    closeModals() {
        this.hideDelegationModal();
        // Add other modals here as needed
    }

    /**
     * Handle proposal form submission with validation
     */
    handleProposalSubmit() {
        const title = this.getElement('proposalTitle')?.value?.trim();
        const description = this.getElement('proposalDescription')?.value?.trim();
        const category = this.getElement('proposalCategory')?.value;

        // Validation
        const errors = [];
        if (!title || title.length < 10) {
            errors.push('Title must be at least 10 characters');
        }
        if (!description || description.length < 50) {
            errors.push('Description must be at least 50 characters');
        }
        if (!category) {
            errors.push('Please select a category');
        }

        if (errors.length > 0) {
            this.showValidationErrors(errors);
            return;
        }

        this.dispatchEvent(new CustomEvent('ui:proposalCreateRequested', {
            detail: { title, description, category }
        }));
    }

    /**
     * Handle vote form submission with validation
     */
    handleVoteSubmit() {
        const votingSection = this.getElement('votingSection');
        const proposalId = parseInt(votingSection?.dataset.proposalId);
        const credits = parseInt(this.getElement('voteCredits')?.value);
        const voteTypeInput = document.querySelector('input[name="voteType"]:checked');
        const support = voteTypeInput?.value === 'for';
        const isDelegating = this.getElement('delegateVote')?.checked;
        const delegateAddress = isDelegating ? 
            this.getElement('delegateSelect')?.value : null;

        // Validation
        if (!proposalId) {
            this.showToast('Invalid proposal', TOAST_TYPES.ERROR);
            return;
        }
        if (!voteTypeInput) {
            this.showToast('Please select for or against', TOAST_TYPES.ERROR);
            return;
        }
        if (!credits || credits < 1) {
            this.showToast('Please allocate at least 1 credit', TOAST_TYPES.ERROR);
            return;
        }

        this.dispatchEvent(new CustomEvent('ui:voteRequested', {
            detail: { proposalId, credits, support, delegateAddress }
        }));
    }

    /**
     * Handle delegation form submission with validation
     */
    handleDelegationSubmit() {
        const delegateAddress = this.getElement('delegateAddress')?.value?.trim();

        if (!delegateAddress) {
            this.showToast('Please enter a delegate address', TOAST_TYPES.ERROR);
            return;
        }

        // Basic Ethereum address validation
        if (!/^0x[a-fA-F0-9]{40}$/.test(delegateAddress)) {
            this.showToast('Invalid Ethereum address', TOAST_TYPES.ERROR);
            return;
        }

        this.dispatchEvent(new CustomEvent('ui:delegationRequested', {
            detail: { delegateAddress }
        }));
    }

    /**
     * Handle delegation revocation with confirmation
     */
    handleDelegationRevoke() {
        if (confirm('Are you sure you want to revoke your delegation?')) {
            this.dispatchEvent(new CustomEvent('ui:delegationRequested', {
                detail: { delegateAddress: null }
            }));
        }
    }

    /**
     * Show loading overlay with optional message
     */
    showLoading(message = 'Loading...') {
        const overlay = this.getElement('loadingOverlay');
        const messageElement = this.getElement('loadingMessage');
        
        if (messageElement) messageElement.textContent = message;
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.setAttribute('aria-busy', 'true');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = this.getElement('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * Show toast notification with better UX
     */
    showToast(message, type = TOAST_TYPES.INFO, duration = 5000) {
        const container = this.getElement('toastContainer');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }

        const toast = this.createToastElement(message, type);
        container.appendChild(toast);
        this.toasts.add(toast);

        // Show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto remove
        const removeToast = () => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                    this.toasts.delete(toast);
                }
            }, ANIMATION_DURATIONS.NORMAL);
        };

        const timeoutId = setTimeout(removeToast, duration);

        // Allow manual dismissal
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(timeoutId);
                removeToast();
            });
        }
    }

    /**
     * Create toast element
     */
    createToastElement(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');

        const icon = this.getToastIcon(type);
        
        toast.innerHTML = `
            <div class="toast-content">
                <i class="${icon}" aria-hidden="true"></i>
                <span class="toast-message">${this.escapeHtml(message)}</span>
            </div>
            <button class="toast-close" aria-label="Close notification">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        `;

        return toast;
    }

    /**
     * Get appropriate icon for toast type
     */
    getToastIcon(type) {
        const icons = {
            [TOAST_TYPES.SUCCESS]: 'fas fa-check-circle',
            [TOAST_TYPES.ERROR]: 'fas fa-exclamation-circle',
            [TOAST_TYPES.WARNING]: 'fas fa-exclamation-triangle',
            [TOAST_TYPES.INFO]: 'fas fa-info-circle'
        };
        return icons[type] || icons[TOAST_TYPES.INFO];
    }

    /**
     * Update analytics display with animation
     */
    updateAnalytics(analytics) {
        const updates = [
            { key: 'totalMembers', value: analytics?.totalMembers || 0, label: 'members' },
            { key: 'activeProposals', value: analytics?.activeProposals || 0, label: 'proposals' },
            { key: 'totalVotes', value: analytics?.totalVotes || 0, label: 'votes' }
        ];

        updates.forEach(({ key, value, label }) => {
            const element = this.getElement(key);
            if (element) {
                this.animateValue(element, parseInt(element.textContent) || 0, value, 1000);
                element.setAttribute('aria-label', `${value} ${label}`);
            }
        });
    }

    /**
     * Animate number transitions
     */
    animateValue(element, start, end, duration) {
        if (start === end) return;

        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = Math.round(current);
        }, 16);
    }

    /**
     * Filter proposals by status with animation
     */
    filterProposals(filter) {
        const proposalCards = document.querySelectorAll('.proposal-card');
        let visibleCount = 0;
        
        proposalCards.forEach(card => {
            const status = card.querySelector('.proposal-status')?.textContent?.toLowerCase()?.trim();
            const shouldShow = filter === 'all' || status === filter;
            
            if (shouldShow) {
                card.style.display = 'block';
                requestAnimationFrame(() => card.classList.add('visible'));
                visibleCount++;
            } else {
                card.classList.remove('visible');
                setTimeout(() => {
                    card.style.display = 'none';
                }, ANIMATION_DURATIONS.FAST);
            }
        });

        this.announce(`Showing ${visibleCount} ${filter === 'all' ? 'proposals' : filter + ' proposals'}`);
    }

    /**
     * View proposal details with modal or navigation
     */
    viewProposalDetails(proposalId, proposals) {
        const proposal = proposals.find(p => p.id === proposalId);
        if (!proposal) {
            this.showToast('Proposal not found', TOAST_TYPES.ERROR);
            return;
        }

        // Dispatch event for parent to handle
        this.dispatchEvent(new CustomEvent('ui:proposalViewRequested', {
            detail: { proposalId, proposal }
        }));

        this.announce(`Viewing details for: ${proposal.title}`);
    }

    /**
     * Handle focus management for accessibility
     */
    handleFocusManagement(e) {
        if (!this.activeModal) return;

        // Ensure focus stays within active modal
        if (!this.activeModal.contains(e.target)) {
            e.preventDefault();
            const focusableElements = this.activeModal.querySelectorAll(
                'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
            );
            
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }
    }

    /**
     * Handle search functionality (placeholder for future implementation)
     */
    handleSearch(query) {
        // To be implemented
        console.log('Search query:', query);
    }

    /**
     * Handle scroll events (placeholder for future implementation)
     */
    handleScroll(e) {
        // To be implemented - could add scroll-to-top button, lazy loading, etc.
    }

    /**
     * Escape HTML to prevent XSS attacks
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Truncate text to specified length
     */
    truncateText(text, length) {
        if (!text || text.length <= length) return text;
        return text.substring(0, length).trim() + '...';
    }

    /**
     * Capitalize first letter of string
     */
    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Format date in a user-friendly way
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return 'Ended';
        } else if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Tomorrow';
        } else if (diffDays < 7) {
            return `${diffDays} days`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Show validation errors in a user-friendly way
     */
    showValidationErrors(errors) {
        if (!Array.isArray(errors) || errors.length === 0) return;

        // Show first error as toast
        this.showToast(errors[0], TOAST_TYPES.ERROR);

        // Log all errors for debugging
        if (errors.length > 1) {
            console.warn('Validation errors:', errors);
        }
    }

    /**
     * Batch update multiple UI elements
     */
    batchUpdate(updates) {
        requestAnimationFrame(() => {
            updates.forEach(({ element, property, value }) => {
                if (element) {
                    element[property] = value;
                }
            });
        });
    }

    /**
     * Check if element is visible in viewport
     */
    isInViewport(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Smooth scroll to element
     */
    scrollToElement(elementOrSelector, options = {}) {
        const element = typeof elementOrSelector === 'string' 
            ? document.querySelector(elementOrSelector)
            : elementOrSelector;

        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                ...options
            });
        }
    }

    /**
     * Get current state for debugging
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            cachedElements: this.elements.size,
            activeToasts: this.toasts.size,
            activeModal: this.activeModal?.id || null,
            eventListeners: this.eventListeners.size
        };
    }

    /**
     * Clean up all resources and event listeners
     */
    cleanup() {
        console.log('Cleaning up UI Manager...');

        // Clear all toasts
        this.toasts.forEach(toast => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
        this.toasts.clear();

        // Remove all event listeners
        this.eventListeners.forEach((listeners, key) => {
            listeners.forEach(({ element, handler, options }) => {
                element.removeEventListener(key.split('-')[1], handler, options);
            });
        });
        this.eventListeners.clear();

        // Remove global event listeners
        document.removeEventListener('click', this.handleClickOutside);
        document.removeEventListener('keydown', this.handleKeydown);
        document.removeEventListener('focusin', this.handleFocusManagement);

        // Disconnect observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Clear cached elements
        this.elements.clear();
        this.modals.clear();

        // Reset state
        this.isInitialized = false;
        this.activeModal = null;
        this.previousFocus = null;

        console.log('UI Manager cleanup complete');
    }

    /**
     * Reinitialize the UI Manager
     */
    async reinit() {
        this.cleanup();
        await this.init();
    }
}

export default UIManager;
