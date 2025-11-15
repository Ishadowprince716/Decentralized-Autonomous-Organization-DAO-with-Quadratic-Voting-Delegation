// Enhanced Chart Manager with Performance, Robustness and Utility Improvements
// File: js/services/chart-manager.improved.js

import { CHART_COLORS } from '../utils/constants.js';

/**
 * ChartManager
 * - Improved robustness, defensive checks, clearer API, utilities and small bug fixes
 * - Time complexity notes preserved in methods where relevant
 */
export class ChartManager extends EventTarget {
    constructor({ updateThrottleTime = 100, features = {} } = {}) {
        super();

        // Core storage
        this.charts = new Map();
        this.observers = new Map();
        this.chartConfigs = new Map();
        this.updateQueue = new Map();

        // Performance state
        this.isInitialized = false;
        this.isUpdating = false;
        this.animationFrameId = null;
        this.updateThrottleTime = updateThrottleTime;

        // Feature flags (can pass overrides in constructor)
        this.features = Object.assign({
            autoUpdate: true,
            animations: true,
            responsiveResize: true,
            dataLabels: false,
            crosshair: false,
            zoom: false
        }, features);

        // Caches & helpers
        this.dataCache = new Map();
        this.lastUpdateTime = new Map();

        // Lazy loading queue
        this.lazyLoadQueue = [];

        // Resize debounce / binding
        this.handleResize = this.debounce(this.onResize.bind(this), 250);
        this.handleOrientationChange = this.onOrientationChange.bind(this);

        // Internal queues
        this.resizeQueue = new Set();
        this.resizeScheduled = false;
        this.updateScheduled = false;
    }

    /**
     * Initialize the manager (awaits Chart.js if needed)
     */
    async init(options = {}) {
        try {
            // Merge feature options at init time if provided
            if (options.features) Object.assign(this.features, options.features);

            await this.initializeCharts();
            this.setupResponsiveHandlers();
            this.startUpdateLoop();

            this.isInitialized = true;
            this.dispatchEvent(new CustomEvent('charts:initialized', { detail: { features: this.features } }));
        } catch (err) {
            console.error('[ChartManager] init failed', err);
            throw err;
        }
    }

    /**
     * Find chart elements and prepare lazy init
     */
    async initializeCharts() {
        if (typeof Chart === 'undefined') {
            await this.waitForChartJS();
        }

        this.configureChartDefaults();

        const chartContainers = Array.from(document.querySelectorAll('[data-chart]'));

        if (chartContainers.length === 0) return;

        if ('IntersectionObserver' in window) {
            this.setupLazyLoading(chartContainers);
        } else {
            // Fallback: initialize all known charts if present in DOM
            ['governance', 'participation', 'voteDistribution', 'timeline', 'heatmap']
                .forEach(type => this.loadChart(type));
        }
    }

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

        // keep reference so it won't be GC'd until cleanup
        this._lazyObserver = observer;
    }

    loadChart(type) {
        const loaders = {
            governance: () => this.initGovernanceChart(),
            participation: () => this.initParticipationChart(),
            voteDistribution: () => this.initVoteDistributionChart(),
            timeline: () => this.initTimelineChart(),
            heatmap: () => this.initHeatmapChart()
        };

        const loader = loaders[type];
        if (loader) {
            try {
                loader();
                this.dispatchEvent(new CustomEvent('chart:loaded', { detail: { type } }));
            } catch (err) {
                console.error(`[ChartManager] loadChart(${type}) failed`, err);
            }
        }
    }

    configureChartDefaults() {
        try {
            Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
            Chart.defaults.color = '#6b7280';
            Chart.defaults.plugins.legend.position = 'bottom';
            Chart.defaults.responsive = true;
            Chart.defaults.maintainAspectRatio = false;

            Chart.defaults.animation = this.features.animations ? { duration: 600, easing: 'easeOutQuart' } : false;

            this.registerCustomPlugins();
        } catch (err) {
            console.warn('[ChartManager] configureChartDefaults skipped:', err);
        }
    }

    registerCustomPlugins() {
        // crosshair
        if (this.features.crosshair) {
            try {
                Chart.register({
                    id: 'cm_crosshair',
                    afterDraw: (chart) => this.drawCrosshair(chart)
                });
            } catch (err) {
                console.warn('[ChartManager] crosshair plugin register failed', err);
            }
        }

        // data labels (lightweight - drawn on afterDatasetsDraw)
        if (this.features.dataLabels) {
            try {
                Chart.register({
                    id: 'cm_dataLabels',
                    afterDatasetsDraw: (chart) => this.drawDataLabels(chart)
                });
            } catch (err) {
                console.warn('[ChartManager] dataLabels plugin register failed', err);
            }
        }
    }

    drawCrosshair(chart) {
        if (!chart?.tooltip?._active?.length) return;
        const ctx = chart.ctx;
        const active = chart.tooltip._active[0];
        if (!active) return;

        const x = active.element.x;
        const topY = chart.scales?.y?.top ?? 0;
        const bottomY = chart.scales?.y?.bottom ?? (chart.height || 0);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.stroke();
        ctx.restore();
    }

    drawDataLabels(chart) {
        try {
            const ctx = chart.ctx;
            ctx.save();
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i);
                meta.data.forEach((el, index) => {
                    const value = dataset.data[index];
                    if (value === undefined || value === null) return;
                    const x = el.x ?? (el.x ?? 0);
                    const y = (el.y ?? 0) - 6;
                    ctx.fillStyle = '#111827';
                    ctx.fillText(String(value), x, y);
                });
            });

            ctx.restore();
        } catch (err) {
            // non-fatal
        }
    }

    waitForChartJS(timeout = 5000) {
        const start = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                if (typeof Chart !== 'undefined') return resolve();
                if (Date.now() - start > timeout) return reject(new Error('Chart.js load timeout'));
                setTimeout(check, 100);
            };
            check();
        });
    }

    // ----- default chart initializers (same names, defensive) -----
    initGovernanceChart() {
        const el = document.getElementById('governanceChart');
        if (!el) return;

        const config = {
            type: 'doughnut',
            data: {
                labels: ['For Votes', 'Against Votes', 'Not Voted'],
                datasets: [{
                    data: [65, 25, 10],
                    backgroundColor: [CHART_COLORS.SUCCESS, CHART_COLORS.DANGER, CHART_COLORS.SECONDARY],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const label = ctx.label || '';
                                const value = ctx.parsed;
                                const total = ctx.dataset?.data?.reduce((a, b) => a + b, 0) || 0;
                                const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
                                return `${label}: ${value} (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        };

        this.createChart('governance', el, config);
    }

    initParticipationChart() {
        const el = document.getElementById('participationChart');
        if (!el) return;

        const config = {
            type: 'line',
            data: {
                labels: ['Jan','Feb','Mar','Apr','May','Jun'],
                datasets: [{
                    label: 'Participation %',
                    data: [30,45,60,55,70,75],
                    borderColor: CHART_COLORS.PRIMARY,
                    backgroundColor: `${CHART_COLORS.PRIMARY}20`,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        };

        this.createChart('participation', el, config);
    }

    initVoteDistributionChart() {
        const el = document.getElementById('voteDistributionChart');
        if (!el) return;

        const config = {
            type: 'bar',
            data: {
                labels: ['Proposal 1','Proposal 2','Proposal 3','Proposal 4'],
                datasets: [
                    { label: 'For', data: [45,67,23,89], backgroundColor: CHART_COLORS.SUCCESS, borderRadius: 4, borderSkipped: false },
                    { label: 'Against', data: [15,23,77,11], backgroundColor: CHART_COLORS.DANGER, borderRadius: 4, borderSkipped: false }
                ]
            },
            options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
        };

        this.createChart('voteDistribution', el, config);
    }

    initTimelineChart() {
        const el = document.getElementById('timelineChart');
        if (!el) return;

        const labels = Array.from({ length: 30 }, (_, i) => `Day ${i+1}`);
        const data = Array.from({ length: 30 }, () => Math.floor(Math.random() * 100));

        const config = {
            type: 'line',
            data: { labels, datasets: [{ label: 'Activity', data, borderColor: CHART_COLORS.PRIMARY, fill: true, tension: 0.25, pointRadius: 0 }] },
            options: { plugins: { legend: { display: false } }, scales: { x: { display: false } } }
        };

        this.createChart('timeline', el, config);
    }

    initHeatmapChart() {
        const el = document.getElementById('heatmapChart');
        if (!el) return;

        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

        const config = {
            type: 'matrix',
            data: { datasets: [{ data: this.generateHeatmapData(days, hours), backgroundColor: (ctx) => { const v = ctx.dataset.data[ctx.dataIndex].v; return `rgba(59,130,246,${Math.min(1, v/100)})`; }, borderWidth: 1 }] },
            options: { scales: { x: { type: 'category', labels: hours }, y: { type: 'category', labels: days } }, plugins: { legend: { display: false } } }
        };

        this.createChart('heatmap', el, config);
    }

    generateHeatmapData(days, hours) {
        const out = [];
        days.forEach((d, y) => hours.forEach((h, x) => { out.push({ x: h, y: d, v: Math.floor(Math.random() * 100) }); }));
        return out;
    }

    /**
     * Create a Chart.js instance and wire resize observer
     */
    createChart(id, ctx, config) {
        this.destroyChart(id);

        try {
            const chart = new Chart(ctx, config);
            this.charts.set(id, chart);
            this.chartConfigs.set(id, config);

            // attach ResizeObserver to parent if available
            try {
                const parent = ctx.parentElement || ctx.parentNode || ctx;
                if (typeof ResizeObserver !== 'undefined' && parent) {
                    const ro = new ResizeObserver(() => this.scheduleResize(id));
                    ro.observe(parent);
                    this.observers.set(id, ro);
                }
            } catch (roErr) {
                // ignore
            }

            return chart;
        } catch (err) {
            console.error(`[ChartManager] createChart(${id})`, err);
            return null;
        }
    }

    scheduleResize(id) {
        this.resizeQueue.add(id);
        if (!this.resizeScheduled) {
            this.resizeScheduled = true;
            requestAnimationFrame(() => {
                this.resizeQueue.forEach(cid => {
                    const c = this.charts.get(cid);
                    if (c && !c.destroyed) c.resize();
                });
                this.resizeQueue.clear();
                this.resizeScheduled = false;
            });
        }
    }

    queueUpdate(id, data) {
        // shallow-merge queued updates to reduce redundant updates
        const prev = this.updateQueue.get(id) || {};
        this.updateQueue.set(id, Object.assign({}, prev, data));

        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(() => this.processBatchUpdates());
        }
    }

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

    updateChartImmediate(id, newData) {
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return;

        const now = Date.now();
        const last = this.lastUpdateTime.get(id) || 0;
        if (now - last < this.updateThrottleTime) return;

        try {
            if (newData.labels) chart.data.labels = newData.labels;
            if (newData.datasets) chart.data.datasets = newData.datasets;

            // safe update
            chart.update(this.features.animations ? undefined : 'none');
            this.lastUpdateTime.set(id, now);
            this.dispatchEvent(new CustomEvent('chart:updated', { detail: { id, timestamp: now } }));
        } catch (err) {
            console.error(`[ChartManager] updateChartImmediate(${id})`, err);
        }
    }

    updateChart(id, newData) {
        if (this.features.autoUpdate) this.queueUpdate(id, newData);
        else this.updateChartImmediate(id, newData);
    }

    updateProposalCharts(proposals = []) {
        if (!Array.isArray(proposals) || proposals.length === 0) return;

        const stats = proposals.reduce((acc, p) => {
            acc.for += Number(p.forVotes || 0);
            acc.against += Number(p.againstVotes || 0);
            return acc;
        }, { for: 0, against: 0 });

        const totalVotes = stats.for + stats.against;
        const notVoted = Math.max(0, proposals.length * 10 - totalVotes);

        this.queueUpdate('governance', { datasets: [{ data: [stats.for, stats.against, notVoted], backgroundColor: [CHART_COLORS.SUCCESS, CHART_COLORS.DANGER, CHART_COLORS.SECONDARY] }] });

        const recent = proposals.slice(-4);
        this.queueUpdate('voteDistribution', {
            labels: recent.map(p => this.truncateText(p.title || '–', 18)),
            datasets: [
                { label: 'For', data: recent.map(p => Number(p.forVotes || 0)), backgroundColor: CHART_COLORS.SUCCESS },
                { label: 'Against', data: recent.map(p => Number(p.againstVotes || 0)), backgroundColor: CHART_COLORS.DANGER }
            ]
        });
    }

    truncateText(text = '', maxLength = 15) {
        return typeof text !== 'string' ? String(text) : (text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text);
    }

    updateAnalyticsCharts(analytics = {}) {
        const key = JSON.stringify(analytics || {});
        if (this.dataCache.has(key)) {
            this.queueUpdate('participation', this.dataCache.get(key));
            return;
        }

        const participationData = this.generateParticipationData(analytics);
        const updateData = { datasets: [{ label: 'Participation %', data: participationData, borderColor: CHART_COLORS.PRIMARY, backgroundColor: `${CHART_COLORS.PRIMARY}20` }] };

        this.dataCache.set(key, updateData);
        this.queueUpdate('participation', updateData);

        // limit cache size
        if (this.dataCache.size > 50) {
            const firstKey = this.dataCache.keys().next().value;
            this.dataCache.delete(firstKey);
        }
    }

    generateParticipationData(analytics = {}) {
        const totalVotes = analytics.totalVotes || 0;
        const totalMembers = analytics.totalMembers || Math.max(1, totalVotes);
        const base = totalVotes > 0 ? Math.min(80, (totalVotes / totalMembers) * 100) : 20;

        return Array.from({ length: 6 }, () => Math.max(10, Math.min(90, base + (Math.random() - 0.5) * 20)));
    }

    startUpdateLoop() {
        if (!this.features.autoUpdate) return;
        const loop = () => {
            if (this.updateQueue.size > 0) this.processBatchUpdates();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    stopUpdateLoop() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }

    animateChart(id, animationType = 'default') {
        if (!this.features.animations) return;
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return;

        // small set of predefined animations; applied to chart.options.animation then chart.update()
        const animations = {
            fade: { opacity: { duration: 600 } },
            scale: { x: { type: 'number', from: 0, duration: 600 } }
        };

        if (animations[animationType]) {
            chart.options.animation = animations[animationType];
            chart.update();
        }
    }

    exportChart(id, options = {}) {
        const { format = 'png', quality = 1.0, backgroundColor = '#ffffff' } = options;
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return null;

        try {
            // temporarily set background if needed
            if (backgroundColor && backgroundColor !== 'transparent') {
                const canvas = chart.canvas;
                const ctx = canvas.getContext('2d');

                // draw white background behind chart when exporting
                const w = canvas.width; const h = canvas.height;
                const temp = document.createElement('canvas');
                temp.width = w; temp.height = h;
                const tctx = temp.getContext('2d');
                tctx.fillStyle = backgroundColor;
                tctx.fillRect(0,0,w,h);
                tctx.drawImage(canvas, 0, 0);
                return temp.toDataURL(`image/${format}`, quality);
            }

            return chart.toBase64Image();
        } catch (err) {
            console.error(`[ChartManager] exportChart(${id})`, err);
            return null;
        }
    }

    async exportAllCharts(format = 'png') {
        const exports = [];
        for (const [id, chart] of this.charts) {
            if (!chart || chart.destroyed) continue;
            const dataUrl = this.exportChart(id, { format });
            if (dataUrl) exports.push({ id, dataUrl });
        }
        return exports;
    }

    getChartStats(id) {
        const chart = this.charts.get(id);
        if (!chart || chart.destroyed) return null;
        const datasets = chart.data.datasets || [];
        const all = datasets.flatMap(ds => Array.isArray(ds.data) ? ds.data : []);
        if (all.length === 0) return { datasetCount: datasets.length, totalDataPoints: 0, min: 0, max: 0, avg: 0 };

        const min = Math.min(...all);
        const max = Math.max(...all);
        const avg = all.reduce((a,b) => a + b, 0) / all.length;

        return { datasetCount: datasets.length, totalDataPoints: all.length, min, max, avg };
    }

    compareCharts(chartIds = []) {
        return chartIds.map(id => ({ id, stats: this.getChartStats(id), isValid: this.isChartValid(id) }));
    }

    setupResponsiveHandlers() {
        if (!this.features.responsiveResize) return;
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleOrientationChange);
    }

    onResize() { this.charts.forEach((_, id) => this.scheduleResize(id)); }
    onOrientationChange() { setTimeout(() => this.onResize(), 500); }

    destroyChart(id) {
        const chart = this.charts.get(id);
        const observer = this.observers.get(id);

        if (chart && !chart.destroyed) {
            try { chart.destroy(); } catch (err) { /* swallow */ }
            this.charts.delete(id);
        }

        if (observer) {
            try { observer.disconnect(); } catch (e) { }
            this.observers.delete(id);
        }

        this.chartConfigs.delete(id);
        this.dataCache.delete(id);
        this.lastUpdateTime.delete(id);
    }

    getChart(id) { return this.charts.get(id) || null; }
    isChartValid(id) { const c = this.charts.get(id); return !!c && !c.destroyed; }
    getAllChartIds() { return Array.from(this.charts.keys()); }

    debounce(func, wait = 250) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    cleanup() {
        for (const id of Array.from(this.charts.keys())) this.destroyChart(id);
        this.charts.clear();
        this.observers.clear();

        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleOrientationChange);

        if (this._lazyObserver) try { this._lazyObserver.disconnect(); } catch (e) {}

        this.isInitialized = false;
    }
}

export default ChartManager;
