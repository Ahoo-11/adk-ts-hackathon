import { LRUCache } from "lru-cache";
import { config, Units } from "../config";
import type { CurrentWeather, Forecast, HistoricalWeather, LocationQuery } from "./types";
import * as ow from "./providers/openWeather";
import * as wa from "./providers/weatherApi";

const currentCache = new LRUCache<string, CurrentWeather>({
  max: 500,
  ttl: config.cacheTtlSeconds * 1000,
});

const forecastCache = new LRUCache<string, Forecast>({
  max: 500,
  ttl: config.forecastCacheTtlSeconds * 1000,
});

const historicalCache = new LRUCache<string, HistoricalWeather>({
  max: 500,
  ttl: config.cacheTtlSeconds * 1000,
});

function keyOf(prefix: string, q: LocationQuery, extra?: any) {
  return `${prefix}:${JSON.stringify(q)}:${JSON.stringify(extra ?? {})}`;
}

export async function getCurrentWeather(q: LocationQuery, units: Units = config.defaultUnits): Promise<CurrentWeather> {
  const key = keyOf("current", q, { units });
  const cached = currentCache.get(key);
  if (cached) return cached;

  let data: CurrentWeather | null = null;
  // Prefer WeatherAPI if key present
  if (config.weatherApiKey) {
    try {
      data = await wa.getCurrent(q);
    } catch (e) {
      console.warn("WeatherAPI current failed, falling back to OpenWeather:", (e as Error).message);
    }
  }
  if (!data && config.openWeatherApiKey) {
    data = await ow.getCurrent(q, units);
  }
  if (!data) throw new Error("No weather provider available. Please set API keys in .env");
  currentCache.set(key, data);
  return data;
}

export async function getForecast(q: LocationQuery, units: Units = config.defaultUnits, days: number = 3): Promise<Forecast> {
  const key = keyOf("forecast", q, { units, days });
  const cached = forecastCache.get(key);
  if (cached) return cached;

  let data: Forecast | null = null;
  if (config.weatherApiKey) {
    try {
      data = await wa.getForecast(q, days);
    } catch (e) {
      console.warn("WeatherAPI forecast failed, falling back to OpenWeather:", (e as Error).message);
    }
  }
  if (!data && config.openWeatherApiKey) {
    data = await ow.getForecast(q, units, days);
  }
  if (!data) throw new Error("No weather provider available. Please set API keys in .env");
  forecastCache.set(key, data);
  return data;
}

export async function getHistorical(q: LocationQuery, dateISO: string): Promise<HistoricalWeather> {
  const key = keyOf("historical", q, { dateISO });
  const cached = historicalCache.get(key);
  if (cached) return cached;

  let data: HistoricalWeather | null = null;
  if (config.weatherApiKey) {
    try {
      data = await wa.getHistorical(q, dateISO);
    } catch (e) {
      console.warn("WeatherAPI historical failed:", (e as Error).message);
    }
  }
  if (!data) throw new Error("Historical data not available with current configuration.");
  historicalCache.set(key, data);
  return data;
}