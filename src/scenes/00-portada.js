import gsap from 'gsap'
import { boil, P } from '../core/boil.js'
import { $, $$, words, rise, fade } from '../core/fx.js'
import { ringBtn } from '../icons/icons.js'
import { C } from '../content/es.js'

// Portada: el anillo se traza alrededor del punto y el título sube por líneas.
export default {
  id: 'portada',
  theme: 'ink',
  title: C.s0.nav,
  html: () => `
    <div class="scene-inner s0">
      <p class="t-label s0-kicker">${C.s0.kicker}</p>
      <div class="s0-logo" aria-hidden="true">
        <svg viewBox="-100 -100 200 200">${boil(P.circle(0, 0, 89.75, 44), { amp: 0.42, cls: 'draw s0-ring' })}</svg>
        <i class="s0-dot" data-dot></i>
      </div>
      <div class="s0-text">
        <h1 class="t-display s0-h">${C.s0.title.map((l) => `<span class="ln">${words(l)}</span>`).join('')}</h1>
        <p class="t-body s0-sub">${C.s0.sub}</p>
        ${ringBtn(C.s0.cta, { act: 'next', cls: 's0-cta' })}
      </div>
    </div>`,
  setup(el) {
    const tl = gsap.timeline({ paused: true })
    tl.fromTo($(el, '.s0-ring'), { '--draw': 1.06 }, { '--draw': 0, duration: 1.7, ease: 'expo.inOut' }, 0.15)
    rise(tl, $$(el, '.s0-h .wi'), 0.55, { stagger: 0.12, duration: 1.25 })
    fade(tl, [$(el, '.s0-kicker'), $(el, '.s0-sub'), $(el, '.s0-cta')], 1.2)
    return { enter: tl, anchor: () => $(el, '.s0-dot') }
  },
}
