delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Additional utility functions
    formatDate(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    toggleDarkMode() {
        this.state.darkMode = !this.state.darkMode;
        document.body.classList.toggle('dark-mode', this.state.darkMode);
        this.showNotification(`Dark mode ${this.state.darkMode ? 'enabled' : 'disabled'}`, 'success');
    }

    async refreshData() {
        this.setLoading(true);
        this.showNotification('Refreshing data...', 'info');

        try {
            await this.delay(1000);
            
            // Simulate data refresh
            this.state.contractData.memberCount = Math.floor(Math.random() * 10) + 20;
            this.state.contractData.treasuryBalance = (Math.random() * 20 + 10).toFixed(2);
            
            this.showNotification('Data refreshed successfully!', 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to refresh data', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    exportData() {
        try {
            const data = {
                account: this.state.account,
                memberInfo: this.state.memberInfo,
                proposals: this.state.proposals,
                votingHistory: this.state.votingHistory,
                contractData: this.state.contractData,
                exportedAt: new Date().toISOString()
            };

            const dataStr = JSON.stringify(data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `dao-data-${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showNotification('Data exported successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to export data', 'error');
        }
    }

    getProposalStats() {
        const stats = {
            total: this.state.proposals.length,
            active: this.state.proposals.filter(p => p.state === 'Active').length,
            succeeded: this.state.proposals.filter(p => p.state === 'Succeeded').length,
            defeated: this.state.proposals.filter(p => p.state === 'Defeated').length,
            executed: this.state.proposals.filter(p => p.state === 'Executed').length,
            totalVotes: this.state.proposals.reduce((sum, p) => sum + p.forVotes + p.againstVotes, 0),
            averageParticipation: 0
        };

        if (stats.total > 0) {
            stats.averageParticipation = (stats.totalVotes / stats.total).toFixed(1);
        }

        return stats;
    }

    getMemberStats() {
        if (!this.state.memberInfo) return null;

        return {
            totalVotingPower: this.state.memberInfo.votingPower + this.state.memberInfo.delegatedPower,
            proposalsVoted: this.state.votingHistory.length,
            participationRate: ((this.state.votingHistory.length / this.state.proposals.length) * 100).toFixed(1),
            memberSince: this.formatDate(this.state.memberInfo.joinedAt)
        };
    }

    calculateQuorum(proposal) {
        const totalVotes = proposal.forVotes + proposal.againstVotes;
        const requiredQuorum = 50; // Example: 50 votes required
        const quorumPercentage = ((totalVotes / requiredQuorum) * 100).toFixed(1);
        return {
            current: totalVotes,
            required: requiredQuorum,
            percentage: quorumPercentage,
            met: totalVotes >= requiredQuorum
        };
    }

    getTopProposals(limit = 5) {
        return [...this.state.proposals]
            .sort((a, b) => (b.forVotes + b.againstVotes) - (a.forVotes + a.againstVotes))
            .slice(0, limit);
    }

    getVotingTrends() {
        const last7Days = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentVotes = this.state.votingHistory.filter(v => v.timestamp >= last7Days);
        
        return {
            totalVotes: recentVotes.length,
            supportVotes: recentVotes.filter(v => v.support).length,
            opposeVotes: recentVotes.filter(v => !v.support).length,
            totalCredits: recentVotes.reduce((sum, v) => sum + v.credits, 0)
        };
    }

    validateProposalForm() {
        const title = document.getElementById('proposal-title').value;
        const description = document.getElementById('proposal-description').value;
        const recipient = document.getElementById('proposal-recipient').value;
        const amount = document.getElementById('proposal-amount').value;

        const errors = [];

        if (!title || title.length < 5) {
            errors.push('Title must be at least 5 characters');
        }

        if (!description || description.length < 20) {
            errors.push('Description must be at least 20 characters');
        }

        if (recipient && !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
            errors.push('Invalid recipient address format');
        }

        if (amount && parseFloat(amount) > this.state.contractData.treasuryBalance) {
            errors.push('Amount exceeds treasury balance');
        }

        return errors;
    }

    async cancelProposal(proposalId) {
        const proposal = this.state.proposals.find(p => p.id === proposalId);
        
        if (!proposal) {
            this.showNotification('Proposal not found', 'error');
            return;
        }

        if (proposal.proposer !== this.state.account) {
            this.showNotification('Only the proposer can cancel this proposal', 'error');
            return;
        }

        if (proposal.state !== 'Active') {
            this.showNotification('Only active proposals can be cancelled', 'error');
            return;
        }

        this.setLoading(true);
        this.showNotification('Cancelling proposal...', 'info');

        try {
            await this.delay(1500);

            this.state.proposals = this.state.proposals.map(p =>
                p.id === proposalId ? { ...p, state: 'Canceled' } : p
            );

            this.state.contractData.activeProposals -= 1;

            this.showNotification('Proposal cancelled successfully!', 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to cancel proposal', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    getRecommendedVote(proposal) {
        // Simple recommendation algorithm
        const totalVotes = proposal.forVotes + proposal.againstVotes;
        if (totalVotes === 0) return 'neutral';
        
        const supportRatio = proposal.forVotes / totalVotes;
        
        if (supportRatio > 0.7) return 'support';
        if (supportRatio < 0.3) return 'oppose';
        return 'neutral';
    }

    searchProposalById(id) {
        return this.state.proposals.find(p => p.id === parseInt(id));
    }

    filterProposalsByDateRange(startDate, endDate) {
        return this.state.proposals.filter(p => {
            const created = p.createdAt || 0;
            return created >= startDate && created <= endDate;
        });
    }

    calculateVotingPowerUtilization() {
        if (!this.state.memberInfo || this.state.votingHistory.length === 0) {
            return { utilized: 0, total: 0, percentage: 0 };
        }

        const totalPower = this.state.memberInfo.votingPower + this.state.memberInfo.delegatedPower;
        const utilized = this.state.votingHistory.reduce((sum, v) => sum + v.credits, 0);
        const percentage = ((utilized / (totalPower * this.state.proposals.length)) * 100).toFixed(1);

        return {
            utilized,
            total: totalPower,
            percentage: Math.min(percentage, 100)
        };
    }

    getProposalsByCategory() {
        const categories = {};
        this.state.proposals.forEach(p => {
            const category = p.category || 'Other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(p);
        });
        return categories;
    }

    async queueProposal(proposalId) {
        const proposal = this.state.proposals.find(p => p.id === proposalId);
        
        if (!proposal || proposal.state !== 'Succeeded') {
            this.showNotification('Only succeeded proposals can be queued', 'error');
            return;
        }

        this.setLoading(true);
        this.showNotification('Queueing proposal for execution...', 'info');

        try {
            await this.delay(1500);

            this.state.proposals = this.state.proposals.map(p =>
                p.id === proposalId ? { ...p, state: 'Queued', queuedAt: Date.now() } : p
            );

            this.showNotification('Proposal queued successfully! It can be executed after timelock.', 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to queue proposal', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    getProposalOutcome(proposal) {
        const totalVotes = proposal.forVotes + proposal.againstVotes;
        if (totalVotes === 0) return 'No votes';

        const supportPercentage = (proposal.forVotes / totalVotes) * 100;
        
        if (supportPercentage > 50) {
            return `Passing (${supportPercentage.toFixed(1)}% support)`;
        } else if (supportPercentage === 50) {
            return 'Tied (50% support)';
        } else {
            return `Failing (${supportPercentage.toFixed(1)}% support)`;
        }
    }

    async batchVote(votes) {
        // votes is an array of { proposalId, support, credits }
        this.setLoading(true);
        this.showNotification(`Casting ${votes.length} votes...`, 'info');

        try {
            await this.delay(2000);

            votes.forEach(vote => {
                this.state.proposals = this.state.proposals.map(p => {
                    if (p.id === vote.proposalId) {
                        const proposal = this.state.proposals.find(pr => pr.id === vote.proposalId);
                        
                        this.state.votingHistory.push({
                            proposalId: vote.proposalId,
                            proposalTitle: proposal.title,
                            support: vote.support,
                            credits: vote.credits,
                            timestamp: Date.now()
                        });

                        return {
                            ...p,
                            forVotes: vote.support ? p.forVotes + vote.credits : p.forVotes,
                            againstVotes: !vote.support ? p.againstVotes + vote.credits : p.againstVotes,
                            hasVoted: true
                        };
                    }
                    return p;
                });
            });

            this.showNotification(`Successfully cast ${votes.length} votes!`, 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to cast batch votes', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    getProposalTimeline(proposalId) {
        const proposal = this.state.proposals.find(p => p.id === proposalId);
        if (!proposal) return [];

        const timeline = [
            {
                event: 'Proposal Created',
                timestamp: proposal.createdAt,
                status: 'completed'
            }
        ];

        if (proposal.state === 'Active') {
            timeline.push({
                event: 'Voting Period',
                timestamp: Date.now(),
                status: 'active'
            });
            timeline.push({
                event: 'Voting Ends',
                timestamp: proposal.endTime,
                status: 'pending'
            });
        } else if (proposal.state === 'Succeeded' || proposal.state === 'Defeated') {
            timeline.push({
                event: 'Voting Ended',
                timestamp: proposal.endTime,
                status: 'completed'
            });
            timeline.push({
                event: proposal.state,
                timestamp: proposal.endTime,
                status: 'completed'
            });
        } else if (proposal.state === 'Executed') {
            timeline.push({
                event: 'Voting Ended',
                timestamp: proposal.endTime,
                status: 'completed'
            });
            timeline.push({
                event: 'Executed',
                timestamp: proposal.executedAt || proposal.endTime + 24 * 60 * 60 * 1000,
                status: 'completed'
            });
        }

        return timeline;
    }

    calculateAverageVoteCredits() {
        if (this.state.votingHistory.length === 0) return 0;
        
        const totalCredits = this.state.votingHistory.reduce((sum, v) => sum + v.credits, 0);
        return (totalCredits / this.state.votingHistory.length).toFixed(1);
    }

    getActiveProposalsEndingSoon(hours = 24) {
        const threshold = Date.now() + hours * 60 * 60 * 1000;
        return this.state.proposals.filter(p => 
            p.state === 'Active' && 
            p.endTime <= threshold && 
            p.endTime > Date.now()
        );
    }

    getMemberRank() {
        if (!this.state.memberInfo) return null;

        const totalPower = this.state.memberInfo.votingPower + this.state.memberInfo.delegatedPower;
        
        // Simulate member rankings
        const mockRanks = [
            { address: this.state.account, power: totalPower },
            { address: '0xabcd...1234', power: 25 },
            { address: '0xdef0...5678', power: 20 },
            { address: '0x9abc...def0', power: 18 },
            { address: '0x1234...5678', power: 15 }
        ].sort((a, b) => b.power - a.power);

        const rank = mockRanks.findIndex(m => m.address === this.state.account) + 1;
        
        return {
            rank,
            totalMembers: this.state.contractData.memberCount,
            percentile: ((1 - (rank / this.state.contractData.memberCount)) * 100).toFixed(1)
        };
    }

    generateProposalSummary(proposalId) {
        const proposal = this.state.proposals.find(p => p.id === proposalId);
        if (!proposal) return null;

        const totalVotes = proposal.forVotes + proposal.againstVotes;
        const quorum = this.calculateQuorum(proposal);
        
        return {
            id: proposal.id,
            title: proposal.title,
            state: proposal.state,
            outcome: this.getProposalOutcome(proposal),
            participation: `${totalVotes} votes`,
            quorumStatus: quorum.met ? 'Met' : `${quorum.percentage}% of quorum`,
            timeRemaining: this.formatTimeRemaining(proposal.endTime),
            fundingRequest: proposal.amount > 0 ? `${proposal.amount} ETH` : 'No funding',
            category: proposal.category || 'Uncategorized'
        };
    }

    async simulateVote(proposalId, support, credits) {
        // Simulate vote outcome without actually casting it
        const proposal = this.state.proposals.find(p => p.id === proposalId);
        if (!proposal) return null;

        const newForVotes = support ? proposal.forVotes + credits : proposal.forVotes;
        const newAgainstVotes = !support ? proposal.againstVotes + credits : proposal.againstVotes;
        const newTotal = newForVotes + newAgainstVotes;
        
        return {
            currentOutcome: this.getProposalOutcome(proposal),
            projectedOutcome: this.getProposalOutcome({
                ...proposal,
                forVotes: newForVotes,
                againstVotes: newAgainstVotes
            }),
            supportPercentage: ((newForVotes / newTotal) * 100).toFixed(1),
            voteImpact: ((credits / newTotal) * 100).toFixed(2)
        };
    }

    getNotificationHistory() {
        return this.state.notifications.slice(0, 10); // Last 10 notifications
    }

    addNotification(type, title, message) {
        this.state.notifications.unshift({
            id: Date.now(),
            type,
            title,
            message,
            timestamp: Date.now(),
            read: false
        });

        // Keep only last 50 notifications
        if (this.state.notifications.length > 50) {
            this.state.notifications = this.state.notifications.slice(0, 50);
        }
    }

    markNotificationAsRead(notificationId) {
        this.state.notifications = this.state.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
        );
        this.updateUI();
    }

    clearAllNotifications() {
        this.state.notifications = [];
        this.showNotification('All notifications cleared', 'success');
        this.updateUI();
    }

    getUnreadNotificationCount() {
        return this.state.notifications.filter(n => !n.read).length;
    }

    checkProposalDeadlines() {
        const endingSoon = this.getActiveProposalsEndingSoon(24);
        
        endingSoon.forEach(proposal => {
            if (!proposal.hasVoted) {
                this.addNotification(
                    'warning',
                    'Proposal Ending Soon',
                    `"${proposal.title}" ends in ${this.formatTimeRemaining(proposal.endTime)}`
                );
            }
        });
    }

    async autoDelegate(targetAddress, conditions = {}) {
        // Auto-delegate based on conditions
        const {
            minVotingPower = 0,
            maxActiveProposals = null,
            autoRenew = false
        } = conditions;

        if (!this.state.memberInfo) {
            this.showNotification('Must be a member to auto-delegate', 'error');
            return;
        }

        this.setLoading(true);
        this.showNotification('Setting up auto-delegation...', 'info');

        try {
            await this.delay(1500);

            this.state.memberInfo.delegate = targetAddress;
            this.state.memberInfo.autoDelegation = {
                enabled: true,
                conditions,
                setupAt: Date.now()
            };

            this.showNotification('Auto-delegation configured successfully!', 'success');
            this.updateUI();
        } catch (error) {
            this.showNotification('Failed to setup auto-delegation', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    getTreasuryStats() {
        const totalRequested = this.state.proposals
            .filter(p => p.state === 'Active' || p.state === 'Succeeded')
            .reduce((sum, p) => sum + p.amount, 0);

        const totalExecuted = this.state.proposals
            .filter(p => p.state === 'Executed')
            .reduce((sum, p) => sum + p.amount, 0);

        return {
            currentBalance: this.state.contractData.treasuryBalance,
            pendingAllocations: totalRequested,
            totalDisbursed: totalExecuted,
            availableBalance: this.state.contractData.treasuryBalance - totalRequested
        };
    }

    predictProposalOutcome(proposalId) {
        const proposal = this.state.proposals.find(p => p.id === proposalId);
        if (!proposal || proposal.state !== 'Active') return null;

        const totalVotes = proposal.forVotes + proposal.againstVotes;
        const timeRemaining = proposal.endTime - Date.now();
        const timeElapsed = Date.now() - proposal.createdAt;
        const totalTime = proposal.endTime - proposal.createdAt;
        const progressPercentage = (timeElapsed / totalTime) * 100;

        // Simple prediction based on current voting trend
        const currentSupportRate = totalVotes > 0 ? proposal.forVotes / totalVotes : 0.5;
        
        let prediction = 'Uncertain';
        let confidence = 0;

        if (progressPercentage > 75) {
            // Late stage - high confidence
            if (currentSupportRate > 0.6) {
                prediction = 'Likely to Pass';
                confidence = 85;
            } else if (currentSupportRate < 0.4) {
                prediction = 'Likely to Fail';
                confidence = 85;
            } else {
                prediction = 'Too Close to Call';
                confidence = 45;
            }
        } else if (progressPercentage > 50) {
            // Mid stage - medium confidence
            if (currentSupportRate > 0.65) {
                prediction = 'Trending to Pass';
                confidence = 65;
            } else if (currentSupportRate < 0.35) {
                prediction = 'Trending to Fail';
                confidence = 65;
            }
        } else {
            // Early stage - low confidence
            confidence = 30;
            prediction = 'Too Early to Predict';
        }

        return {
            prediction,
            confidence,
            currentSupport: (currentSupportRate * 100).toFixed(1),
            votingProgress: progressPercentage.toFixed(1),
            estimatedFinalVotes: Math.round(totalVotes * (100 / progressPercentage))
        };
    }    constructor() {
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
            },
            filters: {
                status: 'all',
                sortBy: 'newest',
                searchQuery: ''
            },
            votingHistory: [],
            notifications: [],
            darkMode: false
        };
