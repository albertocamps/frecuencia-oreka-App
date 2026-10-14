import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function agendaOffline() {
  return {
    name: 'agenda-offline',
    generateBundle(_, bundle) {
      const entry = Object.values(bundle).find(file => file.type === 'chunk' && file.isEntry && file.facadeModuleId?.replaceAll('\\', '/').endsWith('/index.html'))
      if (!entry) throw new Error('No se encuentra la entrada de la agenda para preparar el modo sin conexión.')
      const files = new Set(['/', '/index.html', '/manifest.webmanifest', '/icons/oreka-eye-192-v2.png', '/icons/oreka-eye-512-v2.png', '/icons/oreka-eye-maskable-v2.png', '/icons/oreka-eye-apple-v2.png', '/icons/oreka-eye-favicon-v2.png'])
      const visit = name => {
        if (files.has(`/${name}`)) return
        files.add(`/${name}`)
        const file = bundle[name]
        if (file?.type === 'chunk') {
          for (const dependency of [...file.imports, ...file.dynamicImports, ...(file.viteMetadata?.importedCss || []), ...(file.viteMetadata?.importedAssets || [])]) visit(dependency)
        }
      }
      visit(entry.fileName)
      const hash = createHash('sha256').update([...files].join('|'))
      for (const path of files) {
        const file = bundle[path.slice(1)]
        if (file) hash.update(file.type === 'chunk' ? file.code : file.source)
        else if (path !== '/' && !path.endsWith('.html')) hash.update(readFileSync(resolve(import.meta.dirname, 'public', path.slice(1))))
      }
      const version = hash.digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'oreka-agenda-${version}';
const FILES = ${JSON.stringify([...files])};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('oreka-agenda-') && k !== CACHE).map(k => caches.delete(k))))); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && url.pathname.startsWith('/')) {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html')))); return;
  }
  if (FILES.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});` })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), agendaOffline()],
})
