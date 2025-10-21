# WeatherWise MCP: Smart Weather Data Integration

WeatherWise is an MCP (Model Context Protocol) server that gives AI agents access to comprehensive weather data and forecasting capabilities. It integrates multiple free weather APIs into a single, intelligent interface so agents can make smarter decisions based on weather conditions.

Highlights
- Multi-source weather data: OpenWeatherMap + WeatherAPI with fallback
- Current, forecast, and historical data
- Smart insights and activity risk assessments
- Customizable alerts via console or webhook
- Streamable HTTP MCP endpoint plus a simple web UI for testing
- Built with TypeScript (and demonstrates ADK-TS agent integration)

Important: ADK-TS Requirement
This project demonstrates ADK-TS by providing an agent example that queries WeatherWise. The MCP server is compatible with MCP clients (MCP Inspector, IDEs) and can be used directly. ADK-TS supports MCP and custom tools; see the examples/adk-agent.ts.

Quick Start
1) Prerequisites
- Node.js >= 20.11
- API keys for at least one provider:
  - OpenWeatherMap (https://openweathermap.org/) -> OPENWEATHER_API_KEY
  - WeatherAPI (https://www.weatherapi.com/) -> WEATHERAPI_API_KEY
- Optional LLM provider key for the ADK-TS agent example:
  - GOOGLE_API_KEY (Gemini) or OPENAI_API_KEY

2) Install
```
npm install
```

3) Configure
Create a .env file from the template:
```
cp .env.example .env
```
Edit .env and set your keys:
```
OPENWEATHER_API_KEY=your_openweather_key
WEATHERAPI_API_KEY=your_weatherapi_key
PORT=3000
DEFAULT_UNITS=metric
CACHE_TTL_SECONDS=600
FORECAST_CACHE_TTL_SECONDS=10800
ALERT_POLL_INTERVAL_SECONDS=600
# Optional for ADK-TS agent example
GOOGLE_API_KEY=your_gemini_key
```

4) Run Dev Server
```
npm run dev:http
```
- MCP endpoint: http://localhost:3000/mcp
- Web UI: http://localhost:3000/test

Tip: Use MCP Inspector to connect to the MCP endpoint.
- npx @modelcontextprotocol/inspector
- Connect URL: http://localhost:3000/mcp

REST Test Endpoints
- GET /api/current?city=London&country=UK&units=metric
- GET /api/forecast?city=London&country=UK&days=3&units=metric

MCP Tools Exposed
- get_current_weather
- get_forecast
- get_historical
- weather_insights
- set_weather_alert
- list_weather_alerts
- remove_weather_alert
- provider_status

Architecture Overview
- src/config.ts: Loads environment variables and app config
- src/weather/types.ts: Normalized types
- src/weather/providers/openWeather.ts: OpenWeatherMap provider (current + forecast)
- src/weather/providers/weatherApi.ts: WeatherAPI provider (current + forecast + historical)
- src/weather/aggregator.ts: Caching + provider fallback
- src/alerts/alertService.ts: In-memory alert registration and scheduler
- src/insights/insights.ts: Practical activity risk assessments
- src/server.ts: Express app + MCP server (Streamable HTTP)
- public/index.html: Basic UI for manual testing

Caching
- LRU caches for current, forecast, historical queries
- TTL configured via .env: CACHE_TTL_SECONDS, FORECAST_CACHE_TTL_SECONDS

ADK-TS Agent Example
You can run an example agent that uses ADK-TS (Agent Development Kit for TypeScript) to query the WeatherWise REST endpoints:
```
# Make sure WeatherWise dev server is running on localhost:3000
npm run dev:http

# Ensure you have a model provider key (e.g., GOOGLE_API_KEY) in .env
npx tsx examples/adk-agent.ts
```
This shows how ADK-TS can be used to build agents that call WeatherWise. ADK-TS also supports MCP; you can attach MCP servers to ADK agents in your application (see ADK docs: https://adk.iqai.com/).

Notes
- Historical data currently uses WeatherAPI only (requires premium or specific free-tier capabilities)
- Provider selection prioritizes WeatherAPI then falls back to OpenWeatherMap
- If neither provider key is set, server responses will include an error
- Alerts are evaluated periodically based on forecast and current data, delivering to console or webhook

Deployment
- Build: `npm run build`
- Start: `npm run start:http`
- Ensure environment variables are set in production

License
MIT