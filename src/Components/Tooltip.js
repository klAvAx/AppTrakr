import PropTypes from "prop-types";
import React, { useEffect, useState, useRef } from "react";
import { render, unmountComponentAtNode } from 'react-dom';

// TODO showArrow
// TODO placement
const Tooltip = ({ id, showArrow, placement, content, ...props }) => {
  const ChildTag = `${props.children.type}`;
  const { children: ChildChildren, ...ChildProps } = props.children.props;
  
  const [isVisible, setIsVisible] = useState(false);
  
  const targetHTML = useRef();
  
  const createTooltipElement = () => {
    if(id) {
      let target = document.getElementById(id);
      const _content = (<div>{content}</div>);
  
      if (target) {
        render(_content, target);
      } else {
        target = document.createElement('div');
        target.id = id;
        target.classList.add("absolute", "p-2", "border-2", "border-slate-400", "bg-slate-350", "rounded-lg", "z-1250");
    
        let _targetPos = targetHTML.current.getBoundingClientRect();
        target.style.top = `${_targetPos.bottom}px`;
        target.style.left = `${_targetPos.left}px`;
    
        document.body.appendChild(target);
        render(_content, target);
      }
    }
  }
  
  const destroyTooltipElement = (idTarget) => {
    let target = document.getElementById((idTarget ? idTarget : id));
    if (target) {
      unmountComponentAtNode(target);
      target.parentNode.removeChild(target);
    }
  }
  
  useEffect(() => {
    if(isVisible) {
      createTooltipElement();
    } else {
      destroyTooltipElement();
    }
  }, [isVisible]);
  
  useEffect(() => {
    return () => {
      destroyTooltipElement();
    }
  }, []);
  
  return (
    <ChildTag {...ChildProps} ref={targetHTML} onMouseEnter={() => {setIsVisible(true)}} onMouseLeave={() => {setIsVisible(false)}}>
      {ChildChildren.map((elem) => elem)}
    </ChildTag>
  );
};

Tooltip.propTypes = {
  showArrow: PropTypes.bool,
  placement: PropTypes.oneOf(['left','right','top','bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'rightTop', 'rightBottom', 'leftTop', 'leftBottom']),
  content: PropTypes.element.isRequired
}

export default Tooltip;