import React from 'react';
import { Layers, Plane, Cpu, Gauge, Radio, Server } from 'lucide-react';

export const SystemArchitecture: React.FC = () => {
  const nodes = [
    { title: 'Virtual UAV (Rotax 912)', desc: 'Simulates physical behaviour', icon: Plane },
    { title: 'Physics Engine Model', desc: 'Mathematical model', icon: Cpu },
    { title: 'Virtual Sensors', desc: 'Generates realistic telemetry', icon: Gauge },
    { title: 'Live Telemetry (API)', desc: 'Sends data to Digital Twin', icon: Radio },
    { title: 'Digital Twin (Analysis)', desc: 'Health monitoring & fault detection', icon: Server, isExternal: true },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">SYSTEM ARCHITECTURE</h2>
          <div className="text-[10px] text-[#6B7280]">From simulation to Digital Twin</div>
        </div>
      </div>

      {/* Vertical Pipeline Diagram */}
      <div className="space-y-1.5 relative pl-2 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#FED7AA]">
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          return (
            <div key={idx} className="flex items-center gap-2.5 relative text-[10px]">
              {/* Connected Icon Node */}
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center z-10 shadow-xs flex-shrink-0 border ${
                  node.isExternal
                    ? 'bg-emerald-50 border-emerald-300 text-[#10B981]'
                    : 'bg-orange-50 border-orange-200 text-[#F97316]'
                }`}
              >
                <Icon className="w-3 h-3" />
              </div>

              {/* Node Details */}
              <div className="truncate">
                <div className={`font-bold leading-tight ${node.isExternal ? 'text-emerald-700' : 'text-[#1F2937]'}`}>
                  {node.title}
                </div>
                <div className="text-[8.5px] text-[#6B7280] leading-tight truncate">
                  {node.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
