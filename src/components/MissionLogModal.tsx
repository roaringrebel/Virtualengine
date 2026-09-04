import React from 'react';
import { X, FileText, Download } from 'lucide-react';
import { MissionEventLog } from '../types/mission';

interface MissionLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: MissionEventLog[];
}

export const MissionLogModal: React.FC<MissionLogModalProps> = ({
  isOpen,
  onClose,
  logs
}) => {
  if (!isOpen) return null;

  const handleExport = () => {
    const text = logs.map(l => `[${l.simTimestamp}] [${l.category}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mission_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-lg w-full p-5 relative animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] uppercase">Mission Simulation Log</h3>
              <div className="text-[10px] text-[#6B7280]">Chronological Flight & Engine Event History</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7280] hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Log Stream */}
        <div className="flex-1 overflow-y-auto space-y-1.5 p-2 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] font-mono text-[10px]">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-[#9CA3AF]">No simulation events recorded yet.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 p-1.5 rounded bg-white border border-gray-100 shadow-xs">
                <span className="text-[#F97316] font-bold">{log.simTimestamp}</span>
                <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold ${
                  log.category === 'FAULT' ? 'bg-red-100 text-red-700' :
                  log.category === 'ENGINE' ? 'bg-blue-100 text-blue-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {log.category}
                </span>
                <span className="text-[#1F2937] font-medium">{log.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#E5E7EB] flex justify-between items-center">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#4B5563] text-xs font-bold rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log</span>
          </button>

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
