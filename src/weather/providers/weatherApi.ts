import axios from "axios";
import { config } from "../../config.js";
import { CurrentWeather, Forecast, ForecastDay, HistoricalWeather, LocationQuery } from "../types.js";

function resolveQuery(q: LocationQuery) {
  if (q.lat != null && q.lon != null) return `${q.lat},${q.lon}`;
  if (q.city) return q.country ? `${q.city},${q.country}` : q.city;
  throw new Error("WeatherAPI: provide city or lat/lon");
}

export async function getCurrent(q: LocationQuery): Promise<CurrentWeather> {
  const qStr = resolveQuery(q);
  const url = `https://api.weatherapi.com/v1/current.json?key=${config.weatherApiKey}&q=${encodeURIComponent(qStr)}&aqi=no`;
  const res = await axios.get(url);
  const d = res.data;
  return {
    provider: "weatherapi",
    location: { name: d.location.name, lat: d.location.lat, lon: d.location.lon, country: d.location.country },
    observedAt: d.current.last_updated ? new Date(d.current.last_updated).toISOString() : new Date().toISOString(),
    temperatureC: d.current.temp_c,
    temperatureF: d.current.temp_f,
    feelsLikeC: d.current.feelslike_c,
    feelsLikeF: d.current.feelslike_f,
    humidity: d.current.humidity,
    windKph: d.current.wind_kph,
    windMph: d.current.wind_mph,
    windDir: d.current.wind_dir,
    pressureMb: d.current.pressure_mb,
    uv: d.current.uv,
    condition: { text: d.current.condition?.text, iconUrl: d.current.condition?.icon, code: d.current.condition?.code },
  };
}

export async function getForecast(q: LocationQuery, days: number = 3): Promise<Forecast> {
  const qStr = resolveQuery(q);
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${config.weatherApiKey}&q=${encodeURIComponent(qStr)}&days=${days}&aqi=no&alerts=no`;
  const res = await axios.get(url);
  const d = res.data;
  const daysOut: ForecastDay[] = (d.forecast?.forecastday || []).map((fd: any) => ({
    date: fd.date,
    avgTempC: fd.day?.avgtemp_c,
    avgTempF: fd.day?.avgtemp_f,
    maxTempC: fd.day?.maxtemp_c,
    maxTempF: fd.day?.maxtemp_f,
    minTempC: fd.day?.mintemp_c,
    minTempF: fd.day?.mintemp_f,
    chanceOfRainPct: fd.day?.daily_chance_of_rain,
    chanceOfSnowPct: fd.day?.daily_chance_of_snow,
    condition: { text: fd.day?.condition?.text, iconUrl: fd.day?.condition?.icon, code: fd.day?.condition?.code },
  }));
  return {
    provider: "weatherapi",
    location: { name: d.location.name, lat: d.location.lat, lon: d.location.lon, country: d.location.country },
    days: daysOut,
  };
}

export async function getHistorical(q: LocationQuery, dateISO: string): Promise<HistoricalWeather> {
  const qStr = resolveQuery(q);
  const url = `https://api.weatherapi.com/v1/history.json?key=${config.weatherApiKey}&q=${encodeURIComponent(qStr)}&dt=${encodeURIComponent(dateISO.slice(0, 10))}`;
  const res = await axios.get(url);
  const d = res.data;
  const day = d.forecast?.forecastday?.[0];
  return {
    provider: "weatherapi",
    date: day?.date || dateISO.slice(0, 10),
    location: { name: d.location.name, lat: d.location.lat, lon: d.location.lon, country: d.location.country },
    observedAt: day?.date ? new Date(day.date).toISOString() : new Date().toISOString(),
    temperatureC: day?.day?.avgtemp_c ?? d.current?.temp_c ?? 0,
    temperatureF: day?.day?.avgtemp_f ?? d.current?.temp_f ?? 0,
    feelsLikeC: d.current?.feelslike_c,
    feelsLikeF: d.current?.feelslike_f,
    humidity: day?.day?.avghumidity ?? d.current?.humidity,
    windKph: day?.day?.maxwind_kph ?? d.current?.wind_kph,
    windMph: day?.day?.maxwind_mph ?? d.current?.wind_mph,
    windDir: d.current?.wind_dir,
    pressureMb: d.current?.pressure_mb,
    uv: d.current?.uv,
    condition: { text: day?.day?.condition?.text, iconUrl: day?.day?.condition?.icon, code: day?.day?.condition?.code },
  };
}