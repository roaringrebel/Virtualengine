import React from 'react';
import { 
  Home, 
  Sliders, 
  Gauge, 
  AlertTriangle, 
  Radio, 
  FileText, 
  Box,
  Settings as SettingsIcon 
} from 'lucide-react';

export type SidebarTab = 
  | 'mission' 
  | 'flight' 
  | 'engine' 
  | 'faults' 
  | 'telemetry' 
  | '3d'
  | 'log' 
  | 'settings';

interface SidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const navItems = [
    { id: 'mission' as SidebarTab, label: 'MISSION', icon: Home, subtitle: 'Geographic Map & Setup' },
    { id: 'flight' as SidebarTab, label: 'FLIGHT', icon: Sliders, subtitle: 'Flight Dynamics & Control' },
    { id: 'engine' as SidebarTab, label: 'ENGINE', icon: Gauge, subtitle: 'Rotax 912 & 9 Sensors' },
    { id: 'faults' as SidebarTab, label: 'FAULTS', icon: AlertTriangle, subtitle: 'Propulsion Fault Injection' },
    { id: 'telemetry' as SidebarTab, label: 'TELEMETRY', icon: Radio, subtitle: 'Live Stream & Packets' },
    { id: '3d' as SidebarTab, label: '3D VIEW', icon: Box, subtitle: 'Tactical UAV Visualization' },
    { id: 'log' as SidebarTab, label: 'LOG', icon: FileText, subtitle: 'Mission Event Timeline' },
    { id: 'settings' as SidebarTab, label: 'SETTINGS', icon: SettingsIcon, subtitle: 'Simulation Config' },
  ];

  return (
    <aside className="w-56 bg-white border-r border-[#E5E7EB] flex flex-col justify-between p-3 flex-shrink-0 select-none">
      {/* Top Nav Buttons */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider px-2 py-1">
          WORKSPACES
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                isActive
                  ? 'bg-[#F97316] text-white shadow-sm font-bold'
                  : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#1F2937]'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#6B7280]'}`} />
              <div className="truncate">
                <div className="text-xs leading-tight font-extrabold">{item.label}</div>
                <div className={`text-[9.5px] truncate leading-tight ${isActive ? 'text-orange-100' : 'text-[#94A3B8]'}`}>
                  {item.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom UAV Graphic & Tagline */}
      <div className="pt-4 border-t border-[#E5E7EB] text-center">
        {/* Tactical Drone Silhouette */}
        <div className="w-full flex items-center justify-center mb-1.5 px-2">
          <svg viewBox="0 0 200 60" className="w-full h-10 text-[#64748B] opacity-80" fill="currentColor">
            {/* Predator/MALE UAV Silhouette Vector */}
            <path d="M100 25 C115 25 155 27 190 30 C195 30 198 33 190 35 C155 35 115 35 100 35 C85 35 45 35 10 35 C2 33 5 30 10 30 C45 27 85 25 100 25 Z" />
            <path d="M96 10 C96 5 104 5 104 10 L102 45 C102 48 98 48 98 45 Z" />
            {/* Wings */}
            <path d="M100 28 L185 24 C190 24 190 26 185 28 L100 32 Z" opacity="0.9" />
            <path d="M100 28 L15 24 C10 24 10 26 15 28 L100 32 Z" opacity="0.9" />
            {/* V-Tail */}
            <path d="M10 20 L25 32 L15 32 Z" />
            <path d="M10 44 L25 32 L15 32 Z" />
            {/* Nose Dome */}
            <ellipse cx="188" cy="32" rx="4" ry="3" />
          </svg>
        </div>

        <div className="text-[11px] font-extrabold text-[#1F2937] tracking-tight">
          BHARAT AEROTWIN
        </div>
        <div className="text-[9.5px] font-semibold text-[#6B7280]">
          Rotax 912 MALE UAV Twin
        </div>
        <div className="text-[9px] italic text-[#9CA3AF] mt-1 leading-tight">
          "Surveillance for a Safer Tomorrow"
        </div>
      </div>
    </aside>
  );
};
