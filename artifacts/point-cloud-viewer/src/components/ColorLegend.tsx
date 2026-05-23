import { PointCloudData } from "../lib/point-cloud";

interface ColorLegendProps {
  data: PointCloudData;
  mode: "height" | "intensity" | "uniform";
}

export function ColorLegend({ data, mode }: ColorLegendProps) {
  if (mode === "uniform") return null;

  const isHeight = mode === "height";
  const label = isHeight ? "Z (Height)" : "Intensity";
  const min = isHeight ? data.boundingBox.min[2] : 0;
  const max = isHeight ? data.boundingBox.max[2] : 1;
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
    <div className="absolute top-4 right-4 z-20 bg-card/85 backdrop-blur-sm border border-border rounded-md p-2 select-none pointer-events-none">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-center mb-1.5">
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <div
          className="w-4 rounded-sm border border-border/60"
          style={{ background: gradient, height: 180 }}
        />
        <div className="flex flex-col justify-between text-[10px] font-mono text-foreground/85" style={{ height: 180 }}>
          {ticks.map((v, i) => (
            <span key={i}>{isHeight ? v.toFixed(1) : v.toFixed(2)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
