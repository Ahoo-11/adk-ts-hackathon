/**
 * WeatherWise MCP + ADK-TS Integration Example
 *
 * This example demonstrates how ADK-TS is integrated WITHIN the WeatherWise MCP server.
 * The MCP tools themselves use ADK-TS agents internally to provide intelligent responses.
 *
 * To test the integration:
 * 1. Start WeatherWise MCP server: npm run dev:http
 * 2. Use MCP Inspector: npx @modelcontextprotocol/inspector
 * 3. Connect to: http://localhost:3000/mcp
 * 4. Try the AI-powered tools: weather_insights, get_weather_summary
 *
 * Requirements:
 * - Set LLM provider key (GOOGLE_API_KEY or OPENAI_API_KEY) in .env
 * - The ADK-TS agent runs inside the MCP server, not as a separate client
 */

import { AgentBuilder } from "@iqai/adk";
import { McpClientTool } from "@iqai/adk/tools/mcp";

async function main() {
  console.log("=== WeatherWise MCP + ADK-TS Integration Demo ===\n");
  
  console.log("This example shows ADK-TS integrated WITHIN the MCP server.");
  console.log("The MCP tools use ADK-TS agents internally for intelligent responses.\n");
  
  console.log("To test the integration:");
  console.log("1. Start WeatherWise MCP server: npm run dev:http");
  console.log("2. Use MCP Inspector: npx @modelcontextprotocol/inspector");
  console.log("3. Connect to: http://localhost:3000/mcp");
  console.log("4. Try AI-powered tools:");
  console.log("   - weather_insights: Get intelligent activity recommendations");
  console.log("   - get_weather_summary: Get conversational weather summaries");
  console.log("   - Standard tools: get_current_weather, get_forecast, etc.\n");
  
  // Example of how you could use MCP client to connect to the server
  // (This requires the MCP server to be running)
  try {
    const { agent, runner } = await AgentBuilder
      .create("mcp_client_demo")
      .withDescription("Demo agent that connects to WeatherWise MCP server")
      .withInstruction("Use the WeatherWise MCP tools to get weather information and insights.")
      .withModel("gemini-2.5-flash")
      .withTools(new McpClientTool("http://localhost:3000/mcp"))
      .build();

    const question = "What are the weather insights for running in London, UK today?";
    console.log(`Question: ${question}`);
    
    const response = await runner.ask(question);
    console.log("MCP Response:\n", response.text ?? response);
  } catch (error) {
    console.log("MCP client demo failed (server may not be running):", error.message);
    console.log("\nThe main integration is inside the MCP server itself.");
    console.log("Use MCP Inspector to test the AI-powered tools directly.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});