/**
 * ADK-TS Weather Agent
 * 
 * This agent is used internally by MCP tools to provide intelligent weather analysis,
 * insights, and recommendations. Instead of just returning raw data, MCP tools
 * leverage this agent to provide AI-powered responses.
 */

import { AgentBuilder } from "@iqai/adk";
import { getCurrentWeather, getForecast } from "../weather/aggregator.js";
import type { LocationQuery } from "../weather/types.js";
import { config } from "../config.js";

let weatherAgent: any = null;
let agentRunner: any = null;

/**
 * Initialize the weather agent (called once on server startup)
 */
export async function initializeWeatherAgent() {
  if (weatherAgent) return { agent: weatherAgent, runner: agentRunner };

  // Check if we have an LLM provider key
  const hasGoogleKey = !!config.googleApiKey;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  
  if (!hasGoogleKey && !hasOpenAIKey) {
    console.warn("No LLM provider key found. ADK-TS agent will be disabled.");
    return null;
  }

  const model = hasGoogleKey ? "gemini-2.5-flash" : "gpt-4o-mini";

  const { agent, runner } = await AgentBuilder
    .create("weatherwise_mcp_agent")
    .withDescription("Intelligent weather analysis agent that provides insights, recommendations, and contextual weather information.")
    .withInstruction(`
You are a weather analysis expert integrated into a WeatherWise MCP server. Your role is to:

1. Analyze weather data and provide intelligent insights
2. Give practical recommendations based on weather conditions
3. Assess activity suitability and risk levels
4. Provide context-aware weather summaries
5. Help users understand weather implications for their activities

When responding:
- Be concise but informative
- Focus on practical implications
- Consider safety and comfort factors
- Provide actionable recommendations
- Use clear, non-technical language when possible

You have access to current weather and forecast data through function calls.
    `)
    .withModel(model)
    .build();

  weatherAgent = agent;
  agentRunner = runner;

  console.log(`Weather agent initialized with model: ${model}`);
  return { agent, runner };
}

/**
 * Get intelligent weather insights using the ADK-TS agent
 */
export async function getWeatherInsights(activity: string, location: LocationQuery): Promise<string> {
  const agentData = await initializeWeatherAgent();
  if (!agentData) {
    // Fallback to basic insights if no agent available
    return getBasicInsights(activity, location);
  }

  const { runner } = agentData;

  // Get weather data for the agent to analyze
  const current = await getCurrentWeather(location);
  const forecast = await getForecast(location, undefined, 3);

  const prompt = `
Analyze the weather conditions for "${activity}" at ${location.city}, ${location.country}.

Current Weather:
${JSON.stringify(current, null, 2)}

3-Day Forecast:
${JSON.stringify(forecast, null, 2)}

Provide intelligent insights about:
1. Current suitability for the activity (scale 1-10)
2. Key weather factors to consider
3. Specific recommendations or precautions
4. Best timing within the forecast period
5. What to prepare or bring

Be practical and actionable in your response.
  `;

  try {
    const response = await runner.ask(prompt);
    return response.text || response.toString();
  } catch (error) {
    console.error("Agent analysis failed:", error);
    return getBasicInsights(activity, location);
  }
}

/**
 * Get enhanced weather summary using the ADK-TS agent
 */
export async function getEnhancedWeatherSummary(location: LocationQuery, days?: number): Promise<string> {
  const agentData = await initializeWeatherAgent();
  if (!agentData) {
    return "Weather data available via basic tools. Enable LLM provider for enhanced summaries.";
  }

  const { runner } = agentData;

  const current = await getCurrentWeather(location);
  const forecast = await getForecast(location, undefined, days || 3);

  const prompt = `
Provide an intelligent weather summary for ${location.city}, ${location.country}.

Current Weather:
${JSON.stringify(current, null, 2)}

Forecast:
${JSON.stringify(forecast, null, 2)}

Create a concise, human-friendly summary that includes:
1. Current conditions overview
2. Key changes expected in the forecast
3. Notable weather patterns or trends
4. General recommendations for the period
5. Any weather alerts or concerns

Make it conversational and practical for everyday planning.
  `;

  try {
    const response = await runner.ask(prompt);
    return response.text || response.toString();
  } catch (error) {
    console.error("Agent summary failed:", error);
    return "Enhanced summary unavailable. Raw weather data accessible via other tools.";
  }
}

/**
 * Fallback basic insights when agent is not available
 */
function getBasicInsights(activity: string, location: LocationQuery): string {
  return `Basic weather insights for "${activity}" at ${location.city}, ${location.country}. Enable LLM provider (GOOGLE_API_KEY or OPENAI_API_KEY) for AI-powered analysis and recommendations.`;
}