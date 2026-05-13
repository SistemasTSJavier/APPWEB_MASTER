/** Error al leer o escribir datos via API de servidor (Supabase). */
export class SupabaseDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseDataError";
  }
}
