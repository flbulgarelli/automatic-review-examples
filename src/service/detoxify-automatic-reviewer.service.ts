import { pipeline, type TextClassificationPipeline } from '@huggingface/transformers';
import {
  ReviewerUnavailableError,
  type AutomaticReviewerService,
} from './automatic-reviewer.js';
import type { Decision, MentorshipRequest, Review } from '../model/mentorship.js';

const MODEL = 'Xenova/toxic-bert';
const REJECT_THRESHOLD = 0.5;
const REVIEW_THRESHOLD = 0.2;

interface Score {
  label: string;
  score: number;
}

export class DetoxifyAutomaticReviewerService implements AutomaticReviewerService {
  private classifierPromise?: Promise<TextClassificationPipeline>;

  async review(req: MentorshipRequest): Promise<Review> {
    const classifier = await this.getClassifier();
    const results = (await classifier(req.description, { top_k: 20 })) as Score[];
    const scores = [...results].sort((a, b) => b.score - a.score);
    const top = scores[0];
    const decision = classify(top.score);
    const summary = scores
      .map((s) => `${s.label}=${s.score.toFixed(3)}`)
      .join(', ');
    console.log(`[detoxify] scores: ${summary}`);
    console.log(
      `[detoxify] top=${top.label} score=${top.score.toFixed(3)} decision=${decision}`,
    );
    return {
      decision,
      explanation: buildExplanation(decision, top),
      language: 'en',
    };
  }

  private getClassifier(): Promise<TextClassificationPipeline> {
    if (!this.classifierPromise) {
      console.log(`[detoxify] loading model ${MODEL} (first use)…`);
      const startedAt = Date.now();
      this.classifierPromise = (async () => {
        try {
          const pipe = (await pipeline(
            'text-classification',
            MODEL,
          )) as unknown as TextClassificationPipeline;
          console.log(`[detoxify] model ready in ${Date.now() - startedAt}ms`);
          return pipe;
        } catch (err) {
          this.classifierPromise = undefined;
          throw new ReviewerUnavailableError(
            `No se pudo cargar el modelo Detoxify (${MODEL})`,
            { cause: err },
          );
        }
      })();
    }
    return this.classifierPromise;
  }
}

function classify(score: number): Decision {
  if (score >= REJECT_THRESHOLD) return 'rechazada';
  if (score >= REVIEW_THRESHOLD) return 'requiere_revision_manual';
  return 'aprobada';
}

function buildExplanation(decision: Decision, top: Score): string {
  const score = top.score.toFixed(3);
  switch (decision) {
    case 'rechazada':
      return `Rejected by toxicity classifier (label="${top.label}", score=${score}).`;
    case 'requiere_revision_manual':
      return `Borderline toxicity score (label="${top.label}", score=${score}); escalated for human review.`;
    case 'aprobada':
      return `Passed automated toxicity screening (max score ${score}).`;
  }
}
