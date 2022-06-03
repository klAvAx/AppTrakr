import React, { useRef, useState } from "react";
import { Switch, Transition } from "@headlessui/react";

import I18N, { getLangList, getTranslation } from "../extra/I18N";
import icons from "../extra/typeIcons";

import { useDispatch, useSelector } from "react-redux";
import { toggleAppSetting, setAppSetting } from "../redux/reducers/electron";

import { FaPlus } from "react-icons/fa";
import SelectList from "../Components/SelectList";
import SimpleDataList from "../Components/SimpleDataList";
import Button from "../Components/Button";
import { requestNewStatisticsList } from "../redux/reducers/processList";

const languages = () => {
  const langList = getLangList().map((lang) => {
    return { name: <I18N index={`general_lang_text_${lang.value.toLowerCase()}`} text={lang.value} />, value: lang.index };
  });
  
  langList.splice(1, 0, { name: ">--------------------<", disabled: true });
  
  return langList;
};

function SettingsPage() {
  const dispatch = useDispatch();
  const appSettings = useSelector(({ electron }) => electron.settings);
  const groups = useSelector(({ simpleDataList }) => simpleDataList?.groups);
  
  const newGroupButton = useRef();
  const newRuleButton = useRef();
  
  const group1 = useRef();
  const group2 = useRef();
  
  const [rulesShouldUpdate, setRulesShouldUpdate] = useState(false);
  
  return (
    <div className="container mx-auto p-4 relative z-1250 overflow-x-hidden">
      <div className="p-2 columns-1 border-2 rounded-lg border-slate-400 bg-slate-200">
        <div className="columns-1">
          <h2 className="text-center text-2xl font-bold">
            <I18N index="settings_heading_general_group" text="General" />
          </h2>
        </div>
        <div className="mt-3 flex gap-4 items-center">
          <div className="text-right w-full">
            <I18N index="settings_label_auto_start" text="App Start On Boot"/>
          </div>
          <div className="text-left w-full">
            <Switch checked={appSettings.appAutoStart} onChange={() => dispatch(toggleAppSetting("appAutoStart"))} className={`${appSettings.appAutoStart ? 'bg-green-300' : 'bg-red-300'} relative inline-flex items-center h-6 rounded-full w-12`}>
              <span className="sr-only">{appSettings.appAutoStart ? getTranslation('settings_disable_auto_start', 'Disable auto start') : getTranslation('settings_enable_auto_start', 'Enable auto start')}</span>
              <span className={`${appSettings.appAutoStart ? 'translate-x-7 bg-green-600' : 'translate-x-1 bg-red-600'} inline-block w-4 h-4 transform transition rounded-full`} aria-hidden="true" />
            </Switch>
          </div>
        </div>
        <div className="mt-3 flex gap-4 items-center">
          <div className="text-right w-full">
            <I18N index="settings_label_language" text="Language"/>
          </div>
          <div className="text-left w-full">
            <SelectList items={languages()} selected={appSettings.appLang} onChoose={(choice) => dispatch(setAppSetting({setting: "appLang", value: choice}))} />
          </div>
        </div>
      </div>
      
      <div className="mt-3 p-2 columns-1 border-2 rounded-lg border-slate-400 bg-slate-200">
        <div className="columns-1">
          <h2 className="text-center text-2xl font-bold">
            <I18N index="settings_heading_process_list_group" text="Process List" />
          </h2>
        </div>
        <div className="mt-3 flex gap-4 items-center">
          <div className="text-right w-full">
            <I18N index="settings_label_initial_read_delay" text="Initial Read Delay" />
          </div>
          <div className="text-left w-full">
            <div className="inline-flex">
              <input
                type="number" min={0} max={60} step={0.001} value={appSettings.appProcessListInitial}
                onChange={(e) => dispatch(setAppSetting({setting: "appProcessListInitial", value: e.target.value}))}
                className="border-[1px] border-slate-500 rounded-l-lg pl-2 w-21"
              />
              <div className="border-[1px] border-l-0 border-slate-500 rounded-r-lg px-2 bg-slate-300 w-6">
                <I18N index="general_time_unit_seconds" text="s" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-4 items-center">
          <div className="text-right w-full">
            <I18N index="settings_label_recurring_read_delay" text="Recurring Read Delay" />
          </div>
          <div className="text-left w-full">
            <div className="inline-flex">
              <input
                type="number" min={0} max={60} step={0.001} value={appSettings.appProcessListRecurring}
                onChange={(e) => dispatch(setAppSetting({setting: "appProcessListRecurring", value: e.target.value}))}
                className="border-[1px] border-slate-500 rounded-l-lg pl-2 w-21"
              />
              <div className="border-[1px] border-l-0 border-slate-500 rounded-r-lg px-2 bg-slate-300 w-6">
                <I18N index="general_time_unit_seconds" text="s" />
              </div>
            </div>
          </div>
        </div>
      </div>
  
      <div className="mt-3 p-2 columns-1 border-2 rounded-lg border-slate-400 bg-slate-200">
        <div className="columns-1">
          <h2 className="text-center text-2xl font-bold">
            <I18N index="settings_heading_statistics_group" text="Statistics" />
          </h2>
        </div>
        <div className="mt-3 flex gap-4 items-center">
          <div className="text-right w-full">
            <I18N index="settings_label_latest_title_count" text="Latest Title Count" />
          </div>
          <div className="text-left w-full">
            <div className="inline-flex">
              <input
                type="number" min={0} max={100} step={1} value={appSettings.appStatisticsLatestTitleCount}
                onChange={(e) => dispatch(setAppSetting({setting: "appStatisticsLatestTitleCount", value: e.target.value}))}
                className="border-[1px] border-slate-500 rounded-lg pl-2 w-27"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-4 items-center">
          <div className="text-right w-full">
            <I18N index="settings_label_show_elapsed_days" text="Show elapsed time days"/>
          </div>
          <div className="text-left w-full">
            <Switch checked={appSettings.appStatisticsShowElapsedDays} onChange={() => dispatch(toggleAppSetting("appStatisticsShowElapsedDays"))} className={`${appSettings.appStatisticsShowElapsedDays ? 'bg-green-300' : 'bg-red-300'} relative inline-flex items-center h-6 rounded-full w-12`}>
              <span className="sr-only">{appSettings.appStatisticsShowElapsedDays ? getTranslation('settings_disable', 'Disable') : getTranslation('settings_enable', 'Enable')}</span>
              <span className={`${appSettings.appStatisticsShowElapsedDays ? 'translate-x-7 bg-green-600' : 'translate-x-1 bg-red-600'} inline-block w-4 h-4 transform transition rounded-full`} aria-hidden="true" />
            </Switch>
          </div>
        </div>
        <div className="mt-3 flex gap-4 items-center">
          <div className="text-right w-full">
            <I18N index="settings_label_collapsed_group_by_default" text="Groups are collapsed by default"/>
          </div>
          <div className="text-left w-full">
            <Switch checked={appSettings.appStatisticsCollapsedGroupsByDefault} onChange={() => dispatch(toggleAppSetting("appStatisticsCollapsedGroupsByDefault"))} className={`${appSettings.appStatisticsCollapsedGroupsByDefault ? 'bg-green-300' : 'bg-red-300'} relative inline-flex items-center h-6 rounded-full w-12`}>
              <span className="sr-only">{appSettings.appStatisticsCollapsedGroupsByDefault ? getTranslation('settings_disable', 'Disable') : getTranslation('settings_enable', 'Enable')}</span>
              <span className={`${appSettings.appStatisticsCollapsedGroupsByDefault ? 'translate-x-7 bg-green-600' : 'translate-x-1 bg-red-600'} inline-block w-4 h-4 transform transition rounded-full`} aria-hidden="true" />
            </Switch>
          </div>
        </div>
      </div>
      
      <div ref={group1} className="mt-3 p-2 columns-1 border-2 rounded-lg border-slate-400 bg-slate-200">
        <div className="flex columns-1 relative justify-center">
          <h2 className="justify-middle text-2xl font-bold">
            <I18N index="settings_heading_process_tracking_groups_group" text="Process Tracking Groups"/>
          </h2>
          <div className="absolute flex self-center justify-middle right-0">
            <Button ref={newGroupButton} title={getTranslation('general_text_new_x', 'New %s').replace("%s", getTranslation('general_text_group', 'Group').toLowerCase())} className="w-[32px] h-[32px]">
              <span className="sr-only">{getTranslation('general_text_new_x').replace("%s", getTranslation('general_text_group').toLowerCase())}</span>
              <FaPlus className="block w-[24px] h-[24px]" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="mt-3 columns-1">
          <SimpleDataList
            type="Groups"
            items={[
              {
                name: "name",
                type: "input",
                placeholder: getTranslation('general_text_group_name', 'Group name')
              }
            ]}
            nameKey="name"
            visibleData={[
              { key: "name", type: "text" }
            ]}
            newButton={newGroupButton}
            onDelete={() => {
              setRulesShouldUpdate(true);
              dispatch(requestNewStatisticsList());
            }}
            confirmMessages={{
              title: getTranslation('general_text_are_you_sure_you_want_to_remove_this_x', 'Are you sure you want to remove this %s?').replace("%s", getTranslation('general_text_group').toLowerCase()),
              message: getTranslation('general_text_this_will_also_remove_associated_data', 'This action will also remove associated data!')
            }}
          />
        </div>
        <Transition
          as={React.Fragment}
          show={appSettings.appRecordingProcesses}
          enter="transition duration-250 ease-in"
          enterFrom="transform scale-90 opacity-0"
          enterTo="transform scale-100 opacity-100"
          leave="transition duration-200 ease-out"
          leaveFrom="transform scale-100 opacity-100"
          leaveTo="transform scale-90 opacity-0"
          beforeEnter={() => {
            group1.current.className += ' relative';
          }}
          afterLeave={() => {
            group1.current.className = group1.current.className.replace(' relative', '');
          }}
        >
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center backdrop-blur-md rounded-lg">
            <h2 className="text-center text-2xl font-bold">
              <I18N index="general_text_setting_not_editable_while_recording" text="This Setting is not editable during process recording" />
            </h2>
          </div>
        </Transition>
      </div>
      
      <div ref={group2} className="mt-3 p-2 columns-1 border-2 rounded-lg border-slate-400 bg-slate-200">
        <div className="flex columns-1 relative justify-center">
          <h2 className="justify-middle text-2xl font-bold">
            <I18N index="settings_heading_process_tracking_rules_group" text="Process Tracking Rules"/>
          </h2>
          <div className="absolute flex self-center justify-middle right-0">
            <Button ref={newRuleButton} title={getTranslation('general_text_new_x').replace("%s", getTranslation('general_text_rule', 'Rule').toLowerCase())} className="w-[32px] h-[32px]">
              <span className="sr-only">{getTranslation('general_text_new_x').replace("%s", getTranslation('general_text_rule').toLowerCase())}</span>
              <FaPlus className="block w-[24px] h-[24px]" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="mt-3 columns-1">
          <SimpleDataList
            type="Rules"
            items={[
              {
                name: "group_id",
                type: "select",
                emptyTxt: getTranslation('general_text_select_x', 'Please select %s').replace("%s", getTranslation('general_text_group', 'Group').toLowerCase()),
                options: groups
              },
              {
                name: "type",
                type: "select",
                emptyTxt: getTranslation('general_text_select_x').replace("%s", getTranslation('general_text_rule_type', 'Rule Type').toLowerCase()),
                options: {
                  "exec": getTranslation('general_text_exec_rule_type', 'Executable'),
                  "rule": getTranslation('general_text_rule_rule_type', 'Regular expression')
                },
                requires: ['group_id']
              },
              {
                name: "rule",
                type: "input",
                placeholder: {
                  "type": {
                    "exec": getTranslation('general_text_exec_exact_name', 'Exact Executable Name'),
                    "rule": getTranslation('general_text_rule_regexp', 'Rule Regex')
                  }
                },
                requires: ['group_id', 'type']
              }
            ]}
            nameKey="rule"
            visibleData={[
              { key: "type", type: "icon", icons: icons},
              { key: "rule", type: "text" },
              { key: "group_id", type: "subtitle", getter: groups }
            ]}
            newButton={newRuleButton}
            shouldUpdate={rulesShouldUpdate}
            onUpdate={() => setRulesShouldUpdate(false)}
            onDelete={() => dispatch(requestNewStatisticsList())}
            confirmMessages={{
              title: getTranslation('general_text_are_you_sure_you_want_to_remove_this_x', 'Are you sure you want to remove this %s?').replace("%s", getTranslation('general_text_rule').toLowerCase()),
              message: getTranslation('general_text_this_will_also_remove_associated_data', 'This action will also remove associated data!')
            }}
          />
        </div>
        <Transition
          as={React.Fragment}
          show={appSettings.appRecordingProcesses}
          enter="transition duration-250 ease-in"
          enterFrom="transform scale-90 opacity-0"
          enterTo="transform scale-100 opacity-100"
          leave="transition duration-200 ease-out"
          leaveFrom="transform scale-100 opacity-100"
          leaveTo="transform scale-90 opacity-0"
          beforeEnter={() => {
            group2.current.className += ' relative';
          }}
          afterLeave={() => {
            group2.current.className = group2.current.className.replace(' relative', '');
          }}
        >
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center backdrop-blur-md rounded-lg">
            <h2 className="text-center text-2xl font-bold">
              <I18N index="general_text_setting_not_editable_while_recording" text="This Setting is not editable during process recording" />
            </h2>
          </div>
        </Transition>
      </div>
    </div>
  );
}

export default SettingsPage;