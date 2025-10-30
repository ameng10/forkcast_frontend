# Personal QA: Endpoints and Flow

This document explains how the Personal QA feature interacts with endpoints and how the QA loop should work to avoid internal errors.

## API Endpoints

- Personal facts
  - GET: PersonalQAAPI.getUserFacts({ owner })
    - Returns: Array of { factId: string, fact: string }
    - Notes: Some records may be empty or malformed; filter client-side.
  - POST: PersonalQAAPI.ingestFact({ owner, fact })
    - Returns: { factId }
    - Expect: fact is non-empty string. Update local store on success.
  - DELETE: PersonalQAAPI.forgetFact({ owner, factId })
    - Idempotent behavior recommended. Update local store optimistically.

- Meals and check-ins (optional extras)
  - MealLogAPI.getMealsForOwner({ ownerId })
    - Returns: Array-like of meals; normalize to { mealId, at, items[], notes }.
  - QuickCheckInsAPI.listByOwner({ owner })
    - Returns: Array of { metricId, metricName, value, ts }.

- LLM (frontend adapter)
  - askLLMJson(requester, prompt)
    - Returns: { parsed?: any, raw: string }
    - The prompt must request STRICT JSON. Use safe parsing and validate fields.

## Store-level Safety

- Persist and show facts with text only. If server returns a known factId but empty text, reuse last locally known text to avoid showing bare IDs.
- Maintain a deletedFactIds map to hide records immediately after delete.
- Clean null/blank entries periodically to prevent crashes.
- Keep UI answers independent per ask; do not rely on conversation state.

## QA Flow (modeled on personalQA_example)

1. Load user facts for the requester (already in store state).
2. Select top-K facts by recency (last K in list or by known timestamps if available).
3. Fill a short strict JSON template:
   - Return shape: {"answer":"...","citations":["factId"...],"confidence":0.0}
   - Keep answer ≤ 120 words.
   - Every personal claim must be supported by provided facts; cite by exact IDs.
   - If out of scope, state clearly, cite closest fact, and add a brief "Web note" (general knowledge) in the answer body.
4. Call askLLMJson and parse the result. Strip any code fences before JSON.
5. Validate:
   - answer: non-empty string
   - citations: non-empty array of IDs drawn from the selected facts
   - confidence: number between 0 and 1
6. On validation failure or LLM error:
   - Fall back to a conservative summary built locally from the last few facts.
7. Sanitize the final answer to remove DB-like IDs or bracket citations and present to the user.
8. Store QA record internally (question, answer). Optionally store citations/confidence, but do not show DB IDs to the user.

## Error Handling

- Wrap all network calls in try/catch. Provide a graceful local fallback when LLM/backend is unavailable.
- Never throw for user-visible flows unless absolutely necessary (e.g., no ownerId).
- Validate LLM output strictly; do not trust unvalidated JSON.

## Display

- Show only the answer text (sanitized). Omit internal IDs. Optionally append a subtle confidence (e.g., "(confidence ~72%)").

## Testing Tips

- With zero facts, ensure conservative fallback produces a coherent answer indicating limited personal evidence, plus an optional "Web note" when applicable.
- Validate that deleting a fact removes it from selection and that QA still answers without errors.
- Confirm that malformed LLM output triggers safe fallback rather than breaking the UI.
