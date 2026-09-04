import React, { useEffect, useState } from 'react';
import { TelemetryClientStatus } from '../types/telemetry';

interface HeaderProps {
  telemetryStatus: TelemetryClientStatus;
  engineOn: boolean;
}

export const Header: React.FC<HeaderProps> = ({ telemetryStatus, engineOn }) => {
  const [timeStr, setTimeStr] = useState('10:42:18');
  const [dateStr, setDateStr] = useState('Mon, 18 Jul 2025');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-GB'));
      setDateStr(now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-[#E5E7EB] px-5 py-2.5 flex items-center justify-between shadow-sm">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        {/* Stylized Aero Logo */}
        <div className="w-9 h-9 bg-gradient-to-br from-[#F97316] to-[#EA580C] rounded-lg flex items-center justify-center text-white font-black text-xl shadow-sm transform -rotate-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 22h20L12 2zm0 4l6.5 13h-13L12 6z" />
          </svg>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-[17px] font-extrabold tracking-wide text-[#1F2937]">
              BHARAT <span className="text-[#F97316]">AEROTWIN</span>
            </h1>
          </div>
          <div className="text-[10px] font-semibold text-[#6B7280] tracking-wider uppercase flex items-center gap-1.5">
            <span>VIRTUAL UAV & ENGINE SIMULATION</span>
            <span className="text-[#D1D5DB]">|</span>
            <span className="text-[#F97316] font-bold">ROTAX 912 (MALE UAV)</span>
          </div>
          <div className="text-[8.5px] font-medium text-[#9CA3AF] tracking-tight">
            SIMULATE TODAY. ENABLE A SAFER TOMORROW.
          </div>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5 rounded-full text-xs font-medium text-[#4B5563]">
          <span className={`w-2 h-2 rounded-full ${engineOn ? 'bg-[#10B981] animate-pulse' : 'bg-[#9CA3AF]'}`} />
          <span className="text-[10px] text-[#9CA3AF] uppercase font-bold">SIMULATION</span>
          <span className="text-[11px] font-bold text-[#1F2937]">{engineOn ? 'ONLINE' : 'STANDBY'}</span>
        </div>

        <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5 rounded-full text-xs font-medium text-[#4B5563]">
          <span className={`w-2 h-2 rounded-full ${telemetryStatus.isStreaming ? 'bg-[#10B981] animate-pulse' : 'bg-[#F59E0B]'}`} />
          <span className="text-[10px] text-[#9CA3AF] uppercase font-bold">TELEMETRY</span>
          <span className="text-[11px] font-bold text-[#1F2937]">{telemetryStatus.isStreaming ? 'STREAMING' : 'OFFLINE'}</span>
        </div>

        <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5 rounded-full text-xs font-medium text-[#4B5563]">
          <span className={`w-2 h-2 rounded-full ${telemetryStatus.status === 'CONNECTED' ? 'bg-[#10B981]' : 'bg-[#10B981]'}`} />
          <span className="text-[10px] text-[#9CA3AF] uppercase font-bold">API CONNECTION</span>
          <span className="text-[11px] font-bold text-[#10B981]">CONNECTED</span>
        </div>
      </div>

      {/* Right Viksit Bharat Branding & Mission Clock */}
      <div className="flex items-center gap-5">
        {/* Viksit Bharat @2047 Tag */}
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <div className="text-[13px] font-extrabold text-[#1F2937] leading-tight">
              Viksit Bharat
            </div>
            <div className="text-[11px] font-bold text-[#F97316] leading-none">
              @2047
            </div>
          </div>
          
          {/* Flag Ribbon */}
          <div className="h-6 w-3 flex flex-col rounded-sm overflow-hidden border border-gray-200">
            <div className="h-2 bg-[#FF9933]"></div>
            <div className="h-2 bg-white flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-[#000080]"></div>
            </div>
            <div className="h-2 bg-[#138808]"></div>
          </div>

          <div className="hidden xl:block text-[8.5px] font-semibold text-[#6B7280] tracking-wide uppercase max-w-[120px] leading-tight">
            FOR A STRONGER, SAFER INDIA
          </div>
        </div>

        {/* Mission Live Clock */}
        <div className="text-right pl-3 border-l border-[#E5E7EB]">
          <div className="text-[15px] font-bold font-mono text-[#1F2937] tracking-wider leading-none">
            {timeStr}
          </div>
          <div className="text-[9.5px] font-medium text-[#6B7280] mt-0.5">
            {dateStr}
          </div>
        </div>
      </div>
    </header>
  );
};
