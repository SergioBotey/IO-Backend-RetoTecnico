import { z } from 'zod';

const customerSchema = z.object({
  documentType: z.string(),
  documentNumber: z.string().min(8),
  fullName: z.string(),
  email: z.string().email(),
  age: z.number().int().min(18).max(100),
});

const productSchema = z
  .object({
    type: z.enum(['VISA', 'MASTERCARD']),
    currency: z.enum(['PEN', 'USD']),
    simulateError: z.boolean()
  })

export const cardIssueSchema = z.object({
  customer: customerSchema,
  product: productSchema,
});
