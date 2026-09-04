/** The same predicates drive global card counts and cursor-filtered rows. */
export function platformMetricRows(section: string, rows: any[], now = Date.now()) {
  return rows.map(row => {
    const business = row.record_type !== 'invitation';
    let metrics: Record<string, boolean> = { all: true };
    switch (section) {
      case 'tenants': metrics = { businesses: business, active: business && row.active === true,
        trial: business && row.status === 'trial', attention: business && (row.active === false || ['past_due','expired'].includes(row.status)),
        invited: !business, expiring_trials: business && row.status === 'trial' && !!row.ends_at && new Date(row.ends_at).getTime() < now + 7*86400000,
        overdue: business && row.status === 'past_due' }; break;
      case 'subscriptions': metrics = { ...metrics, active: row.status === 'active', trial: row.status === 'trial', overdue: ['past_due','expired'].includes(row.status) }; break;
      case 'payments': metrics = { ...metrics, verified: row.status === 'success', pending: row.status === 'pending', failed: ['failed','cancelled'].includes(row.status) }; break;
      case 'packages': metrics = { ...metrics, published: row.published === true, drafts: !row.published, currencies: !!row.currency }; break;
      case 'users': metrics = { ...metrics, active: row.active === true, inactive: !row.active, roles: !!row.role }; break;
      case 'roles': metrics = { ...metrics, protected: row.protected === true, custom: !row.protected, permissions: (row.permissions?.length ?? 0) > 0 }; break;
      case 'domains': metrics = { ...metrics, verified: ['verified','active'].includes(row.status), pending: !['verified','active','failed'].includes(row.status), failed: row.status === 'failed' }; break;
      case 'audit': metrics = { ...metrics, actions: !!row.action, businesses: !!row.tenant_id, actors: !!row.actor_id }; break;
    }
    return { ...row, metrics };
  });
}
