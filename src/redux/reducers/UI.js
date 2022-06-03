import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { requestNewStatisticsList } from "./processList";

const initialState = {
  notification: {
    message: "",
    translatable: true,
    bottomOffset: 0,
    args: []
  },
  backdrop: {
    visible: false,
    wantsToClose: false
  },
  header: {
    recordButtonDisabled: false
  },
  collapsed: {
  
  },
  expanded: {
  
  }
};

export const setGroupOffset = createAsyncThunk("ui/setGroupOffset", async (offset, thunkAPI) => {
  try {
    let response = await window.ipcRenderer.invoke("generalInvoke", {action: "setGroupOffset", payload: offset});
    
    if(typeof response.response === "number" && response.response === 1) {
      thunkAPI.dispatch(requestNewStatisticsList());
    } else {
      console.log("Async", typeof response.response, response.response);
    }
    
    return response;
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

export const deleteGroupData = createAsyncThunk("ui/deleteGroupData", async (groupID, thunkAPI) => {
  try {
    return await window.ipcRenderer.invoke("generalInvoke", {action: "deleteGroupData", payload: groupID});
  } catch (error) {
    return thunkAPI.rejectWithValue({ error: error.message });
  }
});

export const UISlice = createSlice({
  name: 'UI',
  initialState,
  reducers: {
    setNotification: (state, data) => {
      if(typeof data.payload === "string") {
        state.notification.message = data.payload;
      } else {
        if(!Object.keys(data.payload).includes("translatable")) {
          data.payload['translatable'] = true;
        }
        if(!Object.keys(data.payload).includes("bottomOffset")) {
          data.payload['bottomOffset'] = 0;
        }
        if(!Object.keys(data.payload).includes("args") || !data.payload['translatable']) {
          data.payload['args'] = [];
        }
        
        state.notification = data.payload;
      }
    },
    resetNotification: (state) => {
      state.notification = {
        message: "",
        translatable: true,
        bottomOffset: 0,
        args: []
      };
    },
    
    toggleBackdrop: (state, data) => {
      state.backdrop.wantsToClose = false;
      
      if(data.payload !== undefined) {
        state.backdrop.visible = data.payload;
        return
      }
      
      state.backdrop.visible = !state.backdrop.visible;
    },
    shouldCloseBackdrop: (state) => {
      state.backdrop.wantsToClose = true;
    },
    
    disableRecordButton: (state) => {
      state.header.recordButtonDisabled = true;
    },
    enableRecordButton: (state) => {
      state.header.recordButtonDisabled = false;
    },
    
    toggleCollapsed: (state, data) => {
      if(data.payload?.group !== undefined && data.payload?.key !== undefined) {
        const { group, key } = data.payload;
        
        if (state.collapsed[group] === undefined) state.collapsed[group] = {};
        
        state.collapsed[group][key] = (state.collapsed[group][key] === undefined ? true : !state.collapsed[group][key]);
      }
    },
    toggleExpanded: (state, data) => {
      console.log("toggleExpanded", state, data);
    }
  },
  extraReducers: (builder) => {
    // Set Group Offset
    builder.addCase(setGroupOffset.fulfilled, (state, response) => {
      //console.log(state, response);
    });
    builder.addCase(setGroupOffset.rejected, (state, response) => {
      console.error("TODO", "setGroupOffset", response);
    });
    
    // Delete Group Offset
    builder.addCase(deleteGroupData.fulfilled, (state, response) => {
      //console.log(state, response);
    });
    builder.addCase(deleteGroupData.rejected, (state, response) => {
      console.error("TODO", "deleteGroupData", response);
    });
  }
});

export const {
  setNotification, resetNotification,
  toggleBackdrop, shouldCloseBackdrop,
  disableRecordButton, enableRecordButton,
  toggleCollapsed, toggleExpanded
} = UISlice.actions;
export default UISlice.reducer;