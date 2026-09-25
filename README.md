# WasteWise – Plataforma de gestión de residuos y reciclaje municipal

## 1. Visión general

WasteWise es una plataforma digital para optimizar la gestión de residuos y reciclaje en ciudades. El objetivo es mejorar la eficiencia operativa del servicio municipal, reducir costos de recolección, prevenir saturación de contenedores, incentivar la participación ciudadana y ofrecer reportes de control para la administración pública.

## 2. Objetivos

- Reducir el número de viajes innecesarios de recolección.
- Detectar contenedores cercanos a su capacidad máxima.
- Optimizar rutas por zona, horario y tipo de residuo.
- Mejorar la trazabilidad de la flota municipal.
- Incentivar a la ciudadanía con recompensas por reciclaje.
- Crear dashboards y reportes para la toma de decisiones.

## 3. Usuarios del sistema

### Administradores municipales
- Supervisan indicadores generales.
- Definen políticas y zonas de servicio.
- Revisan reportes y alertas.

### Operadores de recolección
- Consultan rutas asignadas.
- Validan estado de contenedores.
- Reportan incidencias y anomalías.

### Ciudadanos
- Consultan puntos de reciclaje.
- Participan en programas de recompensas.
- Reportan problemas en la vía pública.

## 4. Funcionalidades principales

### Gestión de contenedores
- Registro de ubicaciones y capacidad.
- Monitoreo por nivel de llenado.
- Detección de contenedores críticos.

### Sensores y telemetría
- Recepción de lecturas de sensores.
- Identificación de anomalías y fallos.
- Históricos por zona, hora y tipo de residuo.

### Optimización de rutas
- Planificación automatizada por eficiencia.
- Rutas por tipo de vehículo y zona.
- Priorización por volumen y urgencia.

### Flota y mantenimiento
- Seguimiento de vehículos.
- Estado operativo, combustible, kms y mantenimiento.

### Incentivos ciudadanos
- Puntos por reciclaje y comportamiento sostenible.
- Canje por beneficios locales.
- Historial de actividades.

### Dashboard y reportes
- KPIs de rendimiento.
- Porcentaje de reciclaje.
- Costos operativos y tiempos de recorrido.
- Alertas y tendencias.

## 5. Arquitectura sugerida

### Frontend
- React + TypeScript
- Panel administrativo y dashboard
- App para ciudadanos y operadores

### Backend
- Python con FastAPI
- Microservicios por dominio funcional

### Servicios principales
- API Gateway
- Container Service
- Sensor Ingestion Service
- Route Optimization Service
- Fleet Service
- Citizen Rewards Service
- Reporting Service
- Notification Service
- Analytics Service

### Infraestructura
- Docker
- PostgreSQL
- TimescaleDB
- Redis
- RabbitMQ
- GitHub Actions
- Prometheus + Grafana

## 6. Stack recomendado

- Frontend: React, Vite, TypeScript
- Backend: Python, FastAPI
- Base de datos: PostgreSQL, TimescaleDB
- Cache: Redis
- Mensajería: RabbitMQ
- Infraestructura: Docker, CI/CD
- Seguridad: JWT, TLS, RBAC
- Observabilidad: Prometheus, Grafana, logs centralizados

## 7. Roadmap de desarrollo

### Fase 1 – Fundamentos
- Definición de alcance y requisitos
- Modelo de datos base
- Login y roles
- Dashboard general

### Fase 2 – Operación municipal
- Contenedores y sensores
- Rutas y flota
- Módulo de incidencias

### Fase 3 – Ciudadanía y recompensas
- Sistema de puntos y recompensas
- Reportes ciudadanos
- Notificaciones

### Fase 4 – Optimización y analítica
- Predicción y alertas
- KPI avanzados
- Reportes exportables

## 8. Estructura propuesta del proyecto

```text
wastewise/
├── frontend/                 # Panel web y dashboard
├── backend/                  # Servicios API y lógica de negocio
├── shared/                   # Modelos y contratos compartidos
├── infra/                    # Docker, kubernetes y despliegue
├── docs/                     # Documentación de arquitectura y requisitos
├── README.md                 # Documento principal
└── .gitignore
```

## 9. Estado actual

Se ha dejado una base visual y funcional del frontend para representar el dashboard principal de WasteWise, con métricas, rutas, contenedores y alertas. Esta base puede servir como punto de partida para continuar con Back-end, autenticación, APIs y módulos por servicio.

## 10. Siguiente paso recomendado

1. Definir la arquitectura exacta por microservicios.
2. Crear el modelo de datos de contenedores, rutas y sensores.
3. Implementar API de contenedores y dashboard.
4. Añadir login con roles.
5. Conectar el frontend con FastAPI.

El sistema incluye ocho microservicios de dominio:

- Contenedores: `http://localhost:8101/containers`
- Rutas: `http://localhost:8102/routes`
- Flota: `http://localhost:8103/fleet`
- Ciudadanía: `http://localhost:8104/citizens`
- Sensores: `http://localhost:8105/readings`
- Reportes ciudadanos: `http://localhost:8106/incidents`
- Notificaciones: `http://localhost:8107/notifications`
- Analítica: `http://localhost:8108/kpis`

Cada servicio tiene su propio endpoint `/health`. El dashboard continúa disponible en `http://localhost:5173` y usa el backend principal como gateway actual.

### Correspondencia con la especificación

- **Container Service**: inventario, coordenadas, nivel y criticidad en `/containers`.
- **Sensor Ingestion Service**: recibe lecturas ultrasónicas, actualiza el contenedor y genera una alerta cuando supera el 90%.
- **Route Optimization Service**: prioriza contenedores desde 70% de llenado y crea rutas por zona.
- **Fleet Service**: registra camiones, conductor asignado, carga y estado operativo.
- **Citizen Rewards Service**: registra ciudadanos, valida escaneos QR y suma puntos o canjea recompensas.
- **Citizen Reporting Service**: registra incidencias con categoría, fotografía opcional y geolocalización.
- **Notification Service**: publica alertas para el dashboard y el feed operativo.
- **Analytics Service**: agrega KPIs de volumen, rutas, flota e impacto ciudadano.

### Eventos de dominio

El entorno Docker incluye RabbitMQ en `5672` y su panel de administración en `15672`. Los servicios publican eventos durables en el exchange `wastewise.events`:

- `container.fill_level.updated`: lectura recibida y estado calculado del contenedor.
- `container.critical`: contenedor con 90% o más de llenado.
- `route.generated`: ruta priorizada y paradas seleccionadas.
- `fleet.vehicle.registered`: vehículo incorporado a la flota.
- `recycling.verified`: puntos acreditados tras validar un QR.
- `reward.redeemed`: recompensa canjeada por un ciudadano.
- `incident.reported` y `incident.status.changed`: ciclo de vida de una incidencia.
- `notification.published`: alerta publicada por un operador.

Notification Service se suscribe a `container.critical` e `incident.reported` y crea automáticamente alertas en Supabase. Para levantar toda la arquitectura con el broker:

Route Optimization Service se suscribe a `container.fill_level.updated`: cuando un contenedor alcanza al menos 70%, consulta las prioridades de la zona y genera una ruta `scheduled` si no existe otra activa para esa zona. Analytics Service mantiene un snapshot de KPIs, lo recalcula al iniciar, cada 300 segundos y después de eventos de operación. El intervalo se puede cambiar con `ANALYTICS_REFRESH_SECONDS`.

```powershell
docker compose up --build
```

Para activar las tablas nuevas (`drivers` y `citizen_incidents`), abre `database/supabase_schema.sql` en el SQL Editor de Supabase y ejecuta el archivo completo. El servicio de analítica seguirá funcionando con incidencias en cero hasta que esa migración se aplique.

### Acceso de demostración

La interfaz incluye login y registro local para probar el flujo completo. También puedes usar el botón `Continuar con acceso demo`; no requiere credenciales y guarda la sesión únicamente en el navegador. Para producción, reemplaza este flujo por Supabase Auth.

---

Proyecto base desarrollado en el workspace como inicio del sistema WasteWise.

## Puesta en marcha local

### Backend

1. Crea `backend/.env` a partir de `backend/.env.example` y completa las credenciales de Supabase.
2. Activa el entorno virtual e instala las dependencias:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

3. Arranca la API:

```powershell
python -m uvicorn backend.main:app --reload --port 8001
```

La comprobación rápida está disponible en `http://127.0.0.1:8001/api/health`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

La URL de la API puede cambiarse con `VITE_API_BASE_URL` antes de ejecutar el build.

### Docker Desktop

Con Docker Desktop iniciado y `backend/.env` configurado, levanta la aplicación completa:

```powershell
docker compose up --build
```

Después abre `http://localhost:5173`. La API queda disponible en `http://localhost:8001/api/health`.
Para detener los contenedores:

```powershell
docker compose down
```

## Despliegue en Render

La definición `render.yaml` crea el frontend público, la API y los ocho microservicios privados, además de RabbitMQ con disco persistente. Nginx publica las APIs bajo el mismo dominio (`/api` y `/services/...`), por lo que el navegador no necesita conocer direcciones internas ni puertos locales.

1. Sube este proyecto a un repositorio de GitHub.
2. En Render, crea un **Blueprint** conectado a ese repositorio y selecciona `render.yaml`.
3. Al crear el Blueprint, introduce `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` cuando Render los solicite. No guardes esas claves en GitHub.
4. Espera a que el frontend, backend, ocho microservicios y RabbitMQ indiquen estado disponible. Render entrega la URL pública del frontend.

GitHub Actions ejecuta Flake8, Black, pytest, el build de Vite y construye las diez imágenes Docker. Las imágenes se publican en GHCR al hacer push a `main`; Render despliega desde el mismo commit únicamente cuando pasan los checks. Los servicios privados y el disco persistente de RabbitMQ requieren un plan de Render con facturación; revisa el coste estimado en Render antes de confirmar la creación.
