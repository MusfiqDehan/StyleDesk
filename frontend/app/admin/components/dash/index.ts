/** User shell, card, and shared style tokens */
export { DashPage, DashSpinner } from "./page-shell"
export { DashCard, DashPanelHeader, DashQuickLink } from "./card"
export {
  DASH_PAGE,
  DASH_CARD,
  DASH_CARD_PADDED,
  DASH_PANEL_TITLE,
  DASH_PANEL_ICON,
  DASH_LINK,
  DASH_NAV_BASE,
  DASH_NAV_ACTIVE,
  DASH_NAV_IDLE,
  DASH_NAV_RAIL,
  DASH_NAV_ICON,
  DASH_NAV_ICON_ACTIVE,
  DASH_NAV_ICON_IDLE,
  DASH_INPUT_FOCUS,
  DASH_PRIMARY_BTN,
  DASH_SPIN,
} from "./styles"

/** Redesign dashboard primitives (charts, headers, widgets) */
export * from "./tokens"
export * from "./dashboard-shell"
export * from "./page-header"
export * from "./page-header-actions"
export * from "./dashboard-header"
export * from "./chart-card"
export * from "./widget-card"
export * from "./range-toggle"
export * from "./states"
export * from "./quick-links"
export * from "./employee-on-duty"
export * from "./report-charts"
export * from "./use-dashboard-chart"
export * from "./overview-layout"

/** KPI tiles — redesign (trends/featured) + user DashKpiCard API */
export {
  DashKpiCard,
  DashKpiGrid,
  type DashKpiTone,
  KpiCard,
  KpiGrid,
  type KpiAccent,
  type KpiCardProps,
} from "./kpi-card"
