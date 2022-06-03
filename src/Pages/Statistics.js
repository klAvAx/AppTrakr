import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import I18N, { getTranslation } from "../extra/I18N";

import { FaAngleDown, FaClock, FaFileExport, FaTimes } from "react-icons/fa";
import { TbArrowBarDown } from "react-icons/tb";
import { MdOutlineExpand } from "react-icons/md";

import { confirm } from "../Components/Confirm";
import Marquee from "../Components/Marquee";

import { setNotification, toggleCollapsed, setGroupOffset, deleteGroupData, resetNotification } from "../redux/reducers/UI";
import { requestNewStatisticsList } from "../redux/reducers/processList";

// TODO implement statistics export !!!
function StatisticsPage() {
  const dispatch = useDispatch();
  const statisticsList = useSelector(({ process }) => process.statistics);
  const collapsed = useSelector(({ UI }) => UI.collapsed?.statistics);
  const latestTitleCount = useSelector(({ electron }) => electron.settings?.appStatisticsLatestTitleCount);
  const collapsedGroupsByDefault = useSelector(({ electron }) => electron.settings?.appStatisticsCollapsedGroupsByDefault);
  const showElapsedDays = useSelector(({ electron }) => electron.settings?.appStatisticsShowElapsedDays);
  
  const padNumber = (number, digits = 2) => {
    let _number = number;
    
    if(digits > _number.toString().length) {
      return (("0".repeat(digits))+_number).slice(-digits);
    } else {
      return _number;
    }
  }
  
  const formatTimestampToElapsedTime = (timestamp, showDays = false) => {
    // [2022-01-13] Removed Days and instead shows more than 24 hours
    // [2022-01-27] Added Days back in via app settings
    if(!Number.isInteger(timestamp)) return timestamp;
    
    let Days = 0;
    let Hours;
    
    if(showDays) {
      Days = Math.floor(timestamp / (24 * 60 * 60 * 1000));
      Hours = Math.floor((timestamp / (60 * 60 * 1000)) % 24);
    } else {
      Hours = Math.floor((timestamp / (60 * 60 * 1000)));
    }
    
    let Minutes = Math.floor((timestamp / (60 * 1000)) % 60);
    let Seconds = Math.floor((timestamp / 1000) % 60);
    let Milliseconds = timestamp % 1000;
    
    let str = "";
    
    if(Days > 0) str += `${getTranslation(`general_text_x_day${Days > 1 ? "s" : ""}`, `%s Day${Days > 1 ? "s" : ""}`).replace("%s", Days)} `;
    
    str += `${padNumber(Hours)}:${padNumber(Minutes)}:${padNumber(Seconds)}`;
    
    if(Milliseconds > 0) str += `.${padNumber(Milliseconds, 3)}`;
    
    return str;
  }
  const formatTimestampToDate = (timestamp) => {
    let str = "";
    let date = new Date(timestamp);
  
    str += date.getFullYear();
    str += "-"+padNumber(date.getMonth() + 1);
    str += "-"+padNumber(date.getDate());
    str += " "+padNumber(date.getHours());
    str += ":"+padNumber(date.getMinutes());
    str += ":"+padNumber(date.getSeconds());
    
    return str;
  }
  
  // JS native timer/counter
  const timer = useRef(null);
  const timerFunc = () => {
    let elements = document.getElementsByClassName('jsTimer');
    
    for(const element of elements) {
      const html = element.innerHTML;
      
      let hours = parseInt(html.split(":")[0]);
      let minutes = parseInt(html.split(":")[1]);
      let seconds = parseInt((html.split(":")[2]).includes(".") ? (html.split(":")[2]).split(".")[0] : html.split(":")[2]);
      let millis = (html.split(":")[2]).includes(".") ? parseInt((html.split(":")[2]).split(".")[1]) : 0;
      
      if(isNaN(hours)) hours = 0;
      if(isNaN(minutes)) minutes = 0;
      if(isNaN(seconds)) seconds = 0;
      if(isNaN(millis)) millis = 0;
      
      seconds += 1;
      
      if(seconds === 60) {
        seconds = 0;
        minutes += 1;
      }
      
      if(minutes === 60) {
        minutes = 0;
        hours += 1;
      }
      
      element.innerHTML = `${padNumber(hours)}:${padNumber(minutes)}:${padNumber(seconds)}${millis > 0 ? `.${padNumber(millis, 3)}` : ''}`;
    }
    
    timer.current = setTimeout(timerFunc, 1000);
  }
  
  // stickyJS - workaround for sticky headers using 'position:fixed' instead of 'position:sticky',
  //            seems like 'position:sticky' is bugged OR I don't know how to do it "properly"
  const stickyJS = (headerOffset) => {
    const _clear = (header) => {
      header.removeAttribute("data-unstickify");
      header.removeAttribute("data-stickifyParentHeight");
  
      header.style.position = "";
      header.style.top = "";
      header.style.left = "";
      header.style.width = "";
  
      // Show collapse/expand button
      for(const item of header.getElementsByClassName("stickyJsHide")) {
        item.style.display = "";
      }
    }
    const _render = (scroll) => {
      const headers = document.getElementsByClassName("stickyJs");
  
      for(const header of headers) {
        const unstickScrollTop = header.getAttribute("data-unstickify");
        const parentHeight = header.getAttribute("data-stickifyParentHeight");
    
        if(unstickScrollTop && parentHeight) {
          if(header.style.position === "fixed") {
            const parentBottom = ((parseInt(parentHeight) + parseInt(unstickScrollTop)) - 8) - header.offsetHeight;
        
            // Check if element should be pushed up
            if(scroll >= parentBottom) {
              const pushUpAmount = Math.min(scroll - parentBottom, headerOffset);
          
              header.style.top = `${headerOffset - pushUpAmount}px`;
            } else {
              header.style.top = `${headerOffset}px`;
            }
        
            // Check if element should unstick (Reached top attachment point)
            if(scroll <= unstickScrollTop) {
              _clear(header);
            }
          }
        } else {
          // Check if element should be stuck
          if(header.style.position !== "fixed" && scroll > header.offsetParent.offsetTop) {
            const left = header.offsetParent.offsetLeft;
            const width = header.clientWidth;
        
            header.setAttribute("data-unstickify", header.offsetParent.offsetTop);
            header.setAttribute("data-stickifyParentHeight", header.offsetParent.offsetHeight);
        
            header.style.position = "fixed";
            header.style.top = `${headerOffset}px`;
            header.style.left = `${left + 3}px`;
            header.style.width = `${width}px`;
        
            // Hide collapse/expand button
            for(const item of header.getElementsByClassName("stickyJsHide")) {
              item.style.display = "none";
            }
          }
        }
      }
    }
    
    const _stickyJS = {
      onScroll: (event) => {
        const scroll = event.target.scrollTop;
    
        _render(scroll);
      },
      onResize: (targetElementID) => {
        _stickyJS.clear();
        
        const scroll = document.getElementById(targetElementID).scrollTop
        _render(scroll);
      },
      clear: () => {
        const headers = document.querySelectorAll('[data-unstickify][data-stickifyParentHeight]');
    
        for(const header of headers) {
          if(header.style.position === "fixed") {
            _clear(header);
          }
        }
      }
    }
    
    return _stickyJS;
  }
  const onScrollStickyJS = (event) => {
    stickyJS(64).onScroll(event);
  }
  const onResizeStickyJS = (event, targetElementID) => {
    stickyJS(64).onResize(targetElementID);
  }
  
  useEffect(() => {
    timerFunc();
    
    // stickyJS attach
    document.getElementById("mainContainer").addEventListener("scroll", onScrollStickyJS);
    window.addEventListener("resize", (event) => onResizeStickyJS(event, "mainContainer"));
    
    return () => {
      if(timer.current) clearTimeout(timer.current);
      
      // stickyJS detach
      document.getElementById("mainContainer").removeEventListener("scroll", onScrollStickyJS);
      window.removeEventListener("resize", (event) => onResizeStickyJS(event, "mainContainer"));
    }
  }, []);
  
  const constructTitles = (processID, process, currentTime) => {
    const _latestTitleCount = (!isNaN(parseInt(latestTitleCount)) ? parseInt(latestTitleCount) : 3);
  
    const titleID = `${processID}T`;
    const _expanded = collapsed?.[titleID];
    
    const titles = process.processMeta.Title;
    const titleCount = Object.keys(titles).length;
    const expandable = titleCount > _latestTitleCount;
    
    let hiddenTitles = [];
    let visibleTitles = [];
    
    Object.keys(titles).forEach((titleTimestamp, titleTimestampIndex) => {
      const lastTimestampIndex = Object.keys(titles).length - 1;
      let runtime;
  
      if(titleTimestampIndex < lastTimestampIndex) {
        runtime = Object.keys(titles)[titleTimestampIndex + 1] - titleTimestamp;
      } else {
        if(process.stoppedAt) {
          runtime = process.stoppedAt - titleTimestamp;
        } else {
          runtime = currentTime - titleTimestamp;
        }
      }
      
      const html = (
        <div key={`title_${titleTimestampIndex}`} className='flex w-full'>
          <div className='w-full mr-2'><Marquee text={process.processMeta.Title[titleTimestamp]} /></div>
          <div className={`text-right whitespace-nowrap ${process.startedAt && process.stoppedAt ? '' : (titleTimestampIndex === lastTimestampIndex ? 'jsTimer' : '')}`}>
            {formatTimestampToElapsedTime(runtime)}
          </div>
        </div>
      );
      
      if(expandable) {
        if(titleTimestampIndex < (lastTimestampIndex - (_latestTitleCount - 1))) {
          hiddenTitles.push(html);
        } else {
          visibleTitles.push(html);
        }
      } else {
        visibleTitles.push(html);
      }
    });
    
    return (
      <React.Fragment>
        <h3
          title={expandable ? (_expanded ? getTranslation('general_text_expand', 'Expand') : getTranslation('general_text_collapse', 'Collapse')) : null}
          className={`w-full text-center font-bold relative whitespace-nowrap transition-colors hover:bg-slate-300 ${expandable ? "cursor-pointer" : ""}`}
          onClick={expandable ? () => dispatch(toggleCollapsed({group: 'statistics', key: titleID})) : null}
        >
          <I18N index='statistics_heading_window_title_changes_and_durations' text='Window Title Changes & Durations' />
          {expandable ? (
            <div className="absolute right-0 top-0 w-6 h-6 transition-colors hover:text-slate-50">
              <FaAngleDown className={`w-full h-full transition ${_expanded ? 'rotate-180' : 'rotate-0'}`} aria-hidden="true" />
            </div>
          ) : null}
        </h3>
        <div className="w-full mt-2">
          {expandable ? (
            <React.Fragment>
              {_expanded ? <div className='h-auto border-b-2 border-slate-400 overflow-hidden'>{hiddenTitles}</div> : null}
              <div>
                {visibleTitles}
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              {visibleTitles}
            </React.Fragment>
          )}
        </div>
      </React.Fragment>
    );
  }
  
  const constructList = () => {
    let sorted = {};
    
    // Preprocess List a little
    for(const item of statisticsList) {
      const { group_id, group_name, group_offset, ...rest } = item;
  
      // Expand JSON Object
      rest['processMeta'] = JSON.parse(rest['processMeta']);
      
      if(sorted[group_id] === undefined) {
        sorted[group_id] = {
          groupId: group_id,
          groupName: group_name,
          groupOffset: group_offset,
          groupRuntime: 0,
          items: []
        };
      }
      
      sorted[group_id]['groupRuntime'] += (rest.startedAt && rest.stoppedAt ? rest.stoppedAt - rest.startedAt : 0);
      sorted[group_id]['items'].push({ ...rest });
    }
    
    return (
      <React.Fragment>
        {Object.keys(sorted).map((group, groupIndex) => {
          const groupID = `G${groupIndex}`;
          const _collapsed = (collapsedGroupsByDefault ? !collapsed?.[groupID] : collapsed?.[groupID]);
          const currentTime = new Date().getTime();
          
          return (
            <div
              key={`group_${groupIndex}`}
              className={`relative pb-0 columns-1 border-2 rounded-lg border-slate-400 bg-slate-200 ${groupIndex > 0 ? 'mt-4' : ''}`}
            >
              <div className={`absolute top-0 inset-x-0 p-2 flex border-b-2 border-slate-400 bg-slate-350 font-bold z-1000 ${_collapsed ? '' : 'stickyJs'}`}>
                <div
                  title={getTranslation('statistics_text_total_runtime_x', 'Total Runtime: %s').replace('%s', formatTimestampToElapsedTime(sorted[group].groupRuntime, showElapsedDays))}
                  className="w-6 h-6 mr-2"
                >
                  <span className='sr-only'>{getTranslation('statistics_text_total_runtime_x').replace('%s', formatTimestampToElapsedTime(sorted[group].groupRuntime, showElapsedDays))}</span>
                  <FaClock className='w-full h-full' aria-hidden='true' />
                </div>
                <div className="w-full truncate mr-2">{sorted[group].groupName}</div>
                {
                  sorted[group].groupOffset ?
                    <button
                      title={getTranslation("general_text_reset_view_offset", "Reset View Offset")}
                      className='w-6 h-6 transition-colors hover:text-slate-50'
                      onClick={() => {dispatch(setGroupOffset({groupID: group, groupOffset: 0}))}}
                    >
                      <span className='sr-only'>{getTranslation('general_text_reset_view_offset')}</span>
                      <MdOutlineExpand className={`w-full h-full`} aria-hidden="true" />
                    </button> :
                    null
                }
                <button
                  title={getTranslation("general_text_delete_group_data", "Delete Collected Group Data")}
                  className='w-6 h-6 ml-2 transition-colors hover:text-slate-50'
                  onClick={() => {
                    confirm({
                      title: getTranslation('general_message_text_are_you_sure', 'Are You Sure?'),
                      message: getTranslation('general_message_text_delete_group_data', 'This WILL delete all group Data!'),
                      confirmButton: async () => {
                        let response = await dispatch(deleteGroupData(group));
                        
                        if(typeof response.payload.response === "number" && response.payload.response > 0) {
                          dispatch(requestNewStatisticsList());
                          dispatch(setNotification({
                            message: `general_message_text_data_deleted`,
                            bottomOffset: 0
                          }));
                        } else {
                          dispatch(setNotification({
                            message: `general_message_text_data_delete_fail`,
                            bottomOffset: 0
                          }));
                        }
                      },
                      onShow: () => {
                        dispatch(resetNotification());
                      }
                    });
                  }}
                >
                  <span className='sr-only'>{getTranslation('general_text_delete_group_data')}</span>
                  <FaTimes className={`w-full h-full`} aria-hidden="true" />
                </button>
                <button
                  title={getTranslation("general_text_export_csv", "Export CSV")}
                  className='w-6 h-6 ml-2 transition-colors hover:text-slate-50'
                  onClick={() => dispatch(setNotification({message: "TODO export group CSV", translatable: false}))}
                >
                  <span className='sr-only'>{getTranslation('general_text_export_csv')}</span>
                  <FaFileExport className={`w-full h-full`} aria-hidden="true" />
                </button>
                <button
                  title={_collapsed ? getTranslation('general_text_expand', 'Expand') : getTranslation('general_text_collapse', 'Collapse')}
                  className={`w-6 h-6 ml-2 transition-colors hover:text-slate-50 ${_collapsed ? '' : 'stickyJsHide'}`}
                  onClick={() => dispatch(toggleCollapsed({group: 'statistics', key: groupID}))}
                >
                  <span className='sr-only'>{ _collapsed ? getTranslation('general_text_expand') : getTranslation('general_text_collapse') }</span>
                  <FaAngleDown className={`w-full h-full transition ${_collapsed ? 'rotate-0' : 'rotate-180'}`} aria-hidden="true" />
                </button>
              </div>
              <div className={`${_collapsed ? 'h-0 mt-[42px]' : 'h-auto mt-12'} overflow-hidden z-999`}>
                {sorted[group].items.map((process, processIndex) => {
                  const processID = `G${groupIndex}P${processIndex}`;
                  const _collapsedProcess = collapsed?.[processID];
                  
                  return (
                    <div
                      key={`process_${processIndex}`}
                      className={`py-1 px-2 ${processIndex > 0 ? 'mt-2' : ''} ${processIndex < (sorted[group].items.length - 1) ? `border-b-2 border-slate-400` : ''}`}
                    >
                      <div className="flex w-full flex-col">
                          <h2 className="w-full mb-2 px-12 text-center text-xl font-bold relative whitespace-nowrap transition-colors hover:bg-slate-300">
                            <div
                              title={_collapsedProcess ? getTranslation('general_text_expand', 'Expand') : getTranslation('general_text_collapse', 'Collapse')}
                              className={`absolute top-0 bottom-0 left-0 right-12 cursor-pointer`}
                              onClick={() => {dispatch(toggleCollapsed({group: 'statistics', key: processID}))}}
                            />
                            <I18N index='statistics_heading_process_details' text='Process Details' />
                            <div className="absolute flex right-0 top-[2px] w-12 h-6 transition-colors">
                              <TbArrowBarDown
                                title={getTranslation('general_text_apply_tracking_offset', 'Apply Tracking Offset From this Point (INCLUSIVE)')}
                                className={`w-6 h-full transition hover:text-slate-50 cursor-pointer`}
                                aria-hidden="true"
                                onClick={() => {dispatch(setGroupOffset({groupID: group, groupOffset: process.startedAt}))}}
                              />
                              <FaAngleDown
                                title={_collapsedProcess ? getTranslation('general_text_expand', 'Expand') : getTranslation('general_text_collapse', 'Collapse')}
                                className={`w-6 h-full transition hover:text-slate-50 cursor-pointer ${_collapsedProcess ? 'rotate-0' : 'rotate-180'}`}
                                aria-hidden="true"
                                onClick={() => {dispatch(toggleCollapsed({group: 'statistics', key: processID}))}}
                              />
                            </div>
                          </h2>
                          <div className={`${_collapsedProcess ? 'h-0' : 'h-auto'} overflow-hidden`}>
                            {typeof process.processMeta.Title === "string" ? (
                              <React.Fragment>
                                <h3 className="w-full text-center font-bold whitespace-nowrap">
                                  <I18N index='statistics_heading_window_title' text='Window Title' />
                                </h3>
                                <div className="w-full mt-2">
                                  <Marquee text={process.processMeta.Title} />
                                </div>
                              </React.Fragment>
                            ) : constructTitles(processID, process, currentTime)}
                            <div className='flex w-full mt-2'>
                              <div className='flex w-full flex-col'>
                                <h2 className="w-full text-center font-bold mr-2 whitespace-nowrap">
                                  <I18N index='statistics_heading_started_at' text='Started At' />
                                </h2>
                                <div className='w-full truncate text-center'>
                                  {formatTimestampToDate(process.startedAt)}
                                </div>
                              </div>
                              <div className='flex w-full flex-col'>
                                <h2 className="w-full text-center font-bold mr-2 whitespace-nowrap">
                                  <I18N index='statistics_heading_total_runtime' text='Total Runtime' />
                                </h2>
                                <div className={`w-full truncate text-center ${process.startedAt && process.stoppedAt ? '' : 'jsTimer'}`}>
                                  {process.startedAt && process.stoppedAt ?
                                    formatTimestampToElapsedTime(process.stoppedAt - process.startedAt) :
                                    formatTimestampToElapsedTime(currentTime - process.startedAt)
                                  }
                                </div>
                              </div>
                              <div className='flex w-full flex-col'>
                                <h2 className="w-full text-center font-bold mr-2 whitespace-nowrap">
                                  <I18N index='statistics_heading_stopped_at' text='Stopped At' />
                                </h2>
                                <div className='w-full truncate text-center'>
                                  {process.stoppedAt ? formatTimestampToDate(process.stoppedAt) : getTranslation('statistics_text_still_running', 'Still Running')}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </React.Fragment>
    );
  }
  
  return (
    <React.Fragment>
      <div className="container mx-auto px-4 my-4 z-1250">
        {statisticsList?.length > 0 ? constructList() : (
          <div className="text-center text-xl font-bold">
            <div className="block">
              <I18N index="statistics_heading_no_stats_to_show" text="There Are No Statistics that can be shown, Yet..." />
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

export default StatisticsPage;