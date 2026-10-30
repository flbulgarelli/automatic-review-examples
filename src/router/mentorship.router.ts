import { Router } from 'express';
import type { MentorshipController } from '../controller/mentorship.controller.js';

export function buildMentorshipRouter(controller: MentorshipController): Router {
  const router = Router();
  router.post('/mentorship-requests', controller.create);
  router.get('/mentorship-requests/:id', controller.get);
  return router;
}
