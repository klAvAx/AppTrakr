import React from "react";
import { VscFileBinary, VscRegex } from "react-icons/vsc";

const icons = {
  "rule": <VscRegex className="w-full h-full" aria-hidden="true" />,
  "exec": <VscFileBinary className="w-full h-full" aria-hidden="true" />
};

export const getIcon = (type) => {
  return icons[type];
}

export default icons;