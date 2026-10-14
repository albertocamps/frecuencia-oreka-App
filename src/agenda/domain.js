export const SERVICES = {
  masaje: { label: 'Masaje', mark: '✺', color: 'sage' },
  tarot: { label: 'Tarot', mark: '✧', color: 'clay' },
  emocional: { label: 'Acompañamiento emocional', mark: '♡', color: 'lavender' },
}
export const emptyData = () => ({ version: 1, clients: [], appointments: [], settings: { calendarId: '', calendarName: '', clientId: '' } })
export const uid = () => crypto.randomUUID().replaceAll('-', '')
export const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export const dayShift = (key, days) => dateKey(new Date(new Date(`${key}T12:00:00Z`).getTime() + days * 86400000))
export const formatDay = (key, options = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...options }).format(new Date(`${key}T12:00:00Z`))
export function madridParts(value) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(p => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}
// Resolve wall-clock time in Madrid, independent of the phone's time zone. Reject DST gaps and folds.
export function instant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Revisa la fecha y la hora.')
  const base = Date.parse(`${date}T${time}:00Z`)
  const matches = [0, 1, 2].map(h => base - h * 3600000).filter(ms => {
    const p = madridParts(ms)
    return p.date === date && p.time === time
  })
  if (matches.length !== 1) throw new Error('Esta hora coincide con un cambio de horario. Elige otra hora.')
  return matches[0]
}
export function overlaps(a, b) {
  if (a.id === b.id || a.status === 'cancelled' || b.status === 'cancelled') return false
  const x = instant(a.date, a.time), y = instant(b.date, b.time)
  return x < y + Number(b.duration) * 60000 && y < x + Number(a.duration) * 60000
}
export function validateAppointment(a, data) {
  if (!data.clients.some(c => c.id === a.clientId)) throw new Error('Selecciona un cliente.')
  if (!SERVICES[a.service]) throw new Error('Selecciona el servicio.')
  instant(a.date, a.time)
  if (!Number.isInteger(Number(a.duration)) || a.duration < 5 || a.duration > 480) throw new Error('La duración debe estar entre 5 y 480 minutos.')
  if (a.destination === 'google' && !a.calendarId) throw new Error('Elige primero un calendario en Ajustes.')
}
export function prepareClient(draft) {
  const name = typeof draft.name === 'string' ? draft.name.trim() : ''
  const phone = typeof draft.phone === 'string' ? draft.phone.trim() : ''
  const notes = typeof draft.notes === 'string' ? draft.notes.trim() : ''
  if (!name || name.length > 120) throw new Error('Indica el nombre del cliente.')
  if (phone.length < 6 || phone.length > 30 || phone.replace(/\D/g, '').length < 6) throw new Error('Indica un teléfono válido para el cliente.')
  if (notes.length > 2000) throw new Error('Las notas del cliente son demasiado largas.')
  return { id: draft.id || uid(), name, phone, notes }
}
export function prepareAppointmentSave(data, draft) {
  const { newClient, ...fields } = draft
  let clients = data.clients
  if (newClient) {
    const client = prepareClient(newClient)
    const digits = phone => phone.replace(/\D/g, '').replace(/^00/, '')
    const existing = clients.find(c => digits(c.phone) === digits(client.phone))
    if (existing) throw new Error('Ya existe un cliente con ese teléfono: ' + existing.name + '. Elígelo en Cliente existente.')
    clients = [...clients, client]
    fields.clientId = client.id
  }
  validateAppointment(fields, { ...data, clients })
  const appointment = { ...fields, duration: Number(fields.duration), updatedAt: new Date().toISOString(), sync: fields.destination === 'google' ? 'pending' : 'local', syncError: '' }
  return { appointment, data: { ...data, clients, appointments: [...data.appointments.filter(a => a.id !== appointment.id), appointment] } }
}
export function calendarDays(date, view) {
  if (view === 'day') return [date]
  const d = new Date(`${date}T12:00:00Z`)
  if (view === 'week') return Array.from({ length: 7 }, (_, i) => dayShift(date, i - ((d.getUTCDay() + 6) % 7)))
  const first = `${date.slice(0, 7)}-01`
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => dayShift(first, i - offset))
}
const numbers = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 }
export function parseRequest(text, clients, today = dateKey()) {
  const s = normalize(text)
  const draft = { service: /masaj/.test(s) ? 'masaje' : /tarot/.test(s) ? 'tarot' : /acompanamiento|emocional/.test(s) ? 'emocional' : '', date: '', time: '', duration: '', clientId: '' }
  const questions = []
  const name = s.match(/(?:para|con)\s+(.+?)(?=\s+(?:el|hoy|manana|pasado|a las?|durante|de\s+\d)|[,.;]|$)/)?.[1]?.trim()
  const candidates = name ? clients.filter(c => normalize(c.name) === name || normalize(c.name).startsWith(`${name} `)) : []
  if (candidates.length === 1) draft.clientId = candidates[0].id
  else if (candidates.length > 1) questions.push(`Hay varios clientes llamados ${name}. Elige cuál.`)
  else if (name) {
    const spokenName = text.match(/(?:para|con)\s+(.+?)(?=\s+(?:el|hoy|mañana|manana|pasado|a las?|durante|de\s+\d)|[,.;]|$)/i)?.[1]?.trim() || name
    draft.newClient = { name: spokenName, phone: '', notes: '' }
    questions.push('Indica el teléfono del nuevo cliente; se guardará junto con la cita.')
  } else questions.push('Elige un cliente existente o añade uno nuevo aquí.')
  if (/pasado manana/.test(s)) draft.date = dayShift(today, 2)
  else if (/\bmanana\b/.test(s.replace(/de la manana/g, ''))) draft.date = dayShift(today, 1)
  else if (/\bhoy\b/.test(s)) draft.date = today
  const explicit = s.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/)
  if (explicit) {
    if (explicit[3]) draft.date = `${explicit[3]}-${explicit[2].padStart(2, '0')}-${explicit[1].padStart(2, '0')}`
    else questions.push('Indica el año de la fecha.')
  }
  const weekdays = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const weekday = weekdays.findIndex(w => new RegExp(`\\b${w}\\b`).test(s))
  if (weekday >= 0 && !draft.date) {
    if (/proximo|que viene/.test(s)) {
      const delta = (weekday - new Date(`${today}T12:00:00Z`).getUTCDay() + 7) % 7 || 7
      draft.date = dayShift(today, delta)
    } else questions.push('Confirma la fecha exacta del día de la semana indicado.')
  }
  const time = s.match(/a (?:las|la)\s+(\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?::(\d{2})|\s+y\s+(media|cuarto))?(?:\s+de la\s+(manana|tarde|noche))?/)
  if (time) {
    let h = Number(time[1]) || numbers[time[1]]
    const m = time[2] || (time[3] === 'media' ? '30' : time[3] === 'cuarto' ? '15' : '00')
    if (h < 12 && /tarde|noche/.test(time[4])) h += 12
    if (h === 12 && time[4] === 'manana') h = 0
    if (h >= 0 && h <= 23 && Number(m) < 60 && (h > 12 || time[4] || time[1] === '0' || time[1] === '00')) draft.time = `${String(h).padStart(2, '0')}:${m}`
    else questions.push('Confirma la hora: ¿por la mañana o por la tarde?')
  }
  if (/una hora y media/.test(s)) draft.duration = 90
  else if (/media hora/.test(s)) draft.duration = 30
  else if (/una hora/.test(s)) draft.duration = 60
  else {
    const dur = s.match(/(?:durante|duracion de)\s+(\d+|dos|tres)\s+(minutos?|horas?)/)
    if (dur) draft.duration = (Number(dur[1]) || numbers[dur[1]]) * (dur[2].startsWith('hora') ? 60 : 1)
  }
  if (!draft.service) questions.push('Elige el servicio.')
  if (!draft.date && !questions.some(q => /fecha/.test(q))) questions.push('Indica la fecha.')
  if (!draft.time && !questions.some(q => /hora:/.test(q))) questions.push('Indica la hora.')
  if (!draft.duration) questions.push('Indica la duración.')
  return { draft, questions, candidates }
}
