// DAO Frontend JavaScript Application

class DAOApp {
    constructor() {
        this.state = {
            account: '',
            isConnected: false,
            memberInfo: null,
            proposals: [],
            activeTab: 'dashboard',
            loading: false,
            contractData: {
                memberCount: 24,
                totalProposals: 8,
                treasuryBalance: 15.67,
                activeProposals: 3
            }
        };

        this.mockProposals = [
            {
                id: 1,
                title: "Upgrade Treasury Management System",
                description: "Implement automated treasury rebalancing with DeFi integration",
                proposer: "0x1234...5678",
                recipient: "0xabcd...ef01",
                amount: 5.5,
                forVotes: 45,
                againstVotes: 12,
                state: "Active",
                endTime: Date.now() + 5 * 24 * 60 * 60 * 1000,
                hasVoted: false
            },
            {
                id: 2,
                title: "Community Development Fund",
                description: "Allocate funds for developer grants and community initiatives",
                proposer: "0x2345...6789",
                recipient: "0xbcde...f012",
                amount: 10.0,
                forVotes: 78,
                againstVotes: 5,
                state: "Succeeded",
                endTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
                hasVoted: true
            },
            {
                id: 3,
                title: "Marketing Campaign Budget",
                description: "Fund Q4 marketing initiatives and partnerships",
                proposer: "0x3456...789a",
                recipient: "0xcdef...0123",
                amount: 3.2,
                forVotes: 23,
                againstVotes: 34,
                state: "Defeated",
                endTime: Date.now() - 1 * 24 * 60 * 60 * 1000,
                hasVoted: true
            }
        ];

        this.init();
    }

    init() {
        this.state.proposals = [...this.mockProposals];
        this.bindEvents();
        this.updateUI();
    }

    bindEvents() {
        // Wallet connection
        document.getElementById('connect-wallet-btn').addEventListener('click', () => this.connectWallet());
        
        // Join DAO
        const joinBtn = document.getElementById('join-dao-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.joinDAO());
        }

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.id.replace('tab-', '');
                this.switchTab(tabId);
            });
        });

        // Create proposal button
        document.getElementById('create-proposal-btn').addEventListener('click', () => {
            this.switchTab('create');
        });

        // Proposal form
        document.getElementById('proposal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createProposal();
        });

        document.getElementById('cancel-proposal').addEventListener('click', () => {
            this.switchTab('proposals');
        });

        // Delegation
        document.getElementById('delegate-btn').addEventListener('click', () => this.delegateVoting());
        
        const revokeBtn = document.getElementById('revoke-btn');
        if (revokeBtn) {
            revokeBtn.addEventListener('click', () => this.revokeDelegation());
        }
    }

    async connectWallet() {
        this.setLoading(true);
        this.showNotification('Connecting wallet...', 'info');

        try {
            // Simulate wallet connection
            await this.delay(1500);
            
            this.state.account = '0x1234567890123456789012345678901234567890';
            this.state.isConnected = true;
            this.state.memberInfo = {
                isMember: true,
                votingPower: 12,
                delegatedPower: 5,
                delegate: '',
                joinedAt: Date.now() - 30 * 24 * 60 * 60 * 1000
            };

            this.showNotification('Wallet connected successfully!', 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to connect wallet', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async joinDAO() {
        this.setLoading(true);
        this.showNotification('Joining DAO...', 'info');

        try {
            await this.delay(2000);
            
            this.state.memberInfo = {
                isMember: true,
                votingPower: 5,
                delegatedPower: 0,
                delegate: '',
                joinedAt: Date.now()
            };

            this.state.contractData.memberCount += 1;
            this.showNotification('Successfully joined the DAO!', 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to join DAO', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async createProposal() {
        this.setLoading(true);
        this.showNotification('Creating proposal...', 'info');

        try {
            await this.delay(2000);

            const form = document.getElementById('proposal-form');
            const formData = new FormData(form);
            
            const title = document.getElementById('proposal-title').value;
            const description = document.getElementById('proposal-description').value;
            const recipient = document.getElementById('proposal-recipient').value;
            const amount = document.getElementById('proposal-amount').value;

            const newProposal = {
                id: this.state.proposals.length + 1,
                title: title,
                description: description,
                proposer: this.state.account,
                recipient: recipient,
                amount: parseFloat(amount || 0),
                forVotes: 0,
                againstVotes: 0,
                state: "Active",
                endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
                hasVoted: false
            };

            this.state.proposals.unshift(newProposal);
            this.state.contractData.totalProposals += 1;
            this.state.contractData.activeProposals += 1;

            // Clear form
            form.reset();

            this.showNotification('Proposal created successfully!', 'success');
            this.switchTab('proposals');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to create proposal', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async castVote(proposalId, support, credits) {
        this.setLoading(true);
        const supportText = support ? 'support' : 'opposition';
        this.showNotification(`Casting ${credits} credits for ${supportText}...`, 'info');

        try {
            await this.delay(1500);

            this.state.proposals = this.state.proposals.map(p => {
                if (p.id === proposalId) {
                    return {
                        ...p,
                        forVotes: support ? p.forVotes + credits : p.forVotes,
                        againstVotes: !support ? p.againstVotes + credits : p.againstVotes,
                        hasVoted: true
                    };
                }
                return p;
            });

            this.showNotification(`Vote cast successfully! ${credits} credits for ${supportText}`, 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to cast vote', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async executeProposal(proposalId) {
        const proposal = this.state.proposals.find(p => p.id === proposalId);
        if (!proposal || proposal.state !== 'Succeeded') {
            this.showNotification('This proposal cannot be executed.', 'error');
            return;
        }

        this.setLoading(true);
        this.showNotification('Executing proposal...', 'info');

        try {
            await this.delay(2000); // Simulate transaction

            // Update treasury and proposal state
            this.state.contractData.treasuryBalance -= proposal.amount;
            this.state.proposals = this.state.proposals.map(p =>
                p.id === proposalId ? { ...p, state: 'Executed' } : p
            );

            this.state.contractData.activeProposals -= 1;

            this.showNotification('Proposal executed successfully! Funds transferred.', 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to execute proposal', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async delegateVoting() {
        const delegateAddress = document.getElementById('delegate-input').value;
        if (!delegateAddress) {
            this.showNotification('Please enter a delegate address', 'error');
            return;
        }

        this.setLoading(true);
        this.showNotification('Delegating voting power...', 'info');

        try {
            await this.delay(1500);
            
            this.state.memberInfo.delegate = delegateAddress;
            document.getElementById('delegate-input').value = '';
            
            this.showNotification('Voting power delegated successfully!', 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to delegate voting power', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    revokeDelegation() {
        this.state.memberInfo.delegate = '';
        this.showNotification('Delegation revoked successfully!', 'success');
        this.updateUI();
    }

    switchTab(tabName) {
        this.state.activeTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            btn.classList.add('text-gray-600', 'hover:bg-gray-50');
        });

        const activeBtn = document.getElementById(`tab-${tabName}`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-50');
            activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
        }

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        const activeContent = document.getElementById(`${tabName}-content`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }

        this.updateUI();
    }

    updateUI() {
        this.updateWalletSection();
        this.updateMembershipSection();
        this.updateMainContent();
        this.updateDashboard();
        this.updateProposals();
        this.updateDelegation();
    }

    updateWalletSection() {
        const connectBtn = document.getElementById('connect-wallet-btn');
        const connectedWallet = document.getElementById('connected-wallet');
        const walletAddress = document.getElementById('wallet-address');

        if (this.state.isConnected) {
            connectBtn.classList.add('hidden');
            connectedWallet.classList.remove('hidden');
            walletAddress.textContent = `${this.state.account.slice(0, 6)}...${this.state.account.slice(-4)}`;
        } else {
            connectBtn.classList.remove('hidden');
            connectedWallet.classList.add('hidden');
        }
    }

    updateMembershipSection() {
        const joinSection = document.getElementById('join-dao-section');
        const mainContent = document.getElementById('main-content');

        if (this.state.isConnected && (!this.state.memberInfo || !this.state.memberInfo.isMember)) {
            joinSection.classList.remove('hidden');
            mainContent.classList.add('hidden');
        } else if (this.state.isConnected && this.state.memberInfo?.isMember) {
            joinSection.classList.add('hidden');
            mainContent.classList.remove('hidden');
        } else {
            joinSection.classList.add('hidden');
            mainContent.classList.add('hidden');
        }
    }

    updateMainContent() {
        if (!this.state.isConnected || !this.state.memberInfo?.isMember) return;

        // Update stats
        document.getElementById('total-members').textContent = this.state.contractData.memberCount;
        document.getElementById('treasury-balance').textContent = `${this.state.contractData.treasuryBalance.toFixed(2)} ETH`;
        document.getElementById('total-proposals').textContent = this.state.contractData.totalProposals;
        document.getElementById('active-proposals').textContent = this.state.contractData.activeProposals;
    }

    updateDashboard() {
        if (!this.state.memberInfo) return;

        // Update member profile
        document.getElementById('voting-power').textContent = this.state.memberInfo.votingPower;
        document.getElementById('delegated-power').textContent = this.state.memberInfo.delegatedPower;
        document.getElementById('total-power').textContent = this.state.memberInfo.votingPower + this.state.memberInfo.delegatedPower;

        // Update delegation info
        const delegationInfo = document.getElementById('delegation-info');
        const delegateAddressSpan = document.getElementById('delegate-address');
        
        if (this.state.memberInfo.delegate) {
            delegationInfo.classList.remove('hidden');
            delegateAddressSpan.textContent = this.state.memberInfo.delegate;
        } else {
            delegationInfo.classList.add('hidden');
        }

        // Update recent activity
        this.updateRecentActivity();
    }

    updateRecentActivity() {
        const container = document.getElementById('recent-activity');
        if (!container) return;

        const recentProposals = this.state.proposals.slice(0, 3);
        
        container.innerHTML = recentProposals.map(proposal => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                    <p class="font-medium">${proposal.title}</p>
                    <p class="text-sm text-gray-600">by ${proposal.proposer.slice(0, 6)}...${proposal.proposer.slice(-4)}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-medium ${this.getStateColor(proposal.state)}">
                    ${proposal.state}
                </span>
            </div>
        `).join('');
    }

    updateProposals() {
        const container = document.getElementById('proposals-list');
        if (!container) return;

        container.innerHTML = this.state.proposals.map(proposal => `
            <div class="proposal-card">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <h3 class="text-xl font-semibold">${proposal.title}</h3>
                            <span class="px-3 py-1 rounded-full text-xs font-medium ${this.getStateColor(proposal.state)}">
                                ${proposal.state}
                            </span>
                        </div>
                        <p class="text-gray-600 mb-3">${proposal.description}</p>
                        <div class="flex items-center gap-4 text-sm text-gray-500">
                            <span>Proposed by ${proposal.proposer.slice(0, 6)}...${proposal.proposer.slice(-4)}</span>
                            ${proposal.amount > 0 ? `<span>Amount: ${proposal.amount} ETH</span>` : ''}
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-500 flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12,6 12,12 16,14"></polyline>
                            </svg>
                            ${this.formatTimeRemaining(proposal.endTime)}
                        </p>
                    </div>
                </div>

                <div class="mb-4">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-green-600">For: ${proposal.forVotes}</span>
                        <span class="text-red-600">Against: ${proposal.againstVotes}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-green-500 h-2 rounded-l-full progress-bar" 
                             style="width: ${(proposal.forVotes / (proposal.forVotes + proposal.againstVotes + 1)) * 100}%">
                        </div>
                    </div>
                </div>

                ${this.renderProposalActions(proposal)}
            </div>
        `).join('');

        // Bind proposal events
        this.bindProposalEvents();
    }

    renderProposalActions(proposal) {
        if (proposal.state === 'Active' && this.state.memberInfo && !proposal.hasVoted) {
            const maxCredits = this.state.memberInfo.votingPower + this.state.memberInfo.delegatedPower;
            return `
                <div class="flex gap-2 items-center">
                    <input type="number" 
                           min="1" 
                           max="${maxCredits}" 
                           value="1" 
                           class="w-20 px-2 py-1 border rounded vote-credits" 
                           data-proposal-id="${proposal.id}"
                           placeholder="Credits">
                    <button class="vote-support" 
                            data-proposal-id="${proposal.id}" 
                            data-support="true">
                        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="m9 12 2 2 4-4"></path>
                            <path d="M21 12c.552 0 1-.448 1-1V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6c0 .552.448 1 1 1"></path>
                        </svg>
                        Support
                    </button>
                    <button class="vote-oppose" 
                            data-proposal-id="${proposal.id}" 
                            data-support="false">
                        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M15 9l-6 6"></path>
                            <path d="M9 9l6 6"></path>
                        </svg>
                        Oppose
                    </button>
                </div>
            `;
        } else if (proposal.hasVoted) {
            return `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p class="text-blue-800 flex items-center">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        You have already voted on this proposal
                    </p>
                </div>
            `;
        } else if (proposal.state === 'Succeeded') {
            return `
                <div class="flex justify-end">
                    <button class="execute-btn" data-proposal-id="${proposal.id}">
                        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="m3.5 12.5 5 5 12-12"></path>
                        </svg>
                        Execute
                    </button>
                </div>
            `;
        }
        return '';
    }

    bindProposalEvents() {
        document.querySelectorAll('.vote-support, .vote-oppose').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const proposalId = parseInt(button.dataset.proposalId);
                const support = button.dataset.support === 'true';
                const creditsInput = document.querySelector(`input[data-proposal-id="${proposalId}"]`);
                const credits = parseInt(creditsInput?.value || 1);
                
                this.castVote(proposalId, support, credits);
            });
        });

        document.querySelectorAll('.execute-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const proposalId = parseInt(e.currentTarget.dataset.proposalId);
                this.executeProposal(proposalId);
            });
        });
    }

    updateDelegation() {
        const delegationForm = document.getElementById('delegation-form');
        const revokeDelegation = document.getElementById('revoke-delegation');
        const currentDelegate = document.getElementById('current-delegate');

        if (!this.state.memberInfo) return;

        if (this.state.memberInfo.delegate) {
            delegationForm.classList.add('hidden');
            revokeDelegation.classList.remove('hidden');
            currentDelegate.textContent = this.state.memberInfo.delegate;
        } else {
            delegationForm.classList.remove('hidden');
            revokeDelegation.classList.add('hidden');
        }
    }

    // Utility functions
    formatTimeRemaining(endTime) {
        const now = Date.now();
        const remaining = endTime - now;
        
        if (remaining <= 0) return 'Ended';
        
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        if (days > 0) return `${days}d ${hours}h remaining`;
        return `${hours}h remaining`;
    }

    getStateColor(state) {
        const colors = {
            'Active': 'status-active',
            'Succeeded': 'status-succeeded',
            'Defeated': 'status-defeated',
            'Executed': 'status-executed',
            'Canceled': 'status-canceled'
        };
        return colors[state] || 'status-canceled';
    }

    showNotification(message, type = 'info') {
        const banner = document.getElementById('notification-banner');
        const messageEl = document.getElementById('notification-message');
        
        // Remove existing classes
        banner.className = 'fixed top-5 right-5 p-4 rounded-lg border-l-4 shadow-lg z-50 hidden';

        // Add appropriate classes
        if (type === 'error') {
            banner.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        } else if (type === 'success') {
            banner.classList.add('bg-green-100', 'border-green-500', 'text-green-700');
        } else {
            banner.classList.add('bg-blue-100', 'border-blue-500', 'text-blue-700');
        }

        messageEl.textContent = message;
        banner.classList.remove('hidden');
        banner.classList.add('notification-slide-in');

        // Auto hide after 5 seconds
        setTimeout(() => {
            banner.classList.add('notification-slide-out');
            setTimeout(() => {
                banner.classList.add('hidden');
                banner.classList.remove('notification-slide-in', 'notification-slide-out');
            }, 300);
        }, 5000);
    }

    setLoading(loading) {
        this.state.loading = loading;
        
        // Update button states
        const buttons = document.querySelectorAll('button, input[type="submit"]');
        buttons.forEach(btn => {
            if (loading) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.daoApp = new DAOApp();
});
