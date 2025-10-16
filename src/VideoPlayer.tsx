import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  src: string;
  size?: number;      
  radius?: number;    
  barWidth?: number;  
};

export default function VideoPlayer({
  src,
  size = 360,
  radius = 50,
  barWidth = 24,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [hoverLen, setHoverLen] = useState<number | null>(null);
  const [pathLen, setPathLen] = useState(1);

  // padding so the stroke stays inside the SVG
  const pad = useMemo(() => Math.ceil(barWidth / 2) + 2, [barWidth]);
  const sv = size;

  // Rounded-square path that starts at TOP-MIDDLE and goes clockwise
  const d = useMemo(() => {
    const w = sv - pad * 2;
    const h = sv - pad * 2;
    const r = Math.min(radius, w / 2, h / 2);

    const x0 = pad + w / 2;
    const y0 = pad;

    return [
      `M ${x0} ${y0}`,
      `L ${pad + w - r} ${y0}`,
      `A ${r} ${r} 0 0 1 ${pad + w} ${pad + r}`,
      `L ${pad + w} ${pad + h - r}`,
      `A ${r} ${r} 0 0 1 ${pad + w - r} ${pad + h}`,
      `L ${pad + r} ${pad + h}`,
      `A ${r} ${r} 0 0 1 ${pad} ${pad + h - r}`,
      `L ${pad} ${pad + r}`,
      `A ${r} ${r} 0 0 1 ${pad + r} ${pad}`,
      `L ${x0} ${y0}`,
    ].join(" ");
  }, [sv, pad, radius]);

  // Measure total path length once rendered
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
    });
    return () => cancelAnimationFrame(id);
  }, [d]);

  
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => setDuration(v.duration || 0);
    const onTime = () => setCurrent(v.currentTime || 0);
    const onEnd = () => setIsPlaying(false);

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
    };
  }, []);

  const progress = duration > 0 ? current / duration : 0;

  // Hover -> nearest point along the path 
  const handlePointerMove: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (!pathRef.current) return;
    const p = pathRef.current;
    const svgEl = (e.target as Element).closest("svg") as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const samples = 480;
    let bestLen = 0;
    let bestDist2 = Number.POSITIVE_INFINITY;

    for (let i = 0; i <= samples; i++) {
      const l = (i / samples) * pathLen;
      const pt = p.getPointAtLength(l);
      const dx = pt.x - x;
      const dy = pt.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) {
        bestDist2 = d2;
        bestLen = l;
      }
    }

    // Only show when cursor is near the track
    const HOVER_TOL = Math.max(barWidth, 24); 
    if (Math.sqrt(bestDist2) <= HOVER_TOL) {
      setHoverLen(bestLen);
    } else {
      setHoverLen(null);
    }
  };

  const handlePointerLeave = () => setHoverLen(null);

  const seekFromHover = () => {
    if (hoverLen == null || !videoRef.current || !duration) return;
    const frac = hoverLen / pathLen;
    videoRef.current.currentTime = Math.max(0, Math.min(duration * frac, duration - 0.01));
    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      await v.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const replay = async () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    await v.play().catch(() => {});
    setIsPlaying(true);
  };

  // Stroke configs
  const redDash = `${(progress * pathLen).toFixed(2)} ${pathLen.toFixed(2)}`;

  // Yellow indicator 
  const yellowVisible = 10; // px of visible dash
  const yellowDash = `${yellowVisible} ${pathLen}`;
  const yellowOffset =
    hoverLen == null ? 0 : Math.max(pathLen - (hoverLen - yellowVisible / 2), 0);

  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      {/* Rounded container */}
      <div className="absolute inset-0 rounded-[50px] bg-neutral-900/60 backdrop-blur-sm shadow-2xl" />

      {/* The video (rounded square inside) */}
      <div className="absolute inset-[36px] overflow-hidden" style={{ borderRadius: `${radius - 14}px` }}>
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          controls={false}
        />
      </div>

      {/* Around-the-video seek bar */}
      <svg
        width={sv}
        height={sv}
        viewBox={`0 0 ${sv} ${sv}`}
        className="absolute inset-0"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={seekFromHover}
      >
        {/* Base track */}
        <path
          d={d}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={barWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Progress (red) */}
        <path
          d={d}
          ref={pathRef}
          stroke="#E71C20"
          strokeWidth={barWidth}
          fill="none"
          strokeLinecap="round"
          style={{ strokeDasharray: redDash }}
        />

        {/* Yellow hover marker (only when on the track) */}
        {hoverLen !== null && (
          <path
            d={d}
            stroke="#F7E49F"
            strokeWidth={barWidth}
            fill="none"
            strokeLinecap="butt"
            style={{
              strokeDasharray: yellowDash,
              strokeDashoffset: yellowOffset,
            }}
          />
        )}

        {/* Invisible hit area for comfy hover/clicks; logic still checks closeness */}
        <path d={d} stroke="transparent" strokeWidth={Math.max(barWidth, 28)} fill="none" style={{ cursor: "pointer" }} />
      </svg>

      {/* Controls */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          {!isPlaying ? (
            <button
              onClick={togglePlay}
              className="px-5 py-2 rounded-2xl bg-white text-black text-sm font-semibold shadow hover:opacity-90 active:scale-95"
            >
              {current >= duration - 0.01 && duration > 0 ? "Play Again" : "Play"}
            </button>
          ) : (
            <button
              onClick={togglePlay}
              className="px-5 py-2 rounded-2xl bg-white text-black text-sm font-semibold shadow hover:opacity-90 active:scale-95"
            >
              Pause
            </button>
          )}
          {current >= duration - 0.01 && duration > 0 && (
            <button
              onClick={replay}
              className="px-4 py-2 rounded-2xl bg-neutral-200 text-neutral-900 text-sm font-semibold shadow hover:opacity-90 active:scale-95"
            >
              Replay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
