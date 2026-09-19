module.exports = async function seedScope(client) {
  const args = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag)+1];
  const tenantId = args.includes('--tenant') ? value('--tenant') : '';
  const branchId = args.includes('--branch') ? value('--branch') : '';
  if (![tenantId,branchId].every(id => /^[0-9a-f-]{36}$/i.test(id))) throw new Error('--tenant <uuid> and --branch <uuid> are required');
  const { rows:[role] } = await client.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  if (role.rolsuper || role.rolbypassrls) throw new Error('Seeds require the restricted runtime DATABASE_URL');
  await client.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.branch_id',$2,true)",[tenantId,branchId]);
  const { rows } = await client.query('SELECT id FROM branch WHERE tenant_id=$1 AND id=$2 AND active',[tenantId,branchId]);
  if (!rows[0]) throw new Error('Unknown tenant/branch');
  return {tenantId,branchId};
};
