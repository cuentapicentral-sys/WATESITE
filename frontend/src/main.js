import './style.css'
import { createCitizen, createContainer, deleteContainer, fetchCitizens, fetchDashboardData, fetchFleetVehicles, fetchIncidents, fetchNotifications, fetchRewards, fetchServiceData, ingestSensorReading, optimizeRoute, publishNotification, redeemReward, registerQrScan, registerVehicle, reportIncident, syncSensorCycle, updateContainer, updateIncidentStatus } from './api.js'
import { getSession, loginUser, logoutUser, registerUser } from './auth.js'
import { fetchDrivingRoute, pointAtDistance, TRUCK_SPEED_KMH } from './dijkstra.js'
import { STREET_ROUTES } from './street-routes.js'
import { donationCodeFromUrl, incentivesBody, mountIncentives, renderPublicDonation } from './incentives.js'

const app = document.querySelector('#app')
const navOrder = ['dashboard', 'containers', 'sensors', 'routes', 'fleet', 'citizens', 'reporting', 'notifications', 'analytics']

const navLabels = {
  dashboard: 'Dashboard', containers: 'Contenedores', sensors: 'Sensores', routes: 'Optimizar rutas',
  fleet: 'Flota', citizens: 'Recompensas', reporting: 'Reportes ciudadanos', notifications: 'Notificaciones', analytics: 'Analítica municipal',
}

const navIcons = {
  dashboard: '⌂', containers: '▣', sensors: '⌁', routes: '⌖', fleet: '▱', citizens: '✦', reporting: '◌', notifications: '♧', analytics: '◫',
}

const fleetData = [
  { id: 'TR-01', type: 'Camión compactador', state: 'Operativo', load: '74%' },
  { id: 'TR-12', type: 'Vehículo de reciclaje', state: 'En ruta', load: '58%' },
  { id: 'TR-19', type: 'Furgón de mantenimiento', state: 'Revisión', load: '32%' },
]

const citizenData = [
  { label: 'Participación ciudadana', value: '84.6%' },
  { label: 'Puntos canjeados', value: '12.4k' },
  { label: 'Nuevos usuarios', value: '482' },
]

const reportData = [
  { label: 'Residuos recogidos', value: '4.6 t' },
  { label: 'Eficiencia media', value: '91%' },
  { label: 'Tiempo de respuesta', value: '18 min' },
]

function getInitials(name = 'WW') {
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)

  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 220)
  }, 2600)
}

const incidentCategories = [
  'Contenedor desbordado',
  'Contenedor dañado',
  'Acumulación de residuos',
  'Vertido ilegal',
  'Vehículo obstruyendo',
  'Bache o calzada dañada',
  'Alumbrado público',
  'Mobiliario urbano dañado',
  'Olores o contaminación',
  'Animal muerto',
  'Otra incidencia',
]

function incidentFormMarkup(includeCitizen = false) {
  const categoryOptions = incidentCategories.map(category => '<option>' + category + '</option>').join('')
  const citizenField = includeCitizen ? '<label>ID ciudadano (opcional)<input name="citizen_id" placeholder="UUID del ciudadano" /></label>' : ''
  return `<form class="panel incident-form" id="incident-form"><div class="form-grid"><label>Categoría<select name="category" required>${categoryOptions}</select></label>${citizenField}<label class="wide-field custom-category-field" hidden>Describe la categoría<input name="custom_category" maxlength="60" placeholder="Ej. Alcantarilla obstruida" /></label><label class="wide-field">Descripción<textarea name="description" minlength="5" maxlength="500" placeholder="Describe lo ocurrido con el mayor detalle posible..." required></textarea></label><label>Latitud<input name="latitude" type="number" step="any" placeholder="40.4168" /></label><label>Longitud<input name="longitude" type="number" step="any" placeholder="-3.7038" /></label><label class="wide-field">Imagen<input name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /><input name="photo_url" type="hidden" /><input name="photo_url_external" type="url" placeholder="O pega una URL de imagen (opcional)" /><small class="form-hint">Formatos JPG, PNG, WEBP o GIF. Máximo 5 MB.</small><div class="image-preview" hidden><img alt="Vista previa de la imagen adjunta" /><button class="chip" type="button" data-remove-image>Quitar imagen</button></div></label></div><button class="primary-btn" type="submit">Enviar incidencia</button></form>`
}

function exportDashboardData(data) {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'wastewise-dashboard-export.json'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  showToast('Reporte exportado correctamente')
}

function renderAuth(mode = 'login', feedback = '') {
  const isRegister = mode === 'register'
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-art">
        <div class="auth-art-glow glow-one"></div>
        <div class="auth-art-glow glow-two"></div>
        <div class="auth-brand"><img class="brand-logo" src="/logo.png?v=2" alt="EcoUrbana" /></div>
        <div class="auth-art-copy">
          <span class="auth-kicker">Municipal operations platform</span>
          <h1>Una ciudad más limpia empieza con mejores decisiones.</h1>
          <p>Supervisa cada ruta, contenedor y señal de tu operación desde un solo lugar.</p>
        </div>
        <div class="auth-signal"><span class="signal-dot"></span><span>Operaciones conectadas</span><strong>24/7</strong></div>
      </section>
      <section class="auth-panel">
        <div class="auth-panel-top"><span class="auth-mini-label">WASTEWISE / 01</span><span class="auth-status"><i></i> Sistema activo</span></div>
        <div class="auth-heading">
          <span class="eyebrow">${isRegister ? 'Nuevo perfil' : 'Bienvenido de vuelta'}</span>
          <h2>${isRegister ? 'Crea tu cuenta' : 'Entra a tu panel'}</h2>
          <p>${isRegister ? 'Configura tu acceso operativo en menos de un minuto.' : 'Tus operaciones municipales, en un vistazo.'}</p>
        </div>
        ${feedback ? `<div class="auth-feedback" role="alert">${feedback}</div>` : ''}
        <form class="auth-form" id="auth-form">
          ${isRegister ? '<label>Nombre completo<input name="name" type="text" placeholder="María García" autocomplete="name" required /></label>' : ''}
          <label>Correo electrónico<input name="email" type="email" placeholder="tu@municipio.gov" autocomplete="email" required /></label>
          <label>Contraseña<div class="password-field"><input name="password" type="password" placeholder="Mínimo 8 caracteres" autocomplete="current-password" required /><button type="button" class="password-toggle" aria-label="Mostrar contraseña">Ver</button></div></label>
          ${isRegister ? '<label class="check-row"><input name="terms" type="checkbox" required /><span>Acepto los términos de uso y la política de privacidad.</span></label>' : '<div class="auth-options"><label class="check-row"><input name="remember" type="checkbox" checked /><span>Recordarme</span></label><button type="button" class="text-btn" id="forgot-password">¿Olvidaste tu contraseña?</button></div>'}
          <button class="auth-submit" type="submit">${isRegister ? 'Crear cuenta' : 'Acceder al dashboard'}<span>→</span></button>
        </form>
        <div class="auth-divider"><span>o</span></div>
        <button class="sso-btn" type="button" id="demo-access"><span class="sso-icon">✦</span> Continuar con acceso demo</button>
        <p class="auth-switch">${isRegister ? '¿Ya tienes una cuenta?' : '¿Todavía no tienes una cuenta?'} <button type="button" class="text-btn" id="switch-auth">${isRegister ? 'Inicia sesión' : 'Regístrate gratis'}</button></p>
        <small class="auth-note">Acceso de demostración local. Conecta Supabase Auth para producción.</small>
      </section>
    </main>
  `

  const form = app.querySelector('#auth-form')
  app.querySelector('.password-toggle').addEventListener('click', event => {
    const input = form.elements.password
    input.type = input.type === 'password' ? 'text' : 'password'
    event.currentTarget.textContent = input.type === 'password' ? 'Ver' : 'Ocultar'
  })
  app.querySelector('#switch-auth').addEventListener('click', () => renderAuth(isRegister ? 'login' : 'register'))
  app.querySelector('#demo-access').addEventListener('click', async () => {
    try {
      try {
        await loginUser('demo@wastewise.local', 'wastewise-demo')
      } catch {
        await registerUser('Operador Demo', 'demo@wastewise.local', 'wastewise-demo')
        await loginUser('demo@wastewise.local', 'wastewise-demo')
      }
      renderDashboard()
    } catch (error) {
      renderAuth('login', error.message)
    }
  })
  app.querySelector('#forgot-password')?.addEventListener('click', () => renderAuth(mode, 'En un entorno real enviaremos un enlace para recuperar tu acceso.'))
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const formData = new FormData(form)
    try {
      if (isRegister) {
        await registerUser(formData.get('name'), formData.get('email'), formData.get('password'))
      } else {
        await loginUser(formData.get('email'), formData.get('password'), formData.get('remember'))
      }
      renderDashboard()
    } catch (error) {
      renderAuth(mode, error.message)
    }
  })
}

function readDemoUser() {
  return JSON.parse(localStorage.getItem('wastewise.users') || '[]').some(user => user.email === 'demo@wastewise.local')
}

const SENSOR_TICK_SECONDS = 300
let sensorCycleTimer = null

function clearSensorCycleTimer() {
  if (sensorCycleTimer) {
    clearInterval(sensorCycleTimer)
    sensorCycleTimer = null
  }
}

function clearMaps() {
  if (window.fleetMotionFrame) {
    cancelAnimationFrame(window.fleetMotionFrame)
    window.fleetMotionFrame = null
  }
  try { window.wastewiseMap?.remove() } catch { /* el mapa ya no está en pantalla */ }
  try { window.wastewiseFleetMap?.remove() } catch { /* el mapa ya no está en pantalla */ }
  try { window.wastewiseIncentiveMap?.remove() } catch { /* el mapa ya no está en pantalla */ }
  try { window.wastewiseRouteMap?.remove() } catch { /* el mapa ya no está en pantalla */ }
  window.wastewiseMap = null
  window.wastewiseFleetMap = null
  window.wastewiseIncentiveMap = null
  window.wastewiseRouteMap = null
}

function fillTone(level) {
  if (level >= 90) return 'red'
  if (level >= 75) return 'amber'
  if (level >= 40) return 'light-green'
  return 'green'
}

function sensorPhaseLabel(container) {
  if (container.phase === 'vaciado') return 'Recién vaciado'
  if (Number(container.fill_level) >= 90) return 'Listo para vaciar'
  return 'Llenándose'
}

function sensorContainersMarkup(containers) {
  if (!containers.length) return '<p class="form-hint">No hay contenedores con sensor.</p>'
  return containers.map(container => {
    const level = Number(container.fill_level) || 0
    const tone = fillTone(level)
    return `<article class="sensor-fill-row"><div class="sensor-fill-meta"><strong>${container.code}</strong><span>${container.zone}</span><em class="${tone}">${sensorPhaseLabel(container)}</em></div><div class="sensor-fill-track" aria-hidden="true"><span class="${tone}" style="width:${level}%"></span></div><b>${level}%</b></article>`
  }).join('')
}

function countFillBand(containers, min, max) {
  return containers.filter(container => {
    const level = Number(container.fill_level) || 0
    return level >= min && level <= max
  }).length
}

const MONTERIA = { lat: 8.74798, lng: -75.88143 }
const MONTERIA_SPOTS = [
  { zone: 'centro', place: 'Ronda del Sinú', lat: 8.7526, lng: -75.8812 },
  { zone: 'centro', place: 'Parque Simón Bolívar', lat: 8.7489, lng: -75.8818 },
  { zone: 'centro', place: 'Mercado del Centro', lat: 8.7558, lng: -75.8864 },
  { zone: 'centro', place: 'Alcaldía de Montería', lat: 8.7472, lng: -75.8836 },
  { zone: 'norte', place: 'La Granja', lat: 8.7784, lng: -75.8608 },
  { zone: 'norte', place: 'El Recreo', lat: 8.7688, lng: -75.8706 },
  { zone: 'norte', place: 'Universidad de Córdoba', lat: 8.7892, lng: -75.8586 },
  { zone: 'sur', place: 'Villa Jiménez', lat: 8.7242, lng: -75.8874 },
  { zone: 'sur', place: 'Cantaclaro', lat: 8.7318, lng: -75.8742 },
  { zone: 'este', place: 'Los Robles', lat: 8.7504, lng: -75.8518 },
  { zone: 'este', place: 'La Pradera', lat: 8.7446, lng: -75.8462 },
  { zone: 'oeste', place: 'El Amparo', lat: 8.7416, lng: -75.9068 },
  { zone: 'oeste', place: 'Rancho Grande', lat: 8.7338, lng: -75.8688 },
]

function isInMonteria(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 8.68 && latitude <= 8.82 && longitude >= -75.96 && longitude <= -75.82
}

function locateContainer(container) {
  const latitude = Number(container.latitude)
  const longitude = Number(container.longitude)
  if (isInMonteria(latitude, longitude)) return { ...container, latitude, longitude, place: container.place || 'Montería' }
  const zone = String(container.zone || '').toLowerCase()
  const matches = MONTERIA_SPOTS.filter(spot => zone.includes(spot.zone))
  const spots = matches.length ? matches : MONTERIA_SPOTS
  const seed = [...String(container.code || container.id || 'C')].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0)
  const spot = spots[seed % spots.length]
  return { ...container, latitude: spot.lat, longitude: spot.lng, place: spot.place }
}

function mountContainerMap(containers) {
  const node = document.getElementById('containers-map')
  if (!node || !window.L) return
  if (window.wastewiseMap) {
    window.wastewiseMap.remove()
    window.wastewiseMap = null
  }
  const map = window.L.map(node).setView([MONTERIA.lat, MONTERIA.lng], 13)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap · Montería, Córdoba',
  }).addTo(map)
  const bounds = []
  containers.map(locateContainer).forEach(container => {
    const color = container.status === 'critical' || Number(container.fill_level) >= 90 ? '#dc4a4e' : Number(container.fill_level) >= 75 ? '#d99c22' : '#1f8f5f'
    const marker = window.L.marker([container.latitude, container.longitude], {
      icon: window.L.divIcon({
        className: 'bin-marker',
        html: `<span style="background:${color}">▣</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(map)
    marker.bindPopup(`<strong>${container.code}</strong><br>${container.place} · ${container.zone}<br>Llenado ${container.fill_level}%`)
    marker.on('click', () => {
      const form = document.querySelector('#container-form')
      if (!form) return
      form.elements.id.value = container.id || ''
      form.elements.code.value = container.code || ''
      form.elements.zone.value = container.zone || ''
      form.elements.fill_level.value = container.fill_level ?? ''
      form.elements.status.value = container.status === 'critical' ? 'critical' : 'normal'
      form.elements.latitude.value = Number(container.latitude).toFixed(6)
      form.elements.longitude.value = Number(container.longitude).toFixed(6)
    })
    bounds.push([container.latitude, container.longitude])
  })
  if (bounds.length) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
  map.on('click', event => {
    const form = document.querySelector('#container-form')
    if (!form) return
    form.elements.latitude.value = event.latlng.lat.toFixed(6)
    form.elements.longitude.value = event.latlng.lng.toFixed(6)
  })
  window.wastewiseMap = map
  setTimeout(() => map.invalidateSize(), 180)
}

const FLEET_ROUTES = [
  [
    { place: 'Alcaldía', lat: 8.7472, lng: -75.8836 },
    { place: 'Ronda del Sinú', lat: 8.7526, lng: -75.8812 },
    { place: 'Mercado del Centro', lat: 8.7558, lng: -75.8864 },
    { place: 'Parque Simón Bolívar', lat: 8.7489, lng: -75.8818 },
  ],
  [
    { place: 'El Recreo', lat: 8.7688, lng: -75.8706 },
    { place: 'La Granja', lat: 8.7784, lng: -75.8608 },
    { place: 'Universidad de Córdoba', lat: 8.7892, lng: -75.8586 },
    { place: 'Terminal', lat: 8.7638, lng: -75.8672 },
  ],
  [
    { place: 'Cantaclaro', lat: 8.7318, lng: -75.8742 },
    { place: 'Villa Jiménez', lat: 8.7242, lng: -75.8874 },
    { place: 'Rancho Grande', lat: 8.7338, lng: -75.8688 },
    { place: 'Sur', lat: 8.7186, lng: -75.9012 },
  ],
  [
    { place: 'Los Robles', lat: 8.7504, lng: -75.8518 },
    { place: 'La Pradera', lat: 8.7446, lng: -75.8462 },
    { place: 'Centro', lat: 8.7526, lng: -75.8812 },
    { place: 'El Amparo', lat: 8.7416, lng: -75.9068 },
  ],
]
const FLEET_DEPOT = { place: 'Patio de flota', lat: 8.7638, lng: -75.8672 }

function vehicleIsMoving(state) {
  const value = String(state || '').toLowerCase()
  return !['revision', 'revisión', 'fuera_de_servicio', 'fuera de servicio'].includes(value)
}

function streetRoute(index) {
  return STREET_ROUTES[index % STREET_ROUTES.length].points
}

function parkedPoint() {
  return [{ lat: FLEET_DEPOT.lat, lng: FLEET_DEPOT.lng, place: FLEET_DEPOT.place }]
}

function animateTrucks(map, fleet, containers, pathFor, listId, drawPaths = true) {
  const movers = fleet.map((vehicle, index) => {
    const moving = vehicleIsMoving(vehicle.state)
    const route = moving ? pathFor(vehicle, index) : parkedPoint()
    if (drawPaths && moving && route.length > 1) {
      window.L.polyline(route.map(point => [point.lat, point.lng]), { color: '#0b7a45', weight: 5, opacity: 0.85 }).addTo(map)
    }
    const seed = [...String(vehicle.id || index)].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const start = route[0] || FLEET_DEPOT
    const marker = window.L.marker([start.lat, start.lng], {
      icon: window.L.divIcon({
        className: 'truck-marker',
        html: `<span class="${moving ? 'moving' : 'parked'}">▰</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
      zIndexOffset: 500,
    }).addTo(map)
    return { vehicle, route, marker, moving, offsetKm: ((seed % 70) / 100) * 6 }
  })
  const tick = () => {
    let container = null
    try { container = map.getContainer() } catch { return }
    if (!container || !document.body.contains(container)) return
    const now = Date.now() / 1000
    const rows = movers.map(item => {
      const traveled = item.moving ? (now / 3600) * TRUCK_SPEED_KMH + item.offsetKm : 0
      const point = pointAtDistance(item.route, traveled)
      item.marker.setLatLng([point.lat, point.lng])
      const nearby = item.moving ? containers.map(locateContainer).find(container => Math.hypot(container.latitude - point.lat, container.longitude - point.lng) < 0.0035) : null
      const action = !item.moving ? 'Detenido en patio' : nearby && Number(nearby.fill_level) >= 75 ? `Vaciando ${nearby.code}` : `En calle · ${point.place}`
      item.marker.bindPopup(`<strong>${item.vehicle.id}</strong><br>${item.vehicle.type}<br>${action}<br>${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`)
      return `<article><strong>${item.vehicle.id}</strong><span>${action}</span><small>${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</small></article>`
    })
    const list = document.getElementById(listId)
    if (list) list.innerHTML = rows.join('') || '<p class="form-hint">No hay vehículos registrados.</p>'
    window.fleetMotionFrame = requestAnimationFrame(tick)
  }
  setTimeout(() => map.invalidateSize(), 180)
  tick()
}

function mountFleetMap(fleet, containers) {
  const node = document.getElementById('fleet-map')
  if (!node || !window.L) return
  if (window.wastewiseFleetMap) {
    window.wastewiseFleetMap.remove()
    window.wastewiseFleetMap = null
  }
  const map = window.L.map(node).setView([MONTERIA.lat, MONTERIA.lng], 13)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap · Montería, Córdoba',
  }).addTo(map)
  containers.map(locateContainer).forEach(container => {
    window.L.circleMarker([container.latitude, container.longitude], {
      radius: 5,
      color: Number(container.fill_level) >= 75 ? '#dc4a4e' : '#7dcea0',
      fillOpacity: 0.85,
      weight: 1,
    }).addTo(map).bindPopup(`${container.code} · ${container.fill_level}%`)
  })
  window.wastewiseFleetMap = map
  animateTrucks(map, fleet, containers, (_vehicle, index) => streetRoute(index), 'fleet-live-list')
}

function mountRouteMotion(fleet, containers, forcedPath) {
  const node = document.getElementById('routes-map')
  if (!node || !window.L) return
  if (window.wastewiseRouteMap) {
    window.wastewiseRouteMap.remove()
    window.wastewiseRouteMap = null
  }
  const map = window.L.map(node).setView([MONTERIA.lat, MONTERIA.lng], 13)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap · calles de Montería',
  }).addTo(map)
  const path = forcedPath?.length > 8 ? forcedPath : streetRoute(0)
  if (path.length > 1) {
    const line = window.L.polyline(path.map(point => [point.lat, point.lng]), { color: '#0b7a45', weight: 5, opacity: 0.85 }).addTo(map)
    map.fitBounds(line.getBounds(), { padding: [28, 28], maxZoom: 14 })
  }
  containers.map(locateContainer).forEach(container => {
    window.L.circleMarker([container.latitude, container.longitude], {
      radius: 5,
      color: Number(container.fill_level) >= 70 ? '#dc4a4e' : '#7dcea0',
      fillOpacity: 0.85,
      weight: 1,
    }).addTo(map)
  })
  const trucks = fleet.filter(vehicleIsMoving)
  const moving = trucks.length ? trucks : [{ id: 'Ruta Dijkstra', type: 'Camión compactador', state: 'en_ruta' }]
  window.wastewiseRouteMap = map
  animateTrucks(map, moving, containers, () => path, 'routes-live-list', false)
  if (!forcedPath) {
    const urgent = containers.map(locateContainer).filter(container => Number(container.fill_level) >= 70).slice(0, 6)
    const stops = [FLEET_DEPOT, ...(urgent.length ? urgent : FLEET_ROUTES[0]), FLEET_DEPOT]
    fetchDrivingRoute(stops).then(streetPath => {
      if (!document.getElementById('routes-map')) return
      mountRouteMotion(fleet, containers, streetPath)
    }).catch(() => {})
  }
}

function getViewMarkup(view, data) {
  const { stats, containers = [], zones, routes, alerts, kpis, fleet = fleetData, citizens = citizenData, reports = reportData } = data
  const sectionTopbar = `<header class="topbar product-topbar"><label class="global-search"><span>⌕</span><input placeholder="Buscar zonas, rutas o contenedores..." aria-label="Buscar en operaciones" /></label><div class="topbar-actions"><button class="icon-btn" aria-label="Ver notificaciones">♧<i></i></button><span class="topbar-divider"></span><div class="profile-mini"><span class="user-avatar">${getInitials(getSession().name)}</span><span><strong>${getSession().name}</strong><small>${getSession().role}</small></span><b>⌄</b></div></div></header>`
  const pageIntro = (eyebrow, title, subtitle, action = '') => `${sectionTopbar}<section class="section-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="section-subtitle">${subtitle}</p></div>${action}</section>`

  if (view === 'sensors') return `
    ${pageIntro('Sensores IoT · Sensor Ingestion Service :8105', 'Monitoreo en tiempo real', 'Los contenedores se llenan en ciclo y el sensor guarda una lectura nueva cada 5 minutos. Al llegar al tope, se vacían y vuelven a empezar.', '<span class="live-pill"><i></i> Ciclo cada 5 min</span>')}
    <section class="sensor-cycle-banner"><span>Próxima actualización</span><strong id="sensor-next-tick">5:00</strong><small>Cada contenedor sube su llenado y, cuando está lleno, la siguiente lectura lo deja vacío.</small></section>
    <section class="stats-grid service-stats"><article class="stat-card"><span>Sensores activos</span><strong>${containers.length}</strong><em class="positive-text">● En ciclo</em></article><article class="stat-card"><span>Llenándose</span><strong>${containers.filter(container => container.phase !== 'vaciado' && container.fill_level < 90).length}</strong><em class="positive-text">● Subiendo</em></article><article class="stat-card"><span>En alerta</span><strong>${containers.filter(container => container.fill_level >= 75).length}</strong><em class="neutral-text">● Revisar</em></article><article class="stat-card"><span>Recién vaciados</span><strong>${containers.filter(container => container.phase === 'vaciado').length}</strong><em class="positive-text">● Recolectados</em></article></section>
    <section class="sensor-layout"><article class="panel sensor-level"><div class="panel-header"><h3>Nivel de llenado</h3><button class="chip">Ciclo de 5 min</button></div><div class="sensor-donut"><strong>${Math.round(containers.reduce((sum, item) => sum + Number(item.fill_level || 0), 0) / Math.max(containers.length, 1))}%</strong><small>Promedio</small></div><div class="sensor-legend"><span><i class="dot green"></i>0–25% <b>${countFillBand(containers, 0, 25)}</b></span><span><i class="dot light-green"></i>26–50% <b>${countFillBand(containers, 26, 50)}</b></span><span><i class="dot amber"></i>51–75% <b>${countFillBand(containers, 51, 75)}</b></span><span><i class="dot red"></i>76–100% <b>${countFillBand(containers, 76, 100)}</b></span></div></article><form class="panel service-form" id="sensor-form"><div class="panel-header"><h3>Procesar lectura</h3><span class="live-pill"><i></i> API activa</span></div><label>Contenedor<select name="container_id" required>${containers.map(container => `<option value="${container.id}">${container.code} · ${container.zone}</option>`).join('')}</select></label><label>Nivel de llenado (%)<input name="fill_level" type="number" min="0" max="100" value="92" required /></label><button class="primary-btn" type="submit">Procesar lectura</button><p class="form-hint">Puedes forzar una lectura. El ciclo automático la reemplaza en la siguiente actualización de 5 minutos.</p></form></section>
    <section class="panel sensor-fill-panel"><div class="panel-header"><h3>Llenado por contenedor</h3><span class="live-pill"><i></i> En vivo</span></div><div class="sensor-fill-list">${sensorContainersMarkup(containers)}</div></section>
    <section class="panel sensor-events"><div class="panel-header"><h3>Últimos eventos</h3><button class="chip">Ciclo actual</button></div><div class="event-grid"><span>Hora</span><span>Contenedor</span><span>Evento</span>${containers.slice(0, 6).map(container => `<time>ahora</time><strong>${container.code}</strong><span><i class="dot ${fillTone(Number(container.fill_level) || 0)}"></i>${container.phase === 'vaciado' ? 'Vaciado por recolección' : 'Lectura ' + container.fill_level + '% · llenándose'}</span>`).join('')}</div></section>`

  if (view === 'reporting') return `
    ${pageIntro('Reportes ciudadanos · Citizen Reporting Service :8106', 'Incidencias ciudadanas', 'Registra, asigna y resuelve problemas de la vía pública con seguimiento operativo.')}
    ${incidentFormMarkup()}`

  if (view === 'notifications') return `
    ${pageIntro('Notificaciones · Notification Service :8107', 'Centro de notificaciones', 'Publica alertas para los equipos municipales y consulta el feed operativo.')}
    <div class="service-layout"><form class="panel service-form" id="notification-form"><h3>Publicar notificación</h3><label>Título<input name="title" placeholder="Ej. Ruta reprogramada" required /></label><label>Mensaje<textarea name="message" placeholder="Mensaje para los operadores..." required></textarea></label><label>Severidad<select name="severity"><option value="low">Baja</option><option value="medium" selected>Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><button class="primary-btn" type="submit">Publicar alerta</button></form><article class="panel feed-panel"><div class="panel-header"><h3>Feed operativo</h3><button class="chip" id="refresh-notifications" type="button">Actualizar</button></div><div id="notifications-list">Cargando alertas…</div></article></div>`

  if (view === 'analytics') return `
    ${pageIntro('Reportes y estadísticas · Analytics Service :8108', 'Analítica municipal', 'Indicadores agregados desde contenedores, rutas, flota y ciudadanía.', '<button class="secondary-btn" id="refresh-analytics">Actualizar KPIs</button>')}
    <section class="kpi-dashboard" id="analytics-kpis"><div class="loading-card">Consultando Analytics Service...</div></section>`

  if (view === 'routes') {
    return `${pageIntro('Rutas y recorridos · Route Optimization Service :8102', 'Optimización de rutas', 'Los camiones siguen las calles reales de Montería a 22 km/h, doblando por las vías en lugar de ir en línea recta.', '<span class="live-pill"><i></i> Dijkstra</span>')}<section class="panel city-map-panel"><div class="panel-header"><h3>Recorrido en vivo</h3><span class="live-pill"><i></i> Camino mínimo</span></div><div id="routes-map" class="city-map" role="region" aria-label="Camiones recorriendo la ruta de Dijkstra en Montería"></div><div id="routes-live-list" class="fleet-live-list"></div></section><form class="route-optimizer panel" id="route-optimizer"><label>Zona<select name="zone"><option value="">Todas las zonas</option>${[...new Set(containers.map(container => container.zone))].map(zone => `<option>${zone}</option>`).join('')}</select></label><label>Máximo de paradas<input name="max_stops" type="number" min="1" max="50" value="10" /></label><button class="primary-btn" type="submit">Generar ruta óptima</button></form><section class="route-grid">${routes.map(route => `<article class="info-card route-card"><div class="route-topline"><strong>${route.route}</strong><span class="status ${route.color}">${route.status}</span></div><p>${route.area}</p><small>ETA: ${route.eta}</small></article>`).join('')}</section><div id="route-result"></div>`
  }

  if (view === 'containers') {
    return `
      ${pageIntro('Contenedores · Container Service :8101', 'Contenedores en Montería', 'Ubica cada contenedor sobre el mapa de Montería, Córdoba. Haz clic en el mapa para marcar uno nuevo.', '<button class="primary-btn" id="focus-container-form" type="button">＋ Registrar contenedor</button>')}
      <section class="stats-grid service-stats"><article class="stat-card"><span>Contenedores totales</span><strong>${containers.length}</strong><em class="positive-text">● Inventario</em></article><article class="stat-card"><span>Disponibles</span><strong>${containers.filter(container => container.status !== 'critical').length}</strong><em class="positive-text">● Operativos</em></article><article class="stat-card"><span>En mantenimiento</span><strong>1</strong><em class="neutral-text">● Programados</em></article><article class="stat-card"><span>Fuera de servicio</span><strong>${containers.filter(container => container.status === 'critical').length}</strong><em class="negative-text">● Atención</em></article></section>
      <section class="panel city-map-panel"><div class="panel-header"><h3>Mapa de Montería</h3><span class="live-pill"><i></i> Córdoba, Colombia</span></div><div id="containers-map" class="city-map" role="region" aria-label="Mapa de contenedores en Montería"></div><p class="form-hint">Los puntos verdes están operativos y los rojos requieren atención. Un clic en el mapa copia la latitud y la longitud al formulario.</p></section>
      <form class="container-form panel" id="container-form">
        <input type="hidden" name="id" />
        <input name="code" placeholder="Código (ej. C-400)" required />
        <input name="zone" placeholder="Zona (Centro, Norte, Sur, Este, Oeste)" required />
        <input name="fill_level" type="number" min="0" max="100" placeholder="Llenado %" required />
        <select name="status">
          <option value="normal">Normal</option>
          <option value="critical">Crítico</option>
        <input name="latitude" type="number" step="any" placeholder="Latitud" />
        <input name="longitude" type="number" step="any" placeholder="Longitud" />
        </select>
        <button class="primary-btn" type="submit">Guardar</button>
        <button class="secondary-btn" type="button" id="cancel-container-edit">Limpiar</button>
      </form>
      <section class="container-table panel"><div class="panel-header"><h3>Contenedores recientes</h3><button class="chip">Ver todos</button></div><div class="container-table-head"><span>ID</span><span>Ubicación</span><span>Estado</span><span>Última actualización</span></div>
        ${containers.map(container => `
          <article class="container-table-row">
            <strong>▣ ${container.code}</strong><span>${container.zone}</span><span><i class="dot ${container.status === 'critical' ? 'red' : 'green'}"></i>${container.status === 'critical' ? 'En mantenimiento' : 'Disponible'}</span><time>08:${String(Math.min(59, 12 + (container.fill_level % 40))).padStart(2, '0')}</time>
            <div class="card-actions">
              <button class="chip edit-container" data-container='${JSON.stringify(container)}'>Editar</button>
              <button class="chip warning delete-container" data-id="${container.id}">Eliminar</button>
            </div>
          </article>
        `).join('')}
      </section>
      <button class="visually-hidden" id="focus-container-anchor" type="button"></button>
    `
  }

  if (view === 'routes') {
    return `
      <section class="section-header">
        <div>
          <p class="eyebrow">Rutas</p>
          <h1>Planificación de rutas</h1>
        </div>
      </section>
      <section class="route-grid">
        ${routes.map(route => `
          <article class="info-card route-card">
            <div class="route-topline">
              <strong>${route.route}</strong>
              <span class="status ${route.color}">${route.status}</span>
            </div>
            <p>${route.area}</p>
            <small>ETA: ${route.eta}</small>
          </article>
        `).join('')}
      </section>
    `
  }

  if (view === 'fleet') {
    return `
      ${pageIntro('Recolección de residuos · Fleet Service :8103', 'Flota en Montería', 'Los vehículos en operación recorren la ciudad en tiempo real y vacían los contenedores llenos. Los que están en revisión permanecen en el patio.', '<span class="live-pill"><i></i> Tiempo real</span>')}
      <section class="stats-grid service-stats"><article class="stat-card"><span>Vehículos totales</span><strong>${fleet.length}</strong><em class="positive-text">● Registrados</em></article><article class="stat-card"><span>En operación</span><strong>${fleet.filter(vehicle => vehicleIsMoving(vehicle.state)).length}</strong><em class="positive-text">● En movimiento</em></article><article class="stat-card"><span>En ruta</span><strong>${fleet.filter(vehicle => vehicleIsMoving(vehicle.state)).length}</strong><em class="neutral-text">● En servicio</em></article><article class="stat-card"><span>En revisión</span><strong>${fleet.filter(vehicle => !vehicleIsMoving(vehicle.state)).length}</strong><em class="negative-text">● Taller</em></article></section>
      <section class="panel city-map-panel"><div class="panel-header"><h3>Mapa de la flota</h3><span class="live-pill"><i></i> Montería, Córdoba</span></div><div id="fleet-map" class="city-map" role="region" aria-label="Mapa en tiempo real de la flota en Montería"></div><div id="fleet-live-list" class="fleet-live-list"></div><p class="form-hint">La línea verde es la calle real. Los camiones la recorren despacio, a 22 km/h, y no cruzan las manzanas en línea recta.</p></section>
      <div class="service-banner"><strong>Seguimiento de camiones y conductores</strong><span>Actualiza carga, estado y asignación desde Fleet Service.</span></div>
      <form class="panel service-form" id="fleet-form">
        <h3>Registrar vehículo</h3>
        <label>Matrícula<input name="plate" placeholder="TR-99" required /></label>
        <label>Tipo<input name="type" list="vehicle-types" placeholder="Ej. Camión eléctrico" required /><datalist id="vehicle-types"><option value="Camión compactador"></option><option value="Vehículo de reciclaje"></option><option value="Furgón de mantenimiento"></option><option value="Vehículo de reparto"></option></datalist></label>
        <label>Estado<select name="state"><option value="operativo">Operativo</option><option value="en_ruta">En ruta</option><option value="revision">En revisión</option><option value="fuera_de_servicio">Fuera de servicio</option></select></label>
        <label>Carga (%)<input name="load_level" type="number" min="0" max="100" value="56" required /></label>
        <label>Conductor<input name="driver_name" placeholder="Ana López" /></label>
        <button class="primary-btn" type="submit">Guardar vehículo</button>
      </form>
      <section class="cards-grid">
        ${fleet.map(vehicle => `
          <article class="info-card">
            <h3>${vehicle.id}</h3>
            <p>${vehicle.type}</p>
            <span class="card-tag ${vehicle.state === 'Revisión' ? 'warning' : ''}">${vehicle.state}</span>
            <small>Carga: ${vehicle.load}</small>
          </article>
        `).join('')}
      </section>
    `
  }

  if (view === 'citizens') {
    return `
      ${pageIntro('Incentivos ciudadanos · Citizen Rewards Service :8104', 'Puntos por reciclar', 'Cada ubicación tiene un código QR. La persona se registra y cada foto de donación suma 5 puntos.', '<span class="live-pill"><i></i> 5 puntos por foto</span>')}
      <section class="cards-grid">
        ${citizens.map(item => `
          <article class="info-card">
            <h3>${item.value}</h3>
            <p>${item.label}</p>
          </article>
        `).join('')}
      </section>
      ${incentivesBody()}
      <div class="panel" id="citizens-panel"><h3>Ciudadanos registrados</h3><div id="citizens-list">Cargando ciudadanos…</div></div>
      <div class="panel" id="rewards-panel"><h3>Recompensas disponibles</h3><p class="form-hint">Canjea una recompensa usando el ID del ciudadano.</p><div id="rewards-list">Cargando recompensas…</div></div>
    `
  }

  if (view === 'reporting' || view === 'reports') {
    return `
      ${pageIntro('Solicitudes ciudadanas · Citizen Reporting Service :8106', 'Incidencias ciudadanas', 'Registra, asigna y resuelve problemas de la vía pública con seguimiento operativo.')}
      ${incidentFormMarkup(true)}
      <div class="panel" id="incidents-panel"><div class="panel-header"><h3>Seguimiento de incidencias</h3><button class="chip" id="refresh-incidents" type="button">Actualizar</button></div><div id="incidents-list">Cargando incidencias…</div></div>
      <section class="cards-grid">
        ${reports.map(item => `
          <article class="info-card">
            <h3>${item.value}</h3>
            <p>${item.label}</p>
          </article>
        `).join('')}
      </section>
    `
  }

  return `
    <header class="topbar product-topbar">
      <label class="global-search"><span>⌕</span><input placeholder="Buscar zonas, rutas o contenedores..." aria-label="Buscar en operaciones" /></label>
      <div class="topbar-actions"><button class="icon-btn" aria-label="Ver notificaciones">♧<i></i></button><span class="topbar-divider"></span><div class="profile-mini"><span class="user-avatar">${getInitials(getSession().name)}</span><span><strong>${getSession().name}</strong><small>${getSession().role}</small></span><b>⌄</b></div></div>
    </header>

    <section class="welcome-layout">
      <div class="welcome-copy"><p class="eyebrow">Panel principal</p><h1>Gestión de residuos y<br />servicios urbanos</h1><p>Monitoreamos, optimizamos y conectamos la ciudad con un entorno más limpio y sostenible.</p></div>
      <div class="city-visual"><div class="city-copy"><span>◒</span><strong>Más eficiencia<br />en la recolección,<br />mejor calidad<br />de vida.</strong></div><div class="city-sun"></div><div class="city-buildings"><i></i><i></i><i></i><i></i><i></i></div><div class="city-road"></div><div class="city-truck">▰</div></div>
    </section>

    <section class="overview-layout">
      <article class="overview-panel">
        <div class="overview-heading"><span>⌁</span><h3>Resumen general</h3></div>
        <div class="overview-metrics"><div><span>♧</span><strong>87.4%</strong><small>Eficiencia en recolección</small><em>↑ 5.2% vs. mes anterior</em></div><div><span>⌖</span><strong>26</strong><small>Rutas hoy</small><em>↑ 3 nuevas</em></div><div><span>▣</span><strong>4.6 t</strong><small>Residuos recolectados</small><em>↑ 12.4% vs. ayer</em></div><div><span>◒</span><strong>98%</strong><small>Zonas cubiertas</small><em>↑ 2% vs. mes anterior</em></div></div>
      </article>
      <article class="operation-status panel"><div class="panel-header"><h3>Estado de la operación</h3><span class="status-leaf">◒</span></div><div class="status-ring"><strong>87%</strong><small>En operación</small></div><div class="status-legend"><span><i class="dot green"></i>En operación <b>${fleet.length || 22}</b></span><span><i class="dot amber"></i>En mantenimiento <b>3</b></span><span><i class="dot red"></i>Fuera de servicio <b>1</b></span></div></article>
    </section>

    <section class="shortcut-grid"><button class="shortcut-card" data-view="containers"><span>▣</span><strong>${containers.length}</strong><small>Contenedores activos</small><i>›</i><div class="shortcut-lines"><em>● Disponibles <b>${Math.max(containers.length - 1, 0)}</b></em><em>● En mantenimiento <b>1</b></em></div></button><button class="shortcut-card" data-view="routes"><span>⌖</span><strong>${routes.length}</strong><small>Rutas activas <b class="today-tag">Hoy</b></small><i>›</i><div class="mini-route-progress"><b></b></div><em>22 completadas <b>4 en curso</b></em></button><button class="shortcut-card" data-view="fleet"><span>▤</span><strong>${fleet.length}</strong><small>Servicios urbanos</small><i>›</i><div class="shortcut-lines"><em>♧ Limpieza de calles <b>3</b></em><em>⌁ Mantenimiento urbano <b>2</b></em></div></button><button class="shortcut-card" data-view="notifications"><span>♧</span><strong>${alerts.length}</strong><small>Alertas activas <b class="critical-tag">${alerts.filter(alert => alert.toLowerCase().includes('crít')).length || 2} críticas</b></small><i>›</i><div class="shortcut-lines"><em>◉ Contenedor fuera de servicio <b>1h</b></em><em>◌ Retraso en ruta <b>2h</b></em></div></button></section>

    <section class="operations-lower"><article class="panel waste-capacity"><div class="panel-header"><h3>♻ Capacidad por tipo de residuo</h3><button class="chip">Últimos 7 días</button></div><div class="waste-row"><span><i class="dot green"></i>Orgánicos</span><div class="progress-wrap"><div class="progress-bar"><span style="width:72%"></span></div></div><b>72%</b><small>1.4 t</small></div><div class="waste-row"><span><i class="dot light-green"></i>Reciclables</span><div class="progress-wrap"><div class="progress-bar light"><span style="width:58%"></span></div></div><b>58%</b><small>1.1 t</small></div><div class="waste-row"><span><i class="dot gray"></i>Ordinarios</span><div class="progress-wrap"><div class="progress-bar gray"><span style="width:46%"></span></div></div><b>46%</b><small>0.8 t</small></div><div class="waste-row"><span><i class="dot navy"></i>Peligrosos</span><div class="progress-wrap"><div class="progress-bar navy"><span style="width:22%"></span></div></div><b>22%</b><small>0.4 t</small></div></article><article class="panel live-routes"><div class="panel-header"><h3>⌖ Rutas activas <small>(en tiempo real)</small></h3><button class="chip">Ver todas</button></div><div class="route-table"><div class="route-table-head"><span>Ruta</span><span>Zona</span><span>Estado</span><span>Progreso</span><span>Actualización</span></div>${routes.slice(0, 4).map(route => `<div class="route-table-row"><strong>▣ ${route.route}</strong><span>${route.area}</span><span><i class="dot green"></i>${route.status}</span><div class="table-progress"><b style="width:${route.status === 'in_progress' ? 64 : 32}%"></b></div><time>${route.eta}</time></div>`).join('')}</div></article></section>
  `
}

async function renderDashboard(selectedView = 'dashboard') {
  if (!getSession()) {
    renderAuth()
    return
  }
  clearSensorCycleTimer()
  clearMaps()

  try {
    let sensorCycle = null
    if (selectedView === 'sensors') {
      try {
        sensorCycle = await syncSensorCycle()
      } catch (error) {
        showToast(error.message, 'error')
      }
    }
    const data = await fetchDashboardData()
    if (sensorCycle?.containers?.length) {
      const cycleById = new Map(sensorCycle.containers.map(container => [String(container.id), container]))
      data.containers = data.containers.map(container => ({ ...container, ...(cycleById.get(String(container.id)) || {}) }))
    }

    app.innerHTML = `
      <div class="dashboard-shell">
        <div class="mobile-nav-bar">
          <button class="mobile-menu-toggle" aria-label="Abrir menú de secciones" type="button">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div class="mobile-brand-mini">
            <img class="brand-logo" src="/logo.png?v=2" alt="EcoUrbana" />
          </div>
          <button class="logout-btn" id="logout-mobile" aria-label="Cerrar sesión">↗</button>
        </div>

        <div class="mobile-nav-overlay" id="mobile-nav-overlay">
          <div class="mobile-nav-panel">
            <div class="mobile-nav-header">
              <span>Secciones</span>
              <button class="close-mobile-menu" id="close-mobile-menu" type="button" aria-label="Cerrar menú">✕</button>
            </div>
            <nav class="mobile-menu">
              ${navOrder.map(viewKey => `
                <button class="menu-item ${selectedView === viewKey ? 'active' : ''}" data-view="${viewKey}">
                  ${navLabels[viewKey]}
                </button>
              `).join('')}
            </nav>
          </div>
        </div>

        <aside class="sidebar">
          <div class="brand">
            <img class="brand-logo" src="/logo.png?v=2" alt="EcoUrbana, gestión de residuos y servicios urbanos" />
          </div>

          <nav class="menu">
            ${navOrder.map(viewKey => `
              <button class="menu-item ${selectedView === viewKey ? 'active' : ''}" data-view="${viewKey}">
                <span class="menu-icon">${navIcons[viewKey]}</span>${navLabels[viewKey]}
              </button>
            `).join('')}
          </nav>

          <div class="sidebar-card">
            <p class="card-label">Eficiencia</p>
            <h3>87.4%</h3>
            <div class="mini-bar"><span style="width: 87.4%"></span></div>
          </div>
          <div class="sidebar-user">
            <div class="user-avatar">${getInitials(getSession().name)}</div>
            <div class="user-details"><strong>${getSession().name}</strong><span>${getSession().role}</span></div>
            <button class="logout-btn" id="logout" aria-label="Cerrar sesión">↗</button>
          </div>
        </aside>

        <main class="main-panel">
          ${getViewMarkup(selectedView, data)}
        </main>
      </div>
    `

    const mobileNavOverlay = app.querySelector('#mobile-nav-overlay')
    const mobileMenuToggle = app.querySelector('.mobile-menu-toggle')
    const closeMobileMenu = app.querySelector('#close-mobile-menu')

    if (mobileMenuToggle && mobileNavOverlay) {
      mobileMenuToggle.addEventListener('click', () => mobileNavOverlay.classList.add('open'))
    }

    if (closeMobileMenu && mobileNavOverlay) {
      closeMobileMenu.addEventListener('click', () => mobileNavOverlay.classList.remove('open'))
    }

    if (mobileNavOverlay) {
      mobileNavOverlay.addEventListener('click', event => {
        if (event.target === mobileNavOverlay) mobileNavOverlay.classList.remove('open')
      })
    }

    const topbarExport = app.querySelector('.topbar-actions .secondary-btn')
    const topbarAlert = app.querySelector('.topbar-actions .primary-btn')

    if (topbarExport) {
      topbarExport.addEventListener('click', () => exportDashboardData(data))
    }
    if (topbarAlert) {
      topbarAlert.addEventListener('click', () => {
        renderDashboard('notifications')
        showToast('Alerta creada y publicada en el centro de control')
      })
    }

    app.querySelector('#focus-container-form')?.addEventListener('click', () => {
      app.querySelector('#container-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      app.querySelector('#container-form input[name="code"]')?.focus()
    })

    app.querySelectorAll('.menu-item').forEach(button => {
      button.addEventListener('click', () => {
        const nextView = button.dataset.view
        if (mobileNavOverlay) mobileNavOverlay.classList.remove('open')
        renderDashboard(nextView)
      })
    })

    app.querySelectorAll('.shortcut-card[data-view]').forEach(button => {
      button.addEventListener('click', () => renderDashboard(button.dataset.view))
    })

    app.querySelectorAll('.logout-btn').forEach(button => {
      button.addEventListener('click', () => {
        clearSensorCycleTimer()
        clearMaps()
        logoutUser()
        renderAuth()
      })
    })

    app.querySelectorAll('.action-card').forEach(button => {
      button.addEventListener('click', async () => {
        const label = button.querySelector('span')?.textContent || ''

        if (label.includes('Reasignar rutas')) {
          try {
            const result = await optimizeRoute({ zone: 'Centro', max_stops: 8 })
            showToast(result.status === 'optimized' ? 'Ruta reasignada con optimización automática' : 'No hubo rutas urgentes pendientes')
            renderDashboard('routes')
          } catch (error) {
            showToast(error.message, 'error')
          }
        }

        if (label.includes('Programar recogida')) {
          renderDashboard('containers')
          showToast('Listado de contenedores abierto para programación')
        }

        if (label.includes('Alertas ciudadanas')) {
          renderDashboard('reporting')
          showToast('Vista de incidencias ciudadanas abierta')
        }
      })
    })

    app.querySelector('#sensor-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      const values = Object.fromEntries(new FormData(event.currentTarget))
      try {
        const result = await ingestSensorReading({ container_id: values.container_id, fill_level: Number(values.fill_level) })
        showToast(result.published ? 'Lectura recibida: alerta crítica publicada' : 'Lectura del sensor procesada')
        renderDashboard('sensors')
      } catch (error) { showToast(error.message, 'error') }
    })

    if (selectedView === 'sensors') {
      const nextLabel = app.querySelector('#sensor-next-tick')
      let lastEpoch = Math.floor(Date.now() / 1000 / SENSOR_TICK_SECONDS)
      const paintCountdown = () => {
        const nowSeconds = Math.floor(Date.now() / 1000)
        const remain = SENSOR_TICK_SECONDS - (nowSeconds % SENSOR_TICK_SECONDS)
        if (nextLabel) nextLabel.textContent = `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}`
        const epoch = Math.floor(nowSeconds / SENSOR_TICK_SECONDS)
        if (epoch !== lastEpoch) {
          lastEpoch = epoch
          renderDashboard('sensors')
        }
      }
      paintCountdown()
      sensorCycleTimer = setInterval(paintCountdown, 1000)
    }

    app.querySelector('#route-optimizer')?.addEventListener('submit', async event => {
      event.preventDefault()
      const values = Object.fromEntries(new FormData(event.currentTarget))
      try {
        const result = await optimizeRoute({ zone: values.zone || null, max_stops: Number(values.max_stops) })
        const target = app.querySelector('#route-result')
        const km = result.distance_km != null ? ` · ${result.distance_km} km` : ''
        target.innerHTML = `<div class="success-panel"><strong>${result.status === 'optimized' ? 'Ruta por calles generada' : result.message || 'Sin paradas nuevas'}</strong><span>${result.route ? `${result.route.route_code} · ${result.stops.length} paradas · ETA ${result.route.eta}` : 'Calles de Montería'}${km}</span></div>`
        const stops = [FLEET_DEPOT, ...(result.stops || []).slice(0, 6).map(locateContainer), FLEET_DEPOT]
        fetchDrivingRoute(stops).then(streetPath => mountRouteMotion(data.fleet || [], data.containers || [], streetPath)).catch(() => showToast('No se pudo trazar la calle', 'error'))
      } catch (error) { showToast(error.message, 'error') }
    })

    app.querySelector('#fleet-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      const values = Object.fromEntries(new FormData(event.currentTarget))
      try {
        const result = await registerVehicle({
          plate: values.plate,
          type: values.type,
          state: values.state,
          load_level: Number(values.load_level),
          driver_name: values.driver_name || null,
        })
        showToast(`Vehículo ${result.data.plate} registrado`)
        event.currentTarget.reset()
        renderDashboard('fleet')
      } catch (error) { showToast(error.message, 'error') }
    })
    if (selectedView === 'routes') mountRouteMotion(data.fleet || [], data.containers || [])

    if (selectedView === 'fleet') mountFleetMap(data.fleet || [], data.containers || [])

    app.querySelector('#citizen-create-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      const values = Object.fromEntries(new FormData(event.currentTarget))
      try {
        const result = await createCitizen({ name: values.name })
        showToast(`Ciudadano creado: ${result.data.name}`)
        event.currentTarget.reset()
        renderDashboard('citizens')
      } catch (error) { showToast(error.message, 'error') }
    })

    const incidentForm = app.querySelector('#incident-form')
    if (incidentForm) {
      const categorySelect = incidentForm.elements.category
      const customCategoryField = incidentForm.querySelector('.custom-category-field')
      const customCategoryInput = incidentForm.elements.custom_category
      const imageInput = incidentForm.elements.image_file
      const photoInput = incidentForm.elements.photo_url
      const imagePreview = incidentForm.querySelector('.image-preview')
      const previewImage = imagePreview?.querySelector('img')

      const updateCustomCategory = () => {
        const isCustom = categorySelect.value === 'Otra incidencia'
        customCategoryField.hidden = !isCustom
        customCategoryInput.required = isCustom
        if (!isCustom) customCategoryInput.value = ''
      }

      categorySelect.addEventListener('change', updateCustomCategory)
      updateCustomCategory()

      imageInput.addEventListener('change', () => {
        const file = imageInput.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
          imageInput.value = ''
          showToast('Selecciona un archivo de imagen válido', 'error')
          return
        }
        if (file.size > 5 * 1024 * 1024) {
          imageInput.value = ''
          showToast('La imagen no puede superar los 5 MB', 'error')
          return
        }

        const reader = new FileReader()
        reader.addEventListener('load', () => {
          photoInput.value = reader.result
          incidentForm.elements.photo_url_external.value = ''
          previewImage.src = reader.result
          imagePreview.hidden = false
        })
        reader.readAsDataURL(file)
      })

      imagePreview?.querySelector('[data-remove-image]')?.addEventListener('click', () => {
        imageInput.value = ''
        photoInput.value = ''
        incidentForm.elements.photo_url_external.value = ''
        previewImage.removeAttribute('src')
        imagePreview.hidden = true
      })

      incidentForm.addEventListener('submit', async event => {
        event.preventDefault()
        const form = event.currentTarget
        const values = Object.fromEntries(new FormData(form))
        const category = values.category === 'Otra incidencia' ? values.custom_category : values.category
        try {
          await reportIncident({ ...values, category, citizen_id: values.citizen_id || null, photo_url: values.photo_url || values.photo_url_external || null, latitude: values.latitude ? Number(values.latitude) : null, longitude: values.longitude ? Number(values.longitude) : null })
          form.reset()
          updateCustomCategory()
          imagePreview.hidden = true
          showToast('Incidencia ciudadana registrada')
          renderDashboard('reporting')
        } catch (error) { showToast(error.message || 'No se pudo registrar la incidencia', 'error') }
      })
    }

    app.querySelector('#notification-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      try {
        await publishNotification(Object.fromEntries(new FormData(event.currentTarget)))
        event.currentTarget.reset()
        showToast('Notificación publicada en el feed operativo')
        app.querySelector('#refresh-notifications')?.click()
      } catch (error) { showToast('No se pudo publicar la notificación', 'error') }
    })

    app.querySelector('#qr-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      const values = Object.fromEntries(new FormData(event.currentTarget))
      try {
        const result = await registerQrScan(values.citizen_id, { qr_code: values.qr_code, points: Number(values.points) })
        showToast(`QR validado: ${result.earned_points} puntos sumados`)
        event.currentTarget.reset()
      } catch (error) { showToast('No se pudo validar el QR. Comprueba el ID del ciudadano.', 'error') }
    })

    const rewardsList = app.querySelector('#rewards-list')
    if (rewardsList) {
      try {
        const rewards = await fetchRewards()
        rewardsList.innerHTML = rewards.data.length ? rewards.data.map(reward => `<div class="channel-row"><span>${reward.reward_name}<small>${reward.points_cost} pts</small></span><button class="chip redeem-reward" data-reward-id="${reward.id}" data-reward-name="${reward.reward_name}" type="button">Canjear</button></div>`).join('') : '<p class="form-hint">No hay recompensas activas.</p>'
        rewardsList.querySelectorAll('.redeem-reward').forEach(button => {
          button.addEventListener('click', async () => {
            const citizenId = window.prompt(`ID del ciudadano para canjear ${button.dataset.rewardName}`)
            if (!citizenId) return
            try {
              const result = await redeemReward(citizenId.trim(), button.dataset.rewardId)
              showToast(`Recompensa canjeada: ${result.reward}`)
            } catch (error) { showToast(error.message, 'error') }
          })
        })
      } catch (error) {
        rewardsList.innerHTML = '<p class="form-hint">No se pudieron cargar las recompensas.</p>'
      }
    }

    if (selectedView === 'citizens') {
      mountIncentives()
      app.querySelector('#donation-form')?.addEventListener('donation-saved', event => {
        showToast(`Foto recibida: +${event.detail.earned_points} puntos. Total ${event.detail.total_points}`)
        renderDashboard('citizens')
      })
      app.querySelector('#donation-form')?.addEventListener('donation-error', event => showToast(event.detail, 'error'))
    }

    const citizensList = app.querySelector('#citizens-list')
    if (citizensList) {
      try {
        const citizensResult = await fetchCitizens()
        citizensList.innerHTML = citizensResult.data.length ? citizensResult.data.map(citizen => `<div class="channel-row"><span>${citizen.name}<small>${citizen.id}</small></span><b>${citizen.points} pts</b></div>`).join('') : '<p class="form-hint">Todavía no hay ciudadanos registrados.</p>'
      } catch (error) { citizensList.innerHTML = '<p class="form-hint">No se pudieron cargar los ciudadanos.</p>' }
    }

    const incidentsList = app.querySelector('#incidents-list')
    if (incidentsList) {
      const loadIncidents = async () => {
        try {
          const incidents = await fetchIncidents()
          incidentsList.innerHTML = incidents.data.length ? incidents.data.map(incident => `<div class="channel-row"><span><strong>${incident.category}</strong><small>${incident.description}</small></span><select class="incident-status" data-incident-id="${incident.id}"><option value="reported" ${incident.status === 'reported' ? 'selected' : ''}>Reportada</option><option value="assigned" ${incident.status === 'assigned' ? 'selected' : ''}>Asignada</option><option value="resolved" ${incident.status === 'resolved' ? 'selected' : ''}>Resuelta</option><option value="rejected" ${incident.status === 'rejected' ? 'selected' : ''}>Rechazada</option></select></div>`).join('') : '<p class="form-hint">No hay incidencias registradas.</p>'
          incidentsList.querySelectorAll('.incident-status').forEach(select => {
            select.addEventListener('change', async event => {
              try {
                await updateIncidentStatus(event.target.dataset.incidentId, event.target.value)
                showToast('Estado de la incidencia actualizado')
              } catch (error) { showToast(error.message, 'error') }
            })
          })
        } catch (error) { incidentsList.innerHTML = `<p class="form-hint">${error.message}</p>` }
      }
      app.querySelector('#refresh-incidents')?.addEventListener('click', loadIncidents)
      loadIncidents()
    }

    const notificationsList = app.querySelector('#notifications-list')
    if (notificationsList) {
      const loadNotifications = async () => {
        try {
          const notifications = await fetchNotifications()
          notificationsList.innerHTML = notifications.data.length ? notifications.data.map(notification => `<div class="channel-row"><span><strong>${notification.title}</strong><small>${notification.description}</small></span><b>${notification.severity}</b></div>`).join('') : '<p class="form-hint">No hay alertas publicadas.</p>'
        } catch (error) { notificationsList.innerHTML = `<p class="form-hint">${error.message}</p>` }
      }
      app.querySelector('#refresh-notifications')?.addEventListener('click', loadNotifications)
      loadNotifications()
    }

    const fleetList = app.querySelector('#fleet-list')
    if (fleetList) {
      try {
        const fleetResult = await fetchFleetVehicles()
        fleetList.innerHTML = fleetResult.data.map(vehicle => `<div class="channel-row"><span>${vehicle.plate}</span><b>${vehicle.state}</b></div>`).join('')
      } catch (error) {
        fleetList.innerHTML = '<p class="form-hint">No se pudo cargar la flota.</p>'
      }
    }

    const analyticsTarget = app.querySelector('#analytics-kpis')
    if (analyticsTarget) {
      const loadAnalytics = async () => {
        try {
          const result = await fetchServiceData('analytics', '/kpis')
          analyticsTarget.innerHTML = `<article class="stat-card"><span>Contenedores supervisados</span><strong>${result.volume.containers}</strong><em>${result.volume.critical_containers} críticos</em></article><article class="stat-card"><span>Rutas operativas</span><strong>${result.operations.routes}</strong><em>${result.operations.active_routes} en curso</em></article><article class="stat-card"><span>Flota registrada</span><strong>${result.operations.vehicles}</strong><em>Datos en vivo</em></article><article class="stat-card"><span>Puntos ciudadanos</span><strong>${result.citizen_impact.points}</strong><em>${result.citizen_impact.incidents_resolved} incidencias resueltas</em></article>`
        } catch (error) { analyticsTarget.innerHTML = `<div class="error-state"><p>${error.message}</p></div>` }
      }
      app.querySelector('#refresh-analytics')?.addEventListener('click', loadAnalytics)
      loadAnalytics()
    }

    if (selectedView === 'containers') {
      const form = app.querySelector('#container-form')
      const resetForm = () => form.reset()
      app.querySelector('#cancel-container-edit').addEventListener('click', resetForm)
      app.querySelectorAll('.edit-container').forEach(button => {
        button.addEventListener('click', () => {
          const container = JSON.parse(button.dataset.container)
          const located = locateContainer(container)
          form.elements.id.value = container.id
          form.elements.code.value = container.code
          form.elements.zone.value = container.zone
          form.elements.fill_level.value = container.fill_level
          form.elements.status.value = container.status === 'critical' ? 'critical' : 'normal'
          form.elements.latitude.value = Number(located.latitude).toFixed(6)
          form.elements.longitude.value = Number(located.longitude).toFixed(6)
          form.elements.code.focus()
        })
      })
      app.querySelectorAll('.delete-container').forEach(button => {
        button.addEventListener('click', async () => {
          if (!window.confirm('¿Eliminar este contenedor?')) return
          await deleteContainer(button.dataset.id)
          renderDashboard('containers')
        })
      })
      form.addEventListener('submit', async event => {
        event.preventDefault()
        const formData = new FormData(form)
        const id = formData.get('id')
        const draft = locateContainer({
          code: formData.get('code'),
          zone: formData.get('zone'),
          latitude: formData.get('latitude'),
          longitude: formData.get('longitude'),
        })
        const payload = {
          code: formData.get('code'),
          zone: formData.get('zone'),
          fill_level: Number(formData.get('fill_level')),
          status: formData.get('status'),
          latitude: draft.latitude,
          longitude: draft.longitude,
        }
        if (id) await updateContainer(id, payload)
        else await createContainer(payload)
        renderDashboard('containers')
      })
      mountContainerMap(data.containers || [])
      ;(data.containers || []).filter(container => container.id && !isInMonteria(Number(container.latitude), Number(container.longitude))).forEach(container => {
        const located = locateContainer(container)
        updateContainer(container.id, {
          code: container.code,
          zone: container.zone,
          fill_level: Number(container.fill_level) || 0,
          status: container.status || 'normal',
          latitude: located.latitude,
          longitude: located.longitude,
        }).catch(() => {})
      })
    }
  } catch (error) {
    app.innerHTML = `
      <div class="error-state">
        <h2>Error al cargar el dashboard</h2>
        <p>${error.message}</p>
      </div>
    `
  }
}

if (donationCodeFromUrl()) {
  renderPublicDonation(donationCodeFromUrl(), message => showToast(message))
  document.querySelector('#donation-form')?.addEventListener('donation-error', event => showToast(event.detail, 'error'))
} else {
  renderDashboard()
}
