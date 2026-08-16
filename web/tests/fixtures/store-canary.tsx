import createStore from '../../client/reducer/create';

const container = document.getElementById('canary');

if (!container) {
  throw new Error('Missing #canary container');
}

const store = createStore();
const keys = Object.keys(store.getState()).sort();
container.dataset.testid = 'store-keys';
container.textContent = keys.join(',');
