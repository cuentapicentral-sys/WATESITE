# Momento 3 - Entrega final de arquitectura

## Proyecto y alcance

WASTEWISE es una plataforma municipal para gestionar contenedores, sensores, rutas, flota, ciudadanía, incidencias, notificaciones y analítica. La arquitectura integra un frontend Vite, un backend FastAPI y ocho microservicios FastAPI.

## Matriz de cumplimiento

| Requerimiento | Estado | Evidencia |
|---|---:|---|
| Frontend y experiencia pública/operador | Implementado | `frontend/src/` |
| Backend agregador y API Gateway parcial | Implementado | `backend/main.py`, `backend/supabase_routes.py` |
| Microservicio Containers | Implementado | `services/containers/main.py` |
| Microservicio Sensors | Implementado | `services/sensors/main.py` |
| Microservicio Routes | Implementado | `services/routes/main.py` |
| Microservicio Fleet | Implementado | `services/fleet/main.py` |
| Microservicio Citizens | Implementado | `services/citizens/main.py` |
| Microservicio Reporting | Implementado | `services/reporting/main.py` |
| Microservicio Notifications | Implementado | `services/notifications/main.py` |
| Microservicio Analytics | Implementado | `services/analytics/main.py` |
| Base de datos Supabase | Configurado | `database/supabase_schema.sql` |
| RabbitMQ y eventos de dominio | Implementado | `services/events.py`, `docker-compose.yml` |
| Docker Compose local | Implementado | `docker-compose.yml` |
| CI y publicación GHCR | Configurado | `.github/workflows/ci-cd.yml` |
| Pruebas unitarias | Implementadas | `tests/` |
| Pruebas de integración HTTP y observabilidad | Implementadas | `tests/test_observability.py` |
| Cobertura pytest-cov | Configurado | `pytest-cov`, artifact `python-coverage` |
| Endpoint `/metrics` por servicio | Implementado | `services/metrics.py` |
| Prometheus | Configurado | `deploy/prometheus/prometheus.yml` |
| Grafana provisionado | Configurado | `deploy/grafana/provisioning/` |
| Swagger/OpenAPI | Disponible en `/docs` por FastAPI | Cada aplicación FastAPI |
| Repositorios independientes por microservicio | Publicados | Enlaces en `README.md` |
| Despliegue Render | Parcial | `render.yaml`, `render.paid.yaml` |

**Cumplimiento técnico verificable localmente: aproximadamente 90%.** Los elementos remotos de facturación, credenciales, autorización del docente, despliegue público y evidencia real de Prometheus/Grafana permanecen fuera del repositorio y deben completarse con acceso externo.

## Arquitectura y comunicación

El frontend consume el backend y los servicios mediante rutas HTTP. El backend agrega datos operativos de Supabase. Los microservicios publican eventos en el exchange `wastewise.events` a través de RabbitMQ. El flujo crítico es:

1. El Sensor Ingestion Service recibe una lectura.
2. Container Service o Sensor Service actualiza el nivel y el estado.
3. El evento `container.fill_level.updated` o `container.critical` se publica.
4. Route Service y Notification Service reaccionan al evento.
5. Analytics recalcula indicadores municipales.
6. El frontend muestra datos agregados y permite seguir la operación.

Esta arquitectura usa coordinación mediante eventos. No se implementó una SAGA distribuida con compensaciones; es una coordinación event-driven local. Si se requiere una SAGA formal en la sustentación, describirla como un diseño futuro con estados y compensaciones no la hace existir en código.

## Pruebas

Comandos locales:

```powershell
$env:SUPABASE_URL="https://example.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="replace_me"
python -m pytest -q --cov=backend --cov=services --cov-report=term-missing --cov-report=xml:coverage.xml --cov-report=html:coverage_html
```

Frontend:

```powershell
cd frontend
npm test
npm run build
```

Las pruebas unitarias aisladas cubren lógica de operaciones, rutas, sensores, analítica y campo. `tests/test_observability.py` contiene pruebas de integración HTTP que verifican `/health` y `/metrics` en el backend y los ocho microservicios.

## Prometheus y Grafana

Inicio local:

```powershell
docker compose up --build
```

Endpoints:

| Componente | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend health | http://localhost:8001/api/health |
| Backend metrics | http://localhost:8001/metrics |
| Container metrics | http://localhost:8101/metrics |
| Sensors metrics | http://localhost:8105/metrics |
| Routes metrics | http://localhost:8102/metrics |
| Fleet metrics | http://localhost:8103/metrics |
| Citizens metrics | http://localhost:8104/metrics |
| Reporting metrics | http://localhost:8106/metrics |
| Notifications metrics | http://localhost:8107/metrics |
| Analytics metrics | http://localhost:8108/metrics |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3300 |

Credenciales Grafana local:

- Usuario: `admin`
- Contraseña: `wastewise`

Cambia la contraseña antes de exponer Grafana públicamente.

En Prometheus abre **Status -> Targets** y confirma que los jobs estén `UP`. En Grafana, abre el dashboard provisionado **WasteWise Observabilidad**, que incluye peticiones por segundo, latencia p95 y porcentaje de errores HTTP.

## CI/CD

Pull requests validan Python, frontend y cobertura. Push o despacho manual en `main` valida primero y solo después construye/publica las imágenes integradas en GHCR. El despliegue continúa dependiendo de la configuración externa de Render.

GitHub Actions debe conservar:

1. Evidencia positiva: suite aprobada y artifact de cobertura.
2. Evidencia negativa controlada: Pull Request temporal con una prueba fallida y jobs posteriores omitidos.
3. Ejecución remota exitosa después de resolver facturación.
4. Paquetes publicados en GHCR si la política lo permite.
5. Estado real de Render y health check.

## Evidencias recomendadas para la sustentación

Captura o exporta:

- Dashboard de Grafana con al menos tres paneles.
- Prometheus Status/Targets con targets UP.
- `/metrics` de al menos el backend y tres microservicios.
- Ejecución positiva de GitHub Actions.
- Artifact de cobertura.
- Ejecución negativa de una rama temporal.
- Swagger `/docs` de cada servicio.
- Render o la URL activa alternativa usada el día de presentación.
- Diagrama frontend -> API -> microservicios -> RabbitMQ -> Supabase.

## Estado de la URL desplegada

URL pública comprobada: https://wastewise-x0ni.onrender.com

- `GET /` responde con el frontend y HTTP 200.
- `GET /api/health` responde HTTP 200 y confirma `{"status":"ok","service":"WasteWise API"}`.
- `GET /metrics` no expone métricas Prometheus; actualmente devuelve la página HTML del frontend.
- `GET /api/metrics` devuelve HTTP 404.
- `GET /docs` no representa Swagger: la ruta publica actualmente la aplicación frontend por el fallback de Nginx.

No se debe presentar Grafana conectado a esta URL hasta desplegar una versión que instrumente el backend con `/metrics`. El despliegue público puede usarse como evidencia de disponibilidad HTTP, mientras Prometheus/Grafana locales sirven como evidencia de observabilidad técnica.

## Estado no verificable sin credenciales

No se afirma que GHCR, Render, GitHub Actions remoto o Grafana público estén funcionando. Estas funciones requieren acceso externo, facturación, credenciales y autorización del propietario del repositorio.
