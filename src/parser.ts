import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import type {
  SessionMeta,
  LogEntry,
  ParsedSession,
  ContentBlock,
  ToolUseData,
} from "./types.js";

const SESSIONS_DIR = join(homedir(), ".kiro", "sessions", "cli");

// ~4 chars per token (rough estimate like CodeBurn does for Kiro)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractProject(cwd: string): string {
  const parts = cwd.split("/");
  return parts[parts.length - 1] || cwd;
}

function parseJsonl(path: string): LogEntry[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
  const entries: LogEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {}
  }
  return entries;
}

function analyzeLogEntries(entries: LogEntry[]) {
  let inputTokens = 0;
  let outputTokens = 0;
  const toolBreakdown: Record<string, number> = {};
  let toolUses = 0;

  for (const entry of entries) {
    const content = entry.data?.content ?? [];
    if (entry.kind === "Prompt") {
      for (const block of content) {
        if (block.kind === "text" && typeof block.data === "string") {
          inputTokens += estimateTokens(block.data);
        }
      }
    } else if (entry.kind === "AssistantMessage") {
      for (const block of content) {
        if (block.kind === "text" && typeof block.data === "string") {
          outputTokens += estimateTokens(block.data);
        } else if (block.kind === "toolUse") {
          const tool = block.data as ToolUseData;
          toolUses++;
          const name = tool.name || "unknown";
          toolBreakdown[name] = (toolBreakdown[name] || 0) + 1;
          // Tool input counts as output tokens (model generated it)
          outputTokens += estimateTokens(JSON.stringify(tool.input || {}));
        }
      }
    } else if (entry.kind === "ToolResults") {
      for (const block of content) {
        if (block.kind === "toolResult") {
          const result = block.data as { content?: ContentBlock[] };
          for (const rb of result.content ?? []) {
            if (rb.kind === "text" && typeof rb.data === "string") {
              inputTokens += estimateTokens(rb.data);
            }
          }
        }
      }
    }
  }

  return { inputTokens, outputTokens, toolBreakdown, toolUses };
}

export function parseSession(sessionId: string): ParsedSession | null {
  const metaPath = join(SESSIONS_DIR, `${sessionId}.json`);
  const logPath = join(SESSIONS_DIR, `${sessionId}.jsonl`);

  if (!existsSync(metaPath)) return null;

  try {
    const meta: SessionMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
    const entries = parseJsonl(logPath);
    const analysis = analyzeLogEntries(entries);

    const turns =
      meta.session_state?.conversation_metadata?.user_turn_metadatas ?? [];
    const totalDuration = turns.reduce(
      (sum, t) => sum + t.turn_duration.secs + t.turn_duration.nanos / 1e9,
      0
    );

    return {
      id: meta.session_id,
      cwd: meta.cwd,
      project: extractProject(meta.cwd),
      title: meta.title || "Untitled",
      createdAt: new Date(meta.created_at),
      updatedAt: new Date(meta.updated_at),
      turns: turns.length,
      toolUses: analysis.toolUses || turns.reduce((s, t) => s + t.builtin_tool_uses, 0),
      toolBreakdown: analysis.toolBreakdown,
      estimatedInputTokens: analysis.inputTokens,
      estimatedOutputTokens: analysis.outputTokens,
      durationSecs: totalDuration,
      agentName: meta.session_state?.agent_name || "kiro_default",
      modelId: meta.session_state?.rts_model_state?.model_info?.model_id || "auto",
      contextUsage:
        meta.session_state?.rts_model_state?.context_usage_percentage ?? 0,
    };
  } catch {
    return null;
  }
}

export function getAllSessions(
  from?: Date,
  to?: Date
): ParsedSession[] {
  if (!existsSync(SESSIONS_DIR)) return [];

  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
  const sessionIds = files.map((f) => basename(f, ".json"));

  const sessions: ParsedSession[] = [];
  for (const id of sessionIds) {
    const s = parseSession(id);
    if (!s) continue;
    if (from && s.createdAt < from) continue;
    if (to && s.createdAt > to) continue;
    sessions.push(s);
  }

  return sessions.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
}
