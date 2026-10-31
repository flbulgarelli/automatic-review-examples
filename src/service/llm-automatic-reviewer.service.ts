import { generateObject, RetryError, type LanguageModel } from 'ai';
import {
  ReviewerUnavailableError,
  type AutomaticReviewerService,
} from './automatic-reviewer.js';
import { ReviewSchema, type MentorshipRequest, type Review } from '../model/mentorship.js';

const SYSTEM_PROMPT = `Sos un revisor automático de solicitudes de mentoría.

Tu tarea es decidir una de tres opciones:
- "aprobada": el pedido es claramente legítimo y aceptable.
- "rechazada": el pedido viola alguno de los criterios de rechazo.
- "requiere_revision_manual": hay dudas o ambigüedad; debe revisarlo una persona.

Criterios de rechazo (si aplica CUALQUIERA, rechazar):
1. Pide algo ilegal.
2. Pide algo antiético.
3. Pide algo para dañar a alguien.
4. Pide algo que favorezca la vigilancia o limite derechos democráticos.

Si no hay evidencia clara de ninguno de los criterios anteriores pero el pedido es ambiguo o insuficiente, elegí "requiere_revision_manual".

Devolvé además:
- "explanation": una explicación breve y respetuosa de la decisión.
- "language": el código ISO 639-1 del idioma de la explanation (ej: "es", "en", "pt").

Reglas de idioma:
- Si el usuario indicó un idioma preferido, respondé la explanation en ese idioma.
- Si no indicó idioma, detectá el idioma de la descripción y respondé en ese idioma.
- El campo "language" debe coincidir con el idioma usado en "explanation".`;

export class LlmAutomaticReviewerService implements AutomaticReviewerService {
  constructor(private readonly model: LanguageModel) {}

  async review(req: MentorshipRequest): Promise<Review> {
    const userPrompt = buildUserPrompt(req);
    try {
      const startedAt = Date.now();
      const { object, usage } = await generateObject({
        model: this.model,
        schema: ReviewSchema,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
      });
      const elapsed = Date.now() - startedAt;
      const tokens = usage
        ? `in=${usage.inputTokens ?? '?'} out=${usage.outputTokens ?? '?'} total=${usage.totalTokens ?? '?'}`
        : 'usage=n/a';
      console.log(
        `[llm-reviewer] decision=${object.decision} lang=${object.language} (${elapsed}ms, tokens ${tokens})`,
      );
      return object;
    } catch (err) {
      if (RetryError.isInstance(err)) {
        throw new ReviewerUnavailableError('No se pudo conectar con el LLM', { cause: err });
      }
      throw err;
    }
  }
}

function buildUserPrompt(req: MentorshipRequest): string {
  const lines = [
    'Solicitud de mentoría a revisar:',
    `- email: ${req.email}`,
    `- username: ${req.username}`,
    req.language
      ? `- idioma preferido: ${req.language}`
      : '- idioma preferido: (no especificado — detectar del texto)',
    '- descripción:',
    req.description,
  ];
  return lines.join('\n');
}
