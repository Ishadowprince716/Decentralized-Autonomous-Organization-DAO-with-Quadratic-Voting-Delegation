// Enhanced Chart Manager with Performance Optimizations
// js/services/chart-manager.js

import { CHART_COLORS } from '../utils/constants.js';

/**
 * Manages data visualization and chart rendering with advanced features
 * Time Complexity: O(n) for most operations, O(1) for lookups
 * Space Complexity: O(n) where n is the number of charts
 */
export class ChartManager extends EventTarget {
    constructor() {
        super();
        
        // Core storage - O(1) access
        this.charts = new Map();
        this.observers = new Map();
        this.chartConfigs = new Map(); // Cache configurations
        this.updateQueue = new Map(); // Batch updates
        
        // Performance optimization
        this.isInitialized = false;
        this.isUpdating = false;
        this.animationFrameId = null;
        this.updateThrottleTime = 100;
        
        // Feature flags
        this.features = {
            autoUpdate: true,
            animations: true,
            responsiveResize: true,
            dataLabels: false,
            crosshair: false,
            zoom: false
        };
        
        // Data cache for performance - O(1) access
        this.dataCache = new Map();
        this.lastUpdateTime = new Map();
        
        // Lazy loading queue
        this.lazyLoadQueue = [];
        
        // Bind methods for event listeners
        this.handleResize = this.debounce(this.onResize.bind(this), 250);
        this.handleOrientationChange = this.onOrientationChange.bind(this);
    }

    /**
     * Initialize chart manager with options
     * Time Complexity: O(1)
     */
    async init(options = {}) {
        try {
            // Merge options
            Object.assign(this.features, options.features || {});
            
            await this.initializeCharts();
            this.setupResponsiveHandlers();
            this.startUpdateLoop();
            
            this.isInitialized = true;
            this.dispatchEvent(new CustomEvent('charts:initialized', { 
                detail: { features: this.features } 
            }));
        } catch (error) {
            console.error('Failed to initialize chart manager:', error);
            throw error;
        }
    }

    /**
     * Initialize all charts with lazy loading
     * Time Complexity: O(n) where n is number of charts
     */
    async initializeCharts() {
        if (typeof Chart === 'undefined') {
            await this.waitForChartJS();
        }

        this.configureChartDefaults();
        
        // Use Intersection Observer for lazy chart initialization
        const chartContainers = document.querySelectorAll('[data-chart]');
        
        if ('IntersectionObserver' in window) {
            this.setupLazyLoading(chartContainers);
        } else {
            // Fallback: initialize all charts immediately
            this.initGovernanceChart();
            this.initParticipationChart();
            this.initVoteDistributionChart();
        }
    }

    /**
     * Set up lazy loading with Intersection Observer
     * Time Complexity: O(n)
     */
    setupLazyLoading(containers) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const chartType = entry.target.dataset.chart;
                    this.loadChart(chartType);
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '50px' });

        containers.forEach(container => observer.observe(container));
    }

    /**
     * Load specific chart on demand
     * Time Complexity: O(1)
     */
    loadChart(type) {
        const chartLoaders = {
            'governance': () => this.initGovernanceChart(),
            'participation': () => this.initParticipationChart(),
            'voteDistribution': () => this.initVoteDistributionChart(),
            'timeline': () => this.initTimelineChart(),
            'heatmap': () => this.initHeatmapChart()
        };

        const loader = chartLoaders[type];
        if (loader) {
            loader();
            this.dispatchEvent(new CustomEvent('chart:loaded', { detail: { type } }));
        }
    }

    /**
     * Configure Chart.js defaults
     */
    configureChartDefaults() {
        Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
        Chart.defaults.color = '#6b7280';
        Chart.defaults.plugins.legend.position = 'bottom';
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        
        // Performance optimizations
        Chart.defaults.animation = this.features.animations ? {
            duration: 750,
            easing: 'easeOutQuart'
        } : false;
        
        // Register custom plugins
        this.registerCustomPlugins();
    }

    /**
     * Register custom Chart.js plugins
     */
    registerCustomPlugins() {
        // Crosshair plugin
        if (this.features.crosshair) {
            Chart.register({
                id: 'crosshair',
                afterDraw: (chart) => this.drawCrosshair(chart)
            });
        }

        // Data labels plugin
        if (this.features.dataLabels) {
            Chart.register({
                id: 'dataLabels',
                afterDatasetsDraw: (chart) => this.drawDataLabels(chart)
            });
        }
    }

    /**
     * Draw crosshair on chart
     */
    drawCrosshair(chart) {
        if (chart.tooltip?._active?.length) {
            const ctx = chart.ctx;
            const activePoint = chart.tooltip._active[0];
            const x = activePoint.element.x;
            const y = activePoint.element.y;
            const topY = chart.scales.y.top;
            const bottomY = chart.scales.y.bottom;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.stroke();
            ctx.restore();
        }
    }

    /**
     * Draw data labels on chart
     */
    drawDataLabels(chart) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((bar, index) => {
                const data = dataset.data[index];
                ctx.fillStyle = '#000';
                ctx.fillText(data, bar.x, bar.y - 5);
            });
        });
        ctx.restore();
    }

    /**
     * Wait for Chart.js to load
     * Time Complexity: O(1) amortized
     */
    async waitForChartJS(timeout = 5000) {
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const checkChart = () => {
                if (typeof Chart !== 'undefined') {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Chart.js loading timeout'));
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
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%',
                animation: {
                    animateRotate: true,
                    animateScale: true
                }
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
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        callbacks: {
                            label: (context) => `${context.parsed.y.toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        },
                        grid: { color: '#f3f4f6' },
                        border: { display: false }
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
                        backgroundColor: 'rgba(0, 0, 0, 0.8)'
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: '#f3f4f6' },
                        border: { display: false }
                    }
                }
            }
        };

        this.createChart('voteDistribution', ctx, config);
    }

    /**
     * Initialize timeline chart (new feature)
     */
    initTimelineChart() {
        const ctx = document.getElementById('timelineChart');
        if (!ctx) return;

        const config = {
            type: 'line',
            data: {
                labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
                datasets: [{
                    label: 'Activity',
                    data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 100)),
                    borderColor: CHART_COLORS.PRIMARY,
                    backgroundColor: `${CHART_COLORS.PRIMARY}10`,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };

        this.createChart('timeline', ctx, config);
    }

    /**
     * Initialize heatmap chart (new feature)
     */
    initHeatmapChart() {
        const ctx = document.getElementById('heatmapChart');
        if (!ctx) return;

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

        const config = {
            type: 'matrix',
            data: {
                datasets: [{
                    data: this.generateHeatmapData(days, hours),
                    backgroundColor: (context) => {
                        const value = context.dataset.data[context.dataIndex].v;
                        const alpha = value / 100;
                        return `rgba(59, 130, 246, ${alpha})`;
                    },
                    borderWidth: 1,
                    borderColor: '#ffffff',
                    width: ({ chart }) => (chart.chartArea || {}).width / hours.length - 1,
                    height: ({ chart }) => (chart.chartArea || {}).height / days.length - 1
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: () => '',
                            label: (context) => {
                                const v = context.dataset.data[context.dataIndex];
                                return `${v.x}, ${v.y}: ${v.v}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: { type: 'category', labels: hours },
                    y: { type: 'category', labels: days }
                }
            }
        };

        this.createChart('heatmap', ctx, config);
    }

    /**
     * Generate heatmap data
     * Time Complexity: O(n*m)
     */
    generateHeatmapData(days, hours) {
        const data = [];
        days.forEach((day, y) => {
            hours.forEach((hour, x) => {
                data.push({
                    x: hour,
                    y: day,
                    v: Math.floor(Math.random() * 100)
                });
            });
        });
        return data;
    }

    /**
     * Create and manage a chart instance
     * Time Complexity: O(1)
     */
    createChart(id, ctx, config) {
        this.destroyChart(id);

        try {
            const chart = new Chart(ctx, config);
            this.charts.set(id, chart);
            this.chartConfigs.set(id, config);

            // Set up resize observer
            const observer = new ResizeObserver(() => {
                if (chart && !chart.destroyed) {
                    this.scheduleResize(id);
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
     * Schedule chart resize (batched for performance)
     * Time Complexity: O(1)
     */
    scheduleResize(id) {
        if (!this.resizeQueue) {
            this.resizeQueue = new Set();
        }
        
        this.resizeQueue.add(id);
        
        if (!this.resizeScheduled) {
            this.resizeScheduled = true;
            requestAnimationFrame(() => {
                this.resizeQueue.forEach(chartId => {
                    const chart = this.charts.get(chartId);
                    if (chart && !chart.destroyed) {
                        chart.resize();
                    }
                });
                this.resizeQueue.clear();
                this.resizeScheduled = false;
            });
        }
    }

    /**
     * Batch update charts (improved performance)
     * Time Complexity: O(1) per update, batched execution
     */
    queueUpdate(id, data) {
        this.updateQueue.set(id, data);
        
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(() => {
                this.processBatchUpdates();
            });
        }
    }

    /**
     * Process all queued updates at once
     * Time Complexity: O(n) where n is queue size
     */
    processBatchUpdates() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        
        for (const [id, data] of this.updateQueue) {
            this.updateChartImmediate(id, data);
        }
        
        this.updateQueue.clear();
        this.updateScheduled = false;
        this.isUpdating = false;
    }

    /**
     * Update chart immediately
     * Time Complexity: O(1)
     */
    updateChartImmediate(id, newData) {
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return;

        try {
            // Cache check - avoid unnecessary updates
            const cacheKey = `${id}_${JSON.stringify(newData)}`;
            const lastUpdate = this.lastUpdateTime.get(id);
            const now = Date.now();
            
            if (lastUpdate && now - lastUpdate < this.updateThrottleTime) {
                return; // Throttle updates
            }

            if (newData.datasets) {
                chart.data.datasets = newData.datasets;
            }
            if (newData.labels) {
                chart.data.labels = newData.labels;
            }
            chart.update(this.features.animations ? 'active' : 'none');
            this.lastUpdateTime.set(id, now);
            
            this.dispatchEvent(new CustomEvent('chart:updated', { 
                detail: { id, timestamp: now } 
            }));
        } catch (error) {
            console.error(`Failed to update chart ${id}:`, error);
        }
    }

    /**
     * Legacy update method (maintained for compatibility)
     */
    updateChart(id, newData) {
        if (this.features.autoUpdate) {
            this.queueUpdate(id, newData);
        } else {
            this.updateChartImmediate(id, newData);
        }
    }

    /**
     * Update proposal charts with optimized data processing
     * Time Complexity: O(n) where n is proposals length
     */
    updateProposalCharts(proposals) {
        if (!proposals || proposals.length === 0) return;

        // Use Map for O(1) lookups
        const proposalMap = new Map(proposals.map(p => [p.id, p]));

        // Aggregate data in single pass - O(n)
        const stats = proposals.reduce((acc, p) => {
            acc.totalFor += parseInt(p.forVotes || 0);
            acc.totalAgainst += parseInt(p.againstVotes || 0);
            return acc;
        }, { totalFor: 0, totalAgainst: 0 });

        const totalVotes = stats.totalFor + stats.totalAgainst;
        const notVoted = Math.max(0, proposals.length * 10 - totalVotes);

        // Batch updates
        this.queueUpdate('governance', {
            datasets: [{
                data: [stats.totalFor, stats.totalAgainst, notVoted],
                backgroundColor: [
                    CHART_COLORS.SUCCESS,
                    CHART_COLORS.DANGER,
                    CHART_COLORS.SECONDARY
                ]
            }]
        });

        // Process recent proposals
        const recent = proposals.slice(-4);
        this.queueUpdate('voteDistribution', {
            labels: recent.map(p => this.truncateText(p.title, 15)),
            datasets: [
                {
                    label: 'For',
                    data: recent.map(p => parseInt(p.forVotes || 0)),
                    backgroundColor: CHART_COLORS.SUCCESS
                },
                {
                    label: 'Against',
                    data: recent.map(p => parseInt(p.againstVotes || 0)),
                    backgroundColor: CHART_COLORS.DANGER
                }
            ]
        });
    }

    /**
     * Truncate text utility
     * Time Complexity: O(1)
     */
    truncateText(text, maxLength) {
        return text.length > maxLength ? 
            text.substring(0, maxLength - 3) + '...' : text;
    }

    /**
     * Update analytics with memoization
     * Time Complexity: O(1) cached, O(n) uncached
     */
    updateAnalyticsCharts(analytics) {
        const cacheKey = JSON.stringify(analytics);
        
        if (this.dataCache.has(cacheKey)) {
            const cached = this.dataCache.get(cacheKey);
            this.queueUpdate('participation', cached);
            return;
        }

        const participationData = this.generateParticipationData(analytics);
        const updateData = {
            datasets: [{
                label: 'Participation %',
                data: participationData,
                borderColor: CHART_COLORS.PRIMARY,
                backgroundColor: `${CHART_COLORS.PRIMARY}20`
            }]
        };

        this.dataCache.set(cacheKey, updateData);
        this.queueUpdate('participation', updateData);
        
        // Cache cleanup - keep only last 50 entries
        if (this.dataCache.size > 50) {
            const firstKey = this.dataCache.keys().next().value;
            this.dataCache.delete(firstKey);
        }
    }

    /**
     * Generate participation data
     * Time Complexity: O(n) where n is data points
     */
    generateParticipationData(analytics) {
        const baseParticipation = analytics.totalVotes > 0 ? 
            Math.min(80, (analytics.totalVotes / analytics.totalMembers) * 100) : 20;
        
        return Array.from({ length: 6 }, (_, i) => {
            const variation = (Math.random() - 0.5) * 20;
            return Math.max(10, Math.min(90, baseParticipation + variation));
        });
    }

    /**
     * Start automatic update loop
     */
    startUpdateLoop() {
        if (!this.features.autoUpdate) return;
        
        const loop = () => {
            if (this.updateQueue.size > 0) {
                this.processBatchUpdates();
            }
            this.animationFrameId = requestAnimationFrame(loop);
        };
        
        this.animationFrameId = requestAnimationFrame(loop);
    }

    /**
     * Stop update loop
     */
    stopUpdateLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Animate chart with effects
     * Time Complexity: O(1)
     */
    animateChart(id, animationType = 'default') {
        if (!this.features.animations) return;
        
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
                        return ctx.type === 'data' && ctx.mode === 'default' ? 
                            ctx.dataIndex * 300 : 0;
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
            },
            'bounce': {
                y: {
                    duration: 1000,
                    easing: 'easeOutBounce'
                }
            }
        };

        if (animations[animationType]) {
            chart.options.animation = animations[animationType];
            chart.update();
        }
    }

    /**
     * Export chart as image with quality options
     * Time Complexity: O(1)
     */
    exportChart(id, options = {}) {
        const {
            format = 'png',
            quality = 1.0,
            backgroundColor = '#ffffff'
        } = options;

        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return null;

        try {
            // Add background if specified
            if (backgroundColor && backgroundColor !== 'transparent') {
                const originalBg = chart.options.plugins.backgroundColor;
                chart.options.plugins.backgroundColor = backgroundColor;
                chart.update('none');
                
                const dataUrl = chart.toBase64Image(`image/${format}`, quality);
                
                chart.options.plugins.backgroundColor = originalBg;
                chart.update('none');
                
                return dataUrl;
            }
            
            return chart.toBase64Image(`image/${format}`, quality);
        } catch (error) {
            console.error(`Failed to export chart ${id}:`, error);
            return null;
        }
    }

    /**
     * Export all charts as ZIP
     * Time Complexity: O(n)
     */
    async exportAllCharts(format = 'png') {
        const exports = [];
        
        for (const [id, chart] of this.charts) {
            if (!chart.destroyed) {
                const dataUrl = this.exportChart(id, { format });
                if (dataUrl) {
                    exports.push({ id, dataUrl });
                }
            }
        }
        
        return exports;
    }

    /**
     * Get chart statistics
     * Time Complexity: O(n)
     */
    getChartStats(id) {
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return null;

        const datasets = chart.data.datasets;
        const stats = {
            datasetCount: datasets.length,
            totalDataPoints: datasets.reduce((sum, ds) => sum + ds.data.length, 0),
            min: Math.min(...datasets.flatMap(ds => ds.data)),
            max: Math.max(...datasets.flatMap(ds => ds.data)),
            avg: null
        };

        const allData = datasets.flatMap(ds => ds.data);
        stats.avg = allData.reduce((a, b) => a + b, 0) / allData.length;

        return stats;
    }

    /**
     * Compare multiple charts
     * Time Complexity: O(n*m)
     */
    compareCharts(chartIds) {
        return chartIds.map(id => ({
            id,
            stats: this.getChartStats(id),
            isValid: this.isChartValid(id)
        }));
    }

    /**
     * Set up responsive handlers
     */
    setupResponsiveHandlers() {
        if (!this.features.responsiveResize) return;

        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleOrientationChange);
    }

    /**
     * Handle resize event
     */
    onResize() {
        this.charts.forEach((chart, id) => {
            if (chart && !chart.destroyed) {
                this.scheduleResize(id);
            }
        });
    }

    /**
     * Handle orientation change
     */
    onOrientationChange() {
        setTimeout(() => {
            this.onResize();
        }, 500);
    }

    /**
     * Destroy specific chart
     * Time Complexity: O(1)
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

        this.chartConfigs.delete(id);
        this.dataCache.delete(id);
        this.lastUpdateTime.delete(id);
    }

    /**
     * Get chart instance
     * Time Complexity: O(1)
     */
    getChart(id) {
        return this.charts.get(id) || null;
    }

    /**
     * Check if chart is valid
     * Time Complexity: O(1)
     */
    isChartValid(id) {
        const chart = this.charts.get(id);
        return chart && !chart.destroyed;
    }

    /**
     * Get all chart IDs
     * Time Complexity: O(n)
     */
    getAllChartIds() {
        return Array.from(this.charts.keys());
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
     * Cleanup all charts and resources
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
