import type { Need, Tamagotchi } from "../data/types";

interface Props {
  tam: Tamagotchi;
  compact?: boolean;
}

const labels: Record<Need, { label: string; color: string; icon: string }> = {
  social: { label: "Social", color: "#ff4d6d", icon: "💬" },
  creativity: { label: "Creativity", color: "#ffcf40", icon: "🎨" },
  energy: { label: "Energy", color: "#7cffcb", icon: "⚡" },
};

export function NeedsMeters({ tam, compact }: Props) {
  const keys: Need[] = ["social", "creativity", "energy"];
  return (
    <div className={`flex flex-col gap-2 ${compact ? "" : "w-full"}`}>
      {keys.map((k) => {
        const v = tam.needs[k];
        const { label, color, icon } = labels[k];
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="text-xs w-20 flex items-center gap-1 text-white/70">
              <span>{icon}</span>
              <span className="uppercase tracking-wide font-mono">{label}</span>
            </span>
            <div className="flex-1 h-2 bg-raised rounded-full overflow-hidden border border-line">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${v}%`, background: color }}
              />
            </div>
            <span className="text-[11px] font-mono text-white/60 w-8 text-right">{v}</span>
          </div>
        );
      })}
    </div>
  );
}
