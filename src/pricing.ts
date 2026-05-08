import type { ParsedSession, OverviewStats, DailyStats } from "./types.js";

// Pricing per 1M tokens by model
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4.6": { input: 15.0, output: 75.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-sonnet-4.5": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  auto: { input: 3.0, output: 15.0 }, // "auto" assumed Sonnet
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

function getPricing(modelId: string) {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
}

export function calculateCost(inputTokens: number, outputTokens: number, modelId = "auto"): number {
  const p = getPricing(modelId);
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export function sessionCost(session: ParsedSession): number {
  return calculateCost(session.estimatedInputTokens, session.estimatedOutputTokens, session.modelId);
}

export function computeOverview(sessions: ParsedSession[]): OverviewStats {
  const totalInputTokens = sessions.reduce((s, x) => s + x.estimatedInputTokens, 0);
  const totalOutputTokens = sessions.reduce((s, x) => s + x.estimatedOutputTokens, 0);
  const totalCost = sessions.reduce((s, x) => s + sessionCost(x), 0);
  const totalToolUses = sessions.reduce((s, x) => s + x.toolUses, 0);
  const totalDurationMins = sessions.reduce((s, x) => s + x.durationSecs, 0) / 60;

  return {
    totalCost,
    totalSessions: sessions.length,
    totalInputTokens,
    totalOutputTokens,
    totalToolUses,
    avgCostPerSession: sessions.length ? totalCost / sessions.length : 0,
    totalDurationMins,
  };
}

export function computeDaily(sessions: ParsedSession[]): DailyStats[] {
  const byDay: Record<string, ParsedSession[]> = {};
  for (const s of sessions) {
    const day = s.createdAt.toISOString().slice(0, 10);
    (byDay[day] ??= []).push(s);
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySessions]) => {
      const inputTokens = daySessions.reduce((s, x) => s + x.estimatedInputTokens, 0);
      const outputTokens = daySessions.reduce((s, x) => s + x.estimatedOutputTokens, 0);
      return {
        date,
        sessions: daySessions.length,
        cost: daySessions.reduce((s, x) => s + sessionCost(x), 0),
        inputTokens,
        outputTokens,
        toolUses: daySessions.reduce((s, x) => s + x.toolUses, 0),
      };
    });
}

export function formatCost(cost: number): string {
  return cost < 0.01 ? "<$0.01" : `$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}
