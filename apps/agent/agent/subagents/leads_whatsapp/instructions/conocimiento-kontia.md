# Qué es Kontia
Kontia es una plataforma chilena para administrar oficinas contables y contadores independientes. No es un ERP ni lleva la contabilidad. Consulta por cada empresa cliente el SII, la Tesorería (TGR), Previred y la Dirección del Trabajo, detecta lo que hay que atender, crea las tareas y las reparte en el equipo, y mantiene informados a los clientes por WhatsApp y correo.

- Lema de la landing: "Toda tu cartera, revisada todos los días".
- Funciona en el navegador, desde el computador o el celular. No hay que instalar nada. Cada persona del equipo entra con su correo y su clave, y ve lo que su rol le permite.
- Junta en un solo lugar la información tributaria y laboral de todas las empresas de la cartera: en vez de entrar al SII, a Previred y a la DT empresa por empresa, Kontia la trae con las credenciales cargadas y muestra el estado consolidado.
- No solo junta la información: la cruza, dice qué está mal y deja al equipo trabajando sobre eso.
- La empresa detrás de Kontia es SGS Innova SpA, de Quilpué, Región de Valparaíso. Kontia es nuevo como producto, pero no en el oficio: detrás hay muchos años de experiencia en contabilidad y en infraestructura cloud.

# Para quién es
- Oficinas contables y contadores independientes chilenos que llevan una cartera de empresas, desde pocas empresas hasta más de 200.
- Sirve igual para empresas con muchos trabajadores o muchos documentos: los procesos pesados corren en segundo plano.
- Funciona con cualquier forma de llevar la contabilidad (cualquier software contable o planillas): Kontia corre en paralelo.

# Contacto y soporte
- Correo: contacto@kontia.cl, o este mismo WhatsApp. Sitio: https://kontia.cl (ahí está el formulario de contacto y el registro).
- Horario de atención: lunes a viernes, de 09:00 a 18:00, hora de Chile continental, salvo feriados.
- Todos los planes incluyen soporte por chat. Dentro de Kontia, el menú de la cuenta (abajo a la izquierda) tiene "Contáctanos" y "Enviar una sugerencia".
- Dentro de Kontia hay un manual de uso: "Cómo usar Kontia", al final del menú. Tiene una ficha por módulo (qué hace, de dónde salen los datos, cada cuánto se actualiza, qué significan sus estados y advertencias prácticas) y un buscador.

# Cómo funciona: credenciales y actualización
- **Clave del SII: por empresa.** Se carga en la ficha de cada empresa (pestaña Credenciales). Habilita F29, Renta, DJ, RCV, boletas de honorarios, TGR (la Clave Tributaria es la misma del SII) y Ciclo de Vida de esa empresa.
- **Previred y ClaveÚnica: por oficina.** Se cargan una sola vez en Administración → Parámetros y sirven para todas las empresas. Cada tarjeta dice qué habilita y si está configurada.
- **Mora previsional y multas de la DT:** son consulta pública, funcionan solo con el RUT, sin clave.
- Renta de los socios: usa la clave del SII de cada socio, que se carga en la sección Socios de la ficha de la empresa.
- Cada oficina puede agregar otras instituciones de credenciales (un banco, una mutual). Vienen SII, DT, AFC e INP.
- Si una clave deja de ser válida, Kontia marca la credencial para que se actualice. Si el SII rechaza una clave, la revisión automática no la sigue probando, para no acercar el bloqueo de la cuenta; lo mismo con la ClaveÚnica y Previred de la oficina.
- **Revisiones automáticas:**
  - Todos los días a las 7:00, el historial completo del F29 de todas las empresas, con el detalle de cada período con observaciones. Una empresa nueva se revisa apenas se crea.
  - Cada noche, desde las 02:00, para el Radar: vuelve a consultar Renta, DJ, anotaciones y multas del SII, TGR, Previred y la DT de cada empresa cuyo dato tenga dos semanas o más. Lo que alguien ya sincronizó antes no se repite.
- Además, cualquier módulo se actualiza al instante con el botón "Sincronizar" sobre la empresa y el período, o para toda la cartera con "Sincronización masiva". Cada vista muestra la fecha de la última sincronización.
- Algunos documentos se emiten una vez al día por empresa (Carpeta Tributaria, certificado de deuda de la TGR): si ya se emitió hoy, Kontia muestra ese mismo. Verlo o enviarlo por correo se puede siempre.
- Si un portal se cae o no responde, Kontia conserva la última información obtenida, con su fecha, y la vuelve a consultar en la revisión siguiente. Todos los días una prueba automática consulta cuentas reales, y si un portal cambió, el equipo de Kontia recibe una alerta para corregirlo.

# Lo que Kontia revisa en cada portal
Con las credenciales de cada empresa y de la oficina, Kontia consulta lo mismo que la oficina revisaría a mano, y lo deja ordenado por empresa:
- **SII:** F29 y sus observaciones, Renta (F22) de la empresa y de los socios, Declaraciones Juradas, Registro de Compras y Ventas (RCV), boletas de honorarios, anotaciones vigentes, notificaciones, abonos y transferencias bancarias, carpeta tributaria, peticiones administrativas y multas del SII.
- **TGR:** certificado de deuda fiscal, convenios de pago, cuotas de convenio vencidas, cartola fiscal, cobranza judicial y embargos.
- **Previred:** montos pagados, traspasos de AFP, nóminas ingresadas, demandas AFP-AFC, planillas declaradas y no pagadas (DNP), pendientes y vencidas.
- **Dirección del Trabajo:** mora previsional presunta, multas ejecutoriadas, Libro de Remuneraciones Electrónico (LRE), LRE con observaciones y carga del LRE en MiDT.

# Radar de empresas
- Junta en un solo lugar los problemas e inconsistencias de cada empresa en todos los portales y la marca como urgente, moderada o al día.
- Detecta: F29 sin declarar u observados; Renta y DJ observadas; anotaciones y multas del SII; deuda y cobranza de la TGR; planillas impagas y demandas de Previred; mora, multas y LRE de la DT; tareas vencidas.
- Y lo que ningún portal muestra solo, cruzando módulos: cotizaciones pagadas en Previred sin el Libro de Remuneraciones declarado en la DT, un LRE con trabajadores sin pagos en Previred, un RCV con documentos en un mes cuyo F29 no se declaró, o una empresa "sin movimiento" con documentos en el RCV.
- Cada problema abre su tarea (urgente o moderada), y Kontia la cierra sola cuando el problema desaparece; si vuelve, abre otra.
- Arriba muestra cuántos problemas hay y cuáles se repiten más; un clic filtra la lista. Cada problema dice cuándo se encontró por última vez y lleva a la vista donde se revisa.
- Lo que la oficina ya sabe se puede silenciar, de a uno o varios a la vez, hasta reactivarlo.
- El número del menú son las urgentes abiertas. Cada usuario ve solo lo de los módulos que su rol permite.
- El avance de la revisión de cada noche se sigue en el Centro de actividad.

# Tributario
**F29 (IVA mensual)**
- Grilla mes a mes por empresa: quién declaró y quién no, con folio y monto. Se actualiza sola todos los días a las 7:00.
- Estados: En plazo, Declarado, Con observaciones, Guardado (borrador sin presentar), No declarado (el SII lo reclama y el plazo venció), Pendiente, Girada, Reemplazada, Anulada.
- El plazo se toma del calendario tributario del SII (corre por fines de semana y feriados). No pide F29 de meses anteriores al inicio de actividades.
- "Notificar" le avisa al cliente que su F29 está presentado; "Enviar copia" le manda además el PDF oficial del SII. El botón queda en verde con la fecha de envío.
- "Notificación masiva": manda el aviso del F29 de un período a los clientes de muchas empresas de una vez, con su avance en el Centro de actividad.

**Consulta Integral del F29**
- El historial completo de F29 de cada empresa (los últimos siete años) en una grilla de meses por años, igual a la del SII. Sirve para encontrar períodos con observaciones o sin declarar que quedaron atrás, sin ir período por período.
- Se revisa sola cada día a las 7:00. Se descarga en PDF (resumen por empresa) y Excel (con el estado de cada mes), con lo que esté filtrado.
- Si una empresa activa aparece sin consultar, es señal de que su clave del SII dejó de servir.

**Observaciones del F29**
- Al hacer clic en una observación se ve lo mismo que muestra el SII: folio y estado, pago, cada observación con su código y la discrepancia, la orientación del SII para resolverla y el historial de eventos.
- Por cada período con observaciones Kontia crea una tarea para el ejecutivo de la empresa (como máximo una por período).
- Desde el detalle, "Consultar RCV" y "Consultar Honorarios" llevan a revisar ese período.

**Renta (F22)**
- Renta Empresa: la declaración anual de cada empresa por año tributario, con su resultado. Estados: Aceptada, Pendiente, Devolución, Pago, Sin movimiento, Observada.
- Renta Socios: lo mismo para las personas naturales socias, con la clave del SII de cada socio.
- Si el SII deja una Renta observada, Kontia crea una tarea para revisarla (una por empresa y año tributario).

**Declaraciones Juradas**
- Estado de todas las DJ del año por empresa, marcando cuáles son obligatorias según el régimen y cuáles están vencidas.
- Estados: Declarada, Pendiente, Pendiente vencida, Con observaciones, No declara.
- Al hacer clic en una DJ observada se ve cada observación con su código, su descripción y cómo corregirla, y Kontia crea una tarea para revisarla.

**Tareas por observaciones del SII**
- Cada período del F29, cada DJ y cada Renta con observaciones tiene su tarea, nunca más de una, por lo de los últimos 3 años.

**TGR (Tesorería)**
- Certificado de deuda, convenios de pago vigentes y cartola con cobranza judicial y embargos, con un solo botón "Sincronizar TGR".
- Avisa cuando detecta embargo o vencimientos próximos. El PDF del certificado queda guardado para verlo o enviarlo por correo.
- Si la Tesorería no responde a tiempo, guarda lo que sí salió y no borra lo anterior.

**Ciclo de Vida (SII)**
- Seis consultas sobre la situación de la empresa ante el SII: Anotaciones Vigentes, Notificaciones, Abonos y transferencias bancarias, Carpeta Tributaria, Peticiones Administrativas y Multas SII.
- Anotaciones Vigentes es la vista clave para prevenir problemas: muestra observaciones que pueden frenar trámites del cliente.
- La Carpeta Tributaria se emite con folio válido por 365 días; una vez emitida se puede ver o enviar sin volver a emitirla.

# Contabilidad
**RCV (Registro de Compras y Ventas)**
- Compras y ventas de cada empresa por mes: total, cantidad de documentos e IVA, incluido el IVA no recuperable.
- Al hacer clic se ve por tipo de documento (facturas, exentas, notas de crédito, boletas) y, con "Ver documentos", uno por uno con fecha, folio, RUT y montos.
- Se pueden consultar los últimos siete años. Usa la clave del SII de la empresa.

**Boleta de Honorarios**
- Las boletas de honorarios que recibió cada empresa (BHE) y las de terceros que emitió (BTE), mes a mes, con bruto, retención y líquido; al hacer clic, boleta por boleta.
- Sirve para revisar una observación del F29 por retenciones. Las anuladas se ven en gris y no suman.

**Estado de Resultados y simulación del impuesto**
- El resultado de cada empresa mes a mes: ventas, compras, honorarios, remuneraciones y otros ingresos y gastos, con el impuesto a la renta estimado y los PPM pagados.
- Se arma solo con datos del SII (RCV, IVA no recuperable, boletas de honorarios, PPM de cada F29) y del LRE de la Dirección del Trabajo (con la ClaveÚnica de la oficina).
- El listado muestra el año de todas las empresas con su utilidad y su impuesto. Al abrir una empresa se elige el período, aunque cruce de un año a otro.
- Impuesto: la utilidad del año por la tasa del régimen (14 A, 14 D N°3 o 14 D N°8), menos los PPM pagados actualizados por IPC, y el incentivo al ahorro del artículo 14 E. Las tasas y factores vienen del SII.
- Los gastos sin factura (arriendo, luz, agua) y otros ingresos se agregan a mano. Se puede simular con otro régimen sin cambiar el de la empresa.
- Es una estimación: no reemplaza la determinación de la renta líquida imponible.
- "Ver PDF" arma un informe para el cliente: el estado mes a mes con gráficos, los PPM, la determinación del impuesto, la proyección al cierre del año, indicadores (márgenes, remuneraciones sobre ventas, punto de equilibrio), principales clientes y proveedores, y próximos vencimientos (F29, Renta, cuotas de convenios con la TGR). No usa IA.
- "Enviar copia" lo manda al correo de la empresa; la pestaña "Enviados" muestra lo que ya se envió.

**Balance**
- Checklist de cierre contable mes a mes por empresa: se marcan los procesos completados (compras, ventas, conciliación y los que la oficina defina) y cuándo se le envió el balance al cliente. Las columnas son configurables por oficina. Es de carga manual.

# RRHH, Previred y Dirección del Trabajo
**RRHH (Proceso Nómina)**
- Trabajadores: nómina de cada empresa con cargo, contrato, jornada, sueldo y fecha de ingreso. Carga manual o por CSV. Es la base del Gestor Documental (contratos, finiquitos).
- Nómina: control mensual por empresa de liquidaciones, imposiciones y LRE, con montos y fechas de envío al cliente. Al marcar "Previred procesado", los montos de imposiciones se traen solos desde Previred, con el PDF de cada planilla.
- Movimiento Personal: altas, bajas y cambios de contrato (Pendiente, Procesado, Anulado).

**Previred (seis vistas, con la credencial Previred de la oficina)**
- Montos Pagados: lo que la empresa pagó en imposiciones en el mes, por institución (AFP, salud, seguro de cesantía). El PDF de planillas se envía al cliente y el botón queda en verde con la fecha.
- Traspasos AFP: trabajadores que se cambiaron de AFP, para ajustar la próxima planilla. Previred publica solo los dos períodos más recientes, así que conviene revisarlo cada mes.
- Demandas: demandas AFP y AFC vigentes por cotizaciones impagas, con tribunal, estudio jurídico, monto y detalle por trabajador y período.
- Ver Nóminas Ingresadas: planillas cargadas en Previred y todavía sin pagar, con desglose por institución y el borrador en PDF.
- DNP Pendientes de Pago y DNP Vencidas: planillas declaradas y no pagadas, la antesala de la mora y de una demanda.
- Columna "Cuenta Previred": ticket verde si la empresa está en la cuenta de la oficina, X roja si no, con filtro.

**Dirección del Trabajo**
- Mora Previsional: si la empresa figura con mora previsional presunta. Solo con el RUT. Descarga en Excel tal como la entrega la DT.
- Multas DT: multas ejecutoriadas, pagadas o en cobranza. Solo con el RUT. Descarga en Excel.
- LRE con ClaveÚnica: el Libro de Remuneraciones de cada empresa en MiDT mes a mes, sin entrar a MiDT: si está declarado, número de declaración, fecha de carga y trabajadores informados; descarga del libro en CSV y del comprobante en PDF. Al hacer clic en una empresa se ve su historial completo. Usa la ClaveÚnica de la oficina.
- Subir Libros de Remuneraciones: declara en MiDT el LRE de varias empresas y meses de una vez, desde sus archivos CSV. Primero muestra qué se va a declarar para quitar lo que no se quiera mandar, y el resultado de cada libro se ve en el Centro de actividad. Un mes ya declarado se salta, salvo que se fuerce para corregir.
- Hay tres cosas que MiDT exige confirmar al empleador y Kontia no puede hacer por él: registrar el correo, completar los datos de contacto y aceptar los términos del Libro. Kontia indica cuándo falta alguna.

# Sincronización masiva y Centro de actividad
- **Sincronización masiva:** actualiza de una vez el F29, la Renta, las DJ, Previred o la DT de toda la cartera, en vez de empresa por empresa. Está en F29, las seis vistas de Previred, Renta, Renta de socios, DJ, Ciclo de Vida (menos Carpeta Tributaria), RCV, Boleta de Honorarios y Estado de Resultados.
- Antes de lanzarla se eligen las empresas; las sincronizadas hace poco se saltan solas.
- Corre en el servidor: se puede cerrar la ventana o seguir trabajando. Lo que se sincroniza a mano pasa primero, así no frena el trabajo del día. Si se detiene, lo ya sincronizado queda.
- **Centro de actividad:** botón en la barra de arriba que reúne lo que Kontia hace en segundo plano: sincronizaciones y notificaciones masivas, correos a clientes, avisos de WhatsApp, carga de Libros de Remuneraciones y la revisión nocturna del Radar. Muestra lo que salió bien, lo que falló y por qué, y lo que sigue en curso. Se filtra por tipo, estado y período.

# Tareas
- Cada empresa con su ejecutivo, y tareas con uno o varios responsables, prioridad (baja, media, alta, urgente) y plazo, vinculadas a una empresa.
- Vista Lista o Tablero: una columna por estado, agrupable por persona o por empresa; con "Columnas" se eligen los estados a ver.
- Cada tarea es de un tipo, y cada tipo tiene sus propios pasos entre Pendiente y Completada o Cancelada, sus subtareas que se crean solas y su vencimiento. Se configuran en Administración → Parámetros → Tipos de tarea.
- Al abrir una tarea se ve en un panel al costado, con comentarios, actividad y subtareas. Con @ y el nombre de alguien se le avisa. Quien sigue una tarea recibe sus avisos.
- Hay tareas de aprobación, que requieren que alguien apruebe antes de cerrarse.
- "Para varias empresas": crea la misma tarea para muchas empresas de una vez, o hace que se cree sola cada mes.
- **Tareas automáticas:** Kontia abre una tarea cuando detecta un problema y la cierra sola cuando se resuelve: clave del SII rechazada, deuda en la TGR sin convenio, planillas de Previred declaradas y no pagadas, demandas de Previred, multas de la DT, el LRE que falta subir cuando Previred muestra cotizaciones pagadas, y las observaciones del SII en F29, Renta y DJ. Aparecen marcadas "Radar" y no suman a los números de las tareas del equipo.
- Las tareas también llegan de los clientes por el bot de WhatsApp.
- Si una empresa pasa a Inactivo, Kontia cancela sus tareas abiertas con un comentario que lo explica.
- Bitácora de la empresa: notas que no se borran al sincronizar; con @ se avisa a alguien de la oficina.

# Avisos a los clientes por WhatsApp y correo
- **Recordatorio del F29 por WhatsApp:** llega solo a las empresas que aún no presentan el F29 del período, el día y la hora que la oficina elija cada mes. "Vista previa" muestra el mensaje y a cuántas empresas les llegaría.
- **Recordatorio de imposiciones por WhatsApp:** para las empresas con trabajadores, el día y la hora que la oficina elija.
- **Aviso a quien no pagó el F29:** unos días después del vencimiento, Kontia revisa en el SII cada empresa y avisa por WhatsApp solo a las que siguen sin pagar, para que regularicen antes de que sumen reajustes, intereses y multas. Disponible para todas las oficinas; se activa en Avisos WhatsApp y se elige cuántos días después del vencimiento sale (3 por defecto, a las 10:00). A cada número le llega una vez al mes.
- **Por correo:** copia del F29 (PDF oficial del SII), aviso de F29 presentado, PDF de Montos Pagados de Previred y el informe del Estado de Resultados, a un cliente o a toda la cartera de una vez (Notificación masiva del F29).
- Los avisos solo van a números cargados en la ficha de la empresa con WhatsApp habilitado: cada número tiene su propio permiso, así nadie recibe algo que no aceptó.
- **Plantillas de correo:** la oficina personaliza el texto de los correos a sus clientes, con su tono y su firma. La firma acepta imágenes, como el logo de la oficina.

# Bot de WhatsApp para los clientes de la oficina
- El cliente le escribe al número de la oficina y el asistente lo atiende: puede crear una tarea (elige la categoría y la prioridad y cuenta qué necesita) o consultar en qué va una que ya pidió, con su número de ticket.
- La solicitud queda como tarea asignada al ejecutivo de esa empresa, con un ticket para hacerle seguimiento. Sin correos que se pierden ni mensajes sueltos en el celular de alguien.
- Kontia reconoce la empresa por el número del cliente; si el número está en varias empresas, el bot pregunta por cuál es la consulta.
- El cliente no instala nada ni inicia sesión, y recibe un aviso cuando su tarea se completa.
- Solo atiende a números cargados en la ficha de una empresa y con WhatsApp habilitado.

# Documentos y firma electrónica
- **Gestor Documental:** genera documentos en PDF desde plantillas de la oficina (contratos, finiquitos, certificados), con los datos de la empresa y del trabajador tomados de sus fichas.
- Los manda a firmar por correo: el firmante recibe un enlace con acceso solo a ese documento y no necesita cuenta en Kontia.
- La firma es secuencial: primero el trabajador y después la empresa. Cada documento guarda su línea de tiempo (en qué etapa va y quién falta), y queda almacenado y descargable.
- Plantillas de documentos: se definen una vez con campos variables; son propias de cada oficina. Editar una plantilla no cambia los documentos ya generados.
- Es firma electrónica simple: la oficina decide si es adecuada para cada documento. No sirve para actos que por ley exijan firma electrónica avanzada, notario u otra solemnidad.

# Reportes y auditoría
- **Reportes:** indicadores consolidados de la oficina en seis categorías (Empresas, Tareas, F29, Renta, RRHH y Balance), con descarga en PDF para presentar o archivar.
- **Auditoría:** registro de todos los cambios, quién hizo qué y cuándo, incluidos los inicios de sesión. No se puede editar ni borrar. En las consultas al SII, la TGR, Previred y la DT, "Ver detalle" muestra qué se pidió y qué se contestó, útil cuando una sincronización no trajo lo esperado. Se busca por rango de fechas. Las contraseñas nunca quedan registradas.

# Equipo, roles y administración
- **Usuarios:** alta y baja del equipo con su rol. Desde el panel de cada persona se envía el enlace para crear su contraseña, se reinicia su verificación en dos pasos o se desbloquea su cuenta.
- **Roles:** perfiles de acceso a medida, con permisos por submódulo (por ejemplo, F29 sin Renta). RCV, Boleta de Honorarios y Gestor Documental tienen su propio permiso. Si alguien no tiene permiso de un módulo, no le aparece en el menú.
- **Ejecutivo por empresa:** cada empresa tiene su ejecutivo a cargo; las tareas automáticas y las del bot le llegan a él.
- **Parámetros:** listas configurables (bancos, regímenes, instituciones de credenciales, tipos de tarea) sin depender de soporte. Los estados de empresa son fijos: Activo, Suspendido, Inactivo, Moroso, En proceso, Sin movimiento.
- **Seguridad de la oficina:** la oficina puede exigir verificación en dos pasos a todos sus usuarios.

# Seguridad y datos
- Las claves de los clientes (SII, Previred, ClaveÚnica) se cifran con AES-256-GCM antes de guardarse, además del cifrado de los discos y los respaldos: dos capas. Las llaves de cifrado se guardan aparte, en un gestor de secretos, y se renuevan cada mes.
- Todo corre en Google Cloud, en Santiago de Chile. Cada oficina tiene su propia base de datos, separada de las demás.
- Los datos van cifrados también en tránsito: entre el navegador y Kontia, entre sus servidores y hacia los servicios que consulta.
- Las claves nunca aparecen en las pantallas normales, ni en reportes ni en correos. Se pueden revelar con el ojo al lado, y cada vez queda registrado quién y cuándo. También se pueden copiar al portapapeles sin mostrarlas. Kontia las usa solo para las consultas que la oficina configura.
- Verificación en dos pasos con aplicación autenticadora: obligatoria para los administradores de Kontia y disponible para que cada oficina la exija a todo su equipo.
- Inicio de sesión con captcha, límite de intentos y bloqueo: tras 5 intentos fallidos seguidos desde una conexión, esa conexión queda bloqueada 30 minutos (un administrador de la oficina lo puede liberar antes). El sitio pasa por un túnel cifrado y un firewall de aplicaciones (Cloudflare) que bloquea ataques conocidos y tráfico automatizado.
- Respaldo continuo en Google Cloud, en Chile, y una copia diaria cifrada en Cloudflare; dentro de los respaldos las claves siguen cifradas.
- Contrato de datos: los Términos y Condiciones tienen una cláusula de protección y tratamiento de datos. La oficina es la responsable de los datos y SGS Innova SpA los trata como encargada, solo según sus instrucciones y la ley chilena. Kontia no vende los datos ni los usa para otros fines.
- Ante un incidente de seguridad confirmado que afecte materialmente los datos, SGS avisa a la oficina sin demora.
- Proveedores que usa el servicio (detalle en la Política de Privacidad, en https://kontia.cl): Google Cloud (servidores y respaldos, en Santiago), Cloudflare (protección del sitio, documentos y copia diaria), WhatsApp Business de Meta (avisos, si la oficina los activa), Anthropic (solo para funciones de IA que la oficina active), Sentry (errores, sin datos personales) y Reveniu (cobro de la suscripción).
- Si un cliente de la oficina pide algo sobre sus datos personales, la solicitud va a la oficina, que es la responsable.

# Cómo empezar
- Registro en https://kontia.cl ("Comenzar mes gratis"): se elige el plan según el tamaño de la cartera y se deja la tarjeta. También está el formulario "Conversemos sobre tu oficina" para que el equipo contacte a la persona.
- El equipo de Kontia ayuda a cargar las empresas y a dejar todo configurado, sin costo.
- **Carga masiva de empresas por CSV** (Empresas → "Importar CSV"): basta el RUT y la clave del SII de cada una. Kontia trae del SII la razón social (o el nombre, si es persona natural), el inicio de actividades, los giros, el régimen tributario, el domicilio, la región y la comuna, y deja la empresa lista para sincronizar.
  - Columnas opcionales: ejecutivo, teléfono de WhatsApp del contacto (y si recibe avisos), nombre de contacto, correo, estado.
  - Se sube el archivo completo; el avance se ve fila por fila. Si se vuelve a subir, las empresas que ya están se reconocen por su RUT: se actualizan, no se duplican.
  - Recomendación: borrar el archivo después, porque tiene las claves legibles.
- **Carga masiva de trabajadores por CSV** (RRHH → Trabajadores → "Importar CSV"): RUT, nombre y RUT de la empresa, más cargo, contrato, jornada, sueldo, correo, teléfono e ingreso.
- Configuración inicial: cargar las credenciales de Previred y ClaveÚnica de la oficina en Parámetros, invitar al equipo con sus roles y configurar los avisos de WhatsApp y las plantillas de correo.
- La fecha de inicio de actividades de cada empresa importa: Kontia la usa para no exigir declaraciones de períodos en que la empresa no existía.

# Tiempo que ahorra
- Revisar a mano los portales de una empresa toma, por lo bajo, unos 48 minutos al mes: revisar el F29 en el SII tres veces al mes (12 min), los pagos en Previred (5), la mora previsional en la DT (3), las multas de la DT (3), el Libro de Remuneraciones (4), la deuda en la TGR (8), diagnosticar la empresa (10) y avisarle al cliente (3).
- Con 100 empresas son unas 80 horas al mes: 10 jornadas de 8 horas, 960 horas al año.
- Con Kontia ese trabajo lo hace la sincronización y el equipo solo atiende las empresas que aparecen con problemas.
- El cálculo no cuenta la Renta, las DJ, el Estado de Resultados ni los reportes, que ahorran todavía más. En https://kontia.cl hay una calculadora.

# Software contable
- Kontia no se conecta con ningún software contable y no necesita ninguno: funciona por su cuenta, con los datos que trae del SII, la TGR, Previred y la Dirección del Trabajo.
- La contabilidad se sigue llevando donde la oficina quiera (cualquier software contable, o incluso planillas). Kontia corre en paralelo.
- Si alguien no tiene software contable, igual puede usar Kontia; la contabilidad la lleva aparte.

# Lo que Kontia no hace
- No lleva la contabilidad ni es un ERP.
- No presenta las declaraciones: la oficina sigue presentando el F29, la Renta, las DJ y las demás, y haciendo los pagos. Kontia consulta, ordena y avisa. Donde sí hace el trámite es en la carga de los Libros de Remuneraciones en la Dirección del Trabajo.
- No presta servicios contables, tributarios, laborales ni jurídicos, y no reemplaza el criterio del contador. Antes de declarar o pagar, conviene confirmar el dato en la fuente oficial.
- El Estado de Resultados y la simulación del impuesto son estimaciones; no reemplazan la determinación de la renta líquida imponible.
- No resuelve en MiDT lo que exige confirmación del empleador (registrar el correo, datos de contacto, aceptar los términos del Libro).
- La firma es electrónica simple, no avanzada.
- No garantiza disponibilidad ininterrumpida: depende también de que el SII, la TGR, Previred y la DT respondan.
- Emitir facturas o boletas electrónicas no está entre las funciones de los planes publicados: no lo ofrezcas; si lo preguntan, ofrece una reunión con el equipo.

# Funciones que todavía no están disponibles para todos
- **Próximamente: reporte de gestión mensual con IA.** Un PDF por empresa cada mes, hecho sobre su Estado de Resultados: qué pasó con las ventas, los márgenes, los costos y el impuesto, dónde la empresa pierde dinero y qué acciones conviene tomar, con cada gráfico explicado, para enviárselo al cliente. Los números los calcula Kontia; la IA (Claude) los explica, y a la IA se le envían los indicadores sin el nombre ni el RUT de la empresa. Hoy aparece con un candado. No lo ofrezcas como algo que ya existe.
- **En prueba con algunas oficinas:** "Copia masiva" del F29 (enviar el PDF oficial del F29 presentado a muchos clientes de una vez) y "Cuadratura F29" (el F29 contra el RCV, la Boleta de Honorarios y el LRE del mismo mes). No las ofrezcas como disponibles.

# Novedades recientes
**Octubre 2026**
- Radar de empresas: los problemas de toda la cartera en todos los portales, cada uno con su tarea que se cierra sola al resolverse; se pueden silenciar.
- Tareas renovadas: Lista y Tablero, tipos de tarea con sus propios pasos, subtareas automáticas, varios responsables, panel lateral y tareas para varias empresas o recurrentes cada mes.
- Una tarea por cada observación del SII (F29, DJ y Renta) de los últimos 3 años.
- Las DJ observadas muestran el detalle del SII (código, descripción y cómo corregir) y tienen sincronización masiva.
- Estado de Resultados y simulación del impuesto, con PDF para el cliente y envío por correo.
- Aviso por WhatsApp a quien no pagó el F29, disponible para todas las oficinas.
- Notificación masiva del F29 para todas las oficinas.
- Tareas que se abren y se cierran solas (clave del SII rechazada, TGR sin convenio, DNP y demandas de Previred, multas DT, LRE faltante).
- Una empresa inactiva cierra sus tareas abiertas.
- Importar empresas trae también el régimen tributario y el nombre de las personas naturales.
- RCV, Boleta de Honorarios y Gestor Documental con su propio permiso en Roles.
- El logo de la oficina en la firma de los correos.
- El envío del PDF de Montos Pagados de Previred queda marcado con la fecha.
- Plan de referidos y sugerencias en el menú de la cuenta.

**Septiembre 2026**
- Subir Libros de Remuneraciones a MiDT de varias empresas y meses de una vez.
- Centro de actividad y sincronizaciones masivas en F29, Previred, Renta, Ciclo de Vida, RCV y Honorarios.
- Detalle de las observaciones del F29, con su tarea.
- Módulos nuevos de Boleta de Honorarios y de Registro de Compras y Ventas.
- Libro de Remuneraciones Electrónico con ClaveÚnica, sin entrar a MiDT, con su historial en la misma pantalla.
- Montos de imposiciones traídos solos desde Previred, y la vista Ver Nóminas Ingresadas.
- Columna "Cuenta Previred" en las vistas de Previred.
- Consulta Integral descargable en PDF y Excel.
- Auditoría con búsqueda por rango de fechas.
- Copiar una credencial sin mostrarla.
- Manual de uso dentro de Kontia ("Cómo usar Kontia"), con buscador.

**Agosto 2026**
- Cuatro vistas nuevas de Previred: Montos Pagados, Traspasos AFP, Demandas y Declaración y No Pago.
- Consulta Integral del F29.
- Bot de WhatsApp: los clientes crean y consultan tareas por WhatsApp.

# Precio, prueba y contrato
- El primer mes es gratis, con la cartera propia. Al registrarse se elige el plan según el tamaño de la cartera y se deja la tarjeta; el primer cobro es al mes siguiente.
- Sin contrato de permanencia: se puede cancelar cuando se quiera. Según los Términos, se avisa por escrito al menos cinco días hábiles antes del siguiente período de facturación, y no hay devolución por períodos ya iniciados.
- Todos los planes incluyen todas las funciones; cambian solo cuántas empresas y usuarios tiene la oficina. Para carteras de más de 200 empresas hay un plan a medida (Corporate), que se conversa con ventas.
- Los valores son en UF por mes, más IVA, y se facturan mes a mes por adelantado; la UF se convierte a pesos al valor del día de la factura. Un cambio de precio se avisa con al menos 30 días corridos de anticipación.
- Los cupos cuentan las empresas activas y los usuarios de la oficina; las empresas dadas de baja no cuentan. Al llegar al límite, para agregar más empresas o usuarios hay que cambiarse a un plan mayor.

# Plan de referidos
- Una oficina cliente que recomienda Kontia a otra oficina recibe una gift card por el doble de lo que la oficina referida pague su primer mes, disponible al tercer mes de la referida.
- Quien llega recomendado escribe el código en el campo "Código de referido" al crear su cuenta. Si se le olvida, la recomendación no queda registrada y no se puede asociar después, así que conviene copiar el código en vez de tipearlo.

# Exportar y salir
- Los listados de empresas, tareas, F29 y otros se descargan en Excel o CSV; los libros y balances, en CSV y PDF; los reportes, en PDF. La Consulta Integral en PDF y Excel; la mora y las multas de la DT en Excel; el LRE en CSV con su comprobante en PDF.
- La información es de la oficina: conserva la titularidad y el control de sus datos.
- Si la oficina deja Kontia, tiene 30 días corridos para exportar su información, y el equipo ayuda con la exportación completa. Después los datos se eliminan, salvo lo que la ley obligue a conservar, y las copias en respaldos se borran en su ciclo normal, de no más de 30 días, siempre cifradas. Las claves se eliminan con todo lo demás; igual se recomienda cambiarlas al salir.

# Reuniones con el equipo
- La reunión es gratis y sin compromiso. Dura 30 minutos, por Google Meet, y sirve para ver Kontia con las empresas de la propia oficina y ayudar a empezar.
