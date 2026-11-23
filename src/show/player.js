// Monta la presentación: capas, baraja, punto, HUD y controles. Devuelve cómo desmontarla.
import gsap from 'gsap'
import { createDeck } from '../core/deck.js'
import { createDot } from '../core/dot.js'
import { createHud } from '../core/hud.js'
import { C } from '../content/es.js'

export function mountShow(scenes, { title = C.title, onExit } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  // Con movimiento reducido las animaciones internas se resuelven al instante.
  gsap.globalTimeline.timeScale(reduced ? 40 : 1)

  const layer = document.createElement('div')
  layer.id = 'show'
  layer.innerHTML = `
    <main id="stage"></main>
    <div id="band" aria-hidden="true"></div>
    <div id="menu" role="dialog" aria-modal="true" aria-label="${C.ui.index}" data-theme="ink" inert></div>
    <div id="grain" aria-hidden="true"></div>
    <div id="hud"></div>
    <div id="dot" aria-hidden="true"></div>`
  document.body.appendChild(layer)
  document.documentElement.classList.add('is-show')

  const q = (id) => layer.querySelector(`#${id}`)
  const stage = q('stage')
  const band = q('band')
  stage.appendChild(band)

  const dot = createDot(q('dot'))
  const hud = createHud({ root: q('hud'), menuEl: q('menu'), dot, scenes, reduced })
  q('hud').querySelector('.hud-menu').insertAdjacentHTML('beforebegin', `<button type="button" class="hud-exit t-label" data-act="exit">${C.ui.exit}</button>`)

  const deck = createDeck({
    stage,
    band,
    dot,
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

  // ── Cambio de tamaño: el punto vuelve a su ancla ──
  let raf = 0
  on(window, 'resize', () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      deck.resize()
      if (!deck.busy) dot.snap()
    })
  })

  deck.go(0)

  return () => {
    ctl.abort()
    cancelAnimationFrame(raf)
    scenes.forEach((s) => s.destroy?.())
    gsap.globalTimeline.timeScale(1)
    if (document.fullscreenElement) document.exitFullscreen?.()
    document.documentElement.classList.remove('is-show')
    document.title = title
    layer.remove()
  }
}
