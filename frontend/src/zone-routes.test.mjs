import assert from 'node:assert/strict'
import { closestIndex, routePassingBy, servingZone, vehicleZone } from './zone-routes.js'

const path = [
  { lat: 8.75, lng: -75.88 },
  { lat: 8.751, lng: -75.881 },
  { lat: 8.76, lng: -75.87 },
]

assert.equal(closestIndex(path, { lat: 8.7601, lng: -75.8701 }).index, 2)
assert.equal(vehicleZone({ state: 'en_ruta' }, 1), 'Norte')
assert.equal(servingZone('Oeste', [{ state: 'en_ruta' }, { state: 'revision' }]), 'Centro')

const traced = await routePassingBy(path, [{ code: 'C-9', latitude: 8.77, longitude: -75.90 }], async stops => {
  assert.equal(stops[1].place, 'C-9')
  return [
    { lat: stops[0].lat, lng: stops[0].lng },
    { lat: 8.77, lng: -75.90, place: 'C-9' },
    { lat: stops[2].lat, lng: stops[2].lng },
  ]
})
assert.ok(traced.some(point => point.place === 'C-9'))
console.log('zone routes ok')
