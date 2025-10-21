import api from './api';

export const InsightService = {
  ingest(payload) {
    return api.post('/InsightMining/ingest', payload).then(r => r.data);
  },
  analyze(payload) {
    return api.post('/InsightMining/analyze', payload).then(r => r.data);
  },
  summarize(payload) {
    return api.post('/InsightMining/summarize', payload).then(r => r.data);
  },
  deactivate(payload) {
    return api.post('/InsightMining/deactivate', payload).then(r => r.data);
  },
  getObservationsForUser(payload) {
    return api.post('/InsightMining/_getObservationsForUser', payload).then(r => r.data);
  },
  getInsightsForUser(payload) {
    return api.post('/InsightMining/_getInsightsForUser', payload).then(r => r.data);
  },
  getReport(payload) {
    return api.post('/InsightMining/_getReport', payload).then(r => r.data);
  },
};
