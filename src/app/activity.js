// Una actividad: mi trabajo, subir, y todos los trabajos para decir «este es el mío».
import { loadGen, me, rpc, workOf } from '../lib/api.js'
import { confirmBox, esc, go, icon, pad, run, toast } from '../lib/ui.js'
import { contents, cover, dropzone, frame, names, thumb, withThumbs } from './parts.js'

export async function activity(root, id) {
  const main = frame(root, 'home')
  const paint = async () => {
    const data = await withThumbs(await loadGen())
    const act = data.activities.find((a) => a.id === id)
    if (!act) return go('/')
    const n = data.activities.indexOf(act) + 1
    const student = me.person?.role === 'student'
    const mine = student ? workOf(act, me.person.id) : null
    const lead = mine && mine.leader_id === me.person.id

    main.innerHTML = `
      <a class="crumb" href="#/">${icon.back} ${student ? 'Mis trabajos' : 'Actividades'}</a>
      <header class="page-head">
        <p class="t-label"><span class="num">${pad(n)}</span> · ${esc(act.label || act.kind)}</p>
        <h1 class="h1">${esc(act.title)}</h1>
        ${act.description ? `<p class="lead">${esc(act.description)}</p>` : ''}
      </header>

      ${
        student
          ? `<section class="block">
              <h2 class="h2">Tu trabajo</h2>
              ${
                mine
                  ? `<div class="mine">
                      ${thumb(cover(mine), 'mine-thumb')}
                      <div class="mine-body">
                        <p class="mine-title">${esc(mine.title)}</p>
                        <p class="mine-team">${esc(names(mine, 8))}</p>
                        <p class="mine-meta"><span class="chip is-ok">${icon.check} ${contents(mine)}</span>${lead ? '<span class="chip is-lead">Eres líder</span>' : ''}</p>
                        <div class="row">
                          <a class="btn btn-primary" href="#/t/${mine.id}">${lead ? 'Abrir y editar' : 'Abrir'} ${icon.arrow}</a>
                          <button type="button" class="btn btn-ghost" data-leave>No es mi equipo</button>
                        </div>
                      </div>
                    </div>
                    <div data-drop-slot class="mt"></div>`
                  : `<p class="lead">Sube el archivo o pega el enlace del video. Si alguien de tu equipo ya lo subió, te unimos a su equipo y nada se duplica. También puedes buscarlo abajo y elegir «Este es el mío».</p>
                     <div data-drop-slot class="mt"></div>`
              }
            </section>`
          : ''
      }

      <section class="block">
        <h2 class="h2">Todos los trabajos <span class="count">${act.works.length}</span></h2>
        ${
          act.works.length
            ? `<div class="grid">${act.works
                .map((w) => {
                  const isMine = mine?.id === w.id
                  return `<article class="card ${isMine ? 'is-mine' : ''}">
                    <a class="card-media" href="#/t/${w.id}">${thumb(cover(w))}</a>
                    <div class="card-body">
                      <a class="card-title" href="#/t/${w.id}">${esc(w.title)}</a>
                      <p class="card-team">${esc(names(w, 6)) || '<em>Sin integrantes</em>'}</p>
                      <div class="card-foot">
                        <span class="t-label">${contents(w)}</span>
                        ${isMine ? '<span class="chip is-ok">Tu equipo</span>' : student ? `<button type="button" class="btn btn-sm" data-join="${w.id}">Este es el mío</button>` : ''}
                      </div>
                    </div>
                  </article>`
                })
                .join('')}</div>`
            : `<div class="empty"><p>Todavía no hay trabajos en esta actividad.</p></div>`
        }
      </section>`

    const slot = main.querySelector('[data-drop-slot]')
    if (slot) dropzone(slot, act, { onDone: paint, compact: !!mine })

    main.querySelector('[data-leave]')?.addEventListener('click', (e) =>
      run(e.currentTarget, async () => {
        if (!(await confirmBox('¿Salir de este equipo?', 'Dejarás de aparecer en este trabajo. Después puedes unirte al equipo correcto o subir el tuyo.', 'Salir del equipo'))) return
        await rpc('leave_work', { p_work: mine.id })
        toast('Saliste del equipo.')
        await paint()
      }),
    )
    main.querySelectorAll('[data-join]').forEach((b) =>
      b.addEventListener('click', () =>
        run(b, async () => {
          const w = data.works.get(b.dataset.join)
          const text = mine ? `Entrarás a «${w.title}» y saldrás de «${mine.title}».` : `Aparecerás como integrante de «${w.title}».`
          if (!(await confirmBox('¿Este es tu trabajo?', text, 'Sí, unirme'))) return
          await rpc('join_work', { p_work: w.id })
          toast('Ya estás en este equipo.')
          await paint()
        }),
      ),
    )
  }
  await paint()
}
