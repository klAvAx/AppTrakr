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
  recurringReadDelay: 1000
};
let processList = [], prevProcessList = [];
let platform, release, timer;

class ps extends EventEmitter {
  constructor({initialDelay, recurringDelay}) {
    super();
  
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
    /*case 'linux':
      // LINUX processList
      // TODO command
      break;*/
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
          }, (error, stdout, stderr) => {
            if(error) {
              console.error(error);
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
              .filter(filterProcessList);
            
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
      console.error(`Platform '${platform}' is not supported!`);
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

const filterProcessList = (row) => {
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