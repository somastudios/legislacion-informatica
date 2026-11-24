// Monta la presentación: capas, baraja, controles y gestos. Devuelve cómo desmontarla.
import gsap from 'gsap'
import { C } from '../content/es.js'
import { reducedMotion } from '../lib/fx.js'
import { createDeck } from './deck.js'
import { createHud } from './hud.js'

export function mountShow(scenes, { title = C.title, onExit } = {}) {
  const reduced = reducedMotion()

  const layer = document.createElement('div')
  layer.id = 'show'
  layer.innerHTML = `
    <main id="stage"></main>
    <div id="menu" role="dialog" aria-modal="true" aria-label="${C.ui.index}" inert></div>
    <div id="hud"></div>`
  document.body.appendChild(layer)
  document.documentElement.classList.add('is-show')

  const q = (id) => layer.querySelector(`#${id}`)
  const hud = createHud({ root: q('hud'), menuEl: q('menu'), scenes, reduced })
  const deck = createDeck({
    stage: q('stage'),
    scenes,
    reduced,
    onChange(i, from, dir) {
      hud.update(i, from, dir)
      document.title = i === 0 ? title : `${scenes[i].title} · ${title}`
    },
  })
  hud.bind(deck)

  const ctl = new AbortController()
  const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: ctl.signal })
  const inScroll = (e) => e.target instanceof Element && e.target.closest('[data-scroll]')

  // ── Acciones declaradas en el marcado (data-act) ──
  on(layer, 'click', (e) => {
    const b = e.target.closest('[data-act]')
    if (!b) return
    const act = b.dataset.act
    if (act === 'exit') return onExit?.()
    if (act === 'menu') return hud.toggle()
    if (hud.isOpen) return act === 'home' ? hud.close(0) : undefined
    if (act === 'next') deck.next()
    else if (act === 'prev') deck.prev()
    else if (act === 'home') deck.go(0)
    else if (act === 'go') deck.go(+b.dataset.to)
  })

  // ── Teclado: ← → cambian de trabajo o capítulo, ↑ ↓ actúan dentro de la escena ──
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }
  on(window, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key
    if (hud.isOpen) return hud.key(e)
    if (k === 'm' || k === 'M') return hud.open()
    if (k === 'f' || k === 'F') return fullscreen()
    if (deck.key(e)) return e.preventDefault()
    if (k === 'Escape') return onExit?.()
    const onControl = e.target instanceof Element && e.target.closest('button, a, input, video')
    if (k === 'ArrowRight' || k === 'PageDown') deck.next()
    else if (k === 'ArrowLeft' || k === 'PageUp') deck.prev()
    else if (k === ' ' || k === 'Enter') {
      if (onControl) return
      e.shiftKey ? deck.prev() : deck.next()
    } else if (k === 'Home') deck.go(0)
    else if (k === 'End') deck.go(scenes.length - 1)
    else return
    e.preventDefault()
  })

  // ── Rueda: un gesto, un paso (la inercia del trackpad no cuenta) ──
  let wheelAt = 0
  let wheelLock = 0
  on(
    window,
    'wheel',
    (e) => {
      const now = performance.now()
      const fresh = now - wheelAt > 160
      wheelAt = now
      if (!fresh || now < wheelLock || hud.isOpen || inScroll(e) || Math.abs(e.deltaY) < 6) return
      wheelLock = now + 700
      e.deltaY > 0 ? deck.next() : deck.prev()
    },
    { passive: true },
  )

  // ── Táctil: deslizar en horizontal ──
  let touch = null
  on(window, 'pointerdown', (e) => {
    touch = e.pointerType === 'touch' && !inScroll(e) ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null
  })
  on(window, 'pointerup', (e) => {
    if (!touch || e.pointerId !== touch.id || hud.isOpen) return
    const dx = e.clientX - touch.x
    const dy = e.clientY - touch.y
    touch = null
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    dx < 0 ? deck.next() : deck.prev()
  })

  let raf = 0
  on(window, 'resize', () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => deck.resize())
  })

  deck.go(0)

  return () => {
    ctl.abort()
    cancelAnimationFrame(raf)
    gsap.killTweensOf(layer.querySelectorAll('*'))
    if (document.fullscreenElement) document.exitFullscreen?.()
    document.documentElement.classList.remove('is-show')
    document.title = title
    layer.remove()
  }
}
