import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {

};

// Get All Data of Type
export const getDataOfType = createAsyncThunk("simpleDataList/getDataOfType", async (data, thunkAPI) => {
  try {
    const ipc = await window.ipcRenderer.invoke("generalInvoke", {action: "getDataOfType", payload: data});
    
    if(ipc.response?.type === "error") {
      return thunkAPI.rejectWithValue(ipc.response);
    }
    
    return ipc;
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

// Set Data
export const setData = createAsyncThunk("simpleDataList/setData", async (data, thunkAPI) => {
  try {
    const ipc = await window.ipcRenderer.invoke("generalInvoke", {action: "setData", payload: data});
  
    if(ipc.response?.type === "error") {
      return thunkAPI.rejectWithValue(ipc.response);
    }
  
    return ipc;
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

// Delete Data
export const deleteData = createAsyncThunk("simpleDataList/deleteData", async (data, thunkAPI) => {
  try {
    const ipc = await window.ipcRenderer.invoke("generalInvoke", {action: "deleteData", payload: data});
  
    if(ipc.response?.type === "error") {
      return thunkAPI.rejectWithValue(ipc.response);
    }
  
    return ipc;
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

// Redux Slice
export const simpleDataListSlice = createSlice({
  name: 'simpleDataList',
  initialState,
  reducers: {
  
  },
  extraReducers: (builder) => {
    // Get All Data of Type
    builder.addCase(getDataOfType.fulfilled, (state, response) => {
      state[response.payload.request.payload.type] = response?.payload?.response;
    });
    builder.addCase(getDataOfType.rejected, (state, response) => {
      state[response.meta.arg.type] = [];
    });
  
    // Set Data
    builder.addCase(setData.fulfilled, (state, response) => {
      if(!Object.keys(response.payload.request.payload.data).includes("id")) {
        state[response.payload.request.payload.type].push({
          id: response.payload.response[0],
          ...response.payload.request.payload.data
        });
      } else {
        let index = state[response.payload.request.payload.type].findIndex((item) => item.id === response.payload.request.payload.data.id);
        
        state[response.payload.request.payload.type][index] = response.payload.request.payload.data;
      }
    });
  
    // Delete Data
    builder.addCase(deleteData.fulfilled, (state, response) => {
      if(response.payload.response) {
        state[response.payload.request.payload.type] = state[response.payload.request.payload.type].filter((item) => item.id !== response.payload.request.payload.itemID);
      }
    });
  }
});

export const { } = simpleDataListSlice.actions;
export default simpleDataListSlice.reducer;