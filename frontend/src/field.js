import { assignIncident, collectContainer, fetchDashboardData, fetchDayClose, fetchRewardCatalog, redeemCatalogReward } from './api.js'

const CITY = { lat: 8.74798, lng: -75.88143, minLat: 8.68, maxLat: 8.82, minLng: -75.96, maxLng: -75.82 }
const SCHEDULE = [
  { zone: 'Centro', days: 'Martes y viernes', hours: '06:00–10:00', note: 'Ronda del Sinú, Bolívar y mercado' },
  { zone: 'Norte', days: 'Lunes y jueves', hours: '06:00–10:00', note: 'La Granja, Mogambo y terminal' },
  { zone: 'Sur', days: 'Miércoles y sábado', hours: '06:00–11:00', note: 'El Recreo, Cantaclaro y Mocarí' },
  { zone: 'Este', days: 'Lunes y viernes', hours: '13:00–17:00', note: 'Villa Caribe, El Dorado y rancherías' },
  { zone: 'Oeste', days: 'Martes y sábado', hours: '13:00–17:00', note: 'P5, La Pradera y rondas del occidente' },
]

let incidentMap = null

export function clearFieldMaps() {
  if (incidentMap) {
    incidentMap.remove()
    incidentMap = null
  }
}

export function driverSheetRequested() {
  return new URLSearchParams(window.location.search).has('conductor')
}

export function scheduleMarkup() {
  return `<section class="panel schedule-card"><h3>Calendario de recolección</h3><div class="schedule-list">${SCHEDULE.map(item => `<article><strong>${item.zone}</strong><span>${item.days}</span><b>${item.hours}</b><small>${item.note}</small></article>`).join('')}</div></section>`
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

function hashString(value) {
  return [...String(value)].reduce((hash, char) => ((hash * 33) + char.charCodeAt(0)) % 100000, 7)
}

function locate(container) {
  const latitude = Number(container.latitude)
  const longitude = Number(container.longitude)
  if (latitude >= CITY.minLat && latitude <= CITY.maxLat && longitude >= CITY.minLng && longitude <= CITY.maxLng) {
    return { lat: latitude, lng: longitude }
  }
  const seed = hashString(container.code || container.id || container.area)
  return {
    lat: Number((CITY.lat + (((seed % 90) - 45) / 900)).toFixed(6)),
    lng: Number((CITY.lng + (((Math.floor(seed / 90) % 90) - 45) / 900)).toFixed(6)),
  }
}

export async function renderDriverSheet(notify = () => {}) {
  const app = document.querySelector('#app')
  const plate = localStorage.getItem('wastewise.driverPlate') || 'TR-01'
  app.innerHTML = `
    <main class="driver-sheet">
      <header>
        <img class="brand-logo" src="/logo.png?v=2" alt="EcoUrbana" />
        <div><p class="eyebrow">Hoja del conductor</p><h1>Paradas de hoy</h1></div>
      </header>
      <label>Placa<input id="driver-plate" value="${escapeHtml(plate)}" maxlength="12" /></label>
      <div id="driver-stops">Cargando paradas…</div>
      <a class="chip" href="/">Volver al centro de control</a>
    </main>
  `
  const plateInput = app.querySelector('#driver-plate')
  plateInput.addEventListener('change', () => localStorage.setItem('wastewise.driverPlate', plateInput.value.trim().toUpperCase()))
  try {
    const data = await fetchDashboardData(true)
    const stops = [...(data.containers || [])].sort((left, right) => Number(right.fill_level) - Number(left.fill_level)).slice(0, 12)
    const list = app.querySelector('#driver-stops')
    list.innerHTML = stops.map((stop, index) => {
      const point = locate(stop)
      return `<article class="driver-stop"><b>${index + 1}</b><div><strong>${escapeHtml(stop.code)}</strong><small>${escapeHtml(stop.area || 'Montería')} · ${stop.fill_level}% · ${Math.round(Number(stop.fill_level) * 1.1)} kg</small><a href="https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}" target="_blank" rel="noreferrer">Abrir en el mapa</a></div><button class="primary-btn" type="button" data-collect="${stop.id}" ${Number(stop.fill_level) === 0 ? 'disabled' : ''}>Recogido</button></article>`
    }).join('') || '<p class="form-hint">No hay contenedores para hoy.</p>'
    list.querySelectorAll('[data-collect]').forEach(button => {
      button.addEventListener('click', async () => {
        button.disabled = true
        try {
          const result = await collectContainer(button.dataset.collect, { operator: 'Conductor', vehicle_plate: plateInput.value.trim().toUpperCase() || 'TR-01' })
          button.textContent = 'Listo'
          notify(`Recogidos ${result.collected_kg || 0} kg`)
        } catch (error) {
          button.disabled = false
          notify(error.message)
        }
      })
    })
  } catch (error) {
    app.querySelector('#driver-stops').textContent = error.message
  }
}

export function incidentDeskMarkup() {
  return `<section class="panel"><div class="panel-header"><h3>Solicitudes en Montería</h3><small>Asigna un vehículo y el ciudadano verá “En camino”.</small></div><div id="incidents-map" class="city-map"></div><div id="incidents-desk" class="form-hint">Cargando solicitudes…</div></section>`
}

export function mountIncidentDesk(incidents, vehicles, notify) {
  clearFieldMaps()
  const mapNode = document.querySelector('#incidents-map')
  const desk = document.querySelector('#incidents-desk')
  if (!mapNode || !desk || typeof window.L === 'undefined') return
  const located = (incidents || []).map(item => ({ ...item, point: item.latitude && item.longitude ? { lat: Number(item.latitude), lng: Number(item.longitude) } : null })).filter(item => item.point)
  incidentMap = window.L.map(mapNode, { scrollWheelZoom: false }).setView([CITY.lat, CITY.lng], 13)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(incidentMap)
  located.forEach(item => {
    window.L.marker([item.point.lat, item.point.lng]).addTo(incidentMap).bindPopup(`<strong>${item.tracking_code || item.category}</strong><br>${item.category}`)
  })
  const plates = (vehicles || []).map(vehicle => vehicle.plate).filter(Boolean)
  const options = (plates.length ? plates : ['TR-01', 'TR-02']).map(plate => `<option>${escapeHtml(plate)}</option>`).join('')
  desk.innerHTML = (incidents || []).slice(0, 8).map(item => `<div class="channel-row"><span>${escapeHtml(item.tracking_code || 'Sin radicado')}<small>${escapeHtml(item.category)} · ${escapeHtml(item.assigned_vehicle || item.status || 'reportada')}</small></span><select data-plate="${item.id}">${options}</select><button class="chip" type="button" data-assign="${item.id}">Asignar</button></div>`).join('') || '<p class="form-hint">Todavía no hay solicitudes.</p>'
  desk.querySelectorAll('[data-assign]').forEach(button => {
    button.addEventListener('click', async () => {
      const plate = desk.querySelector(`[data-plate="${button.dataset.assign}"]`)?.value
      try {
        await assignIncident(button.dataset.assign, plate)
        notify(`Solicitud asignada a ${plate}. El ciudadano ya ve “En camino”.`)
        button.textContent = 'Asignada'
      } catch (error) {
        notify(error.message)
      }
    })
  })
  window.setTimeout(() => incidentMap?.invalidateSize(), 150)
}

export function dayCloseMarkup() {
  return `<section class="panel day-close" id="day-close"><div class="panel-header"><h3>Cierre del día</h3><button class="secondary-btn" id="print-day-close" type="button">Imprimir</button></div><div id="day-close-body">Calculando kilos, solicitudes y puntos…</div></section>`
}

export async function fillDayClose() {
  const body = document.querySelector('#day-close-body')
  if (!body) return
  try {
    const report = await fetchDayClose()
    body.innerHTML = `<div class="kpi-grid"><div class="kpi-card"><span>Kilos recogidos</span><strong>${report.kg_collected} kg</strong></div><div class="kpi-card"><span>Contenedores vaciados</span><strong>${report.containers_emptied}</strong></div><div class="kpi-card"><span>Solicitudes resueltas</span><strong>${report.requests_resolved}</strong></div><div class="kpi-card"><span>Puntos entregados</span><strong>${report.points_awarded}</strong></div></div><p class="form-hint">${report.city} · ${report.date} · ${report.points_in_circulation} puntos siguen activos entre la ciudadanía.</p>`
    document.querySelector('#print-day-close')?.addEventListener('click', () => window.print())
  } catch (error) {
    body.textContent = error.message
  }
}

export async function mountRewardCatalog(notify) {
  const list = document.querySelector('#rewards-list')
  if (!list) return
  try {
    const catalog = await fetchRewardCatalog()
    list.innerHTML = `<label>Celular del ciudadano<input id="redeem-phone" inputmode="numeric" placeholder="3001234567" /></label><div class="catalog-grid">${catalog.data.map(item => `<article><strong>${escapeHtml(item.reward_name)}</strong><b>${item.points_cost} pts</b><small>${escapeHtml(item.detail)}</small><button class="chip" type="button" data-code="${item.code}">Canjear</button></article>`).join('')}</div>`
    list.querySelectorAll('[data-code]').forEach(button => {
      button.addEventListener('click', async () => {
        const phone = list.querySelector('#redeem-phone')?.value || ''
        try {
          const result = await redeemCatalogReward({ phone, code: button.dataset.code })
          notify(`${result.reward_name} canjeada. Quedan ${result.points} puntos.`)
        } catch (error) {
          notify(error.message)
        }
      })
    })
  } catch (error) {
    list.textContent = error.message
  }
}
