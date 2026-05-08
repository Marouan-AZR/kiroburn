export interface SessionMeta {
  session_id: string;
  cwd: string;
  created_at: string;
  updated_at: string;
  title: string;
  session_state: {
    version: string;
    conversation_metadata: {
      user_turn_metadatas: TurnMeta[];
    };
    rts_model_state?: {
      model_info?: { model_id: string; context_window_tokens: number };
      context_usage_percentage?: number;
    };
    agent_name?: string;
  };
}

export interface TurnMeta {
  loop_id: { agent_id: { name: string } };
  total_request_count: number;
  number_of_cycles: number;
  builtin_tool_uses: number;
  turn_duration: { secs: number; nanos: number };
  end_reason: string;
  end_timestamp: string;
  input_token_count: number;
  output_token_count: number;
  context_usage_percentage: number;
  metering_usage: unknown[];
}

export interface LogEntry {
  version: string;
  kind: "Prompt" | "AssistantMessage" | "ToolResults";
  data: {
    message_id: string;
    content: ContentBlock[];
    meta?: { timestamp: number };
  };
}

export interface ContentBlock {
  kind: "text" | "toolUse" | "toolResult";
  data: string | ToolUseData | ToolResultData;
}

export interface ToolUseData {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultData {
  toolUseId: string;
  content: ContentBlock[];
}

export interface ParsedSession {
  id: string;
  cwd: string;
  project: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  turns: number;
  toolUses: number;
  toolBreakdown: Record<string, number>;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  durationSecs: number;
  agentName: string;
  modelId: string;
  contextUsage: number;
}

export type TaskCategory =
  | "Coding"
  | "Debugging"
  | "Feature Dev"
  | "Refactoring"
  | "Testing"
  | "Exploration"
  | "Planning"
  | "Git Ops"
  | "Build/Deploy"
  | "Conversation"
  | "General";

export interface DailyStats {
  date: string;
  sessions: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  toolUses: number;
}

export interface OverviewStats {
  totalCost: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalToolUses: number;
  avgCostPerSession: number;
  totalDurationMins: number;
}
