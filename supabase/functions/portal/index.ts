// Portal de cuentas: unirse con un enlace, recuperar contraseña y acciones de administración.
// Las cuentas se crean ya confirmadas (sin depender del correo de Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (error: string) => reply({ ok: false, error })

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const clean = (v: unknown) => String(v ?? '').trim()
const MISMATCH = 'Los datos no coinciden. Pídele a un administrador que te restablezca la contraseña.'

async function invite(code: string) {
  const { data } = await db
    .from('invites')
    .select('code, generation_id, grants, active, generations(name, slug)')
    .eq('code', code)
    .maybeSingle()
  return data && data.active ? data : null
}

async function rosterRow(generation: string, matricula: string) {
  const { data } = await db
    .from('people_private')
    .select('person_id, matricula, people!inner(id, generation_id, full_name, user_id)')
    .eq('matricula', matricula)
    .eq('people.generation_id', generation)
    .maybeSingle()
  return data ? (data.people as unknown as { id: string; full_name: string; user_id: string | null }) : null
}

async function requireAdmin(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  if (!data?.user) return null
  const { data: rows } = await db.from('people').select('id').eq('user_id', data.user.id).eq('is_admin', true).limit(1)
  return rows?.length ? data.user : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('Solicitud inválida')
  }
  const action = clean(body.action)

  try {
    // ── Enlace de invitación: a qué grupo lleva y, con matrícula, a quién saluda ──
    if (action === 'peek') {
      const inv = await invite(clean(body.code))
      if (!inv) return fail('Este enlace no es válido o ya no está activo.')
      const out: Record<string, unknown> = { ok: true, generation: inv.generations, grants: inv.grants }
      const matricula = clean(body.matricula)
      if (matricula) {
        const p = await rosterRow(inv.generation_id, matricula)
        out.person = p ? { name: p.full_name, claimed: !!p.user_id } : null
      }
      return reply(out)
    }

    // ── Crear cuenta ──
    if (action === 'join') {
      const inv = await invite(clean(body.code))
      if (!inv) return fail('Este enlace no es válido o ya no está activo.')
      const email = clean(body.email).toLowerCase()
      const password = String(body.password ?? '')
      const matricula = clean(body.matricula)
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Escribe un correo válido.')
      if (password.length < 6) return fail('La contraseña necesita al menos 6 caracteres.')

      const { data: adminRow } = await db.from('admin_emails').select('email, role').eq('email', email).maybeSingle()
      if (inv.grants === 'admin' && !adminRow) return fail('Este enlace es solo para administradores autorizados.')
      if (inv.grants === 'member' && adminRow) return fail('Ese correo es de administrador: usa el enlace de administración.')

      let person: { id: string; full_name: string; user_id: string | null } | null = null
      if (matricula) {
        person = await rosterRow(inv.generation_id, matricula)
        if (!person) return fail('No encontramos esa matrícula en la lista del grupo.')
      } else if (adminRow?.role === 'teacher') {
        const { data: existing } = await db
          .from('people_private')
          .select('people!inner(id, full_name, user_id, generation_id)')
          .eq('email', email)
          .eq('people.generation_id', inv.generation_id)
          .maybeSingle()
        person = (existing?.people as unknown as typeof person) ?? null
        if (!person) {
          const name = clean(body.name)
          if (!name) return fail('Escribe tu nombre.')
          const { data: created, error } = await db
            .from('people')
            .insert({ generation_id: inv.generation_id, full_name: name, sort_name: name, role: 'teacher', is_admin: true })
            .select('id, full_name, user_id')
            .single()
          if (error) throw error
          person = created
        }
      } else {
        return fail('Escribe tu matrícula.')
      }
      if (person!.user_id) {
        return fail('Esa cuenta ya fue creada. Si es tuya, usa «Olvidé mi contraseña»; si no, avísale a un administrador.')
      }

      let userId: string | null = null
      let createdNow = false
      const { data: made, error: makeErr } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: person!.full_name },
      })
      if (made?.user) {
        userId = made.user.id
        createdNow = true
      } else if (adminRow) {
        // Un administrador que ya tiene cuenta (otra generación): se verifica su contraseña y se enlaza.
        const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: signed } = await anon.auth.signInWithPassword({ email, password })
        if (!signed?.user) return fail('Ese correo ya tiene cuenta y la contraseña no coincide.')
        userId = signed.user.id
      } else {
        const msg = makeErr?.message || ''
        return fail(/registered|exists/i.test(msg) ? 'Ese correo ya tiene una cuenta.' : `No se pudo crear la cuenta: ${msg}`)
      }

      const patch: Record<string, unknown> = { user_id: userId }
      if (adminRow) patch.is_admin = true
      const { error: linkErr } = await db.from('people').update(patch).eq('id', person!.id).is('user_id', null)
      if (linkErr) {
        if (createdNow) await db.auth.admin.deleteUser(userId!)
        throw linkErr
      }
      await db.from('people_private').upsert({ person_id: person!.id, email }, { onConflict: 'person_id' })
      return reply({ ok: true, name: person!.full_name })
    }

    // ── Olvidé mi contraseña: correo + matrícula + código del grupo ──
    if (action === 'recover') {
      const inv = await invite(clean(body.code))
      if (!inv) return fail('El código de grupo no es válido.')
      const password = String(body.password ?? '')
      if (password.length < 6) return fail('La contraseña necesita al menos 6 caracteres.')
      const person = await rosterRow(inv.generation_id, clean(body.matricula))
      if (!person?.user_id) return fail(MISMATCH)
      const { data: u } = await db.auth.admin.getUserById(person.user_id)
      if (!u?.user || (u.user.email || '').toLowerCase() !== clean(body.email).toLowerCase()) return fail(MISMATCH)
      const { error } = await db.auth.admin.updateUserById(person.user_id, { password })
      if (error) throw error
      return reply({ ok: true })
    }

    // ── Administración ──
    if (action.startsWith('admin_')) {
      const admin = await requireAdmin(req)
      if (!admin) return fail('Solo administradores.')
      const { data: person } = await db.from('people').select('id, user_id, full_name').eq('id', clean(body.person_id)).maybeSingle()
      if (!person) return fail('Esa persona no existe.')
      if (!person.user_id) return fail('Esa persona todavía no tiene cuenta.')

      if (action === 'admin_set_password') {
        const password = String(body.password ?? '')
        if (password.length < 6) return fail('La contraseña necesita al menos 6 caracteres.')
        const { error } = await db.auth.admin.updateUserById(person.user_id, { password })
        if (error) throw error
        return reply({ ok: true })
      }
      if (action === 'admin_set_email') {
        const email = clean(body.email).toLowerCase()
        if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Escribe un correo válido.')
        const { error } = await db.auth.admin.updateUserById(person.user_id, { email, email_confirm: true })
        if (error) return fail(/registered|exists/i.test(error.message) ? 'Ese correo ya tiene una cuenta.' : error.message)
        await db.from('people_private').upsert({ person_id: person.id, email }, { onConflict: 'person_id' })
        return reply({ ok: true })
      }
      // Libera el lugar: borra la cuenta para que la persona correcta pueda entrar.
      if (action === 'admin_unlink') {
        if (person.user_id === admin.id) return fail('No puedes desvincular tu propia cuenta.')
        const { data: others } = await db.from('people').select('id').eq('user_id', person.user_id).neq('id', person.id)
        if (others?.length) {
          await db.from('people').update({ user_id: null, is_admin: false }).eq('id', person.id)
        } else {
          const { error } = await db.auth.admin.deleteUser(person.user_id)
          if (error) throw error
          await db.from('people').update({ is_admin: false }).eq('id', person.id)
        }
        await db.from('people_private').update({ email: null }).eq('person_id', person.id)
        return reply({ ok: true })
      }
    }

    return fail('Acción desconocida')
  } catch (e) {
    console.error(action, e)
    return fail('Algo falló del lado del servidor. Intenta de nuevo.')
  }
})
