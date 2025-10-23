import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config, hasProviderKeys } from "./config.js";
import { getCurrentWeather, getForecast, getHistorical } from "./weather/aggregator.js";
import type { LocationQuery } from "./weather/types.js";
import { assessActivity } from "./insights/insights.js";
import { listAlerts, registerAlert, removeAlert, startAlertScheduler } from "./alerts/alertService.js";
import { initializeWeatherAgent, getWeatherInsights, getEnhancedWeatherSummary } from "./agents/weatherAgent.js";

// Create MCP server
const server = new McpServer({
  name: "weatherwise-mcp",
  version: "0.1.0",
});

// Zod schemas
const LocationSchema = z.object({
  city: z.string().optional(),
  country: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

const UnitsSchema = z.enum(["metric", "imperial"]).optional();

server.registerTool(
  "get_current_weather",
  {
    title: "Get Current Weather",
    description: "Retrieve current weather conditions for a location (city or lat/lon).",
    inputSchema: { location: LocationSchema, units: UnitsSchema },
    outputSchema: {}
  },
  async ({ location, units }: { location: LocationQuery; units?: "metric" | "imperial" }) => {
    const data = await getCurrentWeather(location, units);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { data },
    };
  }
);

server.registerTool(
  "get_forecast",
  {
    title: "Get Forecast",
    description: "Retrieve daily forecast for given number of days (default 3).",
    inputSchema: { location: LocationSchema, units: UnitsSchema, days: z.number().min(1).max(7).optional() },
    outputSchema: {}
  },
  async ({ location, units, days }: { location: LocationQuery; units?: "metric" | "imperial"; days?: number }) => {
    const data = await getForecast(location, units, days ?? 3);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { data },
    };
  }
);

server.registerTool(
  "get_weather_summary",
  {
    title: "AI Weather Summary",
    description: "Get an intelligent, human-friendly weather summary using ADK-TS agent analysis.",
    inputSchema: { location: LocationSchema, days: z.number().min(1).max(7).optional() },
    outputSchema: {}
  },
  async ({ location, days }: { location: LocationQuery; days?: number }) => {
    const summary = await getEnhancedWeatherSummary(location, days);
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { location, days, summary },
    };
  }
);

server.registerTool(
  "get_historical",
  {
    title: "Get Historical Weather",
    description: "Retrieve historical weather for a specific date (YYYY-MM-DD).",
    inputSchema: { location: LocationSchema, dateISO: z.string() },
    outputSchema: {}
  },
  async ({ location, dateISO }: { location: LocationQuery; dateISO: string }) => {
    const data = await getHistorical(location, dateISO);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { data },
    };
  }
);

server.registerTool(
  "weather_insights",
  {
    title: "AI Weather Insights",
    description: "Get intelligent weather analysis and recommendations for an activity using ADK-TS agent.",
    inputSchema: { activity: z.string(), location: LocationSchema },
    outputSchema: {}
  },
  async ({ activity, location }: { activity: string; location: LocationQuery }) => {
    const insights = await getWeatherInsights(activity, location);
    return {
      content: [{ type: "text", text: insights }],
      structuredContent: { activity, location, insights },
    };
  }
);

server.registerTool(
  "set_weather_alert",
  {
    title: "Set Weather Alert",
    description: "Create a weather alert (rain/temp/wind) with console or webhook notification.",
    inputSchema: {
      name: z.string().optional(),
      location: LocationSchema,
      condition: z.object({
        type: z.enum(["rain", "temp_above", "temp_below", "wind_above"]),
        threshold: z.number().optional(),
        daysAhead: z.number().optional(),
      }),
      channel: z.enum(["console", "webhook"]),
      webhookUrl: z.string().url().optional(),
      sensitivity: z.enum(["low", "medium", "high"]).optional(),
    },
    outputSchema: {}
  },
  async (input: any) => {
    const alert = registerAlert({
      name: input.name,
      location: input.location,
      condition: input.condition,
      channel: input.channel,
      webhookUrl: input.webhookUrl,
      sensitivity: input.sensitivity,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(alert, null, 2) }],
      structuredContent: { alert },
    };
  }
);

server.registerTool(
  "list_weather_alerts",
  {
    title: "List Weather Alerts",
    description: "List all registered weather alerts.",
    inputSchema: {},
    outputSchema: {}
  },
  async () => {
    const items = listAlerts();
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { items },
    };
  }
);

server.registerTool(
  "remove_weather_alert",
  {
    title: "Remove Weather Alert",
    description: "Remove a weather alert by ID.",
    inputSchema: { id: z.string() },
    outputSchema: {}
  },
  async ({ id }: { id: string }) => {
    const ok = removeAlert(id);
    return {
      content: [{ type: "text", text: JSON.stringify({ removed: ok, id }) }],
      structuredContent: { removed: ok, id },
    };
  }
);

server.registerTool(
  "provider_status",
  {
    title: "Provider Status",
    description: "Check which weather providers are enabled.",
    inputSchema: {},
    outputSchema: {}
  },
  async () => {
    const status = hasProviderKeys();
    return {
      content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      structuredContent: { status },
    };
  }
);

// Express + HTTP transport
const app = express();
app.use(express.json());
app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", (_req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

app.get("/test", (_req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

app.get("/api/current", async (req, res) => {
  try {
    const { city, country, lat, lon, units } = req.query as any;
    const location: LocationQuery = {
      city: city,
      country: country,
      lat: lat != null ? parseFloat(lat) : undefined,
      lon: lon != null ? parseFloat(lon) : undefined,
    };
    const data = await getCurrentWeather(location, units);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get("/api/forecast", async (req, res) => {
  try {
    const { city, country, lat, lon, units, days } = req.query as any;
    const location: LocationQuery = {
      city: city,
      country: country,
      lat: lat != null ? parseFloat(lat) : undefined,
      lon: lon != null ? parseFloat(lon) : undefined,
    };
    const data = await getForecast(location, units, days ? parseInt(days, 10) : 3);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(config.port, async () => {
  console.log(`WeatherWise MCP running on http://localhost:${config.port}/mcp`);
  
  // Initialize the ADK-TS weather agent
  await initializeWeatherAgent();
  
  startAlertScheduler();
});