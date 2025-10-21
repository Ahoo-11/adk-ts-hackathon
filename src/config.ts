import dotenv from "dotenv";

dotenv.config();

export type Units = "metric" | "imperial";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || "",
  weatherApiKey: process.env.WEATHERAPI_API_KEY || "",
  defaultUnits: (process.env.DEFAULT_UNITS || "metric") as Units,
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || "600", 10),
  forecastCacheTtlSeconds: parseInt(process.env.FORECAST_CACHE_TTL_SECONDS || "10800", 10),
  alertPollIntervalSeconds: parseInt(process.env.ALERT_POLL_INTERVAL_SECONDS || "600", 10),
  googleApiKey: process.env.GOOGLE_API_KEY || "",
};

export function hasProviderKeys() {
  return {
    openWeather: !!config.openWeatherApiKey,
    weatherApi: !!config.weatherApiKey,
  };
}