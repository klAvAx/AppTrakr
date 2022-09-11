'use strict';

const { app, Menu, Tray, ipcMain, BrowserWindow, screen, shell, nativeTheme } = require('electron');
const os = require("os");
const fs = require("fs");
const url = require("url");
const util = require("util");
const path = require("path");
const config = require(path.join(__dirname, "package.json"));

const contextMenu = require("electron-context-menu");
const isDev = require("electron-is-dev");
const Store = require("electron-store");
const settings = new Store({ name: "Settings" });

const DiscordRPC = require("discord-rpc");
const DiscordAID = "...Discord Application ID...";

// Setup App Directory
if (!fs.existsSync(path.join(app.getPath("documents"), config.title)) || !fs.existsSync(path.join(app.getPath("documents"), config.title, "languages"))) {
  if(!fs.existsSync(path.join(app.getPath("documents"), config.title))) {
    fs.mkdirSync(path.join(app.getPath("documents"), config.title));
  }
  
  if (!fs.existsSync(path.join(app.getPath("documents"), config.title, "languages")) && !isDev) {
    fs.mkdirSync(path.join(app.getPath("documents"), config.title, "languages"));
    
    let files = fs.readdirSync(path.join(__dirname, 'ElectronLibs', 'translations'));
    
    for(const file of files) {
      if(file.endsWith(".json")) {
        fs.copyFileSync(
          path.join(__dirname, 'ElectronLibs', 'translations', file),
          path.join(app.getPath("documents"), config.title, "languages", file)
        );
      }
    }
  }
} else {
  // Update Lang files if they are newer
  let files = fs.readdirSync(path.join(__dirname, 'ElectronLibs', 'translations'));
  for(const file of files) {
    if(file.endsWith(".json")) {
      let sourcePath = path.join(__dirname, 'ElectronLibs', 'translations', file);
      let targetPath = path.join(app.getPath("documents"), config.title, "languages", file);
      
      if(fs.statSync(sourcePath).mtimeMs > fs.statSync(targetPath).mtimeMs) {
        fs.copyFileSync(
          path.join(__dirname, 'ElectronLibs', 'translations', file),
          path.join(app.getPath("documents"), config.title, "languages", file)
        );
      }
    }
  }
}

// Init App Database
const knex = require('knex')({
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: path.join(app.getPath("documents"), config.title, "data.db")
  }
});
knex.raw('PRAGMA foreign_keys = ON').then(() => {
  if (isDev) console.log(`Foreign Key Check Activated`);
});

// Keep some global references of objects.
let i18n, tray, trayWindow, processList;
let discordClient, settingsDiscordEnabled, discordTimer, discordActivitySet;

// Init Settings
let appIsPinned = false;
initSettings();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
const singleLock = app.requestSingleInstanceLock();

if (!singleLock) {
  app.quit();
} else {
  app.on('second-instance', function (event, commandLine, workingDirectory) {
    if (trayWindow) {
      trayWindow.show();
    }
  });
  
  app.on('ready', function () {
    // Init i18n
    i18n = new (require('./ElectronLibs/translations/i18n'))({
      lang: settings.get('app.lang', 'sys'),
      dir: isDev ? null : path.join(app.getPath("documents"), config.title, "languages")
    });
    
    // Ready
    if(isDev) {
      console.log('[main.js]', 'App is Ready, Creating Windows...');
    }
    
    // Create Windows
    createTray();
    createTrayWindow();
    
    // Begin Process List Watching
    processList = new (require('./ElectronLibs/processList/processList'))({
      initialDelay: settings.get('app.processListInitial', 5),
      recurringDelay: settings.get('app.processListRecurring', 1)
    });
    
    processList.once("ListUpdate", async () => {
      await sendStatisticsUpdate();
    });
    
    processList.on("ListUpdate", (list) => {
      trayWindow.webContents.send("electron", { type: "runningListUpdate", payload: list });
    });
    
    processList.on("AddedToList", async (added) => {
      if(isDev) {
        console.log("Added", new Date().getTime(), added);
      }
      startRecording(added).then(async () => {
        await sendStatisticsUpdate();
      });
    });
    
    processList.on("RemovedFromList", async (removed) => {
      if(isDev) {
        console.log("Removed", new Date().getTime(), removed);
      }
      if(settings.get('app.recordingProcesses', false)) {
        const timestamp = new Date().getTime();
        const rules = await knex.select('id', 'group_id', 'rule', 'type').from('rules');
        
        if(rules.length > 0) {
          for(const process of removed) {
            for(const rule of rules) {
              switch (rule.type) {
                case 'exec': {
                  if (process.Executable === rule.rule) {
                    await markAsStoppedDB(timestamp, rule, process);
                  }
                  break;
                }
                case 'rule': {
                  let regexp = new RegExp(rule.rule);
                  if(regexp.test(process.WindowTitle)) {
                    await markAsStoppedDB(timestamp, rule, process);
                  }
                  break;
                }
                default:
                  if (isDev) {
                    console.error(`Rule Type (${rule.type}) not yet implemented`);
                  }
                  break;
              }
            }
          }
          await sendStatisticsUpdate();
        }
      }
    });
    
    processList.on("TitleChanged", async (newTitles, oldTitles) => {
      if(isDev) {
        console.log("Changed", new Date().getTime(), newTitles, oldTitles);
      }
      if(settings.get('app.recordingProcesses', false)) {
        const timestamp = new Date().getTime();
        const rules = await knex.select('id', 'group_id', 'rule', 'type').from('rules');
        
        if(rules.length > 0) {
          for(const process of newTitles) {
            let prevProcess = oldTitles.filter((x) => x.Id === process.Id)[0];
            for(const rule of rules) {
              switch(rule.type) {
                case 'exec': {
                  const db = await knex
                    .select('id', 'processMeta', 'started_at')
                    .whereRaw('json_extract(statistics.processMeta, \'$.PID\') = ?', process.Id)
                    .andWhereRaw('json_extract(statistics.processMeta, \'$.OS.StartTime\') = ?', process.StartTime)
                    .andWhereRaw('json_extract(statistics.processMeta, \'$.Rule.Type\') = ?', rule.type)
                    .andWhereRaw('json_extract(statistics.processMeta, \'$.Rule.Rule\') = ?', rule.rule)
                    .andWhere('stopped_at', null)
                    .from('statistics');
  
                  if(db.length > 0) {
                    if (process.Executable === rule.rule) {
                      await processDataUpdate(timestamp, db, process);
                    }
                  }
                  break;
                }
                case 'rule': {
                  let regexp = new RegExp(rule.rule);
                  
                  const db = await knex
                    .select('id', 'processMeta', 'started_at')
                    .whereRaw('json_extract(statistics.processMeta, \'$.PID\') = ?', process.Id)
                    .andWhereRaw('json_extract(statistics.processMeta, \'$.OS.StartTime\') = ?', process.StartTime)
                    .andWhereRaw('json_extract(statistics.processMeta, \'$.Rule.Type\') = ?', rule.type)
                    .andWhereRaw('json_extract(statistics.processMeta, \'$.Rule.Rule\') = ?', rule.rule)
                    .andWhere('stopped_at', null)
                    .from('statistics');
                  
                  if(db.length > 0) {
                    if (regexp.test(process.WindowTitle)) {
                      await processDataUpdate(timestamp, db, process);
                    } else {
                      if (regexp.test(prevProcess.WindowTitle)) {
                        await markAsStoppedDB(timestamp, rule, prevProcess);
                      }
                    }
                  } else {
                    if (regexp.test(process.WindowTitle)) {
                      await addToDB(timestamp, rule, process);
                    }
                  }
                  break;
                }
                default:
                  if (isDev) {
                    console.error(`Rule Type (${rule.type}) not yet implemented`);
                  }
                  break;
              }
            }
          }
          await sendStatisticsUpdate();
        }
      }
    });
  });
}

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with CMD + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (trayWindow === null) {
    createTrayWindow();
  }
});

app.on('before-quit', async function (event) {
  if (app.isQuiting) {
    event.preventDefault();
    
    // Stop Recording if Recording
    if (settings.get('app.recordingProcesses', false)) {
      await stopRecording();
    }
    
    app.exit();
  }
});

// Rest of the APP

function createTray() {
  tray = new Tray(
    settings.get("app.recordingProcesses", false) ?
      path.join(__dirname, 'assets', 'img', (nativeTheme.shouldUseDarkColors ? 'tray_64x64_rec.png' : 'tray_64x64_black_rec.png')) :
      path.join(__dirname, 'assets', 'img', (nativeTheme.shouldUseDarkColors ? 'tray_64x64.png' : 'tray_64x64_black.png'))
  );
  
  // Context Menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: i18n.__('tray_menu_show_app', 'Show App'),
      click: function () {
        toggleTray();
      }
    },
    {
      label: i18n.__('tray_menu_quit', 'Quit'),
      click: function () {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.on('click', function () {
    toggleTray();
  });
  
  tray.setToolTip(config.title);
  tray.setContextMenu(contextMenu);
  
  if(isDev) {
    console.log('[main.js]', '[createTray]', 'Tray Created & Ready.');
  }
}

function createTrayWindow() {
  // Create the browser window.
  trayWindow = new BrowserWindow({
    width: settings.get('app.trayWindow.width', 600),
    minWidth: 600,
    maxWidth: 1000,
    height: settings.get('app.trayWindow.height', 600),
    minHeight: 600,
    title: config.title,
    movable: true,
    show: false,
    frame: false,
    alwaysOnTop: true,
    fullscreenable: false,
    resizable: true,
    skipTaskbar: true,
    focusable: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'assets', 'js', 'preload.js'),
      sandbox: true,
      contextIsolation: true
    }
  });
  
  contextMenu({ window: trayWindow });
  
  if (isDev) {
    // Load Entry Point Page of the APP
    trayWindow.loadURL('http://localhost:3000');
    
    // Load Extensions
    const { default: installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = require("electron-devtools-installer");
    
    installExtension(REACT_DEVELOPER_TOOLS)
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.error('An error occurred: ', err));
    installExtension(REDUX_DEVTOOLS)
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.error('An error occurred: ', err));
  } else {
    // Load Entry Point Page of the APP
    trayWindow.loadFile(path.join(__dirname, 'ui', 'build', 'index.html'));
  }
  
  // While loading the page, the ready-to-show event will be emitted
  // when the renderer process has rendered the page for the first time
  // if the window has not been shown yet.
  trayWindow.once('ready-to-show', function () {
    if (isDev) {
      console.log('[main.js]', '[createTrayWindow]', '[onceReady-to-show]', 'Ready To Show.');
      
      // Show Window
      toggleTray();
      
      // Open Dev Tools
      trayWindow.webContents.openDevTools();
    }
  });
  
  trayWindow.on('show', function () {
    if(isDev) {
      console.log('[main.js]', '[createTrayWindow]', '[onShow]', 'Window SHOW');
    }
  });
  
  trayWindow.on('hide', function () {
    if(isDev) {
      console.log('[main.js]', '[createTrayWindow]', '[onHide]', 'Window HIDE');
    }
  });
  
  trayWindow.on('blur', function () {
    if (!trayWindow.webContents.isDevToolsOpened() && !appIsPinned) {
      trayWindow.hide();
    }
  });
  
  trayWindow.on('resized', () => {
    let bounds = trayWindow.getBounds();
    
    settings.set('app.trayWindow.width', bounds.width - 1);
    settings.set('app.trayWindow.height', bounds.height);
  });
  
  if(isDev) {
    console.log('[main.js]', '[createTrayWindow]', 'Window Created & Ready.');
  }
}

/* <editor-fold desc="* Async Functions *"> */
/*******************
 * Async Functions *
 *******************/
ipcMain.on('trayWindow', function (event, data) {
  switch (data.action) {
    case "reload": {
      trayWindow.webContents.reload();
      break;
    }
    case "openDevTools": {
      trayWindow.webContents.openDevTools();
      break;
    }
    case "zoomIn": {
      let zoom = trayWindow.webContents.getZoomLevel();
      zoom += 1;
      trayWindow.webContents.setZoomLevel(zoom);
      break;
    }
    case "zoomOut": {
      let zoom = trayWindow.webContents.getZoomLevel();
      zoom -= 1;
      trayWindow.webContents.setZoomLevel(zoom);
      break;
    }
    case "zoomReset": {
      trayWindow.webContents.setZoomLevel(0);
      break;
    }
    default: {
      if(isDev) {
        console.log('[main.js]', '[ipcMain]', '[onTrayWindow]', data);
      }
      break;
    }
  }
});
ipcMain.handle('i18n', function (event, data) {
  switch (data.action) {
    case 'translate': {
      return i18n.__(data.key, data.value);
    }
    case 'getLangList': {
      return i18n.getLangList();
    }
    default: {
      if(isDev) {
        console.log('[main.js]', '[ipcMain]', '[onI18N]', data);
        return "???";
      }
    }
  }
});
ipcMain.on('general', function (event, data) {
  switch (data.action) {
    case "minimize": {
      let currentWindow = trayWindow;
      if (settings.get('app.minimizeToTray')) {
        currentWindow.close();
      } else {
        currentWindow.minimize();
      }
      break;
    }
    case "maximize": {
      let currentWindow = trayWindow;
      if (currentWindow.isMaximized()) {
        currentWindow.unmaximize();
      } else {
        currentWindow.maximize();
      }
      break;
    }
    case "close": {
      let currentWindow = trayWindow;
      if (settings.get('app.closeToTray')) {
        currentWindow.close();
      } else {
        ForceQuit();
      }
      break;
    }
    case "forceQuit": {
      ForceQuit();
      break;
    }
    default: {
      if(isDev) {
        console.log('[main.js]', '[ipcMain]', '[onGeneral]', data);
      }
      break;
    }
  }
});
ipcMain.on('generalSync', async function (event, data) {
  switch (data.action) {
    default: {
      if(isDev) {
        console.log('[main.js]', '[ipcMain]', '[onGeneralSync]', data);
      }
      break;
    }
  }
});
ipcMain.handle('generalInvoke', async function (event, data) {
  switch (data.action) {
    case "setAppSetting": {
      switch (data.payload.setting) {
        case "appProcessListInitial": {
          settings.set('app.processListInitial', data.payload.value);
          return {
            setting: data.payload.setting,
            value: settings.get('app.processListInitial', 5)
          };
        }
        case "appProcessListRecurring": {
          settings.set('app.processListRecurring', data.payload.value);
          return {
            setting: data.payload.setting,
            value: settings.get('app.processListRecurring', 1)
          };
        }
        case "appStatisticsLatestTitleCount": {
          settings.set('app.statistics.latestTitleCount', data.payload.value);
          return {
            setting: data.payload.setting,
            value: settings.get('app.statistics.latestTitleCount', 3)
          }
        }
        case "appLang":
          settings.set('app.lang', data.payload.value);
          i18n.setLang(settings.get('app.lang', 'sys'));
          return {
            setting: data.payload.setting,
            value: settings.get('app.lang', 'sys')
          };
        case "appTheme":
          settings.set('app.theme', data.payload.value);
          return {
            setting: data.payload.setting,
            value: settings.get('app.theme', 'sys')
          }
        default: {
          if(isDev) {
            console.log('[main.js]', '[ipcMain]', '[handleGeneralInvoke]', '[setAppSetting]', data.payload);
          }
          break;
        }
      }
      break;
    }
    case "toggleAppSetting": {
      switch (data.payload) {
        case "appAutoStart":
          app.setLoginItemSettings({ openAtLogin: !app.getLoginItemSettings().openAtLogin });
          return {
            setting: data.payload,
            value: app.getLoginItemSettings().openAtLogin
          };
        case "appRecordingProcesses":
          settings.set("app.recordingProcesses", !settings.get('app.recordingProcesses', false));
          
          tray.setImage(settings.get("app.recordingProcesses", false) ?
            path.join(__dirname, 'assets', 'img', (nativeTheme.shouldUseDarkColors ? 'tray_64x64_rec.png' : 'tray_64x64_black_rec.png')) :
            path.join(__dirname, 'assets', 'img', (nativeTheme.shouldUseDarkColors ? 'tray_64x64.png' : 'tray_64x64_black.png'))
          );
          
          return {
            setting: data.payload,
            value: settings.get('app.recordingProcesses', false)
          }
        case "appStatisticsCollapsedGroupsByDefault":
          settings.set("app.statistics.collapsedGroupsByDefault", !settings.get('app.statistics.collapsedGroupsByDefault', true));
          return {
            setting: data.payload,
            value: settings.get('app.statistics.collapsedGroupsByDefault', true)
          }
        case "appStatisticsShowElapsedDays":
          settings.set("app.statistics.showElapsedDays", !settings.get('app.statistics.showElapsedDays', false));
          return {
            setting: data.payload,
            value: settings.get('app.statistics.showElapsedDays', false)
          }
        case "appIsPinned": {
          appIsPinned = !appIsPinned;
          return {
            setting: data.payload,
            value: appIsPinned
          }
        }
        case "appAllowInternetConnectivity":
          settings.set("app.allowInternetConnectivity", !settings.get('app.allowInternetConnectivity', false));
          return {
            setting: data.payload,
            value: settings.get('app.allowInternetConnectivity', false)
          }
        case "appDiscordEnabled":
          settings.set("app.discord.enabled", !settings.get('app.discord.enabled', false));
          return {
            setting: data.payload,
            value: settings.get('app.discord.enabled', false)
          }
        default: {
          if (isDev) {
            console.log('[main.js]', '[ipcMain]', '[handleGeneralInvoke]', '[toggleAppSetting]', data);
          }
          break;
        }
      }
      break;
    }
    case "getAppSettings": {
      return {
        request: data,
        response: {
          settings: {
            appIsDev: isDev,
            appVersion: config.version,
            appIsPinned: appIsPinned,
            appLang: settings.get('app.lang', 'sys'),
            appAutoStart: app.getLoginItemSettings().openAtLogin,
            appTheme: settings.get('app.theme', 'sys'),
            appAllowInternetConnectivity: settings.get('app.allowInternetConnectivity', false),
            appDiscordEnabled: settings.get('app.discord.enabled', false),
            appProcessListInitial: settings.get('app.processListInitial', 5),
            appProcessListRecurring: settings.get('app.processListRecurring', 1),
            appRecordingProcesses: settings.get('app.recordingProcesses', false),
            appStatisticsLatestTitleCount: settings.get('app.statistics.latestTitleCount', 3),
            appStatisticsCollapsedGroupsByDefault: settings.get('app.statistics.collapsedGroupsByDefault', true),
            appStatisticsShowElapsedDays: settings.get('app.statistics.showElapsedDays', false)
          },
          filters: settings.get('app.filters', {})
        }
      };
    }
    case "getSystemTheme": {
      return {
        request: data,
        response: (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
      }
    }
    
    case "getDataOfType": {
      let response;
      
      try {
        response = await knex.select(data.payload.cols).from(data.payload.type);
      } catch (error) {
        response = error;
      }
      
      if (typeof response?.code === "string") {
        response = {
          type: "error",
          error: {
            errno: response.errno,
            code: response.code
          }
        };
      }
      
      return {
        request: data,
        response: response
      }
    }
    case "deleteData": {
      let response;
      
      try {
        response = await knex(data.payload.type).where('id', data.payload.itemID).del()
      } catch (error) {
        response = error;
      }
      
      if (typeof response?.code === "string") {
        response = {
          type: "error",
          error: {
            errno: response.errno,
            code: response.code
          }
        };
      }
      
      return {
        request: data,
        response: response
      }
    }
    case "setData": {
      let response;
      
      try {
        if (Object.keys(data.payload.data).includes("id")) {
          // update
          let id = data.payload.data.id;
          delete data.payload.data.id;
          data.payload.data['updated_at'] = knex.fn.now();
          response = await knex(data.payload.type).where('id', '=', id).update(data.payload.data);
          delete data.payload.data.updated_at;
          data.payload.data.id = id;
        } else {
          // insert
          response = await knex.insert(data.payload.data).into(data.payload.type);
        }
      } catch (error) {
        response = error;
      }
      
      if (typeof response?.code === "string") {
        response = {
          type: "error",
          error: {
            errno: response.errno,
            code: response.code
          }
        };
      }
      
      return {
        request: data,
        response: response
      }
    }
    
    case "requestNewStatisticsList": {
      return await getStatistics();
    }
    
    case "updateAppFilters": {
      let response = null;
      
      if(!data?.payload?.groupID) return {request: data, response: {status: 0, code: "noGroupID"}};
      if(!data?.payload?.filterType) return {request: data, response: {status: 0, code: "noFilterType"}};
      
      if(data.payload.filterType === "clear") {
        if(settings.has(`app.filters.${data.payload.groupID}`)) {
          settings.delete(`app.filters.${data.payload.groupID}`);
          response = {status: 1, code: "cleared"};
        }
      } else {
        if(data?.payload?.filterData) {
          settings.set(`app.filters.${data.payload.groupID}.${data.payload.filterType}`, data.payload.filterData);
          response = {status: 1, code: "set"};
        } else {
          if(settings.has(`app.filters.${data.payload.groupID}.${data.payload.filterType}`)) {
            settings.delete(`app.filters.${data.payload.groupID}.${data.payload.filterType}`);
            
            if(Object.keys(settings.get(`app.filters.${data.payload.groupID}`, {})).length === 0) {
              settings.delete(`app.filters.${data.payload.groupID}`);
            }
            
            response = {status: 1, code: "deleted"};
          }
        }
      }
      
      if(response === null) response = {status: 1, code: "nothingDone"};
      
      return {
        request: data,
        response: response
      }
    }
    case "deleteGroupData": {
      let response;
      
      try {
        let GroupID = data.payload;
        response = await knex("statistics").where('group_id', '=', GroupID).del();
      } catch (error) {
        response = error;
      }
      
      if (typeof response?.code === "string") {
        response = {
          type: "error",
          error: {
            errno: response.errno,
            code: response.code
          }
        };
      }
      
      return {
        request: data,
        response: response
      }
    }
    
    default: {
      if(isDev) {
        console.log('[main.js]', '[ipcMain]', '[handleGeneralInvoke]', data);
      }
      break;
    }
  }
});
/* </editor-fold> */
/* <editor-fold desc="* Recording Functions *"> */
/**********************
 * Recording Functions *
 **********************/
// TODO maybe implement an action Queue for main actions such as start recording, update entry, stop recording?
async function addToDB(timestamp, rule, process) {
  const meta = {
    PID: process.Id,
    Title: process.WindowTitle,
    OS: {
      StartTime: process.StartTime
    },
    Rule: {
      Type: rule.type,
      Rule: rule.rule
    }
  }
  
  try {
    await knex.insert({ rule_id: rule.id, group_id: rule.group_id, processMeta: JSON.stringify(meta), started_at: timestamp }).into('statistics');
    
    if (isDev) {
      console.log("Added to DB");
    }
  } catch (error) {
    console.error(error);
  }
}

async function markAsStoppedDB(timestamp, rule, process) {
  try {
    const db = await knex('statistics')
      .whereRaw('json_extract(statistics.processMeta, \'$.PID\') = ?', process.Id)
      .andWhereRaw('json_extract(statistics.processMeta, \'$.OS.StartTime\') = ?', process.StartTime)
      .andWhereRaw('json_extract(statistics.processMeta, \'$.Rule.Type\') = ?', rule.type)
      .andWhere('stopped_at', null)
      .update({ stopped_at: timestamp });
    
    if (isDev) {
      if (db) {
        console.log(`Marked ${db} Record${(db > 1 ? 's' : '')} AS Stopped`);
      } else {
        console.log(`Nothing to mark as Stopped`);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function processDataUpdate(timestamp, processFromDB, processCurrentlyRunning) {
  let _db = processFromDB.filter((x) => JSON.parse(x.processMeta).PID === processCurrentlyRunning.Id)[0];
  let _oldMeta = JSON.parse(_db.processMeta);
  
  // Convert Meta Title to OBJECT
  if(typeof _oldMeta.Title === "string") {
    let _oldTitle = _oldMeta.Title;
    _oldMeta.Title = {};
    _oldMeta.Title[_db.started_at] = _oldTitle;
  }
  
  // Record title change
  _oldMeta.Title[timestamp] = processCurrentlyRunning.WindowTitle;
  
  // Save Changes
  await updateStatisticsFieldDB(_db.id, 'processMeta', JSON.stringify(_oldMeta));
}

async function updateStatisticsFieldDB(rowID, colID, newData) {
  try {
    const db = await knex('statistics')
      .where('id', rowID)
      .update({ [colID]: newData });
    
    if (isDev) {
      if (db) {
        console.log(`Statistics Row (${rowID}) Field (${colID}) Updated`);
      } else {
        console.log(`Nothing to update`);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function startRecording(added) {
  if(settings.get('app.recordingProcesses', false)) {
    if(added === undefined) added = processList.getProcessList();
    
    const timestamp = new Date().getTime();
    const rules = await knex.select('id', 'group_id', 'rule', 'type').from('rules');
    
    if(rules.length > 0) {
      for(const process of added) {
        for(const rule of rules) {
          switch (rule.type) {
            case 'exec': {
              if (process.Executable === rule.rule) {
                await addToDB(timestamp, rule, process);
              }
              break;
            }
            case 'rule': {
              let regexp = new RegExp(rule.rule);
              if (regexp.test(process.WindowTitle)) {
                await addToDB(timestamp, rule, process);
              }
              break;
            }
            default:
              if (isDev) {
                console.error(`Rule Type (${rule.type}) not yet implemented`);
              }
              break;
          }
        }
      }
      return 1;
    }
  }
}

async function stopRecording() {
  const timestamp = new Date().getTime();
  
  try {
    const db = await knex('statistics')
      .where('stopped_at', null)
      .update('stopped_at', timestamp);
    
    if(isDev) {
      if (db) {
        console.log(`Marked ${db} Record${(db > 1 ? 's' : '')} AS Stopped`);
      } else {
        console.log(`Nothing to mark as Stopped`);
      }
    }
    
    return 1;
  } catch (error) {
    console.error(error);
    
    return -1;
  }
}
/* </editor-fold> */
/* <editor-fold desc="* Window Functions *"> */
/********************
 * Window Functions *
 ********************/
function toggleTray() {
  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    showTray();
  }
}

function showTray() {
  const position = getTrayPosition();
  trayWindow.setPosition(position.x, position.y, false);
  trayWindow.show();
  trayWindow.focus();
}

function getTrayPosition() {
  // TODO linux & darwin
  const windowBounds = trayWindow.getBounds();
  const trayBounds = (process.platform === 'linux' ? screen.getCursorScreenPoint() : tray.getBounds());
  if (process.platform === 'linux') {
    trayBounds.height = 0;
    trayBounds.width = 0;
  }
  let output = { x: 0, y: 0 };
  
  if ((screen.getPrimaryDisplay().size.height / 2) > trayBounds.y) {
    if ((screen.getPrimaryDisplay().size.width / 2) > trayBounds.x) {
      // Q4
      // TOP LEFT
    } else {
      // Q1
      // TOP RIGHT
      output.x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
      output.y = Math.round(trayBounds.y + trayBounds.height);
      
      if ((output.x + windowBounds.width) > screen.getPrimaryDisplay().workAreaSize.width)
        output.x -= (output.x + windowBounds.width) - screen.getPrimaryDisplay().workAreaSize.width;
    }
  } else {
    if ((screen.getPrimaryDisplay().size.width / 2) > trayBounds.x) {
      // Q3
      // BOTTOM LEFT
      output.x = Math.round(screen.getPrimaryDisplay().size.width - screen.getPrimaryDisplay().workAreaSize.width);
      output.y = Math.round(trayBounds.y + (trayBounds.height / 2) - (windowBounds.height / 2));
      
      if ((output.y + windowBounds.height) > screen.getPrimaryDisplay().workAreaSize.height)
        output.y -= (output.y + windowBounds.height) - screen.getPrimaryDisplay().workAreaSize.height;
    } else {
      // Q2
      // BOTTOM RIGHT
      if (screen.getPrimaryDisplay().size.width === screen.getPrimaryDisplay().workAreaSize.width) {
        // Horizontal Taskbar
        output.x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2) - 0);
        output.y = Math.round(trayBounds.y - windowBounds.height);
        
        if ((output.x + windowBounds.width) > screen.getPrimaryDisplay().workAreaSize.width)
          output.x -= (output.x + windowBounds.width) - screen.getPrimaryDisplay().workAreaSize.width;
        
      } else {
        // Vertical Taskbar
        output.x = Math.round(screen.getPrimaryDisplay().workAreaSize.width - windowBounds.width);
        output.y = Math.round(trayBounds.y + (trayBounds.height / 2) - (windowBounds.height / 2));
        
        if ((output.y + windowBounds.height) > screen.getPrimaryDisplay().workAreaSize.height)
          output.y -= (output.y + windowBounds.height) - screen.getPrimaryDisplay().workAreaSize.height;
      }
    }
  }
  
  return output;
}
/* </editor-fold> */
/* <editor-fold desc="* Utility Functions *"> */
/*********************
 * Utility Functions *
 *********************/
function ForceQuit() {
  app.isQuiting = true;
  app.quit();
}

function shellOpen(url) {
  shell.openExternal(url);
}

function autoStart(isEnabled) {
  app.setLoginItemSettings({
    openAtLogin: isEnabled
  });
}

function initSettings() {
  if (!settings.get('settingsInit', false)) {
    // Initial General Settings
    autoStart(false);
    settings.set('app.lang', 'sys');
    settings.set('app.theme', 'sys');
    settings.set('app.allowInternetConnectivity', false);
    
    // App Specific
    settings.set('app.recordingProcesses', false);
    settings.set('app.processListInitial', 5);
    settings.set('app.processListRecurring', 1);
    settings.set('app.statistics.latestTitleCount', 3);
    settings.set('app.statistics.collapsedGroupsByDefault', true);
    settings.set('app.statistics.showElapsedDays', false);
    
    // First Startup
    settings.set('settingsInit', !isDev);
  }
  
  settings.onDidChange('app.lang', function (newValue) {
    i18n.setLang(newValue);
  });
  
  settings.onDidChange('app.processListRecurring', function (newValue) {
    processList.updateRecurringDelay(newValue);
  });
  
  settings.onDidChange('app.recordingProcesses', function (newValue) {
    if(newValue === false) {
      stopRecording().then(async () => {
        await sendStatisticsUpdate();
      });
    } else {
      startRecording().then(async () => {
        await sendStatisticsUpdate();
      });
    }
  });
  
  knex.schema.hasTable('groups').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('groups', function (t) {
        t.bigIncrements('id').unsigned().primary();
        t.string('name', 255).unique().notNullable();
        
        // Discord Rich Presence
        t.string('discordIcon').defaultTo(null);
        t.string('discordNiceName').defaultTo(null);
        t.boolean('discordShowPresence').defaultTo(false);
        
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
      });
    } else {
      knex.schema.hasColumn('groups', 'viewOffset').then(function (col) {
        if(col) {
          return knex.schema.table('groups', function (table) {
            table.dropColumn('viewOffset');
          });
        }
      });
      knex.schema.hasColumn('groups', 'discordIcon').then(function (col) {
        if(!col) {
          return knex.schema.table('groups', function (table) {
            table.string('discordIcon').defaultTo(null);
          });
        }
      });
    }
  });
  knex.schema.hasTable('rules').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('rules', function (t) {
        t.bigIncrements('id').unsigned().primary();
        t.bigInteger('group_id').unsigned().notNullable();
        t.text("rule").notNullable();
        t.string("type", 4).notNullable();
        
        // Discord Rich Presence
        t.string('discordNiceName').defaultTo(null);
        t.boolean('discordShowPresence').defaultTo(false);
        
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
        
        t.unique(['group_id', 'rule', 'type'], {indexName: 'group_rule_type'});
        t.foreign("group_id").references("groups.id").onDelete("CASCADE");
      });
    } else {
      knex.schema.hasColumn('rules', 'discordNiceName').then(function (col) {
        if(!col) {
          return knex.schema.table('rules', function (table) {
            table.string('discordNiceName').defaultTo(null);
          });
        }
      });
      knex.schema.hasColumn('rules', 'discordShowPresence').then(function (col) {
        if(!col) {
          return knex.schema.table('rules', function (table) {
            table.boolean('discordShowPresence').defaultTo(false);
          });
        }
      });
    }
  });
  knex.schema.hasTable('statistics').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('statistics', function (t) {
        t.bigIncrements('id').unsigned().primary();
        t.bigInteger('rule_id').unsigned().notNullable();
        t.bigInteger('group_id').unsigned().notNullable();
        t.json('processMeta');
        t.bigInteger('started_at').unsigned().notNullable();
        t.bigInteger('stopped_at');
        
        t.foreign('rule_id').references("rules.id").onDelete("CASCADE");
        t.foreign('group_id').references("groups.id").onDelete("CASCADE");
      });
    }
  });
  
  // IF Internet Connectivity is allowed
  settings.onDidChange('app.allowInternetConnectivity', function (newValue) {
    if(newValue) {
      // enable Internet modules
      initDiscord();
    } else {
      // disable Internet modules
      deInitDiscord();
      if(settingsDiscordEnabled) settingsDiscordEnabled();
    }
  });
  if(settings.get('app.allowInternetConnectivity', false)) {
    // Discord
    initDiscord();
  }
}
function initDiscord() {
  settingsDiscordEnabled = settings.onDidChange('app.discord.enabled', function (newValue) {
    if(newValue) {
      // setup periodical activity update
      DiscordRPC.register(DiscordAID);
      discordClient = new DiscordRPC.Client({ transport: 'ipc' });
      discordClient.on('ready', () => {
        discordTimer = setInterval(updateDiscordActivity, 15000);
      });
      discordClient.login({ clientId: DiscordAID }).catch(console.error);
    } else {
      // stop it
      deInitDiscord();
    }
  });
  if(settings.get('app.discord.enabled', false)) {
    DiscordRPC.register(DiscordAID);
    discordClient = new DiscordRPC.Client({ transport: 'ipc' });
    discordClient.on('ready', () => {
      discordTimer = setInterval(updateDiscordActivity, 15000);
    });
    discordClient.login({ clientId: DiscordAID }).catch(console.error);
  }
}
function deInitDiscord() {
  if(discordTimer) {
    clearInterval(discordTimer);
    discordTimer = null;
  }
  if(discordClient) discordClient.destroy();
}
function updateDiscordActivity() {
  if(settings.get('app.recordingProcesses', false)) {
    getLatestTrackedAppForDiscord().then((processes) => {
      const process = processes?.[0];
    
      if(discordClient) {
        if(process && process?.showDetails) {
          let activity = {
            details: process?.discordDetails ? process.discordDetails : '',
            startTimestamp: Math.floor(process.startedAt / 1000),
            instance: false
          };
        
          if(process?.showState) activity.state = process.discordState;
          if(process?.discordIcon) activity.largeImageKey = process.discordIcon;
        
          discordClient.setActivity(activity).then((success) => {
            discordActivitySet = true;
          });
        } else {
          if(discordActivitySet) {
            discordClient.clearActivity().then((success) => {
              discordActivitySet = false;
            });
          }
        }
      }
    });
  }
}

async function sendStatisticsUpdate() {
  trayWindow.webContents.send(
    "electron",
    {
      type: "statisticsListUpdate",
      payload: await getStatistics()
    }
  );
}

async function getStatistics() {
  const groups = await knex
    .select('id', 'name')
    .orderBy([{ column: 'id', order: 'asc' }])
    .from('groups');
  
  for(const groupIndex in groups) {
    const group = groups[groupIndex];
    const groupFilters = settings.get(`app.filters.${group.id}`, {});
    let filterQuery = "";
    
    if(Object.keys(groupFilters).length) {
      for(const column in groupFilters) {
        switch (column) {
          case "query": {
            filterQuery += `${filterQuery.length ? ' AND ' : ''}statistics.processMeta LIKE '%${groupFilters[column]}%'`;
            break;
          }
          case "from": {
            filterQuery += `${filterQuery.length ? ' AND ' : ''}statistics.started_at >= ${groupFilters[column]}`;
            break;
          }
          case "to": {
            filterQuery += `${filterQuery.length ? ' AND ' : ''}statistics.stopped_at <= ${groupFilters[column]}`;
            break;
          }
        }
      }
    }
    
    groups[groupIndex]['filtered'] = !!filterQuery;
    groups[groupIndex]['items'] = await knex
      .select('statistics.id as id', 'statistics.processMeta as processMeta', 'statistics.started_at as startedAt', 'statistics.stopped_at as stoppedAt')
      .select('rules.id as rule_id', 'rules.group_id as rule_group_id', 'rules.rule as rule_rule', 'rules.type as rule_type')
      .leftJoin('rules', 'statistics.rule_id', 'rules.id')
      .where('statistics.group_id', "=", group.id)
      .whereRaw(filterQuery)
      .orderBy([{ column: 'statistics.started_at', order: 'asc' }])
      .from('statistics');
  }
  
  return groups;
}

async function getLatestTrackedAppForDiscord() {
  return knex
    .select('groups.discordIcon as discordIcon', 'groups.discordNiceName as discordDetails', 'groups.discordShowPresence as showDetails')
    .select('rules.discordNiceName as discordState', 'rules.discordShowPresence as showState')
    .select('statistics.started_at as startedAt')
    .leftJoin('rules', 'statistics.rule_id', 'rules.id')
    .leftJoin('groups', function () {
      this.on('groups.id', '=', 'statistics.group_id').andOn('groups.id', '=', 'rules.group_id');
    })
    .whereNull('statistics.stopped_at')
    .where('groups.discordShowPresence', true)
    .orderBy([{ column: 'statistics.started_at', order: 'desc' }])
    .limit(1)
    .from('statistics');
}
/* </editor-fold> */
/* <editor-fold desc="* Extensions *"> */
/**************
 * Extensions *
 **************/
if (!String.format) {
  String.format = function (format) {
    let args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/%(\d+)/g, function (match, number) {
      return typeof args[number] != 'undefined' ? args[number] : match;
    });
  };
}
/* </editor-fold> */
