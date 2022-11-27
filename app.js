'use strict';

const { app, Menu, Tray, ipcMain, BrowserWindow, screen, shell, nativeTheme } = require('electron');
const os = require("os");
const fs = require("fs");
const url = require("url");
const util = require("util");
const path = require("path");
const zlib = require("zlib");
const stream = require("stream");
const config = require(path.join(__dirname, "package.json"));

const positioner = require("electron-traywindow-positioner");
const contextMenu = require("electron-context-menu");
const isDev = require("electron-is-dev");
const Store = require("electron-store");
const settings = new Store({ name: "Settings" });

const DiscordRPC = require("discord-rpc");
const DiscordAID = "...Discord Application ID...";
const DiscordSEC = "...Discord Application Secret...";

// Setup App Directory
if (
  !fs.existsSync(path.join(app.getPath("documents"), config.title)) ||
  !fs.existsSync(path.join(app.getPath("documents"), config.title, "languages")) ||
  !fs.existsSync(path.join(app.getPath("documents"), config.title, "logs")))
{
  if (!fs.existsSync(path.join(app.getPath("documents"), config.title))) {
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
  
  if (!fs.existsSync(path.join(app.getPath("documents"), config.title, "logs"))) {
    fs.mkdirSync(path.join(app.getPath("documents"), config.title, "logs"));
    
    log("App Is Starting");
  }
} else {
  log("App Is Starting");
  
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
  
  // Compress Log files
  // TODO add functionality to keep only last x days, CONFIGURABLE
  fs.opendir(path.join(app.getPath("documents"), config.title, "logs"), (dErr, dir) => {
    if(dErr) {
      console.error(dErr);
      return;
    }
    let date = (new Date()).toISOString().split("T")[0].replaceAll("-", "");
    
    let files = fs
      .readdirSync(dir.path)
      .filter((file) => !(/\.log\.gz/.test(file)));
    
    for(const file of files) {
      if(file !== `${date}.log`) {
        const gzip = zlib.createGzip();
        const source = fs.createReadStream(path.join(dir.path, file));
        const destination = fs.createWriteStream(path.join(dir.path, `${file}.gz`));
        
        stream.pipeline(source, gzip, destination, (err) => {
          if(err) {
            console.error(err);
            fs.rmSync(path.join(dir.path, `${file}.gz`));
            return;
          }
          fs.rmSync(path.join(dir.path, file));
        });
      }
    }
  });
}

process.on("uncaughtException", (error, origin) => {
  logError("Process Uncaught Exception!", error, origin);
});
app.on("render-process-gone", (event, webContents, details) => {
  logError("App Render Process Gone!", event, details);
});

// Init App Database
const dbVersion = 1; // PRAGMA user_version
let dbReady = false;
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
knex.raw('PRAGMA user_version').then((response) => {
  const _dbVersion = response[0]['user_version'];
  
  if(_dbVersion < dbVersion) {
    // Update DB
    log("DB update is in order!");
    
    for(let target = _dbVersion; target < dbVersion; target++) {
      switch (target) {
        case 0: {
          // First Install DB Setup
          knex.schema.hasTable('groups').then(function (exists) {
            if (!exists) {
              return knex.schema.createTable('groups', function (t) {
                t.increments('id').unsigned();
        
                t.timestamp('created_at').defaultTo(knex.fn.now());
                t.timestamp('updated_at').defaultTo(knex.fn.now());
              });
            }
          });
          knex.schema.hasTable('group_meta').then(function (exists) {
            if (!exists) {
              return knex.schema.createTable('group_meta', function (t) {
                t.primary(['group_id', 'metaName']);
                
                t.integer('group_id').unsigned().notNullable();
                t.string('metaName', 255).notNullable();
                
                t.text('metaValue').notNullable();
                
                t.foreign("group_id").references("groups.id").onDelete("CASCADE").onUpdate("CASCADE");
              });
            }
          });
          
          knex.schema.hasTable('rules').then(function (exists) {
            if (!exists) {
              return knex.schema.createTable('rules', function (t) {
                t.increments('id').unsigned();
                t.integer('group_id').unsigned().notNullable();
        
                t.timestamp('created_at').defaultTo(knex.fn.now());
                t.timestamp('updated_at').defaultTo(knex.fn.now());
        
                t.foreign("group_id").references("groups.id").onDelete("CASCADE").onUpdate("CASCADE");
              });
            }
          });
          knex.schema.hasTable('rule_meta').then(function (exists) {
            if (!exists) {
              return knex.schema.createTable('rule_meta', function (t) {
                t.primary(['rule_id', 'metaName']);
                
                t.integer('rule_id').unsigned().notNullable();
                t.string('metaName', 255).notNullable();
                
                t.text('metaValue').notNullable();
                
                t.foreign("rule_id").references("rules.id").onDelete("CASCADE").onUpdate("CASCADE");
              });
            }
          });
          
          knex.schema.hasTable('statistics').then(function (exists) {
            if (!exists) {
              return knex.schema.createTable('statistics', function (t) {
                t.increments('id').unsigned().primary();
                
                t.integer('rule_id').unsigned().notNullable();
                t.integer('group_id').unsigned().notNullable();
                
                t.timestamp('started_at').defaultTo(null);
                t.timestamp('stopped_at').defaultTo(null);
                
                t.foreign('rule_id').references("rules.id").onDelete("CASCADE").onUpdate("CASCADE");
                t.foreign('group_id').references("groups.id").onDelete("CASCADE").onUpdate("CASCADE");
              });
            }
          });
          knex.schema.hasTable('statistic_meta').then(function (exists) {
            if (!exists) {
              return knex.schema.createTable('statistic_meta', function (t) {
                t.primary(['statistic_id', 'metaName']);
                
                t.integer('statistic_id').unsigned().notNullable();
                t.string('metaName', 255).notNullable();
                
                t.text('metaValue').notNullable();
                
                t.foreign("statistic_id").references("statistics.id").onDelete("CASCADE").onUpdate("CASCADE");
              });
            }
          });
          knex.schema.hasTable('statistic_titles').then(function (exists) {
            if (!exists) {
              return knex.schema.createTable('statistic_titles', function (t) {
                t.primary(['statistic_id', 'changed_at']);
                
                t.integer('statistic_id').unsigned().notNullable();
                t.timestamp('changed_at').notNullable();
                
                t.text('title').notNullable();
                
                t.foreign("statistic_id").references("statistics.id").onDelete("CASCADE").onUpdate("CASCADE");
              });
            }
          });
          break;
        }
        default: {
          console.error(`Update for target "${target}" is not yet done!`);
          app.exit(-1);
          return;
        }
      }
    }
    
    knex.raw(`PRAGMA user_version = ${dbVersion}`).then(() => {
      log('DB Updated successfully');
      dbReady = true;
    });
  } else if (_dbVersion > dbVersion) {
    // Downgrade not possible...
    logError("DB downgrade is not possible!");
    app.exit(-1);
  } else {
    log("DB version is up to date!");
    dbReady = true;
  }
});

// TODO implement dbReady check?

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
        
        let rules = [];
        try {
          rules = await knex
            .select('rules.id', 'rules.group_id')
            .select(knex.raw('a.`metaValue` AS \'rule\''))
            .select(knex.raw('b.`metaValue` AS \'type\''))
            .from('rules')
            .joinRaw('LEFT JOIN `rule_meta` a ON `rules`.`id` = a.`rule_id` AND a.`metaName` = \'rule\'')
            .joinRaw('LEFT JOIN `rule_meta` b ON `rules`.`id` = b.`rule_id` AND b.`metaName` = \'type\'');
        } catch (error) {
          logError('Error in processList ON RemovedFromList', error);
        }
        
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
        
        let rules = [];
        try {
          rules = await knex
            .select('rules.id', 'rules.group_id')
            .select(knex.raw('a.`metaValue` AS \'rule\''))
            .select(knex.raw('b.`metaValue` AS \'type\''))
            .from('rules')
            .joinRaw('LEFT JOIN `rule_meta` a ON `rules`.`id` = a.`rule_id` AND a.`metaName` = \'rule\'')
            .joinRaw('LEFT JOIN `rule_meta` b ON `rules`.`id` = b.`rule_id` AND b.`metaName` = \'type\'');
        } catch (error) {
          logError('Error in processList ON TitleChanged', error);
        }
        
        if(rules.length > 0) {
          for(const process of newTitles) {
            let prevProcess = oldTitles.filter((x) => x.Id === process.Id)[0];
            for(const rule of rules) {
              switch(rule.type) {
                case 'exec': {
                  
                  const db = await knex
                    .select('statistics.id', 'statistics.started_at')
                    .select(knex.raw('a.`metaValue` AS \'PID\''))
                    .select(knex.raw('json_group_object(statistic_titles.changed_at, statistic_titles.title) as titles'))
                    .whereRaw('a.`metaValue` = ?', process.Id)
                    .andWhereRaw('b.`metaValue` = ?', process.StartTime)
                    .andWhereRaw('c.`metaValue` = ?', rule.type)
                    .andWhereRaw('d.`metaValue` = ?', rule.rule)
                    .andWhere('statistics.stopped_at', null)
                    .from('statistics')
                    .groupBy('statistics.id')
                    .joinRaw('LEFT JOIN `statistic_meta` a ON `statistics`.`id` = a.`statistic_id` AND a.`metaName` = \'PID\'')
                    .joinRaw('LEFT JOIN `statistic_meta` b ON `statistics`.`id` = b.`statistic_id` AND b.`metaName` = \'OSStartTime\'')
                    .joinRaw('LEFT JOIN `statistic_meta` c ON `statistics`.`id` = c.`statistic_id` AND c.`metaName` = \'ruleType\'')
                    .joinRaw('LEFT JOIN `statistic_meta` d ON `statistics`.`id` = d.`statistic_id` AND d.`metaName` = \'ruleRule\'')
                    .leftJoin('statistic_titles', 'statistics.id', 'statistic_titles.statistic_id');
                  
                  if(db.length > 0) {
                    if (process.Executable === rule.rule) {
                      await recordTitleChange(timestamp, db, process);
                    }
                  }
                  break;
                }
                case 'rule': {
                  let regexp = new RegExp(rule.rule);
  
                  const db = await knex
                    .select('statistics.id', 'statistics.started_at')
                    .select(knex.raw('a.`metaValue` AS \'PID\''))
                    .select(knex.raw('json_group_object(statistic_titles.changed_at, statistic_titles.title) as titles'))
                    .whereRaw('a.`metaValue` = ?', process.Id)
                    .andWhereRaw('b.`metaValue` = ?', process.StartTime)
                    .andWhereRaw('c.`metaValue` = ?', rule.type)
                    .andWhereRaw('d.`metaValue` = ?', rule.rule)
                    .andWhere('statistics.stopped_at', null)
                    .from('statistics')
                    .groupBy('statistics.id')
                    .joinRaw('LEFT JOIN `statistic_meta` a ON `statistics`.`id` = a.`statistic_id` AND a.`metaName` = \'PID\'')
                    .joinRaw('LEFT JOIN `statistic_meta` b ON `statistics`.`id` = b.`statistic_id` AND b.`metaName` = \'OSStartTime\'')
                    .joinRaw('LEFT JOIN `statistic_meta` c ON `statistics`.`id` = c.`statistic_id` AND c.`metaName` = \'ruleType\'')
                    .joinRaw('LEFT JOIN `statistic_meta` d ON `statistics`.`id` = d.`statistic_id` AND d.`metaName` = \'ruleRule\'')
                    .leftJoin('statistic_titles', 'statistics.id', 'statistic_titles.statistic_id');
                  
                  if(db.length > 0) {
                    if (regexp.test(process.WindowTitle)) {
                      await recordTitleChange(timestamp, db, process);
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

process.on("SIGUSR2", function () {
  ForceQuit();
});
app.on('before-quit', async function (event) {
  if (app.isQuiting) {
    event.preventDefault();
    
    // Stop Recording if Recording
    if (settings.get('app.recordingProcesses', false)) {
      await stopRecording();
    }
  
    await logSync("App Is Quitting");
    
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
    case "error": {
      logError('Error in trayWindow', data.payload);
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
          if(os.platform() !== "win32" && os.platform() !== "darwin") return { setting: data.payload, value: null };
          
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
          if(DiscordAID !== "...Discord Application ID...") {
            settings.set("app.discord.enabled", !settings.get('app.discord.enabled', false));
          }
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
            appAutoStart: (os.platform() === "win32" || os.platform() === "darwin" ? app.getLoginItemSettings().openAtLogin : null),
            appTheme: settings.get('app.theme', 'sys'),
            appAllowInternetConnectivity: settings.get('app.allowInternetConnectivity', false),
            appDiscordPossible: DiscordAID !== "...Discord Application ID...",
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
      
      let baseSelect = [`${data.payload.type}.id`];
      
      if(data.payload.type.toLowerCase() === 'rules') {
        baseSelect.push(`${data.payload.type}.group_id`);
      }
      
      let metaTablePrefix = data.payload.type.toLowerCase().slice(0, -1);
      let metaTable = `${metaTablePrefix}_meta`;
      let metaSelect = [];
      let metaJoin = [];
      for(const metaKey of data.payload.cols) {
        metaSelect.push(`${metaKey}.\`metaValue\` AS '${metaKey}'`);
        metaJoin.push(`LEFT JOIN \`${metaTable}\` ${metaKey} ON \`${data.payload.type.toLowerCase()}\`.\`id\` = ${metaKey}.\`${data.payload.type.toLowerCase().slice(0, -1)}_id\` AND ${metaKey}.\`metaName\` = '${metaKey}'`);
      }
      
      try {
        response = await knex
          .select(baseSelect)
          .select(knex.raw(metaSelect.join(", ")))
          .from(data.payload.type)
          .joinRaw(metaJoin.join(" "));
      } catch (error) {
        response = error;
        logError('Error in generalInvoke ON getDataOfType', error);
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
        response = await knex(data.payload.type)
          .where('id', data.payload.itemID)
          .del();
      } catch (error) {
        response = error;
        logError('Error in generalInvoke ON deleteData', error);
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
        let metaTablePrefix = data.payload.type.toLowerCase().slice(0, -1);
        let metaTable = `${metaTablePrefix}_meta`;
        let baseData = {};
        
        if (Object.keys(data.payload.data).includes("id")) {
          // update
          let id = data.payload.data.id;
          delete data.payload.data.id;
  
          baseData['updated_at'] = knex.fn.now();
          if(metaTablePrefix === 'rule') {
            baseData['group_id'] = data.payload.data['group_id'];
            delete data.payload.data['group_id'];
          }
          
          response = await knex(data.payload.type.toLowerCase())
            .where('id', '=', id)
            .update(baseData);
          
          for(const metaKey in data.payload.data) {
            await knex(metaTable)
              .where(`${metaTablePrefix}_id`, '=', id)
              .where('metaName', '=', metaKey)
              .update({metaValue: data.payload.data[metaKey]});
          }
          
          data.payload.data.id = id;
        } else {
          // insert
          if(metaTablePrefix === 'rule') {
            baseData['group_id'] = data.payload.data['group_id'];
            delete data.payload.data['group_id'];
          }
          
          response = await knex
            .insert(baseData)
            .into(data.payload.type.toLowerCase());
          
          let id = response[0];
          
          for(const metaKey in data.payload.data) {
            await knex
              .insert({
                [`${metaTablePrefix}_id`]: id,
                metaName: metaKey,
                metaValue: data.payload.data[metaKey]
              })
              .into(metaTable);
          }
        }
      } catch (error) {
        response = error;
        logError('Error in generalInvoke ON setData', error);
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
        
        response = await knex("statistics")
          .where('group_id', '=', GroupID)
          .del();
      } catch (error) {
        response = error;
        logError('Error in generalInvoke ON deleteGroupData', error);
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
    OSStartTime: process.StartTime,
    ruleType: rule.type,
    ruleRule: rule.rule
  }
  
  try {
    let id = await knex
      .insert({
        rule_id: rule.id,
        group_id: rule.group_id,
        started_at: timestamp
      })
      .into('statistics');
    
    id = id[0];
    
    for (const metaKey in meta) {
      await knex
        .insert({
          statistic_id: id,
          metaName: metaKey,
          metaValue: meta[metaKey]
        })
        .into('statistic_meta');
    }
    
    await knex
      .insert({
        statistic_id: id,
        changed_at: timestamp,
        title: process.WindowTitle
      })
      .into('statistic_titles')
    
    if (isDev) {
      console.log("Added to DB");
    }
  } catch (error) {
    logError('Error in addToDB', error);
  }
}

async function markAsStoppedDB(timestamp, rule, process) {
  try {
    const db = await knex('statistics')
      .whereRaw('`statistics`.`id` IN (SELECT a.`statistic_id` FROM `statistic_meta` a WHERE `statistics`.`id` = a.`statistic_id` AND a.`metaName` = \'PID\' AND a.`metaValue` = ?)', process.Id)
      .andWhereRaw('`statistics`.`id` IN (SELECT b.`statistic_id` FROM `statistic_meta` b WHERE `statistics`.`id` = b.`statistic_id` AND b.`metaName` = \'OSStartTime\' AND b.`metaValue` = ?)', process.StartTime)
      .andWhereRaw('`statistics`.`id` IN (SELECT c.`statistic_id` FROM `statistic_meta` c WHERE `statistics`.`id` = c.`statistic_id` AND c.`metaName` = \'ruleType\' AND c.`metaValue` = ?)', rule.type)
      .andWhere('statistics.stopped_at', null)
      .update({ stopped_at: timestamp });
    
    if (isDev) {
      if (db) {
        console.log(`Marked ${db} Record${(db > 1 ? 's' : '')} AS Stopped`);
      } else {
        console.log(`Nothing to mark as Stopped`);
      }
    }
  } catch (error) {
    logError('Error in markAsStoppedDB', error);
  }
}

async function recordTitleChange(timestamp, processFromDB, processCurrentlyRunning) {
  let _db = processFromDB.filter((x) => x.PID === processCurrentlyRunning.Id)[0];
  
  if(Object.keys(_db).length === 0) console.error("titlePreRecordError");
  
  try {
    // Record Title Change
    const db = await knex
      .insert({
        statistic_id: _db.id,
        changed_at: timestamp,
        title: processCurrentlyRunning.WindowTitle
      })
      .into('statistic_titles');
    
    if (isDev) {
      if (db) {
        console.log(`Recorded A Title Change For ID (${_db.id}) AT (${timestamp})`);
      } else {
        console.log(`Nothing to update`);
      }
    }
  } catch (error) {
    logError('Error in recordTitleChange', error);
  }
}

async function startRecording(added) {
  if(settings.get('app.recordingProcesses', false)) {
    if(added === undefined) added = processList.getProcessList();
    
    const timestamp = new Date().getTime();
    
    let rules = [];
    try {
      rules = await knex
        .select('rules.id', 'rules.group_id')
        .select(knex.raw('a.`metaValue` AS \'rule\''))
        .select(knex.raw('b.`metaValue` AS \'type\''))
        .from('rules')
        .joinRaw('LEFT JOIN `rule_meta` a ON `rules`.`id` = a.`rule_id` AND a.`metaName` = \'rule\'')
        .joinRaw('LEFT JOIN `rule_meta` b ON `rules`.`id` = b.`rule_id` AND b.`metaName` = \'type\'');
    } catch (error) {
      logError('Error in startRecording', error);
    }
    
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
    logError('Error in stopRecording', error);
    
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
  positioner.position(trayWindow, tray.getBounds());
  trayWindow.show();
  trayWindow.focus();
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
  let platform = os.platform();
  
  // Windows & MacOS
  if(platform === "win32" || platform === "darwin") {
    app.setLoginItemSettings({
      openAtLogin: isEnabled
    });
  }
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
    if(newValue && DiscordAID !== "...Discord Application ID...") {
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
  if(settings.get('app.discord.enabled', false) && DiscordAID !== "...Discord Application ID...") {
    DiscordRPC.register(DiscordAID);
    discordClient = new DiscordRPC.Client({ transport: 'ipc' });
    discordClient.on('ready', () => {
      discordTimer = setInterval(updateDiscordActivity, 15000);
    });
    discordClient.login({ clientId: DiscordAID }).catch(logError);
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
    .select('groups.id')
    .select(knex.raw('a.`metaValue` AS \'name\''))
    .orderBy([{ column: 'id', order: 'asc' }])
    .from('groups')
    .joinRaw('LEFT JOIN `group_meta` a ON `groups`.`id` = a.`group_id` AND a.`metaName` = \'name\'');
  
  for(const groupIndex in groups) {
    const group = groups[groupIndex];
    const groupFilters = settings.get(`app.filters.${group.id}`, {});
    let filterQuery = "";
    
    if(Object.keys(groupFilters).length) {
      for(const column in groupFilters) {
        switch (column) {
          case "query": {
            filterQuery += `${filterQuery.length ? ' AND ' : ''}statistic_titles.title LIKE '%${groupFilters[column]}%'`;
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
      .select('statistics.id as id', 'statistics.started_at as startedAt', 'statistics.stopped_at as stoppedAt')
      .select(knex.raw('json_group_object(statistic_titles.changed_at, statistic_titles.title) as titles'))
      .select('rules.id as rule_id', 'rules.group_id as rule_group_id')
      .select(knex.raw('rr.`metaValue` AS \'rule_rule\''))
      .select(knex.raw('rt.`metaValue` AS \'rule_type\''))
      .join('rules', 'statistics.rule_id', 'rules.id')
      .leftJoin('statistic_titles', 'statistics.id', 'statistic_titles.statistic_id')
      .joinRaw('LEFT JOIN `rule_meta` rr ON `rules`.`id` = rr.`rule_id` AND rr.`metaName` = \'rule\'')
      .joinRaw('LEFT JOIN `rule_meta` rt ON `rules`.`id` = rt.`rule_id` AND rt.`metaName` = \'type\'')
      .where('statistics.group_id', "=", group.id)
      .whereRaw(filterQuery)
      .orderBy([{ column: 'statistics.started_at', order: 'asc' }])
      .groupBy('statistics.id')
      .from('statistics');
  }
  
  return groups;
}

async function getLatestTrackedAppForDiscord() {
  return knex
    .select(knex.raw('c.`metaValue` as `discordIcon`'))
    .select(knex.raw('d.`metaValue` as `discordDetails`'))
    .select(knex.raw('e.`metaValue` as `showDetails`'))
    .select(knex.raw('a.`metaValue` AS `discordState`'))
    .select(knex.raw('b.`metaValue` as `showState`'))
    .select('statistics.started_at as startedAt')
    .from('statistics')
    .joinRaw('LEFT JOIN `rule_meta` a ON `statistics`.`rule_id` = a.`rule_id` AND a.`metaName` = \'discordNiceName\'')
    .joinRaw('LEFT JOIN `rule_meta` b ON `statistics`.`rule_id` = b.`rule_id` AND b.`metaName` = \'discordShowPresence\'')
    .joinRaw('LEFT JOIN `group_meta` c ON `statistics`.`group_id` = c.`group_id` AND c.`metaName` = \'discordIcon\'')
    .joinRaw('LEFT JOIN `group_meta` d ON `statistics`.`group_id` = d.`group_id` AND d.`metaName` = \'discordNiceName\'')
    .joinRaw('LEFT JOIN `group_meta` e ON `statistics`.`group_id` = e.`group_id` AND e.`metaName` = \'discordShowPresence\'')
    .whereNull('statistics.stopped_at')
    .whereRaw('e.`metaValue` = 1')
    .groupBy('statistics.id')
    .orderBy([{ column: 'statistics.started_at', order: 'desc' }])
    .limit(1);
}
/* </editor-fold> */
/* <editor-fold desc="* Log Functions"> */
/*****************
 * Log Functions *
 *****************/
function log() {
  // Log 2 File
  _log(...arguments);
  
  // Log 2 Console
  console.log(...arguments);
}
function logError() {
  // Log 2 File
  _log('[ERROR]', ...arguments);
  
  // Log 2 Console
  console.error(...arguments);
}
function _log() {
  const fullDate = new Date();
  const date = fullDate.toISOString().split("T")[0].replaceAll("-", "");
  const file = `${date}.log`;
  
  return new Promise((resolve, reject) => {
    fs.opendir(path.join(app.getPath("documents"), config.title, "logs"), (dErr, dir) => {
      if (dErr) {
        console.error(dErr);
        reject();
        return;
      }
      fs.open(path.join(dir.path, file), 'a', (fErr, fd) => {
        if (fErr) {
          console.error(fErr);
          reject();
          return;
        }
        let logDate = fullDate.toISOString().replaceAll("T", " ").replaceAll(/\.\d+Z/g, "");
        let logData = [...arguments];
        fs.write(fd, `[${logDate}] ${JSON.stringify(logData)}\n`, (fdErr, bWritten) => {
          if (fdErr) {
            console.error(fdErr);
            reject();
            return;
          }
          fs.close(fd);
          resolve("1");
        });
      });
    });
  });
}

function logSync() {
  console.log(...arguments);
  return _log(...arguments);
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
