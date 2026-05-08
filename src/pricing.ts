import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ParsedSession, OverviewStats, DailyStats } from "./types.js";

const CACHE_DIR = join(homedir(), ".cache", "kiroburn");
const CACHE_FILE = join(CACHE_DIR, "litellm-prices.json");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const LITELLM_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

interface ModelPrice {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_read_input_token_cost?: number;
  cache_creation_input_token_cost?: number;
}

let priceCache: Record<string, ModelPrice> | null = null;

function loadCache(): Record<string, ModelPrice> | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const stat = new Date(readFileSync(CACHE_FILE + ".timestamp", "utf-8").trim());
    if (Date.now() - stat.getTime() > CACHE_TTL) return null;
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function saveCache(data: Record<string, ModelPrice>) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(data));
  writeFileSync(CACHE_FILE + ".timestamp", new Date().toISOString());
}

async function fetchPrices(): Promise<Record<string, ModelPrice>> {
  try {
    const res = await fetch(LITELLM_URL);
    const data = await res.json() as Record<string, ModelPrice>;
    saveCache(data);
    return data;
  } catch {
    return {};
  }
}

export async function loadPrices(): Promise<void> {
  priceCache = loadCache();
  if (!priceCache) {
    priceCache = await fetchPrices();
  }
}

// Hardcoded fallbacks in case LiteLLM fetch fails
const FALLBACK: Record<string, { input: number; output: number }> = {
  "claude-opus-4.6": { input: 5e-6, output: 25e-6 },
  "claude-opus-4-6": { input: 5e-6, output: 25e-6 },
  "claude-sonnet-4.5": { input: 3e-6, output: 15e-6 },
  "claude-sonnet-4-5": { input: 3e-6, output: 15e-6 },
  auto: { input: 3e-6, output: 15e-6 },
};

function resolvePrice(modelId: string): { input: number; output: number } {
  // "auto" in Kiro means Sonnet — don't try to match in LiteLLM
  if (modelId === "auto") return FALLBACK["auto"];

  if (priceCache) {
    // Try exact match
    const exact = priceCache[modelId];
    if (exact?.input_cost_per_token) {
      return { input: exact.input_cost_per_token, output: exact.output_cost_per_token ?? 0 };
    }
    // Try canonical anthropic key (e.g. "claude-opus-4.6" -> "claude-opus-4-6")
    const normalized = modelId.replace(/\./g, "-");
    const directKey = priceCache[normalized];
    if (directKey?.input_cost_per_token) {
      return { input: directKey.input_cost_per_token, output: directKey.output_cost_per_token ?? 0 };
    }
    // Fuzzy: prefer anthropic provider matches
    for (const [key, val] of Object.entries(priceCache)) {
      if (val.input_cost_per_token && key.includes(normalized) && !key.includes("bedrock") && !key.includes("vertex") && !key.includes("azure")) {
        return { input: val.input_cost_per_token, output: val.output_cost_per_token ?? 0 };
      }
    }
  }
  // Fallback
  const fb = FALLBACK[modelId] ?? FALLBACK["auto"];
  return fb;
}

export function calculateCost(inputTokens: number, outputTokens: number, modelId = "auto"): number {
  const p = resolvePrice(modelId);
  // ~90% of input tokens are cache reads (10x cheaper) — standard Anthropic prompt caching
  const cacheRate = 0.90;
  const cachedInput = inputTokens * cacheRate;
  const newInput = inputTokens - cachedInput;
  return newInput * p.input + cachedInput * (p.input * 0.1) + outputTokens * p.output;
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
