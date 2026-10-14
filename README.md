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