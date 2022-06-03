// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.kbd = {};

/***********************************
 * Electron Require Function Calls *
 ***********************************/
let electron = require('electron');
window.ipcRenderer = electron.ipcRenderer;

/**********************************
 * "Exports" to the Render Window *
 **********************************/
ipcRenderer.on("trayWindow", (event, data) => {
    console.log(data);
});

window.i18n = new (require('../../ElectronLibs/translations/i18n'))(ipcRenderer.sendSync("generalSync", {action: "initI18N"}));

window.addEventListener('DOMContentLoaded', function () {
    console.log("[preload.js]", "Ready");
});

window.addEventListener('keyup', function (e) {
    if (e.key === 'Control' || e.keyCode === 17) {
        window.kbd.ctrl = e.type === 'keydown';
    } else if (e.key === 'F5' || e.keyCode === 116) {
        ipcRenderer.send("trayWindow", {action: "reload"});
    } else if (e.key === 'F12' || e.keyCode === 123) {
        ipcRenderer.send("trayWindow", {action: "openDevTools"});
    } else {
        //console.log('[preload.js]', '[KeyUp Event]', 'Key: ' + e.key, 'KeyCode: ' + e.keyCode);
    }
});

window.addEventListener('keydown', function (e) {
    if (e.key === 'Control' || e.keyCode === 17) {
        window.kbd.ctrl = e.type === 'keydown';
    } else if (e.key === '0' || e.keyCode === 96) {
        if (window.kbd.ctrl) {
            window.zoom = 0;
            electron.webFrame.setZoomLevel(window.zoom);
        }
    } else if (e.key === '+' || e.keyCode === 107) {
        if (window.kbd.ctrl) {
            window.zoom = electron.webFrame.getZoomLevel();
            window.zoom += 1;
            electron.webFrame.setZoomLevel(window.zoom);
        }
    } else if (e.key === '-' || e.keyCode === 109) {
        if (window.kbd.ctrl) {
            window.zoom = electron.webFrame.getZoomLevel();
            window.zoom -= 1;
            electron.webFrame.setZoomLevel(window.zoom);
        }
    }
});

window.ForceQuit = function () {
    ipcRenderer.send("general", {action: "forceQuit"});
};

window.windowControl = function (action) {
    switch (action) {
        case 'minimize':
            ipcRenderer.send("general", {action: "minimize"});
            break;
        case 'maximize':
            ipcRenderer.send("general", {action: "maximize"});
            break;
        case 'close':
            ipcRenderer.send("general", {action: "close"});
            break;
    }
};

/*
 * Functions
 */
window.objectifyForm = function (formArray) {
    let returnArray = {};
    for (let i = 0; i < formArray.length; i++) {
        returnArray[formArray[i]['name']] = formArray[i]['value'];
    }
    return returnArray;
};

/*
 * Debug
 */
function stringToHex(string) {
    let bytes = [];
    
    for (let i = 0; i < string.length; ++i) {
        let code = string.charCodeAt(i);
        
        bytes = bytes.concat([code & 0xFF, code / 256 >>> 0]);
    }
    
    console.log('[preload.js]', '[stringToHex]', bytes.join(', '));
}
