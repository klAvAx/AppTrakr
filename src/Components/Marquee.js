import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

function Marquee(props) {
  const [textPos, setTextPos] = useState(0);
  const [maxOffset, setMaxOffset] = useState(0);
  
  const [textHeight, setTextHeight] = useState(0);
  
  const timer = useRef(null);
  const textElement = useRef();
  const marqueeContainer = useRef();
  const marqueeElement = useRef();
  
  useEffect(() => {
    if (textElement.current.offsetHeight) {
      setTextHeight(textElement.current.offsetHeight);
    }
  }, [textElement]);
  
  useEffect(() => {
    if (marqueeContainer.current.offsetWidth < marqueeElement.current.offsetWidth) {
      setMaxOffset(marqueeElement.current.offsetWidth - marqueeContainer.current.offsetWidth);
    } else {
      setMaxOffset(0);
    }
  }, [props.text, marqueeContainer.current, marqueeElement.current]);
  
  useEffect(() => {
    if (maxOffset > 0) {
      let startDelay = 2000;
      let endDelay = 1000;
      let moveDelay = 100;
      
      if(props.startingDelay) startDelay = props.startingDelay;
      if(props.restartingDelay) endDelay = props.restartingDelay;
      if(props.tickDelay) moveDelay = props.tickDelay;
      
      timer.current = setTimeout(() => {
        if (textPos >= maxOffset) {
          setTextPos(0);
        } else {
          setTextPos(textPos + 1);
        }
      }, (textPos === 0 ? startDelay : (textPos >= maxOffset ? endDelay : moveDelay)));
    } else {
      setTextPos(0);
    }
    
    return () => {
      if(timer.current) clearTimeout(timer.current);
    }
  }, [textPos, maxOffset]);
  
  return (
    <div style={{ position: "relative", height: (textHeight !== 0 ? textHeight : "auto") }}>
      <div ref={textElement} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: (textHeight === 0 ? "block" : "none") }}>
        <div className={props.className}>{props.text}</div>
      </div>
      <div ref={marqueeContainer} style={{ position: "absolute", top: 0, left: 0, width: "100%", overflow: "hidden", height: textHeight }}>
        <div ref={marqueeElement} style={{ position: "absolute", top: 0, whiteSpace: "nowrap", left: -textPos }}>
          <div className={props.className}>{props.text}</div>
        </div>
      </div>
    </div>
  );
}

Marquee.propTypes = {
  text: PropTypes.string.isRequired,
  startingDelay: PropTypes.number,
  restartingDelay: PropTypes.number,
  tickDelay: PropTypes.number
}

export default Marquee;