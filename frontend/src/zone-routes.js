import { fetchDrivingRoute } from './dijkstra.js'
import { STREET_ROUTES } from './street-routes.js'

export const ZONE_NAMES = ['Centro', 'Norte', 'Sur', 'Este', 'Oeste']
const ZONE_CENTERS = {
  Centro: { lat: 8.7526, lng: -75.8812 },
  Norte: { lat: 8.7784, lng: -75.8608 },
  Sur: { lat: 8.7242, lng: -75.8874 },
  Este: { lat: 8.7504, lng: -75.8518 },
  Oeste: { lat: 8.7416, lng: -75.9068 },
}
const LOOP_INDEX = { Centro: 0, Norte: 1, Sur: 2, Este: 3, Oeste: 2 }
const livePaths = {}
const routeCache = new Map()

export function zoneName(value) {
  const text = String(value || '').toLowerCase()
  return ZONE_NAMES.find(zone => text.includes(zone.toLowerCase())) || null
}

export function vehicleZone(vehicle, index) {
  return zoneName(vehicle?.zone || vehicle?.area) || ZONE_NAMES[index % 4]
}

function moving(vehicle) {
  const value = String(vehicle?.state || '').toLowerCase()
  return !['revision', 'revisión', 'fuera_de_servicio', 'fuera de servicio'].includes(value)
}

function distance(left, right) {
  return (left.lat - right.lat) ** 2 + (left.lng - right.lng) ** 2
}

export function closestIndex(path, point) {
  let index = 0
  let best = Infinity
  path.forEach((node, current) => {
    const gap = distance(node, point)
    if (gap < best) {
      best = gap
      index = current
    }
  })
  return { index, distance: Math.sqrt(best) }
}

export function servingZone(containerZone, fleet) {
  const wanted = zoneName(containerZone) || 'Centro'
  const covered = new Set()
  fleet.forEach((vehicle, index) => {
    if (moving(vehicle)) covered.add(vehicleZone(vehicle, index))
  })
  if (!covered.size || covered.has(wanted)) return wanted
  return [...covered].sort((left, right) => distance(ZONE_CENTERS[left], ZONE_CENTERS[wanted]) - distance(ZONE_CENTERS[right], ZONE_CENTERS[wanted]))[0]
}

export function streetLoop(zone) {
  const named = zoneName(zone) || 'Centro'
  return STREET_ROUTES[LOOP_INDEX[named]].points.map(point => ({ ...point }))
}

export function liveZonePath(zone) {
  const named = zoneName(zone) || 'Centro'
  if (!livePaths[named]) livePaths[named] = streetLoop(named)
  return livePaths[named]
}

function pickStops(containers) {
  const newest = [...containers].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))[0]
  const fullest = [...containers].sort((left, right) => Number(right.fill_level) - Number(left.fill_level)).slice(0, 8)
  if (newest && !fullest.some(item => item.code === newest.code)) fullest.unshift(newest)
  return fullest.slice(0, 9)
}

function anchor(path, index, direction) {
  const origin = path[index]
  let cursor = index
  while (cursor >= 0 && cursor < path.length) {
    if (Math.hypot(path[cursor].lat - origin.lat, path[cursor].lng - origin.lng) > 0.0015) return path[cursor]
    cursor += direction
  }
  return path[direction > 0 ? path.length - 1 : 0]
}

export async function routePassingBy(base, stops, fetchRoute = fetchDrivingRoute) {
  let path = base.map(point => ({ ...point }))
  for (const stop of stops) {
    const point = { lat: Number(stop.latitude ?? stop.lat), lng: Number(stop.longitude ?? stop.lng) }
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue
    const hit = closestIndex(path, point)
    if (hit.distance < 0.0012) continue
    const before = anchor(path, hit.index, -1)
    const after = anchor(path, hit.index, 1)
    try {
      const detour = await fetchRoute([before, { ...point, place: stop.code || 'Contenedor' }, after])
      const start = Math.max(0, hit.index - 2)
      const end = Math.min(path.length, hit.index + 3)
      path = [...path.slice(0, start), ...detour, ...path.slice(end)]
    } catch {
      path = path
    }
  }
  return path
}

export async function adoptZoneRoutes(fleet, containers, onUpdate = () => {}) {
  const groups = new Map()
  containers.forEach(container => {
    const zone = servingZone(container.zone, fleet)
    if (!groups.has(zone)) groups.set(zone, [])
    groups.get(zone).push(container)
  })
  await Promise.all([...groups.entries()].map(async ([zone, stops]) => {
    const chosen = pickStops(stops)
    const key = `${zone}|${chosen.map(stop => `${Number(stop.latitude).toFixed(5)},${Number(stop.longitude).toFixed(5)}`).join(';')}`
    if (!routeCache.has(key)) routeCache.set(key, routePassingBy(streetLoop(zone), chosen))
    const next = await routeCache.get(key)
    const current = liveZonePath(zone)
    current.splice(0, current.length, ...next)
    onUpdate(zone, current)
  }))
}
