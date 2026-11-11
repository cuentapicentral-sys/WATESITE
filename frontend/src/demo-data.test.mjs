import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoDashboardData, createDemoDayClose, createDemoMunicipalAnalytics, createDemoServiceData } from './demo-data.js'

test('demo dashboard data includes operational metrics and sample records', () => {
  const data = createDemoDashboardData()

  assert.equal(data.demoMode, true)
  assert.equal(data.containers.length, 4)
  assert.equal(data.fleet.length, 3)
  assert.equal(data.routes.length, 3)
  assert.equal(data.operations.urgent_containers, 2)
  assert.equal(data.operations.active_routes, 1)
  assert.equal(data.operations.priority[0].code, 'C-240')
})

test('demo service fixtures populate read-only operational screens', () => {
  assert.equal(createDemoServiceData('reporting', '/incidents').data.length, 2)
  assert.equal(createDemoServiceData('notifications', '/notifications').data.length, 2)
  assert.equal(createDemoServiceData('citizens', '/donations').data.length, 2)
  assert.equal(createDemoServiceData('fleet', '/fleet').data.length, 3)
})

test('demo reports provide the structures expected by their views', () => {
  const dayClose = createDemoDayClose()
  const analytics = createDemoMunicipalAnalytics()

  assert.equal(typeof dayClose.kg_collected, 'number')
  assert.equal(analytics.zones.length, 4)
  assert.equal(analytics.week.length, 7)
})
