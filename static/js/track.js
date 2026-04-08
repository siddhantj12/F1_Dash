/**
 * F1 Track Visualization
 * Renders the track map with per-point comparison coloring and hover tooltips.
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

        this.pointColors = null;

        // Cached canvas-space coordinates for hit testing
        this._canvasPoints = null;
        this._trackFrac = null;
        this._interpData = null;

        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.container.style.position = 'relative';
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        // Tooltip element
        this._tooltip = document.createElement('div');
        Object.assign(this._tooltip.style, {
            position: 'absolute', pointerEvents: 'none', display: 'none',
            background: 'rgba(10,10,13,0.92)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px', padding: '8px 12px', fontSize: '11px',
            fontFamily: "'Inter', sans-serif", color: '#F0F0F5', zIndex: '10',
            lineHeight: '1.6', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        });
        this.container.appendChild(this._tooltip);

        // Crosshair dot
        this._dot = document.createElement('div');
        Object.assign(this._dot.style, {
            position: 'absolute', pointerEvents: 'none', display: 'none',
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#fff', border: '2px solid rgba(255,255,255,0.6)',
            transform: 'translate(-50%,-50%)', zIndex: '11',
            boxShadow: '0 0 8px rgba(255,255,255,0.4)',
        });
        this.container.appendChild(this._dot);

        this.canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
        this.canvas.addEventListener('mouseleave', this._onMouseLeave.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
        this.showMessage('Select data to display track visualization');
    }

    // ── Hover logic ──────────────────────────────────────────────

    _onMouseMove(e) {
        if (!this._canvasPoints || this._canvasPoints.length === 0) return;

        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Find closest track point
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < this._canvasPoints.length; i++) {
            const dx = this._canvasPoints[i].cx - mx;
            const dy = this._canvasPoints[i].cy - my;
            const d = dx * dx + dy * dy;
            if (d < bestDist) { bestDist = d; bestIdx = i; }
        }

        if (Math.sqrt(bestDist) > 30) {
            this._tooltip.style.display = 'none';
            this._dot.style.display = 'none';
            return;
        }

        const pt = this._canvasPoints[bestIdx];

        // Show dot
        this._dot.style.display = 'block';
        this._dot.style.left = pt.cx + 'px';
        this._dot.style.top = pt.cy + 'px';

        // Build tooltip content
        let html = '';
        const pct = ((this._trackFrac[bestIdx] || 0) * 100).toFixed(0);
        html += `<div style="color:var(--text-secondary);margin-bottom:2px;">Track ${pct}%</div>`;

        if (this._interpData && this.comparisonData) {
            const d = this._interpData[bestIdx];
            const d1 = this.comparisonData.driver1;
            const d2 = this.comparisonData.driver2;
            const c1 = d1.color || '#e10600';
            const c2 = d2.color || '#3671C6';

            const fmtSpd = v => v != null ? v.toFixed(0) + ' km/h' : '—';
            const delta = d.t1 != null && d.t2 != null ? (d.t1 - d.t2) : null;
            const deltaStr = delta != null
                ? (delta < 0 ? `<span style="color:${c1}">${d1.code} +${Math.abs(delta).toFixed(3)}s</span>`
                             : `<span style="color:${c2}">${d2.code} +${Math.abs(delta).toFixed(3)}s</span>`)
                : '—';

            html += `<div><span style="color:${c1}">■</span> ${d1.code}: ${fmtSpd(d.spd1)}</div>`;
            html += `<div><span style="color:${c2}">■</span> ${d2.code}: ${fmtSpd(d.spd2)}</div>`;
            html += `<div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:3px;padding-top:3px;">Δ ${deltaStr}</div>`;
        } else if (this._interpData) {
            const d = this._interpData[bestIdx];
            html += `<div>Speed: ${d.spd1 != null ? d.spd1.toFixed(0) + ' km/h' : '—'}</div>`;
        }

        this._tooltip.innerHTML = html;
        this._tooltip.style.display = 'block';

        // Position tooltip near cursor, offset to avoid covering the dot
        const tipW = this._tooltip.offsetWidth;
        const tipH = this._tooltip.offsetHeight;
        let tipX = pt.cx + 14;
        let tipY = pt.cy - tipH - 10;
        if (tipX + tipW > this.canvas.width) tipX = pt.cx - tipW - 14;
        if (tipY < 0) tipY = pt.cy + 14;
        this._tooltip.style.left = tipX + 'px';
        this._tooltip.style.top = tipY + 'px';
    }

    _onMouseLeave() {
        this._tooltip.style.display = 'none';
        this._dot.style.display = 'none';
    }

    // ── Interpolation helpers ────────────────────────────────────

    static _interp(fracArr, valArr, f) {
        if (!fracArr || fracArr.length === 0) return null;
        if (f <= fracArr[0]) return valArr[0];
        if (f >= fracArr[fracArr.length - 1]) return valArr[valArr.length - 1];
        let lo = 0, hi = fracArr.length - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (fracArr[mid] <= f) lo = mid; else hi = mid;
        }
        const t = (f - fracArr[lo]) / ((fracArr[hi] - fracArr[lo]) || 1);
        return valArr[lo] + t * (valArr[hi] - valArr[lo]);
    }

    _buildInterpData(data) {
        if (!this._trackFrac || !data) return null;
        const n = this._trackFrac.length;
        const d1 = data.driver1.data;
        const d2 = data.driver2?.data;

        const maxD1 = d1.distance?.[d1.distance.length - 1] || 1;
        const frac1 = d1.distance?.map(d => d / maxD1);

        let frac2, maxD2;
        if (d2?.distance) {
            maxD2 = d2.distance[d2.distance.length - 1] || 1;
            frac2 = d2.distance.map(d => d / maxD2);
        }

        const arr = new Array(n);
        for (let i = 0; i < n; i++) {
            const f = this._trackFrac[i];
            arr[i] = {
                t1:   frac1 ? TrackVisualizer._interp(frac1, d1.time, f) : null,
                spd1: frac1 ? TrackVisualizer._interp(frac1, d1.speed, f) : null,
                t2:   frac2 ? TrackVisualizer._interp(frac2, d2.time, f) : null,
                spd2: frac2 ? TrackVisualizer._interp(frac2, d2.speed, f) : null,
            };
        }
        return arr;
    }

    // ── Core methods ─────────────────────────────────────────────

    handleResize() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        if (this.error) this.showError(this.error);
        else if (this.isLoading) this.showLoading();
        else if (this.trackData) this.render();
        else this.showMessage('Select data to display track visualization');
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
            if (!trackData.coordinates?.x?.length) {
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

    _buildPointColors(data) {
        if (!this.trackData || !data) return null;
        const { coordinates } = this.trackData;
        const n = coordinates.x.length;
        const c1 = data.driver1.color || '#e10600';
        const c2 = data.driver2.color || '#3671C6';
        const d1 = data.driver1.data;
        const d2 = data.driver2.data;

        if (!d1.distance || !d2.distance || d1.distance.length < 2 || d2.distance.length < 2) return null;

        // Build trackFrac (also used by hover)
        const trackDist = new Float64Array(n);
        for (let i = 1; i < n; i++) {
            const dx = coordinates.x[i] - coordinates.x[i - 1];
            const dy = coordinates.y[i] - coordinates.y[i - 1];
            trackDist[i] = trackDist[i - 1] + Math.sqrt(dx * dx + dy * dy);
        }
        const total = trackDist[n - 1] || 1;
        this._trackFrac = new Float64Array(n);
        for (let i = 0; i < n; i++) this._trackFrac[i] = trackDist[i] / total;

        const maxD1 = d1.distance[d1.distance.length - 1] || 1;
        const maxD2 = d2.distance[d2.distance.length - 1] || 1;
        const frac1 = d1.distance.map(d => d / maxD1);
        const frac2 = d2.distance.map(d => d / maxD2);

        const colors = new Array(n);
        for (let i = 0; i < n; i++) {
            const f = this._trackFrac[i];
            const t1 = TrackVisualizer._interp(frac1, d1.time, f);
            const t2 = TrackVisualizer._interp(frac2, d2.time, f);
            colors[i] = t1 <= t2 ? c1 : c2;
        }
        return colors;
    }

    setComparisonData(data) {
        if (!data) return;
        this.comparisonData = data;
        this.pointColors = this._buildPointColors(data);
        this._interpData = this._buildInterpData(data);
        this.render();
    }

    setSingleDriverColor(color) {
        this.singleDriverColor = color || '#e10600';
        this.comparisonData = null;
        this.pointColors = null;
        this._interpData = null;
        this.render();
    }

    render() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!this.trackData) { this.showMessage('Track data not available'); return; }
        const { coordinates } = this.trackData;
        if (!coordinates?.x?.length) { this.showMessage('Track layout data not available'); return; }

        const n = coordinates.x.length;

        const rotX = coordinates.y.map(y => -y);
        const rotY = coordinates.x.map(x => -x);

        const minX = Math.min(...rotX), maxX = Math.max(...rotX);
        const minY = Math.min(...rotY), maxY = Math.max(...rotY);

        const padding = 20;
        const scale = Math.min(
            (canvas.width - 2 * padding) / (maxX - minX || 1),
            (canvas.height - 2 * padding) / (maxY - minY || 1)
        );
        const offsetX = (canvas.width - scale * (maxX - minX)) / 2 - scale * minX;
        const offsetY = (canvas.height - scale * (maxY - minY)) / 2 - scale * minY;

        const tx = (x, y) => (-y) * scale + offsetX;
        const ty = (x, y) => (-x) * scale + offsetY;

        // Cache canvas-space points for hit testing
        this._canvasPoints = new Array(n);
        for (let i = 0; i < n; i++) {
            this._canvasPoints[i] = { cx: tx(coordinates.x[i], coordinates.y[i]), cy: ty(coordinates.x[i], coordinates.y[i]) };
        }

        // Build trackFrac if not already built (single driver mode)
        if (!this._trackFrac || this._trackFrac.length !== n) {
            const dist = new Float64Array(n);
            for (let i = 1; i < n; i++) {
                const dx = coordinates.x[i] - coordinates.x[i - 1];
                const dy = coordinates.y[i] - coordinates.y[i - 1];
                dist[i] = dist[i - 1] + Math.sqrt(dx * dx + dy * dy);
            }
            const total = dist[n - 1] || 1;
            this._trackFrac = new Float64Array(n);
            for (let i = 0; i < n; i++) this._trackFrac[i] = dist[i] / total;
        }

        // Dark base track
        ctx.beginPath();
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(this._canvasPoints[0].cx, this._canvasPoints[0].cy);
        for (let i = 1; i < n; i++) ctx.lineTo(this._canvasPoints[i].cx, this._canvasPoints[i].cy);
        ctx.lineTo(this._canvasPoints[0].cx, this._canvasPoints[0].cy);
        ctx.stroke();

        // Colored overlay
        if (this.pointColors && this.pointColors.length === n) {
            let curColor = this.pointColors[0];
            ctx.beginPath();
            ctx.strokeStyle = curColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(this._canvasPoints[0].cx, this._canvasPoints[0].cy);

            for (let i = 1; i < n; i++) {
                const c = this.pointColors[i];
                if (c !== curColor) {
                    ctx.lineTo(this._canvasPoints[i].cx, this._canvasPoints[i].cy);
                    ctx.stroke();
                    curColor = c;
                    ctx.beginPath();
                    ctx.strokeStyle = curColor;
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.moveTo(this._canvasPoints[i].cx, this._canvasPoints[i].cy);
                } else {
                    ctx.lineTo(this._canvasPoints[i].cx, this._canvasPoints[i].cy);
                }
            }
            ctx.lineTo(this._canvasPoints[0].cx, this._canvasPoints[0].cy);
            ctx.stroke();
        } else {
            const color = this.singleDriverColor || '#e10600';
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(this._canvasPoints[0].cx, this._canvasPoints[0].cy);
            for (let i = 1; i < n; i++) ctx.lineTo(this._canvasPoints[i].cx, this._canvasPoints[i].cy);
            ctx.lineTo(this._canvasPoints[0].cx, this._canvasPoints[0].cy);
            ctx.stroke();
        }

        // S/F marker
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(this._canvasPoints[0].cx, this._canvasPoints[0].cy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '10px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('S/F', this._canvasPoints[0].cx, this._canvasPoints[0].cy - 8);
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
