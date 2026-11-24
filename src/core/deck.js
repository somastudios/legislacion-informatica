import gsap from 'gsap'

// La baraja: una escena visible a la vez. Tres tonos (tinta, blanco y azul) y
// dos movimientos de cámara para pasar de una a otra:
//
//   barrido  una franja del tercer color cruza la pantalla en diagonal: tapa la
//            escena que sale y destapa la que llega. Horizontal entre capítulos,
//            vertical hacia los créditos.
//   entrada  la cámara se mete en un elemento de la escena actual (una fila del
//            índice), que crece hasta ser la escena siguiente. De regreso, se sale.
//
// El cursor viaja de un ancla a la otra durante el cambio y toma el color de la escena.

const COLORS = { ink: '#050506', paper: '#ffffff', blue: '#1d5bff' }
const CURSOR = { ink: COLORS.blue, paper: COLORS.blue, blue: COLORS.ink }
const third = (a, b) => ['blue', 'ink', 'paper'].find((c) => c !== a && c !== b)
const SLANT = 16 // inclinación de la franja, en % del eje

export function createDeck({ stage, band, dot, scenes, reduced, onChange }) {
  const n = scenes.length
  const els = []
  const apis = []
  let index = -1
  let busy = false

  scenes.forEach((s) => {
    const el = document.createElement('section')
    el.className = `scene s-${s.id}`
    el.dataset.theme = s.theme
    el.setAttribute('aria-label', s.title)
    el.inert = true
    el.innerHTML = s.html()
    stage.appendChild(el)
    els.push(el)
  })

  const deck = {
    n,
    scenes,
    get index() {
      return index
    },
    get busy() {
      return busy
    },
    go,
    next,
    prev,
    anchor: () => apis[index].anchor(),
    measureAnchor,
    playEnter,
    resize() {
      if (index < 0) return
      apis[index].resize?.()
    },
    key: (e) => (index >= 0 && !busy ? apis[index].key?.(e) : false),
  }

  scenes.forEach((s, i) => apis.push(s.setup(els[i], { dot, deck, reduced })))

  function activate(i) {
    els[i].classList.add('is-on')
    els[i].inert = false
  }

  function deactivate(i) {
    const el = els[i]
    el.classList.remove('is-on')
    el.inert = true
    gsap.set(el, { clearProps: 'clipPath,zIndex,transform,opacity' })
    apis[i].leave?.()
  }

  /** Mide el ancla de la escena actual con su entrada ya resuelta. */
  function measureAnchor() {
    const tl = apis[index].enter
    const pr = tl.progress()
    tl.progress(1, true)
    const m = dot.measure(apis[index].anchor())
    tl.progress(pr, true)
    return m
  }

  function playEnter(delay = 0) {
    const tl = apis[index].enter
    if (reduced) return tl.progress(1)
    gsap.delayedCall(delay, () => tl.play(0))
  }

  // ── Barrido: la franja tapa y luego destapa. `axis` x|y, `dir` 1 avanza, -1 regresa. ──
  function sweep(from, to, { axis, dir, color, done }) {
    const outEl = els[from]
    const inEl = els[to]
    // Polígono con un borde inclinado. `a` es el borde que avanza, `b` el que se queda atrás (0–100 + SLANT).
    const poly = (a, b) => {
      const p = [
        [a + SLANT, 0],
        [b + SLANT, 0],
        [b, 100],
        [a, 100],
      ].map(([u, v]) => {
        const x = dir > 0 ? 100 - u : u
        return axis === 'x' ? `${x}% ${v}%` : `${v}% ${x}%`
      })
      return `polygon(${p.join(',')})`
    }
    const shift = axis === 'x' ? 'xPercent' : 'yPercent'
    const s = { cover: 0, reveal: 0 }
    band.style.background = color
    band.style.display = 'block'
    gsap.set(inEl, { autoAlpha: 0 })
    const render = () => (band.style.clipPath = poly(-SLANT + s.cover * (100 + SLANT), -SLANT + s.reveal * (100 + SLANT)))
    render()
    return gsap
      .timeline({ onComplete: done })
      .to(s, { cover: 1, duration: 0.62, ease: 'power3.in', onUpdate: render }, 0)
      .to(outEl, { [shift]: -5 * dir, duration: 0.62, ease: 'power2.in' }, 0)
      .add(() => {
        gsap.set(outEl, { autoAlpha: 0 })
        gsap.set(inEl, { autoAlpha: 1 })
      })
      .to(s, { reveal: 1, duration: 0.85, ease: 'expo.out', onUpdate: render })
      .fromTo(inEl, { [shift]: 7 * dir }, { [shift]: 0, duration: 1, ease: 'expo.out' }, '<')
  }

  // ── Entrada: la escena nueva nace del rectángulo de `portal` (o se recoge en él al regresar). ──
  function push(from, to, { portal, dir, done }) {
    const r = portal.getBoundingClientRect()
    const box = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round ${Math.min(r.height, 36)}px)`
    const full = 'inset(0px 0px 0px 0px round 0px)'
    const top = els[dir > 0 ? to : from]
    const under = els[dir > 0 ? from : to]
    gsap.set(top, { zIndex: 3 })
    const tl = gsap.timeline({ onComplete: done })
    if (dir > 0) {
      tl.fromTo(top, { clipPath: box }, { clipPath: full, duration: 1.15, ease: 'expo.inOut' }, 0)
      tl.to(under, { scale: 1.08, opacity: 0.35, duration: 1.15, ease: 'expo.inOut' }, 0)
    } else {
      tl.fromTo(top, { clipPath: full }, { clipPath: box, duration: 1.05, ease: 'expo.inOut' }, 0)
      tl.fromTo(under, { scale: 1.08, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 1.05, ease: 'expo.inOut' }, 0)
    }
    return tl
  }

  function go(i, { instant = false } = {}) {
    if (busy || i === index || i < 0 || i >= n) return false
    const from = index
    const dir = from < 0 || i > from ? 1 : -1
    const api = apis[i]
    const theme = scenes[i].theme

    activate(i)
    api.reset?.(dir)
    const tl = api.enter
    index = i
    onChange?.(i, from, dir)

    tl.progress(1, true)
    const target = dot.measure(api.anchor())
    tl.progress(0, true).pause()

    // Primera carga: el cursor nace en su sitio.
    if (from < 0) {
      gsap.set(dot.el, { color: CURSOR[theme] })
      if (reduced) {
        tl.progress(1)
        dot.snap(api.anchor())
        return true
      }
      dot.set({ x: target.x, y: target.y, w: 0, h: 0 })
      dot.to(api.anchor(), { to: target, duration: 1.2, ease: 'expo.out', delay: 0.5 })
      tl.play(0)
      return true
    }

    // Cambio bajo el índice: quien llama se encarga del cursor y de la entrada.
    if (instant) {
      deactivate(from)
      dot.tint(CURSOR[theme])
      return true
    }

    if (reduced) {
      deactivate(from)
      tl.progress(1)
      gsap.set(dot.el, { color: CURSOR[theme] })
      dot.snap(api.anchor())
      return true
    }

    busy = true
    const done = () => {
      deactivate(from)
      gsap.set(els[i], { clearProps: 'clipPath,zIndex,transform,opacity,visibility' })
      band.style.display = 'none'
      busy = false
    }
    // El movimiento lo define la escena de más adelante: así ir y volver son el mismo, invertido.
    const move = Math.abs(i - from) === 1 ? scenes[Math.max(i, from)].move : null
    const portal = move?.type === 'push' ? apis[Math.min(i, from)].portal?.(Math.max(i, from)) : null
    let total
    if (portal) {
      push(from, i, { portal, dir, done })
      total = 1.15
      gsap.delayedCall(dir > 0 ? 0.55 : 0.4, () => tl.play(0))
    } else {
      const a = scenes[from].theme
      sweep(from, i, { axis: move?.axis || 'x', dir, color: COLORS[a === theme ? (a === 'blue' ? 'ink' : 'blue') : third(a, theme)], done })
      total = 1.47
      gsap.delayedCall(0.72, () => tl.play(0))
    }
    dot.to(api.anchor(), { to: target, duration: total, ease: 'expo.inOut' })
    dot.tint(CURSOR[theme], total * 0.6)
    return true
  }

  function next() {
    if (busy || index < 0) return
    if (apis[index].next?.()) return
    go(index + 1)
  }

  function prev() {
    if (busy || index < 0) return
    if (apis[index].prev?.()) return
    go(index - 1)
  }

  return deck
}
