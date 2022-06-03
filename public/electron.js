'use strict';

const { app, Menu, Tray, ipcMain, BrowserWindow, screen, shell, nativeTheme } = require('electron');
const os = require("os");
const fs = require("fs");
const url = require("url");
const util = require("util");
const path = require("path");
const config = require(path.join(__dirname, "../package.json"));

const contextMenu = require("electron-context-menu");
const isDev = require("electron-is-dev");
const Store = require("electron-store");
const settings = new Store({ name: "Settings" });

// Setup App Directory
if (
  !fs.existsSync(path.join(app.getPath("documents"), config.title)) ||
  !fs.existsSync(path.join(app.getPath("documents"), config.title, "languages"))
) {
  if(!fs.existsSync(path.join(app.getPath("documents"), config.title))) {
    fs.mkdirSync(path.join(app.getPath("documents"), config.title));
  }
  
  if (!fs.existsSync(path.join(app.getPath("documents"), config.title, "languages")) && !isDev) {
    fs.mkdirSync(path.join(app.getPath("documents"), config.title, "languages"));
    
    let files = fs.readdirSync(path.join(__dirname, '..', 'ElectronLibs', 'translations'));
    
    for(const file of files) {
      if(file.endsWith(".json")) {
        fs.copyFileSync(
          path.join(__dirname, '..', 'ElectronLibs', 'translations', file),
          path.join(app.getPath("documents"), config.title, "languages", file)
        );
      }
    }
  }
}
// TODO scan for language updates & move to app documents folder


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

// Init Settings
let appIsPinned = false;
initSettings();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let i18n, tray, trayWindow, processList;

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
    i18n = new (require('../ElectronLibs/translations/i18n'))({
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
    processList = new (require('../ElectronLibs/processList/processList'))({
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
  tray = new Tray(path.join(__dirname, '..', 'assets', 'img', (nativeTheme.shouldUseDarkColors ? 'tray_64x64.png' : 'tray_64x64_black.png')));
  
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      preload: path.join(__dirname, '../assets/js/preload.js')
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
      .catch((err) => console.log('An error occurred: ', err));
    installExtension(REDUX_DEVTOOLS)
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.log('An error occurred: ', err));
  } else {
    // Load Entry Point Page of the APP
    trayWindow.loadFile(path.join(__dirname, "../build/index.html"));
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
    default: {
      if(isDev) {
        console.log('[main.js]', '[ipcMain]', '[onTrayWindow]', data);
      }
      break;
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
    case "initI18N": {
      event.returnValue = {
        lang: settings.get('app.lang', 'sys'),
        dir: isDev ? null : path.join(app.getPath("documents"), config.title, "languages")
      };
      break;
    }
    case "getLocale": {
      event.returnValue = app.getLocale();
      break;
    }
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
            value: settings.get('app.processListInitial', 1)
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
        default: {
          if(isDev) {
            console.log('[main.js]', '[ipcMain]', '[handleGeneralSync]', data.payload);
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
          settings.set("app.statistics.showElapsedDays", !settings.get('app.statistics.showElapsedDays', true));
          return {
            setting: data.payload,
            value: settings.get('app.statistics.showElapsedDays', true)
          }
        case "appIsPinned": {
          appIsPinned = !appIsPinned;
          return {
            setting: data.payload,
            value: appIsPinned
          }
        }
        default: {
          if (isDev) {
            console.log('[main.js]', '[ipcMain]', '[handleGeneralSync]', data);
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
          appIsDev: isDev,
          appVersion: config.version,
          appIsPinned: appIsPinned,
          appLang: settings.get('app.lang', 'sys'),
          appAutoStart: app.getLoginItemSettings().openAtLogin,
          appTheme: (nativeTheme.shouldUseDarkColors ? "dark" : "light"),
          appProcessListInitial: settings.get('app.processListInitial', 1),
          appProcessListRecurring: settings.get('app.processListRecurring', 1),
          appRecordingProcesses: settings.get('app.recordingProcesses', false),
          appStatisticsLatestTitleCount: settings.get('app.statistics.latestTitleCount', 3),
          appStatisticsCollapsedGroupsByDefault: settings.get('app.statistics.collapsedGroupsByDefault', true),
          appStatisticsShowElapsedDays: settings.get('app.statistics.showElapsedDays', false)
        }
      };
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
    
    case "setGroupOffset": {
      let response;
      
      try {
        let GroupID = data.payload.groupID;
        let GroupOffset = data.payload.groupOffset;
        response = await knex("groups").where('id', '=', GroupID).update('viewOffset', GroupOffset);
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
    settings.set('app.lang', 'sys');
    autoStart(false);
    
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
        t.timestamp('viewOffset').defaultTo(0);
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
      });
    } else {
      knex.schema.hasColumn('groups', 'viewOffset')
        .then(function (col) {
          if(!col) {
            return knex.schema.table('groups', function (table) {
              table.timestamp('viewOffset').after('name').defaultTo(0);
            });
          }
        })
    }
  });
  knex.schema.hasTable('rules').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('rules', function (t) {
        t.bigIncrements('id').unsigned().primary();
        t.bigInteger('group_id').unsigned().notNullable();
        t.text("rule").notNullable();
        t.string("type", 4).notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
  
        t.unique(['group_id', 'rule', 'type'], {indexName: 'group_rule_type'});
        t.foreign("group_id").references("groups.id").onDelete("CASCADE");
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
  return knex
    .select('statistics.id as id', 'statistics.processMeta as processMeta', 'statistics.started_at as startedAt', 'statistics.stopped_at as stoppedAt')
    .select('rules.id as rule_id', 'rules.group_id as rule_group_id', 'rules.rule as rule_rule', 'rules.type as rule_type')
    .select('groups.id as group_id', 'groups.name as group_name', 'groups.viewOffset as group_offset')
    .leftJoin('rules', 'statistics.rule_id', 'rules.id')
    .leftJoin('groups', function () {
      this.on('groups.id', '=', 'statistics.group_id').andOn('groups.id', '=', 'rules.group_id');
    })
    .whereRaw('statistics.started_at >= groups.viewOffset')
    .orderBy([{ column: 'groups.id', order: 'asc' }, { column: 'statistics.started_at', order: 'asc' }])
    .from('statistics');
}

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