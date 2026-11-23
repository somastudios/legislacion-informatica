// Modo demostración (VITE_DEMO=1): responde las llamadas a Supabase con datos locales en memoria.
// Sirve para enseñar la página donde no hay red (por ejemplo, dentro de un artefacto). Nada se guarda.
import { SUPABASE_URL } from '../lib/config.js'

const BASE = new URL('./demo/', document.baseURI)
const db = await fetch(new URL('data.json', BASE)).then((r) => r.json())
const tables = { generations: [db.gen], people: db.people, people_private: db.priv, invites: db.invites, activities: db.activities, works: db.works, work_members: db.members, assets: db.assets }
const have = new Set(db.files)
const blobs = new Map()

globalThis.__LIIA_DEMO__ = {
  /** Ruta de almacenamiento → archivo local de la demostración (o null si no viene incluido). */
  file(path) {
    if (blobs.has(path)) return blobs.get(path)
    // Los archivos de la demostración llevan la huella recortada a 12 caracteres.
    const rel = path.split('/').slice(1).join('/').replace(/([0-9a-f]{12})[0-9a-f]{52}/, '$1')
    return have.has(rel) ? new URL(`files/${rel}`, BASE).href : null
  },
}

const exp = Math.floor(Date.now() / 1000) + 86400 * 30
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '')
const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'demo@ejemplo.mx', app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' }
const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', role: 'authenticated', exp })}.demo`, refresh_token: 'demo', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp, user }
try {
  localStorage.setItem(`sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`, JSON.stringify(session))
} catch {
  /* sin almacenamiento: se entra desde la pantalla de inicio con cualquier dato */
}

const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const me = () => db.people.find((p) => p.user_id === 'u1')
const myWork = (activity) => db.members.find((m) => m.activity_id === activity && m.person_id === me()?.id)?.work_id
const remove = (list, test) => {
  for (let i = list.length - 1; i >= 0; i--) if (test(list[i])) list.splice(i, 1)
}
function cleanup(work) {
  if (!work || db.members.some((m) => m.work_id === work) || db.assets.some((a) => a.work_id === work && a.origin === 'moodle')) return
  remove(db.works, (w) => w.id === work)
  remove(db.assets, (a) => a.work_id === work)
}
function addAsset(work, piece, origin) {
  const w = db.works.find((x) => x.id === work)
  db.assets.push({ id: id(), work_id: work, activity_id: w.activity_id, position: db.assets.filter((a) => a.work_id === work).length, origin, created_at: now(), ...piece })
}

const rpc = {
  find_matches: ({ p_activity, p_sha, p_yt }) =>
    db.assets.filter((a) => a.activity_id === p_activity && ((p_sha && a.sha256 === p_sha) || (p_yt && a.yt_id === p_yt))).map((a) => ({ work_id: a.work_id, reason: a.sha256 === p_sha ? 'hash' : 'youtube', score: 1 })),
  add_piece({ p_activity, p_piece, p_work }) {
    let work = p_work || myWork(p_activity)
    if (!work) {
      work = id()
      db.works.push({ id: work, activity_id: p_activity, title: p_piece.title || 'Sin título', summary: null, leader_id: me().id, position: 0, created_at: now() })
      db.members.push({ activity_id: p_activity, person_id: me().id, work_id: work, contribution: null, source: 'upload', created_at: now() })
    }
    const { title, ...piece } = p_piece
    addAsset(work, piece, 'upload')
    return work
  },
  join_work({ p_work }) {
    const w = db.works.find((x) => x.id === p_work)
    const old = myWork(w.activity_id)
    if (old === p_work) return null
    remove(db.members, (m) => m.activity_id === w.activity_id && m.person_id === me().id)
    db.members.push({ activity_id: w.activity_id, person_id: me().id, work_id: p_work, contribution: null, source: 'claim', created_at: now() })
    w.leader_id ??= me().id
    const prev = db.works.find((x) => x.id === old)
    if (prev?.leader_id === me().id) prev.leader_id = db.members.find((m) => m.work_id === old)?.person_id || null
    cleanup(old)
    return null
  },
  leave_work({ p_work }) {
    remove(db.members, (m) => m.work_id === p_work && m.person_id === me().id)
    const w = db.works.find((x) => x.id === p_work)
    if (w?.leader_id === me().id) w.leader_id = db.members.find((m) => m.work_id === p_work)?.person_id || null
    cleanup(p_work)
    return null
  },
  set_leader({ p_work, p_person }) {
    db.works.find((x) => x.id === p_work).leader_id = p_person
    return null
  },
  set_contribution({ p_work, p_text }) {
    const m = db.members.find((x) => x.work_id === p_work && x.person_id === me().id)
    if (m) m.contribution = p_text.trim() || null
    return null
  },
  admin_import({ p_activity, p_clusters }) {
    const out = { works: 0, assets: 0, members: 0 }
    for (const c of p_clusters) {
      const work = id()
      db.works.push({ id: work, activity_id: p_activity, title: c.title || 'Sin título', summary: null, leader_id: null, position: 0, created_at: now() })
      out.works++
      for (const a of c.assets) addAsset(work, a, 'moodle'), out.assets++
      for (const p of c.members)
        if (!db.members.some((m) => m.activity_id === p_activity && m.person_id === p)) db.members.push({ activity_id: p_activity, person_id: p, work_id: work, contribution: null, source: 'moodle', created_at: now() }), out.members++
    }
    return out
  },
}

// Filtros de PostgREST que usa la app: eq, in e is.null.
function matcher(params) {
  const tests = []
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k)) continue
    if (v.startsWith('eq.')) tests.push((r) => String(r[k]) === v.slice(3))
    else if (v.startsWith('in.(')) {
      const set = new Set(v.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, '')))
      tests.push((r) => set.has(String(r[k])))
    } else if (v === 'is.null') tests.push((r) => r[k] == null)
  }
  return (r) => tests.every((t) => t(r))
}

function rest(table, method, params, body) {
  const rows = tables[table]
  if (!rows) return []
  const hit = matcher(params)
  if (method === 'GET') {
    const out = rows.filter(hit)
    const order = params.get('order')
    if (order) {
      const [col, dir] = order.split('.')
      out.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1))
    }
    return out
  }
  if (method === 'PATCH') {
    const out = rows.filter(hit)
    out.forEach((r) => Object.assign(r, body))
    return out
  }
  if (method === 'DELETE') {
    const out = rows.filter(hit)
    remove(rows, hit)
    if (table === 'works') out.forEach((w) => (remove(db.members, (m) => m.work_id === w.id), remove(db.assets, (a) => a.work_id === w.id)))
    if (table === 'people') out.forEach((p) => remove(db.members, (m) => m.person_id === p.id))
    return out
  }
  // POST: inserta o, con on_conflict, actualiza.
  const keys = (params.get('on_conflict') || '').split(',').filter(Boolean)
  return [].concat(body).map((row) => {
    const old = keys.length && rows.find((r) => keys.every((k) => r[k] === row[k]))
    if (old) return Object.assign(old, row)
    const fresh = { ...(table === 'people_private' || table === 'work_members' || table === 'invites' ? {} : { id: id() }), created_at: now(), ...row }
    rows.push(fresh)
    return fresh
  })
}

const json = (body) => new Response(JSON.stringify(body ?? null), { status: 200, headers: { 'Content-Type': 'application/json' } })
const real = window.fetch.bind(window)

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href)
  if (url.origin !== SUPABASE_URL) return real(input, init)
  const method = (init.method || 'GET').toUpperCase()
  const body = typeof init.body === 'string' ? JSON.parse(init.body || 'null') : init.body
  const path = url.pathname
  if (path.startsWith('/auth/v1/user')) return json(user)
  if (path.startsWith('/auth/v1/logout')) return json({})
  if (path.startsWith('/auth/v1/')) return json(session)
  if (path.startsWith('/functions/v1/portal')) {
    if (body.action !== 'peek') return json({ ok: true, name: me()?.full_name })
    const p = body.matricula ? db.people.find((x) => db.priv.find((r) => r.person_id === x.id)?.matricula === body.matricula) : undefined
    return json({ ok: true, generation: { name: db.gen.name, slug: db.gen.slug }, grants: String(body.code).startsWith('admin') ? 'admin' : 'member', person: body.matricula ? (p ? { name: p.full_name, claimed: !!p.user_id } : null) : undefined })
  }
  if (path.startsWith('/storage/v1/object/sign/')) return json((body.paths || []).map((p) => ({ path: p, signedURL: '/demo', error: null })))
  if (path.startsWith('/storage/v1/object/')) {
    const key = decodeURIComponent(path.split('/').slice(5).join('/'))
    const blob = init.body instanceof Blob ? init.body : init.body instanceof FormData ? [...init.body.values()].find((v) => v instanceof Blob) : null
    if (blob) blobs.set(key, URL.createObjectURL(blob))
    return json({ Key: key })
  }
  if (path.startsWith('/rest/v1/rpc/')) return json(rpc[path.split('/').pop()]?.(body || {}) ?? null)
  if (path.startsWith('/rest/v1/')) return json(rest(path.split('/').pop(), method, url.searchParams, body))
  return json({})
}
