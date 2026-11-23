// Modo presentación: primero se elige la generación (como elegir perfil), luego corre la baraja.
import gsap from 'gsap'
import { boil, P } from '../core/boil.js'
import { words, rise, fade, pop } from '../core/fx.js'
import { loadGen, me, signedUrls } from '../lib/api.js'
import { esc, go, icon } from '../lib/ui.js'
import { buildScenes } from './scenes.js'
import { mountShow } from './player.js'

function picker(root) {
  root.innerHTML = `
    <div class="pick" data-theme="ink">
      <a class="t-label pick-back" href="#/">${icon.back} Volver al taller</a>
      <p class="t-label pick-k">Legislación Informática · Compendio</p>
      <h1 class="t-display pick-h"><span class="ln">${words('¿Qué generación')}</span><span class="ln">${words('quieres ver?')}</span></h1>
      <div class="pick-row">
        ${me.gens
          .map(
            (g) => `<a class="pick-tile" href="#/ver/${encodeURIComponent(g.slug)}">
              <span class="pick-ring"><svg viewBox="-100 -100 200 200" aria-hidden="true">${boil(P.circle(0, 0, 89.75, 44), { amp: 0.5, cls: 'pick-circle' })}</svg><i></i></span>
              <b class="t-display">${esc(g.slug)}</b>
              <span class="t-label">${esc(g.name)}</span>
            </a>`,
          )
          .join('')}
      </div>
      ${me.gens.length ? '' : '<p class="t-body">Todavía no perteneces a ninguna generación.</p>'}
    </div>`
  const tl = gsap.timeline()
  rise(tl, root.querySelectorAll('.pick-h .wi'), 0.1, { stagger: 0.06, duration: 1.1 })
  fade(tl, [root.querySelector('.pick-k'), root.querySelector('.pick-back')], 0.3)
  pop(tl, root.querySelectorAll('.pick-tile'), 0.5, { from: 0.8, stagger: 0.1 })
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
  root.innerHTML = `<div class="pick" data-theme="ink"><p class="t-label pick-load">Preparando ${esc(gen.name)}…</p></div>`
  const data = await loadGen(gen.id)
  await signedUrls([...data.works.values()].flatMap((w) => w.assets.map((a) => a.thumb_path)))
  root.innerHTML = ''
  const unmount = mountShow(buildScenes(data), { title: `${gen.subject} · ${gen.name}`, onExit: () => go('/ver') })
  return unmount
}
