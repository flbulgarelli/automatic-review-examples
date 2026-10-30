import type { MentorshipRequest } from '../model/mentorship.js';

export interface MentorshipRepo {
  save(req: MentorshipRequest): void;
  findById(id: string): MentorshipRequest | undefined;
  update(id: string, patch: Partial<MentorshipRequest>): MentorshipRequest | undefined;
}

export class InMemoryMentorshipRepo implements MentorshipRepo {
  private readonly store = new Map<string, MentorshipRequest>();

  save(req: MentorshipRequest): void {
    this.store.set(req.id, req);
  }

  findById(id: string): MentorshipRequest | undefined {
    return this.store.get(id);
  }

  update(id: string, patch: Partial<MentorshipRequest>): MentorshipRequest | undefined {
    const current = this.store.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    this.store.set(id, next);
    return next;
  }
}
