// Las escenas de la presentación se arman con los datos de la generación:
// portada → índice → un capítulo por actividad (con sus trabajos adentro) → créditos.
import gsap from 'gsap'
import { $, $$, pad, words, reveal, fade, pop, countUp } from '../lib/fx.js'
import { C } from '../content/es.js'
import { shortName, urlOf } from '../lib/api.js'
import { viewerOf } from '../lib/files.js'
import { esc, icon } from '../lib/ui.js'
import { createViewer } from './viewer.js'

const NUM = ['Cero', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez']
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`
const KIND = { pdf: 'Documento', image: 'Imagen', video: 'Video', youtube: 'Video', docx: 'Documento', link: 'Enlace', file: 'Archivo' }
const w_ = (text) => words(esc(text))
const hueOf = (i) => `var(--c${(i % 5) + 1})`
const AURORA = '<div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>'

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

const lines = (list) => list.map((l) => `<span class="ln">${w_(l)}</span>`).join('')

function thumb(work) {
  const a = work.assets.find((x) => x.kind === 'youtube' || x.thumb_path) || work.assets[0]
  if (a?.kind === 'youtube') return `<img src="https://i.ytimg.com/vi/${esc(a.yt_id)}/hqdefault.jpg" alt="" class="is-wide" /><i class="ch-play">${icon.play}</i>`
  if (a?.thumb_path && urlOf(a.thumb_path)) return `<img src="${esc(urlOf(a.thumb_path))}" alt="" />`
  return `<b class="t-label">${esc(a ? KIND[viewerOf(a)] : 'Sin piezas')}</b>${a && viewerOf(a) === 'video' ? `<i class="ch-play">${icon.play}</i>` : ''}`
}

// ───────────────────────── Portada ─────────────────────────

const cover = (data) => ({
  id: 'portada',
  title: C.cover.nav,
  html: () => `
    ${AURORA}
    <div class="scene-inner cv">
      <span class="mark cv-mark">§</span>
      <p class="t-label cv-k">${C.cover.kicker} · ${esc(data.gen.name)}</p>
      <h1 class="t-display cv-h">${lines(twoLines(data.gen.subject))}</h1>
      ${data.gen.tagline ? `<p class="t-body cv-sub">${esc(data.gen.tagline)}</p>` : ''}
      <button type="button" class="pill cv-cta" data-act="next">${C.cover.cta} ${icon.arrow}</button>
    </div>`,
  setup(el) {
    const tl = gsap.timeline({ paused: true })
    tl.fromTo($(el, '.aurora'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.4, ease: 'power2.out' }, 0)
    tl.fromTo($(el, '.cv-mark'), { autoAlpha: 0, scale: 0.4, rotate: -24, filter: 'blur(18px)' }, { autoAlpha: 1, scale: 1, rotate: 0, filter: 'blur(0px)', duration: 1.5, ease: 'elastic.out(1, 0.62)' }, 0.2)
    reveal(tl, $$(el, '.cv-h .wi'), 0.55, { stagger: 0.12, duration: 1.4 })
    fade(tl, [$(el, '.cv-k'), $(el, '.cv-sub'), $(el, '.cv-cta')].filter(Boolean), 1.15, { stagger: 0.12 })
    return { enter: tl }
  },
})

// ───────────────────────── Índice ─────────────────────────

const index = (data) => {
  const n = data.activities.length
  const span = n === 5 ? [3, 3, 2, 2, 2] : n === 4 || n === 2 ? Array(n).fill(3) : n === 1 ? [6] : Array(n).fill(2)
  return {
    id: 'indice',
    title: C.index.nav,
    html: () => `
      <div class="scene-inner ix">
        <header class="ix-head">
          <p class="t-label ix-k">${C.index.label}</p>
          <h2 class="t-display ix-h">${w_(`${NUM[n] || n} ${n === 1 ? 'entrega' : 'entregas'}.`)}</h2>
        </header>
        <div class="ix-grid">
          ${data.activities
            .map(
              (a, i) => `<button type="button" class="ix-tile" data-act="go" data-to="${i + 2}" style="--hue:${hueOf(i)};--span:${span[i] || 2}">
                <span class="t-label ix-n">${pad(i + 1)} · ${esc(a.label || a.kind)}</span>
                <span class="ix-fig"><b class="t-display" data-n="${a.works.length}">${a.works.length}</b><span class="t-label">${a.works.length === 1 ? 'equipo' : 'equipos'}</span></span>
                <span class="t-body ix-title">${esc(a.title)}</span>
              </button>`,
            )
            .join('')}
        </div>
      </div>`,
    setup(el) {
      const tl = gsap.timeline({ paused: true })
      reveal(tl, $$(el, '.ix-h .wi'), 0, { stagger: 0.1 })
      fade(tl, $(el, '.ix-k'), 0.25)
      pop(tl, $$(el, '.ix-tile'), 0.35, { stagger: 0.09 })
      $$(el, '.ix-fig b').forEach((b, i) => countUp(tl, b, 0.5 + i * 0.09))
      return { enter: tl }
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
    hue: hueOf(i),
    title: a.label || a.title,
    html: () => `
      <div class="ch-glow" aria-hidden="true"></div>
      <div class="scene-inner ch" style="--cols:${cols};--rows:${Math.max(1, Math.ceil(n / cols))}">
        <div class="ch-view">
          <div class="ch-side">
            <p class="t-label ch-k">${pad(i + 1)} de ${pad(data.activities.length)}</p>
            <h2 class="t-display ch-h">${w_(`${a.label || a.kind}.`)}</h2>
            <p class="t-body ch-title">${esc(a.title)}</p>
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
            <h3 class="t-display wk-h" data-title></h3>
            <p class="t-body wk-sum"></p>
            <p class="t-label wk-cl">${C.work.credits}</p>
            <ul class="wk-credits"></ul>
            <div class="wk-pieces"></div>
            <button type="button" class="t-label wk-back" data-close>${icon.back} ${C.work.back}</button>
          </div>
        </div>
      </div>`,
    setup(el, { reduced }) {
      const view = $(el, '.ch-view')
      const wk = $(el, '.wk')
      const media = $(el, '.wk-media')
      const info = $(el, '.wk-info')
      const cards = $$(el, '.ch-card')
      const viewer = createViewer(media)
      let cur = -1
      let busy = false
      let anim = null
      let ghost = null

      const tl = gsap.timeline({ paused: true })
      tl.fromTo($(el, '.ch-glow'), { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 2, ease: 'power2.out' }, 0)
      reveal(tl, $$(el, '.ch-h .wi'), 0.05, { duration: 1.3 })
      fade(tl, [$(el, '.ch-k'), $(el, '.ch-title'), $(el, '.ch-meta')], 0.3)
      if (n) pop(tl, cards, 0.4, { stagger: 0.05 })

      function showPiece(w, j) {
        $$(el, '.wk-pieces button').forEach((b, k) => b.classList.toggle('is-on', k === j))
        viewer.show(w.assets[j])
      }

      function fill(k) {
        const w = works[k]
        $(el, '.wk-k').textContent = `${a.label || a.kind} · ${C.work.team} ${pad(k + 1)} de ${pad(n)}`
        $(el, '[data-title]').textContent = w.title
        $(el, '.wk-sum').textContent = w.summary || ''
        $(el, '.wk-sum').hidden = !w.summary
        $(el, '.wk-cl').hidden = !w.members.length
        $(el, '.wk-credits').innerHTML = w.members
          .map((m) => `<li><b>${esc(m.person?.full_name || '')}</b>${m.person_id === w.leader_id ? `<i class="t-label">${C.work.leader}</i>` : ''}${m.contribution ? `<span>${esc(m.contribution)}</span>` : ''}</li>`)
          .join('')
        $(el, '.wk-pieces').innerHTML =
          w.assets.length > 1 ? w.assets.map((x, j) => `<button type="button" class="t-label" data-piece="${j}">${esc(x.label || KIND[viewerOf(x)])}</button>`).join('') : ''
        showPiece(w, 0)
      }

      const dropGhost = () => {
        ghost?.remove()
        ghost = null
      }

      /** Abre un trabajo. La primera vez, su miniatura viaja y crece hasta ocupar el visor. */
      function open(k, dir = 1) {
        if (busy || k < 0 || k >= n) return true
        busy = true
        const first = cur < 0
        cur = k
        const kids = [...info.children]
        anim = gsap.timeline({ onComplete: () => (busy = false) })
        if (first) {
          const src = cards[k].querySelector('.ch-thumb')
          const from = src.getBoundingClientRect()
          const to = media.getBoundingClientRect()
          if (!reduced && from.width) {
            ghost = src.cloneNode(true)
            ghost.classList.add('ch-ghost')
            Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` })
            el.appendChild(ghost)
            gsap.set(src, { autoAlpha: 0 })
            anim.to(ghost, { left: to.left, top: to.top, width: to.width, height: to.height, borderRadius: getComputedStyle(media).borderRadius, duration: 0.85, ease: 'expo.inOut' }, 0)
          }
          anim.to(view, { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0)
          anim.add(() => {
            fill(k)
            gsap.set(wk, { autoAlpha: 1 })
            gsap.set(src, { autoAlpha: 1 })
          }, ghost ? 0.8 : 0.4)
          anim.fromTo(media, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' })
          if (ghost) anim.to(ghost, { autoAlpha: 0, duration: 0.45, ease: 'power2.out', onComplete: dropGhost }, '<')
          anim.fromTo(kids, { autoAlpha: 0, x: 30, filter: 'blur(8px)' }, { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', stagger: 0.05 }, '<')
        } else {
          anim.to([media, ...kids], { autoAlpha: 0, x: -24 * dir, filter: 'blur(8px)', duration: 0.24, ease: 'power2.in' })
          anim.add(() => fill(k))
          anim.fromTo(media, { autoAlpha: 0, x: 40 * dir, filter: 'blur(10px)' }, { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' })
          anim.fromTo(kids, { autoAlpha: 0, x: 26 * dir, filter: 'blur(8px)' }, { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', stagger: 0.04 }, '<0.05')
        }
        return true
      }

      function close() {
        if (busy || cur < 0) return true
        busy = true
        cur = -1
        anim = gsap
          .timeline({ onComplete: () => (busy = false) })
          .to(wk, { autoAlpha: 0, scale: 0.97, duration: 0.3, ease: 'power2.in' })
          .add(() => {
            viewer.clear()
            gsap.set(wk, { scale: 1 })
          })
          .to(view, { autoAlpha: 1, duration: 0.45, ease: 'power2.out' })
          .fromTo(cards, { scale: 0.96 }, { scale: 1, duration: 0.6, ease: 'expo.out', stagger: 0.02 }, '<')
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
        reset() {
          anim?.kill()
          dropGhost()
          cur = -1
          busy = false
          viewer.clear()
          gsap.set(view, { autoAlpha: 1 })
          gsap.set(wk, { autoAlpha: 0, scale: 1 })
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
  const roll = authors.map((p) => `<li>${esc(p.full_name)}</li>`).join('')
  // Con suficientes nombres la lista rueda sin fin, como los créditos de una película.
  const loop = authors.length > 8
  const gap = '<li class="cr-gap" aria-hidden="true"></li>'
  return {
    id: 'creditos',
    title: C.credits.nav,
    html: () => `
      ${AURORA}
      <div class="scene-inner cr">
        <div class="cr-side">
          <p class="t-label cr-k">${C.credits.label} · ${authors.length}</p>
          <h2 class="t-display cr-h">${lines(twoLines(`${data.gen.name}.`))}</h2>
          <p class="t-body cr-sub">${esc(data.gen.subject)}</p>
          ${teachers.length ? `<p class="t-label cr-teacher">${C.credits.teacher} · <b>${esc(teachers.map((t) => t.full_name).join(', '))}</b></p>` : ''}
          <button type="button" class="pill cr-cta" data-act="home">${icon.back} ${C.credits.again}</button>
        </div>
        <div class="cr-roll">
          <ul class="cr-names t-name ${loop ? '' : 'is-static'}" style="--dur:${Math.max(18, authors.length * 1.25)}s">${roll}${loop ? `${gap}${roll.replace(/<li>/g, '<li aria-hidden="true">')}${gap}` : ''}</ul>
        </div>
      </div>`,
    setup(el) {
      const tl = gsap.timeline({ paused: true })
      tl.fromTo($(el, '.aurora'), { autoAlpha: 0 }, { autoAlpha: 0.7, duration: 2.4, ease: 'power2.out' }, 0)
      reveal(tl, $$(el, '.cr-h .wi'), 0.1, { stagger: 0.12, duration: 1.3 })
      fade(tl, [$(el, '.cr-k'), $(el, '.cr-sub'), $(el, '.cr-teacher'), $(el, '.cr-cta')].filter(Boolean), 0.5)
      tl.fromTo($(el, '.cr-roll'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, ease: 'power2.out' }, 0.5)
      return { enter: tl }
    },
  }
}

export const buildScenes = (data) => [cover(data), index(data), ...data.activities.map((a, i) => chapter(data, a, i)), credits(data)]
