import api from '../base'

export async function getMyProfile() {
  const { data } = await api.get('/auth/me')
  return data as {
    id: string
    useremail: string
    role: string
    name: string | null
    phone: string | null
    clientName: string | null
    clientId: string | null
    employeeName: string | null
  }
}

export async function updateMyProfile(body: { name: string; phone?: string }) {
  const { data } = await api.patch('/auth/update-profile', body)
  return data as {
    name: string | null
    phone: string | null
    accessToken: string
  }
}

export async function sendEmailChangeCode(email: string) {
  const { data } = await api.post('/auth/send-email-change-code', { email })
  return data as { message: string }
}

export async function confirmEmailChange(email: string, code: string) {
  const { data } = await api.post('/auth/confirm-email-change', { email, code })
  return data as {
    useremail: string
    accessToken: string
    message: string
  }
}
