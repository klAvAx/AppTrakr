import PropTypes from "prop-types";
import React from "react";
import { FaCircle, FaMinus } from "react-icons/fa";

const Clock = ({ animate, circleColor, hourHandColor, minuteHandColor }) => {
  return (
    <div className="relative w-full h-full">
      <div className="absolute top-0 left-0 w-full h-full z-10">
        <FaCircle className={`w-full h-full ${circleColor}`} />
      </div>
      <div className={`absolute top-0 left-0 w-full h-full transform transition rotate-[225deg] ${animate ? "animate-hourSpin" : ""} z-20`}>
        <div className="pl-[2px] w-2/5 h-full">
          <FaMinus className={`w-full h-full stroke-[64px] ${hourHandColor}`} />
        </div>
      </div>
      <div className={`absolute top-0 left-0 w-full h-full transform transition rotate-90 ${animate ? "animate-minuteSpin" : ""} z-30`}>
        <div className="pl-[2px] w-1/2 h-full">
          <FaMinus className={`w-full h-full stroke-[64px] ${minuteHandColor}`} />
        </div>
      </div>
    </div>
  );
};

Clock.propTypes = {
  animate: PropTypes.bool,
  circleColor: PropTypes.string,
  hourHandColor: PropTypes.string,
  minuteHandColor: PropTypes.string
}

export default Clock;