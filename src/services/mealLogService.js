import api from './api';

export const MealLogService = {
  submit(payload) {
    const ownerId = (payload?.owner ?? payload?.user ?? payload?.ownerId);
    const body = {
      ...payload,
      owner: ownerId ? { id: ownerId } : payload.owner,
      ownerId: ownerId,
      user: ownerId,
    };
    return api.post('/MealLog/submit', body).then(r => r.data);
  },
  edit(payload) {
    const ownerId = (payload?.owner ?? payload?.user ?? payload?.ownerId);
    const body = {
      ...payload,
      owner: ownerId ? { id: ownerId } : payload.owner,
      ownerId: ownerId,
      user: ownerId,
    };
    return api.post('/MealLog/edit', body).then(r => r.data);
  },
  delete(payload) {
    const ownerId = (payload?.owner ?? payload?.user ?? payload?.ownerId);
    const body = {
      ...payload,
      owner: ownerId ? { id: ownerId } : payload.owner,
      ownerId: ownerId,
      user: ownerId,
    };
    return api.post('/MealLog/delete', body).then(r => r.data);
  },
  getMealsForOwner(payload) {
    return api.post('/MealLog/getMealsForOwner', payload).then(r => r.data);
  },
  getMealById(payload) {
    return api.post('/MealLog/getMealById', payload).then(r => r.data);
  },
};
