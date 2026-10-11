"use client"
import { useState } from 'react'
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartCard } from './chart-card'
import { RangeToggle } from './range-toggle'
import { TopServicesPieChart } from './report-charts'
import { OverviewChartGrid } from './overview-layout'
const options = [{value:'ThisMonth',label:'Month'},{value:'SixMonths',label:'6 months'},{value:'ThisYear',label:'Year'}]
export function BookingChannelInsights({ stats }: { stats: Record<string, any> | null }) {
  const [period,setPeriod] = useState('ThisMonth')
  const [highlight,setHighlight] = useState<string | null>(null)
  const rows = [{name:'Online',count:Number(stats?.['onlineBookings'+period]??0),color:'#7040c1'},{name:'Walk-in',count:Number(stats?.['walkIns'+period]??0),color:'#0d9488'}]
  const total = rows.reduce((sum,row)=>sum+row.count,0)
  return <OverviewChartGrid>
    <ChartCard title="Booking channels" subtitle="Compare online and walk-in bookings" height={320} actions={<RangeToggle value={period} options={options} onChange={setPeriod}/> }>
      {total ? <><div className="relative"><ResponsiveContainer width="100%" height={235}><PieChart><Pie data={rows} dataKey="count" nameKey="name" innerRadius={65} outerRadius={90} paddingAngle={4} stroke="none">{rows.map(row=><Cell key={row.name} fill={row.color} opacity={!highlight || highlight===row.name?1:.25}/>)}</Pie><Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--brand-line)',borderRadius:12}}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl font-semibold text-brand-ink">{highlight?rows.find(row=>row.name===highlight)?.count:total}</strong><span className="mt-1 text-xs text-brand-muted">{highlight??'Bookings'}</span></div></div><div className="flex justify-center gap-3">{rows.map(row=><button type="button" key={row.name} aria-pressed={highlight===row.name} onClick={()=>setHighlight(highlight===row.name?null:row.name)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-brand-ink hover:bg-brand-soft"><span className="size-2 rounded-full" style={{background:row.color}}/>{row.name}<strong>{row.count}</strong></button>)}</div></>:<div className="flex h-[260px] items-center justify-center text-sm text-brand-muted">Booking channels will appear when visits are recorded.</div>}
    </ChartCard>
    <TopServicesPieChart services={stats?.topServices??[]}/>
  </OverviewChartGrid>
}
