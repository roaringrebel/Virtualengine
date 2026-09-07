import React, { useState } from 'react';
import { FileText, Clock, Filter, AlertTriangle, ShieldCheck, AlertOctagon, Activity, Search } from 'lucide-react';
import { MissionEventLog } from '../types/mission';

interface MissionTimelineProps {
  logs: MissionEventLog[];
  currentFlightPhase?: string;
}

export const MissionTimeline: React.FC<MissionTimelineProps> = ({ logs, currentFlightPhase = 'CRUISE' }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const categories = ['ALL', 'FLIGHT', 'ENGINE', 'FAULT', 'TELEMETRY', 'MISSION', 'INFO'];

  // Enhanced default events if logs are initial
  const enhancedLogs: Array<{
    id: string;
    time: string;
    message: string;
    category: string;
    phase: string;
    status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  }> = logs.length > 2 
    ? logs.map((l, idx) => {
        let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
        let phase = l.phase || currentFlightPhase || 'CRUISE';
        if (l.category === 'FAULT' || l.message.toLowerCase().includes('fault') || l.message.toLowerCase().includes('vibration') || l.message.toLowerCase().includes('warning')) {
          status = l.message.toLowerCase().includes('severe') || l.message.toLowerCase().includes('overheating') ? 'CRITICAL' : 'WARNING';
        }
        if (l.message.toLowerCase().includes('started') || l.message.toLowerCase().includes('initialized')) phase = 'STARTUP';
        else if (l.message.toLowerCase().includes('takeoff')) phase = 'TAKEOFF';
        else if (l.message.toLowerCase().includes('climb')) phase = 'CLIMB';
        else if (l.message.toLowerCase().includes('waypoint') || l.message.toLowerCase().includes('cruise')) phase = 'CRUISE';
        else if (l.message.toLowerCase().includes('descent') || l.message.toLowerCase().includes('approach')) phase = 'DESCENT';
        else if (l.message.toLowerCase().includes('recovery') || l.message.toLowerCase().includes('touchdown')) phase = 'LANDING';

        return {
          id: l.id || `${idx}`,
          time: l.simTimestamp,
          message: l.message,
          category: l.category || 'INFO',
          phase,
          status
        };
      })
    : [
        { id: '1', time: '10:40:12', message: 'Simulation initialized: Reduced-Order Rotax 912 ULS Engine', category: 'INFO', phase: 'STANDBY', status: 'NORMAL' },
        { id: '2', time: '10:40:18', message: 'Engine ignition ON: Rotax 912 spooled to idle (1,600 RPM)', category: 'ENGINE', phase: 'STARTUP', status: 'NORMAL' },
        { id: '3', time: '10:40:42', message: 'Takeoff roll initiated: Throttle advanced to 85%', category: 'FLIGHT', phase: 'TAKEOFF', status: 'NORMAL' },
        { id: '4', time: '10:41:20', message: 'Positive climb rate established (+650 ft/min to 6,500 ft)', category: 'FLIGHT', phase: 'CLIMB', status: 'NORMAL' },
        { id: '5', time: '10:42:00', message: 'Cruise level reached: Level flight at 6,500 ft MSL (145 km/h TAS)', category: 'FLIGHT', phase: 'CRUISE', status: 'NORMAL' },
        { id: '6', time: '10:42:18', message: 'Waypoint 1 reached: Geodesic corridor tracking active (Decision: GO)', category: 'MISSION', phase: 'CRUISE', status: 'NORMAL' },
      ];

  const filteredLogs = enhancedLogs.filter(item => {
    const matchesCategory = selectedCategory === 'ALL' || item.category.toUpperCase() === selectedCategory.toUpperCase();
    const matchesSearch = !searchFilter.trim() || item.message.toLowerCase().includes(searchFilter.toLowerCase()) || item.phase.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm flex flex-col justify-between space-y-3">
      
      {/* 1. Header & Search / Filters (Requirements 35, 36) */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#F1F5F9] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#1F2937] tracking-tight uppercase">
              MISSION & EVENT LOG
            </h2>
            <div className="text-[11px] text-[#6B7280]">
              Chronological Simulation & Flight Event Record
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-[#F97316] text-white shadow-xs'
                  : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-1.5">
        <Search className="w-3.5 h-3.5 text-[#94A3B8]" />
        <input
          type="text"
          placeholder="Filter event log messages..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full text-xs bg-transparent text-[#1E293B] placeholder-[#94A3B8] outline-none"
        />
        <span className="text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap">
          {filteredLogs.length} Events
        </span>
      </div>

      {/* 2. Professional Chronological Event Table (Requirement 35) */}
      <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200 font-mono">
              <th className="py-2 px-3 w-24">TIME</th>
              <th className="py-2 px-3">EVENT DESCRIPTION</th>
              <th className="py-2 px-3 w-24">PHASE</th>
              <th className="py-2 px-3 w-24">CATEGORY</th>
              <th className="py-2 px-3 w-24 text-right">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 text-slate-500 font-semibold">{log.time}</td>
                  <td className="py-2 px-3 font-sans font-medium text-slate-900">{log.message}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {log.phase}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                      {log.category}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold ${
                      log.status === 'NORMAL'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : log.status === 'WARNING'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {log.status === 'NORMAL' && <ShieldCheck className="w-2.5 h-2.5" />}
                      {log.status === 'WARNING' && <AlertTriangle className="w-2.5 h-2.5" />}
                      {log.status === 'CRITICAL' && <AlertOctagon className="w-2.5 h-2.5" />}
                      <span>{log.status}</span>
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 font-sans italic text-xs">
                  No matching log entries found for current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
