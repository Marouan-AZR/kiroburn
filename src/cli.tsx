import { Command } from "commander";
import { getAllSessions } from "./parser.js";
import { computeOverview, computeDaily, sessionCost, formatCost, formatTokens } from "./pricing.js";
import { classifySessions } from "./classifier.js";
import { renderDashboard } from "./dashboard.js";

const program = new Command();

program
  .name("kiroburn")
  .description("See where your Kiro CLI tokens go.")
  .version("1.0.0");

program
  .command("dashboard", { isDefault: true })
  .description("Interactive TUI dashboard")
  .option("-p, --period <period>", "Initial period (today, 7days, 30days, all)", "7days")
  .action((opts) => {
    renderDashboard(opts.period);
  });

program
  .command("today")
  .description("Today's usage summary")
  .action(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sessions = getAllSessions(start);
    const overview = computeOverview(sessions);
    console.log(`🔥 KiroBurn — Today`);
    console.log(`   Cost: ${formatCost(overview.totalCost)}  Sessions: ${overview.totalSessions}  Tools: ${overview.totalToolUses}`);
    console.log(`   Input: ${formatTokens(overview.totalInputTokens)}  Output: ${formatTokens(overview.totalOutputTokens)}  Time: ${overview.totalDurationMins.toFixed(0)}min`);
  });

program
  .command("status")
  .description("Compact one-liner (today + 7 days)")
  .action(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week = new Date(startOfDay.getTime() - 6 * 86400000);

    const todaySessions = getAllSessions(startOfDay);
    const weekSessions = getAllSessions(week);
    const todayOverview = computeOverview(todaySessions);
    const weekOverview = computeOverview(weekSessions);

    console.log(
      `kiro today: ${formatCost(todayOverview.totalCost)} (${todayOverview.totalSessions} sessions) | 7d: ${formatCost(weekOverview.totalCost)} (${weekOverview.totalSessions} sessions)`
    );
  });

program
  .command("report")
  .description("Detailed report")
  .option("-p, --period <period>", "Period (today, 7days, 30days, all)", "7days")
  .option("--format <format>", "Output format (text, json)", "text")
  .action((opts) => {
    const { from } = parsePeriod(opts.period);
    const sessions = getAllSessions(from);
    const overview = computeOverview(sessions);
    const daily = computeDaily(sessions);
    const categories = classifySessions(sessions);

    if (opts.format === "json") {
      console.log(JSON.stringify({ overview, daily, categories: Object.fromEntries(
        Object.entries(categories).map(([k, v]) => [k, { sessions: v.length, cost: v.reduce((s, x) => s + sessionCost(x), 0) }])
      )}, null, 2));
      return;
    }

    console.log(`\n🔥 KiroBurn Report — ${opts.period}\n`);
    console.log(`  Cost: ${formatCost(overview.totalCost)}  Sessions: ${overview.totalSessions}  Avg: ${formatCost(overview.avgCostPerSession)}/session`);
    console.log(`  Input: ${formatTokens(overview.totalInputTokens)}  Output: ${formatTokens(overview.totalOutputTokens)}  Tools: ${overview.totalToolUses}\n`);

    console.log("  📊 Daily:");
    for (const d of daily) {
      const bar = "█".repeat(Math.max(1, Math.round((d.cost / Math.max(...daily.map(x => x.cost), 0.01)) * 15)));
      console.log(`    ${d.date.slice(5)} ${bar} ${formatCost(d.cost)}`);
    }

    console.log("\n  🏷️  Activities:");
    for (const [cat, ss] of Object.entries(categories)) {
      const cost = ss.reduce((s, x) => s + sessionCost(x), 0);
      console.log(`    ${formatCost(cost).padEnd(8)} (${ss.length}) ${cat}`);
    }
    console.log();
  });

function parsePeriod(period: string): { from?: Date } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "today": return { from: startOfDay };
    case "7days": return { from: new Date(startOfDay.getTime() - 6 * 86400000) };
    case "30days": return { from: new Date(startOfDay.getTime() - 29 * 86400000) };
    case "all": return {};
    default: return { from: new Date(startOfDay.getTime() - 6 * 86400000) };
  }
}

program.parse();
