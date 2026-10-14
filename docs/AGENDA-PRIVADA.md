# Separación de proyectos

La app reside ahora en D:\Frecuencia Oreka App, con repositorio Git propio y remoto independiente https://github.com/albertocamps/frecuencia-oreka-App. La web D:\Frecuencia Oreka Web se ha restaurado a su estado anterior. La app se sirve en la raíz de su propio origen, no dentro de la web. Los datos del perfil de pruebas del origen anterior no se migran automáticamente. La aplicación aún no se ha desplegado en un alojamiento HTTPS.

# Mi espacio · Frecuencia Oreka

Versión local inicial, 14 de octubre de 2026. La web pública sigue siendo informativa, bilingüe y conserva WhatsApp. La aplicación de gestión tiene entrada propia en `/` y está íntegramente en español. No hay reservas de clientes ni pagos.

## Arquitectura elegida

PWA de React y Vite, con entrada HTML y CSS propios, en un repositorio completamente separado de la web. Reutiliza React, la fotografía original `home-hero-poster.jpg`, la paleta crema/salvia/terracota, tipografías serif y Poppins, superficies suaves y formas redondeadas. No importa los estilos de la web ni modifica sus páginas. El monograma del icono es un recurso vectorial nuevo inspirado en las formas orgánicas de la marca.

| Opción | Adecuación a este proyecto |
| --- | --- |
| PWA instalable, elegida | Una aplicación para Android/iPhone, instalación desde el navegador, trabajo local sin conexión y sin tienda. Las integraciones dependen del navegador; no ejecuta sincronización fiable en segundo plano. |
| Multiplataforma con Capacitor/React Native | Evolución adecuada si se necesita biometría, almacenamiento del sistema, dictado nativo o distribución privada por tiendas. Requiere empaquetado, firma y pruebas en ambos sistemas. |
| Nativa Swift/Kotlin | Mayor integración con cada sistema, pero dos implementaciones para una agenda personal. No aporta una ventaja suficiente en esta primera etapa. |

Los datos no pasan por un servidor propio. IndexedDB conserva un único documento cifrado con AES-GCM de 256 bits; la clave no exportable se deriva de la contraseña con PBKDF2-SHA-256, 600.000 iteraciones y sal aleatoria. Cada guardado usa un IV nuevo. La contraseña y las claves no se persisten. Los cambios se confirman en pantalla después de completar la escritura. Un control de revisión transaccional impide sobrescribir silenciosamente cambios de otra pestaña.

El acceso es un desbloqueo criptográfico local, **no una cuenta ni autenticación de servidor**. Para una única usuaria y un dispositivo evita guardar datos de clientes en la nube. No se comparten fichas ni citas locales entre dispositivos. Una futura sincronización multidispositivo necesita otra arquitectura y autenticación de cuenta; no se ha añadido un backend sin necesidad.

## Funciones disponibles

- Inicio con sesiones de hoy, próximas sesiones, contadores y accesos a Agendar y Añadir cliente.
- Crear, buscar, consultar y editar clientes; nombre, teléfono y observaciones opcionales, e historial de sesiones canceladas incluidas.
- Calendario por día, semana (desde lunes) y mes, navegación por fecha, tres colores con etiquetas de servicio.
- Crear y editar/reprogramar sesiones, cancelar con confirmación y mantener su historial. Cliente, servicio, fecha, hora, duración, ubicación y notas.
- Aviso de solapamiento, también cuando una sesión cruza medianoche; se puede confirmar expresamente un solapamiento.
- Horarios en Europe/Madrid con independencia de la zona del teléfono. Se rechazan horas inexistentes o repetidas en el cambio estacional para pedir otra hora.
- Agendar por texto; dictado Web Speech si el navegador lo admite y alternativa mediante el micrófono del teclado.
- Interpretación **local y limitada**, sin LLM: servicios conocidos, cliente por nombre o prefijo, alta de cliente nuevo dentro de la cita, hoy/mañana/pasado mañana, próximo día de semana, fechas DD/MM/AAAA, horas numéricas y algunas expresadas en palabras, minutos, media hora, una hora y una hora y media. «Próximo martes» significa la siguiente aparición, excluyendo hoy. Las fechas sin año, días sin referencia inequívoca, clientes duplicados, horas sin franja y datos ausentes se dejan para aclarar en el formulario. Frases más complejas se corrigen en el resumen.
- Resumen editable y confirmación explícita antes de guardar cualquier cita; nunca se guarda por el mero hecho de dictar.
- Copia de seguridad cifrada y restauración desde el acceso. No existe recuperación de contraseña.
- Bloqueo tras 5 minutos sin interacción o 1 minuto en segundo plano; bloqueo manual disponible. Si hay una escritura o petición en curso, termina esa operación antes de bloquear y no inicia más peticiones. Las peticiones tienen un límite de 20 segundos.
- Manifest, iconos Android/iPhone y service worker limitado a `/`. Solo almacena recursos públicos de la app, nunca respuestas de Google, grabaciones o datos personales en Cache Storage. Las fuentes externas tienen alternativas locales de sistema. La aplicación usa una caché versionada al compilar; una actualización se aplica al cerrar las pestañas anteriores y volver a abrir.

## Estado real de las integraciones

| Función | Implementación | Configuración/verificación pendiente |
| --- | --- | --- |
| Clientes y citas locales | Funcional y persistente, cifrado local | Elegir contraseña propia y guardar copias |
| Google OAuth y elección de calendario | Implementado con Google Identity Services | Proyecto y client ID de Google, origen autorizado, cuenta de prueba y prueba real |
| Google altas/cambios/cancelaciones | Transporte REST real, ID estable, ETag, pendientes y conflictos | Validación de extremo a extremo con cuenta autorizada; no realizada sin credenciales |
| Texto | Funcional sin servicios externos | Interpretación deliberadamente acotada; revisar los resultados |
| Voz | Implementado con API de reconocimiento del navegador y alternativa del teclado | Probar permisos y compatibilidad en el Android/iPhone concreto; no se ha probado un micrófono físico |
| ChatGPT con cuenta propia | Investigación realizada; no está conectado | Acceso/elegibilidad de OpenAI y arquitectura de autorización aprobada |
| Instalación móvil/offline | Manifest y caché de producción incluidos | Publicación HTTPS e instalación/prueba física en ambos teléfonos |

## Probar en este ordenador

Requiere Node 22.20 o compatible con la versión de Vite del proyecto.

```powershell
npm install
npm test
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

Abrir `http://127.0.0.1:4174/`. La web se ejecuta y publica desde su propio proyecto, con otro origen. Para trabajar con recarga en caliente: `npm run dev` y la misma ruta `/`. El service worker solo se registra en la compilación de producción, no en el servidor de desarrollo.

1. Crear una contraseña propia de 12 caracteres o más.
2. Añadir una ficha de prueba desde Clientes.
3. Agendar manualmente un masaje para hoy, revisar y confirmar; comprobarlo en Inicio, Día, Semana y Mes.
4. Abrir la cita y cambiar hora/duración. Intentar otra sesión que se solape: debe advertirlo antes de guardar.
5. Probar «Agenda un masaje para Ana el próximo martes a las cinco de la tarde durante una hora». Usar un cliente existente llamado Ana; revisar el resumen. Probar también dos clientes llamados Ana o una hora ambigua.
6. Cancelar una cita, activar «Mostrar también las canceladas» y consultar su historial en Clientes.
7. Descargar una copia desde Mi espacio, bloquear y abrir con la misma contraseña. La contraseña incorrecta no debe permitir acceso. Restaurar la copia en otro perfil de navegador con la contraseña original. Restaurar sobre datos existentes requiere confirmar su sustitución.
8. Probar sin red tras abrir la compilación al menos una vez y volver a cargarla. Los cambios locales deben seguir disponibles. No debe aparecer una sincronización de Google exitosa sin respuesta real.

Los datos de desarrollo etiquetados «prueba local» permanecen en el antiguo origen 127.0.0.1:4173 y no se precargan ni migran en esta app independiente. El nuevo origen 127.0.0.1:4174 empieza sin clientes ni contraseña: crear una contraseña propia para usarlo. No usar contraseñas de prueba con clientes reales.

## Instalar en Android e iPhone

Para el teléfono hace falta servir `dist` en HTTPS. Abrir `http://IP-del-PC` no ofrece el contexto seguro que necesitan el cifrado y el service worker; `localhost` solo es excepción en el propio dispositivo. No se ha publicado la app ni se ha contratado alojamiento.

- Android: abrir la URL HTTPS de `/` en Chrome y elegir Instalar aplicación/Añadir a pantalla de inicio.
- iPhone: abrir esa URL en Safari, Compartir → Añadir a pantalla de inicio.
- Abrir la app instalada con conexión una vez, cerrarla y volver a abrir para preparar el uso sin conexión.
- Instalar primero y crear después la agenda definitiva: los navegadores y las instalaciones pueden tener almacenes separados. Exportar y restaurar para trasladar datos.

Las reglas de Vercel y `_redirects` incluyen la entrada independiente de la agenda. Es preferible desplegar la app privada en **un origen separado de la web pública** para aislar su almacenamiento de scripts futuros de la web. El código de la app es público al servir los recursos; los datos de clientes siguen en el dispositivo y cifrados. `noindex` no es una medida de autenticación. Para proteger también el acceso a los recursos de la URL, configurar una puerta de acceso del alojamiento antes de publicarla.

## Configurar Google Calendar

No hace falta entregar contraseñas de Google, client secrets ni tokens al desarrollador. El **client ID es público**.

1. En un proyecto de Google Cloud para pruebas, activar Google Calendar API.
2. Configurar la pantalla de consentimiento con datos reales del propietario y añadir la cuenta de tu mujer como usuaria de prueba si el proyecto está en modo de pruebas. Revisar los requisitos de Google antes de producción.
3. Crear un cliente OAuth de tipo Aplicación web. Autorizar exactamente el origen de pruebas, por ejemplo `http://127.0.0.1:4174`, y posteriormente el origen HTTPS de instalación. No añadir `/` al origen. Este flujo usa popup y no requiere un client secret en la app.
4. Pegar su client ID en Mi espacio. Alternativamente, copiar `.env.example` a `.env.local`, rellenar `VITE_GOOGLE_CLIENT_ID` y recompilar. Nunca incluir secretos en variables `VITE_`, que se entregan al navegador.
5. Pulsar Preparar Google (descarga su biblioteca oficial), después Conectar con Google. La separación mantiene el popup ligado a un gesto del usuario.
6. Autorizar los scopes `calendar.events.owned` (gestionar eventos de calendarios propios) y `calendar.calendarlist.readonly` (listar calendarios). Solo se ofrecen calendarios de los que la cuenta es propietaria.
7. Elegir el calendario; se recomienda uno exclusivo para las sesiones. En las nuevas citas ya se podrá elegir App + Google Calendar.
8. Probar alta, cambio desde la app, reprogramación desde Google, cancelación desde ambos lados y fallo de red antes de usarlo con clientes reales.

El token de Google existe solo en memoria y se descarta al bloquear/recargar. Su caducidad obliga a conectar de nuevo; no se almacena refresh token. Conectar Google autoriza Calendar y no reemplaza el desbloqueo local. Desconectar revoca el token de la sesión si existe; también se puede retirar el acceso en la cuenta de Google. Las citas previamente vinculadas y las operaciones pendientes permanecen en la agenda.

Fuentes: [modelo de tokens de Google](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [políticas OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

## Contrato de sincronización

- **Alcance:** solo citas creadas/vinculadas desde esta agenda. No importa el resto de eventos de Google. La elección de calendario se guarda por cita; cambiar el calendario predeterminado no mueve citas anteriores.
- **Datos enviados:** servicio como título genérico, inicio, fin, ubicación opcional, color e identificador opaco. Visibilidad privada; sin asistentes, invitaciones, nombres, teléfonos, correos ni observaciones/notas de clientes. No usar ubicaciones sensibles si no se desea compartirlas con Google. Elegir un calendario privado; sus propietarios/delegados pueden ver los eventos.
- **Direcciones:** desde la app se crean/actualizan servicio, horario, duración y ubicación, o se cancela. Desde Google se reciben cambios de fecha/hora/duración/ubicación y cancelaciones. El cliente, servicio y notas se gestionan en la app; renombrar libremente el título en Google no cambia el servicio ni el cliente. Eventos de día completo, recurrentes, duraciones fuera de 5–480 minutos y horas ambiguas se marcan con error para corregirlos en Google, sin sustituir el horario válido local.
- **Cuándo:** tras guardar si hay conexión y token válido, al reintentar, al recuperar la red y aproximadamente cada minuto con app abierta, visible y desbloqueada. No hay webhooks ni sincronización con la app cerrada. La autorización caduca; la app no abre ventanas OAuth automáticamente.
- **Pendientes:** toda modificación se guarda cifrada antes de llamar a Google. Si falta red, token, permisos o Google falla, la copia local permanece. Se muestra pendiente o error de comprobación, según hubiera cambios locales o solo una lectura fallida. Reintentar conserva el mismo ID de evento; no crea eventos nuevos para reintentar una misma cita.
- **Prevención de duplicados:** ID de Google derivado del UUID local, estable y válido en base32hex. Antes de insertar se consulta ese ID. Si un POST pudo completarse antes de cortarse la conexión, el reintento recupera el evento y pide elegir versión, sin otro POST. Un 409/412 mantiene el pendiente para volver a leer. [Identificadores personalizados](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).
- **Conflicto:** si hay cambios locales pendientes y el ETag remoto cambió, no se sobrescribe Google. La cita ofrece Conservar Google o Conservar la app. Esta última actualiza condicionalmente con `If-Match` y la versión remota revisada. Un cambio remoto posterior vuelve a generar conflicto. Si Google canceló la sesión, se acepta su cancelación y se crea una nueva si se quiere recuperar. [Versiones y ETags](https://developers.google.com/workspace/calendar/api/guides/version-resources).
- **Cancelaciones:** se conservan en el historial, no se borran las fichas. DELETE condicional en Google para cancelaciones locales. Una cancelación ya procesada se reconoce al reintentar. Si Google elimina una cita sin cambios locales pendientes, se marca cancelada en la app; con cambios locales, requiere resolver el conflicto.
- **Errores:** mensajes legibles para autorización caducada, permisos/cuota, timeout y fallos de red. Reintento manual, sin bucle rápido de peticiones. Se revisa aproximadamente cada minuto mientras esté abierta. Con un historial muy grande conviene sustituir la consulta por recurso por una sincronización incremental paginada; no se ha añadido un servidor solo para ello.
- **Solapamientos:** se avisa al editar manualmente frente a las citas de esta app. Los movimientos recibidos de Google pueden introducir solapamientos; hay que revisar la agenda después de sincronizar. No se consulta disponibilidad de otros calendarios.

## ChatGPT, voz y costes

Verificación con documentación oficial consultada el 14/10/2026:

- La documentación actual de **Sign in with ChatGPT** sí permite, con elegibilidad y permisos adecuados, usar planes ChatGPT para determinadas solicitudes. No es válido concluir que cualquier login habilite esa capacidad. La integración de sitios web/comercial está limitada a participantes admitidos; el flujo documentado de aplicaciones abiertas/locales requiere registro OAuth, identificador de host persistente, PKCE, validación de identidad y protección de credenciales. Esta PWA privada no se declara elegible ni muestra un botón de conexión ficticio. [Acceso y requisitos](https://developers.openai.com/siwc/quickstart), [aplicaciones abiertas/locales](https://developers.openai.com/siwc/token-sharing-open-source).
- El permiso de uso del plan es independiente de la identidad. No da acceso al contexto de cuenta ni reutiliza las conexiones de Calendar de ChatGPT. El flujo documentado no admite transcripción/audio ni conectores alojados; aun si se habilitara la interpretación de texto con el plan, voz y autorización de Google seguirían siendo integraciones distintas. [Limitaciones vigentes](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
- Alternativa implementada: reconocimiento del navegador o dictado del teclado → texto → interpretación local → aclaraciones necesarias → resumen → confirmación → persistencia → resultado real de Google. Funciona sin pagar una API de IA. La compatibilidad del reconocimiento y su necesidad de red varían; algunos navegadores envían audio al proveedor. La app lo explica antes de abrir el micrófono. [Web Speech y compatibilidad](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
- Si se desea interpretación más flexible, una evolución viable es una pequeña pasarela autenticada con la API de OpenAI, clave guardada solo en servidor, datos mínimos, límites de uso y presupuesto explícito. Se cobraría el consumo de texto y, si se eligiera transcripción de OpenAI en lugar del dictado del dispositivo, también el audio, además del alojamiento. No se ha añadido ni activado ese servicio; antes de hacerlo se debe elegir proveedor/modelo, comprobar tarifas actuales, calcular un presupuesto y aprobarlo.
- **Costes añadidos en esta versión: ninguno contratado.** Sin dependencia de API de IA de pago ni cuotas de tiendas. El alojamiento HTTPS dependerá del proveedor y su plan; no se ha contratado. El dictado del sistema puede requerir conexión y consumir datos móviles.
- Google documenta uso estándar de Calendar API sin coste adicional; los proyectos nuevos tienen cuotas y un umbral diario antes de futuros cargos por exceso. A fecha de consulta la guía indica 1.000.000 solicitudes/día/proyecto y anuncia detalles de facturación posteriores en 2026. No se solicita aumento de cuota ni se activa facturación. Revisar la consola y las condiciones antes de producción. [Cuotas y precios oficiales](https://developers.google.com/workspace/calendar/api/guides/quota).

## Verificación y límites

`npm test` cubre interpretación con ambigüedades, calendario, validación, Madrid/cambios estacionales, solapamientos, minimización de datos, inserción y actualización, cancelaciones, conflictos, recuperación tras respuesta incierta, errores, y cifrado/contraseña incorrecta/manipulación. Las pruebas de Calendar **usan transporte inyectado**, no una cuenta de Google ni una sincronización real. `npm run build` genera la app independiente y la caché de la PWA; `npm run lint` revisa el proyecto.

Guardar copias fuera del dispositivo y proteger también el teléfono. El cifrado local protege datos en reposo; no protege frente a scripts maliciosos en el mismo origen cuando está desbloqueado, extensiones con permisos amplios, capturas de pantalla o un dispositivo comprometido. No equivale a una auditoría ni certificación de cumplimiento. Las notas se han dejado opcionales para minimizar información personal.

Antes de dar por cerrada la puesta en servicio: comprobar instalación y dictado en teléfonos físicos, probar el modo avión, descargar/restaurar una copia real y completar la validación con Google autorizado. No se ha realizado un despliegue de la aplicación en un alojamiento HTTPS.

## Estado de validación

La app compila desde su carpeta independiente; sus 21 pruebas y ESLint pasan con dependencias propias. La web compila por separado y se retiraron todas las incorporaciones de la app de su repositorio.

En navegador se comprobaron el acceso inicial, alta de cliente, cita manual con resumen y confirmación, aparición en el calendario mensual y ancho móvil de 390 px. Quedan pendientes la instalación y dictado en teléfonos físicos, modo avión, recorrido completo de restauración y conexión con una cuenta real de Google.

El código se mantiene en el repositorio independiente `albertocamps/frecuencia-oreka-App`. El repositorio no contiene fichas, copias de seguridad, tokens ni claves privadas. GitHub almacena el código; la app necesita su propio despliegue HTTPS para abrirse desde un teléfono fuera del equipo de desarrollo.
## Alta de cliente al agendar

El formulario de cita permite elegir Cliente existente o Nuevo cliente. Para alguien nuevo solo se piden nombre, teléfono y notas opcionales. El resumen revisa también esos datos. Cliente y cita se guardan juntos en una única escritura cifrada al confirmar; cerrar el formulario no crea fichas. Si el teléfono ya existe, se indica qué cliente debe elegirse. El correo ya no se solicita ni se utiliza en la búsqueda. Las bóvedas y copias anteriores siguen abriéndose aunque contengan el antiguo campo opcional de correo. El dictado o texto para un nombre nuevo prepara su nombre y pide el teléfono en este mismo flujo.
