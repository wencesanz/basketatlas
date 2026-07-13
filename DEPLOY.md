# Basket Atlas — Guía de despliegue (APIs + GitHub + Vercel)

Guía paso a paso para poner el sitio en producción con datos en vivo de las 17 ligas.

---

## Arquitectura en 30 segundos

- El sitio son archivos `*.dc.html` **estáticos** (se sirven tal cual).
- Los datos en vivo vienen de **API-BASKETBALL** (api-sports.io) — 1 clave, todas las ligas.
- La clave NUNCA va en el navegador: vive en una **función serverless de Vercel**
  (`api/hoops/[...path].js`) que actúa de proxy.
- El cliente (`hoops-api.js`) llama al proxy usando la URL de `window.HOOPS_PROXY_BASE`
  definida en `nba-config.js`.
- Si el proxy no está configurado, cada página usa su **dataset estático verificado**
  (nada se rompe antes de conectar la API).

---

## PASO 1 — Consigue la clave de la API

1. Crea una cuenta gratis en **https://dashboard.api-football.com**
   (la misma cuenta da acceso a API-BASKETBALL).
2. Copia tu **API key** desde el dashboard.
   - Plan gratis: 100 peticiones/día. Suficiente para probar.
   - Plan de pago: desbloquea todas las ligas y más volumen.

> Solo con la News en vivo (página News) no necesitas clave: usa un RSS público.
> El feed se cambia en `nba-config.js` → `window.NBA_NEWS_RSS`.

---

## PASO 2 — Sube el proyecto a GitHub

Desde la carpeta del proyecto (con [git](https://git-scm.com) instalado):

```bash
git init
git add .
git commit -m "Basket Atlas inicial"
```

Crea un repositorio vacío en **https://github.com/new** (por ejemplo `basket-atlas`),
sin README, y luego enlázalo:

```bash
git branch -M main
git remote add origin https://github.com/TU-USUARIO/basket-atlas.git
git push -u origin main
```

> Consejo: NO subas ninguna clave al repo. La clave se guarda solo como variable
> de entorno en Vercel (Paso 4). El proxy ya está preparado para leerla de ahí.

---

## PASO 3 — Importa el proyecto en Vercel

1. Entra en **https://vercel.com** y regístrate con tu cuenta de GitHub.
2. **Add New… → Project** → elige el repo `basket-atlas` → **Import**.
3. Framework Preset: **Other** (es un sitio estático + funciones serverless).
4. No cambies Build/Output (déjalo vacío). Pulsa **Deploy**.

Vercel detecta automáticamente:
- Los `*.dc.html` como archivos estáticos.
- La carpeta `api/` como **funciones serverless** (tu proxy).

Al terminar tendrás una URL tipo `https://basket-atlas-xxxx.vercel.app`.

---

## PASO 4 — Configura la clave (variable de entorno)

En Vercel: **Project → Settings → Environment Variables** y añade:

| Name             | Value                                   | Entornos            |
|------------------|-----------------------------------------|---------------------|
| `APISPORTS_KEY`  | *(tu clave de api-sports.io)*           | Production, Preview |
| `ALLOWED_ORIGIN` | `https://tu-dominio.com` *(opcional)*   | Production          |

`ALLOWED_ORIGIN` es opcional; restringe qué webs pueden usar tu proxy (CORS).
Déjalo sin poner mientras pruebas.

Tras añadir variables, **redepliega**: pestaña Deployments → último deploy → **Redeploy**.

---

## PASO 5 — Apunta el sitio al proxy

Edita **`nba-config.js`** con la URL real de tu app Vercel:

```js
window.HOOPS_PROXY_BASE = "https://TU-APP.vercel.app/api/hoops";
```

Guarda, haz commit y push:

```bash
git add nba-config.js
git commit -m "Conectar proxy de producción"
git push
```

Vercel redepliega solo con cada push a `main`.

---

## PASO 6 — Verifica

1. Abre **`Environment.dc.html`** en tu sitio desplegado.
   Hace ping al proxy, muestra el estado y ejecuta una búsqueda de jugador en vivo.
2. Comprueba directamente el proxy en el navegador:
   - `https://TU-APP.vercel.app/api/hoops` → `{ ok: true, ... }`
   - `https://TU-APP.vercel.app/api/hoops/leagues` → JSON de ligas.
3. Navega por League / Home / Players: deberían mostrar datos en vivo.
   Si algo falla, cae automáticamente al dataset estático.

---

## Qué está en vivo por página

| Página     | Datos en vivo                                  |
|------------|------------------------------------------------|
| League     | Clasificación, partidos de hoy, líderes        |
| Home       | Marcadores del día                             |
| Players    | Tarjetas con medias de temporada               |
| News       | Titulares vía RSS (sin clave)                  |
| Transfers  | Se detectan diffeando plantillas (curado)      |

---

## Solución de problemas

- **403 "Endpoint no permitido"** → el endpoint no está en la lista `ALLOW` del proxy
  (`api/hoops/[...path].js`). Añádelo si necesitas otro.
- **500 "falta APISPORTS_KEY"** → no añadiste la variable, o no redeployaste tras añadirla.
- **429 Rate limit** → superaste el cupo del plan gratis (100/día). El proxy cachea
  respuestas para ahorrar cupo; sube de plan si necesitas más.
- **Datos no cambian** → la caché del edge (s-maxage) sirve respuestas unos segundos/minutos.
  Es normal y protege tu cupo.

---

## Alternativa: Cloudflare Workers

Si prefieres Cloudflare en vez de Vercel, el proyecto ya incluye
`proxy/hoops-proxy.js` (Worker equivalente). Instrucciones en `proxy/README.md`.
