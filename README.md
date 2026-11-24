# Legislación Informática · Compendio

Compendio web de los trabajos del semestre de Legislación Informática: propuestas, carteles, análisis y videos de todos los equipos, reunidos y presentados de forma visual. Sirve igual para cada generación nueva.

Tiene dos modos en la misma dirección:

- **Taller** (`#/`): cada quien entra con su cuenta, confirma su equipo, sube lo que falte y escribe los créditos. Los administradores corrigen lo que haga falta.
- **Presentación** (`#/ver`): se elige la generación y corre la presentación animada, con un capítulo por actividad y cada trabajo con su visor (PDF por páginas, cartel, video) y sus créditos.

## Cómo se usa

1. **Un administrador prepara la generación** en *Administración*: pega la lista (matrícula y nombre), crea las actividades e importa el zip de Moodle de cada una («Descargar todas las entregas»). Los equipos se arman solos.
2. **Cada alumno entra con el enlace de invitación del grupo**, escribe su matrícula y crea su cuenta con correo y contraseña. Lo que entregó en Moodle ya aparece en su lugar.
3. **Si algo falta**, lo sube: el sistema lo compara antes de guardarlo y, si su equipo ya lo subió, lo une a ese equipo. También puede buscar su trabajo entre los que ya están y marcar «Este es el mío».
4. **El líder de cada trabajo** edita el título, la descripción y qué hizo cada quien.
5. **Se presenta** desde `#/ver`.

Si alguien olvida su contraseña la restablece con su correo, su matrícula y el código del grupo, o se la cambia cualquier administrador.

## Cómo detecta que dos entregas son el mismo trabajo

Tres señales, en `src/lib/match.js`:

- **Mismo archivo**: huella SHA-256 idéntica.
- **Mismo video**: mismo identificador de YouTube, aunque el enlace venga dentro de un PDF o un txt.
- **Mismo contenido**: texto casi idéntico (firma MinHash) o, para carteles escaneados sin texto, imagen casi idéntica (hash perceptual).

Cuando la coincidencia es exacta une sin preguntar; cuando solo se parece, pregunta.

## Desarrollo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

## Estructura

- `src/core/`: motor de la presentación. `deck` (escenas e iris), `dot` (el punto), `boil` (trazo a mano), `hud` (índice y navegación), `fx` (entradas reutilizables).
- `src/show/`: la presentación. `scenes` arma las escenas con los datos, `viewer` muestra cada pieza, `player` monta la baraja.
- `src/app/`: el taller. `auth` (entrar, unirse, recuperar), `home`, `activity`, `work`, `admin` e `import` (zip de Moodle).
- `src/lib/`: `api` (Supabase), `match` (detección de duplicados), `files` (análisis de archivos en el navegador), `ui`.
- `src/styles/`: `main.css` (tokens y base de la presentación), `scenes.css` (escenas), `app.css` (taller).
- `supabase/migrations/`: esquema, permisos y RLS.
- `supabase/functions/portal/`: cuentas (unirse con enlace, recuperar contraseña, acciones de administración).

## Datos y privacidad

El repositorio es público, pero no contiene datos de nadie: la lista, las matrículas, los correos, los códigos de invitación y los archivos viven en Supabase. Todo está detrás de inicio de sesión y de reglas RLS: cada quien ve solo su generación, y las matrículas y correos solo los ven los administradores. Los archivos están en un bucket privado y se sirven con enlaces temporales. La llave que aparece en `src/lib/config.js` es la publicable, hecha para vivir en el navegador.

## Despliegue

GitHub Pages mediante GitHub Actions (`.github/workflows/pages.yml`) al hacer push a `main`. La primera vez hay que activar Pages en *Settings → Pages → Source: GitHub Actions*.
