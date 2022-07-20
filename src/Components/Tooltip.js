import PropTypes from "prop-types";
import React, { useEffect, useState, useRef } from "react";
import { render, unmountComponentAtNode } from 'react-dom';

import { Provider } from "react-redux";
import { store } from '../redux/store';

// TODO showArrow
// NOTE maybe redo this as a singular thing which grabs the title automatically?
const Tooltip = ({ id, showArrow, placement, content, ...props }) => {
  const ChildTag = props.children.type;
  const { children: ChildChildren, ...ChildProps } = props.children.props;
  
  const [isVisible, setIsVisible] = useState(false);
  
  const targetHTML = useRef();
  
  const updateContent = (target) => {
    const _target = (target ? target : document.getElementById(id));
    const _content = (<Provider store={store}><div>{content}</div></Provider>);
    
    render(_content, _target, updateAttrs);
  }
  const updateAttrs = () => {
    try {
      let _targetPos = targetHTML.current.getBoundingClientRect();
      let _tooltip = document.getElementById(id);
      let _tooltipPos = _tooltip.getBoundingClientRect();
  
      switch (placement) {
        case "left": {
          _tooltip.style.top = `${_targetPos.top - (_tooltipPos.height / 2) + (_targetPos.height / 2)}px`;
          _tooltip.style.left = `${_targetPos.left - _tooltipPos.width}px`;
          break;
        }
        case "right": {
          _tooltip.style.top = `${_targetPos.top - (_tooltipPos.height / 2) + (_targetPos.height / 2)}px`;
          _tooltip.style.left = `${_targetPos.right}px`;
          break;
        }
        case "top": {
          _tooltip.style.top = `${_targetPos.top - _tooltipPos.height}px`;
          _tooltip.style.left = `${_targetPos.left - (_tooltipPos.width / 2) + (_targetPos.width / 2)}px`;
          break;
        }
        case "bottom": {
          _tooltip.style.top = `${_targetPos.top + _targetPos.height}px`;
          _tooltip.style.left = `${_targetPos.left - (_tooltipPos.width / 2) + (_targetPos.width / 2)}px`;
          break;
        }
        case "topLeft": {
          _tooltip.style.top = `${_targetPos.top - _tooltipPos.height}px`;
          _tooltip.style.left = `${_targetPos.left - _tooltipPos.width}px`;
          break;
        }
        case "topRight": {
          _tooltip.style.top = `${_targetPos.top - _tooltipPos.height}px`;
          _tooltip.style.left = `${_targetPos.left + _targetPos.width}px`;
          break;
        }
        case "bottomLeft": {
          _tooltip.style.top = `${_targetPos.bottom}px`;
          _tooltip.style.left = `${_targetPos.left - _tooltipPos.width}px`;
          break;
        }
        case "bottomRight": {
          _tooltip.style.top = `${_targetPos.bottom}px`;
          _tooltip.style.left = `${_targetPos.left + _targetPos.width}px`;
          break;
        }
        case "rightTop": {
          _tooltip.style.top = `${_targetPos.top - _tooltipPos.height}px`;
          _tooltip.style.left = `${_targetPos.left - _tooltipPos.width + _targetPos.width}px`;
          break;
        }
        case "rightBottom": {
          _tooltip.style.top = `${_targetPos.bottom}px`;
          _tooltip.style.left = `${_targetPos.left - _tooltipPos.width + _targetPos.width}px`;
          break;
        }
        case "leftTop": {
          _tooltip.style.top = `${_targetPos.top - _tooltipPos.height}px`;
          _tooltip.style.left = `${_targetPos.left}px`;
          break;
        }
        case "leftBottom": {
          _tooltip.style.top = `${_targetPos.bottom}px`;
          _tooltip.style.left = `${_targetPos.left}px`;
          break;
        }
      }
    } catch (err) {
      if((err.message || "").toLowerCase().includes("cannot read properties")) {
        console.log("Whoa there cowboy, slow down a bit will ya.");
      }
    }
  }
  
  const createTooltipElement = () => {
    if(id) {
      let target = document.getElementById(id);
  
      if (target) {
        updateContent(target);
      } else {
        target = document.createElement('div');
        target.id = id;
        target.classList.add("absolute", "p-2");
        target.classList.add("border-2", "border-slate-400", "rounded-lg");
        target.classList.add("bg-slate-350", "bg-opacity-90");
        target.classList.add("shadow-2xl", "shadow-black");
        target.classList.add("transition-tooltip");
        target.classList.add("z-1500");
        
        document.body.appendChild(target);
        updateContent(target);
      }
    }
  }
  const destroyTooltipElement = () => {
    let target = document.getElementById(id);
    if (target) {
      unmountComponentAtNode(target);
      target.parentNode.removeChild(target);
    }
  }
  
  useEffect(() => {
    if(isVisible) {
      updateContent();
    }
  }, [content]);
  
  useEffect(() => {
    if(isVisible) {
      if(content) {
        createTooltipElement();
      }
    } else {
      destroyTooltipElement();
    }
  }, [isVisible]);
  
  useEffect(() => {
    return () => {
      destroyTooltipElement();
    }
  }, []);
  
  return (typeof ChildTag === "function" ? (
    <div ref={targetHTML} onMouseEnter={() => {setIsVisible(true)}} onMouseLeave={() => {setIsVisible(false)}}>
      <ChildTag {...ChildProps}>
        {ChildChildren ? (Array.isArray(ChildChildren) ? ChildChildren.map((elem) => elem) : ChildChildren) : null}
      </ChildTag>
    </div>
  ) : (
    <ChildTag {...ChildProps} ref={targetHTML} onMouseEnter={() => {setIsVisible(true)}} onMouseLeave={() => {setIsVisible(false)}}>
      {ChildChildren ? (Array.isArray(ChildChildren) ? ChildChildren.map((elem) => elem) : ChildChildren) : null}
    </ChildTag>
  ));
};

Tooltip.propTypes = {
  id: PropTypes.string.isRequired,
  showArrow: PropTypes.bool,
  placement: PropTypes.oneOf(['left', 'right', 'top', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'rightTop', 'rightBottom', 'leftTop', 'leftBottom']),
  content: PropTypes.element.isRequired
}

export default Tooltip;