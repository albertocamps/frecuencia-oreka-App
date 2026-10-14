# Frecuencia Oreka App

Aplicación móvil privada para gestionar clientes y citas de masajes, tarot y acompañamiento emocional.

Proyecto independiente de la web pública. Su carpeta es `D:\Frecuencia Oreka App`, con código, recursos, dependencias, Git y despliegue propios. No importa archivos de la web.

```powershell
npm install
npm run dev
```

Desarrollo: http://localhost:5174/

```powershell
npm test
npm run lint
npm run build
npm run preview
```

Vista de producción local: http://127.0.0.1:4174/

Consultar [la guía de arquitectura, instalación, privacidad e integraciones](docs/AGENDA-PRIVADA.md). Google Calendar requiere configurar el client ID público y autorizar la cuenta. ChatGPT no está conectado. No usar datos reales sin completar la validación móvil y las copias de seguridad.

La web de referencia conserva su repositorio, su despliegue y sus funciones informativas. Repositorio de código: https://github.com/albertocamps/frecuencia-oreka-App. Subir el código a GitHub no publica una app utilizable: el acceso desde el teléfono requiere un despliegue HTTPS independiente. Las fichas de clientes se almacenan cifradas en el dispositivo, fuera del repositorio.
## Probar en el móvil

Enlace privado de prueba: https://frecuencia-oreka-app.alberto-camps.chatgpt.site

Abrir con la misma cuenta de ChatGPT propietaria del proyecto. A continuación, crear una contraseña propia para cifrar la agenda en ese dispositivo. Usar primero datos ficticios hasta terminar la validación de voz, copias y Google Calendar. La app guarda los clientes localmente: no se comparten automáticamente entre teléfonos ni con la vista local del ordenador.

El alojamiento privado está declarado en `.openai/hosting.json`. La rama local `codex/sites-deployment` conserva el historial exacto del despliegue; `main` se sincroniza con el repositorio de GitHub. Para futuras publicaciones, partir del historial de despliegue e incorporar los cambios de `main`, compilar y publicar con Sites. No guardar credenciales en archivos. En Windows, el empaquetador necesita Bash de Git en PATH y `TAR_OPTIONS=--force-local`. Los archivos temporales de despliegue se mantienen ignorados en `.sites-runtime/`.