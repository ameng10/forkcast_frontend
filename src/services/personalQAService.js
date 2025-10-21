import api from './api';

export const PersonalQAService = {
  ingestFact(payload) {
    return api.post('/PersonalQA/ingestFact', payload).then(r => r.data);
  },
  forgetFact(payload) {
    return api.post('/PersonalQA/forgetFact', payload).then(r => r.data);
  },
  ask(payload) {
    // Ensure backends expecting different key names still receive the text
    const text = payload?.text ?? payload?.question ?? payload?.query ?? payload?.prompt;
    const body = {
      user: payload.user,
      text,
      question: text,
      query: text,
      prompt: text,
    };
    return api.post('/PersonalQA/ask', body).then(r => r.data);
  },
  getUserFacts(payload) {
    return api.post('/PersonalQA/_getUserFacts', payload).then(r => r.data);
  },
  getUserQAs(payload) {
    return api.post('/PersonalQA/_getUserQAs', payload).then(r => r.data);
  },
};
