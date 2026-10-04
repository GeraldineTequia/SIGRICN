# API REST de SGRICN

Base: `/api`. Formato JSON: `{ "exito": true, "datos": …, "mensaje"?: "…", "paginacion"?: {…} }`; en errores
`{ "exito": false, "codigo": "…", "mensaje": "…", "errores"?: { "campo": "mensaje" } }`.

**Autenticación**: cookie de sesión `sgricn.sid` (HttpOnly). Toda solicitud que no sea GET/HEAD/OPTIONS debe enviar
`X-CSRF-Token` con el valor obtenido en `GET /api/auth/csrf`, `/auth/inicio-sesion` o `/auth/sesion`. Las consultas
automáticas pueden enviar `X-Solicitud-Automatica: 1` para no renovar la inactividad.

**Códigos**: 200/201 éxito · 400 validación (campos no permitidos, formatos, rangos) · 401 sin sesión o sesión expirada
(`SESION_EXPIRADA`) · 403 sin permiso o CSRF inválido · 404 no existe · 409 conflicto (duplicado, integridad,
transición inválida, existencias o saldo insuficientes, concurrencia) · 413 cuerpo demasiado grande · 429 límite de
solicitudes · 502 proveedor externo no disponible · 500 error interno sin detalles.

**Listados** (todas las entidades): `pagina`, `limite` (≤ 100), `orden` (`campo` o `-campo`, sólo campos permitidos),
`busqueda`, filtros por igualdad indicados abajo y, cuando aplica, `desde`/`hasta` (fechas ISO o `AAAA-MM-DD`).
Los parámetros desconocidos se ignoran y los no textuales (p. ej. `estado[$ne]=x`) se descartan.

Permisos: **U** = usuario, **F** = funcionario, **A** = administrador.

## Públicas y autenticación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/salud` | Público | Estado del servidor y ping a MongoDB (503 si no hay conexión) |
| GET | `/auth/csrf` | Público | Token CSRF de la sesión |
| POST | `/auth/registro` | Público · 10/h | `nombre, apellido, correo, telefono, password, confirmacion_password`. Rechaza `rol`/`estado` (400). Asigna rol `usuario` y estado `activo`. |
| POST | `/auth/inicio-sesion` | Público · 10/15 min | `correo, password`. 401 credenciales, 403 cuenta inactiva. Regenera la sesión y actualiza `ultimaSesion`. |
| POST | `/auth/cierre-sesion` | Cualquiera | Destruye la sesión |
| GET | `/auth/sesion` | U F A | Usuario actual, token CSRF y minutos de inactividad |
| POST | `/auth/actividad` | U F A | Registra actividad del usuario (renueva la inactividad) |
| POST | `/auth/recuperar-contrasena` | Público · 5/15 min | `correo`. Respuesta genérica + `correo_configurado` |
| POST | `/auth/restablecer-contrasena` | Público · 5/15 min | `token, password, confirmacion_password`. Token de un solo uso; invalida sesiones |
| GET | `/eventos` | U F A | Canal SSE (`datos_actualizados`, `nueva_alerta`, `sesion_expirada`) |

## Cuentas (auditadas)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/usuarios` | F A | Directorio (filtros `rol`, `estado`; búsqueda por nombre, apellido o correo). Sin hashes. |
| GET | `/usuarios/:id` | F A | Detalle |
| PATCH | `/usuarios/:id` | F A | `nombre, apellido, telefono` |
| PATCH | `/usuarios/:id/rol` | F A | `rol`. No se otorga un rol superior al propio ni se cambia el propio. Efecto inmediato. |
| PATCH | `/usuarios/:id/estado` | F A | `estado` (`activo`/`inactivo`). Desactivar cierra sus sesiones. |

## Entidades operativas (CRUD consistente)

Cada recurso ofrece `GET /`, `GET /:id`, `POST /`, `PUT /:id` (completo), `PATCH /:id` (parcial), `DELETE /:id`.
Lectura: U F A (salvo donde se indica). Escritura: F A.

| Recurso | Filtros | Reglas destacadas | Rutas adicionales |
|---|---|---|---|
| `/emergencias` | `tipo, estado, nivel_emergencia, pais, departamento, municipio, desde, hasta` | Strategy en POST/PUT/PATCH (magnitud ≥ 5.0 para terremotos); `estado` no se acepta en PUT/PATCH; eliminación bloqueada con dependencias | `POST /:id/transiciones` `{estado, observacion?}` (State, 409 si no es válida o si cambió); `GET /:id/historial` |
| `/zonas` | `catastrofe_id, departamento, municipio, nivel_afectacion, prioridad, estado, estado_atencion` | porcentaje 0–100; inicia `sin_atender`; ubicación por dirección | `PATCH /:id/atencion` `{estado_atencion}`; `GET /:id/historial`; `GET /:id/prioridad-sugerida` |
| `/poblacion-afectada` | `catastrofe_id, zona_id` | Un registro por emergencia–zona; grupos de edad ≤ total; categorías solapables no se suman | — |
| `/familias` | `catastrofe_id, zona_id` | **Sólo F A** (también lectura) | — |
| `/personas-afectadas` | `catastrofe_id, zona_id, familia_id, grupo_edad` | **Sólo F A**; clasificación automática; documento, condiciones y observaciones cifrados | `GET /resumen` (U F A, agregado) |
| `/necesidades` | `catastrofe_id, zona_id, ambito, tipo, prioridad, estado` | Destinatario según ámbito, misma emergencia, sin duplicados abiertos | — |
| `/centros-donacion` | `departamento, municipio, estado` | Ubicación por dirección; no se elimina con donaciones | — |
| `/donaciones` | `catastrofe_id, centro_donacion_id, tipo, estado, metodo_pago, desde, hasta` | Inicia `registrada`; nunca se confirma automáticamente; donante oculto para U | `PATCH /:id/estado` |
| `/reportes-ciudadanos` | `tipo, estado, departamento, municipio, catastrofe_id, desde, hasta` | Inicia `pendiente` | `PATCH /:id/estado`; `POST /:id/evidencia` (multipart `evidencia`, JPG/PNG/PDF ≤ 5 MB); `GET /:id/evidencia` (F A) |
| `/recursos` | `tipo, estado, organizacion_responsable, departamento, municipio, ubicacion_almacen, catastrofe_id, disponibilidad` | Cantidad inicial sólo al crear; no se elimina con movimientos | `POST /:id/movimientos` `{tipo: ingreso\|agotamiento, cantidad, motivo, clave_idempotencia}`; `GET /:id/movimientos` |
| `/asignaciones` | `recurso_id, catastrofe_id, zona_id, estado, desde, hasta` | POST atómico (no supera existencias) e idempotente; PUT/PATCH sólo `responsable, fecha, observaciones`; DELETE = **anular** | `POST /:id/movimientos` `{tipo: entrega\|devolucion, cantidad, clave_idempotencia}` |
| `/recursos-humanos` | `funcion, entidad, disponibilidad, catastrofe_id, zona_id` | Teléfono oculto para U | `PUT /:id/asignacion` `{catastrofe_id, zona_id}`; `DELETE /:id/asignacion` |
| `/fondos` | `catastrofe_id, origen, estado` | Monto asignado sólo al crear (COP enteros); no se elimina con movimientos | `POST /:id/movimientos` `{tipo, monto?, concepto, movimiento_relacionado_id?, sentido?, clave_idempotencia}`; `GET /:id/movimientos` |

Tipos de movimiento de fondos: `compromiso`, `gasto` (directo o ejecutando un compromiso), `anulacion_compromiso`,
`anulacion_gasto`, `ajuste_asignacion` (`sentido: aumento|reduccion`).

## Consultas, mapa, alertas y reportes

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/tablero/indicadores` | U F A | Indicadores desde MongoDB (filtros `departamento, municipio, tipo, nivel_emergencia, estado, desde, hasta`) |
| GET | `/tablero/serie-mensual` | U F A | Emergencias por mes y tipo (`anio` + filtros) |
| GET | `/mapa` | U F A | Elementos de `capas=emergencias,zonas,centros` con filtros `departamento, municipio, nivel, estado, catastrofe_id`; `punto` sólo si la ubicación está confirmada |
| GET | `/busqueda?q=` | U F A | Búsqueda global (emergencias, zonas, recursos, centros) |
| GET | `/catalogos/valores` | U F A | Catálogos, permisos, rangos de edad, regla de magnitud |
| GET | `/catalogos/ubicaciones` | U F A | Departamentos y municipios registrados |
| GET | `/geocodificacion` | F A · 30/min | `pais, departamento, municipio, barrio?, direccion` → coincidencias (502 si el proveedor falla) |
| GET | `/geocodificacion/inversa` | F A · 30/min | `latitud, longitud` (uso interno del marcador) → dirección aproximada |
| GET | `/alertas` | U F A | Alertas del rol con estado de lectura (`solo_no_leidas`, `severidad`); registra la entrega |
| PATCH | `/alertas/:id/lectura` | U F A | Marca una alerta como leída |
| POST | `/alertas/lectura-masiva` | U F A | Marca todas como leídas |
| GET | `/alertas/resumen-entrega` | F A | Totales de entrega y lectura |
| GET | `/reportes-pdf` | U F A · 10/min | `categorias` (emergencias, zonas, poblacion, necesidades, recursos, asignaciones, donaciones, fondos, centros) + `catastrofe_id, departamento, municipio, desde, hasta` → `application/pdf`, cabecera `X-Total-Filas` |
