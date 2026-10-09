import api from '../base'

export async function login(useremail: string, password: string) {
  const { data } = await api.post('/auth/login', { useremail, password })
  return data
}

export async function logout() {
  const { data } = await api.post('/auth/logout')
  return data
}
