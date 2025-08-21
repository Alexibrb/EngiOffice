// This file is used to register Genkit flows for development.
// It is not intended for use in production.
import {Flow} from '@genkit-ai/core';

if (process.env.GENKIT_ENV === 'dev') {
  await import('@/ai/flows/smart-timeline-suggestions.ts');
}

export const flows: Flow[] = [];
