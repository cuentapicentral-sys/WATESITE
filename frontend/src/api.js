const getBaseApiUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return '/api';
  return 'http://127.0.0.1:8001/api';
};

const API_BASE_URL = getBaseApiUrl();
const SERVICE_API_PREFIX = import.meta.env.VITE_SERVICE_API_PREFIX?.replace(/\/$/, '');
const SERVICE_URLS = {
  containers: import.meta.env.VITE_CONTAINER_SERVICE_URL || 'http://127.0.0.1:8101',
  routes: import.meta.env.VITE_ROUTE_SERVICE_URL || 'http://127.0.0.1:8102',
  fleet: import.meta.env.VITE_FLEET_SERVICE_URL || 'http://127.0.0.1:8103',
  citizens: import.meta.env.VITE_CITIZEN_SERVICE_URL || 'http://127.0.0.1:8104',
  sensors: import.meta.env.VITE_SENSOR_SERVICE_URL || 'http://127.0.0.1:8105',
  reporting: import.meta.env.VITE_REPORTING_SERVICE_URL || 'http://127.0.0.1:8106',
  notifications: import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:8107',
  analytics: import.meta.env.VITE_ANALYTICS_SERVICE_URL || 'http://127.0.0.1:8108',
};

const getServiceBaseUrl = service => SERVICE_API_PREFIX ? `${SERVICE_API_PREFIX}/${service}` : SERVICE_URLS[service];

async function serviceRequest(service, path, options = {}) {
  const serviceUrl = getServiceBaseUrl(service);
  try {
    const response = await fetch(`${serviceUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body.detail ? `: ${body.detail}` : '';
      } catch {
        detail = '';
      }
      throw new Error(`El servicio ${service} devolvió un error${detail}`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`No se pudo conectar con el servicio ${service}. Comprueba que esté iniciado en ${serviceUrl}.`);
    }
    throw error;
  }
}

export function fetchServiceData(service, path) {
  return serviceRequest(service, path);
}

export function optimizeRoute(payload) {
  return serviceRequest('routes', '/routes/optimize', { method: 'POST', body: JSON.stringify(payload) });
}

export function ingestSensorReading(payload) {
  return serviceRequest('sensors', '/readings', { method: 'POST', body: JSON.stringify(payload) });
}

export function syncSensorCycle() {
  return serviceRequest('sensors', '/cycle', { method: 'POST' });
}

export function reportIncident(payload) {
  return serviceRequest('reporting', '/incidents', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchIncidents() {
  return serviceRequest('reporting', '/incidents');
}

export function updateIncidentStatus(incidentId, status) {
  return serviceRequest('reporting', `/incidents/${incidentId}/status?status=${encodeURIComponent(status)}`, { method: 'PATCH' });
}

export function publishNotification(payload) {
  return serviceRequest('notifications', '/notifications', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchNotifications() {
  return serviceRequest('notifications', '/notifications');
}

export function registerVehicle(payload) {
  return serviceRequest('fleet', '/fleet/vehicles', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchFleetVehicles() {
  return serviceRequest('fleet', '/fleet');
}

export function createCitizen(payload) {
  return serviceRequest('citizens', '/citizens', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchCitizens() {
  return serviceRequest('citizens', '/citizens');
}

export function fetchRewards() {
  return serviceRequest('citizens', '/rewards');
}

export function redeemReward(citizenId, rewardId) {
  return serviceRequest('citizens', `/citizens/${citizenId}/rewards/${rewardId}/redeem`, { method: 'POST' });
}

export function registerQrScan(citizenId, payload) {
  return serviceRequest('citizens', `/citizens/${citizenId}/scans`, { method: 'POST', body: JSON.stringify(payload) });
}

export function submitRecyclingPhoto(payload) {
  return serviceRequest('citizens', '/donations', { method: 'POST', body: JSON.stringify(payload) });
}

export async function fetchDashboardData() {
  const response = await fetch(`${API_BASE_URL}/dashboard`);
  if (!response.ok) {
    throw new Error('No se pudo cargar la información del dashboard');
  }
  return response.json();
}

export async function createContainer(container) {
  const response = await fetch(`${API_BASE_URL}/supabase/containers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(container),
  });
  if (!response.ok) throw new Error('No se pudo crear el contenedor');
  return response.json();
}

export async function updateContainer(id, container) {
  const response = await fetch(`${API_BASE_URL}/supabase/containers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(container),
  });
  if (!response.ok) throw new Error('No se pudo actualizar el contenedor');
  return response.json();
}

export async function deleteContainer(id) {
  const response = await fetch(`${API_BASE_URL}/supabase/containers/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('No se pudo eliminar el contenedor');
  return response.json();
}
