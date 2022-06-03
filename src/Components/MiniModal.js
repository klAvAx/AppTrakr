import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { FaCheck, FaTimes } from "react-icons/fa";
import { Transition } from "@headlessui/react";
import { setNotification } from "../redux/reducers/UI";
import { getTranslation } from "../extra/I18N";

function MiniModal({ title, type, show, onHide, onSubmit, items, edit }) {
  const isDev = useSelector(({ electron }) => electron.settings.appIsDev);
  
  const inputField = useRef();
  const modal = useRef();
  
  const [state, setState] = useState({});
  const dispatch = useDispatch();
  
  const onInputSubmit = async (value) => {
    let valid = true;
    
    Object.keys(state).forEach((stateKey) => {
      valid = valid && state[stateKey] !== "";
    });
    
    if(!valid) {
      dispatch(setNotification({
        message: 'text_error_no_empty_values',
        bottomOffset: modal.current.offsetHeight
      }));
      return;
    }
    
    const result = await onSubmit(value);
    
    if(result.type.includes("rejected")) {
      if(result.payload.error.code === "SQLITE_CONSTRAINT") {
        dispatch(setNotification({
          message: "text_error_database_entry_already_exists",
          bottomOffset: modal.current.offsetHeight
        }));
      } else {
        dispatch(setNotification({
          message: `text_error_unknown${isDev ? '_check_logs' : '_contact_developer'}`,
          bottomOffset: modal.current.offsetHeight
        }));
        if(isDev) {
          console.log(result);
        }
      }
    } else {
      onClose();
      
      if(Object.keys(edit).length === 0) {
        setTimeout(() => dispatch(setNotification({
          message: `general_message_text_x_add_success`,
          bottomOffset: 0,
          args: [`general_text_${type}`]
        })), 100);
      } else {
        setTimeout(() => dispatch(setNotification({
          message: `general_message_text_x_update_success`,
          bottomOffset: 0,
          args: [`general_text_${type}`]
        })), 100);
      }
    }
  }
  
  const onClose = () => {
    onHide(false);
    setTimeout(setState, 50, (prevState) => {
      let newState = {};
      Object.keys(prevState).forEach((key) => {
        newState[key] = "";
      });
      return newState;
    });
  }
  
  useEffect(() => {
    let newState = {};
    items.forEach((item) => {
      newState[item.name] = Object.keys(edit).length > 0 ? edit[item.name] : "";
    });
    setState(newState);
  }, []);
  
  useEffect(() => {
    if(Object.keys(edit).length > 0) {
      let newState = {};
      items.forEach((item) => {
        newState[item.name] = Object.keys(edit).length > 0 ? edit[item.name] : "";
      });
      setState(newState);
    }
  }, [edit]);
  
  let inputElements = [];
  items.forEach((item, itemIndex) => {
    switch (item.type) {
      case "input": {
        let placeholder = "";
        let requirementsMet = true;
        
        if(item?.requires?.length > 0) {
          item.requires.forEach((requirement) => {
            requirementsMet = requirementsMet && (state[requirement] !== "" && state[requirement] !== 0);
          });
        }
        
        if(item?.placeholder) {
          if(typeof item.placeholder === "string") {
            placeholder = item.placeholder;
          } else {
            let stateKey = Object.keys(item.placeholder)[0];
            placeholder = item.placeholder[stateKey][state[stateKey]];
          }
        }
  
        inputElements.push(
          <div
            key={itemIndex}
            className={`overflow-hidden ${requirementsMet ? 'max-h-16' : 'max-h-0'} transition-[max-height]`}
          >
            <input
              value={state[item.name]}
              placeholder={placeholder}
              onChange={(e) => setState((prevState) => {
                return {
                  ...prevState,
                  [item.name]: e.target.value
                }
              })}
              onKeyUp={(e) => e.key === "Enter" ? onInputSubmit(state) : true}
              className={`block border-[1px] border-slate-500 rounded-lg p-2 w-full ${itemIndex > 0 ? 'mt-4' : ''}`}
            />
            {item?.comment ? <div className="text-center text-sm pb-3 text-gray-400 font-bold">{item.comment}</div> : null}
          </div>
        );
        break;
      }
      case "select": {
        let selectOptions = [];
        let requirementsMet = true;
  
        if(item.options) {
          selectOptions.push(<option key={`${item.name}_${itemIndex}_empty`} value="" disabled>{item.emptyTxt}</option>);
          if(Array.isArray(item.options)) {
            item.options.forEach((option) => {
              selectOptions.push(
                <option key={`${item.name}_${option.id}`} value={option.id}>{option.name}</option>
              );
            })
          } else {
            Object.keys(item.options).forEach((optionKey, optionKeyIndex) => {
              selectOptions.push(
                <option key={`${item.name}_${optionKeyIndex}`} value={optionKey}>{item.options[optionKey]}</option>
              );
            });
          }
        }
  
        if(item?.requires?.length > 0) {
          item.requires.forEach((requirement) => {
            requirementsMet = requirementsMet && (state[requirement] !== "" && state[requirement] !== 0);
          });
        }
  
        inputElements.push(
          <div
            key={itemIndex}
            className={`overflow-hidden ${requirementsMet ? 'max-h-16' : 'max-h-0'} transition-[max-height]`}
          >
            <select
              value={state[item.name]}
              onChange={(e) => setState((prevState) => {
                return {
                  ...prevState,
                  [item.name]: e.target.value
                }
              })}
              className={`block border-[1px] border-slate-500 rounded-lg p-2 w-full ${itemIndex > 0 ? 'mt-4' : ''}`}
            >
              {selectOptions}
            </select>
          </div>
        );
        break;
      }
      default:
        inputElements.push(
          (
            <React.Fragment key={itemIndex}>
              {`Unsupported Item Type (${item.type})`}
              <br/>
            </React.Fragment>
          )
        );
        break;
    }
  });
  
  return (
    <React.Fragment>
      <Transition
        as={React.Fragment}
        show={show}
        enter="transition duration-250 ease-in"
        enterFrom="transform translate-y-full scale-90 opacity-0"
        enterTo="transform translate-y-0 scale-100 opacity-100"
        leave="transition duration-200 ease-out"
        leaveFrom="transform translate-y-0 scale-100 opacity-100"
        leaveTo="transform translate-y-full scale-90 opacity-0"
        afterEnter={() => {
          if(inputField?.current) {
            setTimeout((el) => el.focus(), 150, inputField.current);
          }
        }}
      >
        <div className={`fixed bottom-[1px] left-0 right-[1px] z-1250`}>
          <div ref={modal} className={`left-[1rem] z-10 bg-white shadow-lg max-h-96 py-1 px-4 text-base overflow-auto border-[1px] border-b-0 border-gray-800`}>
            <div className="container">
              <div className="columns-1">
                <h2 className="text-center text-xl font-bold">
                  {title}
                </h2>
              </div>
              <div className="flex columns-1 py-3">
                {items.length === 1 ? (
                  <React.Fragment>
                    <button title={getTranslation('general_text_submit', 'Submit')} onClick={() => onInputSubmit(state)} className="inline-flex border-[1px] border-r-0 border-slate-500 rounded-l-lg p-2 bg-green-300 hover:bg-green-500">
                      <span className="sr-only">{getTranslation('general_text_submit')}</span>
                      <FaCheck className="w-[24px] h-[24px]" aria-hidden="true" />
                    </button>
                    <input
                      ref={inputField}
                      value={state[items[0].name]}
                      onChange={(e) => setState((prevState) => {
                        return {
                          ...prevState,
                          [items[0].name]: e.target.value
                        }
                      })}
                      onKeyUp={(e) => e.key === "Enter" ? onInputSubmit(state) : true}
                      placeholder={items[0]?.placeholder}
                      className="border-[1px] border-slate-500 pl-2 w-full"
                    />
                    <button title={getTranslation('general_text_cancel', 'Cancel')} onClick={onClose} className="border-[1px] border-l-0 border-slate-500 rounded-r-lg p-2 bg-red-300 hover:bg-red-500">
                      <span className="sr-only">{getTranslation('general_text_cancel')}</span>
                      <FaTimes className="w-[24px] h-[24px]" aria-hidden="true" />
                    </button>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <div className="container">
                      <div className="columns-1 w-full pt-3">
                        {inputElements}
                      </div>
                      <div className="flex columns-2 gap-4 w-full pt-3">
                        <button title={getTranslation('general_text_submit', 'Submit')} onClick={() => onInputSubmit(state)} className="flex justify-center w-full border-[1px] border-slate-500 rounded-lg p-2 bg-green-300 hover:bg-green-500">
                          <span className="sr-only">{getTranslation('general_text_submit')}</span>
                          <FaCheck className="w-[24px] h-[24px]" aria-hidden="true" />
                        </button>
                        <button title={getTranslation('general_text_cancel', 'Cancel')} onClick={onClose} className="flex justify-center w-full border-[1px] border-slate-500 rounded-lg p-2 bg-red-300 hover:bg-red-500">
                          <span className="sr-only">{getTranslation('general_text_cancel')}</span>
                          <FaTimes className="w-[24px] h-[24px]" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
          </div>
        </div>
      </Transition>
      <div onClick={onClose} className={`${show ? 'block' : 'hidden'} absolute top-0 left-0 w-full h-full backdrop-blur-sm z-999`} />
    </React.Fragment>
  );
}

export default MiniModal;