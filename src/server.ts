import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config, hasProviderKeys } from "./config";
import { getCurrentWeather, getForecast, getHistorical } from "./weather/aggregator";
import type { LocationQuery } from "./weather/types";
import { assessActivity } from "./insights/insights";
import { listAlerts, registerAlert, removeAlert, startAlertScheduler } from "./alerts/alertService";

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
      structuredContent: data,
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
      structuredContent: data,
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
      structuredContent: data,
    };
  }
);

server.registerTool(
  "weather_insights",
  {
    title: "Weather Insights",
    description: "Translate weather into practical recommendations for an activity.",
    inputSchema: { activity: z.string(), location: LocationSchema },
    outputSchema: {}
  },
  async ({ activity, location }: { activity: string; location: LocationQuery }) => {
    const current = await getCurrentWeather(location);
    const forecast = await getForecast(location);
    const insight = assessActivity(activity, current, forecast);
    return {
      content: [{ type: "text", text: JSON.stringify(insight, null, 2) }],
      structuredContent: insight,
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
      structuredContent: alert,
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
      structuredContent: items,
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
      structuredContent: status,
    };
  }
);

// Express + HTTP transport
const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.send(`<html><head><title>WeatherWise MCP</title></head><body>
  <h1>WeatherWise MCP</h1>
  <p>MCP endpoint: <code>/mcp</code>. Use MCP Inspector or a compatible client.</p>
  <p>Basic test UI at <a href="/test">/test</a>.</p>
  </body></html>`);
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

app.listen(config.port, () => {
  console.log(`WeatherWise MCP running on http://localhost:${config.port}/mcp`);
  startAlertScheduler();
});