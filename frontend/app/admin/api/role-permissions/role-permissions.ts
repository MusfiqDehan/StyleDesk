import api from '../base'

export type RolePermissionRow = {
  role: 'storeManager' | 'staff' | 'stylist'
  permissions: string[]
  updatedAt: string | null
}

export async function getRolePermissionModules() {
  const { data } = await api.get('/role-permissions/modules')
  return data as { modules: string[] }
}

export async function getRolePermissions() {
  const { data } = await api.get('/role-permissions')
  return data as RolePermissionRow[]
}

export async function updateRolePermissions(role: string, permissions: string[]) {
  const { data } = await api.patch(`/role-permissions/${role}`, { permissions })
  return data as RolePermissionRow & {
    invalidatedSessions: number
    message: string
  }
}
