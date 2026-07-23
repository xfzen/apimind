import { createStore as _createStore, applyMiddleware } from 'redux';
import promiseMiddleware from 'redux-promise';
import messageMiddleware from './middleware/messageMiddleware';
import reducer from './modules/reducer';

export default function createStore(initialState = {}) {
  const middleware = [promiseMiddleware, messageMiddleware];

  let finalCreateStore;
  //if (process.env.NODE_ENV === 'production') {
  finalCreateStore = applyMiddleware(...middleware)(_createStore);
  // } else {
  //   finalCreateStore = compose(
  //     applyMiddleware(...middleware),
  //     window.devToolsExtension ? window.devToolsExtension() : require('../containers/DevTools/DevTools').instrument()
  //   )(_createStore);
  // }

  const store = finalCreateStore(reducer, initialState);

  // Enable Vite HMR for reducers to preserve state on edits
  if (import.meta && import.meta.hot) {
    import.meta.hot.accept('./modules/reducer', (mod) => {
      const nextReducer = (mod && (mod.default || mod)) || reducer;
      store.replaceReducer(nextReducer);
    });
  }

  return store;
}
