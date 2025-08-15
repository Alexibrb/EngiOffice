'use server';

/**
 * @fileOverview Provides smart timeline suggestions based on the service description.
 *
 * - suggestTimeline - A function that generates timeline suggestions.
 * - SuggestTimelineInput - The input type for the suggestTimeline function.
 * - SuggestTimelineOutput - The return type for the suggestTimeline function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTimelineInputSchema = z.object({
  serviceDescription: z
    .string()
    .describe('The description of the service for which a timeline is needed.'),
});
export type SuggestTimelineInput = z.infer<typeof SuggestTimelineInputSchema>;

const SuggestTimelineOutputSchema = z.object({
  suggestedTimeline: z
    .string()
    .describe(
      'A suggested timeline for the service, including estimated start and end dates and key milestones.'
    ),
});
export type SuggestTimelineOutput = z.infer<typeof SuggestTimelineOutputSchema>;

export async function suggestTimeline(
  input: SuggestTimelineInput
): Promise<SuggestTimelineOutput> {
  return suggestTimelineFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTimelinePrompt',
  input: {schema: SuggestTimelineInputSchema},
  output: {schema: SuggestTimelineOutputSchema},
  prompt: `You are an AI assistant that helps project managers estimate project timelines.

  Based on the following service description, suggest a project timeline with estimated start and end dates and key milestones:

  Service Description: {{{serviceDescription}}}
  `,
});

const suggestTimelineFlow = ai.defineFlow(
  {
    name: 'suggestTimelineFlow',
    inputSchema: SuggestTimelineInputSchema,
    outputSchema: SuggestTimelineOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
