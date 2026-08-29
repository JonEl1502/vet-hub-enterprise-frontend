import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ScanLine, Keyboard, CameraOff } from 'lucide-react';

/**
 * Camera barcode scanning.
 *
 * ── The honest state of this ───────────────────────────────────────────────
 * `BarcodeDetector` is native in Chrome and Android WebView and absent in
 * Safari, including on iOS — where EVERY browser is Safari's engine. So this
 * works on the Android phones most Kenyan counters actually use, and cannot
 * work on an iPhone without shipping a WASM decoder (~300 kB) that would land
 * in the till bundle for everyone.
 *
 * Rather than pretend, an unsupported device is TOLD so and handed the thing
 * that does work: the search field, which is also what a USB/Bluetooth laser
 * scanner types into. A camera button that silently never finds anything is
 * worse than no camera button.
 *
 * ⚠️ The stream must be stopped on every exit path or the camera light stays on
 * after the sheet closes — which users read, correctly, as being recorded.
 */

type Supported = 'checking' | 'yes' | 'no';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Return true if the code was consumed; false keeps the camera hunting. */
  onDetected: (code: string) => Promise<boolean> | boolean;
  /** Offered when the camera cannot be used here. */
  onTypeInstead: () => void;
}

const PosScanner: React.FC<Props> = ({ open, onClose, onDetected, onTypeInstead }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const [supported, setSupported] = useState<Supported>('checking');
  const [error, setError] = useState<string | null>(null);
  const [hit, setHit] = useState<string | null>(null);
  /** True from the moment we ask for the camera until frames actually arrive. */
  const [starting, setStarting] = useState(true);
  const [slow, setSlow] = useState(false);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) { stop(); return; }

    const Detector = (window as any).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setSupported('no');
      return;
    }

    let cancelled = false;
    setSupported('yes');
    setError(null);
    setStarting(true);
    setSlow(false);

    /**
     * ⚠️ `getUserMedia` does NOT reject while a permission prompt is open — it
     * simply never settles. Left alone, a cashier who ignores or misses the
     * prompt stares at a black rectangle with a reticle on it and no
     * explanation, which is indistinguishable from a broken app. Say something
     * after a few seconds and offer the way out.
     */
    const watchdog = window.setTimeout(() => { if (!cancelled) setSlow(true); }, 4000);

    (async () => {
      let detector: any;
      try {
        // Ask for the formats an agrovet shelf actually carries. Narrowing the
        // list is a real speed-up — the detector tries each one per frame.
        const formats: string[] = await Detector.getSupportedFormats?.() ?? [];
        const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
        const use = want.filter((f) => formats.includes(f));
        detector = new Detector(use.length ? { formats: use } : undefined);
      } catch {
        if (!cancelled) setSupported('no');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // The BACK camera, and a resolution high enough to resolve the bars
          // of an EAN-13 at arm's length.
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        // `playsInline` matters: without it iOS takes the video full-screen.
        await v.play().catch(() => {});
        if (!cancelled) { setStarting(false); setSlow(false); }
      } catch (e: any) {
        if (cancelled) return;
        setStarting(false);
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera permission was refused. Allow it in the browser’s site settings, or type the code.'
            : 'This device would not open its camera.'
        );
        return;
      }

      const tick = async () => {
        rafRef.current = requestAnimationFrame(tick);
        const v = videoRef.current;
        if (!v || v.readyState < 2 || busyRef.current) return;
        busyRef.current = true;
        try {
          const found = await detector.detect(v);
          const code = found?.[0]?.rawValue;
          if (code) {
            const now = Date.now();
            // A camera reads the same barcode ~30 times a second. Without this
            // guard one item lands in the cart thirty times.
            if (code !== lastRef.current.code || now - lastRef.current.at > 2000) {
              lastRef.current = { code, at: now };
              setHit(code);
              navigator.vibrate?.(40);
              const consumed = await onDetected(code);
              if (consumed) window.setTimeout(() => setHit(null), 900);
              else setHit(null);
            }
          }
        } catch {
          /* a frame that will not decode is not an error worth showing */
        } finally {
          busyRef.current = false;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    })();

    return () => { cancelled = true; window.clearTimeout(watchdog); stop(); };
  }, [open, onDetected, stop]);

  useEffect(() => () => stop(), [stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col" style={{ background: '#000' }}>
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ paddingTop: 'calc(0.75rem + var(--sp-safe-top))', paddingBottom: '0.75rem' }}
      >
        <p className="text-[13px] font-black uppercase tracking-wider" style={{ color: '#fff' }}>
          Scan a barcode
        </p>
        <button
          onClick={() => { stop(); onClose(); }}
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ color: 'rgba(255,255,255,0.7)' }}
          aria-label="Close scanner"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 min-h-0 relative flex items-center justify-center">
        {supported === 'no' || error ? (
          <div className="px-8 text-center max-w-sm">
            <CameraOff size={34} style={{ color: 'rgba(255,255,255,0.5)' }} className="mx-auto mb-3" />
            <p className="text-[14px] font-bold mb-1.5" style={{ color: '#fff' }}>
              {error ? 'Camera unavailable' : 'This browser can’t scan with the camera'}
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {error ??
                'Safari and iPhones don’t support in-page barcode scanning yet. A USB or Bluetooth scanner works anywhere — it types into the search box.'}
            </p>
            <button
              onClick={() => { stop(); onClose(); onTypeInstead(); }}
              className="sp-btn mt-5 mx-auto"
            >
              <Keyboard size={17} /> Type the code
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Reticle. Wide and short, because that is the shape of a barcode —
                it tells the cashier how to hold the phone without a caption. */}
            <div className="relative pointer-events-none w-[78%] max-w-sm aspect-[5/2]">
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  boxShadow: '0 0 0 100vmax rgba(0,0,0,0.55)',
                  border: `2px solid ${hit ? 'var(--sp-good, #12805c)' : 'rgba(255,255,255,0.9)'}`,
                }}
              />
              {!hit && !starting && <div className="sp-scanline" />}
            </div>
            <div className="absolute bottom-7 left-0 right-0 px-8 text-center">
              <p
                className="text-[12px] font-semibold"
                style={{ color: hit ? '#5fe0b0' : 'rgba(255,255,255,0.75)' }}
              >
                {hit
                  ? `Read ${hit}`
                  : starting
                    ? 'Starting the camera…'
                    : 'Hold the barcode inside the frame'}
              </p>
              {slow && starting && (
                <>
                  <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Still waiting for camera permission. Look for the prompt at the
                    top of the browser, or type the code instead.
                  </p>
                  <button
                    onClick={() => { stop(); onClose(); onTypeInstead(); }}
                    className="sp-btn sp-btn-ghost mt-3 mx-auto"
                  >
                    <Keyboard size={16} /> Type the code
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PosScanner;
