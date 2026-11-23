// Entrar, unirse con un enlace y recuperar contraseña.
import gsap from 'gsap'
import { boil, P } from '../core/boil.js'
import { words, rise, fade } from '../core/fx.js'
import { me, portal, signIn } from '../lib/api.js'
import { esc, field, go, icon, run, toast } from '../lib/ui.js'

const afterLogin = () => {
  const next = sessionStorage.getItem('liia.next')
  sessionStorage.removeItem('liia.next')
  go(next && !next.startsWith('/entrar') ? next : '/')
}

/** Marco de dos paneles: la portada en tinta y el formulario en papel. */
function frame(root, { kicker, title, sub, form }) {
  root.innerHTML = `
    <div class="auth">
      <aside class="auth-art" data-theme="ink">
        <p class="t-label auth-kicker">Legislación Informática · Compendio</p>
        <div class="auth-logo" aria-hidden="true">
          <svg viewBox="-100 -100 200 200">${boil(P.circle(0, 0, 89.75, 44), { amp: 0.42, cls: 'draw auth-ring' })}</svg>
          <i class="auth-dot"></i>
        </div>
        <h1 class="t-display auth-h"><span class="ln">${words('Legislación')}</span><span class="ln">${words('Informática')}</span></h1>
        <p class="auth-lema">Todo lo que hicimos en el semestre, reunido en un solo lugar.</p>
      </aside>
      <section class="auth-panel">
        <div class="auth-card">
          <p class="t-label auth-step">${esc(kicker)}</p>
          <h2 class="auth-title">${esc(title)}</h2>
          ${sub ? `<p class="auth-sub">${sub}</p>` : ''}
          ${form}
        </div>
      </section>
    </div>`
  const tl = gsap.timeline()
  tl.fromTo(root.querySelector('.auth-ring'), { '--draw': 1.06 }, { '--draw': 0, duration: 1.5, ease: 'expo.inOut' }, 0.1)
  tl.fromTo(root.querySelector('.auth-dot'), { scale: 0 }, { scale: 1, duration: 0.9, ease: 'expo.out' }, 0.5)
  rise(tl, root.querySelectorAll('.auth-h .wi'), 0.35, { stagger: 0.1, duration: 1.1 })
  fade(tl, [root.querySelector('.auth-lema'), root.querySelector('.auth-card')], 0.7)
  return () => tl.kill()
}

export function login(root) {
  if (me.user) return afterLogin()
  const stop = frame(root, {
    kicker: 'Entrar',
    title: 'Qué bueno verte',
    form: `
      <form class="form" data-form>
        ${field('Correo', 'email', { type: 'email', attrs: 'required autocomplete="email" autofocus' })}
        ${field('Contraseña', 'password', { type: 'password', attrs: 'required autocomplete="current-password"' })}
        <button class="btn btn-primary btn-block" type="submit">Entrar ${icon.arrow}</button>
      </form>
      <div class="auth-links">
        <a href="#/recuperar">Olvidé mi contraseña</a>
        <p>¿Aún no tienes cuenta? Entra con el enlace de invitación de tu grupo.</p>
      </div>`,
  })
  root.querySelector('[data-form]').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    run(e.submitter, async () => {
      await signIn(f.email.trim(), f.password)
      afterLogin()
    })
  })
  return stop
}

export async function join(root, code) {
  let info
  try {
    info = await portal('peek', { code })
  } catch (e) {
    const stop = frame(root, {
      kicker: 'Invitación',
      title: 'Este enlace no funciona',
      sub: esc(e.message),
      form: `<a class="btn btn-block" href="#/entrar">Ir a entrar</a>`,
    })
    return stop
  }
  localStorage.setItem('liia.code', code)
  const admin = info.grants === 'admin'
  const stop = frame(root, {
    kicker: admin ? 'Invitación de administración' : 'Invitación',
    title: `Únete a ${info.generation.name}`,
    sub: 'Crea tu cuenta una sola vez. Después entras con tu correo y contraseña.',
    form: `
      <form class="form" data-form>
        ${admin ? `<label class="check"><input type="checkbox" name="teacher" data-teacher /> <span>Soy docente (no tengo matrícula)</span></label>` : ''}
        <div data-mat>${field('Matrícula', 'matricula', { attrs: 'inputmode="numeric" autocomplete="off" autofocus' })}
          <p class="hello" data-hello hidden></p></div>
        <div data-name hidden>${field('Nombre completo', 'name', { attrs: 'autocomplete="name"' })}</div>
        ${field('Correo', 'email', { type: 'email', attrs: 'required autocomplete="email"' })}
        ${field('Contraseña', 'password', { type: 'password', hint: 'Mínimo 6 caracteres.', attrs: 'required minlength="6" autocomplete="new-password"' })}
        <button class="btn btn-primary btn-block" type="submit">Crear mi cuenta ${icon.arrow}</button>
      </form>
      <div class="auth-links"><a href="#/entrar">Ya tengo cuenta</a></div>`,
  })
  const form = root.querySelector('[data-form]')
  const hello = root.querySelector('[data-hello]')
  const mat = form.elements.matricula

  // Con la matrícula se saluda por nombre: así cada quien confirma que es su lugar.
  let seq = 0
  const greet = async () => {
    const v = mat.value.trim()
    const n = ++seq
    if (v.length < 6) return (hello.hidden = true)
    try {
      const r = await portal('peek', { code, matricula: v })
      if (n !== seq) return
      hello.hidden = false
      hello.className = `hello ${r.person && !r.person.claimed ? 'is-ok' : 'is-bad'}`
      hello.textContent = !r.person
        ? 'No encontramos esa matrícula en la lista del grupo.'
        : r.person.claimed
          ? `${r.person.name} ya tiene cuenta. Si eres tú, entra o recupera tu contraseña.`
          : `Hola, ${r.person.name}.`
    } catch {
      hello.hidden = true
    }
  }
  mat.addEventListener('input', () => {
    clearTimeout(mat._t)
    mat._t = setTimeout(greet, 350)
  })
  root.querySelector('[data-teacher]')?.addEventListener('change', (e) => {
    root.querySelector('[data-mat]').hidden = e.target.checked
    root.querySelector('[data-name]').hidden = !e.target.checked
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(form))
    run(e.submitter, async () => {
      const teacher = !!f.teacher
      const email = f.email.trim()
      await portal('join', { code, email, password: f.password, matricula: teacher ? '' : f.matricula.trim(), name: teacher ? f.name.trim() : '' })
      await signIn(email, f.password)
      toast('Cuenta creada. Bienvenida, bienvenido.')
      afterLogin()
    })
  })
  return stop
}

export function recover(root) {
  const stop = frame(root, {
    kicker: 'Recuperar acceso',
    title: 'Nueva contraseña',
    sub: 'Confirma que eres tú con tu matrícula y el código de tu grupo. Si no lo tienes, cualquier administrador puede restablecerla.',
    form: `
      <form class="form" data-form>
        ${field('Correo', 'email', { type: 'email', attrs: 'required autocomplete="email" autofocus' })}
        ${field('Matrícula', 'matricula', { attrs: 'required inputmode="numeric" autocomplete="off"' })}
        ${field('Código del grupo', 'code', { value: localStorage.getItem('liia.code') || '', hint: 'Es la última parte del enlace de invitación.', attrs: 'required autocomplete="off"' })}
        ${field('Nueva contraseña', 'password', { type: 'password', attrs: 'required minlength="6" autocomplete="new-password"' })}
        <button class="btn btn-primary btn-block" type="submit">Cambiar contraseña ${icon.arrow}</button>
      </form>
      <div class="auth-links"><a href="#/entrar">Volver a entrar</a></div>`,
  })
  root.querySelector('[data-form]').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    run(e.submitter, async () => {
      const code = f.code.trim().split('/').pop()
      await portal('recover', { code, email: f.email.trim(), matricula: f.matricula.trim(), password: f.password })
      await signIn(f.email.trim(), f.password)
      toast('Contraseña cambiada.')
      afterLogin()
    })
  })
  return stop
}
