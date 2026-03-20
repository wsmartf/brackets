"""
Bracket stats visualizations — reads data/bracket-stats.json and writes
10 PNG charts to data/viz/.
"""

import json
import math
import os
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# ── paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA = ROOT / "data" / "bracket-stats.json"
OUT  = ROOT / "data" / "viz"
OUT.mkdir(exist_ok=True)

with open(DATA) as f:
    stats = json.load(f)

TOTAL   = stats["totalBrackets"]
PER_TEAM = stats["perTeam"]
PICKS   = stats["pickCounts"]
HIST    = stats["r1UpsetHistogram"]

ROUND_NAMES = ["R64", "R32", "S16", "E8", "F4", "Champion"]
REGIONS     = ["East", "West", "Midwest", "South"]
SEED_PAIRS  = [(1,16),(8,9),(5,12),(4,13),(6,11),(3,14),(7,10),(2,15)]

REGION_COLORS = {
    "East":    "#4e79a7",
    "West":    "#f28e2b",
    "Midwest": "#59a14f",
    "South":   "#e15759",
}

# ── helpers ─────────────────────────────────────────────────────────────────

def save(fig, name):
    path = OUT / name
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  wrote {path.relative_to(ROOT)}")


def pct(n):
    return n / TOTAL * 100


def team_by(key, reverse=True):
    return sorted(PER_TEAM.items(), key=lambda kv: kv[1]["roundCounts"][key], reverse=reverse)


# ── 1. Championship probability — top 20 teams ──────────────────────────────
def plot_champion_probs():
    teams = team_by("Champion")[:20]
    names  = [t[0] for t in teams]
    probs  = [pct(t[1]["roundCounts"]["Champion"]) for t in teams]
    colors = [REGION_COLORS[t[1]["region"]] for t in teams]
    seeds  = [t[1]["seed"] for t in teams]

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.barh(range(len(names)), probs, color=colors, edgecolor="white", linewidth=0.5)
    ax.set_yticks(range(len(names)))
    ax.set_yticklabels([f"({s}) {n}" for n, s in zip(names, seeds)], fontsize=9)
    ax.invert_yaxis()
    ax.set_xlabel("% of brackets picking as Champion")
    ax.set_title("Champion Probability — Top 20 Teams", fontweight="bold")
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.1f}%"))

    # value labels
    for bar, p in zip(bars, probs):
        ax.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height() / 2,
                f"{p:.1f}%", va="center", fontsize=8)

    legend = [mpatches.Patch(color=c, label=r) for r, c in REGION_COLORS.items()]
    ax.legend(handles=legend, loc="lower right", fontsize=8)
    ax.set_xlim(0, max(probs) * 1.18)
    fig.tight_layout()
    save(fig, "01_champion_probs.png")


# ── 2. Round advancement rates — all 64 teams heat-map ──────────────────────
def plot_advancement_heatmap():
    # Sort teams by champion prob descending
    teams_sorted = team_by("Champion")
    names  = [t[0] for t in teams_sorted]
    seeds  = [t[1]["seed"] for t in teams_sorted]
    matrix = np.array([
        [pct(t[1]["roundCounts"][r]) for r in ROUND_NAMES]
        for t in teams_sorted
    ])

    fig, ax = plt.subplots(figsize=(9, 16))
    im = ax.imshow(matrix, aspect="auto", cmap="YlOrRd", vmin=0, vmax=100)

    ax.set_xticks(range(6))
    ax.set_xticklabels(ROUND_NAMES, fontsize=10, fontweight="bold")
    ax.set_yticks(range(64))
    ax.set_yticklabels([f"({s}) {n}" for n, s in zip(names, seeds)], fontsize=6.5)
    ax.set_title("Round Advancement Rates — All 64 Teams\n(% of 1B brackets)", fontweight="bold")

    plt.colorbar(im, ax=ax, shrink=0.4, label="% of brackets")
    fig.tight_layout()
    save(fig, "02_advancement_heatmap.png")


# ── 3. R1 upset rates by seed matchup ───────────────────────────────────────
def plot_seed_upset_rates():
    # Average upset rate across 4 regions for each seed matchup
    upset_by_seed = {}
    for region_idx in range(4):
        for match_idx, (s1, s2) in enumerate(SEED_PAIRS):
            slot = str(region_idx * 8 + match_idx)
            key  = f"{s1}v{s2}"
            rate = pct(PICKS[slot]["team2Picks"])
            upset_by_seed.setdefault(key, []).append(rate)

    labels = [f"{s1} vs {s2}" for s1, s2 in SEED_PAIRS]
    means  = [np.mean(upset_by_seed[f"{s1}v{s2}"]) for s1, s2 in SEED_PAIRS]
    errs   = [np.std(upset_by_seed[f"{s1}v{s2}"]) for s1, s2 in SEED_PAIRS]

    # Sort by mean upset rate
    order  = np.argsort(means)[::-1]
    labels = [labels[i] for i in order]
    means  = [means[i] for i in order]
    errs   = [errs[i] for i in order]

    colors = ["#d73027" if m > 40 else "#fc8d59" if m > 20 else "#91bfdb" for m in means]

    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.bar(range(len(labels)), means, color=colors, edgecolor="white",
                  yerr=errs, capsize=4, error_kw={"elinewidth": 1.2})
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=9)
    ax.set_ylabel("% of brackets picking the upset")
    ax.set_title("R1 Upset Rates by Seed Matchup\n(avg across 4 regions; error bars = std dev)", fontweight="bold")
    ax.axhline(50, color="gray", linestyle="--", linewidth=0.8, label="50% (coin flip)")
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.0f}%"))

    for bar, m in zip(bars, means):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1.2,
                f"{m:.1f}%", ha="center", fontsize=8)

    ax.legend(fontsize=8)
    ax.set_ylim(0, 60)
    fig.tight_layout()
    save(fig, "03_seed_upset_rates.png")


# ── 4. R1 upset count histogram ─────────────────────────────────────────────
def plot_r1_upset_histogram():
    counts = [HIST[str(i)] for i in range(33)]
    xs     = list(range(33))
    probs  = [c / TOTAL * 100 for c in counts]

    mean_upsets = sum(i * counts[i] for i in range(33)) / TOTAL
    mode_upsets = int(np.argmax(counts))

    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.bar(xs, probs, color="#4e79a7", edgecolor="white", linewidth=0.5)
    ax.axvline(mean_upsets, color="#e15759", linewidth=2, linestyle="--",
               label=f"Mean = {mean_upsets:.1f}")
    ax.axvline(mode_upsets, color="#59a14f", linewidth=2, linestyle="-.",
               label=f"Mode = {mode_upsets}")
    ax.set_xlabel("Number of R1 upsets in bracket")
    ax.set_ylabel("% of brackets")
    ax.set_title("Distribution of R1 Upsets per Bracket\n(across 1 billion brackets)", fontweight="bold")
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.1f}%"))
    ax.legend(fontsize=9)
    fig.tight_layout()
    save(fig, "04_r1_upset_histogram.png")


# ── 5. Round-by-round survival funnel — top 8 contenders ────────────────────
def plot_survival_funnel():
    top8 = team_by("Champion")[:8]

    fig, ax = plt.subplots(figsize=(10, 5))
    x = np.arange(6)

    for name, data in top8:
        y = [pct(data["roundCounts"][r]) for r in ROUND_NAMES]
        color = REGION_COLORS[data["region"]]
        ax.plot(x, y, marker="o", label=f"({data['seed']}) {name}", color=color, linewidth=2)

    ax.set_xticks(x)
    ax.set_xticklabels(ROUND_NAMES)
    ax.set_ylabel("% of brackets advancing")
    ax.set_title("Survival Funnel — Top 8 Title Contenders", fontweight="bold")
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.0f}%"))
    ax.legend(fontsize=8, loc="upper right")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    save(fig, "05_survival_funnel.png")


# ── 6. "Floor vs Ceiling" — R32 rate vs Champion rate (bubble chart) ────────
def plot_floor_vs_ceiling():
    entries = [
        (name, t["seed"], t["region"],
         pct(t["roundCounts"]["R32"]),
         pct(t["roundCounts"]["Champion"]))
        for name, t in PER_TEAM.items()
    ]
    # Only teams with >1% R32 rate (otherwise chart gets noisy)
    entries = [(n, s, r, r32, ch) for n, s, r, r32, ch in entries if r32 > 1]

    fig, ax = plt.subplots(figsize=(10, 7))
    for name, seed, region, r32, champ in entries:
        color = REGION_COLORS[region]
        ax.scatter(r32, champ, color=color, s=60, zorder=3, alpha=0.85)
        if champ > 1.0 or r32 > 50:
            ax.annotate(f"({seed}) {name}", (r32, champ),
                        textcoords="offset points", xytext=(4, 3), fontsize=7)

    ax.set_xlabel("R32 advancement rate (% of brackets)")
    ax.set_ylabel("Champion probability (% of brackets)")
    ax.set_title("Floor vs Ceiling — R32 Rate vs. Championship Odds", fontweight="bold")
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.0f}%"))
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.1f}%"))
    ax.grid(True, alpha=0.25)

    legend = [mpatches.Patch(color=c, label=r) for r, c in REGION_COLORS.items()]
    ax.legend(handles=legend, fontsize=8)
    fig.tight_layout()
    save(fig, "06_floor_vs_ceiling.png")


# ── 7. Regional power comparison — stacked round advancement ────────────────
def plot_regional_power():
    fig, axes = plt.subplots(1, 4, figsize=(14, 6), sharey=True)

    for ax, region in zip(axes, REGIONS):
        region_teams = [(n, t) for n, t in PER_TEAM.items() if t["region"] == region]
        region_teams.sort(key=lambda x: x[1]["seed"])

        names = [f"({t['seed']}) {n}" for n, t in region_teams]
        matrix = np.array([
            [pct(t["roundCounts"][r]) for r in ROUND_NAMES]
            for _, t in region_teams
        ])

        colors = ["#4e79a7", "#76b7b2", "#59a14f", "#edc948", "#f28e2b", "#e15759"]
        bottom = np.zeros(len(names))
        for i, (rname, color) in enumerate(zip(ROUND_NAMES, colors)):
            vals = matrix[:, i] - (matrix[:, i-1] if i > 0 else 0)
            vals = np.clip(vals, 0, None)
            ax.barh(range(len(names)), vals, left=bottom, color=color,
                    label=rname if region == REGIONS[0] else "", edgecolor="white", linewidth=0.3)
            bottom += vals

        ax.set_yticks(range(len(names)))
        ax.set_yticklabels(names, fontsize=7.5)
        ax.invert_yaxis()
        ax.set_title(region, fontweight="bold", fontsize=11)
        ax.set_xlabel("% of brackets")
        ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.0f}%"))

    handles = [mpatches.Patch(color=c, label=r)
               for r, c in zip(ROUND_NAMES, ["#4e79a7","#76b7b2","#59a14f","#edc948","#f28e2b","#e15759"])]
    fig.legend(handles=handles, loc="lower center", ncol=6, fontsize=8, bbox_to_anchor=(0.5, -0.04))
    fig.suptitle("Regional Power — Round Advancement Rates by Region", fontweight="bold", y=1.01)
    fig.tight_layout()
    save(fig, "07_regional_power.png")


# ── 8. Most lopsided vs most contested R1 games ─────────────────────────────
def plot_r1_game_competitiveness():
    r1_games = []
    for i in range(32):
        slot = str(i)
        p    = PICKS[slot]
        rate = pct(p["team2Picks"])
        # Compute seeds from perTeam
        s1 = PER_TEAM.get(p["team1"], {}).get("seed", "?")
        s2 = PER_TEAM.get(p["team2"], {}).get("seed", "?")
        label = f"({s1}) {p['team1'][:10]}\nvs ({s2}) {p['team2'][:10]}"
        r1_games.append((label, rate, abs(rate - 50)))

    r1_games.sort(key=lambda x: x[2])  # sort by distance from 50%

    labels = [g[0] for g in r1_games]
    rates  = [g[1] for g in r1_games]
    colors = ["#e15759" if r > 50 else "#4e79a7" for r in rates]

    fig, ax = plt.subplots(figsize=(10, 11))
    bars = ax.barh(range(len(labels)), rates, color=colors, edgecolor="white", linewidth=0.4)
    ax.axvline(50, color="black", linewidth=1.2, linestyle="--", alpha=0.5, label="50% (coin flip)")
    ax.set_yticks(range(len(labels)))
    ax.set_yticklabels(labels, fontsize=7)
    ax.invert_yaxis()
    ax.set_xlabel("% of brackets picking team 2 (lower-seeded team)")
    ax.set_title("R1 Game Competitiveness — Sorted by Closeness to 50/50\n(blue = team1 favored, red = team2 favored)", fontweight="bold")
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.0f}%"))
    ax.set_xlim(0, 75)
    ax.legend(fontsize=8)
    fig.tight_layout()
    save(fig, "08_r1_competitiveness.png")


# ── 9. Champion entropy by region (bar + annotation) ───────────────────────
def plot_regional_entropy():
    entropies = {}
    top_teams = {}
    for region in REGIONS:
        teams = [(n, t) for n, t in PER_TEAM.items() if t["region"] == region]
        probs = [t["roundCounts"]["Champion"] / TOTAL for _, t in teams]
        entropy = -sum(p * math.log2(p) for p in probs if p > 0)
        entropies[region] = entropy
        top = sorted(teams, key=lambda x: x[1]["roundCounts"]["Champion"], reverse=True)[:3]
        top_teams[region] = top

    fig, ax = plt.subplots(figsize=(7, 5))
    colors = [REGION_COLORS[r] for r in REGIONS]
    bars = ax.bar(REGIONS, [entropies[r] for r in REGIONS], color=colors, edgecolor="white", width=0.5)

    for bar, region in zip(bars, REGIONS):
        h = bar.get_height()
        top3 = top_teams[region]
        lines = [f"({t['seed']}) {n}: {pct(t['roundCounts']['Champion']):.1f}%" for n, t in top3]
        ax.text(bar.get_x() + bar.get_width() / 2, h + 0.005,
                "\n".join(lines), ha="center", va="bottom", fontsize=7.5,
                bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.8))
        ax.text(bar.get_x() + bar.get_width() / 2, h / 2,
                f"{h:.3f} bits", ha="center", va="center", fontsize=10,
                fontweight="bold", color="white")

    ax.set_ylabel("Shannon entropy (bits)")
    ax.set_title("Regional Competitive Balance\n(higher entropy = more unpredictable champion)", fontweight="bold")
    ax.set_ylim(0, max(entropies.values()) * 1.55)
    fig.tight_layout()
    save(fig, "09_regional_entropy.png")


# ── 10. Cumulative championship concentration (Lorenz-style) ─────────────────
def plot_championship_concentration():
    all_teams = sorted(PER_TEAM.items(), key=lambda kv: kv[1]["roundCounts"]["Champion"])
    champ_counts = [t["roundCounts"]["Champion"] / TOTAL for _, t in all_teams]
    cumulative = np.cumsum(champ_counts)

    # Equality line
    eq_line = np.linspace(0, 1, 64)

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot(np.linspace(0, 100, 64), cumulative * 100, color="#4e79a7", linewidth=2.5,
            label="Actual distribution")
    ax.plot([0, 100], [0, 100], color="gray", linestyle="--", linewidth=1.2, label="Perfect equality")
    ax.fill_between(np.linspace(0, 100, 64), cumulative * 100, np.linspace(0, 100, 64),
                    alpha=0.15, color="#4e79a7")

    # Annotate: what % of teams account for 80% of championships
    idx80 = next(i for i, c in enumerate(cumulative) if c >= 0.80)
    pct_teams = (idx80 + 1) / 64 * 100
    ax.annotate(f"Top {100 - pct_teams:.0f}% of teams\nhold 80% of champ prob",
                xy=(pct_teams, 20), xytext=(30, 10),
                arrowprops=dict(arrowstyle="->", color="black"),
                fontsize=9,
                bbox=dict(boxstyle="round", fc="white", alpha=0.8))

    ax.set_xlabel("Cumulative % of teams (weakest → strongest)")
    ax.set_ylabel("Cumulative % of championship probability")
    ax.set_title("Championship Probability Concentration\n(Lorenz curve — how top-heavy is the bracket?)", fontweight="bold")
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    save(fig, "10_championship_concentration.png")


# ── run all ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Reading {DATA}")
    print(f"Total brackets: {TOTAL:,}")
    print(f"Writing charts to {OUT}/\n")

    plot_champion_probs()
    plot_advancement_heatmap()
    plot_seed_upset_rates()
    plot_r1_upset_histogram()
    plot_survival_funnel()
    plot_floor_vs_ceiling()
    plot_regional_power()
    plot_r1_game_competitiveness()
    plot_regional_entropy()
    plot_championship_concentration()

    print("\nDone.")
