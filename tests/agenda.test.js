import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarDays, dayShift, emptyData, instant, madridParts, overlaps, parseRequest, validateAppointment } from '../src/agenda/domain.js'
import { eventPayload, remoteFields, syncAppointment } from '../src/agenda/google.js'
import { decrypt, deriveKey, encrypt, newSalt } from '../src/agenda/vault.js'

const clients = [{ id: 'ana', name: 'Ana García', phone: '600000000' }]
const appointment = (extra = {}) => ({ id: 'abcd1234abcd1234abcd1234abcd1234', clientId: 'ana', service: 'masaje', date: '2026-10-20', time: '17:00', duration: 60, status: 'active', destination: 'google', calendarId: 'calendar@example.test', sync: 'pending', ...extra })
const remote = extra => ({ etag: 'v1', status: 'confirmed', start: { dateTime: '2026-10-20T15:00:00Z' }, end: { dateTime: '2026-10-20T16:00:00Z' }, ...extra })
const missing = () => { const e = new Error('Missing'); e.status = 404; throw e }

test('texto del ejemplo prepara la fecha, cliente, hora y duración correctos', () => {
  const result = parseRequest('Agenda un masaje para Ana el próximo martes a las cinco de la tarde durante una hora', clients, '2026-10-14')
  assert.deepEqual(result.draft, { service: 'masaje', date: '2026-10-20', time: '17:00', duration: 60, clientId: 'ana' })
  assert.deepEqual(result.questions, [])
})
test('no adivina el cliente duplicado ni la franja horaria', () => {
  const result = parseRequest('Tarot para Ana el martes a las cinco', [...clients, { id: '2', name: 'Ana López' }], '2026-10-14')
  assert.equal(result.draft.clientId, ''); assert.equal(result.draft.time, ''); assert.equal(result.draft.date, '')
  assert.equal(result.questions.length, 4)
})
test('comprende mañana, minutos y horas y media; no confunde de la mañana con mañana', () => {
  assert.equal(parseRequest('Masaje para Ana mañana a las 17:30 durante 45 minutos', clients, '2026-10-14').draft.duration, 45)
  const result = parseRequest('Masaje para Ana hoy a las nueve de la mañana durante una hora y media', clients, '2026-10-14')
  assert.equal(result.draft.date, '2026-10-14'); assert.equal(result.draft.time, '09:00'); assert.equal(result.draft.duration, 90)
})
test('fechas incompletas requieren año, cliente inexistente requiere selección', () => {
  const result = parseRequest('Tarot para Rosa el 20/10 a las 17 durante 30 minutos', clients, '2026-10-14')
  assert.equal(result.draft.date, ''); assert.equal(result.draft.clientId, '')
  assert.ok(result.questions.some(q => q.includes('año')))
})
test('Madrid independiente del sistema y cambio de mes', () => {
  assert.equal(new Date(instant('2026-10-20', '17:00')).toISOString(), '2026-10-20T15:00:00.000Z')
  assert.equal(new Date(instant('2026-12-20', '17:00')).toISOString(), '2026-12-20T16:00:00.000Z')
  assert.equal(dayShift('2026-12-31', 1), '2027-01-01')
})
test('rechaza horas inexistentes, duplicadas y fechas inválidas', () => {
  assert.throws(() => instant('2026-03-29', '02:30'))
  assert.throws(() => instant('2026-10-25', '02:30'))
  assert.throws(() => instant('2026-02-30', '17:00'))
})
test('solapamiento incluye cruce de medianoche pero admite sesiones consecutivas', () => {
  assert.equal(overlaps(appointment(), appointment({ id: '2', time: '17:30' })), true)
  assert.equal(overlaps(appointment(), appointment({ id: '2', time: '18:00' })), false)
  assert.equal(overlaps(appointment({ time: '23:30' }), appointment({ id: '2', date: '2026-10-21', time: '00:15' })), true)
  assert.equal(overlaps(appointment(), appointment({ id: '2', status: 'cancelled' })), false)
})
test('valida cliente, duración y calendario antes de guardar', () => {
  const data = { ...emptyData(), clients }
  assert.doesNotThrow(() => validateAppointment(appointment(), data))
  for (const extra of [{ clientId: 'unknown' }, { duration: 0 }, { duration: 60.5 }, { calendarId: '' }, { service: 'unknown' }]) assert.throws(() => validateAppointment(appointment(extra), data))
})
test('calendario con semana desde lunes y 42 celdas de mes', () => {
  assert.deepEqual(calendarDays('2026-10-14', 'day'), ['2026-10-14'])
  assert.equal(calendarDays('2026-10-14', 'week')[0], '2026-10-12')
  assert.equal(calendarDays('2026-10-14', 'month').length, 42)
})
test('Google no recibe nombre, teléfono, correo ni notas', () => {
  const payload = eventPayload(appointment({ notes: 'información privada', location: 'Donostia' }))
  const json = JSON.stringify(payload)
  assert.ok(!json.includes('información privada')); assert.ok(!json.includes('600000000')); assert.ok(!json.includes('García'))
  assert.equal(payload.start.dateTime, '2026-10-20T15:00:00.000Z'); assert.equal(payload.visibility, 'private')
})
test('inserción real usa id estable y el calendario guardado', async () => {
  const calls = []
  const a = await syncAppointment(appointment(), async (path, options) => { calls.push({ path, options }); if (!options) return missing(); return remote({ id: JSON.parse(options.body).id }) })
  assert.equal(a.sync, 'synced'); assert.equal(a.eventId, `oreka${a.id}`)
  assert.match(calls[1].path, /calendar%40example.test/); assert.equal(calls[1].options.method, 'POST')
})
test('retry tras POST incierto recupera la misma cita sin otro POST', async () => {
  let calls = 0
  const a = appointment()
  const result = await syncAppointment(a, async () => { calls++; return remote({ extendedProperties: { private: { orekaId: a.id } } }) })
  assert.equal(calls, 1); assert.equal(result.sync, 'conflict'); assert.equal(result.eventId, `oreka${a.id}`)
})
test('actualización condicional conserva identificador y usa If-Match', async () => {
  const result = await syncAppointment(appointment({ etag: 'v1' }), async (_, options) => {
    if (!options) return remote()
    assert.equal(options.method, 'PATCH'); assert.equal(options.headers['If-Match'], 'v1'); return remote({ etag: 'v2' })
  })
  assert.equal(result.etag, 'v2'); assert.equal(result.sync, 'synced')
})
test('cambios simultáneos devuelven conflicto sin sobrescribir Google', async () => {
  let calls = 0
  const result = await syncAppointment(appointment({ etag: 'v1' }), async () => { calls++; return remote({ etag: 'v2' }) })
  assert.equal(result.sync, 'conflict'); assert.equal(calls, 1)
})
test('412 de Google conserva pendiente para reintento', async () => {
  const result = await syncAppointment(appointment({ etag: 'v1' }), async (_, options) => {
    if (!options) return remote()
    const e = new Error('Precondition failed'); e.status = 412; throw e
  })
  assert.equal(result.sync, 'pending'); assert.ok(result.syncError)
})
test('Google cambia fecha, hora y duración de cita vinculada', async () => {
  const result = await syncAppointment(appointment({ etag: 'v1', sync: 'synced' }), async () => remote({ etag: 'v2', start: { dateTime: '2026-10-21T16:30:00Z' }, end: { dateTime: '2026-10-21T18:00:00Z' } }))
  assert.equal(result.date, '2026-10-21'); assert.equal(result.time, '18:30'); assert.equal(result.duration, 90)
})
test('cancelación en Google se refleja en el historial local', async () => {
  const result = await syncAppointment(appointment({ sync: 'synced', etag: 'v1' }), async () => missing())
  assert.equal(result.status, 'cancelled'); assert.equal(result.sync, 'synced')
})
test('cancelación local usa DELETE condicional y retry ya cancelado es idempotente', async () => {
  const a = appointment({ etag: 'v1', status: 'cancelled' })
  const result = await syncAppointment(a, async (_, options) => {
    if (!options) return remote()
    assert.equal(options.method, 'DELETE'); assert.equal(options.headers['If-Match'], 'v1'); return null
  })
  assert.equal(result.sync, 'synced')
  const retry = await syncAppointment(a, async () => ({ status: 'cancelled' }))
  assert.equal(retry.sync, 'synced')
})
test('errores de red no se convierten en éxito y app-only no toca la red', async () => {
  await assert.rejects(() => syncAppointment(appointment(), async () => { throw new Error('offline') }), /offline/)
  assert.equal((await syncAppointment(appointment({ destination: 'app' }), async () => assert.fail())).destination, 'app')
})
test('eventos de día completo no sustituyen una sesión válida', () => {
  assert.throws(() => remoteFields(appointment(), remote({ start: { date: '2026-10-20' } })), /día completo/)
  assert.deepEqual(madridParts('2026-12-20T16:30:00Z'), { date: '2026-12-20', time: '17:30' })
})
test('copia cifrada se abre con contraseña correcta y detecta contraseña incorrecta o manipulación', async () => {
  const salt = newSalt(), key = await deriveKey('contraseña privada de prueba', salt)
  const data = { ...emptyData(), clients: [{ id: 'abcd1234abcd1234abcd1234abcd1234', name: 'Ana García', phone: '600000000', email: '', notes: '' }] }
  const record = await encrypt(data, key, salt, 1)
  assert.ok(!JSON.stringify(record).includes('García'))
  assert.deepEqual(await decrypt(record, key), data)
  const wrong = await deriveKey('otra contraseña', salt)
  await assert.rejects(() => decrypt(record, wrong))
  await assert.rejects(() => decrypt({ ...record, ciphertext: `AAAA${record.ciphertext.slice(4)}` }, key))
})
