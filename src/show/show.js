// Modo presentación: primero se elige la generación (como elegir perfil), luego corre la baraja.
import gsap from 'gsap'
import { words, reveal, fade, pop } from '../lib/fx.js'
import { loadGen, me, signedUrls } from '../lib/api.js'
import { esc, go, icon } from '../lib/ui.js'
import { buildScenes } from './scenes.js'
import { mountShow } from './player.js'

const AURORA = '<div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>'

function picker(root) {
  root.innerHTML = `
    <div class="pick">
      ${AURORA}
      <a class="glass pick-back" href="#/">${icon.back} Volver al taller</a>
      <div class="pick-in">
        <span class="mark pick-mark">§</span>
        <h1 class="t-display pick-h">${words('¿Qué generación quieres ver?')}</h1>
        <div class="pick-row">
          ${me.gens
            .map(
              (g, i) => `<a class="pick-tile" href="#/ver/${encodeURIComponent(g.slug)}" style="--hue:var(--c${(i % 5) + 1})">
                <b class="t-display grad">${esc(g.slug)}</b>
                <span class="t-label">${esc(g.name)}</span>
                <i class="pick-go">${icon.play}</i>
              </a>`,
            )
            .join('')}
        </div>
        ${me.gens.length ? '' : '<p class="t-body">Todavía no perteneces a ninguna generación.</p>'}
      </div>
    </div>`
  const tl = gsap.timeline()
  tl.fromTo(root.querySelector('.pick-mark'), { autoAlpha: 0, scale: 0.4, rotate: -20 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 1.2, ease: 'elastic.out(1, 0.65)' }, 0.1)
  reveal(tl, root.querySelectorAll('.pick-h .wi'), 0.25, { stagger: 0.07 })
  fade(tl, root.querySelector('.pick-back'), 0.4)
  pop(tl, root.querySelectorAll('.pick-tile'), 0.6, { stagger: 0.1 })
  const onKey = (e) => e.key === 'Enter' && me.gens[0] && go(`/ver/${me.gens[0].slug}`)
  addEventListener('keydown', onKey)
  return () => {
    tl.kill()
    removeEventListener('keydown', onKey)
  }
}

export async function show(root, slug) {
  if (!slug) return picker(root)
  const gen = me.gens.find((g) => g.slug === slug)
  if (!gen) return go('/ver')
  root.innerHTML = `<div class="pick"><div class="pick-in"><span class="mark pick-mark is-loading">§</span><p class="t-label pick-load">Preparando ${esc(gen.name)}…</p></div></div>`
  const data = await loadGen(gen.id)
  await signedUrls([...data.works.values()].flatMap((w) => w.assets.map((a) => a.thumb_path)))
  root.innerHTML = ''
  return mountShow(buildScenes(data), { title: `${gen.subject} · ${gen.name}`, onExit: () => go('/ver') })
}
