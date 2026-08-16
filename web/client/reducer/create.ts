import { applyMiddleware, createStore as createReduxStore } from 'redux';
import type { Store } from 'redux';
import promiseMiddleware from 'redux-promise';

import messageMiddleware from './middleware/messageMiddleware';
import rootReducer from './modules/reducer';
import type { RootState } from './modules/reducer';
import type { DeepPartial } from './types/runtime';

export type AppStore = Store<RootState>;

type ReducerHotModule = typeof rootReducer | { default?: typeof rootReducer };
interface ReducerHotContext {
  accept(path: string, callback: (module: ReducerHotModule | undefined) => void): void;
}

export default function createStore(initialState: DeepPartial<RootState> = {}): AppStore {
  const finalCreateStore = applyMiddleware(promiseMiddleware, messageMiddleware)(createReduxStore);
  const store = finalCreateStore(rootReducer, initialState as RootState);

  const hot = (import.meta as ImportMeta & { hot?: ReducerHotContext }).hot;
  if (hot) {
    hot.accept('./modules/reducer', mod => {
      const nextReducer = (
        mod && (typeof mod === 'function' ? mod : mod.default || mod)
      ) || rootReducer;
      store.replaceReducer(nextReducer as typeof rootReducer);
    });
  }

  return store;
}
