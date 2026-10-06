function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

export function renderMunicipalAnalytics(node, report) {
  const summary = report.summary || {}
  const maxWeek = Math.max(1, ...(report.week || []).map(day => day.requests + day.kg))
  node.innerHTML = `
    <section class="stats-grid service-stats">
      <article class="stat-card"><span>Kilos pendientes</span><strong>${summary.pending_kg || 0} kg</strong><em>En contenedores al 75% o más</em></article>
      <article class="stat-card"><span>Recogido hoy</span><strong>${summary.kg_collected_today || 0} kg</strong><em>${summary.containers_emptied_today || 0} contenedores vaciados</em></article>
      <article class="stat-card"><span>Solicitudes</span><strong>${summary.open_requests || 0}</strong><em>${summary.en_camino || 0} en camino · ${summary.response_rate_pct ?? 0}% resueltas</em></article>
      <article class="stat-card"><span>Ciudadanía</span><strong>${summary.points || 0} pts</strong><em>${summary.citizens || 0} personas · flota ${summary.fleet_operating || 0}/${summary.fleet_total || 0}</em></article>
    </section>
    <section class="panel"><h3>Qué hacer ahora</h3><div class="decision-list">${(report.decisions || []).map(item => `<article class="decision ${escapeHtml(item.tone)}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></article>`).join('')}</div></section>
    <section class="panel"><h3>Zonas de Montería</h3><div class="zone-table">${(report.zones || []).map(zone => `<div class="zone-row"><strong>${escapeHtml(zone.zone)}</strong><span>${zone.avg_fill}% lleno</span><span>${zone.pending_kg} kg</span><span>${zone.critical} críticos</span><span>${zone.open_requests} solicitudes</span><small>${zone.collects_today ? 'Se recoge hoy' : 'Hoy no se recoge'} · ${escapeHtml(zone.schedule)}</small></div>`).join('')}</div></section>
    <section class="panel"><h3>Últimos 7 días</h3><div class="week-bars">${(report.week || []).map(day => `<div><b style="height:${Math.max(8, Math.round(((day.requests + day.kg) / maxWeek) * 72))}px"></b><span>${escapeHtml(day.date)}</span><small>${day.requests} sol. · ${day.kg} kg</small></div>`).join('')}</div><p class="form-hint">${escapeHtml(report.city || 'Montería')} · ${escapeHtml(report.date || '')}. El promedio de llenado es ${summary.avg_fill || 0}%.</p></section>
  `
}
