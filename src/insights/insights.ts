import type { CurrentWeather, Forecast } from "../weather/types.js";

export interface InsightResult {
  activity: string;
  riskLevel: "low" | "moderate" | "high";
  summary: string;
  tips: string[];
}

function rainRiskPct(forecast?: Forecast) {
  if (!forecast) return 0;
  const days = forecast.days.slice(0, 1);
  const max = Math.max(...days.map(d => d.chanceOfRainPct ?? 0), 0);
  return max;
}

export function assessActivity(activity: string, current: CurrentWeather, forecast?: Forecast): InsightResult {
  const rainChance = rainRiskPct(forecast);
  const wind = current.windKph ?? 0;
  const tempC = current.temperatureC;
  const cond = (current.condition?.text || "").toLowerCase();
  let risk: "low" | "moderate" | "high" = "low";
  const tips: string[] = [];

  // rain
  if (rainChance >= 70 || cond.includes("rain") || cond.includes("storm")) {
    risk = "high";
    tips.push("Carry waterproof gear or reschedule if possible.");
  } else if (rainChance >= 40) {
    risk = "moderate";
    tips.push("Light rain possible. Check radar before heading out.");
  }

  // wind
  if (wind >= 40) {
    risk = "high";
    tips.push("Strong winds expected. Avoid exposed areas.");
  } else if (wind >= 25 && risk !== "high") {
    risk = "moderate";
    tips.push("Gusty conditions. Secure loose items and be cautious.");
  }

  // heat/cold
  if (tempC >= 32) {
    risk = "high";
    tips.push("High heat risk. Hydrate, use sunscreen, and limit exposure.");
  } else if (tempC >= 26 && risk !== "high") {
    risk = "moderate";
    tips.push("Warm conditions. Hydrate well and pace yourself.");
  } else if (tempC <= -5) {
    risk = "high";
    tips.push("Extreme cold. Layer up and limit time outside.");
  } else if (tempC <= 5 && risk !== "high") {
    risk = "moderate";
    tips.push("Cold conditions. Wear warm layers and protect extremities.");
  }

  // activity-specific tips
  const a = activity.toLowerCase();
  if (a.includes("running") || a.includes("cycling")) {
    if (wind >= 30) tips.push("Plan route to avoid headwinds.");
    tips.push("Warm up properly and monitor hydration.");
  } else if (a.includes("hiking")) {
    tips.push("Check trail conditions and bring appropriate footwear.");
  } else if (a.includes("picnic") || a.includes("outdoor")) {
    if (rainChance >= 40) tips.push("Have a backup indoor location.");
    tips.push("Pack shade and water; check UV index.");
  }

  const summary = `Risk for ${activity}: ${risk}. Temp ${Math.round(tempC)}°C, wind ${Math.round(wind)} kph, rain chance ${rainChance}%`;
  return { activity, riskLevel: risk, summary, tips };
}