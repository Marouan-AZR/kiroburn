import type { ParsedSession, TaskCategory } from "./types.js";

const EDIT_TOOLS = ["write", "edit", "strReplace", "create", "insert"];
const READ_TOOLS = ["read", "glob", "grep", "code", "search"];
const SHELL_TOOL = "shell";

const PATTERNS: [TaskCategory, { tools?: string[]; keywords?: RegExp }][] = [
  ["Testing", { keywords: /\b(test|jest|vitest|pytest|spec|coverage)\b/i }],
  ["Debugging", { keywords: /\b(fix|bug|error|debug|issue|broken|crash|fail)\b/i }],
  ["Git Ops", { keywords: /\b(git|commit|push|merge|rebase|branch|pr|pull request)\b/i }],
  ["Build/Deploy", { keywords: /\b(build|deploy|docker|ci|cd|npm run|compile)\b/i }],
  ["Refactoring", { keywords: /\b(refactor|rename|simplify|clean|reorganize|extract)\b/i }],
  ["Feature Dev", { keywords: /\b(add|create|implement|feature|new|develop)\b/i }],
  ["Planning", { keywords: /\b(plan|design|architect|spec|requirement|todo)\b/i }],
];

export function classifySession(session: ParsedSession): TaskCategory {
  const tools = Object.keys(session.toolBreakdown);
  const hasEdits = tools.some((t) => EDIT_TOOLS.includes(t));
  const hasReads = tools.some((t) => READ_TOOLS.includes(t));
  const title = session.title.toLowerCase();

  // Check keyword patterns against title
  for (const [category, { keywords }] of PATTERNS) {
    if (keywords?.test(title)) return category;
  }

  // Fallback to tool-based classification
  if (hasEdits && !hasReads) return "Coding";
  if (hasReads && !hasEdits) return "Exploration";
  if (hasEdits && hasReads) return "Coding";
  if (session.toolUses === 0) return "Conversation";

  return "General";
}

export function classifySessions(
  sessions: ParsedSession[]
): Record<TaskCategory, ParsedSession[]> {
  const result = {} as Record<TaskCategory, ParsedSession[]>;
  for (const s of sessions) {
    const cat = classifySession(s);
    (result[cat] ??= []).push(s);
  }
  return result;
}
