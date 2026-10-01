'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Fingerprint, UserCheck, UserPlus, Loader2, Wifi } from 'lucide-react'
import { toast } from '@/lib/toast'
import type { NewDeviceUserPayload } from '@/hooks/use-biometric-socket'
import { linkDeviceUser } from '@admin/api/biometric/biometric'
import { createEmployee, getBasicEmployees } from '@admin/api/employees/employees'

interface Employee {
  id: string
  name: string
  role?: string
}

interface Props {
  payload: NewDeviceUserPayload | null
  onClose: () => void
}

type Mode = 'choose' | 'link-existing' | 'create-new'

export function BiometricModal({ payload, onClose }: Props) {
  const open = payload !== null

  const [mode, setMode] = useState<Mode>('choose')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [isPending, startTransition] = useTransition()

  // Reset state whenever a new payload arrives
  useEffect(() => {
    if (open) {
      setMode('choose')
      setSelectedEmployeeId('')
      setNewName('')
      setNewPhone('')
    }
  }, [open, payload?.device_uid])

  // Fetch employees when opening link-existing mode
  useEffect(() => {
    if (mode === 'link-existing') {
      getBasicEmployees()
        .then(setEmployees)
        .catch(() => toast.error('Failed to load employees'))
    }
  }, [mode])

  function handleClose() {
    if (!isPending) onClose()
  }

  function handleLinkExisting() {
    if (!payload || !selectedEmployeeId) return
    startTransition(async () => {
      try {
        await linkDeviceUser(payload.device_uid, selectedEmployeeId)
        const emp = employees.find((e) => e.id === selectedEmployeeId)
        toast.success(`Fingerprint linked to ${emp?.name ?? 'employee'} successfully`)
        onClose()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Link failed'
        toast.error(msg)
      }
    })
  }

  function handleCreateAndLink() {
    if (!payload || !newName.trim() || !newPhone.trim()) return
    startTransition(async () => {
      try {
        const created = await createEmployee({
          name: newName.trim(),
          phone: newPhone.trim(),
        })
        await linkDeviceUser(payload.device_uid, created.id)
        toast.success(`Employee "${created.name}" created and fingerprint linked`)
        onClose()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Operation failed'
        toast.error(msg)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md pb-8">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>New Fingerprint User Detected</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Device UID:{' '}
                <Badge variant="outline" className="font-mono text-xs">
                  {payload?.device_uid}
                </Badge>
                {payload?.name && (
                  <span className="ml-2 text-muted-foreground">· {payload.name}</span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Choose mode ───────────────────────────────────────────── */}
        {mode === 'choose' && (
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              A new fingerprint was registered on the biometric device. What would you like to do?
            </p>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 py-6 text-left"
              onClick={() => setMode('link-existing')}
            >
              <UserCheck className="h-5 w-5 text-brand-primary" />
              <div>
                <p className="font-medium">Link to existing employee</p>
                <p className="text-xs text-muted-foreground">Choose an employee from the list</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 py-6 text-left"
              onClick={() => setMode('create-new')}
            >
              <UserPlus className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Create new employee</p>
                <p className="text-xs text-muted-foreground">Register a new employee and link fingerprint</p>
              </div>
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleClose}>
              Dismiss for now
            </Button>
          </div>
        )}

        {/* ── Link existing ─────────────────────────────────────────── */}
        {mode === 'link-existing' && (
          <div className="mt-2 flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="emp-select">Select employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger id="emp-select">
                  <SelectValue placeholder="Choose employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 && (
                    <SelectItem value="__loading" disabled>
                      Loading…
                    </SelectItem>
                  )}
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                      {emp.role && (
                        <span className="ml-2 text-xs text-muted-foreground">· {emp.role}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setMode('choose')}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleLinkExisting}
                disabled={!selectedEmployeeId || isPending}
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                Confirm Link
              </Button>
            </div>
          </div>
        )}

        {/* ── Create new ────────────────────────────────────────────── */}
        {mode === 'create-new' && (
          <div className="mt-2 flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Full name *</Label>
              <Input
                id="new-name"
                placeholder="e.g. Rina Begum"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-phone">Phone *</Label>
              <Input
                id="new-phone"
                placeholder="e.g. 01712345678"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The new employee will be created with default role and linked to this fingerprint.
            </p>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setMode('choose')}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateAndLink}
                disabled={!newName.trim() || !newPhone.trim() || isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Create &amp; Link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
