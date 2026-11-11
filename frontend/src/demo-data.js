const containers = [
  {
    id: 'demo-container-240',
    code: 'C-240',
    zone: 'Centro',
    container_type: 'general',
    fill_level: 92,
    status: 'critical',
    latitude: 8.7526,
    longitude: -75.8812,
    phase: 'llenándose',
  },
  {
    id: 'demo-container-155',
    code: 'C-155',
    zone: 'Norte',
    container_type: 'reciclable',
    fill_level: 64,
    status: 'normal',
    latitude: 8.7784,
    longitude: -75.8608,
    phase: 'llenándose',
  },
  {
    id: 'demo-container-311',
    code: 'C-311',
    zone: 'Sur',
    container_type: 'organica',
    fill_level: 88,
    status: 'attention',
    latitude: 8.7242,
    longitude: -75.8874,
    phase: 'llenándose',
  },
  {
    id: 'demo-container-178',
    code: 'C-178',
    zone: 'Este',
    container_type: 'vidrio',
    fill_level: 54,
    status: 'normal',
    latitude: 8.7651,
    longitude: -75.8472,
    phase: 'llenándose',
  },
]

const fleet = [
  { id: 'demo-vehicle-01', plate: 'TR-01', type: 'Camión recolector', state: 'en_ruta', load_level: 62, load: '62%' },
  { id: 'demo-vehicle-02', plate: 'TR-02', type: 'Camión recolector', state: 'operativo', load_level: 35, load: '35%' },
  { id: 'demo-vehicle-03', plate: 'TR-03', type: 'Camión recolector', state: 'revision', load_level: 0, load: '0%' },
]

const routes = [
  {
    route: 'R-204',
    area: 'Centro',
    eta: '12 min',
    status_code: 'in_progress',
    vehicle_id: 'demo-vehicle-01',
    vehicle_plate: 'TR-01',
    status: 'En progreso',
    color: 'green',
  },
  {
    route: 'R-118',
    area: 'Norte',
    eta: '18 min',
    status_code: 'scheduled',
    vehicle_id: 'demo-vehicle-02',
    vehicle_plate: 'TR-02',
    status: 'Programada',
    color: 'blue',
  },
  {
    route: 'R-330',
    area: 'Sur',
    eta: '10 min',
    status_code: 'urgent',
    vehicle_id: null,
    vehicle_plate: null,
    status: 'Urgente',
    color: 'red',
  },
]

const incidents = [
  {
    id: 'demo-incident-01',
    tracking_code: 'RAD-DEMO-01',
    category: 'Contenedor desbordado',
    description: 'Ejemplo de reporte ciudadano en el Centro.',
    public_description: 'Contenedor con residuos por fuera.',
    status: 'assigned',
    display_status: 'en_camino',
    assigned_vehicle: 'TR-01',
    latitude: 8.7526,
    longitude: -75.8812,
  },
  {
    id: 'demo-incident-02',
    tracking_code: 'RAD-DEMO-02',
    category: 'Acumulación de residuos',
    description: 'Ejemplo de solicitud pendiente en la zona Sur.',
    public_description: 'Residuos acumulados junto al parque.',
    status: 'reported',
    latitude: 8.7242,
    longitude: -75.8874,
  },
]

const citizens = [
  { id: 'demo-citizen-01', name: 'Laura Ejemplo', points: 35, phone: '3000000001' },
  { id: 'demo-citizen-02', name: 'Andrés Muestra', points: 20, phone: '3000000002' },
]

const notifications = [
  {
    id: 'demo-notification-01',
    title: 'Nivel crítico en C-240',
    description: 'El contenedor del Centro requiere recolección.',
    severity: 'high',
  },
  {
    id: 'demo-notification-02',
    title: 'Ruta R-330 pendiente',
    description: 'La ruta de la zona Sur todavía no tiene vehículo asignado.',
    severity: 'medium',
  },
]

const rewardCatalog = [
  { code: 'BOLSA-REUTILIZABLE', reward_name: 'Bolsa reutilizable', points_cost: 20, detail: 'Bolsa de tela para compras.' },
  { code: 'KIT-SIEMBRA', reward_name: 'Kit de siembra', points_cost: 50, detail: 'Semillas y guía básica de siembra.' },
]

const donations = [
  {
    id: 'demo-donation-01',
    citizen_id: 'demo-citizen-01',
    place: 'Ronda del Sinú',
    qr_code: 'QR-RONDA',
    status: 'pending_review',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-donation-02',
    citizen_id: 'demo-citizen-02',
    place: 'La Granja',
    qr_code: 'QR-GRANJA',
    status: 'approved',
    earned_points: 5,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

export function createDemoDashboardData() {
  const urgent = containers.filter(container => container.fill_level >= 75)
  const critical = containers.filter(container => container.fill_level >= 90)
  const presentZones = [...new Map(
    containers.map(container => [container.zone.toLowerCase(), container.zone]),
  ).values()]
  const presentZoneKeys = new Set(presentZones.map(zone => zone.toLowerCase()))

  return {
    demoMode: true,
    stats: [
      { label: 'Contenedores activos', value: String(containers.length), change: 'Demo', tone: 'positive' },
      { label: 'Puntos en circulación', value: '245', change: 'Ciudadanía', tone: 'positive' },
      { label: 'Rutas en curso', value: '1', change: 'Operación', tone: 'neutral' },
      { label: 'Alertas críticas', value: String(critical.length), change: 'Monitoreo', tone: 'negative' },
    ],
    citizens: [
      { label: 'Ciudadanos registrados', value: String(citizens.length) },
      { label: 'Puntos en circulación', value: '245' },
      { label: 'Donaciones pendientes', value: '1' },
    ],
    reports: [
      { label: 'Solicitudes de muestra', value: String(incidents.length) },
      { label: 'En camino', value: '1' },
      { label: 'Pendientes', value: '1' },
    ],
    containers: containers.map(container => ({ ...container })),
    fleet: fleet.map(vehicle => ({ ...vehicle })),
    zones: presentZones.map(name => ({ name, fill: 70, trucks: 1, status: 'Normal' })),
    routes: routes.map(route => ({ ...route })),
    alerts: [
      'Contenedor crítico: C-240 en Centro alcanzó 92% de llenado.',
      'Ruta reprogramada: R-330 requiere asignación en la zona Sur.',
    ],
    container_types: { organica: 1, reciclable: 1, general: 1, vidrio: 1 },
    kpis: [
      { label: 'Contenedores críticos', value: String(critical.length) },
      { label: 'Kilos por recoger', value: String(urgent.reduce((sum, item) => sum + Math.round(item.fill_level * 1.1), 0)) },
      { label: 'Incidencias abiertas', value: '2' },
    ],
    operations: {
      efficiency_pct: Math.round(100 * (containers.length - critical.length) / containers.length),
      urgent_containers: urgent.length,
      pending_kg: urgent.reduce((sum, item) => sum + Math.round(item.fill_level * 1.1), 0),
      coverage_pct: Math.round(100 * presentZoneKeys.size / 5),
      routes: routes.length,
      active_routes: routes.filter(route => route.status_code === 'in_progress').length,
      fleet_operating: fleet.filter(vehicle => vehicle.state !== 'revision').length,
      fleet_stopped: fleet.filter(vehicle => vehicle.state === 'revision').length,
      open_incidents: 2,
      priority: urgent.map(item => ({
        id: item.id,
        code: item.code,
        zone: item.zone,
        fill_level: item.fill_level,
        collected_kg: Math.round(item.fill_level * 1.1),
      })),
    },
  }
}

export function createDemoServiceData(service, path) {
  if (service === 'notifications' && path === '/notifications') return { data: notifications.map(item => ({ ...item })) }
  if (service === 'fleet' && path === '/fleet') return { data: fleet.map(item => ({ ...item })) }
  if (service === 'citizens' && path === '/citizens') return { data: citizens.map(item => ({ ...item })) }
  if (service === 'citizens' && path === '/rewards') return { data: [] }
  if (service === 'citizens' && path === '/rewards/catalog') return { data: rewardCatalog.map(item => ({ ...item })) }
  if (service === 'citizens' && path === '/donations') return { data: donations.map(item => ({ ...item })) }
  if (service === 'reporting' && path === '/incidents') return { data: incidents.map(item => ({ ...item })) }

  const trackedIncident = path.match(/^\/incidents\/track\/([^/]+)$/)
  if (service === 'reporting' && trackedIncident) {
    const incident = incidents.find(item => item.tracking_code === decodeURIComponent(trackedIncident[1]))
    return { data: incident ? { ...incident } : null }
  }

  return null
}

export function createDemoDayClose() {
  return {
    kg_collected: 184,
    containers_emptied: 3,
    requests_resolved: 4,
    points_awarded: 15,
    points_in_circulation: 245,
    city: 'Montería',
    date: new Date().toLocaleDateString('es-CO'),
  }
}

export function createDemoMunicipalAnalytics() {
  return {
    city: 'Montería',
    date: new Date().toLocaleDateString('es-CO'),
    summary: {
      pending_kg: 198,
      kg_collected_today: 184,
      containers_emptied_today: 3,
      open_requests: 2,
      en_camino: 1,
      response_rate_pct: 67,
      points: 245,
      citizens: citizens.length,
      fleet_operating: 2,
      fleet_total: fleet.length,
      avg_fill: 75,
    },
    decisions: [
      { tone: 'urgent', title: 'Priorizar C-240', detail: 'El contenedor del Centro está al 92% de capacidad.' },
      { tone: 'info', title: 'Asignar R-330', detail: 'La ruta de la zona Sur aún no tiene vehículo.' },
    ],
    zones: [
      { zone: 'Centro', avg_fill: 92, pending_kg: 101, critical: 1, open_requests: 1, collects_today: true, schedule: 'Martes y viernes' },
      { zone: 'Norte', avg_fill: 64, pending_kg: 70, critical: 0, open_requests: 0, collects_today: false, schedule: 'Lunes y jueves' },
      { zone: 'Sur', avg_fill: 88, pending_kg: 97, critical: 1, open_requests: 1, collects_today: true, schedule: 'Miércoles y sábado' },
      { zone: 'Este', avg_fill: 54, pending_kg: 59, critical: 0, open_requests: 0, collects_today: false, schedule: 'Lunes y viernes' },
    ],
    week: [
      { date: 'Lun', requests: 3, kg: 125 },
      { date: 'Mar', requests: 5, kg: 184 },
      { date: 'Mié', requests: 2, kg: 142 },
      { date: 'Jue', requests: 4, kg: 165 },
      { date: 'Vie', requests: 3, kg: 184 },
      { date: 'Sáb', requests: 2, kg: 98 },
      { date: 'Hoy', requests: 2, kg: 184 },
    ],
  }
}
