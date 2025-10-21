import api from './api';

export const CheckInsService = {
  record(payload) {
    return api.post('/QuickCheckIns/record', payload).then(r => r.data);
  },
  defineMetric(payload) {
    return api.post('/QuickCheckIns/defineMetric', payload).then(r => r.data);
  },
  edit(payload) {
    return api.post('/QuickCheckIns/edit', payload).then(r => r.data);
  },
  getCheckIn(payload) {
    return api.post('/QuickCheckIns/_getCheckIn', payload).then(r => r.data);
  },
  getMetricsByName(payload) {
    return api.post('/QuickCheckIns/_getMetricsByName', payload).then(r => r.data);
  },
  listCheckInsByOwner(payload) {
    return api.post('/QuickCheckIns/_listCheckInsByOwner', payload).then(r => r.data);
  },
};
