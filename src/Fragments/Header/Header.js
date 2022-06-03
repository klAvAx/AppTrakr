import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useLocation } from "react-router-dom";

import { toggleBackdrop } from "../../redux/reducers/UI";
import { toggleAppSetting } from "../../redux/reducers/electron";

import { Transition } from "@headlessui/react";

import { HiMenu, HiX } from 'react-icons/hi';
import { FaCircle } from 'react-icons/fa';
import { BsPinAngle, BsPinAngleFill } from 'react-icons/bs';

import routes from "../../extra/routes";
import I18N, { getTranslation } from "../../extra/I18N";

export default function Header() {
  const [show, setShow] = useState(false);
  const dispatch = useDispatch();
  
  const backdropShouldClose = useSelector(({ UI }) => UI.backdrop.wantsToClose);
  
  const appVersion = useSelector(({ electron }) => electron.settings.appVersion);
  const isPinned = useSelector(({ electron }) => electron.settings.appIsPinned);
  const isRecording = useSelector(({ electron }) => electron.settings.appRecordingProcesses);
  const isRecordButtonDisabled = useSelector(({ UI }) => UI.header.recordButtonDisabled);
  
  const location = useLocation();
  
  const updateTitle = (newTitle) => {
    let title = document.getElementsByTagName('title')[0];
    title.innerText = newTitle;
  }
  
  useEffect(() => {
    dispatch(toggleBackdrop(show));
  }, [show]);
  
  useEffect(() => {
    if (backdropShouldClose && show) {
      setShow(false);
    }
  }, [backdropShouldClose]);
  
  useEffect(() => {
    const appName = "App Trackr";
    if(location.pathname === "/") {
      updateTitle(appName);
    } else {
      updateTitle(`${appName} - ${routes.find((route) => route.href === location.pathname)?.title}`);
    }
  }, [location.pathname]);
  
  return (
    <React.Fragment>
      <nav className="fixed top-0 left-0 right-0 z-1500">
        <div className="relative">
          <div className="relative bg-gray-800 max-w-7xl mx-auto px-2 z-1500 appDragRegion">
            <div className="max-w-7xl mx-auto px-2">
              <div className="relative flex items-center justify-between h-16">
                <div className="absolute inset-y-0 left-0 flex items-center appNoDragRegion">
                  <button
                    title={show ? getTranslation('header_menu_hide', 'Hide main menu') : getTranslation('header_menu_show', 'Show main menu')}
                    onClick={() => setShow(!show)}
                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
                  >
                    <span className="sr-only">{show ? getTranslation('header_menu_hide') : getTranslation('header_menu_show')}</span>
                    {show ? <HiX className="block h-6 w-6" aria-hidden="true" /> : <HiMenu className="block h-6 w-6" aria-hidden="true" />}
                  </button>
                </div>
                <div className="flex-1 px-24 flex items-center justify-center">
                  <div className="flex-shrink-0 flex items-center text-white font-black">
                    {location.pathname !== "/" ? routes.find((route) => route.href === location.pathname)?.name : "App Trackr"}
                  </div>
                </div>
                <div className="absolute inset-y-0 right-12 flex items-center appNoDragRegion">
                  <button
                    title={isPinned ? getTranslation('header_button_title_unpin_app', 'Unpin App') : getTranslation('header_button_title_pin_app', 'Pin App')}
                    onClick={() => dispatch(toggleAppSetting("appIsPinned"))}
                    className={`inline-flex items-center justify-center p-2 rounded-md transition transform ${isPinned ? '-rotate-45 text-white hover:text-gray-400' : 'text-gray-400 hover:text-white'} `}
                  >
                    <span className="sr-only">{isPinned ? getTranslation('header_button_title_unpin_app') : getTranslation('header_button_title_pin_app')}</span>
                    {isPinned ? <BsPinAngleFill className="block h-6 w-6" aria-hidden="true" /> : <BsPinAngle className="block h-6 w-6" aria-hidden="true" />}
                  </button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center appNoDragRegion">
                  <button
                    title={isRecording ? getTranslation('header_button_title_stop_recording', 'Stop Recording') : getTranslation('header_button_title_start_recording', 'Start Recording')}
                    disabled={isRecordButtonDisabled}
                    onClick={() => dispatch(toggleAppSetting("appRecordingProcesses"))}
                    className={`inline-flex items-center justify-center p-2 rounded-md transition-colors ${isRecording ? 'animate-pulse text-red-600 hover:text-red-400' : `text-gray-400 ${!isRecordButtonDisabled ? 'hover:text-white' : ''}`}`}
                  >
                    <span className="sr-only">{isRecording ? getTranslation('header_button_title_stop_recording') : getTranslation('header_button_title_start_recording') }</span>
                    <FaCircle className="block h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <Transition
            as={React.Fragment}
            show={show}
            enter="transition duration-250 ease-out"
            enterFrom="transform -translate-y-full scale-90 opacity-0"
            enterTo="transform translate-y-0 scale-100 opacity-100"
            leave="transition duration-250 ease-in"
            leaveFrom="transform translate-y-0 scale-100 opacity-100"
            leaveTo="transform -translate-y-full scale-90 opacity-0"
          >
            <div className={`absolute top-16 left-0 right-0 bg-gray-800 z-1499`}>
              <div className="px-4 pt-3 pb-1 space-y-2">
                {routes.map((item, index) => (
                  <NavLink
                    key={index}
                    to={item.href}
                    className={`${item.href === location.pathname ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"} block px-3 py-2 rounded-md text-base font-medium`}
                    aria-current={item.href === location.pathname ? "true" : "page"}
                    onClick={() => setShow(false)}
                  >
                    {item.name}
                  </NavLink>
                ))}
              </div>
              <div className='w-full pr-2 pb-1 text-right text-gray-400'>
                v{appVersion}
              </div>
            </div>
          </Transition>
        </div>
      </nav>
    </React.Fragment>
  )
}