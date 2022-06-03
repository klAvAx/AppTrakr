import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const initialState = {
  running: [],
  statistics: []
};

export const requestNewStatisticsList = createAsyncThunk("processes/requestNewStatisticsList", async (_, thunkAPI) => {
  try {
    return await window.ipcRenderer.invoke("generalInvoke", {action: "requestNewStatisticsList"});
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

export const processSlice = createSlice({
  name: 'processes',
  initialState,
  reducers: {
    updateRunningList: (state, data) => {
      state.running = data.payload;
    },
    updateStatisticsList: (state, data) => {
      state.statistics = data.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(requestNewStatisticsList.fulfilled, (state, response) => {
      state.statistics = response.payload;
    });
  }
});

export const { updateRunningList, updateStatisticsList } = processSlice.actions;
export default processSlice.reducer;