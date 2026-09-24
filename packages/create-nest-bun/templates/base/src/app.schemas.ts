import { z } from 'zod';

export const greetSchema = z.object({
  name: z.string().min(1).max(50),
});
export type GreetDto = z.infer<typeof greetSchema>;
