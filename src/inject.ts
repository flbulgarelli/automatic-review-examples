import type { Express } from 'express';

import { loadConfig, type Config } from './config.js';
import { buildLanguageModel } from './llm.js';
import { createApp } from './app.js';
import { InMemoryMentorshipRepo } from './repo/mentorship.repo.js';
import { MentorshipService } from './service/mentorship.service.js';
import type { AutomaticReviewerService } from './service/automatic-reviewer.js';
import { LlmAutomaticReviewerService } from './service/llm-automatic-reviewer.service.js';
import { DetoxifyAutomaticReviewerService } from './service/detoxify-automatic-reviewer.service.js';
import { ApproveAllAutomaticReviewerService } from './service/approve-all-automatic-reviewer.service.js';
import { MentorshipController } from './controller/mentorship.controller.js';
import { buildMentorshipRouter } from './router/mentorship.router.js';

export interface BuiltApp {
  app: Express;
  config: Config;
}

export function buildApp(): BuiltApp {
  const config = loadConfig();
  const reviewer = buildReviewer(config);
  const repo = new InMemoryMentorshipRepo();
  const service = new MentorshipService(repo, reviewer);
  const controller = new MentorshipController(service);
  const router = buildMentorshipRouter(controller);
  return { app: createApp(router), config };
}

function buildReviewer(cfg: Config): AutomaticReviewerService {
  switch (cfg.reviewer) {
    case 'llm':
      return new LlmAutomaticReviewerService(buildLanguageModel(cfg.llm));
    case 'detoxify':
      return new DetoxifyAutomaticReviewerService();
    case 'approve_all':
      return new ApproveAllAutomaticReviewerService();
  }
}
