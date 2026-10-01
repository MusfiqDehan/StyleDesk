'use client'
import { ModernSelect } from "@/components/ui/modern-select";
import { useEffect, useState } from 'react'
import api from '@/app/admin/api/base'
import { selectedBranch, selectBranch } from '@/lib/branch-selection'
import { usePathname } from 'next/navigation'
type Branch = { id: string; name: string; slug: string; active?: boolean }
export function BranchSwitcher({ admin = false, homeBranch }: { admin?: boolean; homeBranch?: string | null }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [devices, setDevices] = useState<Array<{id:string;serial:string}>>([])
  useEffect(() => { if (admin || homeBranch) api.get('/devices').then(r => setDevices(r.data)).catch(() => {}) }, [admin, homeBranch])
  const pathname = usePathname()
  useEffect(() => { let active = true; api.get<Branch[]>(admin ? '/branches' : '/branches/public').then(r => { if (active) setBranches(r.data.filter(branch => branch.active !== false)) }).catch(() => {}); return () => { active = false } }, [admin])
  const value = homeBranch || selectedBranch() || branches[0]?.id || ''
  return <label className="block px-3 py-2 text-sm">Branch
    <ModernSelect aria-label="Branch" className="mt-1 w-full rounded border bg-background p-2" value={value} disabled={!!homeBranch} onChange={event => selectBranch(event.target.value)}>
      {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
    </ModernSelect>
    {!!devices.length && <ModernSelect aria-label="Attendance device" className="mt-2 w-full rounded border bg-background p-2" defaultValue={typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('deviceId') || devices[0]?.id : devices[0]?.id} onChange={event => { sessionStorage.setItem('deviceId', event.target.value); location.reload() }}>{devices.map(device => <option key={device.id} value={device.id}>{device.serial}</option>)}</ModernSelect>}
    {admin && (pathname === '/admin' || pathname.startsWith('/admin/reports') || pathname.startsWith('/admin/staff-reports')) && <label className="mt-2 flex gap-2 text-xs"><input type="checkbox" defaultChecked={typeof sessionStorage !== 'undefined' && sessionStorage.getItem('allBranches') === 'true'} onChange={event => { sessionStorage.setItem('allBranches', String(event.target.checked)); location.reload() }} />All branches (reports)</label>}
  </label>
}
