// Administración: personas y cuentas, actividades e importación, enlaces de acceso y generaciones.
import { invalidate, loadGen, loadMe, me, pickGen, portal, sb, shortName, workOf, write } from '../lib/api.js'
import { confirmBox, copyText, dialog, esc, field, go, icon, pad, run, toast } from '../lib/ui.js'
import { readMoodleZip, saveImport } from './import.js'
import { frame } from './parts.js'

const TABS = [
  ['personas', 'Personas'],
  ['actividades', 'Actividades'],
  ['acceso', 'Acceso'],
]
const KINDS = [
  ['documento', 'Documento'],
  ['cartel', 'Cartel'],
  ['video', 'Video'],
  ['presentacion', 'Presentación'],
]
const code = (prefix, n) => prefix + [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('')
const must = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

export async function admin(root, tab = 'personas') {
  if (!me.isAdmin) return go('/')
  const main = frame(root, 'admin')
  const paint = async () => {
    const data = await loadGen()
    main.innerHTML = `
      <header class="page-head">
        <p class="t-label">Administración · ${esc(data?.gen?.name || '')}</p>
        <h1 class="h1">Todo bajo control</h1>
      </header>
      <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/admin/${k}" class="${k === tab ? 'is-on' : ''}">${l}</a>`).join('')}</nav>
      <div data-tab></div>`
    const el = main.querySelector('[data-tab]')
    if (!data) return (el.innerHTML = '<div class="empty"><p>No hay generación seleccionada.</p></div>')
    await { personas, actividades, acceso }[tab]?.(el, data, paint)
  }
  await paint()
}

// ───────────────────────── Personas ─────────────────────────

async function personas(el, data, paint) {
  const priv = new Map(must(await sb.from('people_private').select('*')).map((r) => [r.person_id, r]))
  const students = data.people.filter((p) => p.role === 'student')
  const withAccount = data.people.filter((p) => p.user_id).length
  el.innerHTML = `
    <div class="bar">
      <p class="lead">${withAccount} de ${data.people.length} ya tienen cuenta. Toca a alguien para corregir sus datos, su contraseña o su lugar.</p>
      <div class="row"><button type="button" class="btn btn-ghost" data-paste>Pegar lista</button>
        <button type="button" class="btn" data-new>${icon.plus} Agregar persona</button></div>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Nombre</th><th>Cuenta</th>${data.activities.map((a, i) => `<th class="c" title="${esc(a.title)}">${pad(i + 1)}</th>`).join('')}<th></th></tr></thead>
      <tbody>
        ${data.people
          .map((p) => {
            const cells = data.activities
              .map((a) => {
                if (p.role !== 'student') return '<td class="c mute">–</td>'
                const w = workOf(a, p.id)
                return w ? `<td class="c"><a class="dot-ok ${w.leader_id === p.id ? 'is-lead' : ''}" href="#/t/${w.id}" title="${esc(w.title)}${w.leader_id === p.id ? ' (líder)' : ''}"></a></td>` : '<td class="c"><i class="dot-no"></i></td>'
              })
              .join('')
            return `<tr>
              <td><button type="button" class="link" data-person="${p.id}">${esc(p.sort_name || p.full_name)}</button>
                ${p.role === 'teacher' ? '<span class="chip">Docente</span>' : ''}${p.is_admin ? '<span class="chip is-lead">Admin</span>' : ''}</td>
              <td>${p.user_id ? `<span class="chip is-ok">${icon.check} ${esc(priv.get(p.id)?.email || 'Con cuenta')}</span>` : '<span class="mute">Sin entrar</span>'}</td>
              ${cells}
              <td class="r"><button type="button" class="ibtn" data-person="${p.id}" aria-label="Editar">${icon.dots}</button></td>
            </tr>`
          })
          .join('')}
      </tbody>
      <tfoot><tr><td colspan="2" class="mute">Con entrega</td>${data.activities.map((a) => `<td class="c">${students.filter((p) => workOf(a, p.id)).length}</td>`).join('')}<td></td></tr></tfoot>
    </table></div>
    <p class="hint"><i class="dot-ok"></i> tiene trabajo · <i class="dot-ok is-lead"></i> es líder · <i class="dot-no"></i> sin trabajo. Los números son las actividades en orden.</p>`

  el.querySelector('[data-new]').addEventListener('click', async () => {
    const f = await dialog({
      title: 'Agregar persona',
      body: `${field('Nombre para créditos', 'full_name', { hint: 'Como debe verse: Nombre Apellidos.', attrs: 'required' })}
        ${field('Nombre de lista', 'sort_name', { hint: 'Apellidos Nombre, para ordenar.' })}
        ${field('Matrícula', 'matricula')}`,
      actions: [{ label: 'Cancelar', value: null }, { label: 'Agregar', value: 'add', kind: 'primary', submit: true }],
    })
    if (!f?._action) return
    await run(null, async () => {
      const [p] = await write(sb.from('people').insert({ generation_id: data.id, full_name: f.full_name.trim(), sort_name: f.sort_name.trim() || f.full_name.trim() }).select())
      await write(sb.from('people_private').insert({ person_id: p.id, matricula: f.matricula.trim() || null }))
      toast('Persona agregada.')
      await paint()
    })
  })

  // Lista completa de un jalón: una persona por renglón, «matrícula, Apellidos Nombre».
  el.querySelector('[data-paste]').addEventListener('click', async () => {
    const f = await dialog({
      title: 'Pegar lista',
      wide: true,
      body: `<p class="dlg-text">Una persona por renglón: matrícula y nombre como viene en la lista de asistencia (Apellidos Nombre). Las matrículas que ya existen se saltan.</p>
        ${field('Lista', 'list', { type: 'textarea', attrs: 'required rows="10" placeholder="26290519, CERVANTES GUZMAN DANIEL ALEJANDRO"' })}`,
      actions: [{ label: 'Cancelar', value: null }, { label: 'Agregar a la lista', value: 'add', kind: 'primary', submit: true }],
    })
    if (!f?._action) return
    await run(null, async () => {
      const have = new Set([...priv.values()].map((r) => r.matricula))
      const low = new Set(['de', 'la', 'del', 'los', 'las', 'y'])
      const cap = (t) => t.map((w) => (low.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ')
      let n = 0
      for (const line of f.list.split('\n')) {
        const m = line.match(/^\s*([A-Za-z]?\d{5,})[\s,;\t]+(.+?)\s*$/)
        if (!m || have.has(m[1])) continue
        const t = m[2].replace(/[,;]/g, ' ').split(/\s+/).filter(Boolean)
        // La lista viene «Apellido Apellido Nombres»; para créditos se voltea. Se puede corregir después.
        const [person] = await write(sb.from('people').insert({ generation_id: data.id, sort_name: cap(t), full_name: cap(t.length > 2 ? [...t.slice(2), ...t.slice(0, 2)] : t) }).select())
        await write(sb.from('people_private').insert({ person_id: person.id, matricula: m[1] }))
        have.add(m[1])
        n++
      }
      toast(n ? `${n} personas agregadas. Revisa que los nombres para créditos estén bien.` : 'No encontré renglones nuevos con matrícula y nombre.')
      await paint()
    })
  })

  el.querySelectorAll('[data-person]').forEach((b) =>
    b.addEventListener('click', async () => {
      const p = data.person.get(b.dataset.person)
      const pr = priv.get(p.id) || {}
      const f = await dialog({
        title: shortName(p),
        wide: true,
        body: `
          <div class="cols">
            ${field('Nombre para créditos', 'full_name', { value: p.full_name, attrs: 'required' })}
            ${field('Nombre de lista', 'sort_name', { value: p.sort_name || '' })}
            ${field('Matrícula', 'matricula', { value: pr.matricula || '' })}
            <label class="field"><span class="field-label">Rol</span><select name="role"><option value="student" ${p.role === 'student' ? 'selected' : ''}>Alumno</option><option value="teacher" ${p.role === 'teacher' ? 'selected' : ''}>Docente</option></select></label>
          </div>
          <label class="check"><input type="checkbox" name="is_admin" ${p.is_admin ? 'checked' : ''} /> <span>Es administrador (puede cambiar todo)</span></label>
          <hr class="sep" />
          ${
            p.user_id
              ? `<p class="t-label">Cuenta</p>
                 <div class="cols">
                   ${field('Correo', 'email', { type: 'email', value: pr.email || '' })}
                   ${field('Nueva contraseña', 'password', { hint: 'Déjala vacía para no cambiarla. Mínimo 6 caracteres.', attrs: 'autocomplete="off"' })}
                 </div>`
              : `<p class="dlg-text mute">Todavía no ha creado su cuenta. Entra con el enlace de invitación y su matrícula.</p>`
          }`,
        actions: [
          { label: 'Eliminar persona', value: 'delete', kind: 'danger', submit: true },
          ...(p.user_id ? [{ label: 'Desvincular cuenta', value: 'unlink', submit: true }] : []),
          { label: 'Guardar', value: 'save', kind: 'primary', submit: true },
        ],
      })
      if (!f?._action) return
      await run(null, async () => {
        if (f._action === 'delete') {
          if (!(await confirmBox('¿Eliminar a esta persona?', `${p.full_name} sale de la lista y de todos sus equipos. Su cuenta, si tiene, deja de tener acceso.`, 'Sí, eliminar', 'danger'))) return
          if (p.user_id && p.user_id !== me.user.id) await portal('admin_unlink', { person_id: p.id })
          await write(sb.from('people').delete().eq('id', p.id))
          toast('Persona eliminada.')
        } else if (f._action === 'unlink') {
          if (!(await confirmBox('¿Desvincular la cuenta?', `Se borra la cuenta con la que alguien entró como ${p.full_name}. El lugar queda libre para que entre la persona correcta; sus trabajos no se tocan.`, 'Sí, desvincular', 'danger'))) return
          await portal('admin_unlink', { person_id: p.id })
          invalidate()
          toast('Cuenta desvinculada.')
        } else {
          await write(sb.from('people').update({ full_name: f.full_name.trim(), sort_name: f.sort_name.trim() || f.full_name.trim(), role: f.role, is_admin: !!f.is_admin }).eq('id', p.id))
          if ((f.matricula.trim() || null) !== (pr.matricula || null)) await write(sb.from('people_private').upsert({ person_id: p.id, matricula: f.matricula.trim() || null }, { onConflict: 'person_id' }))
          if (p.user_id && f.email && f.email.trim().toLowerCase() !== (pr.email || '')) await portal('admin_set_email', { person_id: p.id, email: f.email.trim() })
          if (p.user_id && f.password) await portal('admin_set_password', { person_id: p.id, password: f.password })
          toast(f.password ? 'Guardado. Contraseña cambiada.' : 'Guardado.')
        }
        if (p.user_id === me.user.id) await loadMe()
        await paint()
      })
    }),
  )
}

// ───────────────────────── Actividades ─────────────────────────

const actForm = (a = {}) => `
  ${field('Título', 'title', { value: a.title || '', attrs: 'required' })}
  <div class="cols">
    ${field('Etiqueta corta', 'label', { value: a.label || '', hint: 'Ej. Propuesta, Cartel, Video.' })}
    <label class="field"><span class="field-label">Tipo</span><select name="kind">${KINDS.map(([k, l]) => `<option value="${k}" ${a.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${field('Orden', 'position', { type: 'number', value: a.position ?? '' })}
  </div>
  ${field('Descripción', 'description', { type: 'textarea', value: a.description || '', hint: 'Opcional. Aparece en la actividad y en la presentación.' })}`

async function actividades(el, data, paint) {
  el.innerHTML = `
    <div class="bar">
      <p class="lead">Importa el zip de Moodle («Descargar todas las entregas») y los equipos se arman solos. Puedes repetirlo: no duplica nada.</p>
      <button type="button" class="btn" data-new>${icon.plus} Nueva actividad</button>
    </div>
    <ul class="rows">
      ${data.activities
        .map(
          (a, i) => `<li class="rowi">
            <span class="avatar">${pad(i + 1)}</span>
            <div class="rowi-body">
              <p class="rowi-title">${esc(a.title)}</p>
              <p class="rowi-meta" data-status="${a.id}">${esc(a.label || a.kind)} · ${a.works.length} ${a.works.length === 1 ? 'trabajo' : 'trabajos'} · ${new Set(a.works.flatMap((w) => w.members.map((m) => m.person_id))).size} personas</p>
            </div>
            <div class="rowi-acts">
              <label class="btn btn-sm">${icon.upload} Importar Moodle<input type="file" accept=".zip" hidden data-zip="${a.id}" /></label>
              <button type="button" class="btn btn-sm btn-ghost" data-edit="${a.id}">Editar</button>
              <a class="btn btn-sm btn-ghost" href="#/a/${a.id}">Ver</a>
            </div>
          </li>`,
        )
        .join('')}
    </ul>
    ${data.activities.length ? '' : '<div class="empty"><p>Crea la primera actividad.</p></div>'}`

  const edit = async (a) => {
    const f = await dialog({
      title: a ? 'Editar actividad' : 'Nueva actividad',
      wide: true,
      body: actForm(a || { position: data.activities.length + 1 }),
      actions: [...(a ? [{ label: 'Eliminar', value: 'delete', kind: 'danger', submit: true }] : []), { label: 'Guardar', value: 'save', kind: 'primary', submit: true }],
    })
    if (!f?._action) return
    await run(null, async () => {
      if (f._action === 'delete') {
        if (!(await confirmBox('¿Eliminar la actividad?', `Se borran también sus ${a.works.length} trabajos. No se puede deshacer.`, 'Sí, eliminar', 'danger'))) return
        await write(sb.from('activities').delete().eq('id', a.id))
      } else {
        const row = { title: f.title.trim(), label: f.label.trim() || null, kind: f.kind, position: +f.position || 0, description: f.description.trim() || null }
        await write(a ? sb.from('activities').update(row).eq('id', a.id) : sb.from('activities').insert({ ...row, generation_id: data.id }))
      }
      toast('Guardado.')
      await paint()
    })
  }
  el.querySelector('[data-new]').addEventListener('click', () => edit(null))
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(data.activities.find((a) => a.id === b.dataset.edit))))

  el.querySelectorAll('[data-zip]').forEach((input) =>
    input.addEventListener('change', async () => {
      const file = input.files[0]
      input.value = ''
      if (!file) return
      const act = data.activities.find((a) => a.id === input.dataset.zip)
      const line = el.querySelector(`[data-status="${act.id}"]`)
      const status = (t) => (line.textContent = t)
      await run(null, async () => {
        const plan = await readMoodleZip(file, data.people, status)
        status('Listo para revisar.')
        const ok = await dialog({
          title: `${plan.groups.length} equipos detectados`,
          wide: true,
          body: `
            <p class="dlg-text">${plan.entries} archivos de ${plan.students} personas. Revisa que los equipos tengan sentido; después cualquier admin o líder puede corregirlos.</p>
            ${plan.unmatched.length ? `<div class="notice is-warn">No encontré en la lista a: ${esc(plan.unmatched.join(', '))}. Sus archivos no se importan; agrégalos en Personas y repite.</div>` : ''}
            <ol class="plan">${plan.groups
              .map(
                (g) => `<li><p class="rowi-title">${esc(g.members.map((id) => shortName(data.person.get(id))).join(', '))}</p>
                  <p class="rowi-meta">${[...g.yt.map(() => 'Video de YouTube'), ...g.files.map((f) => f.filename)].map(esc).join(' · ') || 'Sin piezas'}</p></li>`,
              )
              .join('')}</ol>`,
          actions: [{ label: 'Cancelar', value: false }, { label: 'Importar', value: true, kind: 'primary' }],
        })
        if (!ok) return paint()
        const r = await saveImport(act, data.id, plan, data.people, status)
        toast(`Importado: ${r.works} trabajos nuevos, ${r.assets} piezas, ${r.members} integrantes.`)
        await paint()
      })
    }),
  )
}

// ───────────────────────── Acceso ─────────────────────────

async function acceso(el, data, paint) {
  const invites = must(await sb.from('invites').select('*').eq('generation_id', data.id).order('grants', { ascending: false }))
  const base = `${location.origin}${location.pathname}#/unirse/`
  const g = data.gen
  el.innerHTML = `
    <section class="block">
      <h2 class="h2">Enlaces de invitación</h2>
      <p class="lead">Con el enlace de grupo cada quien crea su cuenta usando su matrícula. El de administración solo sirve para los correos autorizados.</p>
      <ul class="rows">
        ${invites
          .map(
            (i) => `<li class="rowi">
              <span class="avatar ${i.grants === 'admin' ? 'is-lead' : ''}">${icon.link}</span>
              <div class="rowi-body">
                <p class="rowi-title">${i.grants === 'admin' ? 'Administración (docente y admins)' : 'Grupo (alumnos)'} ${i.active ? '' : '<span class="chip is-todo">Pausado</span>'}</p>
                <p class="rowi-meta mono">${esc(base + i.code)}</p>
                ${i.grants === 'member' ? `<p class="rowi-meta">Código del grupo para recuperar contraseña: <b class="mono">${esc(i.code)}</b></p>` : ''}
              </div>
              <div class="rowi-acts">
                <button type="button" class="btn btn-sm" data-copy="${esc(base + i.code)}">${icon.copy} Copiar</button>
                <button type="button" class="btn btn-sm btn-ghost" data-toggle="${esc(i.code)}">${i.active ? 'Pausar' : 'Activar'}</button>
                <button type="button" class="btn btn-sm btn-ghost" data-renew="${esc(i.code)}">Cambiar</button>
              </div>
            </li>`,
          )
          .join('')}
      </ul>
    </section>
    <section class="block">
      <h2 class="h2">Esta generación</h2>
      <form class="form" data-gen>
        <div class="cols">
          ${field('Nombre', 'name', { value: g.name, attrs: 'required' })}
          ${field('Materia', 'subject', { value: g.subject, attrs: 'required' })}
        </div>
        ${field('Frase de portada', 'tagline', { value: g.tagline || '' })}
        <div class="row"><button class="btn btn-primary" type="submit">Guardar</button></div>
      </form>
    </section>
    <section class="block">
      <h2 class="h2">Generaciones</h2>
      <p class="lead">Cada generación tiene su lista, sus actividades y su presentación. El sistema es el mismo.</p>
      <div class="row">${me.gens.map((x) => `<span class="chip ${x.id === g.id ? 'is-ok' : ''}">${esc(x.name)}</span>`).join('')}
        <button type="button" class="btn" data-newgen>${icon.plus} Nueva generación</button></div>
    </section>`

  el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy)))
  el.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () =>
      run(b, async () => {
        const i = invites.find((x) => x.code === b.dataset.toggle)
        await write(sb.from('invites').update({ active: !i.active }).eq('code', i.code))
        await paint()
      }),
    ),
  )
  el.querySelectorAll('[data-renew]').forEach((b) =>
    b.addEventListener('click', () =>
      run(b, async () => {
        const i = invites.find((x) => x.code === b.dataset.renew)
        if (!(await confirmBox('¿Cambiar este enlace?', 'El enlace anterior deja de funcionar. Quien ya tiene cuenta no se ve afectado.', 'Sí, cambiar'))) return
        await write(sb.from('invites').update({ code: i.grants === 'admin' ? code('admin-', 10) : code(`liia${g.slug.slice(-2)}-`, 4) }).eq('code', i.code))
        await paint()
      }),
    ),
  )
  el.querySelector('[data-gen]').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    run(e.submitter, async () => {
      await write(sb.from('generations').update({ name: f.name.trim(), subject: f.subject.trim(), tagline: f.tagline.trim() || null }).eq('id', g.id))
      await loadMe()
      toast('Guardado.')
      await paint()
    })
  })
  el.querySelector('[data-newgen]').addEventListener('click', async () => {
    const f = await dialog({
      title: 'Nueva generación',
      body: `${field('Año o clave', 'slug', { hint: 'Ej. 2027. Se usa en el enlace de la presentación.', attrs: 'required pattern="[a-z0-9-]+"' })}
        ${field('Nombre', 'name', { hint: 'Ej. Generación 2027.', attrs: 'required' })}`,
      actions: [{ label: 'Cancelar', value: null }, { label: 'Crear', value: 'new', kind: 'primary', submit: true }],
    })
    if (!f?._action) return
    await run(null, async () => {
      const [ng] = await write(sb.from('generations').insert({ slug: f.slug.trim(), name: f.name.trim(), subject: g.subject }).select())
      await write(sb.from('invites').insert([{ code: code(`liia${ng.slug.slice(-2)}-`, 4), generation_id: ng.id, grants: 'member' }, { code: code('admin-', 10), generation_id: ng.id, grants: 'admin' }]))
      await loadMe()
      pickGen(ng.id)
      toast(`${ng.name} creada. Agrega su lista y sus actividades.`)
      go('/admin/actividades')
    })
  })
}
