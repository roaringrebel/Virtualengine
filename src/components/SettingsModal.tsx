import React from 'react';
import { X, Settings as SettingsIcon, Sliders, Activity } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiEndpoint: string;
  onUpdateEndpoint: (endpoint: string) => void;
  speedMultiplier: number;
  onUpdateSpeed: (speed: number) => void;
  sensorNoiseEnabled: boolean;
  onToggleNoise: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiEndpoint,
  onUpdateEndpoint,
  speedMultiplier,
  onUpdateSpeed,
  sensorNoiseEnabled,
  onToggleNoise
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-md w-full p-5 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] uppercase">Simulator Settings</h3>
              <div className="text-[10px] text-[#6B7280]">Telemetry, Speed, and Model Parameters</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7280] hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* API Endpoint */}
          <div>
            <label className="block text-[11px] font-bold text-[#374151] mb-1">
              Digital Twin (Website 2) API Endpoint:
            </label>
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => onUpdateEndpoint(e.target.value)}
              className="w-full font-mono text-xs p-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] focus:border-[#F97316] outline-none"
            />
          </div>

          {/* Simulation Speed */}
          <div>
            <label className="block text-[11px] font-bold text-[#374151] mb-1">
              Simulation Time Scale:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0.5, 1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => onUpdateSpeed(speed)}
                  className={`py-1.5 rounded-lg font-bold text-xs border ${
                    speedMultiplier === speed
                      ? 'bg-[#F97316] border-[#F97316] text-white shadow-sm'
                      : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Sensor Noise Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
            <div>
              <div className="font-bold text-[#1F2937]">Realistic Sensor Noise</div>
              <div className="text-[10px] text-[#6B7280]">Small bounded deterministic variation</div>
            </div>
            <button
              onClick={() => onToggleNoise(!sensorNoiseEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                sensorNoiseEnabled ? 'bg-[#F97316]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  sensorNoiseEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-[#E5E7EB] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
