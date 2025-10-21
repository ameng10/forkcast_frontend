Updated API endpoints (from backend scan) and minimal payload examples:

---

# PersonalQA
Base: /api/PersonalQA

- POST /api/PersonalQA/ingestFact
  - Body: { "user": "{ID}", "fact": { ... } } | for answers: { "user": "{ID}", "question": "{ID}", "answer": "string" }
  - Resp: {}
- POST /api/PersonalQA/forgetFact
  - Body: { "user": "{ID}", "factId": "{ID}" }
  - Resp: {}
- POST /api/PersonalQA/ask
  - Body: { "user": "{ID}", "text": "string" }
  - Resp: { "question": "{ID}" }
- POST /api/PersonalQA/_getUserFacts
  - Body: { "user": "{ID}" }
  - Resp: [ { "fact": { ... } } ]
- POST /api/PersonalQA/_getUserQAs
  - Body: { "user": "{ID}" }
  - Resp: [ { "question": { "text": "string", "timestamp": "string", "answer": "string|null", "answerTimestamp": "string|null" } } ]

---

# InsightMining
Base: /api/InsightMining

- POST /api/InsightMining/ingest
  - Body: { "user": "{ID}", "mealLog": "{ID}" }
  - Resp: {}
- POST /api/InsightMining/analyze
  - Body: { "user": "{ID}" }
  - Resp: {}
- POST /api/InsightMining/summarize
  - Body: { "user": "{ID}" }
  - Resp: { "summary": "string" }
- POST /api/InsightMining/deactivate
  - Body: { "user": "{ID}", "insightId": "{ID}" }
  - Resp: {}
- POST /api/InsightMining/_getObservationsForUser
  - Body: { "user": "{ID}" }
  - Resp: [ { "observation": { ... } } ]
- POST /api/InsightMining/_getInsightsForUser
  - Body: { "user": "{ID}" }
  - Resp: [ { "insight": { "type": "string", "description": "string", "suggestedAdjustment": "string" } } ]
- POST /api/InsightMining/_getReport
  - Body: { "user": "{ID}" }
  - Resp: { "report": { ... } }

---

# QuickCheckIns
Base: /api/QuickCheckIns

- POST /api/QuickCheckIns/record
  - Body: { "owner": "{ID}", "mood": "string", "energyLevel": "number", "notes": "string" }
  - Resp: { "checkIn": "{ID}" }
- POST /api/QuickCheckIns/defineMetric
  - Body: { "owner": "{ID}", "name": "string", "type": "string" }
  - Resp: {}
- POST /api/QuickCheckIns/edit
  - Body: { "checkIn": "{ID}", ... }
  - Resp: {}
- POST /api/QuickCheckIns/_getCheckIn
  - Body: { "checkIn": "{ID}" }
  - Resp: { "checkIn": { ... } }
- POST /api/QuickCheckIns/_getMetricsByName
  - Body: { "owner": "{ID}", "name": "string" }
  - Resp: [ { "metric": { ... } } ]
- POST /api/QuickCheckIns/_listCheckInsByOwner
  - Body: { "owner": "{ID}", "startDate": "string", "endDate": "string" }
  - Resp: [ { "checkIn": { "timestamp": "string", "mood": "string", "energyLevel": "number", "notes": "string" } } ]

---

# LikertSurvey
Base: /api/LikertSurvey

- POST /api/LikertSurvey/createSurvey
- POST /api/LikertSurvey/addQuestion
- POST /api/LikertSurvey/submitResponse
- POST /api/LikertSurvey/updateResponse
- POST /api/LikertSurvey/_getSurveyQuestions
- POST /api/LikertSurvey/_getSurveyResponses
- POST /api/LikertSurvey/_getRespondentAnswers

---

# MealLog
Base: /api/MealLog

- POST /api/MealLog/connect
  - Body: { "owner": "{ID}" }
  - Resp: {}
- POST /api/MealLog/disconnect
  - Body: { "owner": "{ID}" }
  - Resp: {}
- POST /api/MealLog/getCollection
  - Body: { "owner": "{ID}" }
  - Resp: [ { ... } ]
- POST /api/MealLog/_getMealDocumentById
  - Body: { "mealId": "{ID}" }
  - Resp: { ... }
- POST /api/MealLog/_getMealObjectById
  - Body: { "mealId": "{ID}" }
  - Resp: { ... }
- POST /api/MealLog/submit
  - Body: { "owner": "{ID}", "date": "string", "mealType": "string", "foodItems": [ { "name": "string", "calories": "number", "macronutrients": { "carbs": "number", "protein": "number", "fat": "number" } } ] }
  - Resp: { "mealId": "{ID}" }
- POST /api/MealLog/edit
  - Body: { "mealId": "{ID}", ... }
  - Resp: {}
- POST /api/MealLog/delete
  - Body: { "mealId": "{ID}" }
  - Resp: {}
- POST /api/MealLog/getMealsForOwner
  - Body: { "owner": "{ID}", "startDate": "string", "endDate": "string" }
  - Resp: [ { "mealLog": { "id": "{ID}", "date": "string", "mealType": "string", "foodItems": [ ... ] } } ]
- POST /api/MealLog/getMealById
  - Body: { "mealId": "{ID}" }
  - Resp: { "mealLog": { ... } }
