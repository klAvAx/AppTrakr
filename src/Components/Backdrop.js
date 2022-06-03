import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { shouldCloseBackdrop, toggleBackdrop } from "../redux/reducers/UI";

function Backdrop() {
  const dispatch = useDispatch();
  const backdrop = useSelector((state) => state.UI.backdrop.visible);
  
  return (
    <div onClick={() => dispatch(shouldCloseBackdrop())} className={`${backdrop ? 'block' : 'hidden'} absolute top-0 left-[1px] right-[2px] bottom-[1px] backdrop-blur-sm z-1250`} />
  );
}

export default Backdrop;