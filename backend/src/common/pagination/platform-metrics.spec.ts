import { platformMetricRows } from './platform-metrics';
import { cursorSummary } from './cursor-summary';
import { paginateRows, type CursorRequest } from './cursor';
const request = (metric: string): CursorRequest => ({scope:'test',path:'/platform/tenants',cursor:null,order:'desc',search:'',filters:[{field:'metrics.'+metric,op:'eq',value:true}]});
describe('Platform stat card filters',()=>{
  beforeAll(()=>{process.env.JWT_SECRET='metric-test-secret'});
  it('keeps outstanding invitations separate from tenant counts and filters across pages',()=>{
    const rows=platformMetricRows('tenants',[...Array.from({length:23},(_,i)=>({id:String(i),active:i%2===0,status:i%3===0?'trial':'active'})),{id:'invite',record_type:'invitation',active:false,status:'invited'}]);
    const summary=cursorSummary(rows);
    expect(summary.metricCounts).toMatchObject({businesses:23,active:12,trial:8,attention:11,invited:1});
    expect(paginateRows(rows,request('active')).total).toBe(12);
    expect(paginateRows(rows,request('active')).data).toHaveLength(10);
    expect(paginateRows(rows,request('invited')).data.map(r=>r.id)).toEqual(['invite']);
    expect(paginateRows(rows,{...request('businesses'),search:'invited'}).total).toBe(0);
  });
  it('combines attention conditions and retains expired invites as outstanding',()=>{
    const rows=platformMetricRows('tenants',[{id:'a',active:true,status:'expired'},{id:'b',active:false,status:'trial'},{id:'c',record_type:'invitation',invitation_status:'expired',status:'invited'}]);
    expect(paginateRows(rows,request('attention')).total).toBe(2);
    expect(paginateRows(rows,request('invited')).total).toBe(1);
  });
  it('matches grouped payment, subscription and domain states',()=>{
    for (const [section,metric,statuses] of [['payments','failed',['failed','cancelled']],['subscriptions','overdue',['past_due','expired']],['domains','verified',['verified','active']]] as const){
      const rows=platformMetricRows(section,[...statuses.map((status,id)=>({id:String(id),status})),{id:'other',status:'other'}]);
      expect(paginateRows(rows,request(metric)).total).toBe(2);
    }
  });
});
