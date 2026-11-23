import './styles/main.css'
import './styles/app.css'
import './styles/scenes.css'
import { loadMe, me, sb } from './lib/api.js'
import { go, toast } from './lib/ui.js'
import { login, join, recover } from './app/auth.js'
import { home } from './app/home.js'
import { activity } from './app/activity.js'
import { work } from './app/work.js'
import { admin } from './app/admin.js'

// Dos modos en la misma página: el taller (subir y organizar) y la presentación (#/ver).
const routes = [
  { re: /^\/entrar$/, view: login, open: true },
  { re: /^\/unirse\/([^/]+)$/, view: join, open: true },
  { re: /^\/recuperar$/, view: recover, open: true },
  { re: /^\/$/, view: home },
  { re: /^\/a\/([^/]+)$/, view: activity },
  { re: /^\/t\/([^/]+)$/, view: work },
  { re: /^\/admin(?:\/(\w+))?$/, view: admin },
  { re: /^\/ver(?:\/([^/]+))?$/, view: (root, slug) => import('./show/show.js').then((m) => m.show(root, slug)) },
]

const root = document.getElementById('app')
let cleanup = null
let seq = 0

async function render() {
  const path = location.hash.replace(/^#/, '') || '/'
  const n = ++seq
  let hit = null
  const route = routes.find((r) => (hit = path.match(r.re)))
  if (!route) return go('/')
  if (!route.open && !me.user) {
    sessionStorage.setItem('liia.next', path)
    return go('/entrar')
  }
  try {
    cleanup?.()
  } catch (e) {
    console.error(e)
  }
  cleanup = null
  scrollTo(0, 0)
  try {
    const c = await route.view(root, ...hit.slice(1).map((v) => (v === undefined ? v : decodeURIComponent(v))))
    if (n !== seq) return c?.()
    cleanup = typeof c === 'function' ? c : null
  } catch (e) {
    console.error(e)
    toast(e.message || 'No se pudo cargar la página.', 'error')
  }
}

addEventListener('hashchange', render)
sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && !/^#\/(entrar|unirse|recuperar)/.test(location.hash)) go('/entrar')
})

const fonts = document.fonts
  ? Promise.all([document.fonts.load('800 16px Archivo'), document.fonts.load('500 16px "Martian Mono"')]).catch(() => {})
  : Promise.resolve()

// La demostración sustituye a Supabase por datos locales (solo con VITE_DEMO=1).
if (import.meta.env.VITE_DEMO) await import('./demo/mock.js')

Promise.all([loadMe(), fonts]).then(render)
