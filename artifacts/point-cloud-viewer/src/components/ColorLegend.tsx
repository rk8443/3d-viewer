import { PointCloudData } from "../lib/point-cloud";

interface ColorLegendProps {
  data: PointCloudData;
  mode: "height" | "intensity" | "uniform";
  heightRange?: [number, number];
}

export function ColorLegend({ data, mode, heightRange }: ColorLegendProps) {
  if (mode === "uniform") return null;

  const isHeight = mode === "height";
  const label = isHeight ? "Z (Height)" : "Intensity";
  const min = isHeight ? (heightRange?.[0] ?? data.boundingBox.min[2]) : 0;
  const max = isHeight ? (heightRange?.[1] ?? data.boundingBox.max[2]) : 1;
  const range = max - min;

  const gradient = isHeight
    ? "linear-gradient(to top, hsl(252, 100%, 50%), hsl(216, 100%, 50%), hsl(180, 100%, 50%), hsl(108, 100%, 50%), hsl(54, 100%, 50%), hsl(0, 100%, 50%))"
    : "linear-gradient(to top, #000, #fff)";

  const stops = 5;
  const ticks = Array.from({ length: stops }, (_, i) => {
    const t = i / (stops - 1);
    return min + t * range;
  }).reverse();

  return (
    <div className="absolute top-5 right-5 z-20 bg-card/80 backdrop-blur-md border border-border/60 rounded-lg px-3 py-3 select-none pointer-events-none shadow-lg shadow-black/30">
      <div className="text-[9.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80 text-center mb-2">
        {label}
      </div>
      <div className="flex items-stretch gap-2.5">
        <div
          className="w-3.5 rounded-full border border-border/60"
          style={{ background: gradient, height: 180 }}
        />
        <div className="flex flex-col justify-between text-[10px] font-mono text-foreground/85 tabular-nums" style={{ height: 180 }}>
          {ticks.map((v, i) => (
            <span key={i}>{isHeight ? v.toFixed(1) : v.toFixed(2)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
