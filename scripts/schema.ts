import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { examSchema } from '../src/engine/schema';
writeFileSync('public/exam.schema.json', JSON.stringify(z.toJSONSchema(examSchema), null, 2));
