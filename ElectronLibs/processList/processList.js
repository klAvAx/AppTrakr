// noinspection JSPotentiallyInvalidConstructorUsage

const { app, ipcRenderer } = require('electron');
const isDev = require('electron-is-dev');
const os = require('os');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const EventEmitter = require('events');

let config = {
  initialReadDelay: 5000,
  recurringReadDelay: 1000,
  log: {
    info: console.log,
    error: console.error
  }
};
let processList = [], prevProcessList = [];
let platform, release, timer;

// TODO redo this from the ground up!
class ps extends EventEmitter {
  constructor({initialDelay, recurringDelay, log = {info: null, error: null}}) {
    super();
  
    // Override default logging funcs
    if(log?.info) config.log.info = log.info;
    if(log?.error) config.log.error = log.error;
    
    // Load Config
    config.initialReadDelay = initialDelay*1000;
    config.recurringReadDelay = recurringDelay*1000;
  
    if(platform == null) platform = os.platform();
    if(release == null) release = os.release();
  
    if(isDev) {
      console.log("======== PROCESS LIST JS ==========");
      console.log(`Platform:\t${platform}\nArch:\t${os.arch()}\nRelease:\t${release}\nVersion:\t${os.version()}`);
      console.log("===================================");
    }
    
    // Linux Dependency
    if(platform === "linux") {
      childProcess
        .exec(
          'which wmctrl',
          {
            windowsHide: true,
            encoding: 'utf-8'
          },
          (error, stdout, stderr) => {
            if(error || stdout.trim().length === 0) {
              // TODO: npm i alert
              //   alert("Please install wmctrl package! and then restart this app");
              config.log.error("processList", error);
              app.exit(error.code);
              return;
            }
          }
        );
    }
  
    timer = setTimeout(_getProcessList, config.initialReadDelay, this);
  }
  
  getProcessList() {
    return processList;
  }
  
  updateRecurringDelay(newDelay) {
    config.recurringReadDelay = newDelay*1000;
  }
}

const _getProcessList = (psClass) => {
  const _this = psClass;
  
  /**
   * os.platform()
   *
   * 'darwin'   => MacOSX
   * 'linux'    => Linux
   * 'win32'    => Windows
   */
  /**
   * os.release()
   *
   *  6.1.7601  => Windows 7 Ultimate Service Pack 1
   * 10.0.19042 => Windows 10 Pro (20H2)
   * 10.0.22000 => Windows 11 Pro
   */
  
  switch (platform) {
    /*case 'darwin':
      // MACOSX processList
      // TODO command
      break;*/
    case 'linux':
      /**
       * LINUX processList
       *
       * requires wmctrl if not installed prompt user to exit the app and install it!
       *
       * Tracking should prioritise Window ID followed by Process ID
       *
       * command to run & parse to get windows with pids: "wmctrl -lp"
       * Returns Columns: "Window ID    Desktop ID    PID    Machine Name    Window Title"
       *
       * command to run & parse to get started time: "ps -p {$PID} -o pid,user,etimes,lstart,cmd -ww"
       * Return Columns: "PID    USER    ELAPSED    STARTED    CMD"
       */
      try {
        childProcess
          .exec(
            'wmctrl -lp',
            {
              windowsHide: true,
              encoding: 'utf-8'
            },
            (error, stdout, stderr) => {
              if(error || stdout.trim().length === 0) {
                // TODO: npm i alert
                //   alert("Please install wmctrl package! and then restart this app");
                config.log.error("processList", error);
                return;
              }
        
              if(!areObjectSame(processList, prevProcessList)) {
                let added = processList.filter((x) => prevProcessList.findIndex((y) => y.Id === x.Id) === -1);
                let removed = prevProcessList.filter((x) => processList.findIndex((y) => y.Id === x.Id) === -1);
                let titleChanged = processList.filter((x) => prevProcessList.findIndex((y) => y.Id === x.Id && y.WindowTitle !== x.WindowTitle) !== -1);
          
                if(added.length > 0) {
                  _this.emit("AddedToList", added);
                  if(isDev) {
                    console.log("processList.js", "emitted -> AddedToList");
                  }
                }
                if(removed.length > 0) {
                  _this.emit("RemovedFromList", removed);
                  if(isDev) {
                    console.log("processList.js", "emitted -> RemovedFromList");
                  }
                }
                if(titleChanged.length > 0) {
                  let oldTitles = prevProcessList.filter((x) => titleChanged.findIndex((y) => y.Id === x.Id) !== -1);
                  _this.emit("TitleChanged", titleChanged, oldTitles);
                  if(isDev) {
                    console.log("processList.js", "emitted -> TitleChanged");
                  }
                }
          
                prevProcessList = processList;
              }
        
              // Filter Process List
              let _processList = stdout
                .split(/\r?\n/)
                .map((row, index) => {
                  if(row.trim().length === 0) return "";
            
                  const _header = ['Id', 'screenID', 'processID', 'machineName'];
                  let _data = {};
            
                  let _row = row.split(/ +/);
            
                  // Transform WMCTRL to Object
                  for(let x = 0; x < _row.length; x++) {
                    switch (x) {
                      /* WINDOW ID [HEX] */
                      case 0:
                      /* SCREEN ID [INT] */
                      case 1:
                      /* PROCESS ID [INT] */
                      case 2:
                      /* MACHINE NAME [STRING] */
                      case 3: {
                        _data[_header[x]] = (x === 1 || x === 2 ? parseInt(_row[x]) : _row[x]);
                        break;
                      }
                      /* WINDOW TITLE [STRING] */
                      default: {
                        _data['WindowTitle'] = (_data['WindowTitle'] ? _data['WindowTitle']+" " : "") + _row[x];
                        break;
                      }
                    }
                  }
            
                  // continue only if pid is != 0
                  if(_data['processID'] === 0) return "";
            
                  // Get User, Elapsed, Started, CMD by process ID
                  // Occasional error "Command failed: ps -p ${PID} -o pid,user,etimes,lstart,cmd -ww"
                  try {
                    let ps = childProcess.execSync(
                      `ps -p ${_data['processID']} -o pid,user,etimes,lstart,cmd -ww`,
                      {
                        windowsHide: true,
                        encoding: 'utf-8'
                      }
                    );
                    let _ps = ps.trim().split(/\n/)[1].trim().split(/ +/);
              
                    // Extend Object to include User, Elapsed, Started & CMD
                    for(let x = 0; x < _ps.length; x++) {
                      switch (x) {
                        case 0: {
                          /* PID */
                          break;
                        }
                        case 1: {
                          /* USER */
                          _data['user'] = _ps[x];
                          break;
                        }
                        case 2: {
                          /* ELAPSED */
                          _data['elapsed'] = parseInt(_ps[x]);
                          break;
                        }
                        case 3:
                        case 4:
                        case 5:
                        case 6:
                        case 7: {
                          /* STARTED */
                          _data['StartTime'] = (_data['StartTime'] ? _data['StartTime'] + " " : "") + _ps[x];
                          break;
                        }
                        default: {
                          /* CMD */
                          _data['Executable'] = (_data['Executable'] ? _data['Executable'] + " " : "") + _ps[x];
                          break;
                        }
                      }
                    }
              
                    _data['StartTime'] = new Date(_data['StartTime']).getTime() / 1000
              
                    return _data;
                  } catch (psError) {
                    config.log.error("processList", "Error occurred while trying to ps", psError);
                    return "";
                  }
                })
                .filter(filterProcessListLinux);
        
              processList = _processList;
              _this.emit("ListUpdate", _processList);
              setTimeout(_getProcessList, config.recurringReadDelay, _this);
            }
          );
      } catch (wmCtrlError) {
        config.log.error("processList", "Error Occurred while trying to fetch open windows with wmctrl", wmCtrlError);
        setTimeout(_getProcessList, config.recurringReadDelay, _this);
      }
      break;
    case 'win32':
      /**
       * WINDOWS processList
       *
       * NOTE SEMI-IMPORTANT if os is older than Windows 10
       *   Windows 7 requires at least WMF 3.0 (KB2506146)
       *   Windows 7 SP1 requires at least WMF 3.0 (KB2506143)
       *   Windows 8 should work, should have at least WMF 3.0 out of the box
       *   Windows 8.1 should work, should have at least WMF 4.0 out of the box
       *   Windows 10 TESTED works, has at least WMF 5.0 out of the box
       *   Windows 11 TESTED works, has WMF 5.1 out of the box
       */
      /**
       * Possible commands
       *
       * powershell WMIC PROCESS GET CreationDate,Name,ProcessId,Status /FORMAT:CSV
       * powershell "Get-Process | Where-Object {$_.mainWindowTitle} | Select-Object Id, @{l='StartTime';e={Get-Date -Date $_.StartTime -UFormat "%Y-%m-%dT%H:%M:%SZ"}}, @{l='Executable';e={$_.MainModule.ModuleName}}, @{l='WindowTitle';e={$_.mainWindowTitle}} | ConvertTo-Csv -NoTypeInformation"
       **/
      childProcess
        .exec(
          'chcp 65001 && powershell \"Get-Process | Where-Object {$_.mainWindowTitle} | Select-Object Id, @{l=\\"Executable\\";e={\\"$($_.Name).exe\\"}}, @{l=\\"WindowTitle\\";e={$_.mainWindowTitle}}, @{l=\\"StartTime\\";e={Get-Date -Date $_.StartTime -UFormat \\"%Y-%m-%dT%H:%M:%S\\"}} | ConvertTo-Csv -NoTypeInformation\"',
          {
            windowsHide: true,
            encoding: 'utf-8'
          },
          (error, stdout, stderr) => {
            if(error) {
              config.log.error("processList", error);
              app.exit(error.code);
              return;
            }
            
            if(!areObjectSame(processList, prevProcessList)) {
              let added = processList.filter((x) => prevProcessList.findIndex((y) => y.Id === x.Id) === -1);
              let removed = prevProcessList.filter((x) => processList.findIndex((y) => y.Id === x.Id) === -1);
              let titleChanged = processList.filter((x) => prevProcessList.findIndex((y) => y.Id === x.Id && y.WindowTitle !== x.WindowTitle) !== -1);
              
              if(added.length > 0) {
                _this.emit("AddedToList", added);
                if(isDev) {
                  console.log("processList.js", "emitted -> AddedToList");
                }
              }
              if(removed.length > 0) {
                _this.emit("RemovedFromList", removed);
                if(isDev) {
                  console.log("processList.js", "emitted -> RemovedFromList");
                }
              }
              if(titleChanged.length > 0) {
                let oldTitles = prevProcessList.filter((x) => titleChanged.findIndex((y) => y.Id === x.Id) !== -1);
                _this.emit("TitleChanged", titleChanged, oldTitles);
                if(isDev) {
                  console.log("processList.js", "emitted -> TitleChanged");
                }
              }
              
              prevProcessList = processList;
            }
            
            // Filter Process List
            let tasks = stdout
              .split(/\r?\r\n/)
              .filter(filterProcessListWindows);
            
            // Remove CHCP response
            if(tasks[0].includes("65001")) {
              tasks.splice(0, 1);
            }
            
            let _processList = [];
            let header = tasks[0].split(",").map((row) => row.replace(/[#" ]/g, ""));
            tasks.slice(1).forEach((row, rowIndex) => {
              if(_processList[rowIndex] == null) _processList[rowIndex] = {};
              row.split(/","/).forEach((col, colIndex) => {
                let _col = col;
                
                if(_col.startsWith("\""))_col = _col.slice(1, _col.length);
                if(_col.endsWith("\""))_col = _col.slice(0, -1);
                
                // Extra Processing
                switch(header[colIndex].toLowerCase()) {
                  case "id":
                    _col = parseInt(_col);
                    break;
                  case "starttime":
                    // Convert to UTC Timestamp (Includes offset)
                    _col = new Date(_col).getTime() / 1000;
                    break;
                  case "executable":
                    break;
                  case "windowtitle":
                    break;
                }
                
                _processList[rowIndex][header[colIndex]] = _col;
              });
            });
            
            processList = _processList;
            _this.emit("ListUpdate", _processList);
            setTimeout(_getProcessList, config.recurringReadDelay, _this);
          });
      break;
    default:
      config.log.error("processList", `Platform '${platform}' is not supported!`);
      app.exit(1);
      break;
  }
};

module.exports = ps;

/**
 * Utility Functions
 */
const areObjectSame = (obj1, obj2) => {
  let same = true;
  if(Array.isArray(obj1) && Array.isArray(obj2)) {
    if(obj1.length < obj2.length) {
      return false;
    }
    
    for (let entry in obj1) {
      for (let propName in obj1[entry]) {
        if(obj1?.[entry]?.[propName] !== obj2?.[entry]?.[propName]) {
          same = false;
          break;
        }
      }
      if(!same) break;
    }
  } else {
    for(let propName in obj1) {
      if(obj1?.[propName] !== obj2?.[propName]) {
        same = false;
        break;
      }
    }
  }
  
  return same;
}

const filterProcessListWindows = (row) => {
  if(row.length === 0) return false;
  
  let include = true;
  
  /**
   * exclude Misc. programs
   * - Task Manager
   * - Powershell Command Window
   * - Microsoft Text Input Application
   * - Windows Desktop Windows Manager
   * - Nvidia Overlay
   */
  include = include && !/"((taskmgr)|(powershell)|(textinputhost)|(dwm)|(nvidia share))\.exe"/.test(row.toLowerCase());
  
  /**
   * exclude Vendors
   * NOTE could collide with other stuff
   */
  //include = include && !/"(windows)|(microsoft)|(nvidia)|(realtek)/.test(row.toLowerCase());
  
  /**
   * exclude this App
   */
  let _thisAppExecutable = (process.execPath.split(path.sep)[process.execPath.split(path.sep).length - 1]).toLowerCase();
  let _thisAppRegExp = new RegExp("\""+process.pid+"\",\""+_thisAppExecutable+"\"");
  include = include && !_thisAppRegExp.test(row.toLowerCase());
  
  return include;
}

const filterProcessListLinux = (row) => {
  if(Object.keys(row).length === 0) return false;
  
  let include = true;
  
  /**
   * exclude Misc. programs
   */
  include = include && !/(plasmashell)/.test(row['Executable'].toLowerCase());
  
  /**
   * exclude Vendors
   */
  
  /**
   * exclude this App
   */
  let _thisAppExecutable = process.execPath;
  let _thisAppPID = process.pid;
  include = include && !(row['processID'] === _thisAppPID && row['Executable'].includes(_thisAppExecutable));
  
  return include;
}