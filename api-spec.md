Here is the API documentation extracted from the provided Concept Specifications:

---

# API Specification: InsightMining Concept

**Purpose:** detect long-term eating patterns and suggest personalized insights for diet adjustments

---

## API Endpoints

### POST /api/InsightMining/processNewMealLog

**Description:** Processes a new meal log for a user, analyzing their eating patterns and detecting new insights.

**Requirements:**
- mealLog has not been processed for this user

**Effects:**
- adds mealLog to user's processedMeals
- analyzes all processedMeals for user
- if new patterns detected, adds them to user's detectedPatterns and generates suggestedAdjustment

**Request Body:**
```json
{
  "user": "{ID}",
  "mealLog": "{ID}"
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

### POST /api/InsightMining/_getDetectedPatterns

**Description:** Retrieves all detected eating patterns and suggested adjustments for a given user.

**Requirements:**
- user exists

**Effects:**
- returns all detected patterns for the given user, each with its type, description, and suggested adjustment

**Request Body:**
```json
{
  "user": "{ID}"
}
```

**Success Response Body (Query):**
```json
[
  {
    "pattern": {
      "patternType": "string",
      "description": "string",
      "suggestedAdjustment": "string"
    }
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

**Purpose:** suggest healthier or more suitable food swaps for individual meal items, considering dietary preferences and goals

---

## API Endpoints

### POST /api/SwapSuggestions/addFoodToSystem

**Description:** Adds a new food item with its nutritional information, health score, and compatible swaps to the system.

**Requirements:**
- no Food with the given `name` already exists

**Effects:**
- creates a new Food `f`
- sets its properties to the input values
- returns `f` as `food`

**Request Body:**
```json
{
  "name": "string",
  "calories": "number",
  "macronutrients": {
    "carbs": "number",
    "protein": "number",
    "fat": "number"
  },
  "healthScore": "number",
  "compatibleSwaps": ["{ID}"]
}
```

**Success Response Body (Action):**
```json
{
  "food": "{ID}"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/SwapSuggestions/updateFoodInSystem

**Description:** Updates the properties of an existing food item in the system.

**Requirements:**
- food exists

**Effects:**
- updates the properties of `food` with the input values

**Request Body:**
```json
{
  "food": "{ID}",
  "name": "string",
  "calories": "number",
  "macronutrients": {
    "carbs": "number",
    "protein": "number",
    "fat": "number"
  },
  "healthScore": "number",
  "compatibleSwaps": ["{ID}"]
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

### POST /api/SwapSuggestions/_getSuggestedSwaps

**Description:** Retrieves a list of suggested food swaps for a given meal item, based on the user's preferences and dietary goals.

**Requirements:**
- mealItem's food exists and user exists

**Effects:**
- returns a set of `Food` items that are suitable swaps for the `mealItem`'s `food`, considering `user`'s preferences and `dietaryGoals`

**Request Body:**
```json
{
  "user": "{ID}",
  "mealItem": "{ID}"
}
```

**Success Response Body (Query):**
```json
[
  {
    "swap": "{ID}"
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

**Purpose:** allow users to record their daily food intake for tracking and analysis

---

## API Endpoints

### POST /api/MealLog/recordMeal

**Description:** Records a new meal for a user with its date, type, and associated food items.

**Requirements:**
- user exists

**Effects:**
- creates a new MealLog `ml`
- sets its properties to the input values
- adds `ml` to `user`'s `mealLogs`
- returns `ml` as `mealLog`

**Request Body:**
```json
{
  "user": "{ID}",
  "date": "string",
  "mealType": "string",
  "foodItems": [
    {
      "name": "string",
      "calories": "number",
      "macronutrients": {
        "carbs": "number",
        "protein": "number",
        "fat": "number"
      }
    }
  ]
}
```

**Success Response Body (Action):**
```json
{
  "mealLog": "{ID}"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/MealLog/updateMeal

**Description:** Updates the details of an existing meal log.

**Requirements:**
- mealLog exists and belongs to a user

**Effects:**
- updates the properties of `mealLog` with the input values

**Request Body:**
```json
{
  "mealLog": "{ID}",
  "date": "string",
  "mealType": "string",
  "foodItems": [
    {
      "name": "string",
      "calories": "number",
      "macronutrients": {
        "carbs": "number",
        "protein": "number",
        "fat": "number"
      }
    }
  ]
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

### POST /api/MealLog/deleteMeal

**Description:** Deletes an existing meal log from the system and the user's record.

**Requirements:**
- mealLog exists

**Effects:**
- removes `mealLog` from the system and from the associated user's `mealLogs`

**Request Body:**
```json
{
  "mealLog": "{ID}"
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

### POST /api/MealLog/_getMealLogsForUser

**Description:** Retrieves all meal logs for a specified user within a given date range.

**Requirements:**
- user exists

**Effects:**
- returns all meal logs for the given user within the specified date range, each with its date, meal type, and food items

**Request Body:**
```json
{
  "user": "{ID}",
  "startDate": "string",
  "endDate": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "mealLog": {
      "date": "string",
      "mealType": "string",
      "foodItems": [
        {
          "name": "string",
          "calories": "number",
          "macronutrients": {
            "carbs": "number",
            "protein": "number",
            "fat": "number"
          }
        }
      ]
    }
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

# API Specification: PersonalQA Concept

**Purpose:** allow users to ask and answer personal questions about their health, habits, and progress, fostering self-reflection

---

## API Endpoints

### POST /api/PersonalQA/askQuestion

**Description:** Allows a user to ask a new personal question.

**Requirements:**
- user exists

**Effects:**
- creates a new Question `q`
- sets `q`'s `user` to `user`, `text` to `text`, and `timestamp` to current time
- adds `q` to `user`'s `questions`
- returns `q` as `question`

**Request Body:**
```json
{
  "user": "{ID}",
  "text": "string"
}
```

**Success Response Body (Action):**
```json
{
  "question": "{ID}"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/PersonalQA/answerQuestion

**Description:** Provides an answer to an existing personal question.

**Requirements:**
- question exists and has no answer yet

**Effects:**
- sets `question`'s `answer` to `answer` and `answerTimestamp` to current time

**Request Body:**
```json
{
  "question": "{ID}",
  "answer": "string"
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

### POST /api/PersonalQA/_getQuestionsForUser

**Description:** Retrieves all personal questions asked by a user, along with their answers and timestamps if available.

**Requirements:**
- user exists

**Effects:**
- returns all questions asked by the `user`, each with its text, timestamps, and answer if available

**Request Body:**
```json
{
  "user": "{ID}"
}
```

**Success Response Body (Query):**
```json
[
  {
    "question": {
      "text": "string",
      "timestamp": "string",
      "answer": "string | null",
      "answerTimestamp": "string | null"
    }
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

**Purpose:** enable users to quickly log their current mood, energy levels, or other simple metrics for a rapid overview of their well-being

---

## API Endpoints

### POST /api/QuickCheckIns/recordCheckIn

**Description:** Records a quick check-in for a user, logging their current mood, energy level, and any notes.

**Requirements:**
- user exists

**Effects:**
- creates a new CheckIn `ci`
- sets `ci`'s `user` to `user`, `mood` to `mood`, `energyLevel` to `energyLevel`, `notes` to `notes`, and `timestamp` to current time
- adds `ci` to `user`'s `checkIns`
- returns `ci` as `checkIn`

**Request Body:**
```json
{
  "user": "{ID}",
  "mood": "string",
  "energyLevel": "number",
  "notes": "string"
}
```

**Success Response Body (Action):**
```json
{
  "checkIn": "{ID}"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/QuickCheckIns/_getCheckInsForUser

**Description:** Retrieves all quick check-ins for a specified user within a given date range.

**Requirements:**
- user exists

**Effects:**
- returns all check-ins for the given user within the specified date range, each with its timestamp, mood, energy level, and notes

**Request Body:**
```json
{
  "user": "{ID}",
  "startDate": "string",
  "endDate": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "checkIn": {
      "timestamp": "string",
      "mood": "string",
      "energyLevel": "number",
      "notes": "string"
    }
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
