import React from 'react';
import { 
  Home, 
  Sliders, 
  Gauge, 
  AlertTriangle, 
  Radio, 
  FileText, 
  Settings as SettingsIcon 
} from 'lucide-react';

export type SidebarTab = 
  | 'mission' 
  | 'controls' 
  | 'engine' 
  | 'fault' 
  | 'telemetry' 
  | 'log' 
  | 'settings';

interface SidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const navItems = [
    { id: 'mission' as SidebarTab, label: 'Mission View', icon: Home },
    { id: 'controls' as SidebarTab, label: 'Flight Controls', icon: Sliders },
    { id: 'engine' as SidebarTab, label: 'Engine & Sensors', icon: Gauge },
    { id: 'fault' as SidebarTab, label: 'Fault Simulation', icon: AlertTriangle },
    { id: 'telemetry' as SidebarTab, label: 'Telemetry', icon: Radio },
    { id: 'log' as SidebarTab, label: 'Mission Log', icon: FileText },
    { id: 'settings' as SidebarTab, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-52 bg-white border-r border-[#E5E7EB] flex flex-col justify-between p-3 flex-shrink-0">
      {/* Top Nav Buttons */}
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-[#F97316] text-white shadow-sm font-bold'
                  : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#1F2937]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#6B7280]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom UAV Graphic & Tagline */}
      <div className="pt-4 border-t border-[#E5E7EB] text-center">
        {/* Tactical Drone Silhouette */}
        <div className="w-full flex items-center justify-center mb-2 px-2">
          <svg viewBox="0 0 200 60" className="w-full h-12 text-[#64748B] opacity-80" fill="currentColor">
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
          Rotax 912
        </div>
        <div className="text-[9.5px] font-semibold text-[#6B7280]">
          Powered MALE UAV
        </div>
        <div className="text-[9px] italic text-[#9CA3AF] mt-2 leading-tight">
          "Surveillance for a Safer Tomorrow"
        </div>
      </div>
    </aside>
  );
};
