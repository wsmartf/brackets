import type { EliminationImpact } from "./GameFeed";

interface ByTheNumbersProps {
  probs: Record<string, number>;
  remaining: number;
  impacts: EliminationImpact[];
}

export default function ByTheNumbers({
  probs,
  remaining,
  impacts,
}: ByTheNumbersProps) {
  const entries = Object.entries(probs);

  const mostBacked = entries.length > 0
    ? entries.reduce((a, b) => (a[1] >= b[1] ? a : b))
    : null;

  const rarest = entries.length > 0
    ? entries.reduce((a, b) => (a[1] <= b[1] ? a : b))
    : null;

  const exactImpacts = impacts.filter((i) => i.exact && i.eliminated != null);
  const biggestKill = exactImpacts.length > 0
    ? Math.max(...exactImpacts.map((i) => i.eliminated ?? 0))
    : null;

  const stats: Array<{ label: string; value: string; sub?: string }> = [];

  if (mostBacked) {
    const count = Math.round(mostBacked[1] * remaining);
    stats.push({
      label: "Most backed",
      value: mostBacked[0],
      sub: `${count.toLocaleString()} brackets · ${(mostBacked[1] * 100).toFixed(1)}%`,
    });
  }

  if (rarest && rarest[0] !== mostBacked?.[0]) {
    const count = Math.round(rarest[1] * remaining);
    stats.push({
      label: "Rarest contender",
      value: rarest[0],
      sub: `${count.toLocaleString()} bracket${count === 1 ? "" : "s"}`,
    });
  }

  if (biggestKill != null) {
    stats.push({
      label: "Biggest single-game kill",
      value: biggestKill.toLocaleString(),
      sub: "brackets from one result",
    });
  }

  if (stats.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-base font-semibold text-white mb-5">By the Numbers</h3>
      <div className="space-y-5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-xs uppercase tracking-wide text-white/30">{stat.label}</p>
            <p className="text-white font-semibold mt-0.5">{stat.value}</p>
            {stat.sub && <p className="text-xs text-white/40 mt-0.5">{stat.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
