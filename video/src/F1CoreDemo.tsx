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

// ─── Brand ──────────────────────────────────────────────────────────────────
const C = {
  red: "#E10600",
  black: "#07070A",
  white: "#F2F2F7",
  mclaren: "#FF8000",
  ferrari: "#F91536",
  mercedes: "#6CD3BF",
  redbull: "#3671C6",
  panel: "#0F0F16",
  panelBright: "#1A1A26",
  border: "rgba(255,255,255,0.06)",
} as const;

const HEAD = "'Barlow Condensed', sans-serif";
const BODY = "'Inter', sans-serif";
const MONO = "'Courier New', monospace";

// ─── Utils ───────────────────────────────────────────────────────────────────
const E = Easing.bezier(0.4, 0, 0.2, 1);
const EOut = Easing.bezier(0.0, 0.0, 0.2, 1);

function mv(f: number, i: [number,number], o: [number,number], ease = E) {
  return interpolate(f, i, o, { extrapolateLeft:"clamp", extrapolateRight:"clamp", easing: ease });
}

function spr(f: number, fps: number, delay = 0, stiff = 140, damp = 13) {
  return spring({ fps, frame: f - delay, config: { stiffness: stiff, damping: damp }, durationInFrames: 40 });
}

// ─── Shared visual atoms ─────────────────────────────────────────────────────

/** Full-frame flash — white or red, fades fast */
function Flash({ frame, at, color = "#fff", dur = 6 }: { frame:number; at:number; color?:string; dur?:number }) {
  const op = mv(frame, [at, at + dur], [1, 0]);
  if (op <= 0) return null;
  return <div style={{ position:"absolute", inset:0, background:color, opacity:op, zIndex:200, pointerEvents:"none" }} />;
}

/** Noise grain texture */
function Grain({ opacity = 0.3 }: { opacity?: number }) {
  return (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity, pointerEvents:"none", zIndex:98 }}>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" opacity="0.08" />
    </svg>
  );
}

/** Scan-line overlay */
function Scanlines({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div style={{
      position:"absolute", inset:0, pointerEvents:"none", zIndex:97,
      backgroundImage:`repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,${opacity}) 4px)`,
    }} />
  );
}

/** Corner HUD brackets */
function HUDCorners({ frame, startFrame, color = C.red, size = 28, gap = 12 }: { frame:number; startFrame:number; color?:string; size?:number; gap?:number }) {
  const op = mv(frame, [startFrame, startFrame+14], [0, 1]);
  const s = [`top:${gap}px;left:${gap}px`, `top:${gap}px;right:${gap}px`, `bottom:${gap}px;left:${gap}px`, `bottom:${gap}px;right:${gap}px`];
  const borders = [
    { borderTop:`1.5px solid ${color}`, borderLeft:`1.5px solid ${color}` },
    { borderTop:`1.5px solid ${color}`, borderRight:`1.5px solid ${color}` },
    { borderBottom:`1.5px solid ${color}`, borderLeft:`1.5px solid ${color}` },
    { borderBottom:`1.5px solid ${color}`, borderRight:`1.5px solid ${color}` },
  ];
  return (
    <>
      {borders.map((b, i) => (
        <div key={i} style={{
          position:"absolute", width:size, height:size, opacity:op,
          ...Object.fromEntries(s[i].split(";").map(p => { const [k,v] = p.split(":"); return [k.trim(), v.trim()]; })),
          ...b,
        }} />
      ))}
    </>
  );
}

/** Horizontal sweep line */
function Sweep({ frame, startFrame, color = C.red, y = 0 }: { frame:number; startFrame:number; color?:string; y?:number }) {
  const { width } = useVideoConfig();
  const scaleX = mv(frame, [startFrame, startFrame+20], [0, 1]);
  return (
    <div style={{
      position:"absolute", top:y, left:0, right:0, height:2,
      background:`linear-gradient(90deg, ${color} 0%, ${color}CC 70%, transparent 100%)`,
      transformOrigin:"left center", transform:`scaleX(${scaleX})`,
      boxShadow:`0 0 8px ${color}88`,
    }} />
  );
}

/** Vertical speed lines radiating from center — creates velocity feel */
function SpeedLines({ frame, startFrame, count = 12, color = C.red }: { frame:number; startFrame:number; count?:number; color?:string }) {
  const { width, height } = useVideoConfig();
  const op = mv(frame, [startFrame, startFrame+20, startFrame+40], [0, 0.15, 0]);
  if (op <= 0) return null;
  return (
    <svg style={{ position:"absolute", inset:0, width, height, opacity:op, pointerEvents:"none", zIndex:50 }}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const len = 500 + Math.sin(i * 7) * 200;
        const cx = width / 2, cy = height / 2;
        const ex = cx + Math.cos(angle) * len;
        const ey = cy + Math.sin(angle) * len;
        return (
          <line key={i} x1={cx} y1={cy} x2={ex} y2={ey}
            stroke={color} strokeWidth={1 + (i % 3) * 0.5} opacity={0.3 + (i % 4) * 0.15}
          />
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 1 — Cold Open 0–120 (2s)
// F1 CORE slams in, letter stagger, red sweep, speed lines
// ═══════════════════════════════════════════════════════════════════════════
function Scene1() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stagger each letter of "F1 CORE"
  const letters = ["F", "1", " ", "C", "O", "R", "E"];
  const glow = Math.sin((frame / 30) * Math.PI) * 0.5 + 0.5;

  // Tagline slides up
  const tagOp = mv(frame, [42, 58], [0, 1]);
  const tagY  = mv(frame, [42, 58], [14, 0]);

  // URL counter — thef1core.com types in
  const urlChars = "thef1core.com";
  const urlProgress = mv(frame, [60, 95], [0, urlChars.length]);
  const urlVisible = urlChars.slice(0, Math.floor(urlProgress));

  return (
    <AbsoluteFill style={{ background: C.black, alignItems:"center", justifyContent:"center" }}>
      <Grain />
      <Scanlines />

      {/* Red flash on entry */}
      <Flash frame={frame} at={0} color={C.red} dur={8} />

      {/* Deep radial glow */}
      <div style={{
        position:"absolute", width:900, height:900, borderRadius:"50%",
        background:`radial-gradient(circle, rgba(225,6,0,0.14) 0%, rgba(225,6,0,0.04) 40%, transparent 70%)`,
        top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        opacity: mv(frame, [0, 30], [0, 1]),
      }} />

      <SpeedLines frame={frame} startFrame={0} count={18} />

      {/* HUD corners */}
      <HUDCorners frame={frame} startFrame={28} color={C.red} size={36} gap={40} />

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>

        {/* Massive wordmark — letters slam in staggered */}
        <Trail layers={3} lagInFrames={0.6} trailOpacity={0.12}>
          <div style={{ display:"flex", alignItems:"baseline", gap:0, lineHeight:1 }}>
            {letters.map((ch, i) => {
              const delay = i * 2;
              const sp = spr(frame, fps, delay, 200, 12);
              const op = mv(frame, [delay, delay+10], [0,1]);
              return (
                <span key={i} style={{
                  fontFamily: HEAD,
                  fontSize: ch === " " ? 24 : 128,
                  fontWeight: 800,
                  color: ch === "1" ? C.red : C.white,
                  letterSpacing: ch === " " ? "0px" : "-2px",
                  transform: `translateY(${(1-sp)*40}px) scale(${0.7+sp*0.3})`,
                  display:"inline-block",
                  opacity: op,
                  textShadow: ch === "1" ? `0 0 60px ${C.red}88` : "none",
                }}>
                  {ch}
                </span>
              );
            })}
          </div>
        </Trail>

        {/* Red sweep underline */}
        <div style={{ position:"relative", width:520, height:3, marginTop:8 }}>
          <Sweep frame={frame} startFrame={20} y={0} />
        </div>

        {/* Badge */}
        <div style={{
          marginTop:20,
          opacity: mv(frame, [28, 44], [0, 1]),
          transform: `translateY(${mv(frame, [28, 44], [10, 0])}px)`,
          display:"flex", alignItems:"center", gap:8,
          background:"rgba(225,6,0,0.1)",
          border:`1px solid rgba(225,6,0,0.35)`,
          borderRadius:100,
          padding:"6px 18px",
          fontFamily: HEAD,
          fontSize:13, fontWeight:700, color:C.red,
          letterSpacing:"3px", textTransform:"uppercase",
        }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:C.red, boxShadow:`0 0 6px ${C.red}` }} />
          TELEMETRY PLATFORM
        </div>

        {/* Tagline */}
        <div style={{
          marginTop:16, opacity:tagOp, transform:`translateY(${tagY}px)`,
          fontFamily:BODY, fontSize:19, fontWeight:400,
          color:"rgba(242,242,247,0.45)", letterSpacing:"0.3px",
        }}>
          Real F1 data. Every lap. Every driver.
        </div>

        {/* Typing URL */}
        <div style={{
          marginTop:12,
          fontFamily:MONO, fontSize:14, color:"rgba(225,6,0,0.6)",
          letterSpacing:"2px",
          opacity: mv(frame, [58, 70], [0, 1]),
        }}>
          {urlVisible}<span style={{ opacity: frame % 20 < 10 ? 1 : 0, color:C.red }}>_</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 2a — NOR Driver Splash 120–198 (1.3s)
// Full-color McLaren flood, massive number
// ═══════════════════════════════════════════════════════════════════════════
function Scene2aDriver() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const flood = mv(frame, [0, 18], [0, 1]);
  const numScale = spr(frame, fps, 4, 250, 11);
  const infoOp = mv(frame, [12, 28], [0, 1]);
  const infoX = mv(frame, [12, 28], [-30, 0]);

  // Pulsing glow
  const pulse = Math.sin((frame / 20) * Math.PI) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ background: C.black, overflow:"hidden" }}>
      <Grain />

      {/* McLaren orange flood — diagonal slice */}
      <div style={{
        position:"absolute", inset:0,
        background:`linear-gradient(115deg, rgba(255,128,0,0.22) 0%, rgba(255,128,0,0.06) 45%, transparent 65%)`,
        opacity: flood,
      }} />

      {/* Diagonal accent stripe */}
      <div style={{
        position:"absolute",
        top:-200, left:-80,
        width:400, height:2000,
        background:`linear-gradient(180deg, transparent 0%, rgba(255,128,0,0.12) 30%, rgba(255,128,0,0.18) 50%, transparent 100%)`,
        transform:"rotate(-18deg)",
        opacity: flood,
      }} />

      {/* Huge background number watermark */}
      <div style={{
        position:"absolute",
        top:"50%", right:-20,
        transform:`translateY(-50%) scale(${0.5 + numScale*0.5})`,
        fontFamily:HEAD, fontSize:600, fontWeight:800,
        color:`rgba(255,128,0,${0.04 + pulse * 0.03})`,
        lineHeight:1, userSelect:"none",
        opacity: flood,
      }}>
        4
      </div>

      {/* Main content */}
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 80px" }}>

        {/* Session context */}
        <div style={{ opacity: infoOp, transform:`translateX(${infoX}px)`, marginBottom:20 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            background:"rgba(255,128,0,0.1)", border:`1px solid rgba(255,128,0,0.3)`,
            borderRadius:100, padding:"5px 14px",
            fontFamily:BODY, fontSize:11, fontWeight:600, color:C.mclaren,
            letterSpacing:"1px", textTransform:"uppercase",
          }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:C.mclaren, boxShadow:`0 0 8px ${C.mclaren}` }} />
            McLaren · Bahrain GP 2025 · Race
          </div>
        </div>

        {/* Driver number — slams in */}
        <div style={{
          fontFamily:HEAD, fontSize:220, fontWeight:800,
          color:C.mclaren, lineHeight:0.9, letterSpacing:"-6px",
          transform:`translateY(${(1-numScale)*60}px) scale(${0.6+numScale*0.4})`,
          textShadow:`0 0 80px rgba(255,128,0,${0.3+pulse*0.2}), 0 0 160px rgba(255,128,0,0.1)`,
        }}>
          4
        </div>

        {/* Driver name */}
        <div style={{ opacity:infoOp, transform:`translateX(${infoX}px)`, marginTop:8 }}>
          <div style={{
            fontFamily:HEAD, fontSize:66, fontWeight:800,
            color:C.white, letterSpacing:"-0.5px", lineHeight:1,
            textTransform:"uppercase",
          }}>
            LANDO
          </div>
          <div style={{
            fontFamily:HEAD, fontSize:66, fontWeight:800,
            color:"rgba(255,255,255,0.35)", letterSpacing:"-0.5px", lineHeight:1,
            textTransform:"uppercase",
          }}>
            NORRIS
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display:"flex", gap:32, marginTop:28,
          opacity: mv(frame, [18, 34], [0, 1]),
          transform:`translateY(${mv(frame, [18,34], [10, 0])}px)`,
        }}>
          {[
            { label:"CHAMPIONSHIP", value:"P1" },
            { label:"POINTS", value:"87" },
            { label:"WINS", value:"3" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily:HEAD, fontSize:38, fontWeight:800, color:C.mclaren, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontFamily:BODY, fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:"1.5px", textTransform:"uppercase", marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom accent line */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, height:3,
        background:`linear-gradient(90deg, ${C.mclaren} 0%, rgba(255,128,0,0.3) 60%, transparent 100%)`,
        opacity: flood,
      }} />

      <HUDCorners frame={frame} startFrame={8} color={C.mclaren} size={28} gap={28} />
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 2b — Track Map 198–276 (1.3s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene2bTrack() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const W = 700, H = 700;

  const trackPts: [number,number][] = [
    [0.50,0.13],[0.63,0.10],[0.76,0.16],[0.83,0.27],
    [0.81,0.40],[0.73,0.49],[0.69,0.57],[0.74,0.65],
    [0.80,0.72],[0.76,0.81],[0.64,0.86],[0.51,0.86],
    [0.38,0.81],[0.29,0.73],[0.25,0.62],[0.20,0.53],
    [0.17,0.43],[0.21,0.34],[0.27,0.26],[0.37,0.18],[0.50,0.13],
  ];

  const pathD = trackPts.map(([x,y],i) => `${i===0?"M":"L"} ${x*W} ${y*H}`).join(" ") + " Z";

  // Car progress
  const prog = mv(frame, [0, 78], [0, 1]);
  const idx = Math.min(Math.floor(prog * (trackPts.length-1)), trackPts.length-2);
  const frac = (prog * (trackPts.length-1)) % 1;
  const [ax,ay] = trackPts[idx];
  const [bx,by] = trackPts[idx+1];
  const carX = (ax + (bx-ax)*frac)*W;
  const carY = (ay + (by-ay)*frac)*H;

  // Heat colors
  const heatColors = ["#3671C6","#3671C6","#00C853","#00C853",C.mclaren,C.mclaren,C.red,C.red,C.mclaren,"#00C853","#3671C6","#3671C6","#00C853",C.mclaren,C.red,C.red,"#00C853","#3671C6","#3671C6","#3671C6"];

  const cardOp = mv(frame, [0, 10], [0, 1]);
  const cardScale = spr(frame, fps, 0, 120, 14);

  // Sector labels
  const sectors = [
    { pos: [0.75, 0.35], label:"S1" },
    { pos: [0.6, 0.72], label:"S2" },
    { pos: [0.24, 0.52], label:"S3" },
  ];

  return (
    <AbsoluteFill style={{ background:C.black, alignItems:"center", justifyContent:"center", opacity:cardOp }}>
      <Grain />
      <Scanlines />

      {/* BG glow */}
      <div style={{
        position:"absolute", width:800, height:800, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(54,113,198,0.08) 0%, transparent 65%)",
        top:"50%", left:"50%", transform:"translate(-50%,-50%)",
      }} />

      <div style={{
        transform:`scale(${0.82+cardScale*0.18})`,
        background:C.panel,
        border:`1px solid ${C.border}`,
        borderRadius:24,
        overflow:"hidden",
        boxShadow:`0 0 0 1px rgba(225,6,0,0.12), 0 40px 100px rgba(0,0,0,0.9)`,
        width:760,
      }}>
        {/* Header */}
        <div style={{ padding:"16px 28px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:HEAD, fontSize:20, fontWeight:800, color:C.white, letterSpacing:"0.3px" }}>BAHRAIN INTERNATIONAL CIRCUIT</div>
            <div style={{ fontFamily:BODY, fontSize:11, color:"rgba(255,255,255,0.28)", marginTop:3 }}>5.412 km · 57 laps · Lap 1 · Speed heatmap</div>
          </div>
          <div style={{ display:"flex", gap:14 }}>
            {[[C.mclaren,"NOR"],[C.ferrari,"LEC"]].map(([c,n]) => (
              <div key={n as string} style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{ width:24, height:4, borderRadius:2, background:c as string }} />
                <span style={{ fontFamily:BODY, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)" }}>{n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Track SVG */}
        <div style={{ padding:"8px 24px 16px", display:"flex", justifyContent:"center" }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
            {/* Base track */}
            <path d={pathD} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathD} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />

            {/* Heat segments */}
            {trackPts.slice(0,-1).map(([x,y],i) => {
              const [nx,ny] = trackPts[i+1];
              const segOp = mv(frame, [i*3, i*3+14], [0,1]);
              const col = heatColors[i] || C.mclaren;
              return (
                <g key={i}>
                  {/* Glow */}
                  <line x1={x*W} y1={y*H} x2={nx*W} y2={ny*H} stroke={col} strokeWidth={16} strokeLinecap="round" opacity={segOp * 0.25} />
                  {/* Line */}
                  <line x1={x*W} y1={y*H} x2={nx*W} y2={ny*H} stroke={col} strokeWidth={8} strokeLinecap="round" opacity={segOp * 0.9} />
                </g>
              );
            })}

            {/* Sector labels */}
            {sectors.map((s) => (
              <g key={s.label} opacity={mv(frame,[30,44],[0,1])}>
                <circle cx={s.pos[0]*W} cy={s.pos[1]*H} r={16} fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                <text x={s.pos[0]*W} y={s.pos[1]*H+5} textAnchor="middle" fontFamily={HEAD} fontSize={13} fontWeight={700} fill={C.white}>{s.label}</text>
              </g>
            ))}

            {/* Car dot with trail */}
            <circle cx={carX} cy={carY} r={10} fill={C.mclaren} />
            <circle cx={carX} cy={carY} r={20} fill="none" stroke={C.mclaren} strokeWidth={2} opacity={0.5} />
            <circle cx={carX} cy={carY} r={32} fill="none" stroke={C.mclaren} strokeWidth={1} opacity={mv(frame%24,[0,12,24],[0.4,0,0.4])} />
          </svg>
        </div>

        {/* Speed legend */}
        <div style={{ padding:"0 28px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontFamily:BODY, fontSize:9, color:"rgba(255,255,255,0.25)", letterSpacing:"2px", textTransform:"uppercase" }}>LOW</span>
          <div style={{ flex:1, height:5, borderRadius:3, background:`linear-gradient(90deg, ${C.redbull} 0%, #00C853 35%, ${C.mclaren} 65%, ${C.red} 100%)` }} />
          <span style={{ fontFamily:BODY, fontSize:9, color:"rgba(255,255,255,0.25)", letterSpacing:"2px", textTransform:"uppercase" }}>TOP SPEED</span>
        </div>
      </div>

      <HUDCorners frame={frame} startFrame={6} color="rgba(255,255,255,0.15)" size={24} gap={24} />
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 2c — Speed Chart 276–360 (1.4s)
// Two lines draw on fast, bold delta callout
// ═══════════════════════════════════════════════════════════════════════════
function Scene2cChart() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const W = 660, H = 200;
  const drawProg = mv(frame, [6, 66], [0, 1]);
  const calloutOp = mv(frame, [55, 72], [0, 1]);
  const calloutY = mv(frame, [55, 72], [8, 0]);

  const norris = [0.42,0.50,0.66,0.81,0.96,0.90,0.74,0.57,0.48,0.60,0.77,0.92,0.97,0.84,0.69,0.55,0.47,0.63,0.79,0.93,0.86,0.70,0.58,0.53,0.68,0.84,0.93,0.77,0.62,0.50,0.45,0.53,0.69,0.85,0.94];
  const leclerc = [0.40,0.48,0.63,0.78,0.93,0.87,0.71,0.54,0.46,0.58,0.74,0.89,0.94,0.81,0.67,0.53,0.45,0.60,0.76,0.90,0.83,0.68,0.56,0.51,0.65,0.81,0.90,0.74,0.59,0.48,0.43,0.51,0.67,0.83,0.91];

  function buildPath(data: number[], prog: number): string {
    const pts = data.slice(0, Math.max(2, Math.floor(data.length * prog)));
    return pts.map((v,i) => {
      const x = (i/(data.length-1))*W;
      const y = H - v*(H-16) - 8;
      return `${i===0?"M":"L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  const cardOp = mv(frame, [0, 8], [0, 1]);
  const cardScale = spr(frame, fps, 0, 120, 14);

  return (
    <AbsoluteFill style={{ background:C.black, alignItems:"center", justifyContent:"center", opacity:cardOp }}>
      <Grain />
      <Scanlines />

      <div style={{
        transform:`scale(${0.82+cardScale*0.18})`,
        width:760,
        background:C.panel,
        border:`1px solid ${C.border}`,
        borderRadius:24,
        overflow:"hidden",
        boxShadow:`0 0 0 1px rgba(225,6,0,0.12), 0 40px 100px rgba(0,0,0,0.9)`,
      }}>
        {/* Header */}
        <div style={{ padding:"16px 28px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:HEAD, fontSize:20, fontWeight:800, color:C.white }}>SPEED TRACE</div>
            <div style={{ fontFamily:BODY, fontSize:11, color:"rgba(255,255,255,0.28)", marginTop:3 }}>Bahrain GP · Lap 1 · km/h vs distance</div>
          </div>
          <div style={{
            fontFamily:HEAD, fontSize:15, fontWeight:700, color:C.mclaren,
            background:"rgba(255,128,0,0.1)", border:`1px solid rgba(255,128,0,0.3)`,
            padding:"5px 14px", borderRadius:100,
          }}>
            NOR FASTER IN S1 + S2
          </div>
        </div>

        {/* Y-axis + chart */}
        <div style={{ padding:"16px 28px 8px", display:"flex", gap:12 }}>
          {/* Y labels */}
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", height:H, paddingBottom:6 }}>
            {["320","280","240","200","160"].map(v => (
              <span key={v} style={{ fontFamily:MONO, fontSize:9, color:"rgba(255,255,255,0.2)", lineHeight:1 }}>{v}</span>
            ))}
          </div>

          <svg width={W} height={H} style={{ overflow:"visible", flex:1 }}>
            {/* Grid */}
            {[0.2,0.4,0.6,0.8].map(y => (
              <line key={y} x1={0} y1={H*y} x2={W} y2={H*y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            ))}

            {/* Leclerc with area fill */}
            <path d={buildPath(leclerc, drawProg) + ` L ${W} ${H} L 0 ${H} Z`}
              fill={C.ferrari} opacity={0.04} />
            <path d={buildPath(leclerc, drawProg)} fill="none" stroke={C.ferrari} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.65} />

            {/* Norris with area fill */}
            <path d={buildPath(norris, drawProg) + ` L ${W} ${H} L 0 ${H} Z`}
              fill={C.mclaren} opacity={0.06} />
            <path d={buildPath(norris, drawProg)} fill="none" stroke={C.mclaren} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {/* Glow line */}
            <path d={buildPath(norris, drawProg)} fill="none" stroke={C.mclaren} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.12} />

            {/* Delta callout at S2 */}
            {calloutOp > 0.01 && (
              <g transform={`translate(0, ${calloutY})`} opacity={calloutOp}>
                <line x1={W*0.62} y1={0} x2={W*0.62} y2={H} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="5 3" />
                <rect x={W*0.62-64} y={10} width={128} height={32} rx={6}
                  fill="rgba(255,128,0,0.15)" stroke={C.mclaren} strokeWidth={1.5} />
                <text x={W*0.62} y={31} textAnchor="middle"
                  fontFamily={HEAD} fontSize={14} fontWeight={800} fill={C.mclaren}>
                  NOR +0.31s IN S2
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* X axis */}
        <div style={{ padding:"0 28px 16px", paddingLeft:68, display:"flex", justifyContent:"space-between" }}>
          {["0","1km","2km","3km","4km","5.4km"].map(v => (
            <span key={v} style={{ fontFamily:MONO, fontSize:9, color:"rgba(255,255,255,0.2)" }}>{v}</span>
          ))}
        </div>

        {/* Legend */}
        <div style={{ padding:"8px 28px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:24, alignItems:"center" }}>
          {[[C.mclaren,"NOR · 1:30.558"],[C.ferrari,"LEC · 1:30.889"]].map(([c,t]) => (
            <div key={t as string} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:28, height:3, borderRadius:2, background:c as string }} />
              <span style={{ fontFamily:BODY, fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.45)" }}>{t}</span>
            </div>
          ))}
          <div style={{
            marginLeft:"auto",
            fontFamily:HEAD, fontSize:22, fontWeight:800,
            color:"rgba(255,255,255,0.08)",
          }}>
            Δ 0.331s
          </div>
        </div>
      </div>

      <HUDCorners frame={frame} startFrame={6} color="rgba(255,255,255,0.12)" size={24} gap={24} />
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 3 — My Garage 360–600 (4s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene3Garage() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = mv(frame, [0, 28], [-60, 0]);
  const masterOp = mv(frame, [0, 18], [0, 1]);
  const counter = Math.floor(mv(frame, [70, 155], [0, 87]));
  const counterFlash = mv(frame, [70, 90, 155], [0, 1, 0]);

  const pulse = Math.sin((frame/25)*Math.PI)*0.5+0.5;

  const results = [
    { race:"Bahrain GP", pos:"P1", pts:25, color:C.mclaren },
    { race:"Saudi Arabia GP", pos:"P1", pts:25, color:C.mclaren },
    { race:"Australia GP", pos:"P3", pts:15, color:"rgba(255,255,255,0.55)" },
    { race:"Japan GP", pos:"P2", pts:18, color:"rgba(255,255,255,0.7)" },
    { race:"China GP", pos:"P1", pts:25, color:C.mclaren },
  ];

  const cumPts = results.reduce((acc:number[],r,i) => { acc.push((acc[i-1]||0)+r.pts); return acc; }, []);
  const chartDraw = mv(frame, [90, 175], [0, 1]);

  return (
    <AbsoluteFill style={{ background:C.black, opacity:masterOp }}>
      <Grain />

      {/* Orange ambient */}
      <div style={{
        position:"absolute", top:"-20%", left:"-10%", width:"70%", height:"70%",
        background:"radial-gradient(circle, rgba(255,128,0,0.07) 0%, transparent 60%)",
        pointerEvents:"none",
      }} />

      <div style={{
        position:"absolute", inset:0,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        gap:20,
        transform:`translateY(${slideIn}px)`,
      }}>

        {/* Section badge */}
        <div style={{ alignSelf:"flex-start", marginLeft:100, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:3, height:22, background:C.mclaren, borderRadius:2 }} />
          <span style={{ fontFamily:HEAD, fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.28)", letterSpacing:"3.5px", textTransform:"uppercase" }}>
            MY GARAGE
          </span>
        </div>

        {/* Hero driver banner */}
        <div style={{
          width:820,
          background:`linear-gradient(120deg, rgba(255,128,0,0.16) 0%, rgba(255,128,0,0.04) 50%, ${C.panel} 100%)`,
          border:`1px solid rgba(255,128,0,${0.25+pulse*0.12})`,
          borderRadius:20,
          padding:"28px 36px",
          display:"flex", alignItems:"center", gap:32,
          boxShadow:`0 0 60px rgba(255,128,0,${0.06+pulse*0.06}), 0 24px 70px rgba(0,0,0,0.8)`,
          position:"relative", overflow:"hidden",
        }}>
          {/* Shimmer */}
          <div style={{
            position:"absolute", top:0, bottom:0,
            width:"40%", left:`${-60+pulse*160}%`,
            background:"linear-gradient(90deg, transparent, rgba(255,128,0,0.04), transparent)",
            pointerEvents:"none",
          }} />

          {/* Big number */}
          <div style={{
            fontFamily:HEAD, fontSize:140, fontWeight:800,
            color:C.mclaren, lineHeight:1, opacity:0.9,
            textShadow:`0 0 80px rgba(255,128,0,0.3)`,
            flex:"0 0 auto",
          }}>
            4
          </div>

          {/* Info */}
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:HEAD, fontSize:46, fontWeight:800, color:C.white, letterSpacing:"-0.5px", lineHeight:1, textTransform:"uppercase" }}>
              LANDO NORRIS
            </div>
            <div style={{ display:"flex", gap:10, marginTop:10 }}>
              {["McLaren","British","5 Seasons"].map(t => (
                <span key={t} style={{
                  fontFamily:BODY, fontSize:11, fontWeight:600,
                  color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.06)",
                  padding:"3px 12px", borderRadius:100,
                }}>{t}</span>
              ))}
            </div>
          </div>

          {/* P1 badge */}
          <div style={{ textAlign:"center", flex:"0 0 auto" }}>
            <div style={{ fontFamily:HEAD, fontSize:88, fontWeight:800, color:C.mclaren, lineHeight:1,
              textShadow:`0 0 40px rgba(255,128,0,0.5)` }}>
              P1
            </div>
            <div style={{ fontFamily:BODY, fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:"2px", marginTop:4 }}>
              2025 CHAMPIONSHIP
            </div>
          </div>
        </div>

        {/* Bottom row: results + points */}
        <div style={{ display:"flex", gap:20, width:820 }}>

          {/* Results */}
          <div style={{
            flex:1, background:C.panel, border:`1px solid ${C.border}`,
            borderRadius:16, overflow:"hidden",
          }}>
            <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontFamily:HEAD, fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.28)", letterSpacing:"2px", textTransform:"uppercase" }}>2025 RESULTS</span>
              <span style={{ fontFamily:HEAD, fontSize:12, fontWeight:700, color:C.mclaren }}>3 WINS</span>
            </div>
            {results.map((r,i) => {
              const rowOp = mv(frame, [28+i*10, 28+i*10+14], [0,1]);
              const rowX  = mv(frame, [28+i*10, 28+i*10+16], [16, 0]);
              return (
                <div key={r.race} style={{
                  display:"flex", alignItems:"center",
                  padding:"9px 20px",
                  borderBottom: i<results.length-1 ? `1px solid rgba(255,255,255,0.03)` : "none",
                  opacity:rowOp, transform:`translateX(${rowX}px)`,
                  background: r.pos==="P1" ? "rgba(255,128,0,0.04)" : "transparent",
                }}>
                  <span style={{ fontFamily:HEAD, fontSize:22, fontWeight:800, color:r.color, width:52 }}>{r.pos}</span>
                  <span style={{ fontFamily:BODY, fontSize:11, color:"rgba(255,255,255,0.35)", flex:1 }}>{r.race}</span>
                  <span style={{ fontFamily:MONO, fontSize:11, color:"rgba(255,255,255,0.2)" }}>+{r.pts}pts</span>
                </div>
              );
            })}
          </div>

          {/* Points */}
          <div style={{
            width:220, background:C.panel, border:`1px solid ${C.border}`,
            borderRadius:16, padding:"20px", display:"flex", flexDirection:"column", justifyContent:"space-between",
          }}>
            <div style={{ fontFamily:HEAD, fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.28)", letterSpacing:"2px", textTransform:"uppercase" }}>
              TOTAL POINTS
            </div>
            <div style={{
              fontFamily:HEAD, fontSize:72, fontWeight:800, color:C.mclaren, lineHeight:1,
              textShadow:`0 0 40px rgba(255,128,0,${counterFlash*0.5})`,
            }}>
              {counter}
            </div>
            <svg width={180} height={70} style={{ overflow:"visible" }}>
              {cumPts.slice(0, Math.max(2, Math.floor(cumPts.length*chartDraw))).map((pts, i) => {
                if (i===0) return null;
                const px = ((i-1)/(cumPts.length-1))*180;
                const py = 70 - (cumPts[i-1]/108)*60 - 5;
                const cx = (i/(cumPts.length-1))*180;
                const cy = 70 - (pts/108)*60 - 5;
                return (
                  <g key={i}>
                    <line x1={px} y1={py} x2={cx} y2={cy} stroke={C.mclaren} strokeWidth={2} strokeLinecap="round" />
                    <circle cx={cx} cy={cy} r={3.5} fill={C.mclaren} />
                    <circle cx={cx} cy={cy} r={7} fill={C.mclaren} opacity={0.15} />
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
// SCENE 4 — News Feed 600–780 (3s)
// Broadcast lower-thirds style, staggered spring
// ═══════════════════════════════════════════════════════════════════════════
function Scene4News() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const articles = [
    { title:"Norris dominates Bahrain opener", sub:"McLaren's MCL39 showed superior S2 speed — gap grew each lap", badge:"RACE WEEKEND", color:C.mclaren, delay:0 },
    { title:"Ferrari unveils aggressive Jeddah upgrade", sub:"Floor revisions target 0.4s downforce deficit vs McLaren", badge:"TECHNICAL", color:C.ferrari, delay:8 },
    { title:'"Best car I\'ve driven in years"', sub:"Hamilton on Mercedes' resurgent W16 after dominant FP3", badge:"QUOTE", color:C.mercedes, delay:16 },
  ];

  const headerOp = mv(frame, [0, 16], [0, 1]);

  return (
    <AbsoluteFill style={{ background:C.black, alignItems:"center", justifyContent:"center" }}>
      <Grain />
      <Scanlines opacity={0.04} />

      <div style={{ display:"flex", flexDirection:"column", gap:18, width:820 }}>

        {/* Section header */}
        <div style={{ display:"flex", alignItems:"center", gap:14, opacity:headerOp }}>
          <div style={{ width:3, height:22, background:C.red, borderRadius:2 }} />
          <span style={{ fontFamily:HEAD, fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.3)", letterSpacing:"3.5px", textTransform:"uppercase" }}>
            NEWS & INSIGHTS
          </span>
          <div style={{ flex:1, height:1, background:"linear-gradient(90deg, rgba(255,255,255,0.08), transparent)" }} />
          <span style={{ fontFamily:MONO, fontSize:10, color:"rgba(255,255,255,0.15)" }}>LIVE</span>
          <div style={{
            width:7, height:7, borderRadius:"50%", background:C.red,
            boxShadow:`0 0 8px ${C.red}`,
            opacity: frame%30 < 15 ? 1 : 0.3,
          }} />
        </div>

        {/* Cards */}
        {articles.map((a, i) => {
          const sp = spr(frame, fps, a.delay, 130, 13);
          const cardY = 50*(1-sp);
          const cardOp = Math.min(sp*2, 1);

          return (
            <div key={i} style={{
              opacity:cardOp,
              transform:`translateY(${cardY}px)`,
              background:C.panel,
              border:`1px solid ${C.border}`,
              borderLeft:`3px solid ${a.color}`,
              borderRadius:16,
              padding:"22px 28px",
              display:"flex", gap:22, alignItems:"center",
              boxShadow:`0 8px 40px rgba(0,0,0,0.6), inset 0 0 0 0.5px rgba(255,255,255,0.03)`,
              position:"relative", overflow:"hidden",
            }}>
              {/* Left color accent */}
              <div style={{
                position:"absolute", top:0, left:0, bottom:0, width:80,
                background:`linear-gradient(90deg, ${a.color}0A, transparent)`,
                pointerEvents:"none",
              }} />

              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9 }}>
                  <span style={{
                    fontFamily:BODY, fontSize:10, fontWeight:700,
                    color:a.color,
                    background:`${a.color}18`,
                    padding:"3px 10px", borderRadius:100,
                    border:`1px solid ${a.color}35`,
                    letterSpacing:"0.8px", textTransform:"uppercase",
                  }}>
                    {a.badge}
                  </span>
                  <span style={{ fontFamily:BODY, fontSize:10, color:"rgba(255,255,255,0.18)" }}>
                    {["2h ago","5h ago","1d ago"][i]}
                  </span>
                </div>
                <div style={{ fontFamily:HEAD, fontSize:24, fontWeight:800, color:C.white, lineHeight:1.15, letterSpacing:"-0.2px" }}>
                  {a.title}
                </div>
                <div style={{ fontFamily:BODY, fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:7, lineHeight:1.55 }}>
                  {a.sub}
                </div>
              </div>

              {/* Right arrow */}
              <div style={{ color:`rgba(255,255,255,0.1)`, fontFamily:HEAD, fontSize:28, fontWeight:800 }}>→</div>
            </div>
          );
        })}
      </div>

      <HUDCorners frame={frame} startFrame={10} color="rgba(255,255,255,0.08)" size={22} gap={30} />
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 5 — End Card 780–900 (2s)
// ═══════════════════════════════════════════════════════════════════════════
function Scene5End() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spr(frame, fps, 5, 160, 12);
  const urlOp = mv(frame, [28, 48], [0, 1]);
  const tagOp = mv(frame, [42, 60], [0, 1]);
  const glowOp = mv(frame, [0, 35], [0, 1]);
  const pulse = Math.sin((frame/30)*Math.PI)*0.5+0.5;

  // Spinning outer ring
  const ringAngle = mv(frame, [0, 120], [0, 90]);

  return (
    <AbsoluteFill style={{ background:C.black, alignItems:"center", justifyContent:"center" }}>
      <Grain />
      <Scanlines />

      <Flash frame={frame} at={0} color={C.red} dur={6} />

      {/* Deep glow */}
      <div style={{
        position:"absolute", width:700, height:700, borderRadius:"50%",
        background:`radial-gradient(circle, rgba(225,6,0,${0.14+pulse*0.06}) 0%, rgba(225,6,0,0.03) 45%, transparent 65%)`,
        top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        opacity:glowOp,
      }} />

      {/* Rotating ring */}
      <svg style={{ position:"absolute", width:"100%", height:"100%", top:0, left:0 }} opacity={glowOp*0.4}>
        <circle cx="50%" cy="50%" r="380"
          fill="none" stroke={C.red} strokeWidth="1"
          strokeDasharray="60 300"
          transform={`rotate(${ringAngle}, 540, 960)`}
          opacity={0.3}
        />
      </svg>

      <SpeedLines frame={frame} startFrame={0} count={16} color={C.red} />

      {/* Corner HUD */}
      <HUDCorners frame={frame} startFrame={14} color={C.red} size={40} gap={44} />

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>

        {/* Wordmark */}
        <Trail layers={3} lagInFrames={0.5} trailOpacity={0.1}>
          <div style={{
            transform:`scale(${0.6+logoScale*0.4})`,
            opacity: Math.min(logoScale*2, 1),
            display:"flex", flexDirection:"column", alignItems:"center",
          }}>
            <div style={{
              fontFamily:HEAD, fontSize:100, fontWeight:800,
              color:C.white, letterSpacing:"8px", lineHeight:1,
              textTransform:"uppercase",
            }}>
              F1 CORE
            </div>
          </div>
        </Trail>

        {/* Sweep */}
        <div style={{ position:"relative", width:440, height:3, marginTop:6 }}>
          <Sweep frame={frame} startFrame={22} y={0} />
        </div>

        {/* URL */}
        <div style={{
          marginTop:18,
          opacity:urlOp, transform:`translateY(${mv(frame,[28,48],[6,0])}px)`,
          fontFamily:MONO, fontSize:20, color:"rgba(225,6,0,0.7)",
          letterSpacing:"4px",
        }}>
          thef1core.com
        </div>

        {/* Tagline */}
        <div style={{
          marginTop:14, opacity:tagOp,
          fontFamily:BODY, fontSize:14, color:"rgba(255,255,255,0.22)",
          letterSpacing:"0.5px",
        }}>
          Real telemetry. Every race. Free.
        </div>

        {/* CTA pill */}
        <div style={{
          marginTop:22,
          opacity: mv(frame, [58, 78], [0, 1]),
          transform:`translateY(${mv(frame,[58,78],[10,0])}px)`,
          background:C.red,
          padding:"10px 32px",
          borderRadius:100,
          fontFamily:HEAD, fontSize:16, fontWeight:700,
          color:C.white, letterSpacing:"2px", textTransform:"uppercase",
          boxShadow:`0 0 30px rgba(225,6,0,${0.3+pulse*0.2})`,
        }}>
          EXPLORE FREE →
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSITIONS between scenes — flash + slice
// ═══════════════════════════════════════════════════════════════════════════
function FlashCut({ frame, at }: { frame:number; at:number }) {
  return (
    <>
      <Flash frame={frame} at={at} color={C.white} dur={4} />
      <Flash frame={frame} at={at+2} color={C.black} dur={3} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT COMPOSITION
// ═══════════════════════════════════════════════════════════════════════════
export function F1CoreDemoComp() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background:C.black }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;600&display=swap');`}</style>

      {/* Scene 1 — Cold Open */}
      <Sequence from={0} durationInFrames={125}>
        <Scene1 />
      </Sequence>

      {/* Flash cut */}
      <Sequence from={120} durationInFrames={10}>
        <AbsoluteFill><FlashCut frame={frame} at={0} /></AbsoluteFill>
      </Sequence>

      {/* Scene 2a — NOR Driver */}
      <Sequence from={122} durationInFrames={82}>
        <Scene2aDriver />
      </Sequence>

      <Sequence from={198} durationInFrames={10}>
        <AbsoluteFill><FlashCut frame={frame} at={0} /></AbsoluteFill>
      </Sequence>

      {/* Scene 2b — Track Map */}
      <Sequence from={200} durationInFrames={82}>
        <Scene2bTrack />
      </Sequence>

      <Sequence from={276} durationInFrames={10}>
        <AbsoluteFill><FlashCut frame={frame} at={0} /></AbsoluteFill>
      </Sequence>

      {/* Scene 2c — Chart */}
      <Sequence from={278} durationInFrames={88}>
        <Scene2cChart />
      </Sequence>

      <Sequence from={360} durationInFrames={10}>
        <AbsoluteFill><FlashCut frame={frame} at={0} /></AbsoluteFill>
      </Sequence>

      {/* Scene 3 — Garage */}
      <Sequence from={362} durationInFrames={242}>
        <Scene3Garage />
      </Sequence>

      <Sequence from={598} durationInFrames={10}>
        <AbsoluteFill><FlashCut frame={frame} at={0} /></AbsoluteFill>
      </Sequence>

      {/* Scene 4 — News */}
      <Sequence from={600} durationInFrames={184}>
        <Scene4News />
      </Sequence>

      <Sequence from={778} durationInFrames={10}>
        <AbsoluteFill><FlashCut frame={frame} at={0} /></AbsoluteFill>
      </Sequence>

      {/* Scene 5 — End Card */}
      <Sequence from={780} durationInFrames={120}>
        <Scene5End />
      </Sequence>
    </AbsoluteFill>
  );
}

// 16:9 pillarbox variant
export function F1CoreDemo16x9Comp() {
  return (
    <AbsoluteFill style={{ background:C.black, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {/* Side panels */}
      {[{left:0,width:657},{right:0,width:657}].map((s,i)=>(
        <div key={i} style={{
          position:"absolute", top:0, bottom:0,
          background:C.black,
          backgroundImage:`repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(225,6,0,0.02) 18px, rgba(225,6,0,0.02) 19px)`,
          ...s,
        }} />
      ))}
      <div style={{ width:607, height:1080, position:"relative", overflow:"hidden" }}>
        <div style={{ width:1080, height:1920, transform:"scale(0.5625)", transformOrigin:"top left" }}>
          <F1CoreDemoComp />
        </div>
      </div>
    </AbsoluteFill>
  );
}

export default function Root() {
  return (
    <>
      <Composition id="F1CoreDemo" component={F1CoreDemoComp} durationInFrames={900} fps={60} width={1080} height={1920} defaultProps={{}} />
      <Composition id="F1CoreDemo16x9" component={F1CoreDemo16x9Comp} durationInFrames={900} fps={60} width={1920} height={1080} defaultProps={{}} />
    </>
  );
}
