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
    const top = results.reduce((a, b) => (a.score >= b.score ? a : b));
    const decision = classify(top.score);
    return {
      decision,
      explanation: buildExplanation(decision, top),
      language: 'en',
    };
  }

  private getClassifier(): Promise<TextClassificationPipeline> {
    if (!this.classifierPromise) {
      this.classifierPromise = (async () => {
        try {
          return (await pipeline('text-classification', MODEL)) as unknown as TextClassificationPipeline;
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
