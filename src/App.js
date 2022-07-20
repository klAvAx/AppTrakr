import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { getAppSettings } from "./redux/reducers/electron";
import { updateRunningList, updateStatisticsList } from "./redux/reducers/processList";

import routes from "./extra/routes";

import Header from "./Fragments/Header/Header";
import Notification from "./Components/Notification";
import Backdrop from "./Components/Backdrop";
import Tooltip from "./Components/Tooltip";

// TODO some language lines require inflections
// TODO update whole app into separate Electron & UI repos
// TODO restructure the whole app
function App() {
  const isDev = useSelector(({ electron }) => electron.settings.appIsDev);
  const dispatch = useDispatch();
  
  useEffect(() => {
    // Runs once On Mount
    dispatch(getAppSettings());
    
    // Electron to React Listener
    window.ipcRenderer.on('electron', (event, data) => {
      switch(data.type) {
        case "runningListUpdate":
          dispatch(updateRunningList(data.payload));
          break;
        case 'statisticsListUpdate':
          dispatch(updateStatisticsList(data.payload));
          break;
        default:
          if (isDev) {
            console.log("ipcRenderer", "onElectron", data);
          }
          break;
      }
    });
    
    return () => {
      // Runs once on Destroy
    }
  }, []);
  
  return (
    <React.Fragment>
      <Header />
      <div id="mainContainer" className="2xl:container border-[1px] border-t-0 border-gray-800 mx-auto">
        <Switch>
          {routes.map((item, index) => (
            <Route key={index} exact={item.href === "/" ? true : null} path={item.href} component={item.component} />
          ))}
          <Redirect from="*.html" to="/" />
        </Switch>
      </div>
      <Backdrop />
      <Notification />
    </React.Fragment>
  );
}

export default App;
