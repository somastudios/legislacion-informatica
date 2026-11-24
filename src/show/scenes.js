// Las escenas de la presentación se arman con los datos de la generación:
// portada → índice → un capítulo por actividad (con sus trabajos adentro) → créditos.
//
// Tres tonos (azul, blanco, tinta) y una transición, el iris, que nace donde está el punto.
// Dentro de un capítulo, la miniatura de cada trabajo viaja y crece hasta volverse el visor.
import gsap from 'gsap'
import { $, $$, pad, words, wordsDot, rise, fade, pop, draw } from '../core/fx.js'
import { ringBtn } from '../icons/icons.js'
import { glyph, glyphFor } from '../icons/glyphs.js'
import { C } from '../content/es.js'
import { shortName, urlOf } from '../lib/api.js'
import { viewerOf } from '../lib/files.js'
import { esc } from '../lib/ui.js'
import { createViewer } from './viewer.js'

const NUM = ['Cero', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez']
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`
const KIND = { pdf: 'Documento', image: 'Imagen', video: 'Video', youtube: 'Video', docx: 'Documento', link: 'Enlace', file: 'Archivo' }
const TONES = ['ink', 'blue', 'paper']
const w_ = (text) => words(esc(text))
/** Tamaño del titular de capítulo según su largo, para que quepa en su columna con todo y punto. */
const fit = (text) => (text.length <= 6 ? 6.8 : text.length <= 8 ? 5.8 : text.length <= 9 ? 5.3 : text.length <= 11 ? 4.5 : 3.8)

/** Parte un texto en dos líneas parejas para un titular. */
function twoLines(text) {
  const t = text.trim().split(/\s+/)
  if (t.length < 2) return [text]
  let best = 1
  let diff = Infinity
  for (let i = 1; i < t.length; i++) {
    const d = Math.abs(t.slice(0, i).join(' ').length - t.slice(i).join(' ').length)
    if (d < diff) {
      diff = d
      best = i
    }
  }
  return [t.slice(0, best).join(' '), t.slice(best).join(' ')]
}

/** Titular en líneas; el punto se posa al final de la última. */
const headline = (lines) => lines.map((l, i) => `<span class="ln">${i === lines.length - 1 ? wordsDot(esc(l)) : w_(l)}</span>`).join('')

function thumb(work) {
  const a = work.assets.find((x) => x.kind === 'youtube' || x.thumb_path) || work.assets[0]
  if (a?.kind === 'youtube') return `<img src="https://i.ytimg.com/vi/${esc(a.yt_id)}/hqdefault.jpg" alt="" class="is-wide" /><i class="ch-play"></i>`
  if (a?.thumb_path && urlOf(a.thumb_path)) return `<img src="${esc(urlOf(a.thumb_path))}" alt="" />`
  return `<b class="t-label">${esc(a ? KIND[viewerOf(a)] : 'Sin piezas')}</b>${a && viewerOf(a) === 'video' ? '<i class="ch-play"></i>' : ''}`
}

// ───────────────────────── Portada ─────────────────────────

const cover = (data) => ({
  id: 'portada',
  theme: 'blue',
  title: C.cover.nav,
  html: () => `
    <div class="scene-inner s0">
      <p class="t-label s0-kicker">${C.cover.kicker} · ${esc(data.gen.name)}</p>
      <div class="s0-mark" aria-hidden="true">${glyph('section', { width: 8.4, amp: 0.55 })}</div>
      <div class="s0-text">
        <h1 class="t-display s0-h">${headline(twoLines(data.gen.subject))}</h1>
        ${data.gen.tagline ? `<p class="t-body s0-sub">${esc(data.gen.tagline)}</p>` : ''}
        ${ringBtn(C.cover.cta, { act: 'next', cls: 's0-cta' })}
      </div>
    </div>`,
  setup(el) {
    const tl = gsap.timeline({ paused: true })
    draw(tl, $(el, '.s0-mark .boil'), 0.1, { duration: 2.2, ease: 'power2.inOut' })
    tl.fromTo($(el, '.s0-mark'), { rotate: -8, scale: 0.92 }, { rotate: 0, scale: 1, duration: 2.4, ease: 'expo.out' }, 0.1)
    rise(tl, $$(el, '.s0-h .wi'), 0.5, { stagger: 0.12, duration: 1.25 })
    fade(tl, [$(el, '.s0-kicker'), $(el, '.s0-sub'), $(el, '.s0-cta')].filter(Boolean), 1.15)
    return { enter: tl, anchor: () => $(el, '.period') }
  },
})

// ───────────────────────── Índice ─────────────────────────

const index = (data) => {
  const n = data.activities.length
  return {
    id: 'indice',
    theme: 'paper',
    title: C.index.nav,
    html: () => `
      <div class="scene-inner s1">
        <h2 class="t-display s1-h">${headline([NUM[n] || String(n), n === 1 ? 'entrega' : 'entregas'])}</h2>
        <div class="s1-side">
          <p class="t-label s1-label">${C.index.label}</p>
          <ol class="s1-list">
            ${data.activities
              .map(
                (a, i) => `<li class="s1-item">
                  <span class="t-label s1-num">${pad(i + 1)}</span>
                  <span class="s1-ico">${glyph(glyphFor(a), { width: 6.5 })}</span>
                  <span class="s1-name"><b class="t-name">${esc(a.label || a.kind)}</b>${esc(a.title)}</span>
                  <span class="t-label s1-count">${count(a.works.length, 'equipo', 'equipos')}</span>
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
      fade(tl, $$(el, '.s1-item'), 0.5, { stagger: 0.1 })
      draw(tl, $$(el, '.s1-ico .boil'), 0.65, { stagger: 0.1, duration: 0.9 })
      return {
        enter: tl,
        anchor: () => $(el, '.period'),
      }
    },
  }
}

// ───────────────────────── Capítulo: una actividad y sus trabajos ─────────────────────────

function chapter(data, a, i) {
  const works = a.works.filter((w) => w.assets.length || w.members.length)
  const people = new Set(works.flatMap((w) => w.members.map((m) => m.person_id))).size
  const n = works.length
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 12 ? 4 : n <= 15 ? 5 : 6
  return {
    id: `act-${i + 1}`,
    theme: TONES[i % 3],
    title: a.label || a.title,
    html: () => `
      <div class="scene-inner ch" style="--cols:${cols};--rows:${Math.max(1, Math.ceil(n / cols))}">
        <div class="ch-view">
          <div class="ch-side">
            <p class="t-label ch-k"><b>${pad(i + 1)}</b> / ${pad(data.activities.length)}</p>
            <span class="ch-ico">${glyph(glyphFor(a), { width: 4.6 })}</span>
            <h2 class="t-display ch-h" style="--fs:${fit(a.label || a.kind)}">${headline([a.label || a.kind])}</h2>
            <p class="t-name ch-title">${esc(a.title)}</p>
            <p class="t-label ch-meta">${n ? `${count(n, 'equipo', 'equipos')} · ${count(people, 'persona', 'personas')}` : C.work.empty}</p>
          </div>
          <div class="ch-cards">
            ${works
              .map(
                (w, k) => `<button type="button" class="ch-card" data-open="${k}">
                  <span class="ch-thumb">${thumb(w)}</span>
                  <span class="ch-card-t">${esc(w.title)}</span>
                  <span class="t-label ch-card-n">${esc(w.members.map((m) => shortName(m.person).split(' ').pop()).join(' · '))}</span>
                </button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="wk">
          <div class="wk-media"></div>
          <div class="wk-info">
            <p class="t-label wk-k"></p>
            <h3 class="t-name wk-h"><i class="wk-dot" data-dot></i><span data-title></span></h3>
            <p class="t-body wk-sum"></p>
            <p class="t-label wk-cl">${C.work.credits}</p>
            <ul class="wk-credits"></ul>
            <div class="wk-pieces"></div>
            <button type="button" class="t-label wk-back" data-close>← ${C.work.back}</button>
          </div>
        </div>
      </div>`,
    setup(el, { dot, reduced }) {
      const view = $(el, '.ch-view')
      const wk = $(el, '.wk')
      const media = $(el, '.wk-media')
      const info = $(el, '.wk-info')
      const side = $(el, '.ch-side')
      const cards = $$(el, '.ch-card')
      const viewer = createViewer(media)
      let cur = -1
      let busy = false
      let anim = null
      let ghost = null

      const tl = gsap.timeline({ paused: true })
      rise(tl, $$(el, '.ch-h .wi'), 0, { duration: 1.2 })
      draw(tl, $(el, '.ch-ico .boil'), 0.15, { duration: 1.5 })
      fade(tl, [$(el, '.ch-k'), $(el, '.ch-title'), $(el, '.ch-meta')], 0.3)
      if (n) pop(tl, cards, 0.4, { from: 0.9, stagger: 0.045 })

      function showPiece(w, j) {
        $$(el, '.wk-pieces button').forEach((b, k) => b.classList.toggle('is-on', k === j))
        viewer.show(w.assets[j])
      }

      function fill(k) {
        const w = works[k]
        $(el, '.wk-k').innerHTML = `<b>${esc(a.label || a.kind)}</b> · ${C.work.team} ${pad(k + 1)} / ${pad(n)}`
        $(el, '[data-title]').textContent = w.title
        $(el, '.wk-sum').textContent = w.summary || ''
        $(el, '.wk-sum').hidden = !w.summary
        $(el, '.wk-cl').hidden = !w.members.length
        $(el, '.wk-credits').innerHTML = w.members
          .map((m) => `<li><b>${esc(m.person?.full_name || '')}</b>${m.person_id === w.leader_id ? `<i class="t-label">${C.work.leader}</i>` : ''}${m.contribution ? `<span>${esc(m.contribution)}</span>` : ''}</li>`)
          .join('')
        $(el, '.wk-pieces').innerHTML =
          w.assets.length > 1 ? w.assets.map((x, j) => `<button type="button" class="t-label" data-piece="${j}"><b>${j + 1}</b> ${esc(x.label || KIND[viewerOf(x)])}</button>`).join('') : ''
        showPiece(w, 0)
      }

      const dropGhost = () => {
        ghost?.remove()
        ghost = null
      }
      const land = () => dot.to($(el, '.wk-dot'), { duration: 0.8, ease: 'expo.out' })

      /** Abre un trabajo. Desde la cuadrícula, su miniatura viaja y crece hasta ocupar el visor. */
      function open(k, dir = 1) {
        if (busy || k < 0 || k >= n) return true
        busy = true
        const first = cur < 0
        cur = k
        const kids = [...info.children]
        anim = gsap.timeline({
          onComplete() {
            busy = false
            land()
          },
        })
        // El ancla del punto se mide en su sitio final, sin el desplazamiento de la entrada.
        const settle = () => {
          fill(k)
          gsap.set(wk, { autoAlpha: 1 })
          gsap.set(kids, { x: 0 })
          land()
        }
        if (first) {
          // El punto cruza hacia el título mientras la miniatura viaja al visor.
          gsap.set(kids, { x: 0 })
          dot.to($(el, '.wk-dot'), { duration: 0.9, ease: 'expo.inOut' })
          const src = cards[k].querySelector('.ch-thumb')
          const a0 = src.getBoundingClientRect()
          const b0 = media.getBoundingClientRect()
          if (!reduced && a0.width) {
            ghost = src.cloneNode(true)
            ghost.classList.add('ch-ghost')
            Object.assign(ghost.style, { left: `${a0.left}px`, top: `${a0.top}px`, width: `${a0.width}px`, height: `${a0.height}px` })
            el.appendChild(ghost)
            gsap.set(src, { autoAlpha: 0 })
            anim.to(ghost, { left: b0.left, top: b0.top, width: b0.width, height: b0.height, borderRadius: getComputedStyle(media).borderRadius, duration: 0.9, ease: 'expo.inOut' }, 0)
          }
          anim.to(cards, { autoAlpha: 0, scale: 0.94, duration: 0.4, ease: 'power2.in', stagger: { each: 0.015, from: k } }, 0)
          anim.to(side, { autoAlpha: 0, x: -30, duration: 0.4, ease: 'power2.in' }, 0)
          anim.add(() => {
            fill(k)
            gsap.set(wk, { autoAlpha: 1 })
            gsap.set(view, { autoAlpha: 0 })
            gsap.set(src, { autoAlpha: 1 })
          }, ghost ? 0.86 : 0.42)
          anim.fromTo(media, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power2.out' })
          if (ghost) anim.to(ghost, { autoAlpha: 0, duration: 0.45, ease: 'power2.out', onComplete: dropGhost }, '<')
          anim.fromTo(kids, { autoAlpha: 0, x: 34 }, { autoAlpha: 1, x: 0, duration: 0.85, ease: 'expo.out', stagger: 0.055 }, '<')
        } else {
          anim.to([media, ...kids], { autoAlpha: 0, x: -26 * dir, duration: 0.24, ease: 'power2.in', stagger: 0.012 })
          anim.add(settle)
          anim.fromTo(media, { autoAlpha: 0, x: 48 * dir, scale: 0.985 }, { autoAlpha: 1, x: 0, scale: 1, duration: 0.8, ease: 'expo.out' })
          anim.fromTo(kids, { autoAlpha: 0, x: 30 * dir }, { autoAlpha: 1, x: 0, duration: 0.75, ease: 'expo.out', stagger: 0.045 }, '<0.06')
        }
        return true
      }

      function close() {
        if (busy || cur < 0) return true
        busy = true
        cur = -1
        anim = gsap
          .timeline({ onComplete: () => (busy = false) })
          .to(wk, { autoAlpha: 0, duration: 0.3, ease: 'power2.in' })
          .add(() => {
            viewer.clear()
            gsap.set(view, { autoAlpha: 1 })
            dot.to($(el, '.period'), { duration: 0.9, ease: 'expo.out' })
          })
          .fromTo(side, { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'expo.out' })
          .fromTo(cards, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'expo.out', stagger: 0.025 }, '<')
        return true
      }

      el.addEventListener('click', (e) => {
        const card = e.target.closest('[data-open]')
        if (card) return open(+card.dataset.open)
        const p = e.target.closest('[data-piece]')
        if (p && cur >= 0) return showPiece(works[cur], +p.dataset.piece)
        if (e.target.closest('[data-close]')) close()
      })

      return {
        enter: tl,
        anchor: () => (cur >= 0 ? $(el, '.wk-dot') : $(el, '.period')),
        reset() {
          anim?.kill()
          dropGhost()
          cur = -1
          busy = false
          viewer.clear()
          gsap.set([view, side], { autoAlpha: 1, x: 0 })
          gsap.set(wk, { autoAlpha: 0 })
          gsap.set($$(el, '.ch-thumb'), { autoAlpha: 1 })
        },
        leave() {
          dropGhost()
          viewer.clear()
        },
        next: () => (busy ? true : cur < n - 1 ? open(cur + 1, 1) : false),
        prev: () => (busy ? true : cur > 0 ? open(cur - 1, -1) : cur === 0 ? close() : false),
        resize: () => viewer.resize(),
        key(e) {
          if (cur < 0) return false
          if (viewer.key(e)) return true
          if (e.key === 'Escape') return close()
          if (/^[1-9]$/.test(e.key) && +e.key <= works[cur].assets.length) {
            showPiece(works[cur], +e.key - 1)
            return true
          }
          return false
        },
      }
    },
  }
}

// ───────────────────────── Créditos ─────────────────────────

const credits = (data) => {
  const made = new Set([...data.works.values()].flatMap((w) => w.members.map((m) => m.person_id)))
  const authors = data.people.filter((p) => made.has(p.id))
  const teachers = data.people.filter((p) => p.role === 'teacher')
  return {
    id: 'creditos',
    theme: 'ink',
    title: C.credits.nav,
    html: () => `
      <div class="scene-inner cr">
        <div class="cr-side">
          <span class="cr-ico">${glyph('balanza', { width: 3.6 })}</span>
          <h2 class="t-display cr-h">${headline(twoLines(data.gen.name))}</h2>
          <p class="t-body cr-sub">${esc(data.gen.subject)}</p>
          ${teachers.length ? `<p class="t-label cr-teacher">${C.credits.teacher} · <b>${esc(teachers.map((t) => t.full_name).join(', '))}</b></p>` : ''}
          ${ringBtn(C.credits.again, { act: 'home', dir: 'left', cls: 'cr-cta' })}
        </div>
        <div class="cr-list">
          <p class="t-label cr-label">${C.credits.label} · ${authors.length}</p>
          <ul class="cr-names">${authors.map((p) => `<li>${esc(p.full_name)}</li>`).join('')}</ul>
        </div>
      </div>`,
    setup(el) {
      const tl = gsap.timeline({ paused: true })
      rise(tl, $$(el, '.cr-h .wi'), 0, { stagger: 0.1, duration: 1.2 })
      draw(tl, $(el, '.cr-ico .boil'), 0.2, { duration: 2 })
      fade(tl, [$(el, '.cr-sub'), $(el, '.cr-teacher'), $(el, '.cr-label')].filter(Boolean), 0.4)
      fade(tl, $$(el, '.cr-names li'), 0.55, { stagger: 0.022, y: 10, duration: 0.6 })
      fade(tl, $(el, '.cr-cta'), 1)
      // En vertical la lista de nombres se desliza: ahí el gesto no cambia de escena.
      if (matchMedia('(max-aspect-ratio: 1/1)').matches) $(el, '.cr-list').dataset.scroll = ''
      return { enter: tl, anchor: () => $(el, '.period') }
    },
  }
}

export const buildScenes = (data) => [cover(data), index(data), ...data.activities.map((a, i) => chapter(data, a, i)), credits(data)]
