import React from 'react';
import { useSelector } from "react-redux";
import I18N, { getTranslation } from "../extra/I18N";
import Marquee from "../Components/Marquee";

const formatDate = (date) => {
  let formatted = "";
  
  formatted += date.getFullYear();
  formatted += "-"+("00"+(date.getMonth()+1)).slice(-2);
  formatted += "-"+("00"+(date.getDate())).slice(-2);
  formatted += " "+("00"+(date.getHours())).slice(-2);
  formatted += ":"+("00"+(date.getMinutes())).slice(-2);
  formatted += ":"+("00"+(date.getSeconds())).slice(-2);
  
  return formatted;
}

function ProcessListPage() {
  const runningList = useSelector(({ process }) => process.running);
  
  return (
    <div className="container mx-auto p-4 relative z-1250 overflow-x-hidden">
      {runningList.length === 0 ? (
        <div className="text-center text-xl font-bold">
          <I18N index="processlist_heading_no_processes_yet" text="No Processes detected, Yet..." />
        </div>
      ) : runningList.map((process, procIndex) => {
        return (
          <div
            key={`processList_${procIndex}`}
            title={process.WindowTitle}
            className={`p-2 columns-1 border-2 rounded-lg border-slate-400 bg-slate-200 ${procIndex > 0 ? 'mt-4' : ''}`}
          >
            <div className="w-full truncate">
              <Marquee text={process.WindowTitle} />
            </div>
            <div className="flex text-xs">
              <div className="w-full truncate mr-2">
                <span title={getTranslation('processlist_text_process_executable', 'Process Executable')}>
                  {process.Executable}
                </span>
              </div>
              <div title={getTranslation('processlist_text_time_process_started', 'Time Process Started')} className="text-right whitespace-nowrap">
                {formatDate(new Date(process.StartTime*1000))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ProcessListPage;