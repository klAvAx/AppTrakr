AppTrakr
============
Node.js Application to track process runtime with Electron.js app Framework and React.js frontend.

![Chat Preview](https://github.com/klAvAx/AppTrakr/raw/main/assets/img/installer_256x256.png)

---

## Features
- Internationalisation
- Rule Category Grouping
- Tracking based on Window title regex or Executable name
- Configurable process list update interval
- Opt-in Internet connectivity for Discord Rich Presence
- Windows & Linux support
- Other awesome features yet to be implemented

---

## Setup

Install one of precompiled versions for an out of the box experience!

### OR

Clone this repo to your desktop, provide your Discord App ID in app.js if you wish to have Customizable Discord Rich Presence then run `npm install` to install all base app dependencies.  
Clone ui submodule to ui subfolder in the same directory as app.js is located at and run `npm install`  
In the root directory where app.js is run `npm run distribute` to compile and get installation files.  

##### NOTE:
Be sure to have these assets defined **without** double quotes in Rich presence art assets over on discord dev portal: "apptrakr_chip", "apptrakr_game", "apptrakr_movie", "apptrakr_music", "apptrakr_work"

---

## Usage

- Dashboard - generalized category and rule overview view.
- Statistics - this view will show all recorded/gathered statistics with ability to clear an category or filter it.
- Detected Processes - will show what app has detected as an running process.
- Settings - this will let you customize app settings such as:
  - Tracking categories
  - Tracking rules
  - Internet Connectivity opt-in
  - Tray icon click action
  - App color scheme
  - Process reading interval
  - Statistic View parameters
  - Log retention period

---

## License
>You can check out the full license [here](https://github.com/klAvAx/AppTrakr/blob/main/LICENSE)

This project is licensed under the terms of the **GNU GPL v3** license.
