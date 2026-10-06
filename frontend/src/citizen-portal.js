import { reportIncident, trackIncident } from './api.js'
import { mountRewardCatalog, scheduleMarkup } from './field.js'

const CATEGORIES = [
  'Contenedor desbordado',
  'Contenedor dañado',
  'Acumulación de residuos',
  'Vertido ilegal',
  'Vehículo obstruyendo',
  'Alumbrado público',
  'Otra incidencia',
]

const STATUS_LABEL = {
  reported: 'Recibida',
  assigned: 'En atención',
  en_camino: 'En camino',
  resolved: 'Resuelta',
  rejected: 'No procede',
}

export function citizenPortalRequested() {
  const params = new URLSearchParams(window.location.search)
  return params.has('ciudadano') || params.has('radicado')
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

function paintResult(node, incident) {
  if (!incident) {
    node.innerHTML = '<p class="form-hint">No encontramos ese radicado. Revisa el código, por ejemplo RAD-7K2M9Q.</p>'
    return
  }
  const key = incident.display_status || (incident.assigned_vehicle ? 'en_camino' : incident.status)
  const status = STATUS_LABEL[key] || key
  const vehicle = incident.assigned_vehicle ? `<p>El vehículo ${escapeHtml(incident.assigned_vehicle)} va hacia tu reporte.</p>` : ''
  node.innerHTML = `<article class="ticket-card"><strong>${escapeHtml(incident.tracking_code || 'Radicado')}</strong><span class="status green">${escapeHtml(status)}</span><p>${escapeHtml(incident.category)}</p>${vehicle}<small>${escapeHtml(incident.public_description || incident.description || '')}</small></article>`
}

export function renderCitizenPortal(notify = () => {}) {
  const app = document.querySelector('#app')
  const preset = new URLSearchParams(window.location.search).get('radicado') || ''
  app.innerHTML = `
    <main class="public-donation citizen-portal">
      <header class="public-donation-head">
        <img class="brand-logo" src="/logo.png?v=2" alt="EcoUrbana" />
        <div>
          <p class="eyebrow">Montería, Córdoba</p>
          <h1>Reporta y sigue tu solicitud</h1>
          <p>No necesitas cuenta de operador. Envías el reporte, guardas el radicado y consultas si ya fue atendido.</p>
        </div>
      </header>
      <section class="portal-actions">
        <a class="chip" href="?donacion=QR-RONDA">Donar reciclaje · 5 puntos</a>
        <a class="chip" href="/">Entrar como operador</a>
      </section>
      ${scheduleMarkup()}
      <section class="panel" id="rewards-list"></section>
      <form class="panel donation-form" id="citizen-report">
        <h3>Nueva solicitud</h3>
        <label>Nombre<input name="reporter_name" required placeholder="Ana López" /></label>
        <label>Celular<input name="phone" required inputmode="numeric" placeholder="3001234567" /></label>
        <label>Qué ocurrió<select name="category">${CATEGORIES.map(item => `<option>${item}</option>`).join('')}</select></label>
        <label>Descripción<textarea name="description" minlength="5" maxlength="420" required placeholder="Dónde está y qué se ve..."></textarea></label>
        <label>Foto<input name="photo_file" type="file" accept="image/*" capture="environment" /></label>
        <div class="portal-row">
          <button class="secondary-btn" type="button" id="use-location">Usar mi ubicación</button>
          <small id="location-label">Sin ubicación todavía</small>
        </div>
        <input name="latitude" type="hidden" />
        <input name="longitude" type="hidden" />
        <button class="primary-btn" type="submit">Enviar y obtener radicado</button>
      </form>
      <form class="panel donation-form" id="track-report">
        <h3>Consultar radicado</h3>
        <label>Código<input name="code" value="${escapeHtml(preset)}" placeholder="RAD-7K2M9Q" required /></label>
        <button class="secondary-btn" type="submit">Consultar estado</button>
        <div id="track-result"></div>
      </form>
    </main>
  `

  const reportForm = app.querySelector('#citizen-report')
  app.querySelector('#use-location').addEventListener('click', () => {
    if (!navigator.geolocation) {
      notify('Este navegador no comparte la ubicación', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(position => {
      reportForm.elements.latitude.value = position.coords.latitude.toFixed(6)
      reportForm.elements.longitude.value = position.coords.longitude.toFixed(6)
      app.querySelector('#location-label').textContent = `${reportForm.elements.latitude.value}, ${reportForm.elements.longitude.value}`
    }, () => notify('No se pudo leer la ubicación', 'error'))
  })

  reportForm.addEventListener('submit', async event => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(reportForm))
    const file = reportForm.elements.photo_file.files?.[0]
    let photoUrl = null
    if (file) {
      photoUrl = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(file)
      })
    }
    try {
      const result = await reportIncident({
        category: values.category,
        description: `${values.reporter_name} · ${values.phone}. ${values.description}`.slice(0, 420),
        photo_url: photoUrl,
        latitude: values.latitude ? Number(values.latitude) : null,
        longitude: values.longitude ? Number(values.longitude) : null,
      })
      const code = result.tracking_code
      notify(`Solicitud recibida. Radicado ${code}`)
      const url = new URL(window.location.href)
      url.search = `?radicado=${encodeURIComponent(code)}`
      window.history.replaceState({}, '', url)
      app.querySelector('#track-report').elements.code.value = code
      paintResult(app.querySelector('#track-result'), result.data)
    } catch (error) {
      notify(error.message || 'No se pudo enviar la solicitud', 'error')
    }
  })

  const trackForm = app.querySelector('#track-report')
  const lookup = async code => {
    const target = app.querySelector('#track-result')
    target.innerHTML = '<p class="form-hint">Consultando…</p>'
    try {
      const result = await trackIncident(code)
      paintResult(target, result.data)
    } catch (error) {
      target.innerHTML = `<p class="form-hint">${escapeHtml(error.message)}</p>`
    }
  }
  trackForm.addEventListener('submit', event => {
    event.preventDefault()
    lookup(new FormData(trackForm).get('code'))
  })
  if (preset) lookup(preset)
  mountRewardCatalog((message, type = 'error') => notify(message, type))
}
