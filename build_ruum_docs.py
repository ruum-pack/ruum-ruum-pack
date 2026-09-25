from pathlib import Path
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(r"C:\Users\hmlom\ruum")
TEMPLATE = Path(r"C:\Users\hmlom\Downloads\Plantillas_BRD_PRD_FRD.docx")
OUT = ROOT / "deliverables"
OUT.mkdir(parents=True, exist_ok=True)

DATE = "16/09/2026"
BLUE = "1F4E78"
LIGHT_BLUE = "D9EAF7"
PALE_BLUE = "F3F8FC"
GRAY = "D9D9D9"
BLACK = RGBColor(0, 0, 0)


def clear_body(doc):
    body = doc._element.body
    for child in list(body):
        if child.tag != qn("w:sectPr"):
            body.remove(child)


def set_font(run, name="Calibri", size=10.5, bold=False, italic=False, color=BLACK):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color


def setup_doc(doc, title, subtitle):
    clear_body(doc)
    styles = doc.styles
    for style_name, size, bold in [("Normal", 10.5, False), ("Title", 24, True), ("Heading 1", 15, True), ("Heading 2", 12, True), ("Heading 3", 11, True)]:
        try:
            style = styles[style_name]
        except KeyError:
            style = styles.add_style(style_name, WD_STYLE_TYPE.PARAGRAPH)
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
        style.font.size = Pt(size)
        style.font.bold = bold
        style.font.color.rgb = BLACK
        if style_name == "Normal":
            style.paragraph_format.space_after = Pt(6)
            style.paragraph_format.line_spacing = 1.08
        elif style_name == "Title":
            style.paragraph_format.space_after = Pt(4)
        else:
            style.paragraph_format.space_before = Pt(10 if style_name == "Heading 1" else 7)
            style.paragraph_format.space_after = Pt(4)
            style.paragraph_format.keep_with_next = True
    section = doc.sections[0]
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("Ruum Ruum | Documento controlado | Versión 0.1")
    set_font(r, size=8, color=RGBColor(89, 89, 89))
    p = doc.add_paragraph(style="Title")
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = p.add_run(title)
    set_font(r, size=24, bold=True)
    p = doc.add_paragraph()
    r = p.add_run(subtitle)
    set_font(r, size=12, color=RGBColor(89, 89, 89))
    p.paragraph_format.space_after = Pt(12)
    add_rule_note(doc, "Fuente de negocio: Plan Maestro Integral de Ruum Ruum, by MoviliaX. Documento preparado para revisión.")


def add_rule_note(doc, text):
    p = doc.add_paragraph()
    r = p.add_run(text)
    set_font(r, size=9, italic=True, color=RGBColor(89, 89, 89))
    p.paragraph_format.space_after = Pt(8)


def h(doc, text, level=1):
    return doc.add_paragraph(text, style=f"Heading {level}")


def para(doc, text="", bold_prefix=None):
    p = doc.add_paragraph()
    if bold_prefix and text.startswith(bold_prefix):
        r = p.add_run(bold_prefix)
        set_font(r, bold=True)
        r = p.add_run(text[len(bold_prefix):])
        set_font(r)
    else:
        r = p.add_run(text)
        set_font(r)
    return p


def bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Paragraph")
        p.paragraph_format.left_indent = Inches(0.2)
        p.paragraph_format.first_line_indent = Inches(-0.12)
        r = p.add_run("• " + item)
        set_font(r)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def borders(table, color=GRAY):
    tbl_pr = table._tbl.tblPr
    border = tbl_pr.first_child_found_in("w:tblBorders")
    if border is None:
        border = OxmlElement("w:tblBorders")
        tbl_pr.append(border)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = border.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            border.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:tblHeader")
    el.set(qn("w:val"), "true")
    tr_pr.append(el)


def table(doc, headers, rows, widths=None, font_size=8.5):
    safe_widths = None
    if widths:
        total = sum(widths)
        if total > 6.8:
            scale = 6.8 / total
            safe_widths = [w * scale for w in widths]
        else:
            safe_widths = list(widths)
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    borders(t)
    hdr = t.rows[0]
    repeat_header(hdr)
    for i, text in enumerate(headers):
        cell = hdr.cells[i]
        if safe_widths:
            cell.width = Inches(safe_widths[i])
        shade(cell, BLUE)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(str(text))
        set_font(r, size=font_size, bold=True, color=RGBColor(255, 255, 255))
    for ridx, row in enumerate(rows):
        cells = t.add_row().cells
        for i, val in enumerate(row):
            if safe_widths:
                cells[i].width = Inches(safe_widths[i])
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if ridx % 2 == 1:
                shade(cells[i], PALE_BLUE)
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(str(val))
            set_font(r, size=font_size)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return t


def metadata(doc, rows):
    table(doc, ["Campo", "Contenido"], rows, widths=[2.0, 4.8], font_size=9)


def approvals(doc):
    table(doc, ["Nombre", "Rol", "Decisión", "Fecha", "Firma"], [
        ["Pendiente", "Dirección general", "Pendiente", "", ""],
        ["Pendiente", "Responsable de operación", "Pendiente", "", ""],
        ["Pendiente", "Responsable tecnológico", "Pendiente", "", ""],
    ], widths=[1.35, 1.75, 1.35, 1.0, 1.25], font_size=8.5)


def build_brd():
    doc = Document(str(TEMPLATE))
    setup_doc(doc, "Ruum Ruum Documento de Requerimientos de Negocio", "BRD | Justificación, objetivos y alcance de la iniciativa")
    h(doc, "Identificación del documento", 1)
    metadata(doc, [
        ["Proyecto / iniciativa", "Ruum Ruum - plataforma digital de traslado vehicular"],
        ["Organización / área", "MoviliaX | Negocio, operación y producto"],
        ["Tipo de documento", "BRD - Business Requirements Document"],
        ["Versión / fecha", f"0.1 / {DATE}"],
        ["Responsable", "Equipo de producto y operación"],
        ["Estado", "Borrador para revisión"],
    ])
    h(doc, "Control de versiones", 1)
    table(doc, ["Versión", "Fecha", "Autor", "Descripción", "Aprobado por"], [["0.1", DATE, "Equipo de producto y operación", "Primera versión basada en el Plan Maestro Integral", "Pendiente"]], widths=[0.8, 1.0, 1.7, 2.5, 1.0])

    h(doc, "1. Resumen ejecutivo", 1)
    para(doc, "Situación actual: Ruum Ruum evoluciona de un servicio de traslado vehicular con conductores certificados a una plataforma digital respaldada por MoviliaX. La operación necesita conectar clientes, conductores y administración mediante tres experiencias coordinadas: App Usuario, App Conductor y Ruum Ruum Admin.")
    para(doc, "Oportunidad o problema: mover un vehículo todavía puede ser informal, poco transparente y difícil de comprobar. Los clientes carecen de evidencia, seguimiento y certeza sobre quién traslada su vehículo; los conductores carecen de reglas claras, visibilidad sobre pagos y soporte operativo.")
    para(doc, "Solución propuesta: una red de conductores certificados y un ecosistema digital que permite solicitar, cotizar, asignar, ejecutar, monitorear y documentar cada traslado. La evidencia inicial y final, la ruta, los estados y los pagos forman parte del registro operativo.")
    para(doc, "Beneficio esperado: operar un piloto controlado con 5 a 15 conductores certificados, 3 a 5 clientes empresariales y 50 a 150 traslados, alcanzando al menos 98% de evidencia completa y cero incidentes sin folio documentado.")
    para(doc, "Decisión solicitada: aprobar la definición del MVP y la ruta de validación operativa para construir la Fase 1 después de comprobar entre 50 y 150 traslados mediante herramientas semimanuales.")

    h(doc, "2. Contexto y planteamiento del problema", 1)
    h(doc, "2.1 Antecedentes", 2)
    para(doc, "Ruum Ruum se posiciona como una plataforma que conecta usuarios con conductores certificados para mover vehículos de forma segura, trazable y documentada. El Plan Maestro define una operación con soporte humano, asignaciones auditables, evidencia obligatoria, pagos transparentes y protocolos de seguridad.")
    h(doc, "2.2 Declaración del problema", 2)
    para(doc, "Hoy, particulares, agencias, talleres, lotes, flotillas y empresas experimentan incertidumbre y poca trazabilidad cuando entregan un vehículo para traslado, lo que puede provocar retrasos, disputas por daños, costos no explicados y pérdida de confianza.")
    h(doc, "2.3 Evidencia de negocio", 2)
    table(doc, ["Evidencia", "Dato o señal", "Fuente", "Periodo"], [
        ["Meta de validación operativa", "50 a 150 traslados iniciales", "Plan Maestro Integral", "Piloto de 60 a 90 días"],
        ["Calidad de evidencia", "Al menos 98% de viajes con evidencia completa", "Plan Maestro Integral", "Fase piloto"],
        ["Cobertura inicial", "5 a 15 conductores y 3 a 5 clientes B2B", "Plan Maestro Integral", "Fase piloto"],
        ["Control anticorrupción", "Cero asignaciones manuales sin justificación", "Plan Maestro Integral", "Fase piloto"],
    ], widths=[1.7, 2.4, 1.5, 1.2])
    h(doc, "2.4 Costo de no hacer nada", 2)
    para(doc, "Si Ruum Ruum mantiene una operación informal, seguirá expuesta a daños difíciles de atribuir, retrasos sin seguimiento, pagos opacos, asignaciones manipulables y un crecimiento que dependa de personas clave. También se retrasará la entrada a clientes B2B que necesitan evidencia y reportes por traslado.")

    h(doc, "3. Objetivos de negocio y métricas de éxito", 1)
    table(doc, ["ID", "Objetivo", "Métrica", "Línea base", "Meta", "Plazo"], [
        ["OBJ-001", "Validar un flujo completo y repetible de traslado", "Traslados completados con cierre documentado", "No establecida", "50 a 150 en piloto", "60 a 90 días"],
        ["OBJ-002", "Asegurar evidencia antes y después del viaje", "% de viajes con evidencia completa", "No establecida", ">= 98%", "Piloto"],
        ["OBJ-003", "Crear una red inicial de oferta confiable", "Conductores certificados activos", "No establecida", "5 a 15", "Piloto"],
        ["OBJ-004", "Validar recurrencia B2B", "Clientes empresariales piloto", "No establecida", "3 a 5", "Piloto"],
        ["OBJ-005", "Hacer auditables las decisiones operativas", "Asignaciones manuales sin justificación", "No establecida", "0", "Piloto"],
        ["OBJ-006", "Documentar incidentes y pagos", "Incidentes sin folio / pagos sin desglose", "No establecida", "0 / 0", "Piloto"],
    ], widths=[0.75, 2.2, 1.8, 0.9, 1.0, 0.85], font_size=8)

    h(doc, "4. Alcance", 1)
    h(doc, "4.1 Dentro del alcance", 2)
    bullets(doc, ["Diseño y validación del ecosistema App Usuario, App Conductor y Admin Web responsive.", "Solicitud, cotización o tarifa estimada, programación, asignación, aceptación, ejecución, entrega y cierre de traslados.", "Evidencia inicial y final: fotografías, odómetro, combustible, daños visibles, firmas y observaciones.", "Estados del viaje, seguimiento operativo, soporte, incidencias y bitácora.", "Validación documental y certificación inicial de conductores.", "Pagos básicos al conductor, gastos autorizados y registro de pagos.", "Roles internos esenciales, auditoría de asignaciones y notas internas.", "Servicios iniciales Local, Ruta y Empresas; expansión posterior para Premium, Relevo, Flotillas y Motos."])
    h(doc, "4.2 Fuera del alcance inicial", 2)
    bullets(doc, ["Automatización financiera completa, conciliación bancaria y reportes fiscales.", "Asignación inteligente avanzada, tarifas dinámicas complejas y analítica predictiva.", "Crédito corporativo, centros de costo y flujos empresariales avanzados.", "Integraciones profundas con CRM, ERP, agencias, flotillas, mensajería y facturación.", "App administrativa móvil independiente; en MVP se contempla web responsive para acciones rápidas.", "Funciones vistosas que no resuelvan el ciclo principal de solicitud a cierre."])
    h(doc, "4.3 Sistemas y procesos impactados", 2)
    table(doc, ["Sistema o proceso", "Tipo de impacto", "Área responsable", "Criticidad"], [
        ["Operación de traslados", "Digitalización y trazabilidad", "Coordinación operativa", "Alta"],
        ["Certificación de conductores", "Validación documental y capacitación", "Calidad y certificación", "Alta"],
        ["Pagos y gastos", "Desglose, autorización y registro", "Finanzas / operación", "Alta"],
        ["Atención e incidencias", "Folio, escalamiento y resolución", "Soporte operativo", "Alta"],
        ["Evidencia vehicular", "Captura, revisión y consulta", "Conductor / Admin", "Alta"],
    ], widths=[1.8, 2.3, 1.7, 0.9])

    h(doc, "5. Stakeholders y matriz RACI", 1)
    table(doc, ["Stakeholder", "Rol", "Interés", "Influencia"], [
        ["Dirección general", "Patrocinador", "Estrategia, alianzas y crecimiento", "Alta"],
        ["Coordinación operativa", "Dueño del proceso", "Asignaciones, viajes e incidencias", "Alta"],
        ["Conductores certificados", "Proveedor operativo", "Viajes justos, seguridad y pagos claros", "Alta"],
        ["Clientes B2B y particulares", "Usuario / comprador", "Control, evidencia y confiabilidad", "Alta"],
        ["Calidad y certificación", "Control operativo", "Documentos, capacitación y auditoría", "Media"],
        ["Tecnología", "Implementación", "Producto, datos, seguridad e integraciones", "Alta"],
        ["Finanzas y legal", "Control y cumplimiento", "Pagos, contratos, privacidad y riesgos", "Media"],
    ], widths=[1.6, 1.55, 3.0, 0.65])
    table(doc, ["Actividad", "Dirección", "Operación", "Producto / BA", "Tecnología", "Finanzas / Legal"], [
        ["Aprobar BRD", "A", "C", "R", "C", "C"],
        ["Definir KPIs y piloto", "A", "R", "C", "C", "I"],
        ["Validar operación semimanual", "I", "R/A", "C", "I", "C"],
        ["Aprobar PRD y FRD", "A", "C", "R", "C", "I"],
        ["Liberar MVP", "A", "R", "C", "R", "C"],
    ], widths=[2.0, 1.0, 1.0, 1.25, 1.0, 1.25], font_size=8.5)

    h(doc, "6. Requerimientos de negocio", 1)
    table(doc, ["ID", "Requerimiento de negocio", "Objetivo", "Prioridad", "Solicitante", "Estado"], [
        ["RN-001", "El negocio debe permitir solicitar un traslado con vehículo, origen, destino, fecha y hora.", "OBJ-001", "Must", "Dirección / operación", "Propuesto"],
        ["RN-002", "El negocio debe asignar conductores certificados mediante reglas registradas y auditables.", "OBJ-005", "Must", "Operación", "Propuesto"],
        ["RN-003", "Cada traslado debe conservar evidencia inicial y final consultable.", "OBJ-002", "Must", "Calidad", "Propuesto"],
        ["RN-004", "El usuario debe consultar estatus, conductor asignado y evidencia disponible.", "OBJ-001", "Must", "Cliente", "Propuesto"],
        ["RN-005", "El conductor debe conocer pago, gastos y fecha estimada antes de aceptar.", "OBJ-006", "Must", "Conductores", "Propuesto"],
        ["RN-006", "La operación debe registrar incidencias con folio, responsable, estado y resolución.", "OBJ-006", "Must", "Soporte", "Propuesto"],
        ["RN-007", "La plataforma debe controlar documentos, certificación y vencimientos de conductores.", "OBJ-003", "Must", "Calidad", "Propuesto"],
        ["RN-008", "La operación debe registrar pagos a conductores y gastos autorizados con desglose.", "OBJ-006", "Must", "Finanzas", "Propuesto"],
        ["RN-009", "El producto debe soportar clientes B2B y particulares sin duplicar la operación.", "OBJ-004", "Should", "Comercial", "Propuesto"],
        ["RN-010", "El sistema debe proteger datos personales, evidencia y datos bancarios.", "OBJ-001", "Must", "Legal / tecnología", "Propuesto"],
        ["RN-011", "El piloto debe medir asignación, aceptación, cierre, evidencia, incidencias y pagos.", "OBJ-001", "Must", "Producto", "Propuesto"],
        ["RN-012", "La primera versión debe priorizar el ciclo completo antes que la automatización avanzada.", "OBJ-001", "Must", "Dirección", "Propuesto"],
    ], widths=[0.75, 2.65, 0.8, 0.65, 1.25, 0.8], font_size=7.8)

    h(doc, "7. Situación actual y situación deseada", 1)
    h(doc, "7.1 Proceso actual AS-IS", 2)
    table(doc, ["Paso", "Actividad actual", "Responsable", "Duración", "Punto de dolor"], [
        ["1", "Se recibe una solicitud por canales dispersos.", "Comercial / operación", "Variable", "Datos incompletos y poca trazabilidad"],
        ["2", "Se busca un conductor disponible mediante contactos manuales.", "Operación", "Variable", "Favoritismo o decisiones no auditables"],
        ["3", "Se coordina recolección y traslado por mensajes.", "Conductor", "Variable", "Estados invisibles y retrasos"],
        ["4", "La evidencia se comparte como archivos sueltos.", "Conductor / operación", "Variable", "Dificultad para comparar daños"],
        ["5", "El pago se calcula y comunica manualmente.", "Finanzas", "Variable", "Desglose insuficiente"],
    ], widths=[0.5, 2.6, 1.25, 0.8, 1.65])
    h(doc, "7.2 Proceso deseado TO-BE", 2)
    table(doc, ["Paso", "Actividad propuesta", "Responsable", "Duración", "Mejora esperada"], [
        ["1", "El usuario crea una solicitud guiada y revisa la tarifa.", "Usuario", "Minutos", "Solicitud completa"],
        ["2", "Admin revisa operabilidad y asigna con criterios registrados.", "Admin", "Controlada", "Decisión auditable"],
        ["3", "Conductor acepta con pago y condiciones visibles.", "Conductor", "Rápida", "Transparencia"],
        ["4", "Conductor captura evidencia inicial, ruta, incidencias y evidencia final.", "Conductor", "Por etapa", "Prueba de estado y entrega"],
        ["5", "Usuario consulta estatus y evidencia; Admin cierra y registra pago.", "Usuario / Admin", "Controlada", "Cierre repetible"],
    ], widths=[0.5, 2.6, 1.25, 0.8, 1.65])

    h(doc, "8. Supuestos, restricciones y dependencias", 1)
    table(doc, ["Tipo", "ID", "Descripción", "Impacto si no se cumple", "Responsable"], [
        ["Supuesto", "SUP-001", "Se validará la operación con 50 a 150 traslados antes de automatizar ampliamente.", "Construcción prematura y sobrecostos", "Dirección / operación"],
        ["Supuesto", "SUP-002", "Habrá conductores disponibles para certificación inicial.", "No se prueba el ciclo completo", "Certificación"],
        ["Restricción", "RES-001", "El MVP debe centrarse en el ciclo solicitud-asignación-ejecución-evidencia-cierre.", "Alcance y plazo se expanden", "Producto"],
        ["Dependencia", "DEP-001", "Contratos, privacidad, política de pagos y protocolos deben estar definidos.", "Riesgo legal y operativo", "Legal / operación"],
        ["Dependencia", "DEP-002", "Mapas, GPS, almacenamiento y servicios de notificación estarán disponibles.", "Seguimiento y evidencia incompletos", "Tecnología"],
    ], widths=[0.8, 0.7, 3.1, 1.45, 1.0], font_size=8)

    h(doc, "9. Riesgos", 1)
    table(doc, ["ID", "Riesgo", "Prob.", "Impacto", "Exposición", "Mitigación", "Dueño"], [
        ["RSK-001", "Daño, retraso o accidente durante el traslado.", "Media", "Alta", "Alta", "Evidencia, protocolos, soporte y cobertura.", "Operación"],
        ["RSK-002", "Relación legal inadecuada con conductores.", "Media", "Alta", "Alta", "Asesoría legal y contratos coherentes con la operación.", "Legal"],
        ["RSK-003", "Manipulación de asignaciones o comisiones externas.", "Media", "Alta", "Alta", "Auditoría, reglas claras, canal de denuncia y bitácora.", "Dirección"],
        ["RSK-004", "Evidencia incompleta o difícil de revisar.", "Media", "Alta", "Alta", "Campos obligatorios, revisión administrativa y alertas.", "Calidad"],
        ["RSK-005", "Baja adopción por exceso de pasos.", "Media", "Media", "Media", "Validación semimanual, pruebas y diseño guiado.", "Producto"],
        ["RSK-006", "Crecimiento antes de estabilizar la operación.", "Media", "Media", "Media", "Fases, criterios de salida y control de volumen.", "Dirección"],
    ], widths=[0.65, 1.7, 0.5, 0.55, 0.65, 2.15, 0.9], font_size=7.6)

    h(doc, "10. Análisis costo beneficio", 1)
    h(doc, "10.1 Costos estimados", 2)
    bullets(doc, ["Desarrollo y mantenimiento de las tres piezas digitales y sus servicios de datos.", "Mapas, GPS, almacenamiento de evidencia, notificaciones y seguridad.", "Soporte operativo, administración, validación documental y capacitación.", "Contratos, asesoría legal, privacidad, cobertura o seguro y facturación.", "Adquisición de clientes, alianzas y materiales comerciales."])
    h(doc, "10.2 Beneficios esperados", 2)
    table(doc, ["Beneficio", "Tipo", "Cuantificación de piloto", "Base de cálculo"], [
        ["Evidencia completa", "Riesgo / calidad", ">= 98% de viajes", "Meta de fase piloto"],
        ["Operación repetible", "Operativo", "50 a 150 viajes cerrados", "Volumen de validación"],
        ["Red certificada", "Oferta", "5 a 15 conductores", "Meta de fase piloto"],
        ["Tracción B2B", "Comercial", "3 a 5 clientes piloto", "Meta de fase piloto"],
        ["Control anticorrupción", "Gobierno", "0 asignaciones manuales sin justificar", "Meta de fase piloto"],
    ], widths=[1.6, 1.1, 1.9, 2.1], font_size=8.5)
    h(doc, "10.3 Indicadores financieros", 2)
    para(doc, "El Plan Maestro define las fuentes de ingreso y categorías de costo, pero no incluye importes ni supuestos financieros suficientes para calcular ROI o periodo de recuperación. Finanzas debe completar el modelo antes de una aprobación de inversión definitiva.")

    h(doc, "11. Cronograma de alto nivel", 1)
    table(doc, ["Hito", "Entregable", "Fecha objetivo", "Responsable"], [
        ["Validación de base", "Marca, servicios, rutas piloto y tarifa base", "Días 1-15", "Dirección / producto"],
        ["Legal y operación", "Contratos, pagos, inspección y emergencias", "Días 16-30", "Legal / operación"],
        ["Conductores piloto", "5 a 15 conductores validados y certificados", "Días 31-45", "Calidad"],
        ["Clientes piloto", "3 a 5 clientes B2B y primeros servicios", "Días 46-60", "Comercial"],
        ["Operación controlada", "50 a 150 traslados y medición", "Días 61-75", "Operación"],
        ["Preparación tecnológica", "MVP priorizado, wireframes y roles", "Días 76-90", "Producto / tecnología"],
    ], widths=[1.2, 3.1, 1.0, 1.4], font_size=8.5)

    h(doc, "12. Aprobaciones", 1)
    para(doc, "Este BRD queda vigente cuando los responsables confirman el problema, el alcance, los objetivos y las condiciones de inversión.")
    approvals(doc)
    h(doc, "13. Glosario", 1)
    table(doc, ["Término", "Definición"], [
        ["BRD", "Documento de requerimientos de negocio; explica por qué se hace la iniciativa."],
        ["PRD", "Documento de requerimientos de producto; define qué se construye para quién."],
        ["FRD", "Documento de requerimientos funcionales; define cómo debe comportarse cada función."],
        ["Evidencia", "Fotos, video cuando aplique, lecturas, firmas, observaciones y registros del traslado."],
        ["MVP", "Primera versión que permite operar el ciclo completo y aprender con datos reales."],
        ["Conductor certificado", "Conductor validado documentalmente, capacitado y evaluado bajo estándares operativos."],
    ], widths=[1.8, 5.0], font_size=9)
    path = OUT / "BRD_Ruum_Ruum.docx"
    doc.save(path)
    return path


def build_prd():
    doc = Document(str(TEMPLATE))
    setup_doc(doc, "Ruum Ruum Documento de Requerimientos de Producto", "PRD | Producto digital para solicitar y controlar traslados vehiculares")
    h(doc, "1. Identificación del documento", 1)
    metadata(doc, [
        ["Producto", "Ecosistema Ruum Ruum: Usuario, Conductor y Admin"],
        ["Documento de negocio de origen", "BRD_Ruum_Ruum.docx, versión 0.1"],
        ["Autor / responsable", "Equipo de producto y operación"],
        ["Versión / fecha", f"0.1 / {DATE}"],
        ["Estado", "Borrador para revisión"],
        ["Release objetivo", "Fase 1 - MVP operativo funcional"],
    ])
    h(doc, "2. Visión del producto", 1)
    para(doc, "Para personas y empresas que necesitan mover un vehículo con confianza, Ruum Ruum es una plataforma de traslado vehicular que conecta clientes con conductores certificados y ofrece evidencia, seguimiento y soporte de punta a punta, a diferencia de los traslados informales o poco trazables.")
    para(doc, "Mensaje central: Mueve tu auto sin soltar el control.")
    h(doc, "2.1 Problema y oportunidad", 2)
    para(doc, "El usuario no sabe siempre quién mueve su vehículo, en qué etapa se encuentra, qué daños existían antes del viaje o cómo resolver una incidencia. El conductor necesita conocer qué viajes puede aceptar, cuánto recibirá y qué soporte tendrá. La oportunidad es convertir la operación en un producto visible, documentado y repetible.")
    h(doc, "2.2 Usuarios objetivo y perfiles", 2)
    table(doc, ["Perfil", "Descripción", "Necesidad principal", "Frustración actual", "Volumen inicial"], [
        ["Cliente particular", "Persona que mueve un auto por compra, venta, cambio de residencia, taller o entrega.", "Solicitar y seguir un traslado.", "Falta de confianza y evidencia.", "Piloto"],
        ["Cliente B2B", "Agencia, taller, lote, flotilla, arrendadora o aseguradora.", "Mover varias unidades con control y reportes.", "Procesos lentos y dispersos.", "3 a 5 clientes"],
        ["Conductor certificado", "Conductor validado, capacitado y evaluado.", "Recibir viajes claros y cobrar con transparencia.", "Asignaciones y pagos opacos.", "5 a 15 conductores"],
        ["Coordinador operativo", "Responsable de asignar, monitorear y resolver.", "Ver qué requiere atención y actuar rápido.", "Información fragmentada.", "Equipo interno"],
        ["Validador / finanzas", "Controla documentos, evidencia, gastos y pagos.", "Revisar y dejar trazabilidad.", "Revisión manual sin historial único.", "Equipo interno"],
    ], widths=[1.15, 2.35, 1.55, 1.5, 0.7], font_size=7.8)
    h(doc, "2.3 Escenarios de uso", 2)
    bullets(doc, ["Cuando necesito mover un vehículo, quiero registrar origen, destino, fecha y datos del auto, para poder solicitar una cotización sin depender de mensajes dispersos.", "Cuando acepto un viaje, quiero conocer pago, condiciones, ruta y requisitos, para poder decidir con información suficiente.", "Cuando mi vehículo está en traslado, quiero consultar su estado y la evidencia, para poder mantener el control sin llamar continuamente.", "Cuando ocurre una incidencia, quiero reportarla con un folio y soporte, para poder recibir una respuesta documentada.", "Cuando administro la operación, quiero revisar viajes, evidencia, documentos y pagos en un solo lugar, para poder cerrar servicios con trazabilidad."])

    h(doc, "3. Objetivos del producto y métricas", 1)
    table(doc, ["ID", "Objetivo del producto", "Métrica", "Línea base", "Meta", "Objetivo BRD"], [
        ["RP-001", "Completar el ciclo digital mínimo de traslado.", "% de viajes que llegan a cierre con evidencia", "No establecida", ">= 98% evidencia completa", "OBJ-001 / OBJ-002"],
        ["RP-002", "Reducir incertidumbre del cliente.", "Viajes con estatus y evidencia consultables", "No establecida", "100% de viajes del MVP", "OBJ-001"],
        ["RP-003", "Hacer clara la propuesta al conductor.", "Viajes aceptados con pago visible", "No establecida", "100% de ofertas del MVP", "OBJ-006"],
        ["RP-004", "Controlar la operación interna.", "Incidencias con folio y responsable", "No establecida", "100% de incidencias", "OBJ-006"],
        ["RP-005", "Validar demanda y oferta iniciales.", "Conductores / clientes piloto", "No establecida", "5-15 / 3-5", "OBJ-003 / OBJ-004"],
    ], widths=[0.7, 2.3, 1.6, 0.9, 1.0, 1.0], font_size=8)
    h(doc, "3.1 Contra-métricas", 2)
    table(doc, ["Métrica a vigilar", "Umbral aceptable", "Acción si se cruza"], [
        ["Incidentes sin folio", "0", "Bloquear cierre hasta registrar incidente."],
        ["Asignaciones manuales sin justificación", "0", "Revisar bitácora y escalar a operación."],
        ["Pagos sin desglose", "0", "Detener liberación y corregir información."],
        ["Evidencia incompleta", "< 2% del piloto", "Solicitar aclaración o reentrenar."],
        ["Cancelación por complejidad de flujo", "No establecida", "Observar sesiones y simplificar pasos."],
    ], widths=[2.4, 1.35, 3.05], font_size=8.5)

    h(doc, "4. Alcance por fases", 1)
    table(doc, ["Fase", "Contenido", "Criterio de salida", "Fecha objetivo"], [
        ["Fase 0", "Marca, operación, legal, protocolos y validación semimanual.", "Documentos mínimos y operación lista.", "Días 1-30"],
        ["Fase 1 MVP", "Solicitud, asignación, aceptación, evidencia, estados, incidencias y pagos básicos.", "Ciclo completo operable y medible.", "Días 31-90"],
        ["Fase 2", "Pagos en app, facturación, experiencia enriquecida y reportes básicos.", "MVP estable y primeras mejoras comerciales.", "Posterior"],
        ["Fase 3", "Empresas, usuarios múltiples, centros de costo y reportes B2B.", "Clientes B2B recurrentes.", "Posterior"],
        ["Fase 4-5", "Automatización, analítica, integraciones y expansión regional.", "Operación repetible a escala.", "Posterior"],
    ], widths=[1.0, 3.0, 2.2, 1.0], font_size=8.3)
    h(doc, "4.1 Fuera de alcance del MVP", 2)
    bullets(doc, ["Crédito corporativo, centros de costo, facturación avanzada y usuarios empresariales múltiples.", "Asignación automática avanzada, tarifas dinámicas complejas, analítica predictiva y automatización financiera.", "Chat interno completo, calificación avanzada, promociones y seguimiento de mapa avanzado.", "Funciones de servicios Premium, Relevo, Flotillas y Motos que requieran protocolos distintos."])

    h(doc, "5. Épicas e historias de usuario", 1)
    h(doc, "5.1 Mapa de épicas", 2)
    table(doc, ["ID", "Épica", "Descripción", "Prioridad", "Fase"], [
        ["EP-01", "Solicitud de traslado", "Registrar vehículo, ruta, fecha y condiciones.", "Must", "1"],
        ["EP-02", "Asignación y aceptación", "Validar, asignar y aceptar un viaje.", "Must", "1"],
        ["EP-03", "Ejecución y evidencia", "Documentar recolección, traslado y entrega.", "Must", "1"],
        ["EP-04", "Consulta y confianza", "Ver estatus, conductor, evidencia y soporte.", "Must", "1"],
        ["EP-05", "Operación administrativa", "Gestionar viajes, usuarios, conductores e incidencias.", "Must", "1"],
        ["EP-06", "Pagos y documentos", "Registrar pagos, gastos y documentos.", "Must", "1"],
        ["EP-07", "Empresa y escala", "Funciones B2B avanzadas, reportes e integraciones.", "Should", "2-5"],
    ], widths=[0.7, 1.65, 3.0, 0.7, 0.7], font_size=8.3)
    h(doc, "5.2 Historias de usuario", 2)
    table(doc, ["ID", "Épica", "Historia", "Criterios de aceptación", "Prior.", "Est."], [
        ["HU-001", "EP-01", "Como usuario, quiero registrar vehículo, origen, destino, fecha y hora, para solicitar un traslado.", "Dado que completé los campos obligatorios, cuando confirmo, entonces se crea la solicitud con ID y estatus recibida.", "Must", "Propuesta"],
        ["HU-002", "EP-01", "Como usuario, quiero revisar el resumen y precio estimado, para decidir antes de confirmar.", "Dado que hay una solicitud válida, cuando reviso, entonces veo ruta, vehículo, horario, tarifa y condiciones.", "Must", "Propuesta"],
        ["HU-003", "EP-02", "Como Admin, quiero revisar la operabilidad y asignar un conductor, para iniciar el servicio.", "Dado un viaje pendiente, cuando asigno un conductor elegible, entonces queda registrada la decisión y se notifica.", "Must", "Propuesta"],
        ["HU-004", "EP-02", "Como conductor, quiero ver el pago y condiciones antes de aceptar, para decidir informado.", "Dado que recibo una oferta, cuando consulto, entonces veo monto, ruta, tiempo, gastos y fecha estimada.", "Must", "Propuesta"],
        ["HU-005", "EP-03", "Como conductor, quiero cargar evidencia inicial, para documentar el estado del vehículo.", "Dado que llegué al origen, cuando cargo campos y archivos obligatorios, entonces el viaje pasa a documentado.", "Must", "Propuesta"],
        ["HU-006", "EP-03", "Como conductor, quiero reportar una incidencia, para recibir soporte y dejar constancia.", "Dado un viaje activo, cuando elijo un tipo y describo el evento, entonces se crea folio, prioridad y notificación.", "Must", "Propuesta"],
        ["HU-007", "EP-03", "Como conductor, quiero cargar evidencia final y confirmar entrega, para cerrar la ejecución.", "Dado que llegué al destino, cuando cargo evidencia final y firma o aceptación, entonces se solicita cierre administrativo.", "Must", "Propuesta"],
        ["HU-008", "EP-04", "Como usuario, quiero consultar estatus, conductor y evidencia, para saber qué ocurre.", "Dado un viaje creado, cuando abro detalle, entonces veo línea de tiempo, conductor y evidencia disponible.", "Must", "Propuesta"],
        ["HU-009", "EP-05", "Como Admin, quiero revisar evidencia inicial y final, para aprobar o pedir aclaración.", "Dado un viaje con evidencia, cuando comparo, entonces puedo aprobar, marcar incompleta o asociar incidencia.", "Must", "Propuesta"],
        ["HU-010", "EP-05", "Como Admin, quiero gestionar estados e incidencias, para mantener control operativo.", "Dado un evento operativo, cuando cambio estado y agrego nota, entonces la bitácora conserva actor y fecha.", "Must", "Propuesta"],
        ["HU-011", "EP-06", "Como Admin, quiero registrar pago al conductor y gastos autorizados, para cerrar la parte financiera.", "Dado un viaje revisado, cuando registro monto y desglose, entonces queda estatus financiero y auditoría.", "Must", "Propuesta"],
        ["HU-012", "EP-06", "Como validador, quiero revisar documentos del conductor, para mantener una red certificada.", "Dado un documento cargado, cuando lo apruebo o rechazo con motivo, entonces se actualiza estatus y se notifica.", "Must", "Propuesta"],
        ["HU-013", "EP-07", "Como cliente empresarial, quiero organizar usuarios y vehículos, para repetir solicitudes.", "Dado un contrato B2B aprobado, cuando administro cuenta, entonces puedo consultar unidades e historial.", "Should", "Fase 2"],
    ], widths=[0.65, 0.65, 2.2, 2.25, 0.6, 0.7], font_size=7.3)

    h(doc, "6. Experiencia de usuario", 1)
    h(doc, "6.1 Flujo principal", 2)
    table(doc, ["Paso", "Usuario", "Conductor", "Admin"], [
        ["1", "Registra solicitud", "", "Recibe y revisa"],
        ["2", "Confirma datos y tarifa", "", "Valida operabilidad"],
        ["3", "Espera asignación", "Recibe oferta", "Asigna conductor"],
        ["4", "Ve conductor y estatus", "Acepta y llega al origen", "Monitorea"],
        ["5", "Consulta evidencia inicial", "Carga evidencia inicial", "Revisa evidencia"],
        ["6", "Consulta avance", "Ejecuta traslado y reporta", "Atiende incidencias"],
        ["7", "Consulta evidencia final", "Carga evidencia y confirma entrega", "Cierra y registra pago"],
    ], widths=[0.5, 2.15, 2.15, 2.15], font_size=8.3)
    h(doc, "6.2 Flujos alternativos y de error", 2)
    table(doc, ["Escenario", "Disparador", "Comportamiento esperado"], [
        ["Solicitud incompleta", "Falta un campo obligatorio", "Mostrar validación junto al campo y no crear la solicitud."],
        ["Sin conductor elegible", "No hay disponibilidad o certificación suficiente", "Mantener viaje pendiente, informar a Admin y permitir seguimiento."],
        ["Oferta rechazada", "Conductor rechaza o expira", "Registrar motivo si aplica y devolver a cola de asignación."],
        ["Evidencia incompleta", "Faltan fotos, lectura o firma", "Marcar incompleta, solicitar aclaración y bloquear cierre."],
        ["Incidencia", "Conductor usa un botón de seguridad", "Crear folio, prioridad, ubicación y notificación a soporte."],
        ["Servicio no disponible", "Falla de API o conectividad", "Conservar datos locales seguros, mostrar mensaje claro y permitir reintento."],
    ], widths=[1.55, 2.0, 3.25], font_size=8.3)
    h(doc, "6.3 Contenido y tono", 2)
    para(doc, "El producto usa lenguaje claro, directo, moderno y cercano. Evita términos burocráticos y comunica estados con acciones concretas.")
    table(doc, ["Evitar", "Usar"], [["Solicitud de servicio de traslado vehicular registrada exitosamente.", "Tu traslado ya fue solicitado."], ["Documentación visual del estado de la unidad.", "Evidencia de tu auto."], ["Operador asignado al servicio.", "Tu conductor asignado."], ["Administración de servicios asignados.", "Tus viajes aceptados."]], widths=[3.25, 3.55], font_size=8.5)

    h(doc, "7. Requisitos no funcionales", 1)
    table(doc, ["ID", "Categoría", "Requerimiento", "Criterio de medición"], [
        ["RNF-001", "Rendimiento", "Las pantallas principales deben responder en un tiempo percibido adecuado para la operación.", "Medir p95 en pruebas de MVP y definir umbral antes de release."],
        ["RNF-002", "Disponibilidad", "El Admin debe permitir consultar y actualizar viajes durante la ventana operativa.", "Monitoreo y registro de errores por release."],
        ["RNF-003", "Seguridad", "Los datos sensibles y credenciales deben protegerse en tránsito y reposo.", "Revisión de controles y pruebas de acceso."],
        ["RNF-004", "Privacidad", "La evidencia y datos bancarios solo se muestran a actores autorizados.", "Pruebas por rol y revisión de políticas."],
        ["RNF-005", "Compatibilidad", "Admin web debe ser responsive en escritorio y tablet para acciones urgentes.", "Prueba en navegadores soportados y tamaños definidos por QA."],
        ["RNF-006", "Accesibilidad", "Formularios, estados, errores y acciones deben ser comprensibles y navegables.", "Revisión WCAG y pruebas manuales."],
        ["RNF-007", "Auditabilidad", "Cambios de estado, asignaciones, pagos e incidencias deben conservar actor y fecha.", "Consulta de bitácora por entidad."],
        ["RNF-008", "Escalabilidad", "La solución debe separar módulos de usuario, conductor y admin para crecer por fases.", "Revisión de arquitectura y límites del MVP."],
    ], widths=[0.7, 1.0, 3.0, 2.1], font_size=7.9)

    h(doc, "8. Dependencias, supuestos y riesgos de producto", 1)
    table(doc, ["Tipo", "Descripción", "Responsable", "Estado"], [
        ["Dependencia", "Contratos, privacidad, política de daños, pagos y emergencias.", "Legal / operación", "Por validar"],
        ["Dependencia", "Mapas, GPS, almacenamiento y notificaciones.", "Tecnología", "Por definir"],
        ["Supuesto", "La operación se valida antes de automatizar procesos avanzados.", "Dirección", "Aceptado por plan"],
        ["Riesgo", "El flujo puede percibirse como pesado si pide demasiados datos.", "Producto", "Mitigación en pruebas"],
        ["Riesgo", "La evidencia puede ser inconsistente entre conductores.", "Calidad", "Capacitación y validación"],
    ], widths=[1.0, 3.1, 1.5, 1.2], font_size=8.5)

    h(doc, "9. Plan de lanzamiento", 1)
    table(doc, ["Etapa", "Contenido", "Go / No-Go", "Reversión"], [
        ["Piloto semimanual", "50 a 150 traslados con herramientas simples.", "Go si hay datos de operación y protocolos probados.", "Pausar volumen y corregir proceso."],
        ["MVP controlado", "Ciclo digital completo con usuarios, conductores y Admin.", "Go si evidencia >= 98% y no hay pagos o incidentes sin registro.", "Volver a operación semimanual por módulo."],
        ["Escala B2B", "Clientes recurrentes, reportes y cuentas empresariales.", "Go si el MVP opera estable y hay demanda repetida.", "Limitar nuevas cuentas y mantener piloto."],
    ], widths=[1.2, 2.4, 2.0, 1.4], font_size=8.0)
    h(doc, "9.1 Medición posterior al lanzamiento", 2)
    table(doc, ["Métrica", "Instrumentación", "Frecuencia", "Responsable"], [
        ["Solicitudes, aceptaciones y cierres", "Eventos de viaje", "Diaria / semanal", "Producto / operación"],
        ["Tiempo de asignación y cierre", "Marcas de tiempo de estados", "Semanal", "Operación"],
        ["Evidencia completa", "Checklist de evidencia", "Por viaje / semanal", "Calidad"],
        ["Incidencias y respuesta", "Folios y bitácora", "Por evento / semanal", "Soporte"],
        ["Pagos, gastos y margen", "Registro financiero", "Semanal", "Finanzas"],
        ["Recompra, satisfacción y quejas", "Encuestas / historial", "Mensual", "Comercial"],
    ], widths=[2.0, 2.0, 1.2, 1.6], font_size=8.3)
    h(doc, "9.2 Preguntas abiertas", 2)
    table(doc, ["ID", "Pregunta", "Responsable", "Fecha límite", "Estado"], [
        ["PA-001", "¿Cuál será el modelo legal final de contratación o relación con conductores?", "Dirección / legal", "Antes de MVP", "Abierta"],
        ["PA-002", "¿Qué proveedor y política se usarán para pagos y facturación?", "Finanzas", "Antes de MVP", "Abierta"],
        ["PA-003", "¿Qué campos de evidencia son obligatorios por tipo de servicio?", "Calidad / operación", "Antes de diseño final", "Abierta"],
        ["PA-004", "¿Qué cobertura o seguro aplica a cada ruta y nivel de servicio?", "Legal / operación", "Antes de piloto", "Abierta"],
        ["PA-005", "¿Qué ciudades y rutas integran el primer piloto?", "Dirección / comercial", "Días 1-15", "Abierta"],
    ], widths=[0.7, 3.4, 1.3, 1.0, 0.8], font_size=8.0)
    h(doc, "10. Aprobaciones", 1)
    approvals(doc)
    path = OUT / "PRD_Ruum_Ruum.docx"
    doc.save(path)
    return path


def fr_detail(doc, rid, name, actor, priority, source, inputs, rules, outputs, errors, acceptance):
    h(doc, f"{rid} - {name}", 3)
    table(doc, ["Campo", "Contenido"], [
        ["Actor", actor], ["Prioridad", priority], ["Trazabilidad", source], ["Entradas", inputs], ["Reglas de negocio", rules], ["Salidas", outputs], ["Errores y excepciones", errors], ["Criterio de aceptación", acceptance],
    ], widths=[1.75, 5.05], font_size=8.5)


def build_frd():
    doc = Document(str(TEMPLATE))
    setup_doc(doc, "Ruum Ruum Documento de Requerimientos Funcionales", "FRD | Comportamiento verificable del ecosistema Ruum Ruum")
    h(doc, "1. Identificación del documento", 1)
    metadata(doc, [
        ["Sistema", "Ecosistema Ruum Ruum: App Usuario, App Conductor y Admin Web"],
        ["Documento de origen", "PRD_Ruum_Ruum.docx, versión 0.1"],
        ["Tipo de documento", "FRD - Functional Requirements Document"],
        ["Versión / fecha", f"0.1 / {DATE}"],
        ["Responsable", "Analista funcional / equipo de producto"],
        ["Estado", "Borrador para revisión"],
    ])
    h(doc, "2. Propósito y documentos de referencia", 1)
    para(doc, "Este FRD traduce el PRD de Ruum Ruum a entradas, reglas, salidas, estados y errores verificables. Cubre el MVP de operación: solicitar, revisar, asignar, aceptar, documentar, ejecutar, entregar, cerrar y registrar el pago.")
    table(doc, ["Documento", "Versión", "Fecha", "Ubicación"], [
        ["BRD Ruum Ruum", "0.1", DATE, "deliverables/BRD_Ruum_Ruum.docx"],
        ["PRD Ruum Ruum", "0.1", DATE, "deliverables/PRD_Ruum_Ruum.docx"],
        ["Plan Maestro Integral", "Fuente", "", "Documento proporcionado por el usuario"],
        ["Plantilla PRD Funcional", "Referencia", "", "Documento proporcionado por el usuario"],
    ], widths=[2.0, 0.8, 1.0, 3.0], font_size=8.5)
    h(doc, "3. Descripción general del sistema", 1)
    h(doc, "3.1 Alcance funcional", 2)
    para(doc, "El FRD cubre los módulos de autenticación y perfiles básicos, solicitudes y viajes, asignación y aceptación, evidencia, incidencias, documentos, pagos básicos, roles y auditoría. Las funciones empresariales avanzadas, automatización financiera y analítica profunda quedan fuera del MVP.")
    h(doc, "3.2 Contexto del sistema", 2)
    table(doc, ["Componente", "Responsabilidad", "Intercambio principal"], [
        ["App Usuario", "Crea solicitudes, consulta viajes, estatus, evidencia y soporte.", "Solicitudes, estados, evidencia, notificaciones"],
        ["App Conductor", "Recibe ofertas, acepta, documenta, reporta y consulta ganancias.", "Ofertas, estados, archivos, incidencias, pagos"],
        ["Admin Web", "Valida, asigna, monitorea, revisa, resuelve y cierra.", "Viajes, usuarios, conductores, documentos, pagos"],
        ["Servicios transversales", "Identidad, almacenamiento, geolocalización, notificaciones y bitácora.", "Autenticación, archivos, ubicación, eventos"],
    ], widths=[1.5, 3.0, 2.3], font_size=8.5)
    h(doc, "3.3 Módulos", 2)
    table(doc, ["ID módulo", "Nombre", "Descripción funcional", "Requerimientos asociados"], [
        ["MOD-01", "Identidad y perfiles", "Inicio de sesión, perfil y roles.", "RF-001 a RF-003"],
        ["MOD-02", "Solicitud y cotización", "Registro de vehículo, ruta, fecha y tarifa.", "RF-004 a RF-006"],
        ["MOD-03", "Viaje y asignación", "Revisión, asignación, aceptación y estados.", "RF-007 a RF-010"],
        ["MOD-04", "Evidencia e incidencias", "Captura, revisión, folios y resolución.", "RF-011 a RF-015"],
        ["MOD-05", "Documentos y certificación", "Carga, revisión y vencimiento.", "RF-016 a RF-017"],
        ["MOD-06", "Pagos y auditoría", "Pagos, gastos, notas y bitácora.", "RF-018 a RF-020"],
    ], widths=[1.0, 1.65, 2.65, 1.5], font_size=8.3)

    h(doc, "4. Actores y permisos", 1)
    table(doc, ["Actor", "Tipo", "Descripción", "Permisos principales"], [
        ["Usuario", "Externo", "Persona o empresa que solicita el traslado.", "Crear solicitud, consultar viajes, evidencia y soporte."],
        ["Conductor", "Externo", "Conductor certificado que ejecuta el traslado.", "Consultar ofertas, aceptar, capturar evidencia, reportar y consultar pagos."],
        ["Administrador operativo", "Interno", "Controla viajes y conductores.", "Crear, revisar, asignar, cambiar estados, incidencias y notas."],
        ["Validador documental", "Interno", "Revisa documentos y certificación.", "Aprobar, rechazar y solicitar actualización de documentos."],
        ["Finanzas", "Interno", "Controla pagos y gastos.", "Registrar, revisar y consultar pagos y gastos autorizados."],
        ["Super administrador", "Interno", "Administra configuración y acceso total.", "Todos los permisos y roles."],
    ], widths=[1.35, 0.9, 2.15, 2.4], font_size=8.1)
    h(doc, "4.1 Matriz de permisos por función", 2)
    table(doc, ["Función", "Usuario", "Conductor", "Admin", "Validador", "Finanzas"], [
        ["Crear solicitud", "C", "-", "C", "-", "-"],
        ["Aceptar viaje", "-", "C", "V", "-", "-"],
        ["Asignar conductor", "-", "-", "C", "-", "-"],
        ["Cargar evidencia", "-", "C", "V", "V", "-"],
        ["Revisar documentos", "-", "V", "V", "C", "-"],
        ["Registrar pago", "V", "V", "V", "-", "C"],
        ["Gestionar roles", "-", "-", "C", "-", "V"],
    ], widths=[2.1, 0.8, 1.0, 1.0, 1.0, 1.0], font_size=8.5)
    para(doc, "C = puede ejecutar la acción; V = puede consultar; - = sin permiso en el MVP.")

    h(doc, "5. Requerimientos funcionales detallados", 1)
    para(doc, "Cada requerimiento define entradas, reglas, salidas y errores. Los criterios se pueden convertir directamente en casos positivos y negativos de QA.")
    h(doc, "5.1 Índice de requerimientos funcionales", 2)
    table(doc, ["ID", "Nombre", "Módulo", "Actor", "Prioridad", "Estado"], [
        ["RF-001", "Inicio de sesión", "MOD-01", "Todos", "Must", "Propuesto"],
        ["RF-002", "Perfil básico", "MOD-01", "Usuario / conductor", "Must", "Propuesto"],
        ["RF-003", "Roles internos", "MOD-01", "Admin", "Must", "Propuesto"],
        ["RF-004", "Registrar vehículo", "MOD-02", "Usuario", "Must", "Propuesto"],
        ["RF-005", "Crear solicitud", "MOD-02", "Usuario", "Must", "Propuesto"],
        ["RF-006", "Revisar tarifa y confirmar", "MOD-02", "Usuario", "Must", "Propuesto"],
        ["RF-007", "Revisar operabilidad", "MOD-03", "Admin", "Must", "Propuesto"],
        ["RF-008", "Asignar conductor", "MOD-03", "Admin", "Must", "Propuesto"],
        ["RF-009", "Aceptar o rechazar viaje", "MOD-03", "Conductor", "Must", "Propuesto"],
        ["RF-010", "Gestionar estados del viaje", "MOD-03", "Admin / conductor", "Must", "Propuesto"],
        ["RF-011", "Capturar evidencia inicial", "MOD-04", "Conductor", "Must", "Propuesto"],
        ["RF-012", "Capturar evidencia final", "MOD-04", "Conductor", "Must", "Propuesto"],
        ["RF-013", "Consultar evidencia", "MOD-04", "Usuario / Admin", "Must", "Propuesto"],
        ["RF-014", "Reportar incidencia", "MOD-04", "Conductor / Admin", "Must", "Propuesto"],
        ["RF-015", "Resolver incidencia", "MOD-04", "Admin / soporte", "Must", "Propuesto"],
        ["RF-016", "Cargar y revisar documentos", "MOD-05", "Conductor / validador", "Must", "Propuesto"],
        ["RF-017", "Controlar certificación", "MOD-05", "Validador", "Must", "Propuesto"],
        ["RF-018", "Registrar pago al conductor", "MOD-06", "Finanzas / Admin", "Must", "Propuesto"],
        ["RF-019", "Registrar gasto autorizado", "MOD-06", "Admin / finanzas", "Must", "Propuesto"],
        ["RF-020", "Registrar auditoría", "MOD-06", "Sistema", "Must", "Propuesto"],
    ], widths=[0.7, 2.1, 0.75, 1.2, 0.65, 0.9], font_size=7.5)

    fr_detail(doc, "RF-001", "Inicio de sesión", "Usuario, conductor, usuario interno", "Must", "HU-001 / RNF-003", "Correo o teléfono y credencial válida.", "La cuenta debe estar activa. El sistema debe aplicar el rol y contexto correctos.", "Sesión iniciada y acceso al inicio correspondiente.", "Credenciales inválidas, cuenta suspendida, sesión expirada o servicio no disponible.", "Dado que la cuenta está activa, cuando se ingresan credenciales correctas, entonces se crea sesión y se carga el inicio en el contexto del actor.")
    fr_detail(doc, "RF-002", "Perfil básico", "Usuario o conductor", "Must", "HU-001 / HU-004", "Nombre, fotografía opcional, teléfono, correo, estado y contraseña.", "Correo y teléfono no deben duplicarse en cuentas incompatibles. Cambios sensibles requieren reautenticación.", "Perfil actualizado y bitácora del cambio.", "Formato inválido, dato duplicado, falta de identidad o fallo de guardado.", "El actor puede consultar y actualizar sus datos permitidos; los datos bancarios se muestran parcialmente ocultos.")
    fr_detail(doc, "RF-003", "Roles internos", "Super administrador", "Must", "RN-010 / RNF-004", "Usuario interno, rol y estado.", "Un usuario interno solo puede ejecutar permisos del rol asignado. Cambios de rol son auditables.", "Acceso actualizado y evento de auditoría.", "Rol no permitido, usuario inactivo o intento no autorizado.", "Un usuario con rol operativo no puede editar roles ni consultar datos financieros restringidos.")
    fr_detail(doc, "RF-004", "Registrar vehículo", "Usuario", "Must", "HU-001", "Marca, modelo, año, color, placas, VIN si aplica, transmisión, tipo y estado declarado.", "Marca, modelo, año, tipo y estado son obligatorios para crear solicitud; placas y VIN se validan según tipo de servicio.", "Vehículo guardado y disponible para solicitudes futuras.", "Campos inválidos, año fuera de rango, duplicidad o datos incompletos.", "El usuario puede guardar un vehículo con los campos obligatorios y verlo en su cuenta.")
    fr_detail(doc, "RF-005", "Crear solicitud", "Usuario", "Must", "RN-001 / HU-001", "Vehículo, origen, destino, contacto de entrega, contacto de recepción, fecha, hora, tipo de servicio e instrucciones.", "Origen y destino son distintos; fecha y hora son futuras o se marca lo antes posible; los contactos son válidos.", "Solicitud con ID único, estatus Solicitud recibida y marca de tiempo.", "Datos incompletos, fecha no permitida, servicio no disponible o error de ubicación.", "Dado que los datos son válidos, cuando se confirma, entonces la solicitud aparece en Mis viajes y en la cola de Admin.")
    fr_detail(doc, "RF-006", "Revisar tarifa y confirmar", "Usuario", "Must", "HU-002 / RN-001", "Resumen de vehículo, ruta, fecha, tipo de traslado, tarifa estimada o confirmada y condiciones.", "La tarifa debe mostrar qué incluye y cualquier condición especial. Confirmar crea el registro operativo.", "Resumen visible, confirmación y notificación de solicitud.", "Tarifa no disponible, cambio de condiciones o error de cálculo.", "El usuario no puede confirmar sin ver resumen, tarifa y condiciones principales.")
    fr_detail(doc, "RF-007", "Revisar operabilidad", "Administrador operativo", "Must", "HU-003 / RN-012", "Solicitud recibida, datos de ruta, vehículo, horario, condiciones y notas.", "Admin debe verificar que ruta, fecha, tipo de vehículo y requisitos sean operables antes de asignar.", "Viaje aprobado para asignación o motivo de rechazo / solicitud de información.", "Datos insuficientes, ruta no cubierta, horario no viable o servicio suspendido.", "El sistema conserva decisión, actor, fecha y motivo antes de permitir asignación.")
    fr_detail(doc, "RF-008", "Asignar conductor", "Administrador operativo", "Must", "HU-003 / RN-002", "Viaje operable, conductor, motivo de asignación si es manual y condiciones del servicio.", "El conductor debe estar activo, certificado para el servicio y no tener conflicto de disponibilidad. La acción queda auditada.", "Viaje en estado Conductor asignado y oferta disponible para conductor.", "Conductor no elegible, viaje ya asignado, conflicto de horario o intento no autorizado.", "Al asignar, el usuario y el conductor reciben notificación y el historial conserva quién decidió.")
    fr_detail(doc, "RF-009", "Aceptar o rechazar viaje", "Conductor", "Must", "HU-004 / RN-005", "Oferta con ruta, horario, tipo de vehículo, pago, gastos, bonos y condiciones.", "El conductor ve el pago antes de aceptar. Aceptar requiere disponibilidad; rechazar registra motivo opcional.", "Aceptación cambia estado y confirma agenda; rechazo devuelve viaje a asignación.", "Oferta expirada, viaje ya tomado, conductor no disponible o fallo de notificación.", "El conductor nunca acepta una oferta sin poder consultar pago y condiciones.")
    fr_detail(doc, "RF-010", "Gestionar estados del viaje", "Admin y conductor según transición", "Must", "HU-007 / RN-001", "Estado actual, evento, actor y datos de soporte.", "Solo se permiten transiciones definidas y se registra actor, fecha y motivo cuando corresponde.", "Nuevo estado, notificación y evento de bitácora.", "Transición no permitida, actor sin permiso, datos faltantes o viaje bloqueado por incidencia.", "Un viaje no puede pasar a Finalizado si falta evidencia final o existe una incidencia abierta que requiera revisión.")
    fr_detail(doc, "RF-011", "Capturar evidencia inicial", "Conductor", "Must", "HU-005 / RN-003", "Fotos exteriores e interiores, placas, tablero, odómetro, combustible, daños visibles, observaciones y firma si aplica.", "El conjunto obligatorio depende del tipo de servicio. Se valida formato, tamaño, asociación al viaje y fecha.", "Evidencia asociada al viaje y estado Vehículo documentado.", "Archivo inválido, falta de campo obligatorio, carga incompleta, sin conectividad o permiso insuficiente.", "El conductor puede guardar borrador seguro y enviar solo cuando el conjunto obligatorio está completo.")
    fr_detail(doc, "RF-012", "Capturar evidencia final", "Conductor", "Must", "HU-007 / RN-003", "Fotos finales, odómetro, combustible, estado, observaciones, receptor y firma o aceptación.", "Debe existir evidencia inicial; la evidencia final se registra después de llegada a destino y antes de solicitar cierre.", "Evidencia final disponible y viaje listo para revisión administrativa.", "Falta evidencia inicial, archivos incompletos, diferencia no explicada o receptor no validado.", "El conductor no puede confirmar entrega sin completar la evidencia final requerida.")
    fr_detail(doc, "RF-013", "Consultar evidencia", "Usuario y Admin", "Must", "HU-008 / HU-009", "ID de viaje y contexto de acceso.", "El usuario solo ve evidencia de sus viajes; Admin ve evidencia según rol. Datos sensibles se restringen.", "Galería o lista ordenada por etapa, fecha, tipo, observaciones y estatus de revisión.", "Viaje inexistente, sin permiso, archivo no disponible o error de almacenamiento.", "El usuario identifica con claridad evidencia inicial, durante el traslado y final.")
    fr_detail(doc, "RF-014", "Reportar incidencia", "Conductor o Admin", "Must", "HU-006 / RN-006", "Tipo de incidencia, descripción, viaje, ubicación si aplica, evidencia y prioridad.", "Botones de seguridad generan folio, fecha, ubicación disponible y notificación a soporte. La incidencia no se elimina.", "Folio, estado Nueva, responsable pendiente y alerta operativa.", "Datos faltantes, viaje no activo, ubicación no disponible o fallo de notificación.", "Cada reporte produce un folio consultable y queda asociado al viaje.")
    fr_detail(doc, "RF-015", "Resolver incidencia", "Admin o soporte", "Must", "HU-010 / RN-006", "Folio, responsable, notas, solicitud de información, resolución y estado.", "Estados permitidos: Nueva, En revisión, Requiere información, En seguimiento, Resuelta, Cerrada, Escalada.", "Incidencia actualizada, resolución registrada y notificación cuando aplique.", "Estado inválido, responsable inexistente, falta de resolución o permiso insuficiente.", "Una incidencia cerrada conserva resumen, evidencia asociada, actor y fecha de cierre.")
    fr_detail(doc, "RF-016", "Cargar y revisar documentos", "Conductor y validador", "Must", "HU-012 / RN-007", "Tipo de documento, archivo o foto, fecha de vencimiento, comentario y actor.", "Tipos mínimos: identificación, licencia, comprobante de domicilio, constancia fiscal y otros requeridos. Los archivos tienen estatus.", "Documento en revisión, aprobado, rechazado, vencido o requiere actualización.", "Archivo inválido, documento vencido, rechazo sin motivo o almacenamiento no disponible.", "El conductor ve el motivo cuando se rechaza y puede reemplazar el documento.")
    fr_detail(doc, "RF-017", "Controlar certificación", "Validador documental", "Must", "RN-007 / RN-002", "Documentos, capacitación, evaluación y nivel de certificación.", "Solo conductores con documentación y evaluación aprobadas pueden recibir servicios compatibles con su nivel.", "Perfil certificado o restringido con historial de decisión.", "Requisito faltante, evaluación no aprobada, documento vencido o inconsistencia.", "La asignación bloquea conductores no certificados para el tipo de servicio requerido.")
    fr_detail(doc, "RF-018", "Registrar pago al conductor", "Finanzas o Admin autorizado", "Must", "HU-011 / RN-008", "Viaje, monto, gastos autorizados, ajustes, estatus y fecha estimada.", "El pago debe conservar desglose y causa si queda detenido, revocado o ajustado.", "Registro financiero vinculado al viaje y conductor.", "Monto inválido, viaje no cerrado, pago duplicado o permisos insuficientes.", "No existe pago sin viaje, actor, monto, estatus y desglose.")
    fr_detail(doc, "RF-019", "Registrar gasto autorizado", "Admin / finanzas", "Must", "HU-011 / RN-008", "Tipo, viaje, comprobante, monto, estatus y aprobador.", "Solo son reembolsables peajes, estacionamientos, combustible pactado, regreso autorizado y extraordinarios aprobados.", "Gasto pendiente, aprobado o rechazado asociado al viaje.", "Comprobante faltante, tipo no permitido, monto inválido o aprobación ausente.", "Un gasto aprobado incrementa el desglose de pago y conserva quién lo autorizó.")
    fr_detail(doc, "RF-020", "Registrar auditoría", "Sistema", "Must", "RNF-007 / RN-010", "Entidad, acción, actor, fecha, estado anterior, estado nuevo y motivo.", "Las asignaciones, cambios de estado, documentos, evidencia, incidencias y pagos son auditables y no se borran físicamente.", "Evento consultable por entidad y fecha según rol.", "Fallo de auditoría, actor no identificable o intento de alteración.", "Cada acción crítica genera un registro de auditoría antes de confirmar la respuesta al usuario.")

    h(doc, "6. Reglas de negocio", 1)
    table(doc, ["ID", "Regla", "Descripción", "Valor o fórmula", "Dueño", "Requerimientos"], [
        ["RN-001", "Viaje auditable", "Toda asignación debe conservar actor, fecha y motivo cuando sea manual.", "Obligatorio", "Operación", "RF-008, RF-020"],
        ["RN-002", "Conductor elegible", "Solo activo, certificado y disponible para el servicio.", "Intersección de condiciones", "Calidad", "RF-008, RF-017"],
        ["RN-003", "Evidencia mínima", "Evidencia inicial y final antes del cierre.", "Checklist por tipo", "Calidad", "RF-011, RF-012, RF-010"],
        ["RN-004", "Pago transparente", "Pago y condiciones visibles antes de aceptar.", "Desglose obligatorio", "Finanzas", "RF-009, RF-018"],
        ["RN-005", "Incidente documentado", "Todo incidente tiene folio y estado.", "Estados controlados", "Soporte", "RF-014, RF-015"],
        ["RN-006", "Cierre condicionado", "No se finaliza con evidencia incompleta o incidencia abierta crítica.", "Bloqueo de transición", "Operación", "RF-010"],
    ], widths=[0.7, 1.35, 2.55, 1.1, 0.9, 1.0], font_size=7.7)

    h(doc, "7. Diccionario de datos", 1)
    table(doc, ["Entidad", "Campo", "Tipo", "Long.", "Oblig.", "Validación / valores", "Dato personal"], [
        ["Viaje", "id", "UUID", "36", "Sí", "Único e inmutable", "No"],
        ["Viaje", "estado", "Catálogo", "30", "Sí", "Recibida, revisión, asignado, en curso, entrega, finalizado, cancelado, incidencia", "No"],
        ["Vehículo", "marca_modelo", "Texto", "100", "Sí", "No vacío", "No"],
        ["Vehículo", "placas_vin", "Texto", "50", "Según servicio", "Formato configurable", "Sí"],
        ["Usuario", "nombre_contacto", "Texto", "120", "Sí", "No vacío", "Sí"],
        ["Conductor", "certificacion", "Catálogo", "30", "Sí", "Pendiente, activo, suspendido, vencido", "No"],
        ["Evidencia", "tipo", "Catálogo", "30", "Sí", "Inicial, durante, final, firma, documento", "No"],
        ["Evidencia", "archivo", "Referencia", "Variable", "Sí", "Almacenamiento autorizado", "Sí"],
        ["Incidencia", "tipo", "Catálogo", "40", "Sí", "Daño, retraso, evidencia, contacto, pago, otro", "No"],
        ["Pago", "monto", "Decimal", "14,2", "Sí", ">= 0", "No"],
        ["Documento", "vence_en", "Fecha", "10", "Según tipo", "Fecha válida", "No"],
    ], widths=[1.0, 1.35, 0.8, 0.55, 0.7, 2.1, 0.8], font_size=7.4)
    h(doc, "7.1 Catálogos", 2)
    table(doc, ["Catálogo", "Valores", "Origen", "Actualización"], [
        ["Estado de viaje", "Recibida, revisión, asignado, en camino, documentado, en curso, destino, entrega, finalizado, cancelado, incidencia", "Configuración de producto", "Controlada"],
        ["Estado de evidencia", "Pendiente, completa, incompleta, en revisión, aprobada, rechazada, incidencia", "Configuración de calidad", "Controlada"],
        ["Estado de pago", "Pendiente, revisión, aprobado, rechazado, pagado, revocado, ajustado", "Finanzas", "Controlada"],
        ["Estado de documento", "Pendiente, revisión, aprobado, rechazado, vencido, requiere actualización", "Certificación", "Controlada"],
    ], widths=[1.5, 3.7, 1.0, 1.0], font_size=7.8)

    h(doc, "8. Interfaces e integraciones", 1)
    table(doc, ["ID", "Sistema", "Dirección", "Protocolo", "Datos intercambiados", "Frecuencia", "Responsable"], [
        ["INT-001", "Mapas / geolocalización", "Bidireccional", "API segura", "Direcciones, coordenadas y ruta", "Por solicitud / viaje", "Tecnología"],
        ["INT-002", "Almacenamiento de evidencia", "App a servicio", "HTTPS", "Fotos, video si aplica, firmas y metadatos", "Por captura", "Tecnología / calidad"],
        ["INT-003", "Notificaciones", "Sistema a actores", "Push / correo / SMS según fase", "Eventos de solicitud, asignación, estatus e incidencia", "Por evento", "Producto"],
        ["INT-004", "Pagos / facturación", "Pendiente de definición", "API segura", "Tarifas, pagos y datos fiscales", "Por transacción", "Finanzas"],
        ["INT-005", "CRM / ERP", "Fase posterior", "Por definir", "Clientes, empresas y reportes", "Programada", "Comercial / tecnología"],
    ], widths=[0.7, 1.45, 0.9, 1.0, 1.75, 0.8, 1.0], font_size=7.5)

    h(doc, "9. Interfaces de usuario", 1)
    table(doc, ["ID pantalla", "Nombre", "Propósito", "Campos / acciones", "Requerimientos"], [
        ["UI-001", "Inicio Usuario", "Iniciar solicitud y ver viaje activo.", "Solicitar traslado, viaje activo, notificaciones, soporte.", "RF-001, RF-005, RF-013"],
        ["UI-002", "Solicitud", "Capturar vehículo, ruta, horario y servicio.", "Vehículo, origen, destino, contactos, fecha, hora, instrucciones, confirmar.", "RF-004 a RF-006"],
        ["UI-003", "Detalle de viaje", "Consultar línea de tiempo y evidencia.", "Estatus, conductor, ruta, evidencia, incidencia, soporte.", "RF-010, RF-013, RF-014"],
        ["UI-004", "Panel Conductor", "Ver disponibilidad, viajes y ganancias.", "Disponibilidad, ofertas, aceptados, ganancias, documentos.", "RF-009, RF-016, RF-018"],
        ["UI-005", "Detalle Conductor", "Ejecutar viaje y documentar.", "Iniciar, evidencia inicial/final, incidencia, entrega.", "RF-010 a RF-015"],
        ["UI-006", "Dashboard Admin", "Ver situación operativa.", "Activos, pendientes, alertas, documentos, pagos, incidencias.", "RF-007, RF-008, RF-015, RF-018"],
        ["UI-007", "Detalle Admin", "Revisar y cerrar viaje.", "Asignar, estados, evidencia, notas, incidencia, pago.", "RF-007 a RF-020"],
    ], widths=[0.75, 1.3, 1.85, 2.45, 1.0], font_size=7.4)
    h(doc, "9.1 Estados de interfaz", 2)
    table(doc, ["Estado", "Comportamiento esperado"], [
        ["Vacío", "Mostrar explicación breve, siguiente acción y botón primario; por ejemplo, sin viajes: Solicitar traslado."],
        ["Carga", "Mostrar indicador de carga sin permitir duplicar envíos críticos."],
        ["Error", "Explicar qué ocurrió, si se guardó o no, y permitir reintento o contacto con soporte."],
        ["Sin conexión", "Conservar borrador local seguro cuando aplique y pedir reintento al recuperar conectividad."],
        ["Éxito", "Confirmar la acción y mostrar el siguiente paso; por ejemplo, ID de solicitud o evidencia enviada."],
    ], widths=[1.2, 5.6], font_size=8.5)

    h(doc, "10. Estados y flujos", 1)
    table(doc, ["Estado origen", "Evento", "Condición", "Estado destino", "Actor"], [
        ["Solicitud recibida", "Admin revisa", "Datos suficientes", "En revisión", "Admin"],
        ["En revisión", "Admin aprueba", "Operable", "Pendiente de asignación", "Admin"],
        ["Pendiente de asignación", "Se asigna conductor", "Elegible y disponible", "Conductor asignado", "Admin"],
        ["Conductor asignado", "Conductor acepta", "Oferta vigente", "Aceptado", "Conductor"],
        ["Aceptado", "Conductor inicia", "Llega a origen", "Recolección", "Conductor"],
        ["Recolección", "Evidencia inicial completa", "Checklist válido", "Documentado", "Conductor"],
        ["Documentado", "Traslado inicia", "Sin bloqueo", "En curso", "Conductor"],
        ["En curso", "Llega a destino", "Contacto disponible", "Entrega", "Conductor"],
        ["Entrega", "Evidencia final y aceptación", "Checklist válido", "Listo para cierre", "Conductor"],
        ["Listo para cierre", "Admin aprueba", "Sin incidencia crítica", "Finalizado", "Admin"],
        ["Cualquier estado activo", "Incidencia", "Evento operativo", "En revisión por incidencia", "Conductor / Admin"],
    ], widths=[1.3, 1.55, 1.8, 1.45, 0.8], font_size=7.7)

    h(doc, "11. Requerimientos no funcionales técnicos", 1)
    table(doc, ["ID", "Categoría", "Requerimiento", "Criterio verificable"], [
        ["RNFT-001", "Seguridad", "Aplicar autorización por rol y propiedad del viaje.", "Pruebas negativas por actor sin acceso."],
        ["RNFT-002", "Privacidad", "Restringir evidencia, PII y datos bancarios al contexto autorizado.", "Matriz de acceso aprobada y pruebas."],
        ["RNFT-003", "Integridad", "No permitir cierre sin evidencia y condiciones de transición.", "Casos negativos de cierre."],
        ["RNFT-004", "Trazabilidad", "Registrar actor, fecha, acción, antes y después en acciones críticas.", "Consulta de bitácora por entidad."],
        ["RNFT-005", "Operación", "Permitir reintento y no duplicar solicitudes o pagos por doble envío.", "Prueba de idempotencia funcional."],
        ["RNFT-006", "Usabilidad", "Errores y estados deben usar lenguaje claro y acción siguiente.", "Revisión UX y accesibilidad."],
    ], widths=[0.8, 1.1, 3.1, 1.8], font_size=8.0)

    h(doc, "12. Casos de prueba sugeridos", 1)
    table(doc, ["ID", "Requerimiento", "Tipo", "Precondición", "Pasos", "Resultado esperado"], [
        ["CP-001", "RF-005", "Positivo", "Usuario autenticado", "Completar vehículo, ruta, fecha y confirmar.", "Se crea solicitud con ID y estado recibido."],
        ["CP-002", "RF-005", "Negativo", "Usuario autenticado", "Omitir destino y confirmar.", "Se muestra validación y no se crea solicitud."],
        ["CP-003", "RF-008", "Positivo", "Viaje operable y conductor elegible", "Asignar conductor.", "Se registra asignación y se notifica."],
        ["CP-004", "RF-008", "Negativo", "Conductor no certificado", "Intentar asignar.", "Acción bloqueada y motivo visible."],
        ["CP-005", "RF-009", "Positivo", "Oferta vigente", "Conductor consulta pago y acepta.", "Viaje pasa a aceptado."],
        ["CP-006", "RF-011", "Negativo", "Viaje en recolección", "Enviar evidencia sin odómetro.", "Envío rechazado por campo obligatorio."],
        ["CP-007", "RF-014", "Positivo", "Viaje activo", "Reportar cliente agresivo.", "Folio de alta prioridad y alerta a soporte."],
        ["CP-008", "RF-010", "Negativo", "Incidencia crítica abierta", "Intentar finalizar.", "Cierre bloqueado hasta resolver o escalar."],
        ["CP-009", "RF-018", "Positivo", "Viaje listo para cierre", "Registrar pago con desglose.", "Pago asociado y auditado."],
        ["CP-010", "RF-020", "Negativo", "Usuario sin permiso", "Intentar cambiar rol o pago.", "Acceso denegado y evento de seguridad."],
    ], widths=[0.7, 0.8, 0.8, 1.35, 1.8, 1.65], font_size=7.2)

    h(doc, "13. Matriz de trazabilidad", 1)
    table(doc, ["Objetivo BRD", "Req. negocio", "Historia PRD", "Req. funcional", "Caso de prueba", "Estado"], [
        ["OBJ-001", "RN-001", "HU-001", "RF-005", "CP-001 / CP-002", "Trazado"],
        ["OBJ-005", "RN-002", "HU-003 / HU-004", "RF-008 / RF-009", "CP-003 / CP-004 / CP-005", "Trazado"],
        ["OBJ-002", "RN-003", "HU-005 / HU-007 / HU-009", "RF-011 / RF-012 / RF-013", "CP-006 / CP-008", "Trazado"],
        ["OBJ-006", "RN-006 / RN-008", "HU-006 / HU-010 / HU-011", "RF-014 / RF-015 / RF-018 / RF-019", "CP-007 / CP-009", "Trazado"],
        ["OBJ-003", "RN-007", "HU-012", "RF-016 / RF-017", "Casos por definir", "Parcial"],
        ["OBJ-001", "RN-010", "RN-011", "RF-001 / RF-003 / RF-020", "CP-010", "Trazado"],
    ], widths=[0.85, 0.9, 1.3, 1.6, 1.35, 0.8], font_size=7.1)

    h(doc, "14. Aprobaciones", 1)
    approvals(doc)
    path = OUT / "FRD_Ruum_Ruum.docx"
    doc.save(path)
    return path


if __name__ == "__main__":
    paths = [build_brd(), build_prd(), build_frd()]
    for p in paths:
        print(p)
