// Chart Manager
// js/services/chart-manager.js

import { CHART_COLORS } from '../utils/constants.js';

/**
 * Manages data visualization and chart rendering
 */
export class ChartManager extends EventTarget {
    constructor() {
        super();
        
        this.charts = new Map();
        this.observers = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize chart manager
     */
    async init() {
        try {
            await this.initializeCharts();
            this.setupResponsiveHandlers();
            
            this.isInitialized = true;
            this.dispatchEvent(new CustomEvent('charts:initialized'));
        } catch (error) {
            console.error('Failed to initialize chart manager:', error);
            throw error;
        }
    }

    /**
     * Initialize all charts
     */
    async initializeCharts() {
        // Wait for Chart.js to be loaded
        if (typeof Chart === 'undefined') {
            await this.waitForChartJS();
        }

        // Configure Chart.js defaults
        Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
        Chart.defaults.color = '#6b7280';
        Chart.defaults.plugins.legend.position = 'bottom';
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;

        // Initialize individual charts
        this.initGovernanceChart();
        this.initParticipationChart();
        this.initVoteDistributionChart();
    }

    /**
     * Wait for Chart.js to load
     */
    async waitForChartJS() {
        return new Promise((resolve) => {
            const checkChart = () => {
                if (typeof Chart !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkChart, 100);
                }
            };
            checkChart();
        });
    }

    /**
     * Initialize governance overview chart
     */
    initGovernanceChart() {
        const ctx = document.getElementById('governanceChart');
        if (!ctx) return;

        const config = {
            type: 'doughnut',
            data: {
                labels: ['For Votes', 'Against Votes', 'Not Voted'],
                datasets: [{
                    data: [65, 25, 10],
                    backgroundColor: [
                        CHART_COLORS.SUCCESS,
                        CHART_COLORS.DANGER,
                        CHART_COLORS.SECONDARY
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        };

        this.createChart('governance', ctx, config);
    }

    /**
     * Initialize participation trends chart
     */
    initParticipationChart() {
        const ctx = document.getElementById('participationChart');
        if (!ctx) return;

        const config = {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Participation %',
                    data: [30, 45, 60, 55, 70, 75],
                    borderColor: CHART_COLORS.PRIMARY,
                    backgroundColor: `${CHART_COLORS.PRIMARY}20`,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: CHART_COLORS.PRIMARY,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: CHART_COLORS.PRIMARY,
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: '#f3f4f6'
                        },
                        border: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        };

        this.createChart('participation', ctx, config);
    }

    /**
     * Initialize vote distribution chart
     */
    initVoteDistributionChart() {
        const ctx = document.getElementById('voteDistributionChart');
        if (!ctx) return;

        const config = {
            type: 'bar',
            data: {
                labels: ['Proposal 1', 'Proposal 2', 'Proposal 3', 'Proposal 4'],
                datasets: [
                    {
                        label: 'For',
                        data: [45, 67, 23, 89],
                        backgroundColor: CHART_COLORS.SUCCESS,
                        borderRadius: 4,
                        borderSkipped: false
                    },
                    {
                        label: 'Against',
                        data: [15, 23, 77, 11],
                        backgroundColor: CHART_COLORS.DANGER,
                        borderRadius: 4,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: {
                            color: '#f3f4f6'
                        },
                        border: {
                            display: false
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        };

        this.createChart('voteDistribution', ctx, config);
    }

    /**
     * Create and manage a chart instance
     * @param {string} id - Chart identifier
     * @param {HTMLCanvasElement} ctx - Canvas context
     * @param {Object} config - Chart configuration
     */
    createChart(id, ctx, config) {
        // Destroy existing chart if it exists
        this.destroyChart(id);

        try {
            const chart = new Chart(ctx, config);
            this.charts.set(id, chart);

            // Set up resize observer for responsive behavior
            const observer = new ResizeObserver(() => {
                if (chart && !chart.destroyed) {
                    chart.resize();
                }
            });
            observer.observe(ctx.parentElement);
            this.observers.set(id, observer);

            return chart;
        } catch (error) {
            console.error(`Failed to create chart ${id}:`, error);
        }
    }

    /**
     * Update chart data
     * @param {string} id - Chart identifier
     * @param {Object} newData - New chart data
     */
    updateChart(id, newData) {
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return;

        try {
            // Update data
            if (newData.datasets) {
                chart.data.datasets = newData.datasets;
            }
            if (newData.labels) {
                chart.data.labels = newData.labels;
            }

            // Update chart
            chart.update('none'); // Use 'none' for better performance
        } catch (error) {
            console.error(`Failed to update chart ${id}:`, error);
        }
    }

    /**
     * Update governance chart with proposal data
     * @param {Array} proposals - Proposal data
     */
    updateProposalCharts(proposals) {
        if (proposals.length === 0) return;

        // Update governance overview
        const totalFor = proposals.reduce((sum, p) => sum + parseInt(p.forVotes || 0), 0);
        const totalAgainst = proposals.reduce((sum, p) => sum + parseInt(p.againstVotes || 0), 0);
        const totalVotes = totalFor + totalAgainst;
        const notVoted = Math.max(0, proposals.length * 10 - totalVotes); // Estimate

        this.updateChart('governance', {
            datasets: [{
                data: [totalFor, totalAgainst, notVoted],
                backgroundColor: [
                    CHART_COLORS.SUCCESS,
                    CHART_COLORS.DANGER,
                    CHART_COLORS.SECONDARY
                ]
            }]
        });

        // Update vote distribution
        const recentProposals = proposals.slice(-4); // Last 4 proposals
        const labels = recentProposals.map(p => p.title.length > 15 ? 
            p.title.substring(0, 12) + '...' : p.title);
        const forVotes = recentProposals.map(p => parseInt(p.forVotes || 0));
        const againstVotes = recentProposals.map(p => parseInt(p.againstVotes || 0));

        this.updateChart('voteDistribution', {
            labels,
            datasets: [
                {
                    label: 'For',
                    data: forVotes,
                    backgroundColor: CHART_COLORS.SUCCESS
                },
                {
                    label: 'Against',
                    data: againstVotes,
                    backgroundColor: CHART_COLORS.DANGER
                }
            ]
        });
    }

    /**
     * Update analytics charts
     * @param {Object} analytics - Analytics data
     */
    updateAnalyticsCharts(analytics) {
        // Update participation chart with real data
        // This would typically come from historical analytics
        const participationData = this.generateParticipationData(analytics);
        
        this.updateChart('participation', {
            datasets: [{
                label: 'Participation %',
                data: participationData,
                borderColor: CHART_COLORS.PRIMARY,
                backgroundColor: `${CHART_COLORS.PRIMARY}20`
            }]
        });
    }

    /**
     * Generate participation data from analytics
     * @param {Object} analytics - Analytics data
     * @returns {Array} Participation data
     */
    generateParticipationData(analytics) {
        // In a real implementation, this would come from historical data
        // For now, generate some realistic data based on current metrics
        const baseParticipation = analytics.totalVotes > 0 ? 
            Math.min(80, (analytics.totalVotes / analytics.totalMembers) * 100) : 20;
        
        return Array.from({ length: 6 }, (_, i) => {
            const variation = (Math.random() - 0.5) * 20;
            return Math.max(10, Math.min(90, baseParticipation + variation));
        });
    }

    /**
     * Animate chart data updates
     * @param {string} id - Chart identifier
     * @param {string} animationType - Animation type
     */
    animateChart(id, animationType = 'default') {
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return;

        const animations = {
            'slide': {
                x: {
                    type: 'number',
                    easing: 'easeOutQuart',
                    duration: 750,
                    from: NaN,
                    delay(ctx) {
                        return ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 300 : 0;
                    }
                }
            },
            'fade': {
                opacity: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            },
            'scale': {
                scale: {
                    type: 'number',
                    duration: 1000,
                    easing: 'easeOutQuart',
                    from: 0
                }
            }
        };

        if (animations[animationType]) {
            chart.options.animation = animations[animationType];
            chart.update();
        }
    }

    /**
     * Export chart as image
     * @param {string} id - Chart identifier
     * @param {string} format - Image format (png, jpeg)
     * @returns {string} Data URL
     */
    exportChart(id, format = 'png') {
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return null;

        try {
            return chart.toBase64Image(`image/${format}`, 1.0);
        } catch (error) {
            console.error(`Failed to export chart ${id}:`, error);
            return null;
        }
    }

    /**
     * Set up responsive handlers
     */
    setupResponsiveHandlers() {
        // Handle window resize
        const handleResize = this.debounce(() => {
            this.charts.forEach((chart, id) => {
                if (chart && !chart.destroyed) {
                    chart.resize();
                }
            });
        }, 250);

        window.addEventListener('resize', handleResize);

        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.charts.forEach((chart, id) => {
                    if (chart && !chart.destroyed) {
                        chart.resize();
                    }
                });
            }, 500);
        });
    }

    /**
     * Destroy a specific chart
     * @param {string} id - Chart identifier
     */
    destroyChart(id) {
        const chart = this.charts.get(id);
        const observer = this.observers.get(id);

        if (chart && !chart.destroyed) {
            chart.destroy();
            this.charts.delete(id);
        }

        if (observer) {
            observer.disconnect();
            this.observers.delete(id);
        }
    }

    /**
     * Get chart instance
     * @param {string} id - Chart identifier
     * @returns {Chart|null} Chart instance
     */
    getChart(id) {
        return this.charts.get(id) || null;
    }

    /**
     * Check if chart exists and is valid
     * @param {string} id - Chart identifier
     * @returns {boolean} Chart validity
     */
    isChartValid(id) {
        const chart = this.charts.get(id);
        return chart && !chart.destroyed;
    }

    /**
     * Update chart theme
     * @param {string} theme - Theme name (light, dark)
     */
    updateTheme(theme) {
        const colors = theme === 'dark' ? {
            text: '#ffffff',
            grid: '#374151',
            background: '#1f2937'
        } : {
            text: '#6b7280',
            grid: '#f3f4f6',
            background: '#ffffff'
        };

        this.charts.forEach((chart, id) => {
            if (chart && !chart.destroyed) {
                // Update color scheme
                chart.options.scales.x.ticks.color = colors.text;
                chart.options.scales.y.ticks.color = colors.text;
                chart.options.scales.x.grid.color = colors.grid;
                chart.options.scales.y.grid.color = colors.grid;
                chart.options.plugins.legend.labels.color = colors.text;
                
                chart.update('none');
            }
        });
    }

    /**
     * Debounce utility function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Clean up all charts and resources
     */
    cleanup() {
        // Destroy all charts
        for (const [id] of this.charts) {
            this.destroyChart(id);
        }

        // Clear collections
        this.charts.clear();
        this.observers.clear();

        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleOrientationChange);

        this.isInitialized = false;
    }
}

export default ChartManager;
