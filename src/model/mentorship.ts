import { z } from 'zod';

export const STATUSES = ['pendiente', 'aceptada', 'rechazada', 'en_revision'] as const;
export type Status = (typeof STATUSES)[number];

export const DECISIONS = ['aprobada', 'rechazada', 'requiere_revision_manual'] as const;
export type Decision = (typeof DECISIONS)[number];

export const CreateRequestSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1),
  description: z.string().min(500),
  language: z.string().min(2).optional(),
  reviewer: z.string().email().optional(),
});
export type CreateRequest = z.infer<typeof CreateRequestSchema>;

export interface MentorshipRequest extends CreateRequest {
  id: string;
  status: Status;
  processada_automaticamente: boolean;
  explanation?: string;
  detectedLanguage?: string;
  createdAt: string;
}

export const ReviewSchema = z.object({
  decision: z.enum(DECISIONS),
  explanation: z.string().min(1),
  language: z.string().min(2),
});
export type Review = z.infer<typeof ReviewSchema>;

export function mapDecisionToStatus(decision: Decision): Status {
  switch (decision) {
    case 'aprobada':
      return 'aceptada';
    case 'rechazada':
      return 'rechazada';
    case 'requiere_revision_manual':
      return 'en_revision';
  }
}
