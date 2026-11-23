import gsap from 'gsap'
import { $, $$, pad, words, wordsDot, rise, fade } from '../core/fx.js'
import { C } from '../content/es.js'

// Las cinco entregas del semestre. El punto es el punto final del titular.
export default {
  id: 'actividades',
  theme: 'paper',
  title: C.s1.nav,
  html: () => `
    <div class="scene-inner s1">
      <h2 class="t-display s1-h"><span class="ln">${words(C.s1.title[0])}</span><span class="ln">${wordsDot(C.s1.title[1])}</span></h2>
      <div class="s1-side">
        <p class="t-label s1-label">${C.s1.label}</p>
        <ol class="s1-list">
          ${C.s1.items
            .map(
              (it, i) => `<li class="s1-item">
                <span class="t-label s1-num">${pad(i + 1)}</span>
                <span class="t-label s1-kind">${it.kind}</span>
                <span class="s1-name">${it.name}</span>
              </li>`,
            )
            .join('')}
        </ol>
      </div>
    </div>`,
  setup(el) {
    const tl = gsap.timeline({ paused: true })
    rise(tl, $$(el, '.s1-h .wi'), 0, { stagger: 0.09, duration: 1.2 })
    fade(tl, $(el, '.s1-label'), 0.4)
    fade(tl, $$(el, '.s1-item'), 0.55, { stagger: 0.09 })
    return { enter: tl, anchor: () => $(el, '.period') }
  },
}
