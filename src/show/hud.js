// Controles de la presentación: marca, índice y salir arriba; navegación en una cápsula abajo.
import gsap from 'gsap'
import { C } from '../content/es.js'
import { icon } from '../lib/ui.js'
import { $, $$, pad } from '../lib/fx.js'

export function createHud({ root, menuEl, scenes, reduced }) {
  let deck = null
  const n = scenes.length
  const touch = matchMedia('(hover: none)').matches

  root.innerHTML = `
    <div class="hud-top">
      <button type="button" class="hud-brand" data-act="home" aria-label="Volver a la portada"><span class="mark">§</span><span>${C.brand}</span></button>
      <div class="hud-acts">
        <button type="button" class="glass hud-menu" data-act="menu" aria-expanded="false" aria-controls="menu">${C.ui.index}</button>
        <button type="button" class="glass hud-exit" data-act="exit" aria-label="${C.ui.exit}">${icon.x}</button>
      </div>
    </div>
    <div class="hud-bottom">
      <div class="glass hud-nav">
        <button type="button" class="hud-step" data-act="prev" aria-label="${C.ui.prev}">${icon.back}</button>
        <p class="hud-count" aria-live="polite"><b class="hud-num">01</b><span>/ ${pad(n)}</span><span class="hud-title"></span></p>
        <button type="button" class="hud-step" data-act="next" aria-label="${C.ui.next}">${icon.arrow}</button>
      </div>
      <p class="hud-hint">${touch ? C.ui.hintTouch : C.ui.hintKeys}</p>
    </div>
    <div class="hud-progress"><i></i></div>`

  menuEl.innerHTML = `
    <div class="menu-inner">
      <p class="t-label menu-k">${C.ui.index}</p>
      <ol class="menu-list">
        ${scenes
          .map(
            (s, i) => `<li><button type="button" class="menu-item" data-i="${i}" ${s.hue ? `style="--hue:${s.hue}"` : ''}>
              <span class="menu-num">${pad(i + 1)}</span><span class="menu-title">${s.title}</span>
            </button></li>`,
          )
          .join('')}
      </ol>
    </div>`

  const num = $(root, '.hud-num')
  const title = $(root, '.hud-title')
  const bar = $(root, '.hud-progress i')
  const menuBtn = $(root, '.hud-menu')
  const prevBtn = $(root, '[data-act="prev"]')
  const nextBtn = $(root, '[data-act="next"]')
  const hint = $(root, '.hud-hint')
  const items = $$(menuEl, '.menu-item')
  let open = false
  let hinted = false

  function update(i, from) {
    root.classList.toggle('is-cover', i === 0)
    num.textContent = pad(i + 1)
    title.textContent = scenes[i].title
    prevBtn.disabled = i === 0
    nextBtn.disabled = i === n - 1
    gsap.to(bar, { scaleX: (i + 1) / n, duration: reduced ? 0 : 1, ease: 'expo.out' })
    items.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')))
    if (from >= 0 && !hinted) {
      hinted = true
      gsap.to(hint, { autoAlpha: 0, duration: 0.6 })
    }
  }

  function openMenu() {
    if (open || deck.busy) return
    open = true
    menuEl.inert = false
    menuEl.classList.add('is-open')
    root.classList.add('is-menu')
    menuBtn.setAttribute('aria-expanded', 'true')
    menuBtn.textContent = C.ui.close
    gsap.fromTo(menuEl, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' })
    gsap.fromTo(items, { autoAlpha: 0, y: 26, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', stagger: 0.045, delay: 0.05 })
    items[deck.index].focus({ preventScroll: true })
  }

  function closeMenu(jump = null) {
    if (!open) return
    open = false
    menuEl.inert = true
    root.classList.remove('is-menu')
    menuBtn.setAttribute('aria-expanded', 'false')
    menuBtn.textContent = C.ui.index
    gsap.to(menuEl, { autoAlpha: 0, duration: 0.3, ease: 'power2.in', onComplete: () => menuEl.classList.remove('is-open') })
    if (jump !== null && jump !== deck.index) deck.go(jump)
    menuBtn.focus({ preventScroll: true })
  }

  items.forEach((b, i) => b.addEventListener('click', () => closeMenu(i)))
  menuEl.addEventListener('click', (e) => e.target === menuEl && closeMenu())

  function key(e) {
    const k = e.key
    const cur = Math.max(0, items.indexOf(document.activeElement))
    let to = null
    if (k === 'Escape' || k === 'm' || k === 'M') closeMenu()
    else if (k === 'ArrowDown' || k === 'ArrowRight') to = (cur + 1) % n
    else if (k === 'ArrowUp' || k === 'ArrowLeft') to = (cur - 1 + n) % n
    else if (k === 'Home') to = 0
    else if (k === 'End') to = n - 1
    else if (/^[1-9]$/.test(k) && +k <= n) closeMenu(+k - 1)
    else return // Tab, Enter y espacio conservan su comportamiento
    if (to !== null) items[to].focus({ preventScroll: true })
    e.preventDefault()
  }

  return {
    bind: (d) => (deck = d),
    update,
    key,
    get isOpen() {
      return open
    },
    open: openMenu,
    close: closeMenu,
    toggle: () => (open ? closeMenu() : openMenu()),
  }
}
