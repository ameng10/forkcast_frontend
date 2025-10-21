import api from './api';

export const SwapService = {
  propose(payload) {
    return api.post('/SwapSuggestions/propose', payload).then(r => r.data);
  },
  accept(payload) {
    return api.post('/SwapSuggestions/accept', payload).then(r => r.data);
  },
  getProposal(payload) {
    return api.post('/SwapSuggestions/_getProposal', payload).then(r => r.data);
  },
  getProposalsByOwner(payload) {
    return api.post('/SwapSuggestions/_getProposalsByOwner', payload).then(r => r.data);
  },
};
