import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, Check, Activity, Thermometer, Droplet, Flame, Fuel, Wind } from 'lucide-react';
import { FaultSeverity, FaultState, FaultType } from '../types/simulation';
import { FAULT_DEFINITIONS } from '../simulation/faultModel';

interface FaultSimulationProps {
  faultState: FaultState;
  onInjectFault: (fault: FaultType, severity: FaultSeverity) => void;
  onClearFault: () => void;
  engineOn: boolean;
}

export const FaultSimulation: React.FC<FaultSimulationProps> = ({
  faultState,
  onInjectFault,
  onClearFault,
  engineOn
}) => {
  const [selectedFault, setSelectedFault] = useState<FaultType>(faultState.activeFault);
  const [selectedSeverity, setSelectedSeverity] = useState<FaultSeverity>(faultState.severity);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const faultOptions: Array<{ id: FaultType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'NORMAL', label: 'Normal Operation', icon: Check },
    { id: 'LOW_OIL_PRESSURE', label: 'Low Oil Pressure', icon: Droplet },
    { id: 'HIGH_CHT', label: 'High CHT', icon: Thermometer },
    { id: 'OVERHEATING', label: 'Overheating', icon: Flame },
    { id: 'EXCESSIVE_VIBRATION', label: 'Excessive Vibration', icon: Activity },
    { id: 'RPM_INSTABILITY', label: 'RPM Instability', icon: Wind },
    { id: 'FUEL_PRESSURE_DROP', label: 'Fuel Pressure Drop', icon: Fuel },
    { id: 'COOLING_PROBLEM', label: 'Cooling Problem', icon: AlertTriangle },
  ];

  const handleApply = () => {
    onInjectFault(selectedFault, selectedSeverity);
  };

  const currentFaultInfo = FAULT_DEFINITIONS[faultState.activeFault];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#1F2937] tracking-tight uppercase">FAULT SIMULATION</h2>
              <div className="text-[10px] text-[#6B7280]">Inject fault conditions to simulate abnormal behaviour</div>
            </div>
          </div>

          {faultState.activeFault !== 'NORMAL' && (
            <button
              onClick={onClearFault}
              className="text-[10px] font-bold text-[#EF4444] hover:underline"
            >
              CLEAR FAULT
            </button>
          )}
        </div>

        {/* Fault Selector Dropdown */}
        <div className="relative mb-2.5">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs font-semibold text-[#1F2937] hover:border-[#F97316] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${selectedFault === 'NORMAL' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
              <span>{faultOptions.find(f => f.id === selectedFault)?.label}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-[#6B7280]" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-30 py-1 max-h-56 overflow-y-auto">
              {faultOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedFault === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedFault(opt.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ${
                      isSelected ? 'bg-orange-50 text-[#F97316] font-bold' : 'text-[#374151] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Severity Selector */}
        {selectedFault !== 'NORMAL' && (
          <div className="flex items-center justify-between mb-2.5 bg-[#F9FAFB] p-1.5 rounded-lg border border-[#E5E7EB]">
            <span className="text-[10px] font-semibold text-[#6B7280] uppercase pl-1">Severity:</span>
            <div className="flex gap-1">
              {(['LOW', 'MEDIUM', 'HIGH'] as FaultSeverity[]).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition-all ${
                    selectedSeverity === sev
                      ? 'bg-[#F97316] text-white shadow-sm'
                      : 'text-[#6B7280] hover:bg-gray-200'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Inject Fault Button */}
        <button
          onClick={handleApply}
          disabled={!engineOn}
          className={`w-full py-2 rounded-lg text-xs font-bold text-white transition-all shadow-sm ${
            selectedFault === 'NORMAL'
              ? 'bg-[#10B981] hover:bg-emerald-600'
              : 'bg-[#F97316] hover:bg-orange-600 shadow-orange-glow'
          }`}
        >
          {selectedFault === 'NORMAL' ? 'Set Normal Operation' : 'Inject Fault'}
        </button>
      </div>

      {/* Active Fault Causal Propagation Card */}
      {faultState.activeFault !== 'NORMAL' && (
        <div className="mt-2.5 p-2 bg-red-50/60 border border-red-200 rounded-lg text-[10px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#EF4444]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
            <span>ACTIVE: {currentFaultInfo.name} ({faultState.severity})</span>
          </div>
          <div className="text-[#6B7280] leading-tight">
            {currentFaultInfo.description}
          </div>
        </div>
      )}
    </div>
  );
};
