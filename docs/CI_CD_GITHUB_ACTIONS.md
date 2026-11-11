# CI/CD de WATESITE con GitHub Actions

## Arquitectura actual

WATESITE conserva frontend, backend, pruebas e integración. Los ocho microservicios tienen repositorios independientes con su propio historial, workflow y publicación GHCR:

- [watesite-containers](https://github.com/cuentapicentral-sys/watesite-containers)
- [watesite-sensors](https://github.com/cuentapicentral-sys/watesite-sensors)
- [watesite-routes](https://github.com/cuentapicentral-sys/watesite-routes)
- [watesite-fleet](https://github.com/cuentapicentral-sys/watesite-fleet)
- [watesite-citizens](https://github.com/cuentapicentral-sys/watesite-citizens)
- [watesite-reporting](https://github.com/cuentapicentral-sys/watesite-reporting)
- [watesite-notifications](https://github.com/cuentapicentral-sys/watesite-notifications)
- [watesite-analytics](https://github.com/cuentapicentral-sys/watesite-analytics)

Las carpetas `services/` que continúan en este repositorio son una copia para integración con el backend y las pruebas existentes, no una segunda publicación de las imágenes por servicio. El workflow WATESITE publica únicamente las imágenes integradas `wastewise`, `frontend` y `backend`; el workflow de cada repositorio de servicio es responsable de su propia imagen. Los módulos compartidos copiados en cada repositorio se deben sincronizar conscientemente en cambios futuros.

El workflow `.github/workflows/ci-cd.yml` usa tres jobs en orden:

1. **`quality-and-test`** instala las dependencias Python de backend, servicios y desarrollo; ejecuta Flake8, Black y pytest; instala dependencias npm reproducibles, ejecuta la prueba Node existente y construye Vite.
2. **`build-and-publish`** depende de las validaciones. Publica en GHCR las imágenes integradas `wastewise` (Dockerfile raíz), `frontend` y `backend`. Cada imagen lleva el SHA completo del commit y la etiqueta móvil `main`. Cada microservicio publica su imagen desde su propio repositorio y workflow.
3. **`deploy`** depende de la publicación. Registra el relevo a Render, pero no llama a un Deploy Hook ni verifica el estado del servicio. Su éxito **no significa que Render haya completado un despliegue**.

Los jobs posteriores quedan omitidos si falla un job del que dependen. En pull requests a `main`, solo se ejecuta `quality-and-test`; no se publica ni se despliega. Un despacho manual desde una rama distinta de `main` también se limita a las validaciones. Desde `main`, el despacho manual puede publicar.

Eventos configurados: `pull_request` dirigido a `main`, `push` a `main` y `workflow_dispatch`.

## Render y GHCR

La configuración existente de Render es de despliegue desde el repositorio y usa `autoDeployTrigger: checksPass`; no se añade un Deploy Hook redundante. Hay dos manifiestos diferentes:

- `render.yaml` crea el servicio `wastewise` a partir del Dockerfile de la raíz.
- `render.paid.yaml` describe el frontend, backend, ocho servicios privados y RabbitMQ como servicios separados.

Selecciona conscientemente el Blueprint que corresponda a la arquitectura y plan de Render deseados. Render construye desde el repositorio; **no consume actualmente las imágenes de GHCR** publicadas por el workflow. El job `deploy` deja constancia del relevo, no de la finalización del despliegue. Comprueba en Render el evento/estado y consulta el health endpoint configurado (por ejemplo, `/api/health` para `wastewise`) usando la URL real proporcionada por Render. No se configura una comprobación HTTP pública porque este repositorio no contiene una URL de despliegue.

Los paquetes publicados con `GITHUB_TOKEN` pueden tener permisos/visibilidad privados según la configuración del repositorio. Como Render no usa esas imágenes hoy, no se necesita configurar acceso de Render a GHCR. Si se migra a despliegue de imágenes, habrá que configurar explícitamente en Render acceso de solo lectura al paquete, revisar la visibilidad y sustituir la estrategia de despliegue desde código; no basta con que una imagen exista en GHCR.

## Configuración en GitHub y Render

### GitHub

- No se requieren secretos de Actions para el flujo actual. La publicación usa `GITHUB_TOKEN` y permisos acotados por job: `contents: read` y `packages: write` únicamente para `build-and-publish`.
- En **Settings → Actions → General → Workflow permissions**, permite el permiso de lectura y escritura de paquetes requerido por GHCR, conforme a las políticas de la organización.
- Protege `main` con reglas de rama y exige que pasen las validaciones del workflow antes de integrar cambios. Las reglas de protección no pueden activarse desde este repositorio.
- Si una política de organización impide escribir paquetes con `GITHUB_TOKEN`, el job fallará explícitamente; no se incluye un token personal alternativo.

### Render

- Conecta el repositorio al Blueprint y selecciona `render.yaml` o `render.paid.yaml` según la arquitectura deseada.
- Configura en Render los valores requeridos por el manifiesto, incluidas las credenciales de Supabase. No los agregues al repositorio ni a logs.
- Mantén activa la implementación automática solo después de comprobar en Render que la integración está vinculada al repositorio y que `checksPass` tiene el comportamiento esperado para los checks requeridos.
- Tras una ejecución de Actions, verifica en Render el evento y el estado del despliegue. Comprueba también el health endpoint del servicio mediante su URL real. Si no hay acceso a Render, esta verificación queda pendiente.
- No hace falta crear `RENDER_DEPLOY_HOOK_*` con la configuración actual. Si en el futuro se cambia a hooks, cada servicio necesitará su propio secreto de Actions y un job que valide la respuesta del hook y, cuando sea viable, su estado de salud.

## Validación local

Desde la raíz del repositorio, con Python compatible y Node.js 22 instalados:

```powershell
python -m pip install -r backend\requirements.txt -r services\requirements.txt -r requirements-dev.txt
$env:SUPABASE_URL = "https://example.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "replace_me"
python -m flake8 backend services tests --select=E9,F63,F7,F82 --max-line-length=120
python -m black --check services/start.py services/routes/optimization.py tests
python -m pytest -q
Push-Location frontend
npm ci
npm test
npm run build
Pop-Location
```

Los valores de Supabase anteriores son ficticios y solo permiten importar el cliente en pruebas que no acceden a una base de datos real. No uses credenciales de producción en pruebas. Para validar imágenes localmente, desde la raíz:

El botón **Continuar con acceso demo** muestra un dashboard con datos de ejemplo generados localmente. Esa vista no necesita backend ni conecta con Supabase; las operaciones que modifican datos requieren el backend y los servicios configurados.

```powershell
docker build -f frontend\Dockerfile -t watesite-frontend:local frontend
docker build -f backend\Dockerfile -t watesite-backend:local .
docker build -f services\Dockerfile --build-arg SERVICE_MODULE=services.containers.main -t watesite-container-service:local .
```

Los `.dockerignore` de raíz y frontend excluyen archivos `.env` y artefactos locales de los contextos Docker. Los repositorios individuales también excluyen entornos locales de sus contextos. No se copian secretos en las imágenes.

## Prueba negativa segura

No se introduce deliberadamente una prueba defectuosa en `main`. Para capturar la evidencia de bloqueo:

1. Crea una rama de demostración desde `main`.
2. Añade temporalmente una prueba aislada que falle de forma determinista; no la mezcles con código de producción.
3. Abre un pull request hacia `main` y captura el job de pruebas fallido y los jobs `build-and-publish`/`deploy` omitidos.
4. Cierra el pull request y elimina la rama o revierte la prueba temporal. No integres el cambio fallido.

Para la ejecución positiva, abre otro pull request con cambios que pasen las validaciones. Tras integrar el cambio, captura el workflow de `main`, la publicación de paquetes y el estado real de Render por separado.

## Evidencias para el equipo

- [ ] Enlace al repositorio.
- [ ] Captura de una ejecución exitosa en **Actions**.
- [ ] Captura de una ejecución fallida en **Actions**.
- [ ] Evidencia de que publicar/desplegar se omitió tras fallar las pruebas.
- [ ] Evidencia de imágenes publicadas en GHCR, si la política del repositorio las permite.
- [ ] Evidencia del despliegue real en Render y comprobación de salud, si se dispone de acceso.
- [ ] Informe breve de reflexión completado con hechos observados.

### Plantilla de reflexión

- **Tareas automatizadas:** [completar con lo que ejecutó Actions].
- **Separación test → build/publish → deploy:** [explicar cómo las dependencias de jobs evitan publicar antes de validar].
- **Ejecución fallida:** [indicar qué falló y mostrar qué jobs quedaron omitidos; no afirmar resultados no observados].
- **Protección de secretos:** [describir uso de variables ficticias en CI, secretos fuera del repositorio y exclusiones de Docker].
- **Problemas encontrados y resolución:** [completar con evidencia].
- **Pendiente por credenciales/acceso:** [indicar cualquier comprobación que no pudo hacerse].
- **Mejoras para el siguiente ciclo:** [proponer acciones concretas].

## Limitaciones verificables

En la primera ejecución remota de los ocho repositorios individuales, GitHub marcó `quality-and-test` como fallido antes de iniciar el runner con el mensaje: “your account is locked due to a billing issue”. Por sus dependencias, `build-and-publish` y `deploy` quedaron omitidos; no se publicaron imágenes ni se inició un despliegue. El propietario debe resolver el bloqueo de facturación/Actions y volver a ejecutar los workflows.

Una ejecución local no demuestra que GitHub haya aceptado el `GITHUB_TOKEN`, que Render haya iniciado/terminado el despliegue o que un endpoint remoto responda. Para esas evidencias hace falta una ejecución remota autorizada, acceso al repositorio/paquetes y acceso al Blueprint de Render. No se deben presentar la publicación en GHCR ni el job `deploy` como evidencia de despliegue exitoso.
