// Ficha de un trabajo: título, descripción, piezas, equipo y créditos.
import { viewerOf } from '../lib/files.js'
import { loadGen, me, rpc, sb, write } from '../lib/api.js'
import { confirmBox, esc, fmtSize, go, icon, run, toast } from '../lib/ui.js'
import { dropzone, frame, openAsset, pieceLabel, thumb, withThumbs } from './parts.js'

const KIND = { pdf: 'PDF', image: 'Imagen', video: 'Video', docx: 'Word', youtube: 'YouTube', link: 'Enlace', file: 'Archivo' }
const initials = (p) => (p?.full_name || '?').split(' ').filter((t) => t[0] === t[0]?.toUpperCase()).slice(0, 2).map((t) => t[0]).join('')

export async function work(root, id) {
  const main = frame(root, 'home')
  const paint = async () => {
    const data = await withThumbs(await loadGen())
    const w = data.works.get(id)
    if (!w) return go('/')
    const act = data.activities.find((a) => a.id === w.activity_id)
    const myId = me.person?.id
    const isMember = w.members.some((m) => m.person_id === myId)
    const canEdit = me.isAdmin || (myId && w.leader_id === myId)
    const taken = new Map(act.works.flatMap((x) => x.members.map((m) => [m.person_id, x])))
    const addable = data.people.filter((p) => p.role === 'student' && taken.get(p.id)?.id !== w.id && (me.isAdmin || !taken.has(p.id)))

    main.innerHTML = `
      <a class="crumb" href="#/a/${act.id}">${icon.back} ${esc(act.label || 'Actividad')}</a>
      <header class="page-head">
        <p class="t-label">Ficha del trabajo${canEdit ? ' · puedes editarla' : ''}</p>
        ${
          canEdit
            ? `<input class="h1 h1-input" data-title value="${esc(w.title)}" aria-label="Título del trabajo" maxlength="140" />
               <textarea class="lead lead-input" data-summary rows="3" maxlength="600" placeholder="¿De qué trata? Cuéntalo en dos o tres líneas para quien lo vea en la presentación.">${esc(w.summary || '')}</textarea>`
            : `<h1 class="h1">${esc(w.title)}</h1>${w.summary ? `<p class="lead">${esc(w.summary)}</p>` : ''}`
        }
      </header>

      <section class="block">
        <h2 class="h2">Archivos <span class="count">${w.assets.length}</span></h2>
        <ul class="rows">
          ${w.assets
            .map((a) => {
              const v = viewerOf(a)
              const meta = [KIND[v], a.pages ? `${a.pages} ${a.pages === 1 ? 'página' : 'páginas'}` : '', a.size ? fmtSize(a.size) : ''].filter(Boolean).join(' · ')
              return `<li class="rowi">
                ${thumb(a, 'rowi-thumb')}
                <div class="rowi-body">
                  ${canEdit ? `<input class="inline" data-label="${a.id}" value="${esc(a.label || '')}" placeholder="Ponle un nombre: Documento, Presentación, Cartel…" aria-label="Nombre del archivo" maxlength="120" />` : `<p class="rowi-title">${esc(pieceLabel(a))}</p>`}
                  <p class="rowi-meta">${esc(meta)}${a.filename ? ` · ${esc(a.filename)}` : ''}</p>
                </div>
                <div class="rowi-acts">
                  <button type="button" class="btn btn-sm" data-open="${a.id}">Ver ${icon.eye}</button>
                  ${canEdit ? `<button type="button" class="ibtn" data-del-asset="${a.id}" title="Quitar archivo" aria-label="Quitar archivo">${icon.trash}</button>` : ''}
                </div>
              </li>`
            })
            .join('')}
        </ul>
        ${w.assets.length ? '' : '<div class="empty"><p>Este trabajo todavía no tiene archivos.</p></div>'}
        ${canEdit || isMember ? '<div data-drop-slot class="mt"></div>' : ''}
      </section>

      <section class="block">
        <h2 class="h2">Equipo y créditos <span class="count">${w.members.length}</span></h2>
        <p class="lead">Escribe qué hizo cada quien. Así aparecerá en los créditos de la presentación.</p>
        ${!w.leader_id && isMember ? `<div class="notice">Este equipo todavía no tiene líder. Quien lo sea podrá editar la ficha y los créditos. <button type="button" class="btn btn-sm btn-primary" data-lead="${myId}">Ser líder</button></div>` : ''}
        <ul class="rows">
          ${w.members
            .map((m) => {
              const self = m.person_id === myId
              const leader = m.person_id === w.leader_id
              return `<li class="rowi">
                <span class="avatar ${leader ? 'is-lead' : ''}">${esc(initials(m.person))}</span>
                <div class="rowi-body">
                  <p class="rowi-title">${esc(m.person?.full_name)} ${leader ? '<span class="chip is-lead">Líder</span>' : ''}${self ? '<span class="chip">Tú</span>' : ''}</p>
                  ${canEdit || self ? `<input class="inline" data-contrib="${m.person_id}" value="${esc(m.contribution || '')}" placeholder="¿Qué hizo? Por ejemplo: investigación, redacción, diseño del cartel…" maxlength="160" aria-label="Aportación de ${esc(m.person?.full_name)}" />` : `<p class="rowi-meta">${esc(m.contribution || 'Aún no se describe su parte')}</p>`}
                </div>
                <div class="rowi-acts">
                  ${canEdit && !leader ? `<button type="button" class="btn btn-sm btn-ghost" data-lead="${m.person_id}">Hacer líder</button>` : ''}
                  ${canEdit ? `<button type="button" class="ibtn" data-del-member="${m.person_id}" title="Quitar del equipo" aria-label="Quitar del equipo">${icon.x}</button>` : ''}
                </div>
              </li>`
            })
            .join('')}
        </ul>
        ${
          canEdit && addable.length
            ? `<form class="row mt" data-add>
                <select name="person" required aria-label="Agregar integrante"><option value="">Agregar integrante…</option>
                  ${addable.map((p) => `<option value="${p.id}">${esc(p.sort_name || p.full_name)}${taken.has(p.id) ? ' (está en otro equipo)' : ''}</option>`).join('')}
                </select>
                <button class="btn" type="submit">${icon.plus} Agregar</button>
              </form>
              ${me.isAdmin ? '' : '<p class="hint">Aquí solo aparecen quienes aún no tienen equipo en esta actividad. Si alguien quedó en otro equipo, puede cambiarse con «Este es el mío» o pedírselo a un administrador.</p>'}`
            : ''
        }
      </section>

      <section class="block row">
        ${isMember ? `<button type="button" class="btn btn-ghost" data-leave>Salir de este equipo</button>` : ''}
        ${me.isAdmin ? `<button type="button" class="btn btn-danger" data-del-work>${icon.trash} Eliminar trabajo</button>` : ''}
      </section>`

    const on = (sel, ev, fn) => main.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)))
    const save = (fn, msg = 'Guardado.') => async () => {
      await fn()
      toast(msg)
    }

    const slot = main.querySelector('[data-drop-slot]')
    if (slot) dropzone(slot, act, { work: w.id, onDone: paint, compact: true })

    on('[data-title]', 'change', (el) => run(null, save(() => write(sb.from('works').update({ title: el.value.trim() || 'Sin título' }).eq('id', id)))))
    on('[data-summary]', 'change', (el) => run(null, save(() => write(sb.from('works').update({ summary: el.value.trim() || null }).eq('id', id)))))
    on('[data-label]', 'change', (el) => run(null, save(() => write(sb.from('assets').update({ label: el.value.trim() || null }).eq('id', el.dataset.label)))))
    on('[data-contrib]', 'change', (el) =>
      run(
        null,
        save(() =>
          el.dataset.contrib === myId && !canEdit
            ? rpc('set_contribution', { p_work: id, p_text: el.value })
            : write(sb.from('work_members').update({ contribution: el.value.trim() || null }).eq('work_id', id).eq('person_id', el.dataset.contrib)),
        ),
      ),
    )
    on('[data-open]', 'click', (el) => run(el, () => openAsset(w.assets.find((a) => a.id === el.dataset.open))))
    on('[data-del-asset]', 'click', (el) =>
      run(el, async () => {
        if (!(await confirmBox('¿Quitar este archivo?', 'Dejará de aparecer en el trabajo y en la presentación.', 'Quitar archivo', 'danger'))) return
        await write(sb.from('assets').delete().eq('id', el.dataset.delAsset))
        await paint()
      }),
    )
    on('[data-lead]', 'click', (el) =>
      run(el, async () => {
        await rpc('set_leader', { p_work: id, p_person: el.dataset.lead })
        toast('Listo, el equipo tiene nuevo líder.')
        await paint()
      }),
    )
    on('[data-del-member]', 'click', (el) =>
      run(el, async () => {
        const p = data.person.get(el.dataset.delMember)
        if (!(await confirmBox('¿Quitar del equipo?', `${p?.full_name} dejará de aparecer en este trabajo.`, 'Quitar del equipo', 'danger'))) return
        await write(sb.from('work_members').delete().eq('work_id', id).eq('person_id', el.dataset.delMember))
        await paint()
      }),
    )
    on('[data-add]', 'submit', (el, e) => {
      e.preventDefault()
      const person = el.elements.person.value
      run(e.submitter, async () => {
        const row = { activity_id: act.id, person_id: person, work_id: id, source: 'admin' }
        await write(me.isAdmin ? sb.from('work_members').upsert(row, { onConflict: 'activity_id,person_id' }) : sb.from('work_members').insert(row))
        toast('Se agregó al equipo.')
        await paint()
      })
    })
    on('[data-leave]', 'click', (el) =>
      run(el, async () => {
        if (!(await confirmBox('¿Salir de este equipo?', 'Dejarás de aparecer en este trabajo.', 'Salir del equipo'))) return
        await rpc('leave_work', { p_work: id })
        go(`/a/${act.id}`)
      }),
    )
    on('[data-del-work]', 'click', (el) =>
      run(el, async () => {
        if (!(await confirmBox('¿Eliminar este trabajo?', 'Se borrará la ficha con sus archivos y su equipo. Esto no se puede deshacer.', 'Eliminar trabajo', 'danger'))) return
        await write(sb.from('works').delete().eq('id', id))
        go(`/a/${act.id}`)
      }),
    )
  }
  await paint()
}
