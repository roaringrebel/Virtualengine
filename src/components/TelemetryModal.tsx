import React, { useState } from 'react';
import { X, Radio, Copy, Check, Download, Send } from 'lucide-react';
import { TelemetryClientStatus, TelemetryPacket } from '../types/telemetry';

interface TelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetryStatus: TelemetryClientStatus;
  latestPacket: TelemetryPacket | null;
  onTransmitManual: () => void;
}

export const TelemetryModal: React.FC<TelemetryModalProps> = ({
  isOpen,
  onClose,
  telemetryStatus,
  latestPacket,
  onTransmitManual
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonStr = latestPacket ? JSON.stringify(latestPacket, null, 2) : '{\n  "status": "NO_PACKET"\n}';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_packet_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-xl w-full p-5 relative animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] uppercase">Live Telemetry Inspector</h3>
              <div className="text-[10px] text-[#6B7280]">Real-Time REST JSON Payload to Website 2</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#6B7280] hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3 bg-[#F9FAFB] p-2.5 rounded-xl border border-[#E5E7EB] text-center font-mono text-[10px]">
          <div>
            <span className="text-[#9CA3AF] block">STATUS</span>
            <strong className="text-[#10B981] font-bold">{telemetryStatus.status}</strong>
          </div>
          <div>
            <span className="text-[#9CA3AF] block">SENT</span>
            <strong className="text-[#1F2937] font-bold">{telemetryStatus.packetsSent.toLocaleString()}</strong>
          </div>
          <div>
            <span className="text-[#9CA3AF] block">LATENCY</span>
            <strong className="text-[#F97316] font-bold">{telemetryStatus.latencyMs} ms</strong>
          </div>
          <div>
            <span className="text-[#9CA3AF] block">LAST DISPATCH</span>
            <strong className="text-[#1F2937] font-bold">{telemetryStatus.lastTransmissionTime || '--:--:--'}</strong>
          </div>
        </div>

        {/* JSON Code Viewer */}
        <div className="flex-1 bg-[#0F172A] text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-y-auto border border-slate-700 shadow-inner">
          <pre className="whitespace-pre-wrap">{jsonStr}</pre>
        </div>

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-[#E5E7EB] flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#4B5563] text-xs font-bold rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#4B5563] text-xs font-bold rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onTransmitManual}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Manual Ping</span>
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
    </div>
  );
};
