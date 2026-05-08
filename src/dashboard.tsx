import React from "react";
import { Box, Text, render, useInput, useApp } from "ink";
import { getAllSessions } from "./parser.js";
import {
  computeOverview,
  computeDaily,
  sessionCost,
  formatCost,
  formatTokens,
} from "./pricing.js";
import { classifySessions } from "./classifier.js";
import type { ParsedSession, DailyStats, OverviewStats, TaskCategory } from "./types.js";

const PERIODS = ["Today", "7 Days", "30 Days", "All"] as const;

function getPeriodDates(period: (typeof PERIODS)[number]): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "Today":
      return { from: startOfDay };
    case "7 Days":
      return { from: new Date(startOfDay.getTime() - 6 * 86400000) };
    case "30 Days":
      return { from: new Date(startOfDay.getTime() - 29 * 86400000) };
    case "All":
      return {};
  }
}

function OverviewPanel({ stats }: { stats: OverviewStats }) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold color="cyan">
        ⚡ Overview
      </Text>
      <Text>
        Cost: <Text color="green" bold>{formatCost(stats.totalCost)}</Text>
        {"  "}Sessions: <Text bold>{stats.totalSessions}</Text>
        {"  "}Avg: <Text color="yellow">{formatCost(stats.avgCostPerSession)}</Text>/session
      </Text>
      <Text>
        Input: <Text color="blue">{formatTokens(stats.totalInputTokens)}</Text>
        {"  "}Output: <Text color="magenta">{formatTokens(stats.totalOutputTokens)}</Text>
        {"  "}Tools: <Text color="cyan">{stats.totalToolUses}</Text>
        {"  "}Time: <Text>{stats.totalDurationMins.toFixed(0)}min</Text>
      </Text>
    </Box>
  );
}

function DailyChart({ daily }: { daily: DailyStats[] }) {
  const maxCost = Math.max(...daily.map((d) => d.cost), 0.01);
  const barWidth = 20;

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold color="cyan">
        📊 Daily Cost
      </Text>
      {daily.slice(-7).map((d) => {
        const width = Math.max(1, Math.round((d.cost / maxCost) * barWidth));
        return (
          <Box key={d.date}>
            <Text>{d.date.slice(5)} </Text>
            <Text color="green">{"█".repeat(width)}</Text>
            <Text> {formatCost(d.cost)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function ProjectsPanel({ sessions }: { sessions: ParsedSession[] }) {
  const byProject: Record<string, ParsedSession[]> = {};
  for (const s of sessions) (byProject[s.project] ??= []).push(s);

  const sorted = Object.entries(byProject)
    .map(([name, ss]) => ({
      name,
      cost: ss.reduce((sum, s) => sum + sessionCost(s), 0),
      sessions: ss.length,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8);

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold color="cyan">
        📁 Projects
      </Text>
      {sorted.map((p) => (
        <Box key={p.name}>
          <Text>
            <Text color="green">{formatCost(p.cost).padEnd(8)}</Text>
            <Text dimColor>({p.sessions})</Text> {p.name}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function ToolsPanel({ sessions }: { sessions: ParsedSession[] }) {
  const allTools: Record<string, number> = {};
  for (const s of sessions) {
    for (const [tool, count] of Object.entries(s.toolBreakdown)) {
      allTools[tool] = (allTools[tool] || 0) + count;
    }
  }

  const sorted = Object.entries(allTools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold color="cyan">
        🔧 Tools
      </Text>
      {sorted.map(([name, count]) => (
        <Box key={name}>
          <Text>
            <Text color="yellow">{String(count).padStart(4)}</Text> {name}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function ModelsPanel({ sessions }: { sessions: ParsedSession[] }) {
  const byModel: Record<string, ParsedSession[]> = {};
  for (const s of sessions) (byModel[s.modelId] ??= []).push(s);

  const sorted = Object.entries(byModel)
    .map(([model, ss]) => ({
      model,
      cost: ss.reduce((sum, s) => sum + sessionCost(s), 0),
      sessions: ss.length,
    }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold color="cyan">
        🤖 Models
      </Text>
      {sorted.map((m) => (
        <Box key={m.model}>
          <Text>
            <Text color="green">{formatCost(m.cost).padEnd(8)}</Text>
            <Text dimColor>({m.sessions})</Text> {m.model}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function CategoriesPanel({ sessions }: { sessions: ParsedSession[] }) {
  const classified = classifySessions(sessions);
  const sorted = (Object.entries(classified) as [TaskCategory, ParsedSession[]][])
    .map(([cat, ss]) => ({
      cat,
      cost: ss.reduce((sum, s) => sum + sessionCost(s), 0),
      count: ss.length,
    }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold color="cyan">
        🏷️  Activities
      </Text>
      {sorted.map((c) => (
        <Box key={c.cat}>
          <Text>
            <Text color="green">{formatCost(c.cost).padEnd(8)}</Text>
            <Text dimColor>({c.count})</Text> {c.cat}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function Dashboard({ initialPeriod }: { initialPeriod?: string }) {
  const [periodIdx, setPeriodIdx] = React.useState(
    initialPeriod === "today" ? 0 : initialPeriod === "all" ? 3 : 1
  );
  const [tick, setTick] = React.useState(0);
  const { exit } = useApp();

  React.useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  useInput((input, key) => {
    if (input === "q") exit();
    if (input === "r") setTick((t) => t + 1); // manual refresh
    if (key.leftArrow) setPeriodIdx((i) => Math.max(0, i - 1));
    if (key.rightArrow) setPeriodIdx((i) => Math.min(PERIODS.length - 1, i + 1));
    if (input >= "1" && input <= "4") setPeriodIdx(Number(input) - 1);
  });

  const period = PERIODS[periodIdx];
  const { from, to } = getPeriodDates(period);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = tick; // ensure re-render on tick change
  const sessions = getAllSessions(from, to);
  const overview = computeOverview(sessions);
  const daily = computeDaily(sessions);

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold color="white" backgroundColor="blue">
          {" "}🔥 KiroBurn{" "}
        </Text>
        <Box>
          {PERIODS.map((p, i) => (
            <Text key={p} color={i === periodIdx ? "green" : "white"} bold={i === periodIdx}>
              {i === periodIdx ? `[${p}]` : ` ${p} `}
            </Text>
          ))}
        </Box>
        <Text dimColor>q:quit r:refresh ←→:period</Text>
      </Box>

      <OverviewPanel stats={overview} />

      <Box>
        <Box flexDirection="column" flexGrow={1}>
          <DailyChart daily={daily} />
          <CategoriesPanel sessions={sessions} />
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <ProjectsPanel sessions={sessions} />
          <ModelsPanel sessions={sessions} />
          <ToolsPanel sessions={sessions} />
        </Box>
      </Box>
    </Box>
  );
}

export function renderDashboard(period?: string) {
  render(<Dashboard initialPeriod={period} />);
}
