import gsap from 'gsap'

// El cursor: un bloque que nunca desaparece. Es el punto final de cada titular
// y parpadea como el de una terminal. Cada escena le ofrece un «ancla» (un
// elemento del DOM) y el cursor viaja a su centro y adopta su tamaño.
// Solo se anima con transform.

const BASE = 240

export function createDot(el) {
  el.innerHTML = `<svg viewBox="0 0 100 100" width="${BASE}" height="${BASE}" preserveAspectRatio="none"><rect class="dot-shape" width="100" height="100"/></svg>`
  const shape = el.firstElementChild
  const state = { x: innerWidth / 2, y: innerHeight / 2, w: 0, h: 0 }
  let anchor = null
  let tween = null

  const apply = () => {
    el.style.transform = `translate3d(${state.x}px,${state.y}px,0) scale(${Math.max(state.w, 0) / BASE},${Math.max(state.h, 0) / BASE})`
  }

  const measure = (target) => {
    const r = target.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
  }

  // Mientras viaja no parpadea.
  const moving = (on) => el.classList.toggle('is-moving', on)

  const api = {
    el,
    state,
    measure,
    get anchor() {
      return anchor
    },
    /** Viaja al ancla. `to` permite pasar una medida tomada antes (cuando el ancla aún no está en su sitio final). */
    to(target, { to, duration = 0.9, ease = 'expo.inOut', delay = 0, onComplete } = {}) {
      anchor = target
      const m = to || measure(target)
      tween?.kill()
      moving(true)
      tween = gsap.to(state, {
        x: m.x,
        y: m.y,
        w: m.w,
        h: m.h,
        duration,
        ease,
        delay,
        onUpdate: apply,
        onComplete() {
          moving(false)
          onComplete?.()
        },
      })
      return tween
    },
    /** Se coloca en el ancla sin animar (resize, seguimiento por cuadro). */
    snap(target = anchor) {
      if (!target) return
      anchor = target
      tween?.kill()
      moving(false)
      Object.assign(state, measure(target))
      apply()
    },
    set(v) {
      tween?.kill()
      Object.assign(state, v)
      apply()
    },
    /** Cambia de color (cada tono de escena tiene el suyo). */
    tint(color, duration = 0.6) {
      gsap.to(el, { color, duration, ease: 'power2.inOut', overwrite: 'auto' })
    },
    /** Un latido corto: confirma una selección. */
    pulse(amount = 1.4) {
      gsap.fromTo(shape, { scale: amount }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.5)', overwrite: true })
    },
  }
  apply()
  return api
}
