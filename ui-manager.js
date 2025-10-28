// UI Manager - Enhanced Version with Additional Features
// js/services/ui-manager.js
import { UTILS, TOAST_TYPES, ANIMATION_DURATIONS } from '../utils/constants.js';

/**
 * Manages UI state, rendering, and user interactions with improved performance,
 * better error handling, and new features like search, pagination, dark mode,
 * export functionality, and real-time updates.
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
       
        // New features state
        this.currentPage = 1;
        this.proposalsPerPage = 10;
        this.searchQuery = '';
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.favoritedProposals = new Set(JSON.parse(localStorage.getItem('favoritedProposals') || '[]'));
        this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
       
        // Bind methods for event listeners
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleFocusManagement = this.handleFocusManagement.bind(this);
        this.handleOnlineStatusChange = this.handleOnlineStatusChange.bind(this);
        this.handleDarkModeToggle = this.handleDarkModeToggle.bind(this);
    }

    /**
     * Initialize UI manager with error handling and new feature setup
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
            this.applyTheme();
            this.setupOnlineStatusListener();
           
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
     * Cache DOM elements with validation (added new selectors for features)
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
           
            // Proposals list (new: search, pagination, export, favorites)
            proposalsList: '#proposalsList',
            proposalFilter: '#proposalFilter',
            proposalSearch: '#proposalSearch',
            paginationContainer: '#paginationContainer',
            exportProposals: '#exportProposals',
            favoritesToggle: '#favoritesToggle',
           
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
            toastContainer: '#toastContainer',
           
            // New: Theme toggle, confirmation modal
            themeToggle: '#themeToggle',
            confirmationModal: '#confirmationModal',
            confirmationMessage: '#confirmationMessage',
            confirmAction: '#confirmAction',
            cancelConfirm: '#cancelConfirm'
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
       
        const element = document.querySelector(`#${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`) || document.getElementById(key);
        if (element) {
            this.elements.set(key, element);
        }
        return element;
    }

    /**
     * Set up event listeners with cleanup tracking (added new listeners)
     */
    setupEventListeners() {
        // Existing listeners...
        this.addListener('connectWallet', 'click', () => {
            this.dispatchEvent(new CustomEvent('ui:walletConnectRequested'));
        });
        this.addListener('joinDAO', 'click', () => {
            this.dispatchEvent(new CustomEvent('ui:joinDAORequested'));
        });
        this.addListener('createProposal', 'click', () => {
            this.showProposalForm();
        });
        this.addListener('proposalForm', 'submit', (e) => {
            e.preventDefault();
            this.handleProposalSubmit();
        });
        this.addListener('cancelProposal', 'click', () => {
            this.hideProposalForm();
        });
        this.addListener('votingForm', 'submit', (e) => {
            e.preventDefault();
            this.handleVoteSubmit();
        });
        this.addListener('cancelVote', 'click', () => {
            this.hideVotingSection();
        });
        this.addListener('voteCredits', 'input',
            UTILS.debounce((e) => {
                this.updateVotingCalculations(parseInt(e.target.value) || 1);
            }, 100)
        );
        this.addListener('delegateVote', 'change', (e) => {
            this.toggleDelegateSelect(e.target.checked);
        });
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
        this.addListener('proposalFilter', 'change', (e) => {
            this.filterProposals(e.target.value);
        });
       
        // New listeners
        this.addListener('proposalSearch', 'input', this.debouncedSearch);
        this.addListener('exportProposals', 'click', () => this.exportProposalsToCSV());
        this.addListener('favoritesToggle', 'click', () => this.toggleFavoritesFilter());
        this.addListener('themeToggle', 'click', this.handleDarkModeToggle);
       
        // Global event listeners
        document.addEventListener('click', this.handleClickOutside);
        document.addEventListener('keydown', this.handleKeydown);
        document.addEventListener('focusin', this.handleFocusManagement);
        window.addEventListener('online', this.handleOnlineStatusChange);
        window.addEventListener('offline', this.handleOnlineStatusChange);
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
     * Handle keyboard events (enhanced with search focus)
     */
    handleKeydown(e) {
        if (e.key === 'Escape') {
            this.closeModals();
        } else if (e.key === '/' && e.ctrlKey) {
            e.preventDefault();
            const searchInput = this.getElement('proposalSearch');
            if (searchInput) searchInput.focus();
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
     * Set up accessibility features (added theme announcement)
     */
    setupAccessibility() {
        // Existing...
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
                        // New: Load more proposals on scroll
                        if (entry.target.id === 'load-more-trigger') {
                            this.loadMoreProposals();
                        }
                    }
                });
            },
            { threshold: 0.1, rootMargin: '50px' }
        );
    }

    /**
     * Apply theme (new feature: dark mode)
     */
    applyTheme() {
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark-mode');
        } else {
            document.documentElement.classList.remove('dark-mode');
        }
        this.announce(`Theme switched to ${this.isDarkMode ? 'dark' : 'light'} mode`);
    }

    /**
     * Handle dark mode toggle
     */
    handleDarkModeToggle() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        this.applyTheme();
        this.showToast(`Switched to ${this.isDarkMode ? 'dark' : 'light'} mode`, TOAST_TYPES.INFO);
    }

    /**
     * Setup online status listener (new feature: offline detection)
     */
    setupOnlineStatusListener() {
        this.handleOnlineStatusChange(); // Initial check
    }

    /**
     * Handle online/offline status changes
     */
    handleOnlineStatusChange() {
        const isOnline = navigator.onLine;
        const statusElement = document.getElementById('network-status') || this.createNetworkStatusElement();
        statusElement.className = isOnline ? 'online' : 'offline';
        statusElement.textContent = isOnline ? 'Online' : 'Offline';
        if (!isOnline) {
            this.showToast('You are offline. Some features may be limited.', TOAST_TYPES.WARNING);
        }
    }

    /**
     * Create network status element if not exists
     */
    createNetworkStatusElement() {
        const status = document.createElement('div');
        status.id = 'network-status';
        status.className = 'network-status';
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('role', 'status');
        document.body.appendChild(status);
        return status;
    }

    /**
     * Update connection status with improved UI feedback
     */
    updateConnectionStatus(isConnected, address = null) {
        // Existing implementation...
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
        // Existing implementation...
        const memberInfoElement = this.getElement('memberInfo');
        const votingPowerElement = this.getElement('votingPowerDisplay');
        const joinButton = this.getElement('joinDAO');
        if (memberInfo?.isMember) {
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
            if (votingPowerElement) {
                const votingPower = parseFloat(ethers.utils.formatEther(memberInfo.votingPower));
                const credits = Math.floor(Math.sqrt(votingPower * 100));
                const powerDisplay = votingPowerElement.querySelector('.power-display');
               
                if (powerDisplay) {
                    powerDisplay.textContent = credits;
                    powerDisplay.setAttribute('aria-label', `${credits} voting credits available`);
                }
            }
            if (joinButton) {
                joinButton.style.display = 'none';
            }
        } else {
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
        // Existing...
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
     * Render proposals with improved performance using DocumentFragment and pagination
     */
    renderProposals(proposals, page = 1, search = '', filter = 'all') {
        this.currentPage = page;
        this.searchQuery = search;
        const start = (page - 1) * this.proposalsPerPage;
        const end = start + this.proposalsPerPage;
        let filteredProposals = proposals.filter(p => 
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase())
        );
       
        if (filter !== 'all') {
            filteredProposals = filteredProposals.filter(p => p.status === filter);
        }
       
        const paginatedProposals = filteredProposals.slice(start, end);
        const proposalsElement = this.getElement('proposalsList');
        if (!proposalsElement) return;
       
        if (paginatedProposals.length === 0) {
            proposalsElement.innerHTML = `
                <div class="empty-state" role="status">
                    <i class="fas fa-inbox" aria-hidden="true"></i>
                    <h3>No proposals found</h3>
                    <p>${search ? 'Try a different search term.' : 'Be the first to create a proposal!'}</p>
                </div>
            `;
            this.announce('No proposals found');
            this.renderPagination(filteredProposals.length);
            return;
        }
       
        const fragment = document.createDocumentFragment();
       
        paginatedProposals.forEach(proposal => {
            const cardElement = this.createProposalCard(proposal);
            // Add favorite button if favorited
            const actions = cardElement.querySelector('.proposal-actions');
            if (this.favoritedProposals.has(proposal.id)) {
                const favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'btn btn-outline-favorite';
                favoriteBtn.innerHTML = '<i class="fas fa-star" aria-label="Remove from favorites"></i>';
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleFavorite(proposal.id);
                });
                actions.appendChild(favoriteBtn);
            }
            fragment.appendChild(cardElement);
        });
        proposalsElement.innerHTML = '';
        proposalsElement.appendChild(fragment);
        this.setupProposalEventDelegation(proposalsElement, proposals);
       
        this.renderPagination(filteredProposals.length);
        this.announce(`${paginatedProposals.length} proposals loaded (page ${page})`);
    }

    /**
     * Render pagination controls
     */
    renderPagination(total) {
        const container = this.getElement('paginationContainer');
        if (!container) return;
        const totalPages = Math.ceil(total / this.proposalsPerPage);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
       
        let paginationHTML = '<div class="pagination">';
        if (this.currentPage > 1) {
            paginationHTML += `<button class="page-btn" data-page="${this.currentPage - 1}">Previous</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (this.currentPage < totalPages) {
            paginationHTML += `<button class="page-btn" data-page="${this.currentPage + 1}">Next</button>`;
        }
        paginationHTML += '</div>';
        container.innerHTML = paginationHTML;
       
        // Add event listeners
        container.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                this.renderProposals(this.getAllProposals() || [], page, this.searchQuery, this.currentFilter);
            });
        });
    }

    /**
     * Get all proposals (placeholder - integrate with data source)
     */
    getAllProposals() {
        // In real app, fetch from store or API
        return [];
    }

    /**
     * Load more proposals (for infinite scroll)
     */
    loadMoreProposals() {
        if (this.currentPage * this.proposalsPerPage < this.getAllProposals().length) {
            this.currentPage++;
            this.renderProposals(this.getAllProposals(), this.currentPage, this.searchQuery, this.currentFilter);
        }
    }

    /**
     * Create proposal card DOM element (added favorite toggle)
     */
    createProposalCard(proposal) {
        // Existing implementation with minor enhancements...
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
                ${this.favoritedProposals.has(proposal.id) ? '<i class="fas fa-star text-warning" aria-label="Favorited"></i>' : ''}
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
                <button class="btn btn-outline-favorite" data-action="favorite" data-proposal-id="${proposal.id}"
                        aria-label="${this.favoritedProposals.has(proposal.id) ? 'Remove from' : 'Add to'} favorites">
                    <i class="fas ${this.favoritedProposals.has(proposal.id) ? 'fa-star' : 'fa-star-o'}" aria-hidden="true"></i>
                </button>
            </div>
        `;
        return card;
    }

    /**
     * Set up event delegation for proposals (added favorite action)
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
            } else if (action === 'favorite') {
                this.toggleFavorite(proposalId);
            }
        });
    }

    /**
     * Toggle favorite for proposal
     */
    toggleFavorite(proposalId) {
        if (this.favoritedProposals.has(proposalId)) {
            this.favoritedProposals.delete(proposalId);
            this.showToast('Removed from favorites', TOAST_TYPES.INFO);
        } else {
            this.favoritedProposals.add(proposalId);
            this.showToast('Added to favorites', TOAST_TYPES.SUCCESS);
        }
        localStorage.setItem('favoritedProposals', JSON.stringify([...this.favoritedProposals]));
        this.renderProposals(this.getAllProposals(), this.currentPage, this.searchQuery, this.currentFilter);
    }

    /**
     * Toggle favorites filter
     */
    toggleFavoritesFilter() {
        const isShowingFavorites = this.currentFilter === 'favorites';
        this.currentFilter = isShowingFavorites ? 'all' : 'favorites';
        this.renderProposals(this.getAllProposals(), 1, this.searchQuery, this.currentFilter);
    }

    /**
     * Export proposals to CSV (new feature)
     */
    exportProposalsToCSV() {
        const proposals = this.getAllProposals();
        if (proposals.length === 0) {
            this.showToast('No proposals to export', TOAST_TYPES.WARNING);
            return;
        }
       
        let csv = 'ID,Title,Description,Status,For Votes,Against Votes,End Date\n';
        proposals.forEach(p => {
            csv += `${p.id},"${p.title.replace(/"/g, '""')}","${p.description.replace(/"/g, '""')}","${p.status}",${p.forVotes},${p.againstVotes},"${this.formatDate(p.endTime * 1000)}"\n`;
        });
       
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'proposals.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Proposals exported to CSV', TOAST_TYPES.SUCCESS);
    }

    // Existing methods (showProposalForm, hideProposalForm, etc.) remain unchanged...
    showProposalForm() {
        const form = this.getElement('proposalCreation');
        if (!form) return;
        form.style.display = 'block';
        requestAnimationFrame(() => {
            form.classList.add('show');
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
           
            const titleInput = this.getElement('proposalTitle');
            if (titleInput) {
                setTimeout(() => titleInput.focus(), 300);
            }
        });
        this.announce('Proposal creation form opened');
    }

    hideProposalForm() {
        const form = this.getElement('proposalCreation');
        if (!form) return;
        form.classList.remove('show');
        setTimeout(() => {
            form.style.display = 'none';
           
            const formElement = this.getElement('proposalForm');
            if (formElement) {
                formElement.reset();
            }
        }, ANIMATION_DURATIONS.NORMAL);
        this.announce('Proposal creation cancelled');
    }

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
           
            this.updateVotingCalculations(1);
           
            this.announce(`Voting on proposal: ${proposal.title}`);
        }
    }

    hideVotingSection() {
        const votingSection = this.getElement('votingSection');
        if (!votingSection) return;
        votingSection.classList.remove('show');
        setTimeout(() => {
            votingSection.style.display = 'none';
           
            const formElement = this.getElement('votingForm');
            if (formElement) {
                formElement.reset();
            }
        }, ANIMATION_DURATIONS.NORMAL);
        this.announce('Voting cancelled');
    }

    updateVotingCalculations(credits) {
        credits = Math.max(1, Math.min(credits, 1000));
        const creditsDisplay = this.getElement('creditsDisplay');
        const powerDisplay = this.getElement('votingPowerCalc');
        const costDisplay = this.getElement('votingCost');
        if (creditsDisplay) creditsDisplay.textContent = credits;
        if (powerDisplay) powerDisplay.textContent = Math.sqrt(credits).toFixed(2);
        if (costDisplay) costDisplay.textContent = credits * credits;
    }

    toggleDelegateSelect(enabled) {
        const delegateSelect = this.getElement('delegateSelect');
        if (delegateSelect) {
            delegateSelect.disabled = !enabled;
            delegateSelect.setAttribute('aria-disabled', !enabled);
        }
    }

    showDelegationModal() {
        const modal = this.getElement('delegationModal');
        if (!modal) return;
        this.previousFocus = document.activeElement;
        this.activeModal = modal;
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('show');
        modal.style.display = 'block';
       
        requestAnimationFrame(() => {
            const addressInput = this.getElement('delegateAddress');
            if (addressInput) {
                addressInput.focus();
            }
        });
        this.announce('Delegation management opened');
    }

    hideDelegationModal() {
        const modal = this.getElement('delegationModal');
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('show');
       
        setTimeout(() => {
            modal.style.display = 'none';
           
            const formElement = this.getElement('delegationForm');
            if (formElement) {
                formElement.reset();
            }
            if (this.previousFocus) {
                this.previousFocus.focus();
                this.previousFocus = null;
            }
        }, ANIMATION_DURATIONS.NORMAL);
        this.activeModal = null;
        this.announce('Delegation management closed');
    }

    closeModals() {
        this.hideDelegationModal();
        this.hideConfirmationModal();
    }

    handleProposalSubmit() {
        const title = this.getElement('proposalTitle')?.value?.trim();
        const description = this.getElement('proposalDescription')?.value?.trim();
        const category = this.getElement('proposalCategory')?.value;
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

    handleVoteSubmit() {
        const votingSection = this.getElement('votingSection');
        const proposalId = parseInt(votingSection?.dataset.proposalId);
        const credits = parseInt(this.getElement('voteCredits')?.value);
        const voteTypeInput = document.querySelector('input[name="voteType"]:checked');
        const support = voteTypeInput?.value === 'for';
        const isDelegating = this.getElement('delegateVote')?.checked;
        const delegateAddress = isDelegating ?
            this.getElement('delegateSelect')?.value : null;
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

    handleDelegationSubmit() {
        const delegateAddress = this.getElement('delegateAddress')?.value?.trim();
        if (!delegateAddress) {
            this.showToast('Please enter a delegate address', TOAST_TYPES.ERROR);
            return;
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(delegateAddress)) {
            this.showToast('Invalid Ethereum address', TOAST_TYPES.ERROR);
            return;
        }
        this.dispatchEvent(new CustomEvent('ui:delegationRequested', {
            detail: { delegateAddress }
        }));
    }

    handleDelegationRevoke() {
        this.showConfirmation('Are you sure you want to revoke your delegation?', 'Revoke Delegation', () => {
            this.dispatchEvent(new CustomEvent('ui:delegationRequested', {
                detail: { delegateAddress: null }
            }));
        });
    }

    /**
     * Show confirmation modal (new feature)
     */
    showConfirmation(message, title, confirmCallback, cancelCallback = null) {
        const modal = this.getElement('confirmationModal');
        const msgElement = this.getElement('confirmationMessage');
        if (modal && msgElement) {
            msgElement.textContent = message;
            const confirmBtn = this.getElement('confirmAction');
            confirmBtn.textContent = title;
            confirmBtn.onclick = confirmCallback;
           
            const cancelBtn = this.getElement('cancelConfirm');
            cancelBtn.onclick = () => {
                this.hideConfirmationModal();
                if (cancelCallback) cancelCallback();
            };
           
            this.previousFocus = document.activeElement;
            this.activeModal = modal;
            modal.setAttribute('aria-hidden', 'false');
            modal.classList.add('show');
            modal.style.display = 'block';
            confirmBtn.focus();
            this.announce(`Confirmation: ${title}`);
        }
    }

    /**
     * Hide confirmation modal
     */
    hideConfirmationModal() {
        const modal = this.getElement('confirmationModal');
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('show');
       
        setTimeout(() => {
            modal.style.display = 'none';
            if (this.previousFocus) {
                this.previousFocus.focus();
                this.previousFocus = null;
            }
        }, ANIMATION_DURATIONS.NORMAL);
        this.activeModal = null;
    }

    showLoading(message = 'Loading...') {
        const overlay = this.getElement('loadingOverlay');
        const messageElement = this.getElement('loadingMessage');
       
        if (messageElement) messageElement.textContent = message;
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.setAttribute('aria-busy', 'true');
        }
    }

    hideLoading() {
        const overlay = this.getElement('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.setAttribute('aria-busy', 'false');
        }
    }

    showToast(message, type = TOAST_TYPES.INFO, duration = 5000) {
        const container = this.getElement('toastContainer');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }
        const toast = this.createToastElement(message, type);
        container.appendChild(toast);
        this.toasts.add(toast);
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
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
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(timeoutId);
                removeToast();
            });
        }
    }

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

    getToastIcon(type) {
        const icons = {
            [TOAST_TYPES.SUCCESS]: 'fas fa-check-circle',
            [TOAST_TYPES.ERROR]: 'fas fa-exclamation-circle',
            [TOAST_TYPES.WARNING]: 'fas fa-exclamation-triangle',
            [TOAST_TYPES.INFO]: 'fas fa-info-circle'
        };
        return icons[type] || icons[TOAST_TYPES.INFO];
    }

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
     * Filter proposals by status with animation (now tracks current filter)
     */
    filterProposals(filter) {
        this.currentFilter = filter;
        this.renderProposals(this.getAllProposals(), 1, this.searchQuery, filter);
    }

    /**
     * Handle search functionality (implemented)
     */
    handleSearch(e) {
        const query = e.target.value;
        this.renderProposals(this.getAllProposals(), 1, query, this.currentFilter);
    }

    /**
     * Handle scroll events (implemented infinite scroll trigger)
     */
    handleScroll() {
        // Observe load more trigger
        const trigger = document.getElementById('load-more-trigger');
        if (trigger) {
            this.observer.observe(trigger);
        }
        // Scroll to top button logic
        const scrollTopBtn = document.getElementById('scroll-top');
        if (window.scrollY > 300) {
            scrollTopBtn.style.display = 'block';
        } else {
            scrollTopBtn.style.display = 'none';
        }
    }

    viewProposalDetails(proposalId, proposals) {
        const proposal = proposals.find(p => p.id === proposalId);
        if (!proposal) {
            this.showToast('Proposal not found', TOAST_TYPES.ERROR);
            return;
        }
        this.dispatchEvent(new CustomEvent('ui:proposalViewRequested', {
            detail: { proposalId, proposal }
        }));
        this.announce(`Viewing details for: ${proposal.title}`);
    }

    handleFocusManagement(e) {
        if (!this.activeModal) return;
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, length) {
        if (!text || text.length <= length) return text;
        return text.substring(0, length).trim() + '...';
    }

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

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

    showValidationErrors(errors) {
        if (!Array.isArray(errors) || errors.length === 0) return;
        this.showToast(errors[0], TOAST_TYPES.ERROR);
        if (errors.length > 1) {
            console.warn('Validation errors:', errors);
        }
    }

    batchUpdate(updates) {
        requestAnimationFrame(() => {
            updates.forEach(({ element, property, value }) => {
                if (element) {
                    element[property] = value;
                }
            });
        });
    }

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

    getState() {
        return {
            isInitialized: this.isInitialized,
            cachedElements: this.elements.size,
            activeToasts: this.toasts.size,
            activeModal: this.activeModal?.id || null,
            eventListeners: this.eventListeners.size,
            // New state
            currentPage: this.currentPage,
            searchQuery: this.searchQuery,
            isDarkMode: this.isDarkMode,
            favoritedCount: this.favoritedProposals.size
        };
    }

    cleanup() {
        console.log('Cleaning up UI Manager...');
        this.toasts.forEach(toast => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
        this.toasts.clear();
        this.eventListeners.forEach((listeners, key) => {
            const [elementKey, event] = key.split('-');
            listeners.forEach(({ element, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
        });
        this.eventListeners.clear();
        document.removeEventListener('click', this.handleClickOutside);
        document.removeEventListener('keydown', this.handleKeydown);
        document.removeEventListener('focusin', this.handleFocusManagement);
        window.removeEventListener('online', this.handleOnlineStatusChange);
        window.removeEventListener('offline', this.handleOnlineStatusChange);
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.elements.clear();
        this.modals.clear();
        this.isInitialized = false;
        this.activeModal = null;
        this.previousFocus = null;
        console.log('UI Manager cleanup complete');
    }

    async reinit() {
        this.cleanup();
        await this.init();
    }
}

export default UIManager;
