// ============================================================
// CHART.JS GLOBAL DEFAULTS
// ============================================================
Chart.defaults.color = '#8F8F9D';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.elements.point.radius = 0;
Chart.defaults.elements.line.borderWidth = 2;
Chart.defaults.elements.line.tension = 0.4;
Chart.defaults.plugins.tooltip.mode = 'index';
Chart.defaults.plugins.tooltip.intersect = false;
Chart.defaults.plugins.legend.display = false;

// ============================================================
// TRACK STATE
// ============================================================
let currentTrackCoords = null;   // { x: [], y: [] } — raw from API
let trackAnimFrame = null;
let trackProgress = { d1: 0.0, d2: 0.05 };
let trackOpts = {};

// ============================================================
// LOAD TRACK FROM API
// Called whenever a race is selected
// ============================================================
async function loadTrackForRace(year, round, label, opts = {}) {
  const canvas = document.getElementById('track-canvas');
  if (!canvas) return;

  // Show loading state on canvas
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth || 600;
  canvas.height = parent.clientHeight || 280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Loading track...', canvas.width / 2, canvas.height / 2);

  try {
    const trackData = await APIService.getTrack(year, round);

    // Update circuit name label in UI
    const circuitHeader = document.getElementById('circuit-name');
    if (circuitHeader) circuitHeader.textContent = trackData.circuit_name || label || 'Circuit';

    // Store normalized coordinates
    currentTrackCoords = {
      x: trackData.coordinates.x,
      y: trackData.coordinates.y
    };

    // Start animation with new track
    startTrackAnimation('track-canvas', opts);
  } catch (e) {
    console.error('Track load error:', e);
    ctx.fillStyle = '#E10600';
    ctx.fillText('Track unavailable', canvas.width / 2, canvas.height / 2);
  }
}

// ============================================================
// DRAW TRACK using raw X/Y from API (auto-scales to canvas)
// ============================================================
function drawTrack(canvasId, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth || 600;
  canvas.height = parent.clientHeight || 280;
  const W = canvas.width;
  const H = canvas.height;

  const {
    color1 = '#3671C6',
    color2 = '#F91536',
    label1 = 'DRIVER 1',
    label2 = 'DRIVER 2',
    progress1 = 0,
    progress2 = 0.05,
    showComparison = true
  } = opts;

  ctx.clearRect(0, 0, W, H);

  // Use API coords if available, else hardcoded fallback
  const coords = currentTrackCoords;
  if (!coords || coords.x.length < 2) {
    drawFallbackTrack(ctx, W, H, color1, color2, label1, label2, progress1, progress2, showComparison);
    return;
  }

  // Downsample to max 400 points for performance
  const raw = downsample(coords.x, coords.y, 400);

  // Compute bounding box and map to canvas space
  const PAD = 44;
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;

  // Maintain aspect ratio
  const availW = W - PAD * 2, availH = H - PAD * 2;
  const scale = Math.min(availW / rangeX, availH / rangeY);
  const offX = PAD + (availW - rangeX * scale) / 2;
  const offY = PAD + (availH - rangeY * scale) / 2;

  function toCanvas([nx, ny]) {
    return [offX + (nx - minX) * scale, offY + (ny - minY) * scale];
  }

  const pts = raw.map(toCanvas);

  // Draw track layers
  drawPath(ctx, pts, { color: 'rgba(0,0,0,0.6)', width: 14, closed: false });
  drawPath(ctx, pts, { color: '#2a2a2e', width: 10, closed: false });

  if (showComparison) {
    drawPath(ctx, pts, { color: color2, width: 3.5, closed: false, glow: color2, glowStrength: 10, offset: 2.5 });
    drawPath(ctx, pts, { color: color1, width: 3.5, closed: false, glow: color1, glowStrength: 10, offset: -2.5 });
  } else {
    drawPath(ctx, pts, { color: color1, width: 4, closed: false, glow: color1, glowStrength: 14 });
  }

  // Start/finish hatching
  const sf = pts[0];
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(sf[0] - 5, sf[1] + 4);
  ctx.lineTo(sf[0] + 5, sf[1] - 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Driver position markers
  const pos1 = getPositionOnPath(pts, progress1);
  if (pos1) drawDriverDot(ctx, pos1, color1, label1, 'right');
  if (showComparison) {
    const pos2 = getPositionOnPath(pts, progress2);
    if (pos2) drawDriverDot(ctx, pos2, color2, label2, 'left');
  }
}

// ============================================================
// FALLBACK TRACK — elegant parametric loop when no API data
// ============================================================
function drawFallbackTrack(ctx, W, H, color1, color2, label1, label2, p1, p2, showComparison) {
  const PAD = 40;
  // Generate a looping shape from parametric path
  const pts = [];
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = PAD + ((Math.cos(t) * 0.45 + Math.cos(t * 2) * 0.15 + 0.5)) * (W - PAD * 2);
    const yf = Math.sin(t) * 0.40 + 0.5;
    const y = PAD + yf * (H - PAD * 2);
    pts.push([x, y]);
  }

  drawPath(ctx, pts, { color: 'rgba(0,0,0,0.6)', width: 14 });
  drawPath(ctx, pts, { color: '#2a2a2e', width: 10 });

  if (showComparison) {
    drawPath(ctx, pts, { color: color2, width: 3.5, glow: color2, glowStrength: 10, offset: 2.5 });
    drawPath(ctx, pts, { color: color1, width: 3.5, glow: color1, glowStrength: 10, offset: -2.5 });
  } else {
    drawPath(ctx, pts, { color: color1, width: 4, glow: color1, glowStrength: 14 });
  }

  const pos1 = getPositionOnPath(pts, p1);
  if (pos1) drawDriverDot(ctx, pos1, color1, label1, 'right');
  if (showComparison) {
    const pos2 = getPositionOnPath(pts, p2);
    if (pos2) drawDriverDot(ctx, pos2, color2, label2, 'left');
  }
}

// ============================================================
// HELPERS
// ============================================================
function downsample(xs, ys, maxPts) {
  const n = xs.length;
  if (n <= maxPts) return xs.map((x, i) => [x, ys[i]]);
  const step = Math.ceil(n / maxPts);
  const out = [];
  for (let i = 0; i < n; i += step) out.push([xs[i], ys[i]]);
  return out;
}

function drawPath(ctx, pts, { color, width, closed = false, glow, glowStrength = 8, offset = 0 }) {
  ctx.save();
  ctx.beginPath();

  const shifted = offset !== 0 ? pts.map((pt, i) => {
    const next = pts[(i + 1) % pts.length];
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const dx = next[0] - prev[0], dy = next[1] - prev[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [pt[0] - (dy / len) * offset, pt[1] + (dx / len) * offset];
  }) : pts;

  shifted.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  if (closed) ctx.closePath();

  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = glowStrength; }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function getPositionOnPath(pts, t) {
  if (!pts || pts.length < 2) return null;
  const clamped = Math.max(0, Math.min(0.9999, t));
  const n = pts.length - 1;
  const i = Math.min(Math.floor(clamped * n), n - 1);
  const frac = (clamped * n) - i;
  const [x1, y1] = pts[i], [x2, y2] = pts[i + 1] || pts[0];
  return [x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac];
}

function drawDriverDot(ctx, [x, y], color, label, labelSide = 'right') {
  // Outer glow ring
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.shadowColor = color; ctx.shadowBlur = 16;
  ctx.fillStyle = color + '55'; ctx.fill();
  ctx.restore();

  // Inner dot
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10;
  ctx.fill(); ctx.restore();

  // Label pill
  ctx.save();
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = labelSide === 'right' ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(label);
  const lw = metrics.width + 12, lh = 18;
  const lx = labelSide === 'right' ? x + 12 : x - 12;
  const rx = labelSide === 'right' ? lx - 4 : lx - lw + 4;

  ctx.fillStyle = 'rgba(0,0,0,0.80)';
  roundRect(ctx, rx, y - lh / 2, lw, lh, 4); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  roundRect(ctx, rx, y - lh / 2, lw, lh, 4); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillText(label, lx, y);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// ANIMATED DRIVER DOTS
// ============================================================
function startTrackAnimation(canvasId, opts = {}) {
  if (trackAnimFrame) { cancelAnimationFrame(trackAnimFrame); trackAnimFrame = null; }
  trackOpts = opts;
  trackProgress = { d1: 0.0, d2: 0.05 };

  function tick() {
    trackProgress.d1 = (trackProgress.d1 + 0.0008) % 1;
    trackProgress.d2 = (trackProgress.d2 + 0.00072) % 1;
    drawTrack(canvasId, {
      ...trackOpts,
      progress1: trackProgress.d1,
      progress2: trackProgress.d2
    });
    trackAnimFrame = requestAnimationFrame(tick);
  }
  tick();
}

// ============================================================
// CHARTS
// ============================================================
let speedChartInst = null, throttleChartInst = null;

function initCharts() {
  destroyCharts();
  const ctxSpeed = document.getElementById('speed-chart');
  const ctxThrottle = document.getElementById('throttle-chart');
  if (!ctxSpeed || !ctxThrottle) return;

  const gridColor = 'rgba(255,255,255,0.05)';
  const commonOpts = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    scales: {
      x: { display: false },
      y: { grid: { color: gridColor }, ticks: { color: '#8F8F9D' } }
    },
    plugins: { legend: { display: true, labels: { color: '#fff', boxWidth: 12, font: { size: 11 } } } }
  };

  speedChartInst = new Chart(ctxSpeed, { type: 'line', data: { labels: [], datasets: [] }, options: { ...commonOpts } });
  throttleChartInst = new Chart(ctxThrottle, {
    type: 'line', data: { labels: [], datasets: [] },
    options: { ...commonOpts, scales: { x: { display: false }, y: { max: 110, min: 0, grid: { color: gridColor }, ticks: { color: '#8F8F9D' } } } }
  });
}

function destroyCharts() {
  if (speedChartInst) { speedChartInst.destroy(); speedChartInst = null; }
  if (throttleChartInst) { throttleChartInst.destroy(); throttleChartInst = null; }
}

function updateCharts(data1, data2, color1 = '#3671C6', color2 = '#F91536', name1 = 'Driver 1', name2 = 'Driver 2') {
  if (!speedChartInst) initCharts();

  // data1/data2 can be arrays of telemetry objects or flat arrays
  const toArr = (data, key) => Array.isArray(data) ? data.map(d => d[key] ?? 0) : (data[key] || []);

  const speed1 = toArr(data1, 'speed');
  const labels = speed1.map((_, i) => i);

  speedChartInst.data.labels = labels;
  speedChartInst.data.datasets = [
    { label: name1, data: speed1, borderColor: color1, backgroundColor: color1 + '22', fill: true, pointRadius: 0, borderWidth: 2 },
    ...(data2 ? [{ label: name2, data: toArr(data2, 'speed'), borderColor: color2, backgroundColor: 'transparent', fill: false, pointRadius: 0, borderWidth: 2 }] : [])
  ];
  speedChartInst.update();

  throttleChartInst.data.labels = labels;
  throttleChartInst.data.datasets = [
    { label: `${name1} Throttle`, data: toArr(data1, 'throttle'), borderColor: '#00b050', backgroundColor: '#00b05033', fill: true, stepped: true, pointRadius: 0, borderWidth: 1.5 },
    { label: `${name1} Brake`, data: toArr(data1, 'brake'), borderColor: color1, backgroundColor: color1 + '22', fill: true, stepped: true, pointRadius: 0, borderWidth: 1.5 },
    ...(data2 ? [{ label: `${name2} Throttle`, data: toArr(data2, 'throttle'), borderColor: color2, fill: false, stepped: true, pointRadius: 0, borderWidth: 1.5 }] : [])
  ];
  throttleChartInst.update();
}

// ============================================================
// EXPORTED API
// ============================================================
window.ChartEngine = {
  initCharts, destroyCharts, updateCharts,
  drawTrack, startTrackAnimation, loadTrackForRace,
  loadDemoData: () => {
    startTrackAnimation('track-canvas', {
      color1: '#3671C6', color2: '#F91536',
      label1: 'DRIVER 1', label2: 'DRIVER 2',
      showComparison: true
    });
  }
};
