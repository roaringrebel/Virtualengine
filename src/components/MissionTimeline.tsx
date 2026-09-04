import React from 'react';
import { Clock } from 'lucide-react';
import { MissionEventLog } from '../types/mission';

interface MissionTimelineProps {
  logs: MissionEventLog[];
}

export const MissionTimeline: React.FC<MissionTimelineProps> = ({ logs }) => {
  const defaultEvents = [
    { time: '10:40:12', text: 'Simulation started' },
    { time: '10:40:18', text: 'Engine startup' },
    { time: '10:40:42', text: 'Takeoff' },
    { time: '10:41:20', text: 'Climb' },
    { time: '10:42:00', text: 'Cruise' },
    { time: '10:42:18', text: 'Reached WP2 (8,000 ft)' },
  ];

  const displayEvents = logs.length >= 6 ? logs.slice(-6).map(l => ({ time: l.simTimestamp, text: l.message })) : defaultEvents;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">MISSION TIMELINE</h2>
          <div className="text-[10px] text-[#6B7280]">Key events during simulation</div>
        </div>
      </div>

      {/* Timeline Items */}
      <div className="space-y-1.5 relative pl-2 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#FED7AA]">
        {displayEvents.map((evt, idx) => (
          <div key={idx} className="flex items-center gap-3 relative text-[10px]">
            {/* Orange Node Bullet */}
            <div className="w-2.5 h-2.5 rounded-full bg-[#F97316] border-2 border-white shadow-xs z-10 flex-shrink-0" />
            
            <div className="font-mono text-[#6B7280] font-semibold flex-shrink-0">
              {evt.time}
            </div>
            <div className="font-semibold text-[#1F2937] truncate">
              {evt.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
