/**
 * WeatherWise MCP + ADK-TS Agent Example
 *
 * This example shows how to build an ADK-TS agent and let it call WeatherWise via HTTP endpoints.
 * If you prefer MCP-native integration, you can use MCP Inspector or your IDE to connect directly to /mcp.
 *
 * Requirements:
 * - npm i @iqai/adk
 * - Set one LLM provider key (e.g., GOOGLE_API_KEY for Gemini or OPENAI_API_KEY for OpenAI)
 * - Start WeatherWise server on http://localhost:3000
 */

import { AgentBuilder } from "@iqai/adk";
// HttpRequestTool is a generic web request tool in ADK that allows the agent to call REST APIs.
import { HttpRequestTool } from "@iqai/adk/tools/http";

async function main() {
  const { agent, runner } = await AgentBuilder
    .create("weatherwise_demo")
    .withDescription("Agent that queries WeatherWise REST endpoints to get weather and forecast.")
    .withInstruction("When asked for weather, call the local WeatherWise REST endpoints (http://localhost:3000/api/current and /api/forecast).")
    // Pick a model provider you have keys for. Example uses Gemini; you can change to OpenAI etc.
    .withModel("gemini-2.5-flash")
    .withTools(new HttpRequestTool())
    .build();

  // Prompt guiding the agent to use the REST tools
  const question = `What's the 3-day forecast for London, UK? Use http://localhost:3000/api/forecast?city=London&country=UK&days=3`;
  const response = await runner.ask(question);
  console.log("Agent response:\n", response.text ?? response);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});