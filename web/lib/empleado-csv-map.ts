import { canonCsvHeader, normalizarCeldaCsvNumerica } from "@/lib/csv";

/** Nombre interno de campo tras leer una fila del CSV (cabeceras flexibles). */
export type CsvFieldKey =
  | "noEmpleado"
  | "nombreCompleto"
  | "estatusEmpleado"
  | "fechaIngreso"
  | "fechaBaja"
  | "envio"
  | "reyna"
  | "reingreso"
  | "puesto"
  | "puestoFinal"
  | "servicio"
  | "servicioFinal"
  | "noServicio"
  | "planta"
  | "posicion"
  | "localForaneo"
  | "numeroFolio"
  | "apellidoPaterno"
  | "apellidoMaterno"
  | "nombres"
  | "fechaNacimiento"
  | "edad"
  | "estadoCivil"
  | "curp"
  | "rfc"
  | "imss"
  | "codigoPostal"
  | "estadoNatal"
  | "domicilio"
  | "telefono"
  /** Segunda columna: teléfono de casa (se fusiona con `telefono` al importar). */
  | "telefonoCasa"
  /** Una sola columna tipo "personal / casa" del Excel. */
  | "telefonoPersonalCasa"
  | "escolaridad"
  | "moper1"
  | "moper2"
  | "moper3"
  | "moper4"
  | "moper5"
  | "moper6"
  | "moper7"
  | "estaturaPeso"
  | "tipoSangre"
  | "alergicoA"
  | "enfermedadTratamiento"
  | "diabetico"
  | "hipertenso"
  | "emergenciaNombre"
  | "emergenciaTelefono"
  | "banco"
  | "numeroCuenta"
  | "clabeInterbancaria"
  | "noTarjeta"
  | "sueldoMensual"
  | "fuenteReclutamiento"
  | "gestorProceso"
  | "estudioSocioeconomico"
  | "documentacionOriginal"
  | "nombreFamiliar"
  | "parentescoCsv"
  | "fechaNacimientoFamiliar"
  | "beneficiarioBancario"
  /** Ultimo servicio por MOPER (export COLABORADORES / sync). */
  | "ultimoServicio"
  /** Fecha ISO o texto de alta en export. */
  | "registradoAt"
  | "creditoInfonavit"
  | "noIfe"
  | "licenciaConducir"
  | "cartaNoAntecedentes"
  | "idiomas";

const HEADER_TO_FIELD: Record<string, CsvFieldKey> = {
  no_de_empleado: "noEmpleado",
  numero_de_empleado: "noEmpleado",
  no_empleado: "noEmpleado",
  numero_empleado: "noEmpleado",
  clave: "noEmpleado",
  nombre_completo: "nombreCompleto",
  nombre: "nombreCompleto",
  estatus_empleado: "estatusEmpleado",
  estatus: "estatusEmpleado",
  fecha_de_ingreso: "fechaIngreso",
  fecha_ingreso: "fechaIngreso",
  fecha_de_baja: "fechaBaja",
  fecha_baja: "fechaBaja",
  envio: "envio",
  reyna: "reyna",
  reingreso: "reingreso",
  puesto: "puesto",
  puesto_final: "puestoFinal",
  servicio: "servicio",
  servicio_asignado: "servicio",
  servicio_cliente_lugar: "servicio",
  servicio_final: "servicioFinal",
  no_servicio: "noServicio",
  numero_servicio: "noServicio",
  numero_de_servicio: "noServicio",
  n_servicio: "noServicio",
  n_de_servicio: "noServicio",
  no_de_servicio: "noServicio",
  num_servicio: "noServicio",
  nro_servicio: "noServicio",
  nro_de_servicio: "noServicio",
  no_srv: "noServicio",
  no_serv: "noServicio",
  servicio_no: "noServicio",
  planta: "planta",
  planta_sitio: "planta",
  planta_o_sitio: "planta",
  sitio_planta: "planta",
  posicion: "posicion",
  local_foraneo: "localForaneo",
  local_o_foraneo: "localForaneo",
  numero_de_folio: "numeroFolio",
  numero_folio: "numeroFolio",
  folio: "numeroFolio",
  numero_de_expediente: "numeroFolio",
  numero_expediente: "numeroFolio",
  no_expediente: "numeroFolio",
  apellido_paterno: "apellidoPaterno",
  apellido_materno: "apellidoMaterno",
  nombres_identidad: "nombres",
  nombre_s: "nombres",
  nombres: "nombres",
  fecha_de_nacimiento: "fechaNacimiento",
  fecha_nacimiento: "fechaNacimiento",
  edad: "edad",
  estado_civil: "estadoCivil",
  edo_civil: "estadoCivil",
  estado_civil_empleado: "estadoCivil",
  estado_civil_del_empleado: "estadoCivil",
  curp: "curp",
  rfc: "rfc",
  imss: "imss",
  nss: "imss",
  num_seguro_social: "imss",
  numero_seguro_social: "imss",
  no_imss: "imss",
  codigo_postal: "codigoPostal",
  cp: "codigoPostal",
  estado_natal: "estadoNatal",
  domicilio: "domicilio",
  estado_municipio_colonia_calle_y_numero: "domicilio",
  estado_municipio_colonia_calle_numero: "domicilio",
  direccion_completa: "domicilio",
  domicilio_completo: "domicilio",
  domicilio_actual: "domicilio",
  lugar_de_residencia: "domicilio",
  ubicacion: "domicilio",
  direccion: "domicilio",
  telefono: "telefono",
  telefono_personal: "telefono",
  tel_personal: "telefono",
  telefono_movil: "telefono",
  celular: "telefono",
  telefono_celular: "telefono",
  telefono_de_casa: "telefonoCasa",
  telefono_casa: "telefonoCasa",
  tel_casa: "telefonoCasa",
  telefono_fijo: "telefonoCasa",
  telefono_personal_casa: "telefonoPersonalCasa",
  telefonos: "telefonoPersonalCasa",
  escolaridad: "escolaridad",
  grado_de_estudios: "escolaridad",
  grado_estudios: "escolaridad",
  nivel_de_estudios: "escolaridad",
  nivel_estudios: "escolaridad",
  nivel_escolar: "escolaridad",
  grado_escolar: "escolaridad",
  escolaridad_nivel: "escolaridad",
  maximo_grado_de_estudios: "escolaridad",
  maxima_escolaridad: "escolaridad",
  estudios: "escolaridad",
  estudio: "escolaridad",
  ultimo_grado_de_estudios: "escolaridad",
  ultimo_grado: "escolaridad",
  grado_maximo_de_estudios: "escolaridad",
  grado_maximo: "escolaridad",
  escolaridad_actual: "escolaridad",
  escolaridad_del_empleado: "escolaridad",
  escolaridad_empleado: "escolaridad",
  escolaridad_obtenida: "escolaridad",
  escolaridad_completa: "escolaridad",
  datos_escolaridad: "escolaridad",
  dato_escolaridad: "escolaridad",
  tipo_escolaridad: "escolaridad",
  nivel_de_escolaridad: "escolaridad",
  nivel_escolaridad: "escolaridad",
  grado_de_escolaridad: "escolaridad",
  antecedente_escolar: "escolaridad",
  antecedentes_escolares: "escolaridad",
  educacion: "escolaridad",
  educacion_nivel: "escolaridad",
  nivel_educativo: "escolaridad",
  nivel_academico: "escolaridad",
  grado_academico: "escolaridad",
  formacion_academica: "escolaridad",
  preparacion_academica: "escolaridad",
  carrera: "escolaridad",
  carrera_o_especialidad: "escolaridad",
  carrera_especialidad: "escolaridad",
  titulo_obtenido: "escolaridad",
  certificado_estudios: "escolaridad",
  comprobante_estudios: "escolaridad",
  leyenda_escolaridad: "escolaridad",
  moper_1: "moper1",
  moper1: "moper1",
  moper_2: "moper2",
  moper2: "moper2",
  moper_3: "moper3",
  moper3: "moper3",
  moper_4: "moper4",
  moper4: "moper4",
  moper_5: "moper5",
  moper5: "moper5",
  moper_6: "moper6",
  moper6: "moper6",
  moper_7: "moper7",
  moper7: "moper7",
  estatura_peso: "estaturaPeso",
  estatura_y_peso: "estaturaPeso",
  altura_peso: "estaturaPeso",
  altura_y_peso: "estaturaPeso",
  peso_y_estatura: "estaturaPeso",
  imc_estatura_peso: "estaturaPeso",
  tipo_sangre: "tipoSangre",
  tipo_de_sangre: "tipoSangre",
  tipo_sanguineo: "tipoSangre",
  tipo_sanguinea: "tipoSangre",
  tipificacion_sanguinea: "tipoSangre",
  tipificacion_sanguinea_rh: "tipoSangre",
  grupo_sanguineo: "tipoSangre",
  grupo_sanguineo_y_rh: "tipoSangre",
  grupo_y_factor_rh: "tipoSangre",
  rh_tipo_sangre: "tipoSangre",
  grupo_sangre: "tipoSangre",
  factor_rh: "tipoSangre",
  rh: "tipoSangre",
  sangre: "tipoSangre",
  alergico_a: "alergicoA",
  alergico_a_medicamento_comida: "alergicoA",
  alergico_a_medicamento_o_comida: "alergicoA",
  alergias: "alergicoA",
  alergia: "alergicoA",
  alergico: "alergicoA",
  medicamento_alergia: "alergicoA",
  enfermedad_tratamiento: "enfermedadTratamiento",
  enfermedad_actual: "enfermedadTratamiento",
  enfermedad_actual_tratamiento_medico: "enfermedadTratamiento",
  enfermedad_actual_tratamiento: "enfermedadTratamiento",
  tratamiento_medico: "enfermedadTratamiento",
  tratamiento_medico_actual: "enfermedadTratamiento",
  padecimientos: "enfermedadTratamiento",
  padecimiento_actual: "enfermedadTratamiento",
  diabetico: "diabetico",
  diabetico_si_no: "diabetico",
  es_diabetico: "diabetico",
  padece_diabetes: "diabetico",
  diabetes: "diabetico",
  paciente_diabetico: "diabetico",
  antecedentes_diabeticos: "diabetico",
  hipertenso: "hipertenso",
  hipertenso_si_no: "hipertenso",
  es_hipertenso: "hipertenso",
  hipertension: "hipertenso",
  emergencia_nombre: "emergenciaNombre",
  en_caso_de_emergencia_llamar_a: "emergenciaNombre",
  emergencia_llamar_a: "emergenciaNombre",
  contacto_de_emergencia: "emergenciaNombre",
  contacto_emergencia: "emergenciaNombre",
  avisar_en_emergencia: "emergenciaNombre",
  nombre_contacto_emergencia: "emergenciaNombre",
  emergencia_telefono: "emergenciaTelefono",
  telefono_de_emergencia: "emergenciaTelefono",
  tel_de_emergencia: "emergenciaTelefono",
  telefono_emergencia: "emergenciaTelefono",
  celular_emergencia: "emergenciaTelefono",
  movil_emergencia: "emergenciaTelefono",
  tel_emergencia: "emergenciaTelefono",
  tele_emergencia: "emergenciaTelefono",
  numero_emergencia: "emergenciaTelefono",
  numero_telefonico_emergencia: "emergenciaTelefono",
  tel_para_emergencias: "emergenciaTelefono",
  telefono_para_emergencia: "emergenciaTelefono",
  telefono_caso_emergencia: "emergenciaTelefono",
  celular_contacto_emergencia: "emergenciaTelefono",
  banco: "banco",
  banco_de_nomina: "banco",
  banco_deposito: "banco",
  institucion_bancaria: "banco",
  entidad_bancaria: "banco",
  nombre_del_banco: "banco",
  banco_pago: "banco",
  numero_cuenta: "numeroCuenta",
  numero_de_cuenta: "numeroCuenta",
  no_de_cuenta: "numeroCuenta",
  no_cuenta: "numeroCuenta",
  no_cuenta_bancaria: "numeroCuenta",
  cuenta_bancaria: "numeroCuenta",
  cuenta_de_cheques: "numeroCuenta",
  cuenta_nomina: "numeroCuenta",
  ncc: "numeroCuenta",
  clabe_interbancaria: "clabeInterbancaria",
  clabe_interbancaria_18: "clabeInterbancaria",
  cuenta_clabe: "clabeInterbancaria",
  clabe: "clabeInterbancaria",
  no_tarjeta: "noTarjeta",
  no_de_tarjeta: "noTarjeta",
  numero_tarjeta: "noTarjeta",
  numero_de_tarjeta: "noTarjeta",
  tarjeta: "noTarjeta",
  tarjeta_nomina: "noTarjeta",
  tarjeta_de_nomina: "noTarjeta",
  no_tarjeta_nomina: "noTarjeta",
  sueldo_mensual: "sueldoMensual",
  sueldo: "sueldoMensual",
  salario_mensual: "sueldoMensual",
  salario: "sueldoMensual",
  pago_mensual: "sueldoMensual",
  ingreso_mensual: "sueldoMensual",
  nomina_mensual: "sueldoMensual",
  percepcion_mensual: "sueldoMensual",
  fuente_reclutamiento: "fuenteReclutamiento",
  fuente_de_reclutamiento: "fuenteReclutamiento",
  fuente_del_reclutamiento: "fuenteReclutamiento",
  medio_reclutamiento: "fuenteReclutamiento",
  origen_reclutamiento: "fuenteReclutamiento",
  canal_reclutamiento: "fuenteReclutamiento",
  gestor_del_proceso: "gestorProceso",
  gestor_proceso: "gestorProceso",
  gestor_de_reclutamiento: "gestorProceso",
  reclutador: "gestorProceso",
  responsable_reclutamiento: "gestorProceso",
  responsable_del_proceso: "gestorProceso",
  ejecutivo_reclutamiento: "gestorProceso",
  estudio_socioeconomico: "estudioSocioeconomico",
  estudio_socioeconomico_ese: "estudioSocioeconomico",
  estudio_socio_economico: "estudioSocioeconomico",
  /** Encabezados truncados al exportar desde Excel (ancho de columna) */
  estudio_socioeconom: "estudioSocioeconomico",
  estudio_socioecon: "estudioSocioeconomico",
  socioeconomico: "estudioSocioeconomico",
  resultado_estudio_socioeconomico: "estudioSocioeconomico",
  documentacion_original: "documentacionOriginal",
  documentacion_original_entregada: "documentacionOriginal",
  documentacion_orig: "documentacionOriginal",
  documentacion_ori: "documentacionOriginal",
  /** Truncado "DOCUMENTACIÓN OR"; codificación que pierde la "o" en documentación */
  documentacion_or: "documentacionOriginal",
  documentacin_original: "documentacionOriginal",
  doc_original: "documentacionOriginal",
  doc_orig: "documentacionOriginal",
  documentos_originales: "documentacionOriginal",
  docs_originales: "documentacionOriginal",
  entrega_documentacion: "documentacionOriginal",
  nombre_del_familiar: "nombreFamiliar",
  nombre_familiar: "nombreFamiliar",
  parentesco: "parentescoCsv",
  fecha_nacimiento_familiar: "fechaNacimientoFamiliar",
  beneficiario_bancario: "beneficiarioBancario",
  ultimo_servicio: "ultimoServicio",
  ultimo_servicio_moper: "ultimoServicio",
  registrado_en: "registradoAt",
  fecha_registro: "registradoAt",
  credito_infonavit: "creditoInfonavit",
  no_credito_infonavit: "creditoInfonavit",
  num_credito_infonavit: "creditoInfonavit",
  numero_credito_infonavit: "creditoInfonavit",
  clave_de_elector: "noIfe",
  clave_elector: "noIfe",
  clave_electoral: "noIfe",
  /** Cabecera ficha / Excel: "NO. INE / IFE" → canon `no_ine_ife` */
  no_ine_ife: "noIfe",
  numero_ine_ife: "noIfe",
  no_de_ine_ife: "noIfe",
  noine_ife: "noIfe",
  no_ife: "noIfe",
  no_ine: "noIfe",
  numero_ife: "noIfe",
  numero_ine: "noIfe",
  credencial_ife: "noIfe",
  credencial_ine: "noIfe",
  credencial_elector: "noIfe",
  licencia_de_conducir: "licenciaConducir",
  licencia_conducir: "licenciaConducir",
  carta_no_penales: "cartaNoAntecedentes",
  no_carta_penales: "cartaNoAntecedentes",
  carta_no_antecedentes: "cartaNoAntecedentes",
  carta_antecedentes_no_penales: "cartaNoAntecedentes",
  idiomas_externos: "idiomas",
  idioma_externo: "idiomas",
};

/** Documentos / ficha (INFONAVIT, clave electoral, licencia, carta no penales, idiomas externos). */
function matchDocumentosFichaColumnFuzzy(canon: string): CsvFieldKey | undefined {
  if (canon.length < 4) return undefined;
  if (canon.includes("infonavit") || (canon.includes("credito") && canon.includes("infonavit"))) {
    return "creditoInfonavit";
  }
  /** "NO. INE / IFE", "NÚMERO INE/IFE", etc. → canon con ambos tokens `ine` y `ife` */
  if (canon.includes("ine") && canon.includes("ife")) {
    return "noIfe";
  }
  if (canon.includes("clave") && canon.includes("elector")) {
    return "noIfe";
  }
  if (
    canon.includes("carta") &&
    (canon.includes("penal") || canon.includes("antecedent") || canon.includes("no_antecedent"))
  ) {
    return "cartaNoAntecedentes";
  }
  if (canon.includes("licencia") && (canon.includes("conduc") || canon === "licencia" || canon.startsWith("licencia_"))) {
    return "licenciaConducir";
  }
  if (canon.includes("idioma") && canon.includes("extern")) {
    return "idiomas";
  }
  if (
    canon.includes("estado") &&
    canon.includes("civil") &&
    !canon.includes("natal") &&
    !canon.includes("municipio") &&
    !canon.includes("domicilio")
  ) {
    return "estadoCivil";
  }
  return undefined;
}

/** Cabeceras que no son escolaridad aunque contengan palabras parecidas. */
function isBlockedEscolaridadFuzzy(canon: string): boolean {
  if (canon.includes("socioeconomico")) return true;
  /** Excel trunca "SOCIOECONÓMICO" → socioecon; sin esto cae en estudio_* → escolaridad y se pierde en import sólo nómina */
  if (canon.includes("socioecon")) return true;
  if (canon.includes("documentacion") && (canon.includes("orig") || canon.includes("ori"))) return true;
  if (
    canon.startsWith("documentaci") &&
    (canon.includes("original") || canon.includes("orig") || canon.includes("ori") || canon.endsWith("_or"))
  ) {
    return true;
  }
  if (canon.includes("nombre_escolar")) return true;
  if (canon.includes("nombre") && canon.includes("escolar") && !canon.includes("escolaridad")) return true;
  return false;
}

/**
 * Si el Excel trae un encabezado no listado en HEADER_TO_FIELD pero obvio (ej. "Escolaridad del colaborador"),
 * lo tratamos como escolaridad.
 */
function isLikelyEscolaridadColumn(canon: string): boolean {
  if (canon.length < 4) return false;
  if (isBlockedEscolaridadFuzzy(canon)) return false;
  if (canon.includes("escolaridad")) return true;
  if (canon.includes("grado_de_estudio") || canon.includes("grado_estudio")) return true;
  if (canon.includes("nivel_de_estudio") || canon.includes("nivel_estudio")) return true;
  if (canon.includes("ultimo_grado")) return true;
  if (canon.includes("maximo_grado") || canon.includes("maxima_escolar")) return true;
  if (canon === "educacion" || (canon.startsWith("educacion_") && !canon.includes("fisica"))) return true;
  if (canon.includes("nivel_educativo") || canon.includes("nivel_academico")) return true;
  if (canon.includes("formacion_academica") || canon.includes("preparacion_academica")) return true;
  if (canon === "estudio" || (canon.startsWith("estudio_") && !canon.includes("socioeconom"))) return true;
  return false;
}

/** Encabezados largos típicos de Excel / ficha de salud que no están en HEADER_TO_FIELD. */
function matchSaludColumnFuzzy(canon: string): CsvFieldKey | undefined {
  if (canon.length < 5) return undefined;
  if (canon.includes("escolaridad") || canon.includes("estudio_socioeconomico")) return undefined;

  if (canon.includes("emergencia")) {
    const phoneHint =
      canon.includes("telefono") ||
      canon.includes("tele_emergencia") ||
      canon.includes("tel_") ||
      canon.startsWith("tel_") ||
      canon.includes("_tel_") ||
      canon.endsWith("_tel") ||
      canon.includes("celular") ||
      canon.includes("movil") ||
      canon.includes("whatsapp") ||
      canon.includes("numero_telefonico") ||
      (canon.includes("numero") && canon.includes("telef"));
    if (phoneHint) {
      return "emergenciaTelefono";
    }
    if (canon.includes("llamar") || canon.includes("contacto") || canon.includes("avisar")) {
      return "emergenciaNombre";
    }
  }

  if (
    (canon.includes("tipo") &&
      (canon.includes("sangre") || canon.includes("sanguineo") || canon.includes("sanguinea"))) ||
    canon.includes("grupo_sanguineo") ||
    canon.includes("tipificacion_sanguinea") ||
    (canon.includes("rh") && (canon.includes("factor") || canon.includes("grupo") || canon.includes("tipo")))
  ) {
    return "tipoSangre";
  }

  if ((canon.includes("estatura") && canon.includes("peso")) || (canon.includes("altura") && canon.includes("peso"))) {
    return "estaturaPeso";
  }

  if (
    (canon.includes("enfermedad") || canon.includes("padecimiento")) &&
    (canon.includes("tratamiento") || canon.includes("actual") || canon.includes("medico") || canon.includes("medica"))
  ) {
    return "enfermedadTratamiento";
  }

  if (
    canon.includes("alerg") &&
    (canon.includes("medic") ||
      canon.includes("comida") ||
      canon.includes("aliment") ||
      canon === "alergias" ||
      canon.startsWith("alergias_"))
  ) {
    return "alergicoA";
  }

  if (canon.includes("diabet")) {
    return "diabetico";
  }
  if (canon.includes("hipertenso") || canon.includes("hipertens")) {
    return "hipertenso";
  }

  return undefined;
}

/** Encabezados de la columna documentación original (antes que la regla genérica `*reclutamiento* → fuente`). */
function matchesDocumentacionOriginalNominaHeader(canon: string): boolean {
  if (canon.includes("documentacion_original")) return true;
  if (canon.includes("documentacion") && (canon.includes("original") || canon.includes("orig") || canon.includes("ori"))) {
    return true;
  }
  if (canon.includes("documento") && (canon.includes("original") || canon.includes("orig") || canon.includes("ori"))) {
    return true;
  }
  if (canon.startsWith("doc_") && (canon.includes("orig") || canon.includes("ori"))) return true;
  if (
    canon.startsWith("documentaci") &&
    (canon.includes("original") || canon.includes("orig") || canon.includes("ori") || canon.endsWith("_or"))
  ) {
    return true;
  }
  return false;
}

/** Nómina / reclutamiento: encabezados largos de Excel que no están en HEADER_TO_FIELD. */
function matchNominaColumnFuzzy(canon: string): CsvFieldKey | undefined {
  if (canon.length < 4) return undefined;
  if (canon.includes("emergencia") || canon.includes("alerg") || canon.includes("enfermedad") || canon.includes("hipertens")) {
    return undefined;
  }
  if (canon.includes("escolaridad")) {
    return undefined;
  }

  if (canon.includes("clabe") || (canon.includes("interbancaria") && !canon.includes("beneficiario"))) {
    return "clabeInterbancaria";
  }
  if (
    (canon.includes("tarjeta") && !canon.includes("beneficiario")) ||
    canon.includes("no_tarjeta") ||
    canon.startsWith("no_tarj")
  ) {
    return "noTarjeta";
  }
  if (
    (canon.includes("cuenta") || canon.includes("ncc") || canon.startsWith("no_cuenta")) &&
    !canon.includes("clabe") &&
    !canon.includes("interbancaria")
  ) {
    return "numeroCuenta";
  }
  if (
    (canon.includes("banco") ||
      canon.includes("institucion_bancaria") ||
      canon.includes("entidad_bancaria")) &&
    !canon.includes("beneficiario") &&
    !canon.includes("cuenta") &&
    !canon.includes("clabe") &&
    !canon.includes("ncc")
  ) {
    return "banco";
  }
  if (
    canon.includes("sueldo") ||
    canon.includes("salario") ||
    (canon.includes("nomina") && (canon.includes("mensual") || canon.includes("bruto") || canon.includes("neto"))) ||
    (canon.includes("pago") && canon.includes("mensual")) ||
    (canon.includes("ingreso") && canon.includes("mensual"))
  ) {
    return "sueldoMensual";
  }
  if (
    canon.includes("gestor") ||
    canon.includes("reclutador") ||
    (canon.includes("proceso") &&
      (canon.includes("seleccion") || canon.includes("contratacion") || canon.includes("ingreso")) &&
      !canon.includes("reclutamiento"))
  ) {
    return "gestorProceso";
  }
  if (matchesDocumentacionOriginalNominaHeader(canon)) {
    return "documentacionOriginal";
  }
  if (canon.includes("reclutamiento") && !canon.includes("fecha")) {
    return "fuenteReclutamiento";
  }
  if (
    canon.includes("socioeconomico") ||
    canon.includes("socio_economico") ||
    canon.includes("socioecon") ||
    (canon.includes("estudio") && canon.includes("socio"))
  ) {
    return "estudioSocioeconomico";
  }
  return undefined;
}

/** Columnas tipo «N.º servicio» / «número de servicio» que no están en HEADER_TO_FIELD literal. */
function matchNoServicioColumnFuzzy(canon: string): CsvFieldKey | undefined {
  if (!canon.includes("servicio")) return undefined;
  /** POSICION / POSICION EN SERVICIO = puesto laboral, no N.º de catálogo. */
  if (canon.includes("posicion")) return undefined;
  if (
    canon === "servicio" ||
    canon === "servicio_asignado" ||
    canon === "servicio_cliente_lugar" ||
    canon === "servicio_final" ||
    canon === "ultimo_servicio" ||
    canon === "ultimo_servicio_moper"
  ) {
    return undefined;
  }
  if (canon.includes("ultimo") || canon.includes("final") || canon.includes("cliente") || canon.includes("lugar")) {
    return undefined;
  }
  if (
    canon.includes("no_") ||
    canon.includes("numero") ||
    canon.includes("num_") ||
    canon.includes("nro") ||
    canon.startsWith("n_") ||
    canon.includes("clave_serv") ||
    /^num\d*_serv/.test(canon)
  ) {
    return "noServicio";
  }
  return undefined;
}

export function resolveFieldKeyFromCanonHeader(canon: string): CsvFieldKey | undefined {
  const direct = HEADER_TO_FIELD[canon];
  if (direct) return direct;
  const noSrv = matchNoServicioColumnFuzzy(canon);
  if (noSrv) return noSrv;
  const docFicha = matchDocumentosFichaColumnFuzzy(canon);
  if (docFicha) return docFicha;
  const salud = matchSaludColumnFuzzy(canon);
  if (salud) return salud;
  const nomina = matchNominaColumnFuzzy(canon);
  if (nomina) return nomina;
  if (isLikelyEscolaridadColumn(canon)) return "escolaridad";
  return undefined;
}

export function buildHeaderFieldIndex(headerRow: string[]): Map<number, CsvFieldKey> {
  const map = new Map<number, CsvFieldKey>();
  headerRow.forEach((raw, idx) => {
    const c = canonCsvHeader(raw);
    const field = resolveFieldKeyFromCanonHeader(c);
    if (field) map.set(idx, field);
  });
  return map;
}

const NUMERIC_CSV_FIELDS = new Set<CsvFieldKey>(["noEmpleado", "noServicio", "posicion", "imss", "numeroFolio"]);

export function rowToFieldMap(cells: string[], index: Map<number, CsvFieldKey>): Partial<Record<CsvFieldKey, string>> {
  const out: Partial<Record<CsvFieldKey, string>> = {};
  index.forEach((field, colIdx) => {
    let v = (cells[colIdx] ?? "").trim();
    if (NUMERIC_CSV_FIELDS.has(field)) v = normalizarCeldaCsvNumerica(v);
    if (v !== "") out[field] = v;
  });
  return out;
}
