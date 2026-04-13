import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Trail } from "@remotion/motion-blur";

// ─── Brand tokens ───────────────────────────────────────────────────────────
const C = {
  red: "#E10600",
  black: "#0C0C10",
  white: "#F0F0F5",
  mclaren: "#FF8000",
  ferrari: "#F91536",
  mercedes: "#6CD3BF",
  dimGray: "#1A1A22",
  panel: "#14141C",
  border: "rgba(255,255,255,0.07)",
} as const;

const FONT_HEAD = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Inter', sans-serif";

// ─── Easing helper ──────────────────────────────────────────────────────────
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

function lerp(frame: number, inRange: [number, number], outRange: [number, number]) {
  return interpolate(frame, inRange, outRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
}

function spr(frame: number, fps: number, delay = 0) {
  return spring({
    fps,
    frame: frame - delay,
    config: { stiffness: 120, damping: 14 },
    durationInFrames: 45,
  });
}

// ─── Shared components ───────────────────────────────────────────────────────

/** Horizontal red rule that sweeps left→right */
function RedSweep({ startFrame, width = "100%" }: { startFrame: number; width?: string | number }) {
  const frame = useCurrentFrame();
  const scaleX = lerp(frame, [startFrame, startFrame + 18], [0, 1]);
  return (
    <div
      style={{
        height: 2,
        background: `linear-gradient(90deg, ${C.red} 0%, #FF4020 60%, transparent 100%)`,
        transformOrigin: "left center",
        transform: `scaleX(${scaleX})`,
        width,
        borderRadius: 1,
      }}
    />
  );
}

/** Horizontal slice-wipe overlay — covers then reveals, for scene transitions */
function SliceWipe({ triggerFrame, color = C.black }: { triggerFrame: number; color?: string }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Slide in from left (covers), then slide out to right (reveals next scene)
  const x = lerp(frame, [triggerFrame, triggerFrame + 8], [-width, 0]);
  const x2 = lerp(frame, [triggerFrame + 8, triggerFrame + 16], [0, width]);
  const translateX = frame < triggerFrame + 8 ? x : x2;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        background: color,
        transform: `translateX(${translateX}px)`,
        zIndex: 100,
        pointerEvents: "none",
      }}
    />
  );
}

/** Noise/grain texture overlay */
function Grain() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
        opacity: 0.35,
        mixBlendMode: "overlay",
        pointerEvents: "none",
        zIndex: 99,
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 1 — Cold Open (frames 0–120 = 0–2s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene1ColdOpen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo slams in: scale 0.8→1, opacity 0→1
  const logoScale = lerp(frame, [0, 24], [0.8, 1]);
  const logoOpacity = lerp(frame, [0, 12], [0, 1]);

  // "F1 CORE" wordmark
  const coreOpacity = lerp(frame, [8, 28], [0, 1]);
  const coreY = lerp(frame, [8, 28], [12, 0]);

  // Red badge: TELEMETRY PLATFORM
  const badgeOpacity = lerp(frame, [22, 40], [0, 1]);

  // Tagline
  const tagOpacity = lerp(frame, [35, 55], [0, 1]);
  const tagY = lerp(frame, [35, 55], [8, 0]);

  // Radial glow behind logo
  const glowOpacity = lerp(frame, [0, 30], [0, 0.6]);

  return (
    <AbsoluteFill style={{ background: C.black, alignItems: "center", justifyContent: "center" }}>
      <Grain />

      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(225,6,0,0.18) 0%, transparent 70%)`,
          opacity: glowOpacity,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Logo block */}
        <Trail layers={4} lagInFrames={0.5} trailOpacity={0.15}>
          <div
            style={{
              transform: `scale(${logoScale})`,
              opacity: logoOpacity,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0,
            }}
          >
            {/* F1 flag-style mark */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
              {/* Chequered F1 icon */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: `
                    linear-gradient(45deg, ${C.red} 25%, transparent 25%) 0 0,
                    linear-gradient(-45deg, ${C.red} 25%, transparent 25%) 0 8px,
                    linear-gradient(45deg, transparent 75%, ${C.red} 75%) 0 8px,
                    linear-gradient(-45deg, transparent 75%, ${C.red} 75%) 0 0
                  `,
                  backgroundColor: C.white,
                  backgroundSize: "16px 16px",
                  borderRadius: 6,
                }}
              />
              <div
                style={{
                  fontFamily: FONT_HEAD,
                  fontSize: 72,
                  fontWeight: 800,
                  color: C.white,
                  letterSpacing: "-1px",
                  lineHeight: 1,
                }}
              >
                F1
              </div>
            </div>

            <div
              style={{
                opacity: coreOpacity,
                transform: `translateY(${coreY}px)`,
                fontFamily: FONT_HEAD,
                fontSize: 56,
                fontWeight: 800,
                color: C.red,
                letterSpacing: "14px",
                textTransform: "uppercase",
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              CORE
            </div>
          </div>
        </Trail>

        {/* Red sweep line */}
        <div style={{ width: 320, marginTop: 16, marginBottom: 16 }}>
          <RedSweep startFrame={18} width="100%" />
        </div>

        {/* Badge */}
        <div
          style={{
            opacity: badgeOpacity,
            background: `rgba(225,6,0,0.12)`,
            border: `1px solid rgba(225,6,0,0.4)`,
            borderRadius: 100,
            padding: "5px 16px",
            fontFamily: FONT_HEAD,
            fontSize: 15,
            fontWeight: 700,
            color: C.red,
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          TELEMETRY PLATFORM
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
            marginTop: 18,
            fontFamily: FONT_BODY,
            fontSize: 17,
            fontWeight: 400,
            color: "rgba(240,240,245,0.55)",
            letterSpacing: "0.5px",
          }}
        >
          Real F1 data. Every lap. Every driver.
        </div>
      </div>

      {/* Bottom corner accent lines */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, rgba(225,6,0,0.3) 50%, transparent 100%)`,
          opacity: lerp(frame, [40, 60], [0, 1]),
        }}
      />
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 2a — Driver Selector Card (frames 120–198 ≈ 2–3.3s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene2aDriverCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardY = 60 * (1 - spr(frame, fps, 0));
  const cardOpacity = lerp(frame, [0, 12], [0, 1]);

  // Orange shimmer pulse
  const shimmer = Math.sin((frame / 60) * Math.PI * 2) * 0.5 + 0.5;

  const drivers = [
    { num: "4", code: "NOR", name: "Lando Norris", team: "McLaren", color: C.mclaren, active: true },
    { num: "16", code: "LEC", name: "Charles Leclerc", team: "Ferrari", color: C.ferrari, active: false },
    { num: "44", code: "HAM", name: "Lewis Hamilton", team: "Mercedes", color: C.mercedes, active: false },
  ];

  return (
    <AbsoluteFill style={{ background: C.black, alignItems: "center", justifyContent: "center" }}>
      <Grain />

      {/* Scan-line grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.02) 40px)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
          width: 640,
          background: C.panel,
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: `0 0 0 1px rgba(225,6,0,0.2), 0 32px 80px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red }} />
          <span style={{ fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "2px", textTransform: "uppercase" }}>
            PRIMARY DRIVER
          </span>
        </div>

        {/* Driver list */}
        <div style={{ padding: "12px 0" }}>
          {drivers.map((d, i) => {
            const rowOpacity = lerp(frame, [i * 6, i * 6 + 12], [0, 1]);
            const rowX = lerp(frame, [i * 6, i * 6 + 14], [-20, 0]);
            const isActive = d.active;

            return (
              <div
                key={d.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 24px",
                  background: isActive
                    ? `linear-gradient(90deg, rgba(${d.color === C.mclaren ? "255,128,0" : "0,0,0"},0.12) 0%, transparent 100%)`
                    : "transparent",
                  borderLeft: isActive ? `3px solid ${d.color}` : "3px solid transparent",
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                }}
              >
                {/* Number */}
                <div
                  style={{
                    fontFamily: FONT_HEAD,
                    fontSize: 32,
                    fontWeight: 800,
                    color: isActive ? d.color : "rgba(255,255,255,0.2)",
                    width: 48,
                    lineHeight: 1,
                  }}
                >
                  {d.num}
                </div>

                {/* Code + Name */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: FONT_HEAD,
                      fontSize: 22,
                      fontWeight: 800,
                      color: isActive ? C.white : "rgba(255,255,255,0.4)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {d.code}
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                    {d.name}
                  </div>
                </div>

                {/* Team badge */}
                <div
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 11,
                    fontWeight: 600,
                    color: isActive ? d.color : "rgba(255,255,255,0.2)",
                    background: isActive ? `rgba(${d.color === C.mclaren ? "255,128,0" : d.color === C.ferrari ? "249,21,54" : "108,211,191"},0.1)` : "transparent",
                    padding: "3px 10px",
                    borderRadius: 100,
                    border: `1px solid ${isActive ? d.color + "40" : "transparent"}`,
                  }}
                >
                  {d.team}
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: d.color,
                      boxShadow: `0 0 ${8 + shimmer * 8}px ${d.color}`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* McLaren orange glow at bottom */}
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent 0%, ${C.mclaren} 50%, transparent 100%)`,
            opacity: 0.4 + shimmer * 0.4,
          }}
        />
      </div>

      {/* Corner label */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 60,
          fontFamily: FONT_HEAD,
          fontSize: 11,
          fontWeight: 700,
          color: "rgba(255,255,255,0.2)",
          letterSpacing: "3px",
          textTransform: "uppercase",
          opacity: lerp(frame, [5, 20], [0, 1]),
        }}
      >
        SESSION: BAHRAIN GP · RACE · 2025
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 2b — Track Map (frames 198–276 ≈ 3.3–4.6s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene2bTrackMap() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = lerp(frame, [0, 10], [0, 1]);

  // Bahrain simplified track path (normalized 0–1 SVG path)
  const trackPoints = [
    [0.5, 0.15], [0.62, 0.12], [0.75, 0.18], [0.82, 0.28],
    [0.80, 0.42], [0.72, 0.50], [0.68, 0.58], [0.72, 0.66],
    [0.78, 0.72], [0.75, 0.80], [0.64, 0.85], [0.52, 0.85],
    [0.40, 0.80], [0.32, 0.72], [0.28, 0.62], [0.22, 0.55],
    [0.18, 0.45], [0.22, 0.35], [0.28, 0.28], [0.36, 0.20],
    [0.5, 0.15],
  ] as [number, number][];

  const W = 640;
  const H = 640;

  // Build SVG path
  const pathD = trackPoints
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x * W} ${y * H}`)
    .join(" ") + " Z";

  // Car position along track (0→1 over scene)
  const progress = lerp(frame, [0, 78], [0, 1]);
  const idx = Math.floor(progress * (trackPoints.length - 1));
  const frac = (progress * (trackPoints.length - 1)) % 1;
  const p0 = trackPoints[Math.min(idx, trackPoints.length - 1)];
  const p1 = trackPoints[Math.min(idx + 1, trackPoints.length - 1)];
  const carX = (p0[0] + (p1[0] - p0[0]) * frac) * W;
  const carY = (p0[1] + (p1[1] - p0[1]) * frac) * H;

  // Speed color for heatmap segments
  const speedColors = ["#3671C6", "#3671C6", "#00E676", "#00E676", C.mclaren, C.mclaren, C.red, C.red, C.mclaren, "#00E676", "#3671C6", "#3671C6", "#00E676", C.mclaren, C.mclaren, C.red, C.red, "#00E676", "#3671C6", "#3671C6"];

  const cardScale = spr(frame, fps, 0);

  return (
    <AbsoluteFill style={{ background: C.black, alignItems: "center", justifyContent: "center", opacity: sceneOpacity }}>
      <Grain />

      <div
        style={{
          transform: `scale(${0.88 + cardScale * 0.12})`,
          width: 680,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: `0 0 0 1px rgba(225,6,0,0.15), 0 32px 80px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 800, color: C.white, letterSpacing: "0.5px" }}>BAHRAIN INTERNATIONAL CIRCUIT</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Lap 1 · NOR vs LEC · Speed heatmap</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {[["NOR", C.mclaren], ["LEC", C.ferrari]].map(([code, color]) => (
              <div key={code} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color as string }} />
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{code}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Track SVG */}
        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "center" }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
            {/* Track base */}
            <path d={pathD} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" />

            {/* Heatmap segments */}
            {trackPoints.slice(0, -1).map(([x, y], i) => {
              const [nx, ny] = trackPoints[i + 1];
              const segProg = lerp(frame, [i * 3, i * 3 + 12], [0, 1]);
              return (
                <line
                  key={i}
                  x1={x * W}
                  y1={y * H}
                  x2={nx * W}
                  y2={ny * H}
                  stroke={speedColors[i] || C.mclaren}
                  strokeWidth={10}
                  strokeLinecap="round"
                  opacity={segProg * 0.85}
                />
              );
            })}

            {/* Car dot */}
            <circle cx={carX} cy={carY} r={7} fill={C.mclaren} />
            <circle cx={carX} cy={carY} r={14} fill="none" stroke={C.mclaren} strokeWidth={2} opacity={0.4} />
            <circle
              cx={carX}
              cy={carY}
              r={22}
              fill="none"
              stroke={C.mclaren}
              strokeWidth={1}
              opacity={lerp(frame % 30, [0, 15, 30], [0.3, 0, 0.3])}
            />
          </svg>
        </div>

        {/* Speed legend */}
        <div style={{ padding: "0 24px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "1px" }}>SPEED</span>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: `linear-gradient(90deg, #3671C6 0%, #00E676 40%, ${C.mclaren} 70%, ${C.red} 100%)` }} />
          <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>MAX</span>
        </div>
      </div>

      {/* Corner label */}
      <div style={{ position: "absolute", top: 60, right: 60, fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "3px", textTransform: "uppercase" }}>
        INTERACTIVE TRACK MAP
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 2c — Speed Chart (frames 276–360 ≈ 4.6–6s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene2cSpeedChart() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = lerp(frame, [0, 10], [0, 1]);
  const drawProgress = lerp(frame, [8, 72], [0, 1]);
  const calloutOpacity = lerp(frame, [55, 72], [0, 1]);
  const calloutY = lerp(frame, [55, 72], [8, 0]);

  const W = 620;
  const H = 240;

  // Mock speed data (normalized 0–1)
  const norrisData = [0.45, 0.52, 0.68, 0.82, 0.95, 0.88, 0.72, 0.55, 0.48, 0.62, 0.78, 0.91, 0.96, 0.85, 0.70, 0.58, 0.50, 0.65, 0.80, 0.93, 0.87, 0.72, 0.60, 0.55, 0.70, 0.85, 0.92, 0.78, 0.62, 0.52];
  const leclercData = [0.43, 0.50, 0.65, 0.79, 0.92, 0.85, 0.69, 0.53, 0.46, 0.60, 0.75, 0.88, 0.94, 0.82, 0.68, 0.55, 0.48, 0.62, 0.77, 0.90, 0.84, 0.70, 0.57, 0.52, 0.67, 0.82, 0.89, 0.75, 0.60, 0.50];

  function buildPath(data: number[], progress: number) {
    const pts = data.slice(0, Math.max(2, Math.floor(data.length * progress)));
    return pts.map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - v * (H - 20) - 10;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }

  const cardScale = spr(frame, fps, 0);

  return (
    <AbsoluteFill style={{ background: C.black, alignItems: "center", justifyContent: "center", opacity: sceneOpacity }}>
      <Grain />

      <div
        style={{
          transform: `scale(${0.88 + cardScale * 0.12})`,
          width: 700,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: `0 0 0 1px rgba(225,6,0,0.15), 0 32px 80px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 800, color: C.white }}>SPEED vs DISTANCE</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[["NOR", C.mclaren], ["LEC", C.ferrari]].map(([code, color]) => (
              <div key={code} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 3, borderRadius: 2, background: color as string }} />
                <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{code}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart area */}
        <div style={{ padding: "20px 24px", position: "relative" }}>
          {/* Y-axis labels */}
          <div style={{ position: "absolute", left: 8, top: 20, bottom: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {["320", "240", "160", "80"].map(v => (
              <span key={v} style={{ fontFamily: FONT_BODY, fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{v}</span>
            ))}
          </div>

          {/* Grid */}
          <svg width={W} height={H} style={{ overflow: "visible" }}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map(y => (
              <line
                key={y}
                x1={0} y1={H * y}
                x2={W} y2={H * y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
            ))}
            {[0.25, 0.5, 0.75].map(x => (
              <line
                key={x}
                x1={W * x} y1={0}
                x2={W * x} y2={H}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
            ))}

            {/* Leclerc line */}
            <path
              d={buildPath(leclercData, drawProgress)}
              fill="none"
              stroke={C.ferrari}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />

            {/* Norris line */}
            <path
              d={buildPath(norrisData, drawProgress)}
              fill="none"
              stroke={C.mclaren}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Glow under Norris line */}
            <path
              d={buildPath(norrisData, drawProgress)}
              fill="none"
              stroke={C.mclaren}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.12}
            />

            {/* Sector 2 callout at ~65% x */}
            {calloutOpacity > 0.01 && (
              <g opacity={calloutOpacity} transform={`translate(0, ${calloutY})`}>
                <line x1={W * 0.64} y1={0} x2={W * 0.64} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 3" />
                <rect x={W * 0.64 - 52} y={8} width={104} height={28} rx={6} fill="rgba(255,128,0,0.15)" stroke={C.mclaren} strokeWidth={1} />
                <text x={W * 0.64} y={27} textAnchor="middle" fontFamily={FONT_HEAD} fontSize={12} fontWeight={700} fill={C.mclaren}>
                  NOR +0.3s in S2
                </text>
              </g>
            )}
          </svg>

          {/* X-axis */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {["0", "1km", "2km", "3km", "4km", "5.41km"].map(v => (
              <span key={v} style={{ fontFamily: FONT_BODY, fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{v}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 60, left: 60, fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "3px", textTransform: "uppercase" }}>
        LAP TELEMETRY · SECTOR ANALYSIS
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 3 — My Garage (frames 360–600 ≈ 6–10s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene3Garage() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panelSlide = lerp(frame, [0, 30], [-80, 0]);
  const panelOpacity = lerp(frame, [0, 20], [0, 1]);

  // Counter 0→87
  const counter = Math.floor(lerp(frame, [80, 160], [0, 87]));

  // Results rows tick in
  const results = [
    { race: "Bahrain GP", pos: "P1", pts: 25 },
    { race: "Saudi Arabia GP", pos: "P1", pts: 25 },
    { race: "Australia GP", pos: "P3", pts: 15 },
    { race: "Japan GP", pos: "P2", pts: 18 },
    { race: "China GP", pos: "P1", pts: 25 },
  ];

  // Points chart
  const chartW = 520;
  const chartH = 80;
  const cumulativePoints = results.reduce((acc: number[], r, i) => {
    acc.push((acc[i - 1] || 0) + r.pts);
    return acc;
  }, []);
  const chartDraw = lerp(frame, [100, 175], [0, 1]);

  const shimmer = Math.sin((frame / 40) * Math.PI) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Grain />

      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255,128,0,0.06) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          opacity: panelOpacity,
          transform: `translateY(${panelSlide}px)`,
        }}
      >
        {/* Section label */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, alignSelf: "flex-start", marginLeft: 120 }}>
          <div style={{ width: 3, height: 20, background: C.mclaren, borderRadius: 2 }} />
          <span style={{ fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "3px", textTransform: "uppercase" }}>
            MY GARAGE
          </span>
        </div>

        {/* Hero driver card */}
        <div
          style={{
            width: 680,
            background: `linear-gradient(135deg, rgba(255,128,0,0.1) 0%, ${C.panel} 60%)`,
            border: `1px solid rgba(255,128,0,${0.2 + shimmer * 0.15})`,
            borderRadius: 20,
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            gap: 24,
            boxShadow: `0 0 40px rgba(255,128,0,${0.05 + shimmer * 0.08}), 0 24px 60px rgba(0,0,0,0.7)`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Shimmer sweep */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: `${-100 + shimmer * 300}%`,
              width: "60%",
              height: "100%",
              background: "linear-gradient(90deg, transparent 0%, rgba(255,128,0,0.04) 50%, transparent 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Number */}
          <div style={{ fontFamily: FONT_HEAD, fontSize: 88, fontWeight: 800, color: C.mclaren, lineHeight: 1, opacity: 0.8 }}>
            4
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 32, fontWeight: 800, color: C.white, letterSpacing: "-0.5px" }}>
              LANDO NORRIS
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: C.mclaren, background: "rgba(255,128,0,0.12)", padding: "3px 10px", borderRadius: 100, border: `1px solid rgba(255,128,0,0.3)` }}>
                McLaren
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "3px 10px", borderRadius: 100 }}>
                #4 · British
              </div>
            </div>
          </div>

          {/* Championship position */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 64, fontWeight: 800, color: C.mclaren, lineHeight: 1 }}>P1</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>CHAMPIONSHIP</div>
          </div>
        </div>

        {/* Results table + chart row */}
        <div style={{ display: "flex", gap: 20, width: 680 }}>
          {/* Results table */}
          <div
            style={{
              flex: 1,
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: FONT_HEAD, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase" }}>
                2025 SEASON
              </span>
            </div>
            {results.map((r, i) => {
              const rowOpacity = lerp(frame, [30 + i * 12, 30 + i * 12 + 14], [0, 1]);
              const rowX = lerp(frame, [30 + i * 12, 30 + i * 12 + 16], [12, 0]);
              const posColor = r.pos === "P1" ? C.mclaren : r.pos === "P2" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)";
              return (
                <div
                  key={r.race}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderBottom: i < results.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none",
                    opacity: rowOpacity,
                    transform: `translateX(${rowX}px)`,
                  }}
                >
                  <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: "rgba(255,255,255,0.3)", flex: 1 }}>{r.race}</span>
                  <span style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 800, color: posColor, width: 36 }}>{r.pos}</span>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: "rgba(255,255,255,0.3)", width: 40, textAlign: "right" }}>+{r.pts}</span>
                </div>
              );
            })}
          </div>

          {/* Points card */}
          <div
            style={{
              width: 180,
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase" }}>
              POINTS
            </div>

            {/* Counter */}
            <div style={{ fontFamily: FONT_HEAD, fontSize: 52, fontWeight: 800, color: C.mclaren, lineHeight: 1 }}>
              {counter}
            </div>

            {/* Mini chart */}
            <svg width={148} height={chartH} style={{ overflow: "visible" }}>
              {cumulativePoints.slice(0, Math.max(2, Math.floor(cumulativePoints.length * chartDraw))).map((pts, i) => {
                const x = (i / (cumulativePoints.length - 1)) * 148;
                const y = chartH - (pts / 108) * (chartH - 10) - 5;
                if (i === 0) return null;
                const prevPts = cumulativePoints[i - 1];
                const prevX = ((i - 1) / (cumulativePoints.length - 1)) * 148;
                const prevY = chartH - (prevPts / 108) * (chartH - 10) - 5;
                return (
                  <g key={i}>
                    <line x1={prevX} y1={prevY} x2={x} y2={y} stroke={C.mclaren} strokeWidth={2} strokeLinecap="round" />
                    <circle cx={x} cy={y} r={3} fill={C.mclaren} />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 4 — News Feed (frames 600–780 ≈ 10–13s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene4News() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const articles = [
    {
      title: "Norris dominates Bahrain opener",
      meta: "Race Weekend",
      metaColor: C.mclaren,
      sub: "McLaren's MCL39 showed superior straight-line speed in Sector 2",
      delay: 0,
    },
    {
      title: "Ferrari unveils aggressive Jeddah upgrade",
      meta: "Technical",
      metaColor: C.ferrari,
      sub: "Floor revisions target downforce deficit vs McLaren and Red Bull",
      delay: 5,
    },
    {
      title: '"Best car I\'ve driven in years"',
      meta: "Quote",
      metaColor: C.mercedes,
      sub: "Hamilton on Mercedes' resurgent 2025 challenger after FP3",
      delay: 10,
    },
  ];

  return (
    <AbsoluteFill style={{ background: C.black, alignItems: "center", justifyContent: "center" }}>
      <Grain />

      {/* Subtle horizontal scan lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 4px)`,
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 680 }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: lerp(frame, [0, 18], [0, 1]) }}>
          <div style={{ width: 3, height: 20, background: C.red, borderRadius: 2 }} />
          <span style={{ fontFamily: FONT_HEAD, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "3px", textTransform: "uppercase" }}>
            NEWS & INSIGHTS
          </span>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, rgba(255,255,255,0.08), transparent)` }} />
        </div>

        {/* News cards */}
        {articles.map((a, i) => {
          const springVal = spr(frame, fps, a.delay);
          const cardY = 40 * (1 - springVal);
          const cardOpacity = Math.min(springVal * 2, 1);

          return (
            <div
              key={i}
              style={{
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: "20px 24px",
                borderLeft: `3px solid ${a.metaColor}`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04)`,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* Meta badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 10,
                    fontWeight: 700,
                    color: a.metaColor,
                    background: `${a.metaColor}18`,
                    padding: "3px 10px",
                    borderRadius: 100,
                    border: `1px solid ${a.metaColor}35`,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  {a.meta}
                </div>
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                  }}
                />
                <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                  {["2h ago", "5h ago", "1d ago"][i]}
                </span>
              </div>

              {/* Title */}
              <div
                style={{
                  fontFamily: FONT_HEAD,
                  fontSize: 20,
                  fontWeight: 800,
                  color: C.white,
                  lineHeight: 1.2,
                  letterSpacing: "-0.2px",
                }}
              >
                {a.title}
              </div>

              {/* Sub */}
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                  lineHeight: 1.5,
                }}
              >
                {a.sub}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 5 — End Card (frames 780–900 ≈ 13–15s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene5EndCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordmarkOpacity = lerp(frame, [10, 35], [0, 1]);
  const wordmarkScale = lerp(frame, [10, 35], [0.92, 1]);
  const urlOpacity = lerp(frame, [30, 50], [0, 1]);
  const urlY = lerp(frame, [30, 50], [6, 0]);
  const glowOpacity = lerp(frame, [0, 40], [0, 0.7]);

  return (
    <AbsoluteFill style={{ background: C.black, alignItems: "center", justifyContent: "center" }}>
      <Grain />

      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(225,6,0,0.12) 0%, transparent 65%)`,
          opacity: glowOpacity,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Corner accent lines */}
      {[
        { top: 40, left: 40, width: 60, height: 2 },
        { top: 40, left: 40, width: 2, height: 60 },
        { bottom: 40, right: 40, width: 60, height: 2 },
        { bottom: 40, right: 40, width: 2, height: 60 },
      ].map((style, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            background: `rgba(225,6,0,0.4)`,
            opacity: lerp(frame, [20 + i * 4, 35 + i * 4], [0, 1]),
            ...style,
          }}
        />
      ))}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {/* Wordmark */}
        <div
          style={{
            opacity: wordmarkOpacity,
            transform: `scale(${wordmarkScale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          <div
            style={{
              fontFamily: FONT_HEAD,
              fontSize: 80,
              fontWeight: 800,
              color: C.white,
              letterSpacing: "4px",
              lineHeight: 1,
            }}
          >
            F1 CORE
          </div>
        </div>

        {/* Red sweep */}
        <div style={{ width: 280, marginTop: 4, marginBottom: 10 }}>
          <RedSweep startFrame={38} width="100%" />
        </div>

        {/* URL */}
        <div
          style={{
            opacity: urlOpacity,
            transform: `translateY(${urlY}px)`,
            fontFamily: "'Courier New', monospace",
            fontSize: 18,
            fontWeight: 400,
            color: "rgba(240,240,245,0.45)",
            letterSpacing: "3px",
          }}
        >
          thef1core.com
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: lerp(frame, [45, 65], [0, 1]),
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 400,
            color: "rgba(255,255,255,0.2)",
            marginTop: 8,
            letterSpacing: "0.5px",
          }}
        >
          Real telemetry. Every race. Built for fans.
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT COMPOSITION — 9:16 (1080×1920)
// ═══════════════════════════════════════════════════════════════════════════
export function F1CoreDemoComp() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;600&display=swap');
      `}</style>

      {/* Scene 1: Cold Open — 0–120 */}
      <Sequence from={0} durationInFrames={130}>
        <Scene1ColdOpen />
      </Sequence>

      {/* Wipe 1→2a */}
      <Sequence from={115} durationInFrames={20}>
        <SliceWipe triggerFrame={0} />
      </Sequence>

      {/* Scene 2a: Driver Card — 120–198 */}
      <Sequence from={120} durationInFrames={88}>
        <Scene2aDriverCard />
      </Sequence>

      {/* Wipe 2a→2b */}
      <Sequence from={198} durationInFrames={20}>
        <SliceWipe triggerFrame={0} />
      </Sequence>

      {/* Scene 2b: Track Map — 198–276 */}
      <Sequence from={198} durationInFrames={88}>
        <Scene2bTrackMap />
      </Sequence>

      {/* Wipe 2b→2c */}
      <Sequence from={276} durationInFrames={20}>
        <SliceWipe triggerFrame={0} />
      </Sequence>

      {/* Scene 2c: Speed Chart — 276–360 */}
      <Sequence from={276} durationInFrames={90}>
        <Scene2cSpeedChart />
      </Sequence>

      {/* Wipe 2c→3 */}
      <Sequence from={354} durationInFrames={20}>
        <SliceWipe triggerFrame={0} />
      </Sequence>

      {/* Scene 3: Garage — 360–600 */}
      <Sequence from={360} durationInFrames={245}>
        <Scene3Garage />
      </Sequence>

      {/* Wipe 3→4 */}
      <Sequence from={596} durationInFrames={20}>
        <SliceWipe triggerFrame={0} />
      </Sequence>

      {/* Scene 4: News — 600–780 */}
      <Sequence from={600} durationInFrames={185}>
        <Scene4News />
      </Sequence>

      {/* Wipe 4→5 */}
      <Sequence from={776} durationInFrames={20}>
        <SliceWipe triggerFrame={0} />
      </Sequence>

      {/* Scene 5: End Card — 780–900 */}
      <Sequence from={780} durationInFrames={120}>
        <Scene5EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 16:9 VARIANT — Same scenes, letterboxed
// ═══════════════════════════════════════════════════════════════════════════
export function F1CoreDemo16x9Comp() {
  return (
    <AbsoluteFill
      style={{
        background: C.black,
        // Scale the 9:16 content to fit 16:9 with pillarboxing
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          // 9:16 content scaled to fit 1080px height inside 1920×1080
          width: 607, // 1080 * (9/16) = 607.5
          height: 1080,
          transform: "scale(1)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ width: 1080, height: 1920, transform: "scale(0.5625)", transformOrigin: "top left" }}>
          <F1CoreDemoComp />
        </div>
      </div>

      {/* Side panels — dark with brand pattern */}
      {[
        { left: 0, width: 656 },
        { right: 0, width: 656 },
      ].map((style, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            background: C.black,
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 20px,
              rgba(225,6,0,0.025) 20px,
              rgba(225,6,0,0.025) 21px
            )`,
            ...style,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REMOTION ROOT — register both compositions
// ═══════════════════════════════════════════════════════════════════════════
export default function Root() {
  return (
    <>
      <Composition
        id="F1CoreDemo"
        component={F1CoreDemoComp}
        durationInFrames={900}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="F1CoreDemo16x9"
        component={F1CoreDemo16x9Comp}
        durationInFrames={900}
        fps={60}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
}
