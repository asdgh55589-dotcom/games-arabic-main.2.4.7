import { z } from 'zod'

export const AppealSchema = z.object({
  reason: z.string().min(10).max(1000),
  evidenceUrl: z.union([z.string().url(), z.literal('')]).optional(),
})

export type AppealFormValues = z.infer<typeof AppealSchema>
