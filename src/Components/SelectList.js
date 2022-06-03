import React, { useState } from "react";
import { Transition } from "@headlessui/react";
import { FaAngleDown, FaCheck } from "react-icons/fa";

function SelectList(props) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <React.Fragment>
      <div className="block z-1000">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center mt-1 w-[10rem] bg-white border-[1px] border-slate-500 rounded-lg text-left cursor-pointer"
          aria-haspopup="listbox" aria-expanded="true" aria-labelledby="listbox-label"
        >
            <span className="pl-[2px] ml-2 block w-full truncate">
              {props.items.find((item) => item.value === props.selected).name}
            </span>
          <span className="ml-3 pr-2">
              <FaAngleDown className={`${expanded ? 'rotate-180' : 'rotate-0'} transition w-5 h-5 text-gray-400`} aria-hidden="true" />
            </span>
        </button>
        
        <Transition
          as={React.Fragment}
          show={expanded}
          enter="transition duration-250 ease-in"
          enterFrom="transform -translate-y-5 scale-90 opacity-0"
          enterTo="transform translate-y-0 scale-100 opacity-100"
          leave="transition duration-200 ease-out"
          leaveFrom="transform translate-y-0 scale-100 opacity-100"
          leaveTo="transform -translate-y-5 scale-90 opacity-0"
        >
          <div className={`absolute left-0 right-0 mx-[15px] z-1250`}>
            <div
              className="left-[1rem] z-10 mt-1 bg-white shadow-lg max-h-56 rounded-md py-1 text-base overflow-auto border-[1px] border-slate-500 rounded-lg"
              tabIndex="-1"
              role="listbox" aria-labelledby="listbox-label" aria-activedescendant="listbox-option-3"
            >
              {props.items.map((item, itemKey) => (
                <button key={item.name+itemKey} disabled={item?.disabled} onClick={() => {setExpanded(false); props.onChoose(item.value);}} className={`block w-full text-gray-900 select-none relative py-2 pr-3 pl-9 hover:bg-slate-300 ${item?.disabled ? 'text-slate-300 hover:text-black' : ''}`}>
                  <span className="text-indigo-600 absolute left-0 inset-y-0 inline-flex items-center ml-4">
                    {props.selected === item.value ? <FaCheck className="w-5 h-5" aria-hidden="true" /> : null}
                  </span>
                  <div className="block">
                    <span className={`pl-[2px] text-left font-normal ml-3 block truncate`}>
                      {item.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Transition>
      </div>
      <div onClick={() => setExpanded(false)} className={`${expanded ? 'block' : 'hidden'} absolute top-0 left-0 w-full h-full backdrop-blur-sm z-999`} />
    </React.Fragment>
  );
}

export default SelectList;