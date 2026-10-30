import type { Request, Response, NextFunction } from 'express';
import type { MentorshipService } from '../service/mentorship.service.js';
import { CreateRequestSchema } from '../model/mentorship.js';

export class MentorshipController {
  constructor(private readonly service: MentorshipService) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = CreateRequestSchema.parse(req.body);
      const created = this.service.create(data);
      res.status(201).json({ id: created.id, status: created.status });
    } catch (err) {
      next(err);
    }
  };

  get = (req: Request, res: Response): void => {
    const found = this.service.find(req.params.id);
    if (!found) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(found);
  };
}
