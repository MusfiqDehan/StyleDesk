const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const base = new URL(process.env.TEST_API_URL || 'http://127.0.0.1:4000');
const password = process.env.TEST_ADMIN_PASSWORD;
if (!password) throw new Error('Set TEST_ADMIN_PASSWORD for disposable provisioned tenant fixtures');
function request(host, path, body, token, branch, method) {
  return new Promise((resolve,reject) => {
    const req = http.request({hostname:base.hostname,port:base.port,path:(base.pathname.replace(/\/$/,'') || '')+path,method:method || (body?'POST':'GET'),headers:{host,...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`} :{}),...(branch?{'x-branch-id':branch}:{})}},res => {
      let raw='';res.on('data',chunk=>raw+=chunk);res.on('end',()=>{let data;try{data=JSON.parse(raw)}catch{data=raw}resolve({status:res.statusCode,data,headers:res.headers})});
    }); req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
}
(async () => {
  const host = process.env.TEST_TENANT_HOST || 'client1.localhost';
  const login = await request(host,'/auth/login',{useremail:process.env.TEST_TENANT_EMAIL || 'admin@client1.test',password});
  assert.equal(login.status,201,JSON.stringify(login.data));
  const token = login.data.accessToken;
  const branches = await request(host,'/branches',null,token);
  assert.equal(branches.status,200,JSON.stringify(branches.data));
  const branch = branches.data[0].id;
  const call = (path,body,method,selected=branch)=>request(host,path,body,token,selected,method);
  const prefix='cursor-'+randomUUID().slice(0,8);
  const created=[];
  try {
    for(let i=0;i<26;i++) {
      const result=await call('/inventory',{name:`${prefix} ${String(i).padStart(2,'0')}`,category:prefix,stockQty:Math.floor(i/2),unitPrice:i+10,minStockLevel:2,supplier:"Pagination test",expiryDate:"2027-12-31"});
      assert.equal(result.status,201,JSON.stringify(result.data));created.push(result.data.id);
    }
    const params = new URLSearchParams({pagination:'cursor',_sort:'stockQty',_order:'asc',_filters:JSON.stringify([{field:'category',op:'eq',value:prefix}]),limit:'500'});
    const url = cursor => '/inventory?'+params+'&cursor='+encodeURIComponent(cursor??'start');
    const get = async cursor => { const r=await call(url(cursor)); assert.equal(r.status,200,JSON.stringify(r.data));return r.data; };
    const first=await get(), second=await get(first.pageInfo.nextCursor), third=await get(second.pageInfo.nextCursor);
    assert.deepEqual([first.data.length,second.data.length,third.data.length],[10,10,6]);
    assert.equal(first.pageInfo.pageSize,10);assert.equal(first.total,26);
    assert.equal(new Set([...first.data,...second.data,...third.data].map(row=>row.id)).size,26);
    assert.deepEqual(first.data.map(row=>row.stockQty),[0,0,1,1,2,2,3,3,4,4]);
    assert.deepEqual((await get(third.pageInfo.previousCursor)).data.map(row=>row.id),second.data.map(row=>row.id));
    assert.deepEqual((await get(second.pageInfo.previousCursor)).data.map(row=>row.id),first.data.map(row=>row.id));
    assert.equal(third.pageInfo.hasNextPage,false);
    assert.equal((await call(url(first.pageInfo.nextCursor+'x'))).status,400);
    assert.equal((await call('/inventory?pagination=cursor&_filters='+encodeURIComponent('[null]'))).status,400);
    assert.equal((await call(url(first.pageInfo.nextCursor).replace('_order=asc','_order=desc'))).status,400);
    const bLogin=await request('client2.localhost','/auth/login',{useremail:'admin@client2.test',password});assert.equal(bLogin.status,201);
    assert.equal((await request('client2.localhost',url(first.pageInfo.nextCursor),null,bLogin.data.accessToken)).status,400);
    if(branches.data.length>1) assert.equal((await call(url(first.pageInfo.nextCursor),null,undefined,branches.data[1].id)).status,400);
    const removed=first.data[9].id;assert.equal((await call('/inventory/'+removed,null,'DELETE')).status,200);
    assert.deepEqual((await get(first.pageInfo.nextCursor)).data.map(row=>row.id),second.data.map(row=>row.id));
    for(const path of ['/clients','/appointments','/invoice','/employee','/service','/StyleDesk-packages','/testimonial','/news-letter-subscriber','/leave-request','/auth/users','/device-users/unlinked','/attendance','/payroll','/finance/categories','/vouchers']) {
      const response=await call(path+'?pagination=cursor');
      assert.equal(response.status,200,path+': '+JSON.stringify(response.data));
      assert.ok(Array.isArray(response.data.data),path);assert.ok(response.data.data.length<=10,path);assert.equal(response.data.pageInfo.pageSize,10,path);
    }
    const staff=await call('/reports/staff?from=2026-01-01&to=2026-12-31&pagination=cursor&collection=staff');assert.equal(staff.status,200,JSON.stringify(staff.data));assert.ok(staff.data.staff.length<=10);assert.equal(staff.data.totalStaff>=staff.data.staff.length,true);
    const dashboard=await call('/dashboard?pagination=cursor&collection=todaysAppointments');assert.equal(dashboard.status,200,JSON.stringify(dashboard.data));assert.ok(dashboard.data.todaysAppointments.length<=10);assert.ok(dashboard.data.pageInfo);
    const platform=await request('localhost','/platform/login',{email:'superadmin@styledesk.test',password});assert.equal(platform.status,201);
    for(const path of ['/platform/tenants','/platform/users','/platform/roles','/platform/packages','/platform/subscriptions','/platform/payments','/platform/domains','/platform/audit']) {
      const response=await request('localhost',path+'?pagination=cursor',null,platform.headers['set-cookie'][0].split(';')[0].split('=').slice(1).join('='));
      assert.equal(response.status,200,path+': '+JSON.stringify(response.data));assert.ok(response.data.data.length<=10,path);
      assert.ok(response.data.summary.total>=response.data.data.length,path+' summary');
      if(path==='/platform/tenants' && response.data.pageInfo.nextCursor) {
        const next=await request('localhost',path+'?pagination=cursor&cursor='+encodeURIComponent(response.data.pageInfo.nextCursor),null,platform.headers['set-cookie'][0].split(';')[0].split('=').slice(1).join('='));
        assert.equal(next.status,200);assert.deepEqual(next.data.summary,response.data.summary);
        const filtered=await request('localhost',path+'?pagination=cursor&_search=client1',null,platform.headers['set-cookie'][0].split(';')[0].split('=').slice(1).join('='));
        assert.equal(filtered.status,200);assert.deepEqual(filtered.data.summary,response.data.summary);
      }
    }
    console.log('PASS: live 10/10/6 SQL windows, forward/backward, filters, deleted anchors, signature/tenant/branch scope, tenant and platform list endpoints, report summaries');
  } finally {
    if (process.env.TEST_KEEP_CURSOR_FIXTURES === '1') require('node:fs').writeFileSync('/tmp/styledesk-cursor-fixtures.json', JSON.stringify({ prefix, ids: created }));
    else for(const id of created) await call('/inventory/'+id,null,'DELETE');
  }
})().catch(error=>{console.error(error);process.exitCode=1});
