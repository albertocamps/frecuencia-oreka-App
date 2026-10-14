import { useCallback, useEffect, useRef, useState } from 'react'
import hero from '../assets/home-hero-poster.jpg'
import { calendarDays, dateKey, dayShift, emptyData, formatDay, normalize, overlaps, parseRequest, SERVICES, uid, validateAppointment } from './domain.js'
import { decrypt, deriveKey, encrypt, newSalt, readVault, writeVault } from './vault.js'
import * as google from './google.js'

function Icon({ name, size = 22 }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-12 5h6m-3-3v6" /></>,
    clients: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" /></>,
    settings: <><circle cx="12" cy="8" r="3" /><path d="M4 21v-3a8 8 0 0 1 16 0v3M3 3h4m-2-2v4m12 7h4m-2-2v4" /></>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    lock: <><rect x="5" y="10" width="14" height="12" rx="3" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    edit: <><path d="m4 16 12-12 4 4L8 20l-5 1Zm10-10 4 4" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.calendar}</svg>
}
function Brand() { return <div className="brand"><span className="brand-symbol" aria-hidden="true">❋</span><span>frecuencia oreka<small>MI ESPACIO</small></span></div> }
function Field({ label, children, ...props }) { return <label className="field" {...props}><span>{label}</span>{children}</label> }
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return <dialog ref={ref} className={wide ? 'wide' : ''} onCancel={e => { e.preventDefault(); onClose() }} aria-labelledby="dialog-title"><div className="modal-head"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>×</button></div>{children}</dialog>
}
function Gate({ record, onOpen, notify }) {
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [busy, setBusy] = useState(false), [backup, setBackup] = useState(null)
  const target = backup || record
  async function unlock(e) {
    e.preventDefault(); setBusy(true)
    try {
      if (!crypto.subtle) throw new Error('Abre la agenda con HTTPS o en localhost para proteger los datos.')
      if (!target && password !== repeat) throw new Error('Las contraseñas no coinciden.')
      const salt = target?.salt || newSalt(), key = await deriveKey(password, salt)
      let data
      try { data = target ? await decrypt(target, key) : emptyData() } catch { throw new Error('Contraseña incorrecta o copia dañada. No se ha modificado ningún dato.') }
      const revision = record?.revision || 0
      if (!record || backup) {
        if (record && !window.confirm('Restaurar sustituirá los datos locales por esta copia. Conserva antes una copia de los datos actuales. ¿Continuar?')) return
        await writeVault(await encrypt(data, key, salt, revision + 1), revision)
      }
      navigator.storage?.persist?.().catch(() => {})
      onOpen({ data, key, salt, revision: !record || backup ? revision + 1 : revision })
    } catch (e) { notify(e.message) } finally { setBusy(false) }
  }
  async function importBackup(e) {
    try {
      const file = e.target.files[0]
      if (!file) return
      if (file.size > 20 * 1024 * 1024) throw new Error('La copia es demasiado grande (máximo 20 MB).')
      const value = JSON.parse(await file.text())
      if (value.format !== 'oreka-v1' || typeof value.salt !== 'string' || typeof value.ciphertext !== 'string') throw new Error('Esta copia no es compatible.')
      setBackup(value); setPassword(''); notify('Copia seleccionada. Introduce la contraseña con la que se creó.')
    } catch (error) { notify(error.message) }
  }
  return <div className="gate"><section className="gate-photo" style={{ backgroundImage: `linear-gradient(180deg,rgba(35,48,39,.15),rgba(35,48,39,.85)),url(${hero})` }}><Brand /><div><p className="eyebrow light">CUIDAR TAMBIÉN ES ORGANIZAR</p><h1>Un espacio para<br />tu día a día.</h1><p>Tus clientes, tus sesiones.<br />Todo en su lugar, a tu ritmo.</p></div><span className="photo-foot">Frecuencia Oreka · Donostia</span></section><section className="gate-form"><span className="seal"><Icon name="lock" size={28} /></span><p className="eyebrow">TU AGENDA PRIVADA</p><h2>{target ? 'Bienvenida de nuevo' : 'Empezamos con calma'}</h2><p>{backup ? 'Abre tu copia cifrada para restaurarla en este dispositivo.' : record ? 'Desbloquea tu espacio para continuar.' : 'Crea una contraseña de al menos 12 caracteres para proteger tu agenda en este dispositivo.'}</p><form onSubmit={unlock}><Field label="Contraseña"><input autoFocus type="password" autoComplete={target ? 'current-password' : 'new-password'} minLength={target ? 1 : 12} required value={password} onChange={e => setPassword(e.target.value)} /></Field>{!target && <Field label="Repite la contraseña"><input type="password" autoComplete="new-password" required value={repeat} onChange={e => setRepeat(e.target.value)} /></Field>}<button className="primary full" disabled={busy}>{busy ? 'Abriendo tu espacio…' : target ? backup ? 'Restaurar y abrir' : 'Abrir mi espacio' : 'Crear mi agenda'}<Icon name="arrow" size={18} /></button></form><p className="small">Los datos se cifran en este dispositivo. Guarda la contraseña: no se puede recuperar. Exporta copias desde Ajustes; borrar los datos del navegador elimina la agenda.</p><label className="file-button">Restaurar una copia cifrada<input type="file" accept=".json,application/json" onChange={importBackup} disabled={busy} /></label>{backup && <button className="text-button" onClick={() => setBackup(null)}>Volver</button>}</section></div>
}
function AppointmentCard({ a, clients, onEdit, compact = false }) {
  const service = SERVICES[a.service] || SERVICES.masaje
  return <button className={`appointment ${service.color} ${a.status === 'cancelled' ? 'cancelled' : ''}`} onClick={() => onEdit(a)}><span className="appointment-time">{a.time}<small>{a.duration} min</small></span><span className="appointment-line" /><span className="appointment-body"><strong>{clients.find(c => c.id === a.clientId)?.name || 'Cliente no disponible'}</strong><span>{service.label}</span>{!compact && <small>{formatDay(a.date, { day: 'numeric', month: 'short' })}{a.location ? ` · ${a.location}` : ''}</small>}<span className={`sync-label ${a.sync === 'conflict' || a.sync === 'pending' ? 'attention' : ''}`}>{a.status === 'cancelled' ? 'Cancelada · ' : ''}{a.destination !== 'google' ? 'Solo en la app' : a.syncError && a.sync === 'synced' ? 'Google: no se pudo comprobar' : a.sync === 'synced' ? '✓ Google sincronizado' : a.sync === 'conflict' ? 'Revisar conflicto' : '◷ Pendiente de Google'}</span></span><Icon name="arrow" size={16} /></button>
}
function ClientForm({ client, data, onSave, onClose, onAppointment }) {
  const [draft, setDraft] = useState(client || { name: '', phone: '', email: '', notes: '' })
  const change = (key, value) => setDraft({ ...draft, [key]: value })
  return <Modal title={client ? 'Ficha de cliente' : 'Añadir cliente'} onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave({ ...draft, name: draft.name.trim(), phone: draft.phone.trim() }) }}><Field label="Nombre y apellidos"><input autoFocus required maxLength={120} value={draft.name} onChange={e => change('name', e.target.value)} /></Field><Field label="Teléfono"><input required type="tel" inputMode="tel" minLength={6} maxLength={30} value={draft.phone} onChange={e => change('phone', e.target.value)} /></Field><Field label="Correo electrónico · opcional"><input type="email" maxLength={150} value={draft.email} onChange={e => change('email', e.target.value)} /></Field><Field label="Observaciones · opcional"><textarea rows={3} maxLength={2000} value={draft.notes} onChange={e => change('notes', e.target.value)} placeholder="Solo lo necesario para atender a esta persona." /></Field><p className="small">Evita incluir información médica o íntima innecesaria. Esta ficha permanece en el dispositivo.</p><button className="primary full">Guardar cliente</button></form>{client && <section className="history"><h3>Historial de citas</h3>{data.appointments.filter(a => a.clientId === client.id).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).map(a => <AppointmentCard key={a.id} a={a} clients={data.clients} onEdit={onAppointment} />)}{!data.appointments.some(a => a.clientId === client.id) && <p className="small">Aún no hay sesiones con esta persona.</p>}</section>}</Modal>
}
function AppointmentForm({ initial, data, onSave, onClose, onResolve, questions = [] }) {
  const [draft, setDraft] = useState(() => ({ id: uid(), clientId: '', service: 'masaje', date: dateKey(), time: '', duration: 60, location: '', notes: '', destination: 'app', status: 'active', ...initial }))
  const [review, setReview] = useState(false), [error, setError] = useState(''), [allowOverlap, setAllowOverlap] = useState(false), [cancel, setCancel] = useState(false)
  const change = (key, value) => { setDraft({ ...draft, [key]: value }); setReview(false); setAllowOverlap(false) }
  let collisions = []
  try { collisions = data.appointments.filter(a => overlaps(draft, a)) } catch { /* Empty date/time is handled by validation. */ }
  const linked = Boolean(initial?.destination === 'google' && initial?.calendarId)
  const client = data.clients.find(c => c.id === draft.clientId)
  function submit(e) {
    e.preventDefault()
    try {
      validateAppointment(draft, data)
      if (collisions.length && !allowOverlap) throw new Error('Esta cita coincide con otra. Revisa el horario o confirma el solapamiento.')
      if (!review) { setError(''); setReview(true); return }
      onSave(draft)
    } catch (err) { setError(err.message) }
  }
  return <Modal title={review ? 'Revisa tu cita' : initial?.eventId || data.appointments.some(a => a.id === draft.id) ? 'Tu sesión' : 'Agendar una sesión'} onClose={onClose}>
    {initial?.sync === 'conflict' && <div className="notice"><strong>Hay dos versiones de esta cita</strong><p>{initial.syncError}</p><p>En la app: {formatDay(initial.date)}, {initial.time} · {initial.duration} min.</p><p>En Google: {initial.remote?.status === 'cancelled' ? 'Cancelada' : `${initial.remote?.start?.dateTime || 'Sin hora'} · ${initial.remote?.location || 'Sin ubicación'}`}.</p><div className="actions"><button onClick={() => onResolve(initial, 'google')}>Conservar Google</button>{initial.remote?.status !== 'cancelled' && <button onClick={() => onResolve(initial, 'local')}>Conservar la app</button>}</div><p className="small">Si Google la canceló, acepta la cancelación y crea una cita nueva para recuperarla.</p></div>}
    {initial?.syncError && initial.sync !== 'conflict' && <p className="notice">{initial.syncError}</p>}
    {questions.length > 0 && !review && <div className="notice"><strong>Solo falta aclarar esto:</strong><ul>{questions.map(q => <li key={q}>{q}</li>)}</ul></div>}
    <form onSubmit={submit}>
      {review ? <><div className={`review-card ${SERVICES[draft.service].color}`}><span className="service-symbol">{SERVICES[draft.service].mark}</span><h3>{client?.name}</h3><p>{SERVICES[draft.service].label}</p><p>{formatDay(draft.date)}<br /><strong>{draft.time} · {draft.duration} minutos</strong></p><p>{draft.location || 'Sin ubicación indicada'}</p><p>{draft.destination === 'google' ? `App + Google Calendar · ${draft.calendarName || draft.calendarId}` : 'Solo en esta app'}</p>{draft.notes && <p className="small">Notas privadas: {draft.notes}</p>}</div><button type="button" className="text-button" onClick={() => setReview(false)}><Icon name="edit" size={16} /> Editar resumen</button></> : <>
        <Field label="Cliente"><select required autoFocus value={draft.clientId} onChange={e => change('clientId', e.target.value)}><option value="">Elige una persona</option>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></Field>{!data.clients.length && <p className="notice">Añade primero un cliente desde la pestaña Clientes.</p>}
        <Field label="Servicio"><select required value={draft.service} onChange={e => change('service', e.target.value)}><option value="">Elige un servicio</option>{Object.entries(SERVICES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}</select></Field>
        <div className="form-row"><Field label="Fecha"><input required type="date" value={draft.date} onChange={e => change('date', e.target.value)} /></Field><Field label="Hora · Madrid"><input required type="time" value={draft.time} onChange={e => change('time', e.target.value)} /></Field></div>
        <Field label="Duración en minutos"><input required type="number" min={5} max={480} step={1} value={draft.duration} onChange={e => change('duration', Number(e.target.value))} /></Field><Field label="Ubicación · opcional"><input maxLength={200} value={draft.location} onChange={e => change('location', e.target.value)} /></Field><Field label="Notas privadas · opcional"><textarea rows={2} maxLength={2000} value={draft.notes} onChange={e => change('notes', e.target.value)} /></Field>
        <Field label="Guardar en"><select value={draft.destination} disabled={linked} onChange={e => setDraft({ ...draft, destination: e.target.value, calendarId: data.settings.calendarId, calendarName: data.settings.calendarName })}><option value="app">Solo en la app</option><option value="google" disabled={!data.settings.calendarId}>App + Google Calendar{data.settings.calendarName ? ` · ${data.settings.calendarName}` : ' · configura Ajustes'}</option></select></Field>{linked && <p className="small">Vinculada a {draft.calendarName || draft.calendarId}. Sus cambios y cancelaciones se enviarán a ese calendario.</p>}
      </>}
      {collisions.length > 0 && <div className="notice"><strong>Coincide con {collisions.length} cita{collisions.length !== 1 ? 's' : ''}</strong>{collisions.map(a => <p key={a.id}>{a.time} · {data.clients.find(c => c.id === a.clientId)?.name} · {a.duration} min</p>)}<label className="check"><input type="checkbox" checked={allowOverlap} onChange={e => setAllowOverlap(e.target.checked)} /> Quiero guardar igualmente</label></div>}
      {error && <p className="error" role="alert">{error}</p>}<button className="primary full" disabled={initial?.sync === 'conflict'}>{review ? 'Confirmar y guardar cita' : 'Revisar cita'}</button>
    </form>
    {data.appointments.some(a => a.id === draft.id) && initial.sync !== 'conflict' && <div className="cancel-section">{initial.status === 'cancelled' ? <p className="small">Esta cita está cancelada. Crea una nueva sesión para volver a agendarla.</p> : cancel ? <><p>¿Cancelar esta sesión? Se conservará en el historial{linked ? ' y se cancelará también en Google al sincronizar' : ''}.</p><div className="actions"><button className="danger" onClick={() => onSave({ ...initial, status: 'cancelled' })}>Sí, cancelar sesión</button><button onClick={() => setCancel(false)}>Volver</button></div></> : <button className="text-button danger-text" onClick={() => setCancel(true)}>Cancelar esta cita</button>}</div>}
  </Modal>
}
function Composer({ clients, service, onPrepared, onClose }) {
  const [mode, setMode] = useState(''), [text, setText] = useState(''), [listening, setListening] = useState(false), [message, setMessage] = useState('')
  const speech = useRef(null)
  useEffect(() => () => { speech.current?.abort() }, [])
  const support = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  function dictate() {
    if (listening) { speech.current?.stop(); return }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) { setMessage('Usa el micrófono del teclado del móvil para dictar en el campo de texto.'); return }
    const recognition = new Recognition(); speech.current = recognition
    recognition.lang = 'es-ES'; recognition.interimResults = false; recognition.continuous = false
    recognition.onresult = e => setText(e.results[0][0].transcript)
    recognition.onstart = () => { setListening(true); setMessage('Te escucho…') }
    recognition.onend = () => { setListening(false); setMessage('Revisa el texto antes de preparar la cita.') }
    recognition.onerror = e => { setListening(false); setMessage(e.error === 'not-allowed' ? 'No hay permiso de micrófono. Puedes activarlo en el navegador o usar el teclado.' : 'No se pudo completar el dictado. Puedes escribir o usar el micrófono del teclado.') }
    try { recognition.start() } catch { setMessage('No se pudo iniciar el micrófono. Usa el teclado.') }
  }
  return <Modal title="¿Cómo quieres agendar?" onClose={onClose}><p className="muted">Cuéntame la sesión y revisamos los detalles juntas.</p><div className="compose-choices"><button className={mode === 'text' ? 'selected' : ''} onClick={() => { setMode('text'); speech.current?.abort() }}><Icon name="edit" /><strong>Escribir la cita</strong><small>Con tus propias palabras</small></button><button className={mode === 'voice' ? 'selected' : ''} onClick={() => setMode('voice')}><Icon name="mic" /><strong>Dictar la cita por voz</strong><small>Habla con naturalidad</small></button></div>{mode && <><p className="example">“Agenda un {service ? SERVICES[service].label.toLowerCase() : 'masaje'} para Ana el próximo martes a las cinco de la tarde durante una hora”.</p>{mode === 'voice' && <><p className="small">El dictado puede enviar el audio al proveedor de voz del navegador o del sistema. La app no guarda grabaciones. Pulsa el micrófono solo si estás de acuerdo.</p><button className={`voice-button ${listening ? 'listening' : ''}`} onClick={dictate}><Icon name="mic" />{listening ? 'Terminar dictado' : support ? 'Iniciar dictado' : 'Cómo dictar con el teclado'}</button></>}<form onSubmit={e => { e.preventDefault(); speech.current?.abort(); onPrepared(parseRequest(text, clients)) }}><Field label="Tu solicitud"><textarea autoFocus rows={4} value={text} onChange={e => setText(e.target.value)} required maxLength={1500} placeholder="Servicio, cliente, fecha, hora y duración…" /></Field><p className="small" role="status">{message || 'Interpretación local de frases sencillas. No utiliza ChatGPT ni tiene coste de IA.'}</p><button className="primary full" disabled={listening}>Preparar cita</button></form></>}<button className="text-button full" onClick={() => onPrepared({ draft: { service: service || 'masaje' }, questions: [], manual: true })}>Prefiero rellenar el formulario</button></Modal>
}
function Calendar({ data, onEdit, onNew }) {
  const [view, setView] = useState('week'), [date, setDate] = useState(dateKey()), [showCancelled, setShowCancelled] = useState(false)
  const days = calendarDays(date, view)
  const appointments = data.appointments.filter(a => showCancelled || a.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time))
  function move(direction) {
    if (view !== 'month') { setDate(dayShift(date, direction * (view === 'week' ? 7 : 1))); return }
    const value = new Date(`${date.slice(0, 7)}-01T12:00:00Z`); value.setUTCMonth(value.getUTCMonth() + direction); setDate(dateKey(value))
  }
  return <><div className="page-title"><div><p className="eyebrow">UN TIEMPO PARA CADA PERSONA</p><h1>Tu agenda</h1></div><button className="primary" onClick={() => onNew(date)}><Icon name="plus" />Nueva cita</button></div><section className="panel"><div className="calendar-toolbar"><div className="segmented" aria-label="Vista del calendario">{[['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([id, label]) => <button key={id} aria-pressed={view === id} className={view === id ? 'selected' : ''} onClick={() => setView(id)}>{label}</button>)}</div><div className="actions"><button className="icon-button" onClick={() => move(-1)} aria-label="Periodo anterior">‹</button><button onClick={() => setDate(dateKey())}>Hoy</button><button className="icon-button" onClick={() => move(1)} aria-label="Periodo siguiente">›</button></div></div><Field label="Ir a una fecha"><input type="date" required value={date} onChange={e => { if (e.target.value) setDate(e.target.value) }} /></Field><h2 className="calendar-heading">{formatDay(date, { month: 'long', year: 'numeric' })}</h2><div className="legend">{Object.values(SERVICES).map(s => <span key={s.label} className={s.color}><i />{s.label}</span>)}</div><div className={`calendar-grid ${view}`}>{days.map(day => { const items = appointments.filter(a => a.date === day); return <section key={day} className={`calendar-day ${day === dateKey() ? 'today' : ''} ${day.slice(0, 7) !== date.slice(0, 7) && view === 'month' ? 'outside' : ''}`}><button className="day-heading" onClick={() => { setDate(day); setView('day') }} aria-label={`Ver ${formatDay(day)}`}><span>{formatDay(day, { weekday: 'short' })}</span><strong>{day.slice(-2)}</strong></button>{view === 'month' ? <div className="month-sessions">{items.slice(0, 3).map(a => <button key={a.id} className={`month-session ${SERVICES[a.service].color}`} onClick={() => onEdit(a)} aria-label={`${a.time}, ${SERVICES[a.service].label}, ${data.clients.find(c => c.id === a.clientId)?.name}`}><i />{a.time}</button>)}{items.length > 3 && <small>+{items.length - 3}</small>}</div> : <>{items.map(a => <AppointmentCard key={a.id} a={a} clients={data.clients} onEdit={onEdit} compact />)}{items.length === 0 && <p className="day-empty">Tiempo disponible</p>}<button className="add-day" onClick={() => onNew(day)} aria-label={`Añadir cita el ${formatDay(day)}`}><Icon name="plus" size={16} />Añadir</button></>}</section> })}</div><label className="check"><input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} /> Mostrar también las canceladas</label></section><p className="small">Todos los horarios se muestran en la zona Europe/Madrid.</p></>
}
function Settings({ data, onSettings, onSync, onBackup, onLock, notify }) {
  const [clientId, setClientId] = useState(data.settings.clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''), [calendars, setCalendars] = useState([]), [ready, setReady] = useState(Boolean(window.google?.accounts?.oauth2)), [working, setWorking] = useState(false)
  async function prepare() { setWorking(true); try { await google.loadGoogle(); setReady(true) } catch (e) { notify(e.message) } finally { setWorking(false) } }
  async function connect() {
    setWorking(true)
    try { await google.authorize(clientId); const list = await google.listCalendars(); setCalendars(list); await onSettings({ ...data.settings, clientId }); notify(list.length ? 'Google conectado. Elige tu calendario.' : 'No hay calendarios propios disponibles en esta cuenta.') } catch (e) { notify(e.message) } finally { setWorking(false) }
  }
  return <><div className="page-title"><div><p className="eyebrow">A TU MANERA</p><h1>Tu espacio, cuidado</h1></div></div><div className="settings-grid"><section className="panel"><span className="eyebrow">CONEXIONES</span><h2>Google Calendar</h2><p className="connection"><i className={google.connected() ? 'online-dot' : ''} />{google.connected() ? 'Cuenta conectada en esta sesión' : 'Cuenta sin conectar'}</p><p>Elige en cada cita si quieres guardarla también en Google. Los teléfonos, correos, nombres y notas de clientes se quedan aquí. El servicio, horario y ubicación sí se envían a Google.</p><Field label="Identificador público OAuth de Google"><input value={clientId} placeholder="…apps.googleusercontent.com" onChange={e => setClientId(e.target.value.trim())} /></Field><p className="small">Requiere configurar Google Cloud, activar Calendar API y autorizar el origen de esta app. No introduzcas contraseñas ni secretos. Consulta la guía incluida en el proyecto.</p><div className="actions"><button onClick={prepare} disabled={working}>Preparar Google</button><button className="primary" disabled={!ready || !clientId || working} onClick={connect}>{working ? 'Conectando…' : 'Conectar con Google'}</button></div>{calendars.length > 0 && <Field label="Calendario para las nuevas citas"><select value={data.settings.calendarId} onChange={e => { const c = calendars.find(c => c.id === e.target.value); if (c) onSettings({ ...data.settings, clientId, calendarId: c.id, calendarName: c.summary }) }}><option value="">Elige un calendario propio</option>{calendars.map(c => <option key={c.id} value={c.id}>{c.summary}</option>)}</select></Field>}{data.settings.calendarId && <p className="small">Calendario elegido: <strong>{data.settings.calendarName}</strong>. Las citas ya vinculadas conservan su calendario original.</p>}<div className="actions"><button onClick={onSync} disabled={!google.connected()}>Sincronizar ahora</button><button onClick={() => { google.revoke(); setCalendars([]); notify('Acceso de esta sesión desconectado. Las citas pendientes se conservan.') }}>Desconectar Google</button></div></section><section className="panel"><span className="eyebrow">PRIVACIDAD</span><h2>Solo en tu dispositivo</h2><p>Agenda protegida con tu contraseña y cifrado AES-GCM. Se bloquea tras 5 minutos sin actividad y tras un minuto en segundo plano.</p><p>No hay una cuenta en la nube ni copia automática de clientes. Guarda una copia cifrada después de los cambios importantes. Se restaura desde la pantalla de acceso usando su contraseña original.</p><button className="primary full" onClick={onBackup}>Descargar copia cifrada</button><button className="text-button full" onClick={onLock}><Icon name="lock" size={18} />Bloquear mi espacio</button></section><section className="panel"><span className="eyebrow">INSTALACIÓN</span><h2>Siempre a mano</h2><p><strong>Android:</strong> abre la URL HTTPS en Chrome y elige «Instalar aplicación» o «Añadir a pantalla de inicio».</p><p><strong>iPhone:</strong> abre la URL HTTPS en Safari, pulsa Compartir y «Añadir a pantalla de inicio».</p><p className="small">Clientes y agenda funcionan sin conexión una vez descargada la app. Cada navegador o instalación tiene sus propios datos. No uses el modo privado.</p></section><section className="panel"><span className="eyebrow">AGENDAR CON VOZ</span><h2>Con tus palabras</h2><p>Dictado del navegador cuando es compatible, o micrófono del teclado. Después, interpretación local y resumen editable. No se guarda audio.</p><p className="small">ChatGPT no está conectado. Su uso mediante cuenta propia exige autorización y elegibilidad específicas de OpenAI; no da acceso a tus conexiones de Google. Esta versión no activa servicios de IA de pago.</p></section></div><section className="panel sync-help"><h2>Cómo se sincroniza</h2><p>Solo se consultan las citas vinculadas, al guardar, al reintentar, al recuperar conexión y cada minuto mientras la app está abierta y Google autorizado. Con la app cerrada o bloqueada no se sincroniza.</p><p>Sin conexión o con errores, la cita se guarda localmente como pendiente. Los cambios simultáneos requieren elegir una versión. Una cancelación recibida de Google se conserva en el historial. Reintentar reutiliza el identificador de la cita para evitar duplicados.</p><p className="small">No se importan otros eventos de Google ni se comprueba su disponibilidad. Los avisos de solapamiento comparan las citas de esta app.</p></section></>
}
export default function Agenda() {
  const [boot, setBoot] = useState({ loading: true, record: null }), [session, setSession] = useState(null), [page, setPage] = useState('home'), [modal, setModal] = useState(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [query, setQuery] = useState(''), [online, setOnline] = useState(navigator.onLine)
  const current = useRef(null), working = useRef(false), syncRef = useRef(null), pendingLock = useRef(false)
  const notify = useCallback(message => setNotice(message), [])
  useEffect(() => { readVault().then(record => setBoot({ loading: false, record })).catch(e => { setBoot({ loading: false, error: e.message }); notify(e.message) }) }, [notify])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const unavailable = () => notify('No se pudo preparar el modo sin conexión. Mantén la conexión y vuelve a abrir la app.')
    window.addEventListener('online', update); window.addEventListener('offline', update); window.addEventListener('oreka-offline-unavailable', unavailable)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('oreka-offline-unavailable', unavailable) }
  }, [notify])
  const lock = useCallback(async () => {
    if (working.current) { pendingLock.current = true; return }
    google.disconnect(); current.current = null; setSession(null); setModal(null); setPage('home'); setQuery(''); setNotice(''); setBoot({ loading: true, record: null })
    try { setBoot({ loading: false, record: await readVault() }) } catch (e) { setBoot({ loading: false, error: e.message }) }
  }, [])
  const unlocked = Boolean(session)
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [page, unlocked])
  useEffect(() => {
    if (!unlocked) return
    let idle, hidden
    const activity = () => { clearTimeout(idle); idle = setTimeout(lock, 300000) }
    const visibility = () => { clearTimeout(hidden); if (document.hidden) hidden = setTimeout(lock, 60000); else activity() }
    activity(); document.addEventListener('pointerdown', activity); document.addEventListener('keydown', activity); document.addEventListener('visibilitychange', visibility)
    return () => { clearTimeout(idle); clearTimeout(hidden); document.removeEventListener('pointerdown', activity); document.removeEventListener('keydown', activity); document.removeEventListener('visibilitychange', visibility) }
  }, [unlocked, lock])
  async function commit(data) {
    const s = current.current
    if (!s) throw new Error('Abre la agenda para continuar.')
    const revision = s.revision + 1
    const record = await encrypt(data, s.key, s.salt, revision)
    await writeVault(record, s.revision)
    const next = { ...s, data, revision }; current.current = next; setSession(next)
    return data
  }
  async function run(action) {
    if (working.current) return
    working.current = true; setBusy(true)
    try { await action() } catch (e) { notify(e.message || 'No se ha podido completar la operación.') } finally {
      working.current = false; setBusy(false)
      if (pendingLock.current) { pendingLock.current = false; lock() }
    }
  }
  async function syncAll(id, quiet = false) {
    if (!navigator.onLine || !google.connected()) { if (!quiet) notify('Las citas siguen guardadas en la app. Conecta Google en Ajustes y reintenta.'); return }
    const list = current.current.data.appointments.filter(a => a.destination === 'google' && (!id || a.id === id))
    let failed = 0, conflicts = 0
    for (const original of list) {
      if (pendingLock.current) break
      let a
      try { a = await google.syncAppointment(original) } catch (error) { a = { ...original, sync: original.sync === 'synced' ? 'synced' : 'pending', syncError: error.message }; failed++ }
      if (a.sync === 'conflict') conflicts++
      if (JSON.stringify(a) !== JSON.stringify(original)) await commit({ ...current.current.data, appointments: current.current.data.appointments.map(item => item.id === a.id ? a : item) })
    }
    if (!quiet || failed || conflicts) notify(failed ? 'La cita está guardada en la app. Google no pudo completar la sincronización; revisa el aviso y reintenta.' : conflicts ? 'Hay un conflicto con Google. Abre la cita para elegir qué versión conservar.' : list.some(a => current.current.data.appointments.find(b => b.id === a.id)?.sync === 'pending') ? 'Guardado en la app. Sigue pendiente de Google; pulsa reintentar.' : 'Google Calendar comprobado: las citas vinculadas están sincronizadas.')
  }
  useEffect(() => { syncRef.current = () => { if (current.current && !working.current && google.connected() && !document.hidden) run(() => syncAll(null, true)) } })
  useEffect(() => {
    const timer = setInterval(() => syncRef.current?.(), 60000)
    const online = () => syncRef.current?.()
    window.addEventListener('online', online)
    return () => { clearInterval(timer); window.removeEventListener('online', online) }
  }, [])
  async function saveAppointment(draft) {
    const data = current.current.data
    validateAppointment(draft, data)
    const a = { ...draft, duration: Number(draft.duration), updatedAt: new Date().toISOString(), sync: draft.destination === 'google' ? 'pending' : 'local', syncError: '' }
    await commit({ ...data, appointments: [...data.appointments.filter(item => item.id !== a.id), a] }); setModal(null)
    notify(a.destination === 'google' ? 'Cita guardada en la app. Pendiente de sincronizar con Google.' : a.status === 'cancelled' ? 'Cita cancelada. Se conserva en el historial.' : 'Tu cita está guardada en la app.')
    if (a.destination === 'google' && navigator.onLine && google.connected()) await syncAll(a.id)
  }
  async function resolve(a, choice) {
    const resolved = choice === 'google' ? google.remoteFields(a, a.remote) : { ...a, etag: a.remote.etag, sync: 'pending', syncError: '', remote: null }
    await commit({ ...current.current.data, appointments: current.current.data.appointments.map(item => item.id === a.id ? resolved : item) }); setModal(null)
    notify(choice === 'google' ? 'Se ha conservado la versión de Google.' : 'Versión de la app guardada. Pendiente de Google.')
    if (choice === 'local') await syncAll(a.id)
  }
  async function backup() {
    const record = await readVault()
    const url = URL.createObjectURL(new Blob([JSON.stringify(record)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `oreka-copia-${dateKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
    notify('Copia cifrada preparada para descargar. Comprueba que se ha guardado y conserva su contraseña.')
  }
  const edit = a => setModal({ type: 'appointment', initial: a })
  const composer = service => setModal({ type: 'composer', service })
  if (boot.loading) return <div className="loading" role="status">Preparando tu espacio…</div>
  if (boot.error) return <div className="loading"><p role="alert">{boot.error}</p><button onClick={() => window.location.reload()}>Reintentar</button></div>
  const data = session?.data
  const active = data?.appointments.filter(a => a.status !== 'cancelled') || []
  const today = dateKey(), todayItems = active.filter(a => a.date === today).sort((a, b) => a.time.localeCompare(b.time))
  const upcoming = active.filter(a => a.date > today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 5)
  const pending = data?.appointments.filter(a => a.destination === 'google' && (a.sync !== 'synced' || a.syncError)) || []
  return <>{!session ? <Gate record={boot.record} notify={notify} onOpen={s => { current.current = s; setSession(s); setNotice('') }} /> : <div className="app-shell"><aside className="sidebar"><Brand /><p className="sidebar-greeting">Un poco de orden.<br /><em>Más espacio para cuidar.</em></p><nav aria-label="Navegación principal">{[['home', 'Inicio', 'home'], ['calendar', 'Agenda', 'calendar'], ['clients', 'Clientes', 'clients'], ['settings', 'Mi espacio', 'settings']].map(([id, label, icon]) => <button key={id} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)} disabled={busy}><Icon name={icon} /><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><span><Icon name="lock" size={15} /> Espacio privado</span><button onClick={lock}>Bloquear</button></div></aside><div className="workspace"><header className="topbar"><div className="mobile-brand"><Brand /></div><span className="desktop-date">{formatDay(today)}</span><span className="connection"><i className={online ? 'online-dot' : ''} />{online ? 'Datos en este dispositivo' : 'Sin conexión · guardado local'}</span><button className="icon-button" onClick={lock} aria-label="Bloquear agenda"><Icon name="lock" size={18} /></button></header><main id="agenda-main"><fieldset disabled={busy} className="app-controls">
      {pending.length > 0 && <div className="sync-banner"><span><strong>{pending.length} cita{pending.length !== 1 ? 's' : ''} por revisar con Google</strong><small>Los cambios locales están guardados.</small></span><button onClick={() => run(() => syncAll())}>Reintentar</button></div>}
      {page === 'home' && <><div className="page-title"><div><p className="eyebrow">TU DÍA, CON CALMA</p><h1>Hola, Crystal<span className="title-flower"> ✺</span></h1><p className="muted">Un espacio para organizarte y seguir cuidando.</p></div><button className="primary schedule-main" onClick={() => composer()}><Icon name="calendar" />Agendar</button></div><section className="welcome-banner" style={{ backgroundImage: `linear-gradient(90deg,rgba(37,54,43,.91),rgba(37,54,43,.33)),url(${hero})` }}><div><p className="eyebrow light">FRECUENCIA OREKA · MI AGENDA</p><h2>Cuidar de tu tiempo<br />también es cuidarte.</h2><p>{todayItems.length ? `Hoy tienes ${todayItems.length} sesión${todayItems.length !== 1 ? 'es' : ''}. Todo está aquí.` : 'Hoy tienes espacio para lo que venga.'}</p></div><span className="banner-flower" aria-hidden="true">❋</span></section><div className="stats"><div><strong>{todayItems.length.toString().padStart(2, '0')}</strong><span>sesiones hoy</span></div><div><strong>{active.filter(a => a.date >= today && a.date <= dayShift(today, 6)).length.toString().padStart(2, '0')}</strong><span>en los próximos 7 días</span></div><div><strong>{data.clients.length.toString().padStart(2, '0')}</strong><span>clientes en tu espacio</span></div></div><div className="home-columns"><section><div className="section-title"><div><p className="eyebrow">{formatDay(today, { day: 'numeric', month: 'long' })}</p><h2>Las sesiones de hoy</h2></div><button className="text-button" onClick={() => setPage('calendar')}>Ver agenda <Icon name="arrow" size={16} /></button></div>{todayItems.map(a => <AppointmentCard key={a.id} a={a} clients={data.clients} onEdit={edit} compact />)}{!todayItems.length && <div className="empty"><span>☀</span><h3>Un día por escribir</h3><p>Cuando agendes una sesión para hoy,<br />la encontrarás aquí.</p><button onClick={() => setModal({ type: 'appointment', initial: { date: today } })}><Icon name="plus" size={18} />Añadir una cita</button></div>}<div className="section-title upcoming-title"><h2>Próximas sesiones</h2></div>{upcoming.map(a => <AppointmentCard key={a.id} a={a} clients={data.clients} onEdit={edit} />)}{!upcoming.length && <p className="small">Las próximas sesiones aparecerán aquí al agendarlas.</p>}</section><aside className="quick-panel"><p className="eyebrow">A UN SOLO TOQUE</p><h2>¿Qué necesitas?</h2>{Object.entries(SERVICES).map(([id, s]) => <button key={id} className="quick-service" onClick={() => composer(id)}><span className={`service-icon ${s.color}`}>{s.mark}</span><span>Agendar {s.label.toLowerCase()}</span><Icon name="arrow" size={15} /></button>)}<button className="quick-service" onClick={() => setModal({ type: 'client' })}><span className="service-icon cream"><Icon name="clients" /></span><span>Añadir cliente</span><Icon name="plus" size={17} /></button><div className="gentle-note"><span>✧</span><p>Cada encuentro merece<br />su propio espacio.</p></div></aside></div></>}
      {page === 'calendar' && <Calendar data={data} onEdit={edit} onNew={date => setModal({ type: 'appointment', initial: { date } })} />}
      {page === 'clients' && <><div className="page-title"><div><p className="eyebrow">PERSONAS QUE CONFÍAN EN TI</p><h1>Tus clientes</h1><p className="muted">Lo necesario para acompañarles mejor.</p></div><button className="primary" onClick={() => setModal({ type: 'client' })}><Icon name="plus" />Añadir cliente</button></div><section className="panel"><Field label="Buscar por nombre, teléfono o correo"><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Busca una persona…" /></Field><p className="small">{data.clients.length} clientes · datos guardados solo en este dispositivo</p><div className="client-grid">{data.clients.filter(c => normalize(`${c.name} ${c.phone} ${c.email}`).includes(normalize(query))).sort((a, b) => a.name.localeCompare(b.name, 'es')).map(c => <button key={c.id} className="client-card" onClick={() => setModal({ type: 'client', client: c })}><span className="avatar">{c.name.slice(0, 1).toUpperCase()}</span><span><strong>{c.name}</strong><small>{c.phone}</small><small>{data.appointments.filter(a => a.clientId === c.id).length} sesiones en el historial</small></span><Icon name="arrow" size={16} /></button>)}</div>{!data.clients.length ? <div className="empty"><Icon name="clients" size={35} /><h3>Todo empieza con una persona</h3><p>Añade tu primer cliente para agendar una sesión.</p></div> : !data.clients.some(c => normalize(`${c.name} ${c.phone} ${c.email}`).includes(normalize(query))) && <p>No hay coincidencias. Prueba otro nombre o teléfono.</p>}</section></>}
      {page === 'settings' && <Settings data={data} onSettings={settings => run(() => commit({ ...current.current.data, settings }))} onSync={() => run(() => syncAll())} onBackup={() => run(backup)} onLock={lock} notify={notify} />}
      {modal?.type === 'client' && <ClientForm client={modal.client} data={data} onClose={() => setModal(null)} onAppointment={edit} onSave={draft => run(async () => { if (!draft.name || draft.phone.length < 6) throw new Error('Revisa el nombre y teléfono.'); const id = draft.id || uid(); await commit({ ...current.current.data, clients: [...current.current.data.clients.filter(c => c.id !== id), { ...draft, id }] }); setModal(null); notify('Ficha de cliente guardada.') })} />}
      {modal?.type === 'composer' && <Composer clients={data.clients} service={modal.service} onClose={() => setModal(null)} onPrepared={result => setModal({ type: 'appointment', initial: { ...(result.manual ? {} : { date: '', time: '', duration: '' }), ...result.draft }, questions: result.questions })} />}
      {modal?.type === 'appointment' && <AppointmentForm key={modal.initial?.id || 'new'} initial={modal.initial} data={data} questions={modal.questions} onClose={() => setModal(null)} onSave={draft => run(() => saveAppointment(draft))} onResolve={(a, choice) => run(() => resolve(a, choice))} />}
    </fieldset></main><footer className="app-footer">Frecuencia Oreka <span>·</span> Tu tiempo, en equilibrio.</footer></div></div>}{busy && <div className="busy-status" role="status">Guardando y comprobando…</div>}{notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button></div>}</>
}
