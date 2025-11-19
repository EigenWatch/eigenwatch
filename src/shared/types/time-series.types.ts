export interface TimeSeriesPoint {
  date: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface TimeSeriesData {
  series: TimeSeriesPoint[];
  summary: TimeSeriesSummary;
}

export interface TimeSeriesSummary {
  min: number;
  max: number;
  mean: number;
  median: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}
