import React from 'react';
import { Layers, Plane, Cpu, Gauge, Radio, Server, Activity, ShieldCheck } from 'lucide-react';

export const SystemArchitecture: React.FC = () => {
  const nodes = [
    { title: 'VIRTUAL UAV', desc: 'Flight dynamics & geodetic nav', icon: Plane, sys: 'W1' },
    { title: 'ROTAX 912 PHYSICS', desc: 'Aero-piston thermodynamics', icon: Cpu, sys: 'W1' },
    { title: 'VIRTUAL SENSORS', desc: 'Noise, envelopes & fault injection', icon: Gauge, sys: 'W1' },
    { title: 'LIVE TELEMETRY (1Hz)', desc: 'JSON payload sender (Source of Truth)', icon: Radio, sys: 'W1' },
    { title: 'VERCEL TELEMETRY API', desc: 'sihaimodel.vercel.app/api/telemetry', icon: Server, sys: 'API', isApi: true },
    { title: 'DIGITAL TWIN & ANOMALY', desc: 'Expected vs Actual comparison', icon: Activity, sys: 'W2', isExternal: true },
    { title: 'HEALTH / RUL / MISSION', desc: 'SOH, prognostics & maintenance', icon: ShieldCheck, sys: 'W2', isExternal: true },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
            <Layers className="w-3 h-3" />
          </div>
          <div>
            <h2 className="text-[11px] font-bold text-[#1F2937] tracking-tight uppercase">SYSTEM ARCHITECTURE</h2>
            <div className="text-[8.5px] text-[#6B7280]">Synchronized 2-Tier UAV Digital Twin Pipeline</div>
          </div>
        </div>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
          W1 ➜ API ➜ W2
        </span>
      </div>

      {/* Vertical Pipeline Diagram */}
      <div className="space-y-1 relative pl-1.5 before:absolute before:left-3 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-[#FED7AA]">
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          return (
            <div key={idx} className="flex items-center gap-2 relative text-[9px]">
              {/* Connected Icon Node */}
              <div
                className={`w-4 h-4 rounded flex items-center justify-center z-10 shadow-2xs flex-shrink-0 border ${
                  node.isExternal
                    ? 'bg-emerald-50 border-emerald-300 text-[#10B981]'
                    : node.isApi
                    ? 'bg-blue-50 border-blue-300 text-blue-600'
                    : 'bg-orange-50 border-orange-200 text-[#F97316]'
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
              </div>

              {/* Node Details */}
              <div className="truncate flex-1 flex items-baseline justify-between gap-1">
                <span className={`font-bold leading-tight ${node.isExternal ? 'text-emerald-700' : node.isApi ? 'text-blue-700' : 'text-[#1F2937]'}`}>
                  {node.title}
                </span>
                <span className="text-[7.5px] text-[#9CA3AF] font-mono truncate">
                  {node.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

