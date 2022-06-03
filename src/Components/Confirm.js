import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import { Provider } from "react-redux";
import { store } from '../redux/store';

import { FaCheck, FaTimes } from 'react-icons/fa';

function Confirm(props) {
  const [visible, setVisible] = useState(false);
  
  const overlay = useRef();
  
  const close = () => {
    setVisible(false);
    setTimeout(removeConfirmElement, 150);
  }
  const keyboardClose = (event) => {
    if (event.keyCode === 27) {
      close();
    }
  }
  
  useEffect(() => {
    document.addEventListener('keydown', keyboardClose, false);
    
    setVisible(true);
    
    if(props.onShow) props.onShow();
    return () => {
      document.removeEventListener('keydown', keyboardClose, false);
    }
  }, []);
  
  return (
    <div
      className={`absolute top-0 left-0 right-0 h-full flex backdrop-blur-sm z-[999999]`}
      ref={overlay}
      onClick={(event) => {
        if (event.target === overlay.current) {
          close();
        }
      }}
    >
      <div
        className={`absolute bottom-0 left-0 w-full flex bg-gray-800 transform transition text-white p-[10px]`}
        style={visible ? {transform: `translateY(0%)`} : {transform: `translateY(100%)`}}
      >
        <div className='w-full'>
          {props.title ? <h1 className='text-center font-bold text-2xl'>{props.title}</h1> : null}
          {props.message ? <div className='text-xl text-center'>{props.message}</div> : null}
          <div className='flex columns-2 gap-4 w-full mt-3'>
            <button
              onClick={() => { if(props.confirmButton) { setTimeout(props.confirmButton, 150); } close(); }}
              className='flex justify-center w-full border-[1px] border-slate-500 rounded-lg p-2 text-green-900 bg-green-300 hover:bg-green-500'
            >
              <FaCheck className='w-[24px] h-[24px]' />
            </button>
            <button
              onClick={() => { if(props.cancelButton) { setTimeout(props.cancelButton, 150); } close(); }}
              className='flex justify-center w-full border-[1px] border-slate-500 rounded-lg p-2 text-red-900 bg-red-300 hover:bg-red-500'
            >
              <FaTimes className='w-[24px] h-[24px]' />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Confirm.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]).isRequired,
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  confirmButton: PropTypes.func.isRequired,
  cancelButton: PropTypes.func,
  onShow: PropTypes.func
}

export default Confirm;

function removeConfirmElement() {
  const target = document.getElementById('confirm-alert');
  if (target) {
    unmountComponentAtNode(target);
    target.parentNode.removeChild(target);
  }
}

export function confirm(properties) {
  let divTarget = document.getElementById('confirm-alert');
  if (divTarget) {
    // Rerender - the mounted ReactConfirmAlert
    render(<Provider store={store}><Confirm {...properties} /></Provider>, divTarget);
  } else {
    // Mount the ReactConfirmAlert component
    divTarget = document.createElement('div');
    divTarget.id = 'confirm-alert';
    document.body.appendChild(divTarget);
    render(<Provider store={store}><Confirm {...properties} /></Provider>, divTarget);
  }
}