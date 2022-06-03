import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  settings: {}
};

// Get All Generic App Settings
export const getAppSettings = createAsyncThunk("electron/getAppSettings", async (_, thunkAPI) => {
  try {
    return await window.ipcRenderer.invoke("generalInvoke", {action: "getAppSettings"});
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

// For Use With Boolean Stuff (Essentially toggle)
export const toggleAppSetting = createAsyncThunk("electron/toggleAppSetting", async (setting, thunkAPI) => {
  try {
    return await window.ipcRenderer.invoke("generalInvoke", {action: "toggleAppSetting", payload: setting});
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

// For Getting Single Value
export const getAppSetting = createAsyncThunk("electron/getAppSetting", async (setting, thunkAPI) => {
  try {
    return await window.ipcRenderer.invoke("generalInvoke", {action: "getAppSetting", payload: setting});
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

// For Use With Settable Settings (Int, String, Etc.)
// Expected Object {setting: string, value: any}
export const setAppSetting = createAsyncThunk("electron/setAppSetting", async (settingObj, thunkAPI) => {
  try {
    return await window.ipcRenderer.invoke("generalInvoke", {action: "setAppSetting", payload: {setting: settingObj['setting'], value: settingObj['value']}});
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

// Redux Slice
export const electronSlice = createSlice({
  name: 'electron',
  initialState,
  reducers: {
  
  },
  extraReducers: (builder) => {
    // Get App Settings
    builder.addCase(getAppSettings.fulfilled, (state, response) => {
      state.settings = response?.payload?.response;
    });
    builder.addCase(getAppSettings.rejected, (state, response) => {
      state.settings = null;
    });
    
    // Toggle App Setting
    builder.addCase(toggleAppSetting.fulfilled, (state, response) => {
      state.settings[response?.payload?.setting] = response?.payload?.value;
    });
    builder.addCase(toggleAppSetting.rejected, (state, response) => {
      console.error("TODO", "toggleAppSetting", response)
    });
  
    // Get App Setting
    builder.addCase(getAppSetting.fulfilled, (state, response) => {
      console.log("TODO", "getAppSetting", response);
    });
    builder.addCase(getAppSetting.rejected, (state, response) => {
      console.error("TODO", "getAppSetting", response)
    });
  
    // Set App Setting
    builder.addCase(setAppSetting.fulfilled, (state, response) => {
      state.settings[response?.payload?.setting] = response?.payload?.value;
      
      if(response?.payload?.setting === "appLang") {
        window.i18n.setLang(response?.payload?.value);
      }
    });
    builder.addCase(setAppSetting.rejected, (state, response) => {
      console.error("TODO", "setAppSetting", response)
    });
  }
});

export const { } = electronSlice.actions;
export default electronSlice.reducer;