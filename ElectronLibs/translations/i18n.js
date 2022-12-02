// noinspection JSPotentiallyInvalidConstructorUsage

const { app, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

let loadedLanguage;

let _config = {
  language: '',
  languageTag: '',
  langDir: null,
  log: {
    info: console.log,
    error: console.error
  }
};

// TODO separate this out to a git module
function i18n({language, languageTag, langDir, log = {info: null, error: null}}) {
  _config.language = language;
  
  // Override log funcs
  if(log?.info) _config.log.info = log.info;
  if(log?.error) _config.log.error = log.error;
  
  // Set Language Files directory
  if(langDir) _config.langDir = langDir;
  
  // Init
  langSet();
}

i18n.prototype.setLang = function (lang) {
  _config.log.info("I18N", "Language change", `${_config.language} -> ${lang}`);
  _config.language = lang;
  
  langSet();
};

i18n.prototype.getLang = function () {
  return _config.languageTag;
};

i18n.prototype.getLangList = function () {
  return [
    { index: "sys", value: "System" },
    { index: "en", value: "English" },
    { index: "lt", value: "Lithuanian" },
    { index: "de", value: "German" }
  ];
};

i18n.prototype.__ = function (key, value) {
  if (key.length === 0 && value.length === 0) return null;
  
  let translation = loadedLanguage[key];
  
  if (translation === undefined) {
    loadedLanguage[key] = (value === undefined ? key : value);
    
    fs.writeFileSync(
      path.join((_config.langDir ? _config.langDir : __dirname), _config.languageTag + '.json'),
      JSON.stringify(loadedLanguage, null, 1),
      'utf8'
    );
    return (value === undefined ? key : value);
  }
  
  if (translation.length === 0) {
    let reloadSingle = JSON.parse(
      fs.readFileSync(
        path.join((_config.langDir ? _config.langDir : __dirname), _config.languageTag + '.json'),
        'utf8'
      )
    );
    
    return loadedLanguage[key] = reloadSingle[key];
  }
  
  return translation;
};

module.exports = i18n;

/*********************
 * Private Functions *
 *********************/
function langSet() {
  if (_config.language.length === 2) {
    _config.languageTag = _config.language;
  } else {
    switch (_config.language) {
      case 'sys':
        if (app) {
          _config.languageTag = app.getLocale();
        } else {
          _config.languageTag = ipcRenderer.sendSync("generalSync", { action: "getLocale" });
        }
        
        if (_config.languageTag.includes('-')) {
          _config.languageTag = _config.languageTag.split('-')[0];
        }
        break;
      default:
        if (app) {
          _config.languageTag = app.getLocale();
        } else {
          _config.languageTag = ipcRenderer.sendSync("generalSync", { action: "getLocale" });
        }
        
        if (_config.languageTag.includes('-')) {
          _config.languageTag = _config.languageTag.split('-')[0];
        }
        break;
    }
  }
  
  if (fs.existsSync(path.join((_config.langDir ? _config.langDir : __dirname), _config.languageTag + '.json'))) {
    loadedLanguage = JSON.parse(
      fs.readFileSync(
        path.join((_config.langDir ? _config.langDir : __dirname), _config.languageTag + '.json'),
        'utf8'
      )
    );
  } else {
    fs.writeFileSync(
      path.join((_config.langDir ? _config.langDir : __dirname), _config.languageTag + '.json'),
      JSON.stringify({}, null, 1),
      'utf8'
    );
    
    loadedLanguage = JSON.parse(
      fs.readFileSync(
        path.join((_config.langDir ? _config.langDir : __dirname), _config.languageTag + '.json'),
        'utf8'
      )
    );
  }
}