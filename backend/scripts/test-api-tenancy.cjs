const http = require('node:http');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = new URL(process.env.TEST_API_URL || 'http://127.0.0.1:4000');
const password = process.env.TEST_ADMIN_PASSWORD;
if (!password) throw new Error('Set TEST_ADMIN_PASSWORD for provisioned salon-a and salon-b fixtures');
async function api(...args) {
  let result=await request(...args);
  if(result.status===429) { await new Promise(resolve=>setTimeout(resolve,60_000)); result=await request(...args); }
  return result;
}
function request(host,path,body,token,branch,method,extraHeaders={}) {
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:base.hostname,port:base.port,path,method:method || (body?'POST':'GET'),headers:{host,...extraHeaders,...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`} :{}),...(branch?{'x-branch-id':branch}:{})}},res=>{
      let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>{let data;try{data=JSON.parse(text)}catch{data=text}resolve({status:res.statusCode,data})});
    });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
}
(async()=>{
  assert.equal((await api('localhost','/health')).status,200);
  assert.equal((await api('unknown.localhost','/branches/public')).status,404);
  const a=await api('salon-a.localhost','/auth/login',{useremail:'owner@example.test',password});
  assert.equal(a.status,201,JSON.stringify(a.data));
  const b=await api('salon-b.localhost','/auth/login',{useremail:'owner@example.test',password});
  assert.equal(b.status,201,JSON.stringify(b.data));
  assert.notEqual(a.data.user.tenantId,b.data.user.tenantId);
  assert.equal((await api('salon-b.localhost','/branches',null,a.data.accessToken)).status,401);
  const branches=await api('salon-a.localhost','/branches',null,a.data.accessToken);
  assert.equal(branches.status,200,JSON.stringify(branches.data));assert.ok(branches.data.length>=2);
  assert.equal((await api('salon-a.localhost','/ai/chat/stream',null,a.data.accessToken)).status,404);
  assert.equal((await api('salon-a.localhost','/role-permissions',null,a.data.accessToken)).status,200);
  const foreign=await api('salon-b.localhost','/branches',null,b.data.accessToken);
  assert.equal((await api('salon-a.localhost','/branches',null,a.data.accessToken,foreign.data[0].id)).status,404);
  const prefix=randomUUID().slice(0,8);
  const branch=branches.data[0].id;
  const staff=await api('salon-a.localhost','/tenant-console/invitations',{email:`staff-${prefix}@example.test`,branch_id:branch},a.data.accessToken,branch);
  assert.equal(staff.status,201,JSON.stringify(staff.data));
  if(!process.env.TEST_OPERATOR_DATABASE_URL)throw new Error('Invitation tests require disposable TEST_OPERATOR_DATABASE_URL');
  const {Client}=require('pg');const invitationDb=new Client({connectionString:process.env.TEST_OPERATOR_DATABASE_URL});await invitationDb.connect();
  const message=(await invitationDb.query('SELECT body FROM platform_outbox WHERE recipient=$1',[`staff-${prefix}@example.test`])).rows[0].body;await invitationDb.end();
  const invitationToken=message.match(/token=([a-f0-9]+)/)[1];
  const accepted=await api('salon-a.localhost','/tenant-console/accept',{token:invitationToken,password});assert.equal(accepted.status,201,JSON.stringify(accepted.data));
  const login=await api('salon-a.localhost','/auth/login',{useremail:`staff-${prefix}@example.test`,password});
  assert.equal(login.status,201,JSON.stringify(login.data));
  assert.equal(login.data.user.branchId,branch);
  assert.equal((await api('salon-a.localhost','/branches',null,login.data.accessToken,branches.data[1].id)).status,403);
  assert.equal((await api('salon-a.localhost','/branches',{name:'Denied',slug:`denied-${prefix}`},login.data.accessToken,branch)).status,403);
  const callA = (path, body, selected=branch, method, headers) => api('salon-a.localhost',path,body,a.data.accessToken,selected,method,headers);
  const callB = (path, body, selected=foreign.data[0].id, method) => api('salon-b.localhost',path,body,b.data.accessToken,selected,method);
  const expect = (result, status) => { assert.equal(result.status,status,JSON.stringify(result.data)); return result.data };
  const phone=`017${String(Date.now()).slice(-8)}`;
  const client=expect(await callA('/clients',{name:`Client ${prefix}`,phone}),201);
  const otherClient=expect(await callB('/clients',{name:`Client B ${prefix}`,phone}),201);
  assert.notEqual(client.id,otherClient.id);
  const foreignHistory=await callB(`/clients/history/${client.id}`);
  assert.ok(foreignHistory.status === 404 || foreignHistory.data === null || foreignHistory.data === '', JSON.stringify(foreignHistory));
  const artist=expect(await callA('/employee',{data:JSON.stringify({name:`Artist ${prefix}`,role:'Stylist',phone:`018${String(Date.now()).slice(-8)}`,salary:12000})}),201);
  assert.equal((await callA(`/employee/${artist.id}`,null,branches.data[1].id)).status,404);
  const service=expect(await callA('/service',{data:JSON.stringify({name:`Cut ${prefix}`,category:'Hair',price:1000,commission:10,status:'active'})}),201);
  expect(await callA(`/service/${service.id}`,null,branches.data[1].id),200);
  assert.equal((await callB(`/service/${service.id}`)).status,404);
  const stock=expect(await callA('/inventory',{name:`Stock ${prefix}`,category:'Hair',stockQty:5,minStockLevel:1,unitPrice:100,supplier:'Test',expiryDate:'2030-01-01'}),201);
  assert.equal((await callA(`/inventory/${stock.id}`,null,branches.data[1].id)).status,404);
  assert.equal((await callB(`/inventory/${stock.id}`)).status,404);
  const invoice=expect(await callA('/invoice',{clientId:client.id,services:[service.name],staff:artist.name,total:1000,paidAmount:250,skipTax:true,status:'Partial',applyCommission:false}),201);
  assert.equal(invoice.status,'Partial');assert.equal(Number(invoice.paidAmount),250);
  assert.equal((await callA(`/invoice/${invoice.id}`,null,branches.data[1].id)).status,404);
  assert.equal((await callB(`/invoice/${invoice.id}`)).status,404);
  const collection=expect(await callA('/invoice',{clientId:client.id,total:750,paidAmount:750,dueCollected:750,skipTax:true,printBy:'Admin',status:'Paid'}),201);
  assert.equal(Number(collection.dueCollected),750);
  const settled=expect(await callA(`/invoice/${invoice.id}`),200);assert.equal(settled.status,'Paid');assert.equal(Number(settled.paidAmount),1000);
  const crossBranchDue=await callA('/invoice',{clientId:client.id,total:10,paidAmount:10,dueCollected:10,skipTax:true,printBy:'Admin',status:'Paid'},branches.data[1].id);
  assert.equal(crossBranchDue.status,400,JSON.stringify(crossBranchDue.data));
  const paid=expect(await callA('/invoice',{clientId:client.id,services:[service.name],staff:artist.name,paidAmount:1000,skipTax:true,printBy:'Admin',status:'Paid',applyCommission:true}),201);
  assert.equal(paid.status,'Paid');assert.equal(paid.commissionApplied,true);
  const wrongBranchStaff=await callA('/invoice',{clientId:client.id,services:[service.name],staff:artist.name,total:10},branches.data[1].id);
  assert.ok([400,404].includes(wrongBranchStaff.status),JSON.stringify(wrongBranchStaff));
  const date=new Date();const month=date.getMonth()+1;const year=date.getFullYear();
  const payrolls=expect(await callA(`/payroll?month=${month}&year=${year}&limit=100`),200);
  const payroll=(payrolls.data || payrolls.items || payrolls).find(row=>row.employeeId===artist.id);
  assert.ok(payroll,JSON.stringify(payrolls));assert.equal(Number(payroll.bonus),100);
  expect(await callA(`/payroll/${payroll.id}`,{status:'Paid',payDate:date.toISOString().slice(0,10)},branch,'PATCH'),200);
  assert.equal((await callA(`/payroll/${payroll.id}`,null,branches.data[1].id)).status,404);
  const transactions=expect(await callA('/finance/transactions?limit=100'),200);
  assert.ok(transactions.data.some(row=>row.type === 'expense' && row.title.includes(artist.name) && Number(row.amount) === 12100),JSON.stringify(transactions));
  const booked=expect(await callA('/appointments',{phoneNumber:phone,clientName:client.name,date:'2026-10-10',time:'12:00 PM',staff:artist.name,services:[service.name],source:'online'}),201);
  const foreignBookings=expect(await callA(`/appointments/${phone}`,null,branches.data[1].id),200);
  assert.equal(foreignBookings.length,0);
  assert.ok(expect(await callA(`/appointments/${phone}`),200).some(row=>row.id===booked.id));
  const secondArtist=expect(await callA('/employee',{data:JSON.stringify({name:artist.name,role:'Stylist',phone:`019${String(Date.now()).slice(-8)}`,salary:12000})},branches.data[1].id),201);
  expect(await callA('/invoice',{clientId:client.id,services:[service.name],staff:artist.name,total:100,paidAmount:100,skipTax:true,printBy:'Admin',status:'Paid',applyCommission:false},branches.data[1].id),201);
  const staffReports=expect(await callA('/reports/staff?from=2026-01-01&to=2030-12-31',null,branch,undefined,{'x-all-branches':'true'}),200);
  assert.equal(staffReports.staff.find(row=>row.id===artist.id).revenue,2000);
  assert.equal(staffReports.staff.find(row=>row.id===secondArtist.id).revenue,100);
  const mainDashboard=expect(await callA('/dashboard'),200);
  const secondDashboard=expect(await callA('/dashboard',null,branches.data[1].id),200);
  const allDashboard=expect(await callA('/dashboard',null,branch,undefined,{'x-all-branches':'true'}),200);
  assert.equal(allDashboard.activeEmployeesCount,mainDashboard.activeEmployeesCount+secondDashboard.activeEmployeesCount);
  assert.equal((await callA('/invoice',null,branch,undefined,{'x-all-branches':'true'})).status,403);
  if (process.env.TEST_OPERATOR_DATABASE_URL) {
    const { Client } = require('pg');
    const operator = new Client({connectionString:process.env.TEST_OPERATOR_DATABASE_URL});
    await operator.connect();
    const database=(await operator.query('SELECT current_database() AS name')).rows[0];
    assert.ok(database.name.endsWith('_test'),'Use a disposable *_test database');
    const accounts=(await operator.query('SELECT id,tenant_id,"resetCode","resetCodeExpiry","resetCodeAttempts" FROM auth WHERE tenant_id=ANY($1::uuid[]) AND useremail=$2',[ [a.data.user.tenantId,b.data.user.tenantId], 'owner@example.test'])).rows;
    try {
      await operator.query(`UPDATE auth SET "resetCode"=$1,"resetCodeExpiry"=now()+interval '15 minutes',"resetCodeAttempts"=0 WHERE id=ANY($2::uuid[])`,['123456',accounts.map(row=>row.id)]);
      const invalid=await api('salon-a.localhost','/auth/verify-reset-code',{email:'owner@example.test',code:'000000'});
      assert.equal(invalid.status,400,JSON.stringify(invalid.data));
      const attempts=(await operator.query('SELECT tenant_id,"resetCodeAttempts" FROM auth WHERE id=ANY($1::uuid[])',[accounts.map(row=>row.id)])).rows;
      assert.equal(attempts.find(row=>row.tenant_id===a.data.user.tenantId).resetCodeAttempts,1);
      assert.equal(attempts.find(row=>row.tenant_id===b.data.user.tenantId).resetCodeAttempts,0);
      assert.equal((await api('salon-a.localhost','/auth/verify-reset-code',{email:'owner@example.test',code:'123456'})).status,201);
      const template=(await operator.query('SELECT permissions FROM tenant_custom_role WHERE tenant_id=$1 AND name=$2',[a.data.user.tenantId,'Staff'])).rows[0];
      try {
        await operator.query('UPDATE tenant_custom_role SET permissions=$1 WHERE tenant_id=$2 AND name=$3',['[]',a.data.user.tenantId,'Staff']);
        assert.equal((await api('salon-a.localhost','/appointments',null,login.data.accessToken,branch)).status,403,'Current role permissions override stale JWT permissions');
      } finally {
        await operator.query('UPDATE tenant_custom_role SET permissions=$1 WHERE tenant_id=$2 AND name=$3',[JSON.stringify(template.permissions),a.data.user.tenantId,'Staff']);
      }
    } finally {
      for (const row of accounts) await operator.query('UPDATE auth SET "resetCode"=$1,"resetCodeExpiry"=$2,"resetCodeAttempts"=$3 WHERE id=$4',[row.resetCode,row.resetCodeExpiry,row.resetCodeAttempts,row.id]);
      await operator.end();
    }
  }
  console.log('PASS: API tenant/branch isolation, POS invoice payment, scoped dues, commissions, inventory, booking, payroll finance posting, aggregate dashboard and removed AI routes');
})().catch(error=>{console.error(error);process.exit(1)});
