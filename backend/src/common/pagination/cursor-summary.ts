/** Collection-wide indicators travel alongside the ten visible rows. */
export function cursorSummary(rows: any[]) {
  const count = (test: (row: any) => boolean) => rows.filter(test).length;
  const distinct = (field: string) => new Set(rows.map(row => row[field]).filter(value => value != null && value !== '')).size;
  const statuses = [...new Set<string>(rows.map(row => row.status).filter(Boolean))].sort();
  return {
    total: rows.length,
    metricCounts: Object.fromEntries([...new Set(rows.flatMap(row => Object.keys(row.metrics ?? {})))].map(key => [key,count(row => row.metrics?.[key] === true)])),
    active: count(row => row.active === true),
    attention: count(row => row.active === false || ['past_due','expired'].includes(row.status)),
    published: count(row => row.published === true),
    protected: count(row => row.protected === true),
    permissionRules: rows.reduce((sum,row) => sum + (Array.isArray(row.permissions) ? row.permissions.length : 0),0),
    distinctCurrencies: distinct('currency'), distinctRoles: distinct('role'),
    distinctActions: distinct('action'), distinctActors: distinct('actor_id'), distinctTenants: distinct('tenant_id'),
    statuses, statusCounts: Object.fromEntries(statuses.map(status => [status,count(row => row.status === status)])),
  };
}
