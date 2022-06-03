import React from 'react';
import { useSelector } from "react-redux";

import PropTypes from 'prop-types';

const __ = (key, value) => {
  return (window.i18n ? window.i18n.__(key, value) : value);
};

function I18N(props) {
  const isDev = useSelector(({ electron }) => electron.settings.appIsDev);
  
  return !props?.noDev && isDev ? <span style={{color: "#00c800", outline: "2px dotted #FF0000"}}>{__(props.index, props.text)}</span> : __(props.index, props.text);
}

I18N.propTypes = {
  index: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  noDev: PropTypes.bool
}

export default I18N;

export const getLangList = () => {
  return window.i18n.getLangList();
}
export const getTranslation = (index, defaultText) => {
  return __(index, (defaultText ? defaultText : ''));
}