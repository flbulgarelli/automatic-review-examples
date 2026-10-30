import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '../src/app.js';
import { buildMentorshipRouter } from '../src/router/mentorship.router.js';
import { MentorshipController } from '../src/controller/mentorship.controller.js';
import { MentorshipService } from '../src/service/mentorship.service.js';
import { InMemoryMentorshipRepo } from '../src/repo/mentorship.repo.js';
import {
  ReviewerUnavailableError,
  type AutomaticReviewerService,
} from '../src/service/automatic-reviewer.js';
import { ApproveAllAutomaticReviewerService } from '../src/service/approve-all-automatic-reviewer.service.js';
import type { Decision, Review } from '../src/model/mentorship.js';

const LONG_DESC = 'Quiero ayuda con mi proyecto final de la facultad. '.repeat(20);

function buildTestApp(reviewer: AutomaticReviewerService): Express {
  const repo = new InMemoryMentorshipRepo();
  const service = new MentorshipService(repo, reviewer);
  const controller = new MentorshipController(service);
  return createApp(buildMentorshipRouter(controller));
}

function fakeReviewer(review: Review): AutomaticReviewerService {
  return {
    async review() {
      return review;
    },
  };
}

describe('mentorship API', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('POST creates request with status pendiente', async () => {
    const app = buildTestApp(new ApproveAllAutomaticReviewerService());
    const res = await request(app)
      .post('/mentorship-requests')
      .send({ email: 'a@b.com', username: 'ana', description: LONG_DESC, language: 'es' });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.status).toBe('pendiente');
  });

  it('POST rejects description shorter than 500 chars', async () => {
    const app = buildTestApp(new ApproveAllAutomaticReviewerService());
    const res = await request(app)
      .post('/mentorship-requests')
      .send({ email: 'a@b.com', username: 'ana', description: 'muy corto' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('ApproveAllAutomaticReviewerService leaves request as aceptada', async () => {
    const app = buildTestApp(new ApproveAllAutomaticReviewerService());
    const created = await request(app)
      .post('/mentorship-requests')
      .send({ email: 'a@b.com', username: 'ana', description: LONG_DESC, language: 'es' });

    await vi.runAllTimersAsync();

    const got = await request(app).get(`/mentorship-requests/${created.body.id}`);
    expect(got.body.status).toBe('aceptada');
    expect(got.body.processada_automaticamente).toBe(true);
    expect(got.body.explanation).toContain('respuesta generada automáticamente');
  });

  it.each<{ decision: Decision; expected: string }>([
    { decision: 'aprobada', expected: 'aceptada' },
    { decision: 'rechazada', expected: 'rechazada' },
    { decision: 'requiere_revision_manual', expected: 'en_revision' },
  ])('async processing: $decision -> status=$expected', async ({ decision, expected }) => {
    const app = buildTestApp(
      fakeReviewer({
        decision,
        explanation: `explicación para ${decision}`,
        language: 'es',
      }),
    );

    const created = await request(app)
      .post('/mentorship-requests')
      .send({ email: 'a@b.com', username: 'ana', description: LONG_DESC, language: 'es' });
    expect(created.status).toBe(201);

    await vi.runAllTimersAsync();

    const got = await request(app).get(`/mentorship-requests/${created.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body.status).toBe(expected);
    expect(got.body.processada_automaticamente).toBe(true);
    expect(got.body.explanation).toBe(
      `explicación para ${decision}\n\n(respuesta generada automáticamente)`,
    );
    expect(got.body.detectedLanguage).toBe('es');
  });

  it('GET returns 404 for unknown id', async () => {
    const app = buildTestApp(new ApproveAllAutomaticReviewerService());
    const res = await request(app).get('/mentorship-requests/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('falls back to en_revision when reviewer is unavailable', async () => {
    const reviewer: AutomaticReviewerService = {
      async review() {
        throw new ReviewerUnavailableError('No se pudo conectar con el LLM');
      },
    };
    const app = buildTestApp(reviewer);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const created = await request(app)
      .post('/mentorship-requests')
      .send({ email: 'a@b.com', username: 'ana', description: LONG_DESC, language: 'es' });
    expect(created.status).toBe(201);

    await vi.runAllTimersAsync();

    const got = await request(app).get(`/mentorship-requests/${created.body.id}`);
    expect(got.body.status).toBe('en_revision');
    expect(got.body.processada_automaticamente).toBe(true);
    expect(got.body.explanation).toMatch(/revisión manual/i);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo conectar con el LLM'),
    );

    errSpy.mockRestore();
  });

  it('persists detectedLanguage returned by reviewer when request omits language', async () => {
    const app = buildTestApp(
      fakeReviewer({
        decision: 'aprobada',
        explanation: 'Legitimate request.',
        language: 'en',
      }),
    );

    const created = await request(app)
      .post('/mentorship-requests')
      .send({ email: 'a@b.com', username: 'ana', description: LONG_DESC });
    expect(created.status).toBe(201);

    await vi.runAllTimersAsync();

    const got = await request(app).get(`/mentorship-requests/${created.body.id}`);
    expect(got.body.detectedLanguage).toBe('en');
    expect(got.body.language).toBeUndefined();
  });
});
