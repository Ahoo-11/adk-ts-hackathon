#!/usr/bin/env node
import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config, hasProviderKeys } from "./config.js";
import { getCurrentWeather, getForecast, getHistorical } from "./weather/aggregator.js";
import type { LocationQuery } from "./weather/types.js";
import { assessActivity } from "./insights/insights.js";
import { listAlerts, registerAlert, removeAlert, startAlertScheduler } from "./alerts/alertService.js";
import { initializeWeatherAgent, getWeatherInsights, getEnhancedWeatherSummary } from "./agents/weatherAgent.js";

// Simple arg parsing
function getArg(key: string, defaultValue?: string) {
  const prefix = `--${key}=`;
  const match = process.argv.find(a => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : defaultValue;
}
function hasFlag(key: string) { return process.argv.includes(`--${key}`); }

const transport = (getArg("transport", "stdio") as "stdio" | "http");
const port = parseInt(getArg("port", String(config.port))!, 10);
const host = getArg("host", "0.0.0.0")!;
const requireAuth = hasFlag("require-auth");
const bearerToken = getArg("token", "");

// Common MCP server setup (tools registration)
function createMcpServer() {
  const server = new McpServer({ name: "weatherwise-mcp", version: "0.1.0" });

  const LocationSchema = z.object({ city: z.string().optional(), country: z.string().optional(), lat: z.number().optional(), lon: z.number().optional() });
  const UnitsSchema = z.enum(["metric", "imperial"]).optional();

  server.registerTool(
    "get_current_weather",
    { title: "Get Current Weather", description: "Retrieve current weather for a given location.", inputSchema: { location: LocationSchema, units: UnitsSchema }, outputSchema: {} },
    async ({ location, units }: { location: LocationQuery; units?: "metric" | "imperial" }) => {
      const data = await getCurrentWeather(location, units);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { data } };
    }
  );

  server.registerTool(
    "get_forecast",
    { title: "Get Forecast", description: "Retrieve daily forecast for given number of days (default 3).", inputSchema: { location: LocationSchema, units: UnitsSchema, days: z.number().min(1).max(7).optional() }, outputSchema: {} },
    async ({ location, units, days }: { location: LocationQuery; units?: "metric" | "imperial"; days?: number }) => {
      const data = await getForecast(location, units, days ?? 3);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { data } };
    }
  );

  server.registerTool(
    "get_historical",
    { title: "Get Historical", description: "Retrieve historical weather for a given date.", inputSchema: { location: LocationSchema, dateISO: z.string(), units: UnitsSchema }, outputSchema: {} },
    async ({ location, dateISO, units }: { location: LocationQuery; dateISO: string; units?: "metric" | "imperial" }) => {
      const data = await getHistorical(location, dateISO);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { data } };
    }
  );

  server.registerTool(
    "provider_status",
    { title: "Provider Status", description: "Report configured weather providers and readiness.", inputSchema: {}, outputSchema: {} },
    async () => {
      return { content: [{ type: "text", text: JSON.stringify({ hasKeys: hasProviderKeys(), providers: ["OpenWeatherMap", "WeatherAPI"] }, null, 2) }], structuredContent: { hasKeys: hasProviderKeys() } };
    }
  );

  server.registerTool(
    "weather_insights",
    { title: "Weather Insights", description: "AI insights for activities based on current conditions.", inputSchema: { location: LocationSchema, activity: z.string() }, outputSchema: {} },
    async ({ location, activity }: { location: LocationQuery; activity: string }) => {
      const insights = await getWeatherInsights(activity, location);
      return { content: [{ type: "text", text: insights }], structuredContent: { location, activity, insights } };
    }
  );

  server.registerTool(
    "get_weather_summary",
    { title: "AI Weather Summary", description: "Intelligent, human-friendly weather summary using ADK-TS agent.", inputSchema: { location: LocationSchema, days: z.number().min(1).max(7).optional() }, outputSchema: {} },
    async ({ location, days }: { location: LocationQuery; days?: number }) => {
      const summary = await getEnhancedWeatherSummary(location, days);
      return { content: [{ type: "text", text: summary }], structuredContent: { location, days, summary } };
    }
  );

  // Alerts
  server.registerTool(
    "list_alerts",
    { title: "List Alerts", description: "List registered weather alerts.", inputSchema: {}, outputSchema: {} },
    async () => {
      const alerts = listAlerts();
      return { content: [{ type: "text", text: JSON.stringify(alerts, null, 2) }], structuredContent: { alerts } };
    }
  );
  server.registerTool(
    "register_alert",
    { title: "Register Alert", description: "Register a new weather alert.", inputSchema: { name: z.string().optional(), location: LocationSchema, condition: z.object({ type: z.enum(["rain","temp_above","temp_below","wind_above"]), threshold: z.number().optional(), daysAhead: z.number().optional() }), channel: z.enum(["console","webhook"]).optional(), webhookUrl: z.string().url().optional(), sensitivity: z.enum(["low","medium","high"]).optional() }, outputSchema: {} },
    async ({ name, location, condition, channel, webhookUrl, sensitivity }: { name?: string; location: LocationQuery; condition: { type: "rain"|"temp_above"|"temp_below"|"wind_above"; threshold?: number; daysAhead?: number }; channel?: "console"|"webhook"; webhookUrl?: string; sensitivity?: "low"|"medium"|"high" }) => {
      const ok = registerAlert({ name, location, condition, channel: channel ?? "console", webhookUrl, sensitivity });
      return { content: [{ type: "text", text: ok ? "alert_registered" : "alert_failed" }], structuredContent: { ok } };
    }
  );
  server.registerTool(
    "remove_alert",
    { title: "Remove Alert", description: "Remove an existing alert.", inputSchema: { id: z.string() }, outputSchema: {} },
    async ({ id }: { id: string }) => {
      const ok = removeAlert(id);
      return { content: [{ type: "text", text: ok ? "alert_removed" : "alert_not_found" }], structuredContent: { ok } };
    }
  );

  return server;
}

async function main() {
  // Initialize ADK-TS agent
  await initializeWeatherAgent();

  if (transport === "stdio") {
    const server = createMcpServer();
    const stdio = new StdioServerTransport();
    await server.connect(stdio);
    console.log("WeatherWise MCP (STDIO) ready. Launching via STDIO.");
  } else if (transport === "http") {
    // Minimal HTTP server here (to allow CLI mode), reusing streamable transport
    const server = createMcpServer();
    const app = express();
    app.use(express.json({ limit: "1mb" }));

    app.post("/mcp", async (req, res) => {
      // Optional auth
      if (requireAuth) {
        const auth = req.headers["authorization"] || "";
        const token = Array.isArray(auth) ? auth[0] : auth;
        if (!token || !token.includes(bearerToken)) {
          return res.status(401).json({ error: "unauthorized" });
        }
      }
      const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true, sessionIdGenerator: undefined });
      res.on("close", () => transport.close());
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    app.listen(port, host, () => {
      startAlertScheduler();
      console.log(`WeatherWise MCP (HTTP) running on http://${host}:${port}/mcp`);
    });
  }
}

main().catch(err => {
  console.error("WeatherWise MCP CLI failed:", err);
  process.exit(1);
});