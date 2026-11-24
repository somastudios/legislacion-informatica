// Vocabulario de movimiento compartido por la presentación y el taller.
// Siempre fromTo: el estado final es explícito y no depende de visitas previas.
import gsap from 'gsap'

export const $ = (el, sel) => el.querySelector(sel)
export const $$ = (el, sel) => [...el.querySelectorAll(sel)]
export const pad = (n) => String(n).padStart(2, '0')

/** Envuelve cada palabra para revelarla por separado. */
export const words = (text) =>
  text
    .split(' ')
    .map((w) => `<span class="w"><span class="wi">${w}</span></span>`)
    .join(' ')

/** Enfoque: las palabras llegan desenfocadas y se asientan. */
export const reveal = (tl, targets, at = 0, vars = {}) =>
  tl.fromTo(
    targets,
    { autoAlpha: 0, yPercent: 38, filter: 'blur(14px)' },
    { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', stagger: 0.07, ...vars },
    at,
  )

export const fade = (tl, targets, at = 0, { y = 16, ...vars } = {}) =>
  tl.fromTo(targets, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07, ...vars }, at)

/** Aparece creciendo, con un rebote corto. */
export const pop = (tl, targets, at = 0, { from = 0.86, ...vars } = {}) =>
  tl.fromTo(
    targets,
    { autoAlpha: 0, scale: from, y: 26, filter: 'blur(10px)', transformOrigin: '50% 60%' },
    { autoAlpha: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 0.95, ease: 'expo.out', stagger: 0.055, ...vars },
    at,
  )

/** Cuenta de 0 al número que trae el elemento. */
export const countUp = (tl, el, at = 0, duration = 1.4) => {
  const to = +el.dataset.n || 0
  const o = { v: 0 }
  return tl.fromTo(o, { v: 0 }, { v: to, duration, ease: 'expo.out', onUpdate: () => (el.textContent = Math.round(o.v)) }, at)
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
