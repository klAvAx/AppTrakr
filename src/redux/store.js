import { configureStore } from "@reduxjs/toolkit";

import electronReducer from './reducers/electron';
import simpleDataListReducer from './reducers/simpleDataList';
import processReducer from './reducers/processList';
import UIReducer from "./reducers/UI";

export const store = configureStore({
  reducer: {
    UI: UIReducer,
    electron: electronReducer,
    simpleDataList: simpleDataListReducer,
    process: processReducer
  },
});