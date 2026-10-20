const http = require('node:http');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { io } = require('socket.io-client');
const apiPort = Number(process.env.TEST_API_PORT || 4000);
const frontendPort = Number(process.env.TEST_FRONTEND_PORT || 3000);
const password = process.env.TEST_ADMIN_PASSWORD;
if (!password) throw new Error('TEST_ADMIN_PASSWORD is required for disposable salon-a/salon-b fixtures');
function request(port, host, path, body, token, branch, method, contentType) {
  const payload = body == null ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  return new Promise((resolve,reject) => {
    const req = http.request({hostname:'127.0.0.1',port,path,method:method || (payload?'POST':'GET'),headers:{host,...(payload?{'content-type':contentType || 'application/json','content-length':payload.length}:{}),...(token?{authorization:`Bearer ${token}`} :{}),...(branch?{'x-branch-id':branch}:{})}},res => {
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const text=Buffer.concat(chunks).toString();let data;try {data=JSON.parse(text)}catch{data=text}resolve({status:res.statusCode,data,headers:res.headers})});
    });req.on('error',reject);req.end(payload);
  });
}
async function socket(host,token,branch) {
  const client=io(`http://127.0.0.1:${apiPort}`,{forceNew:true,reconnection:false,transports:['websocket'],extraHeaders:{host},auth:{token,branchId:branch}});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Socket connection timed out')),5000);client.once('connect',()=>{clearTimeout(timer);resolve()});client.once('connect_error',error=>{clearTimeout(timer);reject(error)})});
  return client;
}
const clients=[];
(async()=>{
  const a=await request(frontendPort,'salon-a.localhost:3000','/api/backend/auth/login',{useremail:'owner@example.test',password});
  const b=await request(frontendPort,'salon-b.localhost:3000','/api/backend/auth/login',{useremail:'owner@example.test',password});
  assert.equal(a.status,201,JSON.stringify(a.data));assert.equal(b.status,201,JSON.stringify(b.data));
  assert.ok(a.headers['set-cookie'].some(value=>value.startsWith('accessToken=') && !/;\s*Domain=/i.test(value)));
  for(const [host,name] of [['salon-a.localhost:3000','Salon A'],['salon-b.localhost:3000','Salon B']]){
    const login=await request(frontendPort,host,'/login');assert.equal(login.status,200);assert.ok(login.data.includes(name));
    assert.ok(!login.data.includes('/brand/platform/'), 'Tenant sign-in must not use the platform logo or favicon');
    const manifest=await request(frontendPort,host,'/manifest.webmanifest');assert.equal(manifest.status,200);assert.equal(manifest.data.name,name);
    assert.ok(manifest.data.icons.every(icon=>!icon.src.includes('/brand/platform/')), 'Tenant install icons must use tenant branding');
  }
  const platformManifest=await request(frontendPort,'localhost:3000','/manifest.webmanifest');assert.equal(platformManifest.data.name,'StyleDesk');
  assert.ok(platformManifest.data.icons[0].src.includes('/brand/platform/'));
  assert.equal((await request(frontendPort,'unknown.localhost:3000','/login')).status,404);
  assert.equal((await request(frontendPort,'unknown.localhost:3000','/sitemap.xml')).status,404);
  assert.equal((await request(frontendPort,'salon-a.localhost:3000','/admin/ai-knowledge')).status,404);
  assert.equal((await request(frontendPort,'salon-a.localhost:3000','/api/ai/chat/stream')).status,404);
  assert.equal((await request(frontendPort,'salon-a.localhost:3000','/llms.txt')).status,404);
  assert.equal((await request(frontendPort,'salon-b.localhost:3000','/api/backend/branches',null,a.data.accessToken)).status,401);
  const branches=(await request(frontendPort,'salon-a.localhost:3000','/api/backend/branches',null,a.data.accessToken)).data;
  const foreign=(await request(frontendPort,'salon-b.localhost:3000','/api/backend/branches',null,b.data.accessToken)).data;
  const events=[[],[],[]];
  clients.push(await socket('salon-a.localhost',a.data.accessToken,branches[0].id),await socket('salon-a.localhost',a.data.accessToken,branches[1].id),await socket('salon-b.localhost',b.data.accessToken,foreign[0].id));
  clients.forEach((client,index)=>client.on('new-invoice',event=>events[index].push(event)));
  await new Promise(resolve=>setTimeout(resolve,150));
  const invoice=await request(frontendPort,'salon-a.localhost:3000','/api/backend/invoice',{total:10,paidAmount:0,skipTax:true},a.data.accessToken,branches[0].id);
  assert.equal(invoice.status,201,JSON.stringify(invoice.data));
  await new Promise(resolve=>setTimeout(resolve,200));
  assert.ok(events[0].some(event=>event.id===invoice.data.id));assert.equal(events[1].length,0);assert.equal(events[2].length,0);
  const boundary=`tenant-${randomUUID()}`;
  const png=await require('sharp')({create:{width:2,height:2,channels:3,background:'#aaaaaa'}}).png().toBuffer();
  const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="pixel.png"\r\nContent-Type: image/png\r\n\r\n`),png,Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const upload=await request(frontendPort,'salon-a.localhost:3000','/api/backend/service/upload-image',body,a.data.accessToken,branches[0].id,'POST',`multipart/form-data; boundary=${boundary}`);
  assert.equal(upload.status,201,JSON.stringify(upload.data));assert.ok(upload.data.imageUrl.startsWith(`${a.data.user.tenantId}/`));
  const imagePath=`/uploads/${upload.data.imageUrl}`;
  assert.equal((await request(frontendPort,'salon-a.localhost:3000',imagePath)).status,200);
  const service=await request(frontendPort,'salon-a.localhost:3000','/api/backend/service',{data:JSON.stringify({name:`Media ${randomUUID()}`,imageUrl:upload.data.imageUrl})},a.data.accessToken,branches[0].id);
  assert.equal(service.status,201,JSON.stringify(service.data));
  assert.equal((await request(frontendPort,'salon-b.localhost:3000',`/api/backend/service/${service.data.id}`,null,b.data.accessToken,foreign[0].id,'DELETE')).status,404);
  assert.equal((await request(frontendPort,'salon-a.localhost:3000',imagePath)).status,200);
  assert.equal((await request(frontendPort,'salon-a.localhost:3000',`/api/backend/service/${service.data.id}`,null,a.data.accessToken,branches[0].id,'DELETE')).status,200);
  assert.equal((await request(frontendPort,'salon-a.localhost:3000',imagePath)).status,404);
  console.log('PASS: same-origin auth cookies, tenant branding, unknown hosts, removed routes, proxy isolation, tenant/branch socket rooms and upload ownership/deletion');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>clients.forEach(client=>client.disconnect()));
