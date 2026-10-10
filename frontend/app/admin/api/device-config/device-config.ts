import api from '../base'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeviceNetworkConfig {
  id: string
  deviceIp: string
  devicePort: number
  subnetMask: string | null
  gateway: string | null
  dnsServer: string | null
  communicationKey: string | null
  updatedAt: string
  createdAt: string
}

export interface DeviceConfigStatus {
  config: DeviceNetworkConfig
  connected: boolean
  enabled: boolean
}

export interface UpdateDeviceConfigPayload {
  deviceIp: string
  devicePort: number
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getDeviceConfigStatus(): Promise<DeviceConfigStatus> {
  const { data } = await api.get('/device-config', { cache: false })
  return data
}

export async function saveAndApplyConfig(payload: UpdateDeviceConfigPayload): Promise<{ config: DeviceNetworkConfig }> {
  const { data } = await api.put('/device-config', payload)
  return data
}
