import React from 'react';
import { X, Gauge, Activity, Thermometer, Droplet, Fuel, Cpu, CheckCircle } from 'lucide-react';
import { Rotax912State, SensorSuiteState, ThermalState } from '../types/simulation';

interface EngineDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: Rotax912State;
  thermal: ThermalState;
  sensors: SensorSuiteState;
  engineOn: boolean;
}

export const EngineDiagnosticsModal: React.FC<EngineDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  engine,
  thermal,
  sensors,
  engineOn
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-2xl w-full p-5 relative animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] uppercase">Rotax 912 ULS Diagnostics</h3>
              <div className="text-[10px] text-[#6B7280]">Detailed Subsystems & Physical Equilibrium States</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#6B7280] hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Engine Mechanical Power & Torque Output */}
          <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#E5E7EB]">
            <h4 className="text-[11px] font-bold text-[#1F2937] uppercase mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Mechanical Power Output & Crankshaft Dynamics</span>
            </h4>
            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[9.5px] text-[#9CA3AF] block">ENGINE RPM</span>
                <strong className="text-base text-[#1F2937] font-bold">{engineOn ? engine.rpm : 0}</strong>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[9.5px] text-[#9CA3AF] block">TORQUE</span>
                <strong className="text-base text-[#1F2937] font-bold">{engineOn ? engine.torque : 0} Nm</strong>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[9.5px] text-[#9CA3AF] block">BRAKE POWER</span>
                <strong className="text-base text-[#F97316] font-bold">{engineOn ? engine.powerHp : 0} hp</strong>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[9.5px] text-[#9CA3AF] block">KW OUTPUT</span>
                <strong className="text-base text-[#1F2937] font-bold">{engineOn ? engine.powerKw : 0} kW</strong>
              </div>
            </div>
          </div>

          {/* Subsystem Channel Diagnostics */}
          <div className="grid grid-cols-2 gap-3">
            {/* Thermal Loop */}
            <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#E5E7EB] space-y-2">
              <h5 className="font-bold text-[#1F2937] flex items-center gap-1.5 text-[11px]">
                <Thermometer className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Thermodynamic Subsystem</span>
              </h5>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Cylinder Head (CHT):</span>
                  <strong>{engineOn ? sensors.cht.value : 30.0} °C</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Exhaust Gas (EGT):</span>
                  <strong>{engineOn ? sensors.egt.value : 30.0} °C</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Lubrication Oil Temp:</span>
                  <strong>{engineOn ? sensors.oilTemperature.value : 30.0} °C</strong>
                </div>
              </div>
            </div>

            {/* Fluid & Pressure Loop */}
            <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#E5E7EB] space-y-2">
              <h5 className="font-bold text-[#1F2937] flex items-center gap-1.5 text-[11px]">
                <Droplet className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Fluid & Pressure Loops</span>
              </h5>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Engine Oil Pressure:</span>
                  <strong>{engineOn ? sensors.oilPressure.value : 0.0} bar</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Fuel Rail Delivery:</span>
                  <strong>{engineOn ? sensors.fuelPressure.value : 0.0} bar</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Fuel Consumption Rate:</span>
                  <strong>{engineOn ? sensors.fuelFlow.value : 0.0} L/h</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Manifold Pressure (MAP):</span>
                  <strong>{engineOn ? sensors.map.value : 29.9} inHg</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#E5E7EB] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#F97316] hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
