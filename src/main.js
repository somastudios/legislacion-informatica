import gsap from 'gsap'
import './styles/main.css'
import './styles/scenes.css'
import { createDeck } from './core/deck.js'
import { createDot } from './core/dot.js'
import { createHud } from './core/hud.js'

import { C } from './content/es.js'
import portada from './scenes/00-portada.js'
import actividades from './scenes/01-actividades.js'

const scenes = [portada, actividades]
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
// Con movimiento reducido las animaciones internas se resuelven al instante.
if (reduced) gsap.globalTimeline.timeScale(40)

const stage = document.getElementById('stage')
const band = document.getElementById('band')
stage.appendChild(band)

const dot = createDot(document.getElementById('dot'))
const hud = createHud({ root: document.getElementById('hud'), menuEl: document.getElementById('menu'), dot, scenes, reduced })

const deck = createDeck({
  stage,
  band,
  dot,
  scenes,
  reduced,
  onChange(i, from, dir) {
    hud.update(i, from, dir)
    history.replaceState(null, '', `#/${i}`)
    document.title = i === 0 ? C.title : `${scenes[i].title} · ${C.title}`
  },
})
hud.bind(deck)

const fromHash = () => {
  const m = location.hash.match(/^#\/?(\d+)$/)
  return m ? Math.min(scenes.length - 1, +m[1]) : 0
}

// ── Acciones declaradas en el marcado (data-act) ──
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]')
  if (!b) return
  const act = b.dataset.act
  if (act === 'menu') return hud.toggle()
  if (hud.isOpen) return act === 'home' ? hud.close(0) : undefined
  if (act === 'next') deck.next()
  else if (act === 'prev') deck.prev()
  else if (act === 'home') deck.go(0)
})

// ── Teclado: ← → cambian de capítulo, ↑ ↓ actúan dentro de la escena ──
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.()
  else document.documentElement.requestFullscreen?.().catch(() => {})
}

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const k = e.key
  if (hud.isOpen) return hud.key(e)
  if (k === 'm' || k === 'M') return hud.open()
  if (k === 'f' || k === 'F') return fullscreen()
  if (deck.key(e)) return e.preventDefault()
  const onControl = e.target instanceof Element && e.target.closest('button, a, input')
  if (k === 'ArrowRight' || k === 'PageDown') deck.next()
  else if (k === 'ArrowLeft' || k === 'PageUp') deck.prev()
  else if (k === ' ' || k === 'Enter') {
    if (onControl) return
    e.shiftKey ? deck.prev() : deck.next()
  } else if (k === 'Home') deck.go(0)
  else if (k === 'End') deck.go(scenes.length - 1)
  else if (/^[0-9]$/.test(k) && +k < scenes.length) deck.go(+k)
  else return
  e.preventDefault()
})

// ── Rueda: un gesto, un capítulo (la inercia del trackpad no cuenta) ──
let wheelAt = 0
let wheelLock = 0
addEventListener(
  'wheel',
  (e) => {
    const now = performance.now()
    const fresh = now - wheelAt > 160
    wheelAt = now
    if (!fresh || now < wheelLock || hud.isOpen || Math.abs(e.deltaY) < 6) return
    wheelLock = now + 700
    e.deltaY > 0 ? deck.next() : deck.prev()
  },
  { passive: true },
)

// ── Táctil: deslizar en horizontal ──
let touch = null
addEventListener('pointerdown', (e) => {
  touch = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null
})
addEventListener('pointerup', (e) => {
  if (!touch || e.pointerId !== touch.id || hud.isOpen) return
  const dx = e.clientX - touch.x
  const dy = e.clientY - touch.y
  touch = null
  if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  dx < 0 ? deck.next() : deck.prev()
})

// ── Cambio de tamaño: el punto vuelve a su ancla ──
let raf = 0
addEventListener('resize', () => {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    deck.resize()
    if (!deck.busy) dot.snap()
  })
})

addEventListener('hashchange', () => {
  const i = fromHash()
  if (i !== deck.index && !hud.isOpen) deck.go(i)
})

// ── Arranque: con las fuentes listas, para que las medidas del punto sean exactas ──
const fonts = document.fonts
  ? Promise.all([document.fonts.load('800 16px Archivo'), document.fonts.load('500 16px "Martian Mono"')])
      .then(() => document.fonts.ready)
      .catch(() => {})
  : Promise.resolve()

fonts.then(() => deck.go(fromHash()))
