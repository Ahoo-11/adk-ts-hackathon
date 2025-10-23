import axios from "axios";
import { config } from "../../config.js";
import { CurrentWeather, Forecast, ForecastDay, LocationQuery } from "../types.js";

function unitsParam(units: "metric" | "imperial") {
  return units === "imperial" ? "imperial" : "metric";
}

function resolveQueryParams(q: LocationQuery) {
  if (q.lat != null && q.lon != null) {
    return `lat=${q.lat}&lon=${q.lon}`;
  }
  if (q.city) {
    const country = q.country ? "," + encodeURIComponent(q.country) : "";
    return `q=${encodeURIComponent(q.city + country)}`;
  }
  throw new Error("OpenWeather: provide city or lat/lon");
}

export async function getCurrent(q: LocationQuery, units: "metric" | "imperial" = config.defaultUnits): Promise<CurrentWeather> {
  const params = resolveQueryParams(q);
  const url = `https://api.openweathermap.org/data/2.5/weather?${params}&appid=${config.openWeatherApiKey}&units=${unitsParam(units)}`;
  const res = await axios.get(url);
  const d = res.data;
  const name = d.name || `${d.coord?.lat},${d.coord?.lon}`;
  const tempC = units === "metric" ? d.main.temp : (d.main.temp - 32) * (5 / 9);
  const tempF = units === "imperial" ? d.main.temp : d.main.temp * (9 / 5) + 32;
  const feelsC = units === "metric" ? d.main.feels_like : (d.main.feels_like - 32) * (5 / 9);
  const feelsF = units === "imperial" ? d.main.feels_like : d.main.feels_like * (9 / 5) + 32;
  return {
    provider: "openweather",
    location: { name, lat: d.coord.lat, lon: d.coord.lon, country: d.sys?.country },
    observedAt: new Date(d.dt * 1000).toISOString(),
    temperatureC: tempC,
    temperatureF: tempF,
    feelsLikeC: feelsC,
    feelsLikeF: feelsF,
    humidity: d.main.humidity,
    windKph: units === "metric" ? d.wind.speed * 3.6 : d.wind.speed * 1.60934, // m/s or mph
    windMph: units === "imperial" ? d.wind.speed : (d.wind.speed * 3.6) / 1.60934,
    windDir: typeof d.wind.deg === "number" ? `${d.wind.deg}°` : undefined,
    pressureMb: d.main.pressure,
    condition: { text: d.weather?.[0]?.description || "Unknown", iconUrl: d.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png` : undefined, code: d.weather?.[0]?.id },
  };
}

export async function getForecast(q: LocationQuery, units: "metric" | "imperial" = config.defaultUnits, days: number = 3): Promise<Forecast> {
  const params = resolveQueryParams(q);
  const url = `https://api.openweathermap.org/data/2.5/forecast?${params}&appid=${config.openWeatherApiKey}&units=${unitsParam(units)}`;
  const res = await axios.get(url);
  const d = res.data;
  const name = d.city?.name || `${d.city?.coord?.lat},${d.city?.coord?.lon}`;
  // Aggregate 3-hour slots into days
  const byDate: Record<string, { tempsC: number[]; tempsF: number[]; rainSlots: number; snowSlots: number; totalSlots: number; condText?: string; icon?: string; code?: number }>
    = {};
  for (const item of d.list as any[]) {
    const date = new Date(item.dt * 1000);
    const isoDate = date.toISOString().slice(0, 10);
    const tempC = units === "metric" ? item.main.temp : (item.main.temp - 32) * (5 / 9);
    const tempF = units === "imperial" ? item.main.temp : item.main.temp * (9 / 5) + 32;
    const cond = item.weather?.[0];
    if (!byDate[isoDate]) {
      byDate[isoDate] = { tempsC: [], tempsF: [], rainSlots: 0, snowSlots: 0, totalSlots: 0 };
    }
    byDate[isoDate].tempsC.push(tempC);
    byDate[isoDate].tempsF.push(tempF);
    byDate[isoDate].totalSlots += 1;
    if (item.rain?.["3h"]) byDate[isoDate].rainSlots += 1;
    if (item.snow?.["3h"]) byDate[isoDate].snowSlots += 1;
    byDate[isoDate].condText = cond?.description || byDate[isoDate].condText;
    byDate[isoDate].icon = cond?.icon || byDate[isoDate].icon;
    byDate[isoDate].code = cond?.id || byDate[isoDate].code;
  }
  const sortedDates = Object.keys(byDate).sort().slice(0, days);
  const daysOut: ForecastDay[] = sortedDates.map(date => {
    const rec = byDate[date];
    const avgC = rec.tempsC.reduce((a, b) => a + b, 0) / rec.tempsC.length;
    const avgF = rec.tempsF.reduce((a, b) => a + b, 0) / rec.tempsF.length;
    const maxC = Math.max(...rec.tempsC);
    const minC = Math.min(...rec.tempsC);
    const maxF = Math.max(...rec.tempsF);
    const minF = Math.min(...rec.tempsF);
    const rainChance = rec.totalSlots ? Math.round((rec.rainSlots / rec.totalSlots) * 100) : undefined;
    const snowChance = rec.totalSlots ? Math.round((rec.snowSlots / rec.totalSlots) * 100) : undefined;
    return {
      date,
      avgTempC: avgC,
      avgTempF: avgF,
      maxTempC: maxC,
      maxTempF: maxF,
      minTempC: minC,
      minTempF: minF,
      chanceOfRainPct: rainChance,
      chanceOfSnowPct: snowChance,
      condition: { text: rec.condText, iconUrl: rec.icon ? `https://openweathermap.org/img/wn/${rec.icon}@2x.png` : undefined, code: rec.code },
    };
  });
  return {
    provider: "openweather",
    location: { name, lat: d.city.coord.lat, lon: d.city.coord.lon, country: d.city.country },
    days: daysOut,
  };
}

export async function getHistorical(/* not supported on free OpenWeather */): Promise<null> {
  return null;
}