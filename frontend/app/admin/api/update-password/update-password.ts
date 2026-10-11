import api from '../base'

export async function updatePassword(data: { oldPassword: string, newPassword: string }) {
  const { data: response } = await api.patch('/auth/update-password', data)
  return response
}
