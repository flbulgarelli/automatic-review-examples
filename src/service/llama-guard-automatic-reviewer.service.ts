import { generateText, RetryError, type LanguageModel } from 'ai';
import {
  ReviewerUnavailableError,
  type AutomaticReviewerService,
} from './automatic-reviewer.js';
import type { MentorshipRequest, Review } from '../model/mentorship.js';

const CATEGORIES: Record<string, string> = {
  S1: 'Violent Crimes',
  S2: 'Non-Violent Crimes',
  S3: 'Sex-Related Crimes',
  S4: 'Child Sexual Exploitation',
  S5: 'Defamation',
  S6: 'Specialized Advice',
  S7: 'Privacy',
  S8: 'Intellectual Property',
  S9: 'Indiscriminate Weapons',
  S10: 'Hate',
  S11: 'Suicide & Self-Harm',
  S12: 'Sexual Content',
  S13: 'Elections',
  S14: 'Code Interpreter Abuse',
};

export class LlamaGuardAutomaticReviewerService implements AutomaticReviewerService {
  constructor(private readonly model: LanguageModel) {}

  async review(req: MentorshipRequest): Promise<Review> {
    try {
      const startedAt = Date.now();
      const { text } = await generateText({
        model: this.model,
        messages: [{ role: 'user', content: req.description }],
      });
      const elapsed = Date.now() - startedAt;
      console.log(`[llama-guard] raw output (${elapsed}ms): ${JSON.stringify(text)}`);
      const review = parseGuardOutput(text, req);
      console.log(
        `[llama-guard] decision=${review.decision} — ${review.explanation}`,
      );
      return review;
    } catch (err) {
      if (RetryError.isInstance(err)) {
        throw new ReviewerUnavailableError('No se pudo conectar con Llama-Guard', { cause: err });
      }
      throw err;
    }
  }
}

function parseGuardOutput(raw: string, req: MentorshipRequest): Review {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const verdict = lines[0]?.toLowerCase();
  const language = req.language ?? 'en';

  if (verdict === 'safe') {
    return { decision: 'aprobada', explanation: 'Llama-Guard: safe.', language };
  }
  if (verdict === 'unsafe') {
    const token = lines[1]?.split(',')[0]?.trim().toUpperCase();
    const label = token && CATEGORIES[token] ? `${token} ${CATEGORIES[token]}` : (token ?? 'unknown');
    return {
      decision: 'rechazada',
      explanation: `Llama-Guard: unsafe (${label}).`,
      language,
    };
  }
  return {
    decision: 'requiere_revision_manual',
    explanation: 'Llama-Guard: unparseable output; sent to manual review.',
    language,
  };
}
