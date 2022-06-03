import React from "react";

const Button = React.forwardRef((props, forwardRef) => {
  const { children, className, ...rest } = props;
  
  if(Object.keys(rest).includes('ref')) delete rest['ref'];
  
  return (
    <button ref={forwardRef} {...rest} className={`${className} inline-flex items-center justify-center p-1 rounded-md hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-black`}>
      {children}
    </button>
  );
});

export default Button;