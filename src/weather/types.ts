export type Units = "metric" | "imperial";

export interface LocationQuery {
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
}

export interface CurrentWeather {
  provider: string;
  location: {
    name: string;
    lat: number;
    lon: number;
    country?: string;
  };
  observedAt: string; // ISO
  temperatureC: number;
  temperatureF: number;
  feelsLikeC?: number;
  feelsLikeF?: number;
  humidity?: number;
  windKph?: number;
  windMph?: number;
  windDir?: string;
  pressureMb?: number;
  uv?: number;
  condition: {
    text: string;
    iconUrl?: string;
    code?: number;
  };
}

export interface ForecastDay {
  date: string; // ISO date
  avgTempC?: number;
  avgTempF?: number;
  maxTempC?: number;
  maxTempF?: number;
  minTempC?: number;
  minTempF?: number;
  chanceOfRainPct?: number;
  chanceOfSnowPct?: number;
  condition?: {
    text?: string;
    iconUrl?: string;
    code?: number;
  };
}

export interface Forecast {
  provider: string;
  location: {
    name: string;
    lat: number;
    lon: number;
    country?: string;
  };
  days: ForecastDay[];
}

export interface HistoricalWeather extends CurrentWeather {
  date: string; // ISO date
}