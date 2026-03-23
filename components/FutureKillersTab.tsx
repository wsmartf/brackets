"use client";

import { useEffect, useState } from "react";
import type { FutureKillerRow } from "@/lib/future-killers";

interface FutureKillersResponse {
  rows?: FutureKillerRow[];
  source?: "espn" | "derived";
  isFallback?: boolean;
  note?: string | null;
}

const ROUND_LABELS: Record<number, string> = {
  64: "Round of 64",
  32: "Round of 32",
  16: "Sweet 16",
  8: "Elite Eight",
  4: "Final Four",
  2: "Championship",
};

function formatScheduledTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function FutureKillersTab() {
  const [rows, setRows] = useState<FutureKillerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFutureKillers() {
      try {
        const response = await fetch("/api/future-killers");
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const data = (await response.json()) as FutureKillersResponse;
        if (cancelled) {
          return;
        }

        setRows(Array.isArray(data.rows) ? data.rows : []);
        setNote(data.note ?? null);
        setIsFallback(Boolean(data.isFallback));
      } catch (error) {
        console.error("Failed to load future killers:", error);
        if (cancelled) {
          return;
        }

        setRows([]);
        setNote("Could not load upcoming games right now.");
        setIsFallback(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFutureKillers();
    const intervalId = window.setInterval(() => {
      void loadFutureKillers();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (loading) {
    return (
      <div className="text-sm italic text-white/40">
        Loading upcoming tournament games...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm italic text-white/40">
          {note ?? "No upcoming scheduled tournament games with known participants yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-white/40">
          Next scheduled games that are guaranteed to eliminate surviving brackets.
        </p>
        {note && (
          <p className={`text-xs ${isFallback ? "text-amber-300/80" : "text-white/32"}`}>
            {note}
          </p>
        )}
      </div>

      {rows.map((row) => {
        const totalPicks = row.team1Count + row.team2Count;
        const team1Width = totalPicks > 0 ? (row.team1Count / totalPicks) * 100 : 50;
        const team2Width = totalPicks > 0 ? (row.team2Count / totalPicks) * 100 : 50;
        const scheduledLabel = formatScheduledTime(row.scheduledAt);

        return (
          <div
            key={`${row.gameIndex}-${row.espnEventId ?? "derived"}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium text-white">{row.team1}</span>
                  <span className="text-white/25">vs</span>
                  <span className="font-medium text-white">{row.team2}</span>
                  <span className="text-xs text-white/30">
                    {ROUND_LABELS[row.round] ?? `R${row.round}`}
                  </span>
                </div>
                {scheduledLabel && (
                  <p className="mt-1 text-xs text-white/38">{scheduledLabel}</p>
                )}
              </div>
              <p className="text-sm font-medium tabular-nums text-amber-200/85">
                {row.guaranteedKills.toLocaleString()} guaranteed kills
              </p>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="flex h-full">
                <div className="bg-rose-500/70" style={{ width: `${team1Width}%` }} />
                <div className="bg-sky-400/70" style={{ width: `${team2Width}%` }} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/60">
              <span>{row.team1Count.toLocaleString()} pick {row.team1}</span>
              <span>{row.team2Count.toLocaleString()} pick {row.team2}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
