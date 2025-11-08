
# API Specification: PersonalQA Concept

**Purpose:** To provide a personalized question-answering system based on user-provided facts.

---

## API Endpoints

### POST /api/PersonalQA/ingestFact

**Description:** Ingests a new piece of information as a fact for a user.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Creates a new Fact record associated with the user, containing the provided content.
- Returns the ID of the newly created fact.

**Request Body:**
```json
{
  "user": "UserID",
  "content": "string"
}
```

**Success Response Body (Action):**
```json
{
  "fact": "FactID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/PersonalQA/forgetFact

**Description:** Deletes a previously ingested fact.

**Requirements:**
- The `fact` ID must be a valid and existing fact.

**Effects:**
- Removes the specified Fact record from the system.

**Request Body:**
```json
{
  "fact": "FactID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/PersonalQA/ask

**Description:** Asks a question against the user's fact base and returns a draft answer.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Searches the user's facts for relevant information.
- Creates a new Question/Answer (QA) record in a 'draft' state.
- Returns the ID of the new QA record.

**Request Body:**
```json
{
  "user": "UserID",
  "query": "string"
}
```

**Success Response Body (Action):**
```json
{
  "answer": "QA_ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/PersonalQA/askLLM

**Description:** Asks a question using an external LLM, using the user's facts as context.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Creates a new Question/Answer (QA) record in a 'draft' state using an LLM-generated response.
- Returns the ID of the new QA record.

**Request Body:**
```json
{
  "user": "UserID",
  "query": "string"
}
```

**Success Response Body (Action):**
```json
{
  "answer": "QA_ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/PersonalQA/setTemplate

**Description:** Sets a custom prompt template for the user's LLM queries.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Updates the user's stored LLM prompt template with the new value.

**Request Body:**
```json
{
  "user": "UserID",
  "template": "string"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/PersonalQA/_getUserFacts

**Description:** Retrieves all facts associated with a user.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Returns a list of all facts for the specified user.

**Request Body:**
```json
{
  "user": "UserID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "FactID",
    "content": "string",
    "owner": "UserID"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/PersonalQA/_getUserQAs

**Description:** Retrieves all question-answer pairs for a user.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Returns a list of all QAs for the specified user.

**Request Body:**
```json
{
  "user": "UserID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "QA_ID",
    "query": "string",
    "answer": "string",
    "owner": "UserID"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/PersonalQA/_getUserDrafts

**Description:** Retrieves all draft question-answer pairs for a user.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Returns a list of all draft QAs for the specified user.

**Request Body:**
```json
{
  "user": "UserID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "QA_ID",
    "query": "string",
    "answer": "string",
    "owner": "UserID",
    "isDraft": "boolean"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
# API Specification: InsightMining Concept

**Purpose:** To ingest user observations, analyze them to find patterns, and generate insightful reports.

---

## API Endpoints

### POST /api/InsightMining/ingest

**Description:** Records a new observation from a user.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Creates a new observation record.
- Returns the ID of the new observation.

**Request Body:**
```json
{
  "user": "UserID",
  "observation": "string"
}
```

**Success Response Body (Action):**
```json
{
  "observationId": "ObservationID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/InsightMining/analyze

**Description:** Analyzes a user's observations to generate a new insight.

**Requirements:**
- The `user` ID must be a valid and existing user.
- The user must have a sufficient number of observations to analyze.

**Effects:**
- Creates a new insight record derived from existing observations.
- Returns the ID of the new insight.

**Request Body:**
```json
{
  "user": "UserID"
}
```

**Success Response Body (Action):**
```json
{
  "insightId": "InsightID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/InsightMining/summarize

**Description:** Generates a summary report based on a user's insights.

**Requirements:**
- The `user` ID must be a valid and existing user.
- The user must have insights to summarize.

**Effects:**
- Creates a new report record summarizing the user's insights.
- Returns the ID of the new report.

**Request Body:**
```json
{
  "user": "UserID"
}
```

**Success Response Body (Action):**
```json
{
  "reportId": "ReportID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/InsightMining/deactivate

**Description:** Deactivates an observation so it's not used in future analyses.

**Requirements:**
- The `observation` ID must be a valid and existing observation.

**Effects:**
- Marks the specified observation as inactive.

**Request Body:**
```json
{
  "observation": "ObservationID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/InsightMining/_getObservationsForUser

**Description:** Retrieves all active observations for a user.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Returns a list of the user's active observation records.

**Request Body:**
```json
{
  "user": "UserID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "ObservationID",
    "content": "string",
    "timestamp": "date"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/InsightMining/_getInsightsForUser

**Description:** Retrieves all insights generated for a user.

**Requirements:**
- The `user` ID must be a valid and existing user.

**Effects:**
- Returns a list of the user's insight records.

**Request Body:**
```json
{
  "user": "UserID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "InsightID",
    "content": "string",
    "basedOn": ["ObservationID"]
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/InsightMining/_getReport

**Description:** Retrieves a specific summary report by its ID.

**Requirements:**
- The `reportId` must be a valid and existing report.

**Effects:**
- Returns the specified report record.

**Request Body:**
```json
{
  "reportId": "ReportID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "ReportID",
    "summary": "string",
    "insights": ["InsightID"]
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
# API Specification: QuickCheckIns Concept

**Purpose:** To allow users to define metrics and record periodic check-ins against them.

---

## API Endpoints

### POST /api/QuickCheckIns/record

**Description:** Records a new check-in for a specific metric.

**Requirements:**
- `owner` ID must be a valid and existing user.
- `metric` name must correspond to a metric defined by the owner.

**Effects:**
- Creates a new check-in record with the given value and notes.
- Returns the ID of the new check-in.

**Request Body:**
```json
{
  "owner": "UserID",
  "metric": "string",
  "value": "number",
  "notes": "string"
}
```

**Success Response Body (Action):**
```json
{
  "checkIn": "CheckInID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/QuickCheckIns/defineMetric

**Description:** Defines a new metric for a user to track.

**Requirements:**
- `owner` ID must be a valid and existing user.
- The metric `name` must not already exist for the user.

**Effects:**
- Creates a new metric definition for the user.
- Returns the ID of the new metric.

**Request Body:**
```json
{
  "owner": "UserID",
  "name": "string",
  "unit": "string"
}
```

**Success Response Body (Action):**
```json
{
  "metric": "MetricID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/QuickCheckIns/edit

**Description:** Edits the value or notes of an existing check-in.

**Requirements:**
- The `checkIn` ID must be a valid and existing check-in.

**Effects:**
- Updates the specified check-in record with the new value and notes.

**Request Body:**
```json
{
  "checkIn": "CheckInID",
  "value": "number",
  "notes": "string"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/QuickCheckIns/delete

**Description:** Deletes a check-in record.

**Requirements:**
- The `checkIn` ID must be a valid and existing check-in.

**Effects:**
- Removes the specified check-in record.

**Request Body:**
```json
{
  "checkIn": "CheckInID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/QuickCheckIns/deleteMetric

**Description:** Deletes a metric definition and all associated check-ins.

**Requirements:**
- The `metric` ID must be a valid and existing metric.

**Effects:**
- Removes the metric definition and all of its associated check-in records.

**Request Body:**
```json
{
  "metric": "MetricID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/QuickCheckIns/_getCheckIn

**Description:** Retrieves a single check-in by its ID.

**Requirements:**
- The `checkIn` ID must be a valid and existing check-in.

**Effects:**
- Returns the specified check-in record.

**Request Body:**
```json
{
  "checkIn": "CheckInID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "CheckInID",
    "metric": "MetricID",
    "value": "number",
    "notes": "string",
    "timestamp": "date"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/QuickCheckIns/_getMetricsByName

**Description:** Retrieves metric definitions for a user by name.

**Requirements:**
- The `owner` ID must be a valid and existing user.

**Effects:**
- Returns a list of metric definitions matching the name for that user.

**Request Body:**
```json
{
  "owner": "UserID",
  "name": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "MetricID",
    "name": "string",
    "unit": "string",
    "owner": "UserID"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/QuickCheckIns/_listCheckInsByOwner

**Description:** Lists all check-ins recorded by a user.

**Requirements:**
- The `owner` ID must be a valid and existing user.

**Effects:**
- Returns a list of all check-in records for the user.

**Request Body:**
```json
{
  "owner": "UserID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "CheckInID",
    "metric": "MetricID",
    "value": "number",
    "notes": "string",
    "timestamp": "date"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
# API Specification: MealLog Concept

**Purpose:** To enable users to log and manage their meals.

---

## API Endpoints

### POST /api/MealLog/submit

**Description:** Submits a new meal entry for a user.

**Requirements:**
- The `owner` ID must be a valid and existing user.

**Effects:**
- Creates a new meal log record.
- Returns the ID of the new meal.

**Request Body:**
```json
{
  "owner": "UserID",
  "description": "string",
  "calories": "number"
}
```

**Success Response Body (Action):**
```json
{
  "meal": "MealID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/MealLog/edit

**Description:** Edits the details of an existing meal log.

**Requirements:**
- The `meal` ID must be a valid and existing meal.

**Effects:**
- Updates the specified meal record with the new description and calories.

**Request Body:**
```json
{
  "meal": "MealID",
  "description": "string",
  "calories": "number"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/MealLog/delete

**Description:** Deletes a meal log entry.

**Requirements:**
- The `meal` ID must be a valid and existing meal.

**Effects:**
- Removes the specified meal record.

**Request Body:**
```json
{
  "meal": "MealID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/MealLog/_getMealById

**Description:** Retrieves a single meal log by its ID.

**Requirements:**
- The `meal` ID must be a valid and existing meal.

**Effects:**
- Returns the specified meal record.

**Request Body:**
```json
{
  "meal": "MealID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "MealID",
    "description": "string",
    "calories": "number",
    "owner": "UserID",
    "timestamp": "date"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/MealLog/_getMealsByOwner

**Description:** Retrieves all meal logs for a specific user.

**Requirements:**
- The `owner` ID must be a valid and existing user.

**Effects:**
- Returns a list of all meal records for the user.

**Request Body:**
```json
{
  "owner": "UserID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "MealID",
    "description": "string",
    "calories": "number",
    "owner": "UserID",
    "timestamp": "date"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/MealLog/_getMealOwner

**Description:** Retrieves the owner of a specific meal log.

**Requirements:**
- The `meal` ID must be a valid and existing meal.

**Effects:**
- Returns the user ID of the meal's owner.

**Request Body:**
```json
{
  "meal": "MealID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "owner": "UserID"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
# API Specification: SwapSuggestions Concept

**Purpose:** To allow users to propose and accept suggestions for swapping one meal with another.

---

## API Endpoints

### POST /api/SwapSuggestions/propose

**Description:** Proposes a swap from an existing meal to a new meal suggestion.

**Requirements:**
- `owner` ID must be a valid and existing user.
- `fromMeal` ID must be a valid meal belonging to the user.

**Effects:**
- Creates a new meal swap proposal in a 'pending' state.
- Returns the ID of the new proposal.

**Request Body:**
```json
{
  "owner": "UserID",
  "fromMeal": "MealID",
  "toMealSuggestion": "string"
}
```

**Success Response Body (Action):**
```json
{
  "proposal": "ProposalID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/SwapSuggestions/accept

**Description:** Accepts a meal swap proposal.

**Requirements:**
- The `proposal` ID must be valid and in a 'pending' state.

**Effects:**
- Marks the proposal as 'accepted'.

**Request Body:**
```json
{
  "proposal": "ProposalID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/SwapSuggestions/_getProposal

**Description:** Retrieves a single swap proposal by its ID.

**Requirements:**
- The `proposal` ID must be a valid and existing proposal.

**Effects:**
- Returns the specified proposal record.

**Request Body:**
```json
{
  "proposal": "ProposalID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "ProposalID",
    "fromMeal": "MealID",
    "toMealSuggestion": "string",
    "status": "string",
    "owner": "UserID"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/SwapSuggestions/_getProposalsByOwner

**Description:** Retrieves all swap proposals for a user.

**Requirements:**
- The `owner` ID must be a valid and existing user.

**Effects:**
- Returns a list of all proposal records for the user.

**Request Body:**
```json
{
  "owner": "UserID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "ProposalID",
    "fromMeal": "MealID",
    "toMealSuggestion": "string",
    "status": "string",
    "owner": "UserID"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

# API Specification: UserAuthentication Concept

**Purpose:** To securely verify a user's identity based on credentials.

***

## API Endpoints

### POST /api/UserAuthentication/register

**Description:** Creates a new user account with a unique username and password.

**Requirements:**
- No user exists with the given `username`.

**Effects:**
- Creates a new User `u`.
- Sets the new user's `username` and a hash of their `password`.
- Returns the ID of the new user `u` as `user`.
- If a user with the given `username` already exists, returns an error message.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response Body (Action):**
```json
{
  "user": "UserID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/UserAuthentication/login

**Description:** Authenticates a user with their username and password.

**Requirements:**
- A user exists with the given `username`.
- The provided `password` matches the user's stored password hash.

**Effects:**
- Returns the matching user's ID.
- If no user exists with the `username` or the `password` does not match, returns an error message.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response Body (Action):**
```json
{
  "user": "UserID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/UserAuthentication/_getUserByUsername

**Description:** Retrieves a user's ID by their username.

**Requirements:**
- A user with the given `username` must exist.

**Effects:**
- Returns the corresponding user's ID.

**Request Body:**
```json
{
  "username": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "user": "UserID"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
***

# API Specification: Sessioning Concept

**Purpose:** To maintain a user's logged-in state across multiple requests without re-sending credentials.

***

## API Endpoints

### POST /api/Sessioning/create

**Description:** Creates a new session for an authenticated user.

**Requirements:**
- A valid `user` ID must be provided.

**Effects:**
- Creates a new session `s`.
- Associates the new session with the given `user`.
- Returns the new session ID `s` as `session`.

**Request Body:**
```json
{
  "user": "UserID"
}
```

**Success Response Body (Action):**
```json
{
  "session": "SessionID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/Sessioning/delete

**Description:** Deletes a session, effectively logging a user out.

**Requirements:**
- The given `session` ID must exist.

**Effects:**
- Removes the specified session `s`.

**Request Body:**
```json
{
  "session": "SessionID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/Sessioning/_getUser

**Description:** Retrieves the user associated with a given session.

**Requirements:**
- The given `session` ID must exist.

**Effects:**
- Returns the user ID associated with the session.

**Request Body:**
```json
{
  "session": "SessionID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "user": "UserID"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
