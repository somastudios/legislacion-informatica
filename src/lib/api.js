// Acceso a datos: sesión, generación activa, lecturas y cambios.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY, BUCKET } from './config.js'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

/** Lo que sabemos de quien está usando la página. */
export const me = { user: null, rows: [], person: null, gen: null, isAdmin: false, gens: [] }

const must = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

/** Llama a la función «portal» (cuentas). Lanza el mensaje de error tal cual viene. */
export async function portal(action, payload = {}) {
  const { data } = await sb.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const out = await res.json().catch(() => ({ ok: false, error: 'El servidor no respondió.' }))
  if (!out.ok) throw new Error(out.error || 'Algo falló.')
  return out
}

/** Carga sesión, mis registros y las generaciones que puedo ver. */
export async function loadMe() {
  const { data } = await sb.auth.getSession()
  me.user = data.session?.user || null
  me.rows = []
  me.gens = []
  me.person = null
  me.gen = null
  me.isAdmin = false
  if (!me.user) return me
  me.rows = must(await sb.from('people').select('*').eq('user_id', me.user.id))
  me.isAdmin = me.rows.some((r) => r.is_admin)
  me.gens = must(await sb.from('generations').select('*').order('slug', { ascending: false }))
  const saved = localStorage.getItem('liia.gen')
  pickGen(me.gens.find((g) => g.id === saved)?.id || me.rows[0]?.generation_id || me.gens[0]?.id)
  return me
}

export function pickGen(id) {
  me.gen = me.gens.find((g) => g.id === id) || null
  me.person = me.rows.find((r) => r.generation_id === id) || null
  if (id) localStorage.setItem('liia.gen', id)
  cache = null
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(/invalid/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message)
  return loadMe()
}

export async function signOut() {
  await sb.auth.signOut()
  cache = null
  return loadMe()
}

// ── Lectura de una generación completa (son pocos datos: se trae todo de una vez) ──

let cache = null
export const invalidate = () => (cache = null)

export async function loadGen(genId = me.gen?.id) {
  if (!genId) return null
  if (cache?.id === genId) return cache
  const [activities, people] = await Promise.all([
    sb.from('activities').select('*').eq('generation_id', genId).order('position').then(must),
    sb.from('people').select('*').eq('generation_id', genId).order('sort_name').then(must),
  ])
  const ids = activities.map((a) => a.id)
  const [works, members, assets] = ids.length
    ? await Promise.all([
        sb.from('works').select('*').in('activity_id', ids).order('created_at').then(must),
        sb.from('work_members').select('*').in('activity_id', ids).order('created_at').then(must),
        sb.from('assets').select('*').in('activity_id', ids).order('position').then(must),
      ])
    : [[], [], []]
  const person = new Map(people.map((p) => [p.id, p]))
  const byWork = new Map(works.map((w) => [w.id, { ...w, members: [], assets: [] }]))
  for (const m of members) byWork.get(m.work_id)?.members.push({ ...m, person: person.get(m.person_id) })
  for (const a of assets) byWork.get(a.work_id)?.assets.push(a)
  const list = [...byWork.values()]
  for (const w of list) w.members.sort((a, b) => (a.person?.sort_name || '').localeCompare(b.person?.sort_name || ''))
  cache = {
    id: genId,
    gen: me.gens.find((g) => g.id === genId),
    activities: activities.map((a) => ({ ...a, works: list.filter((w) => w.activity_id === a.id) })),
    people,
    person,
    works: byWork,
  }
  return cache
}

/** El trabajo de una persona en una actividad, si tiene. */
export const workOf = (activity, personId) => activity.works.find((w) => w.members.some((m) => m.person_id === personId)) || null

export const firstName = (p) => (p?.full_name || '').split(' ')[0]
export const shortName = (p) => {
  const t = (p?.full_name || '').split(' ')
  const sort = (p?.sort_name || '').split(' ')
  return t.length > 2 && sort.length ? `${t[0]} ${sort[0]}` : p?.full_name || ''
}

// ── Archivos ──

const urls = new Map()
export async function signedUrls(paths) {
  const need = [...new Set(paths.filter((p) => p && !urls.has(p)))]
  const demo = globalThis.__LIIA_DEMO__
  if (demo) for (const p of need) urls.set(p, demo.file(p) || '')
  else if (need.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(need, 6 * 3600)
    for (const r of data || []) if (r.signedUrl) urls.set(r.path, r.signedUrl)
  }
  return urls
}
export const urlOf = (path) => urls.get(path) || ''

export async function upload(path, blob, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true, cacheControl: '31536000' })
  if (error && !/exists/i.test(error.message)) throw new Error(`No se pudo subir el archivo: ${error.message}`)
}

/** Sube archivo y miniatura (por huella: el mismo archivo nunca se guarda dos veces) y arma la pieza. */
export async function storePiece(genId, info, bytes) {
  const path = `${genId}/${info.sha}.${info.ext || 'bin'}`
  await upload(path, new Blob([bytes], { type: info.mime }), info.mime)
  let thumb = null
  if (info.thumb) {
    thumb = `${genId}/thumbs/${info.sha}.jpg`
    await upload(thumb, info.thumb, 'image/jpeg')
  }
  return {
    kind: 'file',
    sha256: info.sha,
    storage_path: path,
    thumb_path: thumb,
    filename: info.filename,
    mime: info.mime,
    size: info.size,
    pages: info.pages,
    text_sig: info.sig,
    phash: info.phash,
  }
}

export const youtubePiece = (id) => ({ kind: 'youtube', yt_id: id, url: `https://youtu.be/${id}` })

// ── Cambios ──

export const rpc = async (fn, args) => {
  const out = must(await sb.rpc(fn, args))
  invalidate()
  return out
}

export const write = async (query) => {
  const out = must(await query)
  invalidate()
  return out
}
