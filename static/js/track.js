/**
 * F1 Track Visualization
 * Renders the track map with per-point comparison coloring.
 */
import F1DashAPI from './api.js';

class TrackVisualizer {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);

        if (!this.container) {
            console.error(`Container with ID "${containerId}" not found`);
            return;
        }

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.trackData = null;
        this.comparisonData = null;
        this.isLoading = false;
        this.error = null;
        this.singleDriverColor = '#e10600';

        // Per-point color array (one color per track coordinate)
        this.pointColors = null;

        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        window.addEventListener('resize', this.handleResize.bind(this));
        this.showMessage('Select data to display track visualization');
    }

    handleResize() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        if (this.error) {
            this.showError(this.error);
        } else if (this.isLoading) {
            this.showLoading();
        } else if (this.trackData) {
            this.render();
        } else {
            this.showMessage('Select data to display track visualization');
        }
    }

    showMessage(message) {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    }

    async loadTrack(year, round) {
        try {
            if (this.isLoading) return;
            this.isLoading = true;
            this.error = null;
            this.trackData = null;
            this.showLoading();

            const trackData = await F1DashAPI.getTrackData(year, round);

            if (!trackData.coordinates ||
                !trackData.coordinates.x ||
                !trackData.coordinates.y ||
                trackData.coordinates.x.length === 0) {
                throw new Error('Track data is unavailable or incomplete');
            }

            this.trackData = trackData;
            this.isLoading = false;
            this.render();
            return true;
        } catch (error) {
            console.error('Error loading track:', error);
            this.error = error.message;
            this.showError(error.message);
            this.isLoading = false;
            return false;
        }
    }

    /**
     * Build a per-track-point color array by interpolating both drivers'
     * cumulative time at each distance along the track.
     */
    _buildPointColors(data) {
        if (!this.trackData || !data) return null;

        const { coordinates } = this.trackData;
        const n = coordinates.x.length;
        const c1 = data.driver1.color || '#e10600';
        const c2 = data.driver2.color || '#3671C6';

        const d1 = data.driver1.data;
        const d2 = data.driver2.data;

        if (!d1.distance || !d2.distance || d1.distance.length < 2 || d2.distance.length < 2) {
            return null;
        }

        // Build distance array for track coordinates
        const trackDist = new Float64Array(n);
        trackDist[0] = 0;
        for (let i = 1; i < n; i++) {
            const dx = coordinates.x[i] - coordinates.x[i - 1];
            const dy = coordinates.y[i] - coordinates.y[i - 1];
            trackDist[i] = trackDist[i - 1] + Math.sqrt(dx * dx + dy * dy);
        }
        const totalTrackDist = trackDist[n - 1] || 1;

        // Normalize track distances to [0, 1]
        const trackFrac = new Float64Array(n);
        for (let i = 0; i < n; i++) trackFrac[i] = trackDist[i] / totalTrackDist;

        // Normalize telemetry distances to [0, 1]
        const maxDist1 = d1.distance[d1.distance.length - 1] || 1;
        const maxDist2 = d2.distance[d2.distance.length - 1] || 1;

        const frac1 = d1.distance.map(d => d / maxDist1);
        const frac2 = d2.distance.map(d => d / maxDist2);

        // Interpolate time at a given fractional distance
        function interpTime(fracArr, timeArr, f) {
            if (f <= fracArr[0]) return timeArr[0];
            if (f >= fracArr[fracArr.length - 1]) return timeArr[timeArr.length - 1];
            let lo = 0, hi = fracArr.length - 1;
            while (hi - lo > 1) {
                const mid = (lo + hi) >> 1;
                if (fracArr[mid] <= f) lo = mid; else hi = mid;
            }
            const t = (f - fracArr[lo]) / ((fracArr[hi] - fracArr[lo]) || 1);
            return timeArr[lo] + t * (timeArr[hi] - timeArr[lo]);
        }

        const colors = new Array(n);
        for (let i = 0; i < n; i++) {
            const f = trackFrac[i];
            const t1 = interpTime(frac1, d1.time, f);
            const t2 = interpTime(frac2, d2.time, f);
            colors[i] = t1 <= t2 ? c1 : c2;
        }
        return colors;
    }

    setComparisonData(data) {
        if (!data) return;
        this.comparisonData = data;
        this.pointColors = this._buildPointColors(data);
        this.render();
    }

    setSingleDriverColor(color) {
        this.singleDriverColor = color || '#e10600';
        this.comparisonData = null;
        this.pointColors = null;
        this.render();
    }

    render() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!this.trackData) {
            this.showMessage('Track data not available');
            return;
        }

        const { coordinates } = this.trackData;
        if (!coordinates || !coordinates.x || !coordinates.y || coordinates.x.length === 0) {
            this.showMessage('Track layout data not available');
            return;
        }

        const n = coordinates.x.length;

        // 90-degree clockwise rotation + vertical flip: (x,y) -> (-y, -x)
        const rotX = coordinates.y.map(y => -y);
        const rotY = coordinates.x.map(x => -x);

        const minX = Math.min(...rotX);
        const maxX = Math.max(...rotX);
        const minY = Math.min(...rotY);
        const maxY = Math.max(...rotY);

        const padding = 20;
        const scaleX = (canvas.width - 2 * padding) / (maxX - minX || 1);
        const scaleY = (canvas.height - 2 * padding) / (maxY - minY || 1);
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (canvas.width - scale * (maxX - minX)) / 2 - scale * minX;
        const offsetY = (canvas.height - scale * (maxY - minY)) / 2 - scale * minY;

        const tx = (x, y) => (-y) * scale + offsetX;
        const ty = (x, y) => (-x) * scale + offsetY;

        // Dark base track
        ctx.beginPath();
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(tx(coordinates.x[0], coordinates.y[0]), ty(coordinates.x[0], coordinates.y[0]));
        for (let i = 1; i < n; i++) {
            ctx.lineTo(tx(coordinates.x[i], coordinates.y[i]), ty(coordinates.x[i], coordinates.y[i]));
        }
        if (Math.abs(coordinates.x[0] - coordinates.x[n - 1]) > 0.1 ||
            Math.abs(coordinates.y[0] - coordinates.y[n - 1]) > 0.1) {
            ctx.lineTo(tx(coordinates.x[0], coordinates.y[0]), ty(coordinates.x[0], coordinates.y[0]));
        }
        ctx.stroke();

        // Colored overlay — per-point when comparison, uniform when single driver
        if (this.pointColors && this.pointColors.length === n) {
            // Draw segment-by-segment, batching consecutive same-color segments
            let curColor = this.pointColors[0];
            ctx.beginPath();
            ctx.strokeStyle = curColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(tx(coordinates.x[0], coordinates.y[0]), ty(coordinates.x[0], coordinates.y[0]));

            for (let i = 1; i < n; i++) {
                const c = this.pointColors[i];
                if (c !== curColor) {
                    // Finish current batch
                    ctx.lineTo(tx(coordinates.x[i], coordinates.y[i]), ty(coordinates.x[i], coordinates.y[i]));
                    ctx.stroke();
                    // Start new batch
                    curColor = c;
                    ctx.beginPath();
                    ctx.strokeStyle = curColor;
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.moveTo(tx(coordinates.x[i], coordinates.y[i]), ty(coordinates.x[i], coordinates.y[i]));
                } else {
                    ctx.lineTo(tx(coordinates.x[i], coordinates.y[i]), ty(coordinates.x[i], coordinates.y[i]));
                }
            }
            // Close the loop back to start
            ctx.lineTo(tx(coordinates.x[0], coordinates.y[0]), ty(coordinates.x[0], coordinates.y[0]));
            ctx.stroke();
        } else {
            // Single driver — uniform color
            const color = this.singleDriverColor || '#e10600';
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(tx(coordinates.x[0], coordinates.y[0]), ty(coordinates.x[0], coordinates.y[0]));
            for (let i = 1; i < n; i++) {
                ctx.lineTo(tx(coordinates.x[i], coordinates.y[i]), ty(coordinates.x[i], coordinates.y[i]));
            }
            // Close the loop back to start
            ctx.lineTo(tx(coordinates.x[0], coordinates.y[0]), ty(coordinates.x[0], coordinates.y[0]));
            ctx.stroke();
        }

        // Start/finish marker
        const startX = tx(coordinates.x[0], coordinates.y[0]);
        const startY = ty(coordinates.x[0], coordinates.y[0]);
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(startX, startY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '10px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('S/F', startX, startY - 8);
    }

    showLoading() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading track data...', this.canvas.width / 2, this.canvas.height / 2);
    }

    showError(message) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#ff3333';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Error: ${message}`, this.canvas.width / 2, this.canvas.height / 2);
    }
}

export default TrackVisualizer;
