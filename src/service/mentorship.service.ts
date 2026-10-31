import { randomUUID } from 'node:crypto';
import type { MentorshipRepo } from '../repo/mentorship.repo.js';
import { ReviewerUnavailableError, type AutomaticReviewerService } from './automatic-reviewer.js';
import {
  mapDecisionToStatus,
  type CreateRequest,
  type MentorshipRequest,
} from '../model/mentorship.js';

export class MentorshipService {
  constructor(
    private readonly repo: MentorshipRepo,
    private readonly reviewer: AutomaticReviewerService,
  ) {}

  create(data: CreateRequest): MentorshipRequest {
    const req: MentorshipRequest = {
      ...data,
      id: randomUUID(),
      status: 'pendiente',
      processada_automaticamente: false,
      createdAt: new Date().toISOString(),
    };
    this.repo.save(req);
    console.log(
      `[mentorship] created ${req.id} (lang=${req.language ?? 'auto'}, descLen=${req.description.length})`,
    );
    // Esto debería ir a una cola de tareas
    // Se lo deja así sólo a fines didácticos
    setTimeout(() => {
      this.processAutomatically(req.id).catch((err) => {
        if (err instanceof ReviewerUnavailableError) {
          console.error(`[mentorship] ${req.id}: ${err.message}`);
          return;
        }
        console.error(`[mentorship] processAutomatically(${req.id}) failed:`, err);
      });
    }, 0);
    return req;
  }

  async processAutomatically(id: string): Promise<void> {
    const current = this.repo.findById(id);
    if (!current) return;
    console.log(`[mentorship] ${id}: processing started`);
    const startedAt = Date.now();
    try {
      const review = await this.reviewer.review(current);
      const status = mapDecisionToStatus(review.decision);
      this.repo.update(id, {
        status,
        explanation: `${review.explanation}\n\n(respuesta generada automáticamente)`,
        detectedLanguage: review.language,
        processada_automaticamente: true,
      });
      const elapsed = Date.now() - startedAt;
      console.log(
        `[mentorship] ${id}: processing done in ${elapsed}ms — decision=${review.decision} status=${status} lang=${review.language}`,
      );
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      if (err instanceof ReviewerUnavailableError) {
        this.repo.update(id, {
          status: 'en_revision',
          processada_automaticamente: true,
          explanation: 'No se pudo evaluar automáticamente; derivado a revisión manual.',
        });
        console.warn(
          `[mentorship] ${id}: reviewer unavailable after ${elapsed}ms — status=en_revision`,
        );
      }
      throw err;
    }
  }

  find(id: string): MentorshipRequest | undefined {
    return this.repo.findById(id);
  }
}
