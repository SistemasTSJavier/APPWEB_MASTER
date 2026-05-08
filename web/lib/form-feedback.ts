/** Resultado estándar para formularios con `useActionState` (mensajes sin lanzar excepción). */
export type FormFeedbackState = {
  ok: boolean;
  error?: string;
  message?: string;
};
