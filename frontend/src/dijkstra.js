const AVENUES = [
  [8.7186, 'Sur'],
  [8.7242, 'Villa Jiménez'],
  [8.7318, 'Cantaclaro'],
  [8.7338, 'Rancho Grande'],
  [8.7416, 'El Amparo'],
  [8.7446, 'La Pradera'],
  [8.7472, 'Alcaldía'],
  [8.7489, 'Simón Bolívar'],
  [8.7504, 'Los Robles'],
  [8.7526, 'Ronda del Sinú'],
  [8.7558, 'Mercado'],
  [8.7638, 'Patio de flota'],
  [8.7688, 'El Recreo'],
  [8.7784, 'La Granja'],
  [8.7892, 'Universidad de Córdoba'],
]
const STREETS = [
  [-75.9068, 'Oeste'],
  [-75.9012, 'Sur-oeste'],
  [-75.8874, 'Jiménez'],
  [-75.8864, 'Mercado'],
  [-75.8836, 'Alcaldía'],
  [-75.8818, 'Bolívar'],
  [-75.8812, 'Centro'],
  [-75.8742, 'Cantaclaro'],
  [-75.8706, 'Recreo'],
  [-75.8688, 'Rancho'],
  [-75.8672, 'Patio'],
  [-75.8608, 'Granja'],
  [-75.8586, 'Unicor'],
  [-75.8518, 'Robles'],
  [-75.8462, 'Pradera'],
]

function nodeId(avenueIndex, streetIndex) {
  return `a${avenueIndex}-s${streetIndex}`
}

function haversineKm(origin, destination) {
  const radius = 6371
  const latDelta = (destination.lat - origin.lat) * Math.PI / 180
  const lngDelta = (destination.lng - origin.lng) * Math.PI / 180
  const latOrigin = origin.lat * Math.PI / 180
  const latDestination = destination.lat * Math.PI / 180
  const arc = Math.sin(latDelta / 2) ** 2 + Math.cos(latOrigin) * Math.cos(latDestination) * Math.sin(lngDelta / 2) ** 2
  return 2 * radius * Math.asin(Math.sqrt(arc))
}

const nodes = {}
const adjacency = {}
AVENUES.forEach(([lat, avenue], avenueIndex) => {
  STREETS.forEach(([lng, street], streetIndex) => {
    const id = nodeId(avenueIndex, streetIndex)
    nodes[id] = { id, lat, lng, place: `${avenue} / ${street}` }
    adjacency[id] = []
  })
})
function link(left, right) {
  const weight = haversineKm(nodes[left], nodes[right])
  adjacency[left].push([right, weight])
  adjacency[right].push([left, weight])
}
AVENUES.forEach((_, avenueIndex) => {
  STREETS.forEach((__, streetIndex) => {
    const current = nodeId(avenueIndex, streetIndex)
    if (streetIndex + 1 < STREETS.length) link(current, nodeId(avenueIndex, streetIndex + 1))
    if (avenueIndex + 1 < AVENUES.length) link(current, nodeId(avenueIndex + 1, streetIndex))
  })
})

export function nearestNode(latitude, longitude) {
  const target = { lat: Number(latitude), lng: Number(longitude) }
  return Object.keys(nodes).reduce((best, id) => haversineKm(target, nodes[id]) < haversineKm(target, nodes[best]) ? id : best)
}

export function dijkstra(start, goal) {
  const distances = { [start]: 0 }
  const previous = {}
  const pending = [[0, start]]
  while (pending.length) {
    pending.sort((left, right) => left[0] - right[0])
    const [cost, node] = pending.shift()
    if (cost !== distances[node]) continue
    if (node === goal) break
    adjacency[node].forEach(([neighbor, weight]) => {
      const alternative = cost + weight
      if (alternative < (distances[neighbor] ?? Infinity)) {
        distances[neighbor] = alternative
        previous[neighbor] = node
        pending.push([alternative, neighbor])
      }
    })
  }
  if (distances[goal] == null) return { path: [], distanceKm: Infinity }
  const path = [goal]
  while (path.at(-1) !== start) path.push(previous[path.at(-1)])
  path.reverse()
  return { path, distanceKm: distances[goal] }
}

function coordinates(path) {
  return path.map(id => ({ ...nodes[id] }))
}

export function shortestLoop(stops) {
  const snapped = stops.map(stop => nearestNode(stop.latitude ?? stop.lat, stop.longitude ?? stop.lng))
  const route = []
  snapped.forEach((start, index) => {
    const goal = snapped[(index + 1) % snapped.length]
    const segment = coordinates(dijkstra(start, goal).path)
    route.push(...(route.length ? segment.slice(1) : segment))
  })
  return route
}

export function planCollection(origin, stops) {
  let current = nearestNode(origin.latitude ?? origin.lat, origin.longitude ?? origin.lng)
  const remaining = stops.filter(stop => Number.isFinite(Number(stop.latitude ?? stop.lat)))
  const ordered = []
  const route = coordinates([current])
  while (remaining.length) {
    let bestIndex = 0
    let bestPath = [current]
    let bestDistance = Infinity
    remaining.forEach((stop, index) => {
      const result = dijkstra(current, nearestNode(stop.latitude ?? stop.lat, stop.longitude ?? stop.lng))
      if (result.distanceKm < bestDistance) {
        bestIndex = index
        bestPath = result.path
        bestDistance = result.distanceKm
      }
    })
    ordered.push(remaining.splice(bestIndex, 1)[0])
    route.push(...coordinates(bestPath).slice(1))
    current = bestPath.at(-1)
  }
  const back = dijkstra(current, nearestNode(origin.latitude ?? origin.lat, origin.longitude ?? origin.lng))
  route.push(...coordinates(back.path).slice(1))
  return { stops: ordered, path: route, algorithm: 'dijkstra' }
}

export function pointAlong(path, progress) {
  if (!path?.length) return { lat: 8.74798, lng: -75.88143, place: 'Montería' }
  if (path.length < 2) return { ...path[0] }
  const lengths = [0]
  for (let index = 1; index < path.length; index += 1) {
    lengths.push(lengths[index - 1] + haversineKm(path[index - 1], path[index]))
  }
  const total = lengths.at(-1) || 1
  const target = (((progress % 1) + 1) % 1) * total
  const index = Math.max(1, lengths.findIndex(length => length >= target))
  const span = lengths[index] - lengths[index - 1] || 1
  const ratio = (target - lengths[index - 1]) / span
  const origin = path[index - 1]
  const destination = path[Math.min(index, path.length - 1)]
  return {
    lat: origin.lat + (destination.lat - origin.lat) * ratio,
    lng: origin.lng + (destination.lng - origin.lng) * ratio,
    place: ratio < 0.35 ? origin.place : 'En tránsito',
  }
}

export const TRUCK_SPEED_KMH = 22

export function pointAtDistance(path, kilometers) {
  if (!path?.length) return { lat: 8.74798, lng: -75.88143, place: 'Montería' }
  if (path.length < 2) return { ...path[0] }
  const lengths = [0]
  for (let index = 1; index < path.length; index += 1) {
    lengths.push(lengths[index - 1] + haversineKm(path[index - 1], path[index]))
  }
  const total = lengths.at(-1) || 1
  const target = ((kilometers % total) + total) % total
  const index = Math.max(1, lengths.findIndex(length => length >= target))
  const span = lengths[index] - lengths[index - 1] || 1
  const ratio = (target - lengths[index - 1]) / span
  const origin = path[index - 1]
  const destination = path[Math.min(index, path.length - 1)]
  return {
    lat: origin.lat + (destination.lat - origin.lat) * ratio,
    lng: origin.lng + (destination.lng - origin.lng) * ratio,
    place: origin.place || 'Calle de Montería',
  }
}

export async function fetchDrivingRoute(stops) {
  const coords = stops
    .map(stop => `${Number(stop.lng ?? stop.longitude).toFixed(6)},${Number(stop.lat ?? stop.latitude).toFixed(6)}`)
    .join(';')
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
  if (!response.ok) throw new Error('No se pudo trazar la calle')
  const data = await response.json()
  const line = data.routes?.[0]?.geometry?.coordinates || []
  if (line.length < 2) throw new Error('La ruta no tiene calles')
  return line.map(([lng, lat]) => ({ lat, lng, place: 'Calle de Montería' }))
}
