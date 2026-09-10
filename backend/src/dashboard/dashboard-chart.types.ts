export enum DashboardChartRange {
  WEEK = 'week',
  MONTH = 'month',
  SIX_MONTHS = '6m',
  YEAR = 'year',
}

export enum DashboardChartMetric {
  REVENUE = 'revenue',
  APPOINTMENTS = 'appointments',
  TOP_SERVICES = 'top-services',
  FINANCE = 'finance',
}

export type DashboardChartGranularity = 'day' | 'month';

export type DashboardTrendPoint = {
  label: string;
  date: string;
  revenue?: number;
  appointments?: number;
  income?: number;
  expense?: number;
  paid?: number;
  due?: number;
};

export type DashboardChartSeriesResponse = {
  metric: DashboardChartMetric;
  range: DashboardChartRange;
  granularity: DashboardChartGranularity;
  timezone: string;
  points: DashboardTrendPoint[];
};

export type DashboardTopServiceItem = {
  name: string;
  count: number;
};

export type DashboardTopServicesResponse = {
  metric: DashboardChartMetric.TOP_SERVICES;
  range: DashboardChartRange;
  timezone: string;
  limit: number;
  items: DashboardTopServiceItem[];
};
