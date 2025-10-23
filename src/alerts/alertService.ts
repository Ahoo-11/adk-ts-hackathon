import axios from "axios";
import { config } from "../config.js";
import type { LocationQuery } from "../weather/types.js";
import { getCurrentWeather, getForecast } from "../weather/aggregator.js";

export type AlertConditionType = "rain" | "temp_above" | "temp_below" | "wind_above";

export interface WeatherAlertCondition {
  type: AlertConditionType;
  threshold?: number; // used for temp_above/temp_below/wind_above
  daysAhead?: number; // used for forecast checks
}

export type AlertChannel = "console" | "webhook";

export interface WeatherAlert {
  id: string;
  name?: string;
  location: LocationQuery;
  condition: WeatherAlertCondition;
  channel: AlertChannel;
  webhookUrl?: string;
  sensitivity?: "low" | "medium" | "high"; // can tune thresholds internally
  createdAt: string;
  lastTriggeredAt?: string;
}

const alerts = new Map<string, WeatherAlert>();
let schedulerStarted = false;
let intervalHandle: NodeJS.Timeout | null = null;

function generateId() {
  return Math.random().toString(36).slice(2);
}

export function listAlerts() {
  return Array.from(alerts.values());
}

export function removeAlert(id: string) {
  return alerts.delete(id);
}

export function registerAlert(alert: Omit<WeatherAlert, "id" | "createdAt">): WeatherAlert {
  const id = generateId();
  const full: WeatherAlert = { ...alert, id, createdAt: new Date().toISOString() };
  alerts.set(id, full);
  return full;
}

async function notify(alert: WeatherAlert, message: string, payload?: any) {
  alert.lastTriggeredAt = new Date().toISOString();
  if (alert.channel === "console") {
    console.log(`[ALERT ${alert.id}] ${message}`, payload ?? "");
    return;
  }
  if (alert.channel === "webhook" && alert.webhookUrl) {
    try {
      await axios.post(alert.webhookUrl, { id: alert.id, message, alert, payload });
    } catch (e) {
      console.warn("Webhook notify failed:", (e as Error).message);
    }
  }
}

function adjustThreshold(base: number, sensitivity?: "low" | "medium" | "high") {
  if (!sensitivity || sensitivity === "medium") return base;
  if (sensitivity === "high") return base * 0.9; // more sensitive
  // low
  return base * 1.1; // less sensitive
}

async function evaluateAlert(alert: WeatherAlert) {
  const cond = alert.condition;
  // For rain condition, check forecast chance of rain next N days
  if (cond.type === "rain") {
    const days = cond.daysAhead ?? 1;
    const forecast = await getForecast(alert.location, undefined, days);
    const raining = forecast.days.some(d => (d.chanceOfRainPct ?? 0) >= adjustThreshold(50, alert.sensitivity));
    if (raining) await notify(alert, `Rain expected within ${days} day(s) at ${JSON.stringify(forecast.location)}`, forecast);
    return;
  }
  // For temperature & wind, check current
  const current = await getCurrentWeather(alert.location);
  if (cond.type === "temp_above" && cond.threshold != null) {
    const threshold = adjustThreshold(cond.threshold, alert.sensitivity);
    if (current.temperatureC >= threshold) await notify(alert, `Temperature above ${threshold}°C at ${current.location.name}`, current);
    return;
  }
  if (cond.type === "temp_below" && cond.threshold != null) {
    const threshold = adjustThreshold(cond.threshold, alert.sensitivity);
    if (current.temperatureC <= threshold) await notify(alert, `Temperature below ${threshold}°C at ${current.location.name}`, current);
    return;
  }
  if (cond.type === "wind_above" && cond.threshold != null) {
    const threshold = adjustThreshold(cond.threshold, alert.sensitivity);
    const wind = current.windKph ?? 0;
    if (wind >= threshold) await notify(alert, `Wind speed above ${threshold} kph at ${current.location.name}`, current);
    return;
  }
}

async function pollAlerts() {
  const items = listAlerts();
  for (const a of items) {
    try {
      await evaluateAlert(a);
    } catch (e) {
      console.warn("Alert evaluation failed:", a.id, (e as Error).message);
    }
  }
}

export function startAlertScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  intervalHandle = setInterval(pollAlerts, config.alertPollIntervalSeconds * 1000);
  console.log(`Alert scheduler started (every ${config.alertPollIntervalSeconds}s)`);
}

export function stopAlertScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  schedulerStarted = false;
}