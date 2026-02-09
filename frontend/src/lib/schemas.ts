/**
 * Zod schemas for API response validation
 *
 * These schemas validate API responses at runtime to catch mismatches between
 * backend and frontend types early. If the backend returns unexpected data,
 * you'll get a clear error message instead of silent failures.
 *
 * Usage:
 *   import { ConversationSchema, validateApiResponse } from '@/lib/schemas'
 *   const data = validateApiResponse(ConversationSchema, response, '/conversations')
 */

import { z } from 'zod'

// ============================================================================
// Conversation Schemas
// ============================================================================

export const ConversationSchema = z.object({
  id: z.string(),
  projectName: z.string(),
  projectPath: z.string().optional(),
  startTime: z.string(),
  lastActivity: z.string(),
  messageCount: z.number(),
  // Optional fields that may not always be present
  totalTokens: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  duration: z.number().optional(),
  firstMessage: z.string().optional(),
  rootRequestId: z.string().optional(),
})

// V2 API returns array directly
export const ConversationsArraySchema = z.array(ConversationSchema)

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validates an API response against a Zod schema.
 *
 * In development, logs warnings for validation failures but returns data anyway
 * to avoid breaking the UI. In the future, this could throw in strict mode.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw API response data
 * @param endpoint - API endpoint (for error messages)
 * @returns Validated and typed data
 */
export function validateApiResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  endpoint: string
): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    // Log detailed error in development
    console.error(
      `[API Schema Mismatch] ${endpoint}`,
      '\n\nReceived data:',
      data,
      '\n\nValidation errors:',
      result.error.issues
    )

    // In development, warn but return data anyway to avoid breaking the UI
    // The actual TypeScript types will still catch usage errors at compile time
    console.warn(
      `⚠️ API response from ${endpoint} doesn't match expected schema. ` +
      `This may cause runtime errors. Check the console for details.`
    )

    // Return the data cast to expected type - TypeScript will catch misuse
    return data as T
  }

  return result.data
}

/**
 * Creates a validated fetch function for a specific endpoint.
 *
 * Example:
 *   const fetchConversations = createValidatedFetch(
 *     ConversationsResponseSchema,
 *     '/conversations'
 *   )
 *   const { conversations } = await fetchConversations()
 */
export function createValidatedFetch<T>(
  schema: z.ZodType<T>,
  endpoint: string
) {
  return async (): Promise<T> => {
    const response = await fetch(`/api${endpoint}`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    const data = await response.json()
    return validateApiResponse(schema, data, endpoint)
  }
}
