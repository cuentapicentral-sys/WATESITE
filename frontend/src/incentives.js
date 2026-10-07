import { createCitizen, fetchCitizens, submitRecyclingPhoto } from './api.js'

export const PHOTO_POINTS = 5
const CITIZEN_KEY = 'wastewise.citizen'

export const RECYCLING_POINTS = [
  { code: 'QR-RONDA', place: 'Ronda del Sinú', zone: 'Centro', latitude: 8.7526, longitude: -75.8812 },
  { code: 'QR-BOLIVAR', place: 'Parque Simón Bolívar', zone: 'Centro', latitude: 8.7489, longitude: -75.8818 },
  { code: 'QR-MERCADO', place: 'Mercado del Centro', zone: 'Centro', latitude: 8.7558, longitude: -75.8864 },
  { code: 'QR-GRANJA', place: 'La Granja', zone: 'Norte', latitude: 8.7784, longitude: -75.8608 },
  { code: 'QR-UNICOR', place: 'Universidad de Córdoba', zone: 'Norte', latitude: 8.7892, longitude: -75.8586 },
  { code: 'QR-JIMENEZ', place: 'Villa Jiménez', zone: 'Sur', latitude: 8.7242, longitude: -75.8874 },
  { code: 'QR-ROBLES', place: 'Los Robles', zone: 'Este', latitude: 8.7504, longitude: -75.8518 },
  { code: 'QR-AMPARO', place: 'El Amparo', zone: 'Oeste', latitude: 8.7416, longitude: -75.9068 },
]

export function donationCodeFromLocation(location) {
  const params = new URLSearchParams(location.search || '')
  const query = params.get('donacion') || params.get('punto')
  if (query) return query.toUpperCase()
  const match = String(location.pathname || '').match(/\/donar\/([A-Za-z0-9-]+)/i)
  return match ? match[1].toUpperCase() : null
}

export function donationCodeFromUrl() {
  return donationCodeFromLocation(window.location)
}

export function donationLink(code) {
  return `${window.location.origin}/donar/${encodeURIComponent(code)}`
}

export function findRecyclingPoint(code) {
  const normalized = String(code || '').toUpperCase()
  return RECYCLING_POINTS.find(point => point.code === normalized) || {
    code: normalized || RECYCLING_POINTS[0].code,
    place: normalized ? 'Punto de reciclaje' : RECYCLING_POINTS[0].place,
    zone: 'Montería',
    latitude: RECYCLING_POINTS[0].latitude,
    longitude: RECYCLING_POINTS[0].longitude,
  }
}

function readCitizen() {
  try {
    return JSON.parse(localStorage.getItem(CITIZEN_KEY) || 'null')
  } catch {
    return null
  }
}

function saveCitizen(citizen) {
  localStorage.setItem(CITIZEN_KEY, JSON.stringify(citizen))
}

export function incentivesBody() {
  return `
    <section class="panel city-map-panel"><div class="panel-header"><h3>Puntos de reciclaje</h3><span class="live-pill"><i></i> Montería</span></div><div id="incentive-map" class="city-map" role="region" aria-label="Mapa de puntos de reciclaje en Montería"></div></section>
    <section class="qr-grid">${RECYCLING_POINTS.map(item => `<article class="qr-card" data-qr="${item.code}"><div class="qr-image" data-qr-target="${item.code}"></div><strong>${item.place}</strong><span>${item.zone}</span><small>Escanear abre la página de donación · ${PHOTO_POINTS} pts</small></article>`).join('')}</section>
  `
}

function paintQr(node, text) {
  const img = document.createElement('img')
  img.alt = 'Código QR del punto de reciclaje'
  img.width = 148
  img.height = 148
  node.replaceChildren(img)
  if (window.QRCode?.toDataURL) {
    window.QRCode.toDataURL(text, { width: 148, margin: 1 }, (error, url) => {
      img.src = error ? `https://api.qrserver.com/v1/create-qr-code/?size=148x148&data=${encodeURIComponent(text)}` : url
    })
    return
  }
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=148x148&data=${encodeURIComponent(text)}`
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la foto'))
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, 900 / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      image.onerror = () => reject(new Error('La foto no es válida'))
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export function mountIncentives() {
  const mapNode = document.getElementById('incentive-map')
  if (mapNode && window.L) {
    if (window.wastewiseIncentiveMap) {
      window.wastewiseIncentiveMap.remove()
      window.wastewiseIncentiveMap = null
    }
    const map = window.L.map(mapNode).setView([8.74798, -75.88143], 13)
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap · Montería, Córdoba',
    }).addTo(map)
    RECYCLING_POINTS.forEach(point => {
      const marker = window.L.marker([point.latitude, point.longitude]).addTo(map)
      marker.bindPopup(`<strong>${point.place}</strong><br>${point.zone}<br>${point.code}`)
    })
    window.wastewiseIncentiveMap = map
    setTimeout(() => map.invalidateSize(), 180)
  }
  document.querySelectorAll('[data-qr-target]').forEach(node => {
    paintQr(node, donationLink(node.dataset.qrTarget))
  })
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

async function ensureCitizen(name, phone) {
  phone = normalizePhone(phone)
  const stored = readCitizen()
  if (stored?.id && stored.phone === phone && stored.name === name) return stored
  const existing = await fetchCitizens().catch(() => ({ data: [] }))
  const match = (existing.data || []).find(citizen => String(citizen.phone || '') === phone || String(citizen.name || '').includes(`#${phone}`))
  if (match) {
    const citizen = { id: match.id, name: match.name.split(' #')[0], phone, points: match.points || 0 }
    saveCitizen(citizen)
    return citizen
  }
  const created = await createCitizen({ name, phone })
  const citizen = { id: created.data.id, name, phone, points: created.data.points || 0 }
  saveCitizen(citizen)
  return citizen
}

export function bindDonationForm() {
  const form = document.querySelector('#donation-form')
  if (!form) return
  const preview = form.querySelector('#donation-preview')
  const previewImage = preview?.querySelector('img')
  const photoInput = form.elements.photo_url
  form.elements.photo_file.addEventListener('change', async () => {
    const file = form.elements.photo_file.files?.[0]
    if (!file) return
    try {
      if (!file.type.startsWith('image/')) throw new Error('Selecciona una foto')
      const dataUrl = await compressImage(file)
      photoInput.value = dataUrl
      if (previewImage) {
        previewImage.src = dataUrl
        preview.hidden = false
      }
    } catch (error) {
      form.elements.photo_file.value = ''
      form.dispatchEvent(new CustomEvent('donation-error', { bubbles: true, detail: error.message }))
    }
  })
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(form))
    const button = form.querySelector('button[type="submit"]')
    button.disabled = true
    try {
      if (!values.photo_url?.startsWith('data:image/')) throw new Error('Adjunta la foto de la donación')
      const citizen = await ensureCitizen(values.name.trim(), values.phone)
      const result = await submitRecyclingPhoto({
        citizen_id: citizen.id,
        qr_code: values.qr_code,
        photo_url: values.photo_url,
      })
      const updated = { ...citizen, name: values.name.trim(), phone: values.phone.trim(), points: result.total_points }
      saveCitizen(updated)
      form.querySelector('#citizen-balance').textContent = `${updated.name} ahora tiene ${updated.points} puntos.`
      form.elements.photo_file.value = ''
      photoInput.value = ''
      if (preview) preview.hidden = true
      form.dispatchEvent(new CustomEvent('donation-saved', { bubbles: true, detail: result }))
    } catch (error) {
      form.dispatchEvent(new CustomEvent('donation-error', { bubbles: true, detail: error.message }))
    } finally {
      button.disabled = false
    }
  })
}

export function renderPublicDonation(code, onToast) {
  const point = findRecyclingPoint(code)
  const citizen = readCitizen()
  const app = document.querySelector('#app')
  const balance = citizen
    ? `${citizen.name} tiene ${citizen.points || 0} puntos.`
    : 'Escribe tu nombre y celular. Si ya donaste antes, se usan los mismos puntos.'
  app.innerHTML = `
    <main class="public-donation">
      <header class="public-donation-head">
        <img class="brand-logo" src="/logo.png?v=2" alt="EcoUrbana" />
        <div>
          <p class="eyebrow">${point.zone} · ${point.code}</p>
          <h1>Donar en ${point.place}</h1>
          <p>Sube la foto del reciclaje. No hace falta entrar al panel ni pulsar otro botón. Cada foto suma ${PHOTO_POINTS} puntos.</p>
        </div>
      </header>
      <form class="panel donation-form" id="donation-form">
        <p class="form-hint" id="citizen-balance">${balance}</p>
        <input name="qr_code" type="hidden" value="${point.code}" />
        <label>Nombre<input name="name" value="${citizen?.name || ''}" placeholder="Ana López" required /></label>
        <label>Celular<input name="phone" value="${citizen?.phone || ''}" inputmode="numeric" placeholder="3001234567" required /></label>
        <label>Foto del reciclaje donado<input name="photo_file" type="file" accept="image/*" capture="environment" required /><input name="photo_url" type="hidden" /></label>
        <div class="image-preview" id="donation-preview" hidden><img alt="Vista previa de la donación" /></div>
        <button class="primary-btn" type="submit">Enviar foto y sumar ${PHOTO_POINTS} puntos</button>
      </form>
    </main>
  `
  bindDonationForm()
  document.querySelector('#donation-form')?.addEventListener('donation-saved', event => {
    onToast?.(`Listo: +${event.detail.earned_points} puntos. Total ${event.detail.total_points}`)
  })
}
