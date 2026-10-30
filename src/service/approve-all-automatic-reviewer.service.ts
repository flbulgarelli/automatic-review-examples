import type { AutomaticReviewerService } from './automatic-reviewer.js';
import type { MentorshipRequest, Review } from '../model/mentorship.js';

export class ApproveAllAutomaticReviewerService implements AutomaticReviewerService {
  async review(req: MentorshipRequest): Promise<Review> {
    return {
      decision: 'aprobada',
      explanation: 'Aprobado automáticamente.',
      language: req.language ?? 'es',
    };
  }
}
