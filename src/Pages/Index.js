import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getIcon } from "../extra/typeIcons";
import { FaAngleDown } from "react-icons/fa";
import I18N, { getTranslation } from "../extra/I18N";
import Marquee from "../Components/Marquee";
import { getDataOfType } from "../redux/reducers/simpleDataList";
import { toggleCollapsed } from "../redux/reducers/UI";
import Tooltip from "../Components/Tooltip";

function IndexPage() {
  const dataConfiguredGroups = useSelector(({ simpleDataList }) => simpleDataList?.groups);
  const dataConfiguredRules = useSelector(({ simpleDataList }) => simpleDataList?.rules);
  const collapsed = useSelector(({ UI }) => UI.collapsed?.index);
  
  const dispatch = useDispatch();
  
  useEffect(() => {
    // Get Data
    dispatch(getDataOfType({ type: 'groups', cols: ['id', 'name'] }));
    dispatch(getDataOfType({ type: 'rules', cols: ['group_id', 'rule', 'type'] }));
  }, []);
  
  return (
    <React.Fragment>
      <div className="container mx-auto p-4 relative z-1250">
        {dataConfiguredGroups && dataConfiguredRules?.length > 0 ? (
          <React.Fragment>
            {dataConfiguredGroups.map((group, groupIndex) => {
              const rules = dataConfiguredRules.filter((rule) => rule.group_id === group.id);
              
              if (group && rules.length > 0) {
                const _collapsed = collapsed?.[groupIndex];
                
                return (
                  <div
                    key={`${group.name}_${groupIndex}`}
                    className={`p-2 ${_collapsed ? "pb-0" : ""} columns-1 relative border-2 rounded-lg border-slate-400 bg-slate-200 ${groupIndex > 0 ? 'mt-4' : ''}`}
                  >
                    <div className={`-mx-2 -mt-2 p-2 flex ${_collapsed ? "" : "mb-2"} border-b-2 border-slate-400 bg-slate-350 font-bold z-1000`}>
                      <div className="w-full truncate">{group.name}</div>
                      <Tooltip
                        id={`tooltip_${groupIndex}`}
                        placement="rightBottom"
                        content={(
                          <h2 className="font-bold">
                            {_collapsed ? <I18N index="general_text_expand" text="Expand" /> : <I18N index="general_text_collapse" text="Collapse" />}
                          </h2>
                        )}
                      >
                        <button
                          className="w-6 h-6 transition-colors hover:text-slate-50"
                          onClick={() => dispatch(toggleCollapsed({group: "index", key: groupIndex}))}
                        >
                          <span className='sr-only'>{ _collapsed ? getTranslation('general_text_expand') : getTranslation('general_text_collapse') }</span>
                          <FaAngleDown className={`w-full h-full transition ${_collapsed ? "rotate-0" : "rotate-180"}`} />
                        </button>
                      </Tooltip>
                    </div>
                    <div className={`top-0 ${_collapsed ? "h-0" : "h-auto"} overflow-hidden z-999`}>
                      {rules.map((rule, ruleIndex) => {
                        return (
                          <div
                            key={`${group.name}_${rule.rule}_${ruleIndex}`}
                            className={`flex py-1 ${ruleIndex < (rules.length - 1) ? 'border-b-2 border-slate-300' : ''}`}
                          >
                            <Tooltip
                              id={`tooltip_${groupIndex}_${ruleIndex}`}
                              placement="leftBottom"
                              content={(
                                <h2 className="font-bold">
                                  <I18N index={`general_text_${rule.type}_rule_type`} text="" />
                                </h2>
                              )}
                            >
                              <div className="text-left text-xs h-6 w-6 mr-2 content-center">
                                <span className='sr-only'>{getTranslation(`general_text_${rule.type}_rule_type`)}</span>
                                {getIcon(rule.type)}
                              </div>
                            </Tooltip>
                            <div className="w-full truncate text-left">
                              <Marquee text={rule.type === "exec" ? rule.rule : `/${rule.rule}/`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              } else {
                return null;
              }
            })}
          </React.Fragment>
        ) : (
          <div className="text-center text-xl font-bold">
            <div className="block">
              <I18N index="index_heading_no_rules_configured" text="There Are No Rules Configured, Yet..." />
            </div>
            <div className="block">
              <I18N index="index_heading_consider_adding_some_rules" text="Consider Adding some Rules in Settings Page" />
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

export default IndexPage;