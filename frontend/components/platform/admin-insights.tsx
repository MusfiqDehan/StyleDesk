"use client"
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CursorSummary } from '@/lib/pagination/cursor'
import { useState } from 'react'
import { Building2, CircleCheck, Clock3, AlertTriangle, Users, Shield, Layers, Globe, CreditCard, Activity, TrendingUp, Wallet, UserPlus } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DashKpiCard, DashKpiGrid } from '@/app/admin/components/dash/kpi-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
const colors = ['#7040c1', '#0d9488', '#f59e0b', '#e11d48', '#2563eb', '#a855f7']
const money = (value: unknown, currency = 'BDT') => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value) || 0)
const active = (row: any) => row.active === true
const count = (rows: any[], predicate: (row: any) => boolean) => rows.filter(predicate).length
export const platformMetricKeys: Record<string, string[]> = {
  tenants: ['businesses','active','trial','attention','invited'],
  subscriptions: ['all','active','trial','overdue'], payments: ['all','verified','pending','failed'],
  packages: ['all','published','drafts','currencies'], users: ['all','active','inactive','roles'],
  roles: ['all','protected','custom','permissions'], domains: ['all','verified','pending','failed'],
  audit: ['all','actions','businesses','actors'], gateways: ['all','configured','tenant','platform'],
};
export function PlatformListStats({ section, data, summary, selected, onFilter }: { section: string; data: any[]; summary?: CursorSummary; selected: string; onFilter: (key: string) => void }) {
  const n = data.length
  const defs: Record<string, {title: string; value: number | string; icon: typeof Users; tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'; subtitle: string}[]> = {
    tenants: [
      { title:'Businesses', value:n, icon:Building2, subtitle:'Across your platform' },
      { title:'Active workspaces', value:count(data,active), icon:CircleCheck, tone:'success', subtitle:'Businesses with access enabled' },
      { title:'On trial', value:count(data,r=>r.status==='trial'), icon:Clock3, tone:'warning', subtitle:'Exploring their workspace' },
      { title:'Needs attention', value:count(data,r=>!r.active || ['past_due','expired'].includes(r.status)), icon:AlertTriangle, tone:'danger', subtitle:'Suspended or overdue businesses' },
      { title:'Invited tenants', value:count(data,r=>r.record_type==='invitation'), icon:UserPlus, tone:'neutral', subtitle:'Pending or expired invitations' },
    ],
    subscriptions: [
      { title:'Subscriptions', value:n, icon:Layers, subtitle:'All subscription terms' },
      { title:'Active', value:count(data,r=>r.status==='active'), icon:CircleCheck, tone:'success', subtitle:'Active subscription plans' },
      { title:'Trials', value:count(data,r=>r.status==='trial'), icon:Clock3, tone:'warning', subtitle:'Trial subscriptions' },
      { title:'Overdue / expired', value:count(data,r=>['past_due','expired'].includes(r.status)), icon:AlertTriangle, tone:'danger', subtitle:'Renewals to review' },
    ],
    payments: [
      { title:'Payment attempts', value:n, icon:CreditCard, subtitle:'Platform subscription payments' },
      { title:'Verified payments', value:count(data,r=>r.status==='success'), icon:CircleCheck, tone:'success', subtitle:'Successfully verified' },
      { title:'Pending', value:count(data,r=>r.status==='pending'), icon:Clock3, tone:'warning', subtitle:'Awaiting payment confirmation' },
      { title:'Failed / cancelled', value:count(data,r=>['failed','cancelled'].includes(r.status)), icon:AlertTriangle, tone:'danger', subtitle:'Payment attempts to review' },
    ],
    packages: [
      { title:'Packages', value:n, icon:Layers, subtitle:'Available package definitions' },
      { title:'Published', value:count(data,r=>r.published), icon:CircleCheck, tone:'success', subtitle:'Visible on your pricing page' },
      { title:'Drafts', value:count(data,r=>!r.published), icon:Clock3, tone:'warning', subtitle:'Ready for your next update' },
      { title:'Currencies', value:new Set(data.map(r=>r.currency).filter(Boolean)).size, icon:Wallet, tone:'neutral', subtitle:'Supported package currencies' },
    ],
    users: [
      { title:'Platform users', value:n, icon:Users, subtitle:'Platform administration accounts' },
      { title:'Active accounts', value:count(data,active), icon:CircleCheck, tone:'success', subtitle:'Accounts with access enabled' },
      { title:'Inactive', value:count(data,r=>!r.active), icon:Clock3, tone:'warning', subtitle:'Accounts without platform access' },
      { title:'Assigned roles', value:new Set(data.map(r=>r.role).filter(Boolean)).size, icon:Shield, tone:'neutral', subtitle:'Distinct roles in use' },
    ],
    roles: [
      { title:'Roles', value:n, icon:Shield, subtitle:'Platform access profiles' },
      { title:'Protected roles', value:count(data,r=>r.protected), icon:CircleCheck, tone:'success', subtitle:'System-managed access profiles' },
      { title:'Custom roles', value:count(data,r=>!r.protected), icon:Users, tone:'neutral', subtitle:'Roles tailored to your team' },
      { title:'Permission rules', value:data.reduce((sum,r)=>sum+(r.permissions?.length??0),0), icon:Layers, subtitle:'Rules across all access profiles' },
    ],
    domains: [
      { title:'Domains', value:n, icon:Globe, subtitle:'Connected business addresses' },
      { title:'Verified', value:count(data,r=>['verified','active'].includes(r.status)), icon:CircleCheck, tone:'success', subtitle:'Verified domain ownership' },
      { title:'Pending', value:count(data,r=>!['verified','active','failed'].includes(r.status)), icon:Clock3, tone:'warning', subtitle:'Setup or verification in progress' },
      { title:'Failed', value:count(data,r=>r.status==='failed'), icon:AlertTriangle, tone:'danger', subtitle:'Domains requiring attention' },
    ],
    audit: [
      { title:'Recent events', value:n, icon:Activity, subtitle:'Recent platform activity' },
      { title:'Action types', value:new Set(data.map(r=>r.action)).size, icon:Layers, subtitle:'Distinct actions in this activity' },
      { title:'Businesses', value:new Set(data.map(r=>r.tenant_id).filter(Boolean)).size, icon:Building2, subtitle:'Businesses represented' },
      { title:'Team members', value:new Set(data.map(r=>r.actor_id).filter(Boolean)).size, icon:Users, subtitle:'People represented in this activity' },
    ],
    gateways: [
      { title:'Gateways', value:n, icon:CreditCard, subtitle:'Payment gateway integrations' },
      { title:'Configured', value:count(data,r=>r.is_configured), icon:CircleCheck, tone:'success', subtitle:'Integrations with credentials' },
      { title:'Tenant checkout', value:count(data,r=>r.enabled_for_tenants), icon:Building2, subtitle:'Enabled for salon payments' },
      { title:'Platform checkout', value:count(data,r=>r.enabled_for_platform), icon:Wallet, subtitle:'Enabled for subscriptions' },
    ],
  }
  const counts = summary?.statusCounts ?? {}
  const values: Record<string, number[]> | undefined = summary ? {
    tenants: [summary.metricCounts?.businesses ?? summary.total,summary.active,counts.trial??0,summary.metricCounts?.attention ?? summary.attention,summary.metricCounts?.invited ?? 0],
    subscriptions: [summary.total,counts.active??0,counts.trial??0,(counts.past_due??0)+(counts.expired??0)],
    payments: [summary.total,counts.success??0,counts.pending??0,(counts.failed??0)+(counts.cancelled??0)],
    packages: [summary.total,summary.published,summary.total-summary.published,summary.distinctCurrencies],
    users: [summary.total,summary.active,summary.total-summary.active,summary.distinctRoles],
    roles: [summary.total,summary.protected,summary.total-summary.protected,summary.permissionRules],
    domains: [summary.total,(counts.verified??0)+(counts.active??0),summary.total-(counts.verified??0)-(counts.active??0)-(counts.failed??0),counts.failed??0],
    audit: [summary.total,summary.distinctActions,summary.distinctTenants,summary.distinctActors],
  } : undefined
  const cards = defs[section]
  if (!cards) return null
  return <DashKpiGrid className={section==='tenants' ? 'mb-6 xl:grid-cols-5' : 'mb-6'}>{cards.map((card,index)=>{
    const key = platformMetricKeys[section][index];
    return <DashKpiCard key={card.title} {...card} className="platform-filter-stat" value={values?.[section]?.[index] ?? card.value}
      selected={selected===key} highlighted={selected===key} onClick={()=>onFilter(key)} />;
  })}</DashKpiGrid>

}
function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  return <div className="platform-chart-tooltip"><strong>{label ?? payload[0]?.name}</strong>{payload.map((p: any)=><p key={p.dataKey??p.name}><span style={{color:p.color}}>●</span> {p.name}: <b>{currency ? money(p.value,currency) : Number(p.value).toLocaleString()}</b></p>)}</div>
}
export function PlatformOverview({ data }: { data: any }) {
  const router = useRouter()
  const [months,setMonths] = useState(6)
  const [view,setView] = useState<'area'|'bar'>('area')
  const [currency,setCurrency] = useState(data.revenue?.[0]?.currency ?? 'BDT')
  const [selectedPackage,setSelectedPackage] = useState<string | null>(null)
  const c = data.counts
  const end = new Date()
  const timeline = Array.from({length:months},(_,i)=>{
    const date = new Date(end.getFullYear(), end.getMonth()-months+1+i,1)
    return {key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,month:date.toLocaleDateString('en',{month:'short',year:'2-digit'})}
  })
  const signups = timeline.map(month=>({...month,tenants:Number(data.signup_trends?.find((r:any)=>String(r.month).slice(0,7)===month.key)?.tenants??0)}))
  const currencies = [...new Set<string>([...(data.revenue??[]).map((r:any)=>r.currency),...(data.revenue_trends??[]).map((r:any)=>r.currency), 'BDT'])]
  const revenue = timeline.map(month=>({...month,collected:Number(data.revenue_trends?.find((r:any)=>String(r.month).slice(0,7)===month.key && r.currency===currency)?.collected??0)}))
  const distribution = (data.distribution??[]).map((r:any)=>({...r,tenants:Number(r.tenants)}))
  const packageTotal = distribution.reduce((sum:number,r:any)=>sum+r.tenants,0)
  const currentPackage = distribution.find((r:any)=>r.name===selectedPackage)
  const revenueTotal = revenue.reduce((sum,row)=>sum+row.collected,0)
  const chartAxes = <><CartesianGrid stroke="var(--brand-line)" strokeDasharray="4 4" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fill:'var(--brand-muted)',fontSize:11}}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--brand-muted)',fontSize:11}} width={52}/></>
  return <>
    <DashKpiGrid className="mb-6">
      <DashKpiCard title="Total businesses" value={c.total} icon={Building2} subtitle="Your platform community" onClick={()=>router.push("/admin/tenants")} />
      <DashKpiCard title="Active businesses" value={c.active} icon={CircleCheck} tone="success" subtitle={`${c.total ? Math.round(c.active/c.total*100) : 0}% of your businesses`} onClick={()=>router.push("/admin/tenants?metric=active")} />
      <DashKpiCard title="Trials ending soon" value={c.expiring_trials} icon={Clock3} tone="warning" subtitle="Trial expires within 7 days" onClick={()=>router.push("/admin/tenants?metric=expiring_trials")} />
      <DashKpiCard title="Overdue renewals" value={c.overdue} icon={AlertTriangle} tone="danger" subtitle="Subscriptions awaiting renewal" onClick={()=>router.push("/admin/tenants?metric=overdue")} />
    </DashKpiGrid>
    <div className="platform-insights-toolbar"><div><h2>Platform performance</h2><p className="platform-muted">Explore registrations and verified subscription revenue.</p></div><div className="platform-segment" aria-label="Chart date range">{[3,6,12].map(n=><button key={n} type="button" aria-pressed={months===n} onClick={()=>setMonths(n)}>{n} months</button>)}</div></div>
    <div className="platform-chart-grid">
      <article className="platform-card platform-chart-card"><div className="platform-chart-heading"><div><span className="platform-eyebrow">Business growth</span><h3>New registrations</h3><strong>{signups.reduce((sum,r)=>sum+r.tenants,0).toLocaleString()} <small>businesses in this period</small></strong></div><TrendingUp size={20}/></div>
        <div role="img" aria-label={`New registrations across the last ${months} months`}><ResponsiveContainer width="100%" height={260}><BarChart data={signups} margin={{top:20,right:12,bottom:0,left:-10}}>{chartAxes}<Tooltip content={<ChartTooltip/>}/><Bar name="Businesses" dataKey="tenants" fill={colors[0]} radius={[6,6,0,0]} maxBarSize={36}/></BarChart></ResponsiveContainer></div>
        <p className="platform-chart-note">Hover or focus on a month to inspect registrations.</p>
      </article>
      <article className="platform-card platform-chart-card"><div className="platform-chart-heading"><div><span className="platform-eyebrow">Subscription revenue</span><h3>Verified collections</h3><strong>{money(revenueTotal,currency)}</strong></div><Select value={currency} onValueChange={setCurrency}><SelectTrigger className="w-[100px]" aria-label="Revenue currency"><SelectValue/></SelectTrigger><SelectContent>{currencies.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div className="platform-segment platform-chart-view" aria-label="Revenue chart style">{(['area','bar'] as const).map(type=><button key={type} type="button" aria-pressed={view===type} onClick={()=>setView(type)}>{type==='area'?'Trend':'Columns'}</button>)}</div>
        <div role="img" aria-label={`${currency} verified subscription revenue across the last ${months} months`}><ResponsiveContainer width="100%" height={230}>{view==='area'?<AreaChart data={revenue} margin={{top:16,right:12,bottom:0,left:-10}}>{chartAxes}<Tooltip content={<ChartTooltip currency={currency}/>}/><defs><linearGradient id="platform-revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[1]} stopOpacity={.28}/><stop offset="100%" stopColor={colors[1]} stopOpacity={.02}/></linearGradient></defs><Area name="Collected" dataKey="collected" type="monotone" stroke={colors[1]} strokeWidth={2.5} fill="url(#platform-revenue-fill)" activeDot={{r:5}}/></AreaChart>:<BarChart data={revenue}>{chartAxes}<Tooltip content={<ChartTooltip currency={currency}/>}/><Bar name="Collected" dataKey="collected" fill={colors[1]} radius={[6,6,0,0]} maxBarSize={36}/></BarChart>}</ResponsiveContainer></div>
        <p className="platform-chart-note">Verified platform subscriptions only. Each currency is shown separately.</p>
      </article>
      <article className="platform-card platform-chart-card"><div className="platform-chart-heading"><div><span className="platform-eyebrow">Package mix</span><h3>Where businesses belong</h3></div><Layers size={20}/></div>
        {packageTotal ? <><div className="platform-donut"><ResponsiveContainer width="100%" height={235}><PieChart><Pie data={distribution} dataKey="tenants" nameKey="name" innerRadius={65} outerRadius={92} paddingAngle={3} stroke="none">{distribution.map((r:any,i:number)=><Cell key={r.name} fill={colors[i%colors.length]} opacity={!selectedPackage || selectedPackage===r.name?1:.25}/>)}</Pie><Tooltip content={<ChartTooltip/>}/></PieChart></ResponsiveContainer><div className="platform-donut-label"><strong>{currentPackage?.tenants??packageTotal}</strong><span>{selectedPackage??'Businesses'}</span></div></div><div className="platform-chart-legend">{distribution.map((r:any,i:number)=><button type="button" key={r.name} aria-pressed={selectedPackage===r.name} onClick={()=>setSelectedPackage(selectedPackage===r.name?null:r.name)}><span style={{background:colors[i%colors.length]}}/>{r.name}<strong>{r.tenants}</strong></button>)}</div></>:<p className="platform-empty">Package adoption will appear as businesses join.</p>}
      </article>
      <article className="platform-card platform-chart-card"><div className="platform-chart-heading"><div><span className="platform-eyebrow">Workspace health</span><h3>A clear view of what needs you</h3></div><Activity size={20}/></div>
        <div className="platform-health-metric"><span>Active workspace rate</span><strong>{c.total ? Math.round(c.active/c.total*100):0}%</strong><progress value={c.active} max={Math.max(c.total,1)} aria-label="Active workspace rate"/></div>
        <div className="platform-health-links"><Link href="/admin/tenants"><Building2 size={17}/><span>Suspended businesses</span><strong>{c.suspended}</strong></Link><Link href="/admin/payments"><CreditCard size={17}/><span>Payment failures</span><strong>{data.failures?.[0]?.payments??0}</strong></Link><Link href="/admin/domains"><Globe size={17}/><span>Domain failures</span><strong>{data.failures?.[0]?.domains??0}</strong></Link></div>
        <div className="platform-recurring"><span className="platform-muted">Monthly recurring revenue</span>{data.mrr?.length?data.mrr.map((r:any)=><strong key={r.currency}>{money(r.amount,r.currency)}</strong>):<strong>—</strong>}<p className="platform-chart-note">Monthly equivalent of active, verified paid subscriptions.</p></div>
      </article>
    </div>
  </>
}
