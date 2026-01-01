
import React, { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

declare const Html5Qrcode: any;

const QRScannerComponent: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const qrCodeInstanceRef = useRef<any>(null);
  const containerId = "qr-reader-container";

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(containerId);
        qrCodeInstanceRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => {
            // Success: stop and clear immediately before calling parent
            html5QrCode.stop().then(() => {
              onScan(decodedText);
            }).catch(err => {
              console.error("Error stopping scanner after success:", err);
              onScan(decodedText); // Proceed anyway
            });
          },
          (errorMessage: string) => {
            // Usually frame errors, ignore to keep UI clean
          }
        );
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Scanner initialization failed:", err);
        setInitError("Camera access denied or not available.");
        setIsInitializing(false);
        if (onError) onError(err.message || "Camera error");
      }
    };

    startScanner();

    return () => {
      if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
        qrCodeInstanceRef.current.stop().catch((err: any) => {
          console.error("Failed to stop scanner on unmount:", err);
        });
      }
    };
  }, []);

  return (
    <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-[2.5rem] shadow-2xl bg-slate-900 border-4 border-white ring-1 ring-slate-200 aspect-square">
      {/* Scanner Element */}
      <div id={containerId} className="w-full h-full"></div>

      {/* Custom Overlay */}
      {isInitializing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white text-xs font-bold uppercase tracking-widest">Initializing Camera...</p>
        </div>
      )}

      {initError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20 p-8 text-center">
          <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white mb-4">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <p className="text-white text-sm font-bold">{initError}</p>
        </div>
      )}

      {!isInitializing && !initError && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
          {/* Scanning Box Outline */}
          <div className="w-[250px] h-[250px] border-2 border-blue-500/50 rounded-3xl relative">
            {/* Corners */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-xl"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr-xl"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl-xl"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-xl"></div>
            
            {/* Laser Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-[scanner-line_2s_infinite] shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
          </div>
          
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
              Detecting QR Code
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanner-line {
          0% { transform: translateY(0); }
          50% { transform: translateY(240px); }
          100% { transform: translateY(0); }
        }
        #${containerId} video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
};

export default QRScannerComponent;
