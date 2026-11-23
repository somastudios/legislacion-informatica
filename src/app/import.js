// Importador de Moodle: lee el zip de «descargar todas las entregas», arma los equipos y los guarda.
import { analyze, extOf, sha256 } from '../lib/files.js'
import { cluster, matchPerson, sameWork, titleFromFile, ytIds } from '../lib/match.js'
import { rpc, storePiece, youtubePiece } from '../lib/api.js'

const FOLDER = /^(.+?)_(\d+)_assignsubmission_([a-z]+)_?\/(.+)$/

// Zips sin la marca UTF-8 traen los acentos rotos («CÃ³digo»): se vuelven a decodificar.
function fixName(name) {
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(name)) return name
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(name, (c) => c.charCodeAt(0)))
  } catch {
    return name
  }
}

/** Paso 1: analiza el zip y propone equipos. No guarda nada. */
export async function readMoodleZip(file, people, status = () => {}) {
  const { unzipSync } = await import('fflate')
  status('Abriendo el zip…')
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const entries = []
  const ignored = []
  for (const [path, bytes] of Object.entries(zip)) {
    if (path.endsWith('/') || !bytes.length) continue
    const m = path.match(FOLDER)
    if (!m) {
      ignored.push(path)
      continue
    }
    const name = m[4].split('/').pop()
    if (extOf(name) === 'zip') {
      // Hay quien entrega un zip con su archivo adentro.
      try {
        for (const [inner, b] of Object.entries(unzipSync(bytes))) if (!inner.endsWith('/') && b.length) entries.push({ student: m[1], name: fixName(inner.split('/').pop()), bytes: b })
      } catch {
        ignored.push(path)
      }
    } else entries.push({ student: m[1], name: fixName(name), bytes })
  }

  const byName = new Map()
  const unmatched = new Set()
  const analyzed = new Map()
  const items = []
  let n = 0
  for (const e of entries) {
    status(`Analizando ${++n} de ${entries.length}…`)
    if (!byName.has(e.student)) byName.set(e.student, matchPerson(e.student, people))
    const person = byName.get(e.student)
    if (!person) unmatched.add(e.student.replace(/\s+/g, ' '))
    const sha = await sha256(e.bytes)
    if (!analyzed.has(sha)) {
      const info = /^html?$/.test(extOf(e.name))
        ? { filename: e.name, sha, chars: 0, sig: null, phash: null, yt: ytIds(new TextDecoder().decode(e.bytes)), carrier: true }
        : await analyze(e.name, e.bytes)
      // Un PDF o txt que solo trae el enlace del video cuenta como el video, no como documento.
      info.carrier ||= info.yt.length > 0 && info.chars < 400
      info.bytes = e.bytes
      info.count = 0
      analyzed.set(sha, info)
    }
    const info = analyzed.get(sha)
    info.count++
    items.push({ person: person?.id || null, student: e.student, sha, yt: info.yt, sig: info.sig, phash: info.phash, info })
  }

  const groups = cluster(items.filter((i) => i.person)).map((g) => {
    const members = [...new Set(g.map((i) => i.person))]
    const yt = [...new Set(g.flatMap((i) => i.yt))]
    // De varias copias casi iguales (reexportadas) se queda la que más gente entregó;
    // entre una foto y el PDF del mismo cartel, gana el PDF.
    const files = []
    for (const info of [...new Set(g.map((i) => i.info))].filter((i) => !i.carrier).sort((a, b) => b.count - a.count)) {
      const k = files.findIndex((f) => sameWork({ sig: f.sig, phash: f.phash }, { sig: info.sig, phash: info.phash }))
      if (k < 0) files.push(info)
      else if (info.ext === 'pdf' && files[k].ext !== 'pdf') files[k] = info
    }
    const title = files.map((f) => titleFromFile(f.filename)).find(Boolean) || ''
    return { members, yt, files, title }
  })
  return { groups, unmatched: [...unmatched], ignored, entries: entries.length, students: new Set(items.filter((i) => i.person).map((i) => i.person)).size }
}

/** Paso 2: sube los archivos únicos y registra los equipos. */
export async function saveImport(act, genId, plan, people, status = () => {}) {
  const person = new Map(people.map((p) => [p.id, p]))
  const total = plan.groups.reduce((s, g) => s + g.files.length, 0)
  let n = 0
  const clusters = []
  for (const g of plan.groups) {
    const assets = g.yt.map((id) => youtubePiece(id))
    for (const f of g.files) {
      status(`Subiendo ${++n} de ${total}…`)
      assets.push(await storePiece(genId, f, f.bytes))
    }
    const surnames = g.members.slice(0, 2).map((id) => (person.get(id)?.sort_name || '').split(' ')[0]).filter(Boolean).join(' y ')
    clusters.push({ title: g.title || `${act.label || 'Trabajo'} · ${surnames}${g.members.length > 2 ? ' y equipo' : ''}`, members: g.members, assets })
  }
  status('Guardando equipos…')
  return rpc('admin_import', { p_activity: act.id, p_clusters: clusters })
}
