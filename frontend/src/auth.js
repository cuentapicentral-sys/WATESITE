const USERS_KEY = 'wastewise.users'
const SESSION_KEY = 'wastewise.session'
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return '/api'
  return 'http://127.0.0.1:8001/api'
}
const API_BASE_URL = getApiBaseUrl()

function readUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
}

function setSession(session, remember = true) {
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(SESSION_KEY, JSON.stringify(session))
}

async function requestAuth(endpoint, payload) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'No se pudo completar la autenticación.')
  }

  return data
}

export function getSession() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
}

export async function loginUser(email, password, remember = true) {
  const normalizedEmail = email.toLowerCase().trim()
  try {
    const data = await requestAuth('/auth/login', { email: normalizedEmail, password })
    if (data.user) {
      const session = { name: data.user.name, email: data.user.email, role: data.user.role }
      setSession(session, remember)
      return session
    }
  } catch (error) {
    // Fallback para modo demo si el backend no está activo.
  }

  const user = readUsers().find(item => item.email === normalizedEmail && item.password === password)
  if (!user) throw new Error('El correo o la contraseña no son correctos.')

  const session = { name: user.name, email: user.email, role: user.role }
  setSession(session, remember)
  return session
}

export async function registerUser(name, email, password) {
  const normalizedEmail = email.toLowerCase().trim()
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')

  try {
    const data = await requestAuth('/auth/register', {
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'operator',
    })

    if (data.user) {
      const session = { name: data.user.name, email: data.user.email, role: data.user.role }
      setSession(session, true)
      return session
    }
  } catch (error) {
    // Si la API falla, seguimos con el fallback local.
  }

  const users = readUsers()
  if (users.some(user => user.email === normalizedEmail)) {
    throw new Error('Ya existe una cuenta con este correo.')
  }

  const user = { name: name.trim(), email: normalizedEmail, password, role: 'Operador' }
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]))
  const session = { name: user.name, email: user.email, role: user.role }
  setSession(session, true)
  return session
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}