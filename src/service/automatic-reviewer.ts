import type { MentorshipRequest, Review } from '../model/mentorship.js';

export interface AutomaticReviewerService {
  review(req: MentorshipRequest): Promise<Review>;
}

export class ReviewerUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ReviewerUnavailableError';
  }
}
