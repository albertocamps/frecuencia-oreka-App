import { instant, madridParts, SERVICES } from './domain.js'
const SCOPES = ['https://www.googleapis.com/auth/calendar.events.owned', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly']
let accessToken = '', expires = 0, loading, authGeneration = 0
export const connected = () => Boolean(accessToken && Date.now() < expires)
export function disconnect() { accessToken = ''; expires = 0; authGeneration++ }
export function revoke() {
  if (accessToken && window.google?.accounts) window.google.accounts.oauth2.revoke(accessToken, () => {})
  disconnect()
}
export function loadGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true
    const timeout = setTimeout(() => { loading = null; reject(new Error('Google tarda en responder. Comprueba la conexión y reintenta.')) }, 15000)
    script.onload = () => { clearTimeout(timeout); resolve() }
    script.onerror = () => { clearTimeout(timeout); loading = null; script.remove(); reject(new Error('No se pudo cargar Google. Comprueba la conexión.')) }
    document.head.append(script)
  })
  return loading
}
export function authorize(clientId) {
  const generation = authGeneration
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) { reject(new Error('Primero pulsa Preparar Google.')); return }
    window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPES.join(' '), callback: response => {
      if (generation !== authGeneration) { reject(new Error('La agenda se ha bloqueado. Ábrela y conecta de nuevo Google.')); return }
      if (response.error || !response.access_token || !window.google.accounts.oauth2.hasGrantedAllScopes(response, ...SCOPES)) { disconnect(); reject(new Error('Google no ha concedido los permisos necesarios.')); return }
      accessToken = response.access_token; expires = Date.now() + (Number(response.expires_in) - 60) * 1000; resolve()
    }, error_callback: () => reject(new Error('No se completó la conexión con Google. Puedes reintentar.')) }).requestAccessToken({ prompt: 'select_account' })
  })
}
export async function api(path, options = {}) {
  if (!connected()) throw new Error('Conecta de nuevo Google en Ajustes; la autorización ha caducado o no existe.')
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...options, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) {
    if (res.status === 401) disconnect()
    const error = new Error(res.status === 401 ? 'La autorización de Google ha caducado. Vuelve a conectar.' : res.status === 403 ? 'Google ha denegado el acceso o se ha alcanzado la cuota. Revisa los permisos y reintenta más tarde.' : res.status === 429 ? 'Google ha limitado las peticiones. Espera un minuto y reintenta.' : `Google no completó la operación (${res.status}). Reintenta.`)
    error.status = res.status; throw error
  }
  return res.status === 204 ? null : res.json()
}
export async function listCalendars() {
  const items = []; let pageToken = ''
  do {
    const page = await api(`/users/me/calendarList?maxResults=250${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
    items.push(...(page.items || []).filter(c => c.accessRole === 'owner')); pageToken = page.nextPageToken
  } while (pageToken)
  return items
}
export function eventPayload(a) {
  const start = instant(a.date, a.time)
  return {
    summary: `Sesión · ${SERVICES[a.service].label}`,
    description: 'Gestionada con Frecuencia Oreka. Los datos del cliente y las notas permanecen en la app.',
    start: { dateTime: new Date(start).toISOString(), timeZone: 'Europe/Madrid' },
    end: { dateTime: new Date(start + Number(a.duration) * 60000).toISOString(), timeZone: 'Europe/Madrid' },
    location: a.location || '', visibility: 'private',
    colorId: { masaje: '2', tarot: '6', emocional: '3' }[a.service],
    extendedProperties: { private: { orekaId: a.id, orekaService: a.service } },
  }
}
export function remoteFields(a, event) {
  if (event.status === 'cancelled') return { ...a, status: 'cancelled', sync: 'synced', etag: event.etag || a.etag, remote: null, syncError: '' }
  if (!event.start?.dateTime || !event.end?.dateTime || event.recurrence || event.recurringEventId) throw new Error('La cita se convirtió en un evento de día completo o recurrente en Google. Corrígelo en Google antes de sincronizar.')
  const parts = madridParts(event.start.dateTime)
  const duration = (Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)) / 60000
  if (duration < 5 || duration > 480 || !Number.isInteger(duration)) throw new Error('La duración de Google debe estar entre 5 y 480 minutos.')
  instant(parts.date, parts.time)
  return { ...a, ...parts, duration, location: event.location || '', status: 'active', etag: event.etag, sync: 'synced', remote: null, syncError: '' }
}
// One linked resource at a time. Inject the transport for deterministic failure/retry tests.
export async function syncAppointment(a, request = api) {
  if (a.destination !== 'google' || a.sync === 'conflict') return a
  const root = `/calendars/${encodeURIComponent(a.calendarId)}/events`
  const id = a.eventId || `oreka${a.id}`
  const path = `${root}/${id}`
  let remote
  try { remote = await request(path) } catch (e) {
    if (![404, 410].includes(e.status)) throw e
    if (a.etag) remote = { status: 'cancelled' }
  }
  if (a.sync === 'synced') {
    if (!remote || remote.status === 'cancelled') return remoteFields(a, { status: 'cancelled' })
    return remote.etag === a.etag ? a : remoteFields(a, remote)
  }
  if (a.status === 'cancelled' && remote?.status === 'cancelled') return { ...a, eventId: id, sync: 'synced', syncError: '', remote: null }
  // A POST may have succeeded before a network failure. The stable event ID recovers it.
  if (!a.etag && remote) {
    if (remote.extendedProperties?.private?.orekaId !== a.id && remote.status !== 'cancelled') throw new Error('El identificador ya existe en Google. No se ha sobrescrito el evento.')
    return { ...a, eventId: id, etag: remote.etag || '', sync: 'conflict', remote, syncError: 'Google contiene una versión recuperada. Elige cuál conservar.' }
  }
  if (a.etag && remote?.etag !== a.etag) return { ...a, sync: 'conflict', remote: remote || { status: 'cancelled' }, syncError: 'La cita también cambió en Google. Elige la versión que deseas conservar.' }
  try {
    if (a.status === 'cancelled') {
      if (remote && remote.status !== 'cancelled') await request(path, { method: 'DELETE', headers: { 'If-Match': a.etag } })
      return { ...a, eventId: id, sync: 'synced', syncError: '' }
    }
    if (remote?.status === 'cancelled') return { ...a, sync: 'conflict', remote, syncError: 'La cita fue cancelada en Google. Puedes aceptar la cancelación.' }
    const payload = eventPayload(a)
    const saved = await request(a.etag ? path : root, { method: a.etag ? 'PATCH' : 'POST', headers: a.etag ? { 'If-Match': a.etag } : {}, body: JSON.stringify(a.etag ? payload : { ...payload, id }) })
    return { ...a, eventId: id, etag: saved.etag, sync: 'synced', syncError: '', remote: null }
  } catch (e) {
    if ([409, 412].includes(e.status)) return { ...a, sync: 'pending', syncError: 'La versión de Google cambió. Pulsa reintentar para revisarla.' }
    throw e
  }
}
