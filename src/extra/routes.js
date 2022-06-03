import React from "react";
import I18N from "./I18N";

import IndexPage from "./../Pages/Index";
import StatisticsPage from "./../Pages/Statistics";
import ProcessListPage from "./../Pages/ProcessList";
import SettingsPage from "./../Pages/Settings";

const routes = [
  { title: "Dashboard", name: <I18N index="header_menu_item_dashboard" text="Dashboard"/>, href: '/', component: IndexPage },
  { title: "Statistics", name: <I18N index="header_menu_item_statistics" text="Statistics"/>, href: '/statistics', component: StatisticsPage },
  { title: "Detected Processes", name: <I18N index="header_menu_item_processlist" text="Detected Processes"/>, href: '/processlist', component: ProcessListPage },
  { title: "Settings", name: <I18N index="header_menu_item_settings" text="Settings"/>, href: '/settings', component: SettingsPage }
];

export default routes;