"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"

import { useCallback, useEffect, useState } from "react"
import { Network, RefreshCw, Save, Wifi, WifiOff } from "lucide-react"
import { toast } from '@/lib/toast'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getDeviceConfigStatus,
  saveAndApplyConfig,
  type DeviceConfigStatus,
} from "@admin/api/device-config/device-config"
import { AdminPageHeader } from "@admin/components/admin-page-header"

export default function IpConfigPage() {
  const [status, setStatus] = useState<DeviceConfigStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [deviceIp, setDeviceIp] = useState("")
  const [devicePort, setDevicePort] = useState("")

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const s = await getDeviceConfigStatus()
      setStatus(s)
      setDeviceIp(s.config.deviceIp)
      setDevicePort(String(s.config.devicePort))
    } catch {
      toast.error("Failed to load device configuration")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function handleSave() {
    const port = parseInt(devicePort, 10)
    if (!deviceIp.trim() || isNaN(port) || port < 1 || port > 65535) {
      toast.error("Enter a valid IP address and port")
      return
    }
    setSaving(true)
    try {
      await saveAndApplyConfig({ deviceIp: deviceIp.trim(), devicePort: port })
      toast.success("Connected — configuration saved")
      await loadStatus()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : "Failed to save configuration")
      toast.error(message, { duration: 8000 })
      await loadStatus()
    } finally {
      setSaving(false)
    }
  }

  const connected = status?.connected ?? false
  const enabled = status?.enabled ?? true

  const statusLabel = !enabled ? "Disabled" : connected ? "Connected" : "Disconnected"
  const statusColor = !enabled
    ? "text-muted-foreground"
    : connected
      ? "text-emerald-600"
      : "text-red-500"
  const dotColor = !enabled
    ? "bg-muted-foreground"
    : connected
      ? "bg-emerald-500"
      : "bg-red-500"

  return (
    <div className={DASH_PAGE}>
      <div className="mx-auto w-full max-w-sm space-y-4">
        <AdminPageHeader
          title="ZKTeco Device"
          subtitle="Configure your biometric attendance device connection"
        />

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

          {/* Card header strip */}
          <div className="bg-gradient-to-r from-primary/8 to-primary/3 border-b border-border px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Network className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">Device Status</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">Live connection</p>
                </div>
              </div>

              {/* Status pill */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                !enabled
                  ? "bg-muted/50 border-border text-muted-foreground"
                  : connected
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-red-50 border-red-200 text-red-600"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${connected ? "animate-pulse" : ""}`} />
                {statusLabel}
              </div>
            </div>

            {/* Active target */}
            {!loading && status && (
              <div className="mt-4 flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${connected ? "bg-emerald-100" : "bg-muted"}`}>
                  {connected
                    ? <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    : <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground leading-tight">Active target</p>
                  <p className="font-mono text-sm font-medium text-foreground truncate">
                    {status.config.deviceIp}:{status.config.devicePort}
                  </p>
                </div>
              </div>
            )}
            {loading && (
              <div className="mt-4 h-10 bg-muted/40 animate-pulse rounded-lg" />
            )}
          </div>

          {/* Form body */}
          <div className="px-6 py-5 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <div className="h-14 bg-muted animate-pulse rounded-lg" />
                <div className="h-14 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="deviceIp" className="text-xs font-medium">
                    Device IP Address
                  </Label>
                  <Input
                    id="deviceIp"
                    placeholder="192.168.10.201"
                    value={deviceIp}
                    onChange={e => setDeviceIp(e.target.value)}
                    className="font-mono h-10 text-sm"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="devicePort" className="text-xs font-medium">
                    Port
                  </Label>
                  <Input
                    id="devicePort"
                    placeholder="4370"
                    value={devicePort}
                    onChange={e => setDevicePort(e.target.value)}
                    className="font-mono h-10 text-sm"
                    type="number"
                    min={1}
                    max={65535}
                    disabled={saving}
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="w-full h-10 gap-2 mt-1"
             accessAction="edit">
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Connecting to {deviceIp}…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save &amp; Connect
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground px-2 leading-relaxed">
          Set the same IP on the device via its keypad menu.
          The server will verify the connection before saving.
        </p>

        {/* Refresh link */}
        <div className="flex justify-center">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh status
          </button>
        </div>

      </div>
    </div>
  )
}
