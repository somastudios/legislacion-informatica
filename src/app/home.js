// Inicio del taller: las actividades y, para cada una, mi trabajo.
import { firstName, loadGen, me, workOf } from '../lib/api.js'
import { esc, icon, pad } from '../lib/ui.js'
import { cover, frame, names, thumb, withThumbs } from './parts.js'

export async function home(root) {
  const main = frame(root, 'home')
  if (!me.gen) {
    main.innerHTML = `<div class="empty"><h1 class="h1">Todavía no perteneces a ningún grupo</h1><p>Pide el enlace de invitación de tu generación.</p></div>`
    return
  }
  const data = await withThumbs(await loadGen())
  const student = me.person?.role === 'student'
  const mine = data.activities.map((a) => (student ? workOf(a, me.person.id) : null))
  const done = mine.filter(Boolean).length
  const total = data.activities.length
  const students = data.people.filter((p) => p.role === 'student').length

  main.innerHTML = `
    <section class="hero">
      <div>
        <p class="t-label hero-k">${esc(data.gen.name)} · ${esc(data.gen.subject)}</p>
        <h1 class="h-display">${student ? `Hola, ${esc(firstName(me.person))}` : 'El compendio'}<i class="pt"></i></h1>
        <p class="hero-s">${
          student
            ? done === total
              ? 'Ya tienes trabajo en todas las actividades. Revisa que cada ficha diga lo que hiciste.'
              : 'Revisa cada actividad: confirma tu equipo y sube lo que falte.'
            : 'Así va la recolección de trabajos del grupo.'
        }</p>
      </div>
      ${student ? `<div class="meter" style="--p:${total ? done / total : 0}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><circle class="meter-arc" cx="60" cy="60" r="50" pathLength="1" transform="rotate(-90 60 60)"/></svg><b>${done}<small>/${total}</small></b><span class="t-label">actividades</span></div>` : ''}
    </section>
    <ol class="acts">
      ${data.activities
        .map((a, i) => {
          const w = mine[i]
          const lead = w && w.leader_id === me.person?.id
          const withWork = new Set(a.works.flatMap((x) => x.members.map((m) => m.person_id))).size
          return `<li><a class="act ${w ? 'has-work' : ''}" href="#/a/${a.id}">
            <span class="act-n t-label">${pad(i + 1)}</span>
            <span class="act-body">
              <span class="t-label act-kind">${esc(a.label || a.kind)}</span>
              <span class="act-title">${esc(a.title)}</span>
              ${
                student
                  ? w
                    ? `<span class="act-state"><span class="chip is-ok">${icon.check} ${esc(w.title)}</span>${lead ? '<span class="chip is-lead">Eres líder</span>' : ''}<span class="act-team">${esc(names(w, 5))}</span></span>`
                    : `<span class="act-state"><span class="chip is-todo">Sin trabajo todavía</span><span class="act-team">Súbelo o encuéntralo entre los que ya están</span></span>`
                  : `<span class="act-state"><span class="chip">${a.works.length} ${a.works.length === 1 ? 'trabajo' : 'trabajos'}</span><span class="act-team">${withWork} de ${students} con entrega</span></span>`
              }
            </span>
            ${thumb(w ? cover(w) : a.works[0] && !student ? cover(a.works[0]) : null, 'act-thumb', a)}
            <span class="act-go">${icon.arrow}</span>
          </a></li>`
        })
        .join('')}
    </ol>
    ${data.activities.length ? '' : '<div class="empty"><p>Aún no hay actividades en esta generación.</p></div>'}`
}
