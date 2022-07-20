import PropTypes from "prop-types";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { disableRecordButton, enableRecordButton, resetNotification, setNotification } from "../redux/reducers/UI";
import { getDataOfType, setData, deleteData } from "../redux/reducers/simpleDataList";

import { confirm } from "./Confirm";
import Tooltip from "./Tooltip";

import { FaEdit, FaTimes } from "react-icons/fa";

import I18N, { getTranslation } from "../extra/I18N";
import MiniModal from "./MiniModal";

function SimpleDataList({ type, nameKey, items, visibleData, newButtonState, onOpenNewModal, shouldUpdate, onDelete, onUpdate, confirmMessages }) {
  const [modal, setModal] = useState(false);
  const [modalEditID, setModalEditID] = useState(0);
  
  const [buttonsHeightOffset, setButtonsHeightOffset] = useState({});
  const button1 = useRef();
  const button2 = useRef();
  
  const dispatch = useDispatch();
  const data = useSelector(({ simpleDataList }) => simpleDataList[type.toLowerCase()] ? simpleDataList[type.toLowerCase()] : []);
  const isDev = useSelector(({ electron }) => electron.settings.appIsDev);
  
  useEffect(() => {
    // Runs once OnMount
    
    // Get data
    getData();
  }, []);
  
  useEffect(() => {
    if(newButtonState) {
      setModal(true);
      setModalEditID(0);
      onOpenNewModal();
      dispatch(resetNotification());
    }
  }, [newButtonState]);
  
  useEffect(() => {
    if(!modal && modalEditID !== 0) {
      setModalEditID(0);
    }
    
    if(modal) {
      dispatch(disableRecordButton());
    } else {
      dispatch(enableRecordButton());
    }
  }, [modal]);
  
  useEffect(() => {
    if(shouldUpdate) {
      getData();
      onUpdate();
    }
  }, [shouldUpdate]);
  
  useLayoutEffect(() => {
    setButtonsHeightOffset((prevState) => {
      return {
        ...prevState,
        1: (button1?.current?.offsetHeight - 40) / 2,
        2: (button2?.current?.offsetHeight - 40) / 2
      }
    });
  }, [button1, button2]);
  
  const getData = () => {
    let columns = ['id'];
    items.forEach((item) => {
      columns.push(item.name);
    });
    dispatch(getDataOfType({
      type: type.toLowerCase(),
      cols: columns
    })).then((result) => {
      if (result.type.includes("rejected")) {
        // TODO data get fail error notification
        if(isDev) {
          console.log(result);
        }
      }
    });
  }
  
  const getVisibleData = (data) => {
    let itemList = [];
  
    visibleData.forEach((entry, index) => {
      let iconIndex = visibleData.findIndex((element) => element.type === 'icon');
    
      switch (entry.type) {
        case 'icon':
          itemList.push(
            <div key={`visibleData_${entry.type}_${data.id}${index}`} className="absolute w-10 h-10 mr-2">{entry.icons[data[entry.key]]}</div>
          );
          break;
        case 'text':
          if (Object.keys(entry).includes("getter")) {
          
          } else {
            itemList.push(
              <span
                key={`visibleData_${entry.type}_${data.id}${index}`}
                className={`block w-full ${iconIndex < index && iconIndex !== -1 ? 'ml-12 pr-12' : ''} text-left font-normal truncate`}
              >{data[entry.key]}</span>
            );
          }
          break;
        case 'subtitle':
          if (Object.keys(entry).includes("getter")) {
            let subtitle = entry.getter.find((element) => element.id === parseInt(data.group_id))?.name;
            itemList.push(
              <div
                key={`visibleData_${entry.type}_${data.id}${index}`}
                className={`block w-full text-xs text-left truncate ${iconIndex < index && iconIndex !== -1 ? 'ml-12 pr-12' : ''}`}
              >{getTranslation('general_text_group_x', 'Group: %s').replace("%s", (subtitle ? subtitle : getTranslation('general_text_not_available', 'N/A')))}</div>
            );
          } else {
            itemList.push(
              <span
                key={`visibleData_${entry.type}_${data.id}${index}`}
                className={`block w-full ${iconIndex < index && iconIndex !== -1 ? 'ml-12 pr-12' : ''} text-left font-normal truncate`}
              >{data[entry.key]}</span>
            );
          }
          break;
        default:
          itemList.push(<div>{`Item Type (${entry.type}) not supported!`}</div>);
          break;
      }
    });
  
    return itemList;
  }
  
  return (
    <React.Fragment>
      <div className="block">
        <div className={`left-0 right-0`}>
          <div className="left-[1rem] z-10 mt-1 max-h-[450px] rounded-md py-1 text-base overflow-auto">
            {data.length === 0 || !data ? (
              <div className={`text-center font-bold text-xl`}>
                <I18N index="general_text_list_empty" text="List is empty" />
              </div>
            ) : data.map((item, itemKey) => (
              <div
                key={item[nameKey] + itemKey}
                className={`block w-full text-gray-900 select-none relative py-2 pr-3 pr-24 ${itemKey % 2 ? 'bg-slate-300 hover:bg-slate-400' : 'bg-slate-350 hover:bg-slate-400'}`}
              >
                <div className="content-center mx-2">
                  {getVisibleData(item)}
                </div>
                <Tooltip
                  id={`tooltip_${type.toLowerCase()}_${itemKey}_edit`}
                  placement="rightTop"
                  content={(
                    <h2 className="font-bold"><I18N index="general_text_edit" text="Edit" /></h2>
                  )}
                >
                  <button
                    ref={button1}
                    onClick={() => {setModalEditID(item.id); setModal(true); dispatch(resetNotification());}}
                    className={`absolute right-0 inline-flex items-center mr-14 px-2.5 bg-slate-500 hover:text-white hover:bg-slate-600`}
                    style={buttonsHeightOffset[1] > 0 ? {top: buttonsHeightOffset[1], bottom: buttonsHeightOffset[1]} : {top: 0, bottom: 0}}
                  >
                    <span className="sr-only">{getTranslation('general_text_edit')}</span>
                    <FaEdit className="w-5 h-5" aria-hidden="true" />
                  </button>
                </Tooltip>
                <Tooltip
                  id={`tooltip_${type.toLowerCase()}_ ${itemKey}_delete`}
                  placement="rightTop"
                  content={(
                    <h2 className="font-bold"><I18N index="general_text_delete" text="Delete" /></h2>
                  )}
                >
                  <button
                    ref={button2}
                    onClick={() => {
                      confirm({
                        title: confirmMessages?.title,
                        message: confirmMessages?.message,
                        confirmButton: async () => {
                          let response = await dispatch(deleteData({ type: type.toLowerCase(), itemID: item.id }));
          
                          if (response.type.includes("rejected")) {
                            dispatch(setNotification({
                              message: `general_message_text_x_remove_fail`,
                              bottomOffset: 0,
                              args: [`general_text_${type.toLowerCase().slice(0, -1)}`]
                            }));
                          } else {
                            if (onDelete) onDelete();
                            dispatch(setNotification({
                              message: `general_message_text_x_remove_success`,
                              bottomOffset: 0,
                              args: [`general_text_${type.toLowerCase().slice(0, -1)}`]
                            }));
                          }
                        },
                        onShow: () => {
                          dispatch(resetNotification());
                        }
                      });
                    }}
                    className="absolute right-0 inline-flex items-center mr-2 px-2.5 bg-slate-500 hover:text-white hover:bg-slate-600"
                    style={buttonsHeightOffset[2] > 0 ? {top: buttonsHeightOffset[2], bottom: buttonsHeightOffset[2]} : {top: 0, bottom: 0}}
                  >
                    <span className="sr-only">{getTranslation('general_text_delete')}</span>
                    <FaTimes className="w-5 h-5" aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
        <MiniModal
          show={modal}
          onHide={setModal}
          title={modalEditID === 0 ? getTranslation('general_text_new_x', 'New %s').replace("%s", getTranslation(`general_text_${type.toLowerCase().slice(0, -1)}`).toLowerCase()) : getTranslation('general_text_edit_x', 'Edit %s').replace("%s", getTranslation(`general_text_${type.toLowerCase().slice(0, -1)}`).toLowerCase())}
          type={type.toLowerCase().slice(0, -1)}
          edit={modalEditID === 0 ? {} : data.find((element) => element.id === modalEditID)}
          items={items}
          onSubmit={(colsData) => dispatch(setData(modalEditID === 0 ? {type: type.toLowerCase(), data: colsData} : {type: type.toLowerCase(), data: {id: modalEditID, ...colsData}}))} />
      </div>
    </React.Fragment>
  );
}

SimpleDataList.propTypes = {
  type: PropTypes.string.isRequired,
  items: PropTypes.array.isRequired,
  newButtonState: PropTypes.bool.isRequired,
  onOpenNewModal: PropTypes.func.isRequired
}

export default SimpleDataList;