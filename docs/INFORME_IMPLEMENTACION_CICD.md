# Informe de implementación CI/CD y separación de microservicios

**Proyecto:** WATESITE / WasteWise

**Fecha:** 27 de octubre de 2026
**Estado:** Repositorios de microservicios creados y publicados; validación remota y despliegue pendientes.

## 1. Resumen ejecutivo

Se separaron los ocho microservicios de WATESITE en repositorios GitHub independientes, conservando el historial Git de cada carpeta de servicio. El repositorio original WATESITE se conserva como orquestador e integración de frontend, backend, pruebas y despliegue integrado.

Cada nuevo repositorio contiene su aplicación FastAPI, los módulos compartidos necesarios para ejecutarse de forma independiente, Dockerfile, manifiesto `render.yaml`, workflow de GitHub Actions y prueba de endpoint `/health`. WATESITE deja de publicar imágenes duplicadas de los ocho microservicios: su workflow publica únicamente las imágenes integradas `wastewise`, `frontend` y `backend`.

Las comprobaciones locales finalizaron correctamente. Sin embargo, GitHub no inició los runners de los workflows remotos debido a un bloqueo de facturación de la cuenta. Por tanto, no hay evidencia de publicación de imágenes en GHCR ni de despliegue en Render.

## 2. Repositorios publicados

Los ocho repositorios son públicos y contienen la rama `main`. Se comprobó que el commit remoto de `main` coincide con el commit extraído localmente para cada servicio.

| Servicio | Repositorio | Commit publicado |
|---|---|---|
| Containers | [watesite-containers](https://github.com/cuentapicentral-sys/watesite-containers) | `a537f06ad32b565ac78f5a49c273b7cec3f43caf` |
| Sensors | [watesite-sensors](https://github.com/cuentapicentral-sys/watesite-sensors) | `87a6f894868adf97de9aaa231f820cbf103bab6f` |
| Routes | [watesite-routes](https://github.com/cuentapicentral-sys/watesite-routes) | `0dab9e25767ad1f4c1ca3d15943692133f6c577c` |
| Fleet | [watesite-fleet](https://github.com/cuentapicentral-sys/watesite-fleet) | `3a11cbe54634664cd2459893aea8c2012e4f2ea5` |
| Citizens | [watesite-citizens](https://github.com/cuentapicentral-sys/watesite-citizens) | `f827bc84434120e1ba29aecf885aa57e22f1421a` |
| Reporting | [watesite-reporting](https://github.com/cuentapicentral-sys/watesite-reporting) | `3d1d084a20d5ae812482342e47d8277e0b6677b0` |
| Notifications | [watesite-notifications](https://github.com/cuentapicentral-sys/watesite-notifications) | `20ff45592ef80b1abc2bb8e3d9e743a37751224c` |
| Analytics | [watesite-analytics](https://github.com/cuentapicentral-sys/watesite-analytics) | `33d673dd977c9c6a4a8e47106369567bd6fb9059` |

## 3. Automatización implementada

Cada microservicio tiene un workflow independiente con eventos `pull_request` a `main`, `push` a `main` y `workflow_dispatch`. Los jobs están encadenados para que publicar o desplegar no proceda si falla la calidad:

1. **`quality-and-test`:** instala dependencias Python, ejecuta Flake8 y pytest.
2. **`build-and-publish`:** después de las pruebas, construye y publica la imagen Docker del servicio en GHCR con etiqueta SHA y `main`. Usa `GITHUB_TOKEN` y permisos mínimos, incluido `packages: write` solo en este job.
3. **`deploy`:** después de publicar, registra el relevo a Render; no afirma que Render haya completado un despliegue ni sustituye la verificación del estado del servicio.

En WATESITE, el workflow conserva las validaciones de Python y frontend, y la matriz de publicación queda limitada a las imágenes integradas `wastewise`, `frontend` y `backend`.

La separación `test → build/publish → deploy` establece dependencias explícitas: si falla el job de pruebas, los posteriores se omiten, evitando publicar una versión que no pasó las validaciones.

## 4. Pruebas y verificaciones locales

| Comprobación | Resultado |
|---|---|
| Suite Python existente de WATESITE (`pytest -q`) | **28 aprobadas**, 0 fallidas; 2 advertencias deprecadas |
| Lint Python de WATESITE (reglas configuradas de Flake8) | Aprobado |
| Black de los archivos configurados | Aprobado; 10 archivos sin cambios tras el formato |
| Prueba Node existente del frontend | **1 aprobada**, 0 fallidas |
| Build de producción Vite | Aprobado |
| Pruebas aisladas de salud de microservicios | **8 aprobadas**, 0 fallidas |
| Lint aislado de los ocho microservicios | Aprobado |
| Construcción local de imágenes Docker independientes | **8 de 8 construidas** |
| Importación de cada app y presencia de `/health` en su imagen | **8 de 8 verificadas** |
| Sintaxis YAML y dependencias de jobs de workflows | Verificadas localmente |
| Exclusión de `.env` de las imágenes inspeccionadas | Verificada localmente para imágenes de backend, servicios, app integrada y frontend |

Las pruebas locales usaron marcadores ficticios de Supabase para inicializar el cliente, sin enviar solicitudes a una base de datos. No se conectaron a producción.

## 5. Resultados de GitHub Actions

Los ocho repositorios recibieron su push a `main` y se creó una ejecución de Actions por repositorio. Todas esas ejecuciones terminaron en fallo antes de iniciar el runner. GitHub mostró el mensaje:

> The job was not started because your account is locked due to a billing issue.

En las ejecuciones inspeccionadas, `build-and-publish` y `deploy` quedaron omitidos porque dependían de `quality-and-test`. No se construyeron ni publicaron imágenes en GHCR como parte de esas ejecuciones.

| Servicio | Ejecución de Actions |
|---|---|
| Containers | [Ejecución 1](https://github.com/cuentapicentral-sys/watesite-containers/actions/runs/40612165736) |
| Sensors | [Ejecución 1](https://github.com/cuentapicentral-sys/watesite-sensors/actions/runs/40612076701) |
| Routes | [Ejecución 1](https://github.com/cuentapicentral-sys/watesite-routes/actions/runs/40612089618) |
| Fleet | [Ejecución 1](https://github.com/cuentapicentral-sys/watesite-fleet/actions/runs/40612101312) |
| Citizens | [Ejecución 1](https://github.com/cuentapicentral-sys/watesite-citizens/actions/runs/40612113276) |
| Reporting | [Ejecución 1](https://github.com/cuentapicentral-sys/watesite-reporting/actions/runs/40612125054) |
| Notifications | [Ejecución 1](https://github.com/cuentapicentral-sys/watesite-notifications/actions/runs/40612135298) |
| Analytics | [Ejecución 1](https://github.com/cuentapicentral-sys/watesite-analytics/actions/runs/40612143800) |

El propietario de la organización debe resolver el bloqueo de facturación/Actions y volver a ejecutar los workflows. Hasta entonces, CI remoto, publicación en GHCR y despliegue no están demostrados.

## 6. Render y estado del despliegue

Los repositorios separados incluyen un `render.yaml` por servicio con despliegue Docker desde el repositorio y health check en `/health`. WATESITE conserva sus manifiestos existentes: `render.yaml` para la imagen integrada y `render.paid.yaml` para los servicios separados.

No se verificó acceso al Blueprint ni a una URL pública de Render. En consecuencia:

- No se afirma que Render haya recibido, procesado o completado un despliegue.
- No se hizo una comprobación HTTP remota del health check.
- El propietario debe conectar en Render el repositorio/Blueprint elegido, configurar las variables de entorno requeridas en el panel y verificar el evento, estado y salud de cada servicio.
- Los manifiestos de Render actuales despliegan desde el repositorio; no consumen las imágenes publicadas en GHCR.

## 7. Protección de secretos

- Los workflows usan únicamente valores ficticios para inicializar dependencias en CI; no requieren credenciales reales de Supabase para las pruebas actuales.
- La publicación en GHCR usa el `GITHUB_TOKEN` de Actions con permisos limitados por job; no se añadió un token personal a YAML.
- Los `.gitignore` y `.dockerignore` excluyen archivos de entorno y artefactos locales de los contextos Docker.
- `backend/.env` local está ignorado y no está versionado.
- Se reemplazaron los valores del archivo `backend/.env.example` por marcadores ficticios. La versión histórica del ejemplo contenía un valor con forma de credencial; se recomendó rotarlo si corresponde y revisar el historial. No se revelan valores sensibles en este informe.

## 8. Problemas encontrados y resolución

1. **Dependencia de Supabase en pruebas limpias:** las pruebas importan el cliente. El workflow instala tanto `backend/requirements.txt` como `services/requirements.txt`, y usa marcadores ficticios para evitar depender de credenciales reales.
2. **Prueba de salud del servicio Citizens:** inicialmente el servicio no tenía `/health`; se añadió el endpoint para permitir health checks y pruebas operativas independientes.
3. **Módulos compartidos:** varios servicios dependen de utilidades comunes (base de datos, eventos, lógica operativa, notificaciones y calendario). Se incluyeron copias de las dependencias necesarias en cada repositorio para que cada uno pueda construirse independientemente.
4. **Formateo existente:** Black detectó seis archivos de prueba existentes que necesitaban formato para satisfacer el control ya configurado; se formatearon sin cambiar su lógica.
5. **Bloqueo de facturación de GitHub Actions:** impidió iniciar los runners. Se documentó la causa observada; debe resolverla el administrador de la cuenta/organización.

## 9. Limitaciones y riesgos pendientes

- Los repositorios de microservicio contienen una copia de módulos compartidos; las correcciones futuras a esos módulos deberán sincronizarse de forma deliberada entre los repositorios que los usan.
- WATESITE conserva directorios `services/` como copia de integración para su backend, tests y despliegue integrado. Los repositorios separados son la fuente canónica para cambios propios de cada microservicio; la copia del monorepo debe mantenerse coherente.
- Las pruebas creadas para cada repositorio separado verifican el endpoint de salud. La lógica de dominio sigue cubierta principalmente por la suite de WATESITE; se recomienda migrar o ampliar pruebas específicas en cada repositorio.
- No se capturó una ejecución remota exitosa ni una prueba negativa de código fallido. La omisión de jobs en los runs revisados se debió al bloqueo de facturación antes de iniciar el runner, no a una prueba defectuosa.
- No hay evidencia de despliegue real o endpoint de Render verificado.
- Los cambios de documentación/workflow pendientes en el checkout local de WATESITE no se han publicado en el repositorio principal.

## 10. Próximos pasos recomendados

1. Resolver el bloqueo de facturación de GitHub Actions en la cuenta/organización.
2. Reejecutar el workflow de cada microservicio y confirmar que `quality-and-test`, `build-and-publish` y el relevo de despliegue se comportan según lo esperado.
3. Añadir reglas de protección a `main` que exijan los checks de calidad.
4. Migrar pruebas de dominio desde WATESITE a los repositorios independientes.
5. Definir un proceso para versionar o sincronizar utilidades compartidas, evitando divergencias entre copias.
6. Elegir y conectar el Blueprint correcto de Render; documentar sus variables en Render y verificar `/health` con la URL real de cada servicio.
7. Publicar los cambios locales de WATESITE después de revisar el diff completo y preservar cualquier trabajo local no relacionado.

## 11. Reflexión breve del equipo

La implementación automatiza la validación de código y pruebas, la construcción de contenedores y la preparación del relevo de despliegue. La dependencia entre pruebas, publicación y despliegue reduce el riesgo de propagar una versión que no haya pasado la validación. En las ejecuciones remotas observadas, GitHub bloqueó los runners por facturación y, por esa razón, los jobs posteriores no se ejecutaron. Los secretos se mantuvieron fuera de los YAML y de las imágenes; CI utiliza marcadores ficticios. Las pruebas, lint y builds locales pasaron, pero falta resolver el bloqueo de Actions para obtener evidencia remota positiva y falta acceso/configuración de Render para verificar un despliegue real. Como siguiente mejora, se recomienda ampliar la cobertura de dominio por servicio y establecer una estrategia versionada para los módulos compartidos.

## 12. Evidencias que debe conservar el equipo

- [x] Enlaces a los ocho repositorios independientes.
- [x] Ejecuciones fallidas de Actions con evidencia del bloqueo de facturación.
- [x] Evidencia de jobs posteriores omitidos tras no iniciar la validación.
- [x] Resultados locales de pruebas, lint y builds documentados.
- [ ] Captura de una ejecución remota exitosa después de resolver facturación.
- [ ] Evidencia de publicación de imágenes en GHCR.
- [ ] Evidencia de despliegue y comprobación real de salud en Render.
- [ ] Captura de la prueba negativa de una rama temporal, una vez que Actions pueda ejecutar los jobs.
