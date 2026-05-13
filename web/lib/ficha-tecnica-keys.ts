/** Clave en `form` del expediente colaborador donde se guarda la URL pública de la foto (Supabase Storage). */
export const FICHA_FOTO_FORM_KEY = "fichaFotoUrl";

/** Opcionales que pueden completarse en expediente y se muestran en ficha si existen */
export const FICHA_EXTRA_KEYS = [
  "estadoCivil",
  "lugarNacimiento",
  "noIfe",
  "licenciaConducir",
  "cartaNoAntecedentes",
  "creditoInfonavit",
  "idiomas",
  "conocimientosHabilidades",
  "senasParticulares",
  "telefonoCelular",
] as const;
