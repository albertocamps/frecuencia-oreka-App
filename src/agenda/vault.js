const DB = 'oreka-private-v1'
const encoder = new TextEncoder()
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
let dbPromise
function database() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('vault')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('No se puede abrir el almacenamiento del dispositivo.'))
  })
  return dbPromise
}
export async function readVault() {
  const db = await database()
  return new Promise((resolve, reject) => {
    const req = db.transaction('vault').objectStore('vault').get('main')
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(new Error('No se pueden leer tus datos.'))
  })
}
export async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(salt), iterations: 600000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)))
export async function encrypt(data, key, salt, revision) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)))
  // Chunk conversion avoids spreading a large client history onto the call stack.
  const parts = []; const raw = new Uint8Array(ciphertext)
  for (let i = 0; i < raw.length; i += 8192) parts.push(String.fromCharCode(...raw.subarray(i, i + 8192)))
  return { format: 'oreka-v1', salt, iv: b64(iv), ciphertext: btoa(parts.join('')), revision }
}
export async function decrypt(record, key) {
  if (record?.format !== 'oreka-v1') throw new Error('Formato de copia no compatible.')
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(record.iv) }, key, bytes(record.ciphertext))
  const data = JSON.parse(new TextDecoder().decode(raw))
  if (data.version !== 1 || !Array.isArray(data.clients) || !Array.isArray(data.appointments) || !data.settings) throw new Error('La copia no tiene un formato válido.')
  const isString = value => typeof value === 'string'
  const unique = list => new Set(list.map(item => item.id)).size === list.length
  if (!unique(data.clients) || !unique(data.appointments) || data.clients.some(c => !isString(c.id) || !/^[a-f0-9]{32}$/.test(c.id) || !isString(c.name) || !c.name.trim() || !isString(c.phone) || (c.email !== undefined && !isString(c.email)) || !isString(c.notes))) throw new Error('Las fichas de la copia no son válidas.')
  if (data.appointments.some(a => !/^[a-f0-9]{32}$/.test(a.id) || !data.clients.some(c => c.id === a.clientId) || !['masaje', 'tarot', 'emocional'].includes(a.service) || !['active', 'cancelled'].includes(a.status) || !['app', 'google'].includes(a.destination) || !isString(a.date) || !isString(a.time) || !isString(a.notes) || !isString(a.location) || !Number.isInteger(Number(a.duration)) || a.duration < 5 || a.duration > 480 || (a.destination === 'google' && (!isString(a.calendarId) || !a.calendarId)) || (a.eventId && !/^[a-v0-9]{5,1024}$/.test(a.eventId)))) throw new Error('Las citas de la copia no son válidas.')
  return data
}
export async function writeVault(record, expectedRevision) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite')
    const store = tx.objectStore('vault')
    const req = store.get('main')
    let stale = false
    req.onsuccess = () => {
      if ((req.result?.revision ?? 0) !== expectedRevision) { stale = true; tx.abort(); return }
      store.put(record, 'main')
    }
    tx.oncomplete = () => resolve(record)
    tx.onabort = tx.onerror = () => reject(new Error(stale ? 'Los datos cambiaron en otra pestaña. Bloquea y vuelve a abrir la agenda.' : 'No se ha guardado. Comprueba el espacio del dispositivo y reintenta.'))
  })
}
