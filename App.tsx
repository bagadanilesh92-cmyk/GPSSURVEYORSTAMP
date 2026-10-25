import React, { useEffect, useRef, useState } from "react";

/* ================= DATABASE (IndexedDB) ================= */
type Folder = { id: string; name: string; created: number; updated: number; count: number };
type Photo = { id: string; folderId: string; blob: Blob; thumb: Blob; w: number; h: number; ts: number };
let dbp: Promise<IDBDatabase> | null = null;
const openDb = () =>
  dbp ||
  (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("surveystamp", 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore("folders", { keyPath: "id" });
      d.createObjectStore("photos", { keyPath: "id" }).createIndex("f", "folderId");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
const dbx = async (store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<any> => {
  const d = await openDb();
  return new Promise((res, rej) => {
    const q = fn(d.transaction(store, mode).objectStore(store));
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ================= HELPERS ================= */
const cap: any = (window as any).Capacitor?.Plugins;
const b64 = (b: Blob) =>
  new Promise<string>((r) => {
    const f = new FileReader();
    f.onload = () => r(String(f.result).split(",")[1]);
    f.readAsDataURL(b);
  });
const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40) || "claim";
const fmtTime = (t: number) =>
  new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
const dist = (a: number, b: number, c: number, d: number) => {
  const R = 6371000, p = Math.PI / 180;
  const x = Math.sin(((c - a) * p) / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(((d - b) * p) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
async function reverse(lat: number, lon: number): Promise<string> {
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, { headers: { "Accept-Language": "en" } });
  const a = (await r.json()).address || {};
  const parts = [a.road, a.neighbourhood, a.suburb, a.city || a.town || a.village, a.state_district, a.state, a.postcode, a.country].filter(Boolean);
  return parts.filter((p, i) => p !== parts[i - 1]).join(", ");
}
async function shareBlobs(items: { blob: Blob; name: string }[]) {
  try {
    if (cap?.Filesystem && cap?.Share) {
      const uris: string[] = [];
      for (const it of items) {
        await cap.Filesystem.writeFile({ path: `share/${it.name}`, data: await b64(it.blob), directory: "CACHE", recursive: true });
        uris.push((await cap.Filesystem.getUri({ path: `share/${it.name}`, directory: "CACHE" })).uri);
      }
      await cap.Share.share({ files: uris });
      return;
    }
    const files = items.map((i) => new File([i.blob], i.name, { type: "image/jpeg" }));
    if ((navigator as any).canShare?.({ files })) {
      await (navigator as any).share({ files });
      return;
    }
  } catch (e: any) {
    if (e?.name === "AbortError" || /cancel/i.test(String(e?.message))) return;
  }
  download(items);
}
function download(items: { blob: Blob; name: string }[]) {
  items.forEach((it, i) =>
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(it.blob);
      a.download = it.name;
      a.click();
    }, i * 400)
  );
}
async function saveGallery(items: { blob: Blob; name: string }[], claim: string): Promise<string> {
  try {
    if (cap?.Filesystem) {
      for (const it of items)
        await cap.Filesystem.writeFile({ path: `Pictures/SurveyStamp/${safe(claim)}/${it.name}`, data: await b64(it.blob), directory: "EXTERNAL_STORAGE", recursive: true });
      return `Saved to Pictures/SurveyStamp/${safe(claim)}`;
    }
  } catch (e) {}
  download(items);
  return "Downloading photos";
}
function useUrls(list: Photo[], k: "thumb" | "blob") {
  const [m, setM] = useState<Record<string, string>>({});
  useEffect(() => {
    const n: Record<string, string> = {};
    list.forEach((p) => (n[p.id] = URL.createObjectURL(p[k])));
    setM(n);
    return () => Object.values(n).forEach((u) => URL.revokeObjectURL(u));
  }, [list, k]);
  return m;
}

/* ================= STYLES ================= */
const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body,#root{margin:0;height:100%;background:#0B1B3A}
.app{position:fixed;inset:0;background:#0B1B3A;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;overflow:hidden}
.top{display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 14px;border-bottom:1px solid #1d3263;background:#0B1B3A}
.logo{width:46px;height:46px;border-radius:14px;background:#12285a;border:1px solid #2a437d;display:grid;place-items:center;color:#C9A24B}
.ttl{font-size:21px;font-weight:700;line-height:1.1}.sub{font-size:13px;color:#9db0d8;margin-top:3px}
.ib{width:42px;height:42px;border-radius:50%;border:1px solid #2a437d;background:#12285a;color:#fff;display:grid;place-items:center;font-size:18px;flex:none}
.body{flex:1;overflow-y:auto;padding:16px}
.search{width:100%;padding:14px 16px;border-radius:14px;border:1px solid #2a437d;background:#10224b;color:#fff;font-size:16px;outline:none;margin-bottom:14px}
.gold{width:100%;padding:16px;border:0;border-radius:16px;background:#C9A24B;color:#0B1B3A;font-size:18px;font-weight:700;box-shadow:0 8px 24px rgba(201,162,75,.25)}
.card{display:flex;align-items:center;gap:12px;padding:14px;margin-top:12px;border-radius:16px;background:#10224b;border:1px solid #223a73;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.fi{width:48px;height:48px;border-radius:14px;background:#17306a;color:#C9A24B;display:grid;place-items:center;font-size:22px;flex:none}
.fn{font-size:17px;font-weight:600}.fs{font-size:13px;color:#9db0d8;margin-top:2px}
.sm{width:38px;height:38px;border-radius:12px;border:0;background:#17306a;color:#C9A24B;font-size:16px}
.empty{margin-top:60px;text-align:center;color:#9db0d8;padding:0 20px}.empty b{display:block;color:#fff;font-size:19px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.ph{position:relative;aspect-ratio:1;background:#10224b;border-radius:8px;overflow:hidden}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
.chk{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.35);display:grid;place-items:center;font-size:14px;color:#0B1B3A}
.chk.on{background:#C9A24B;border-color:#C9A24B}
.fab{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);left:50%;transform:translateX(-50%);width:76px;height:76px;border-radius:50%;border:4px solid #fff;background:#C9A24B;color:#0B1B3A;font-size:30px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.bar{display:flex;gap:8px;padding:10px 12px;background:#10224b;border-top:1px solid #223a73;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}
.bar button{flex:1;padding:12px 4px;border-radius:12px;border:0;background:#17306a;color:#fff;font-size:14px;font-weight:600}
.bar button.d{color:#ff8f8f}
.toast{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);background:#C9A24B;color:#0B1B3A;padding:10px 18px;border-radius:999px;font-weight:700;z-index:50;font-size:14px;max-width:90%;text-align:center}
.mod{position:fixed;inset:0;background:rgba(0,0,0,.65);display:grid;place-items:center;z-index:60;padding:24px}
.mb{width:100%;max-width:380px;background:#10224b;border:1px solid #2a437d;border-radius:20px;padding:20px}
.mb h3{margin:0 0 12px;font-size:19px}.mb p{margin:0 0 14px;color:#b9c7e6}
.mb input{width:100%;padding:13px;border-radius:12px;border:1px solid #2a437d;background:#0B1B3A;color:#fff;font-size:16px;outline:none;margin-bottom:14px}
.mr{display:flex;gap:10px}.mr button{flex:1;padding:13px;border-radius:12px;border:0;font-size:16px;font-weight:700;background:#17306a;color:#fff}.mr button.p{background:#C9A24B;color:#0B1B3A}
.cam{position:fixed;inset:0;background:#000;z-index:20}
.cam video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ctop{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 14px) 14px 10px}
.chip{padding:9px 14px;border-radius:999px;background:rgba(8,16,36,.75);border:1px solid #2a437d;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.dot{width:10px;height:10px;border-radius:50%}
.addr{position:absolute;left:12px;right:12px;bottom:150px;padding:12px 14px;border-radius:14px;background:rgba(8,16,36,.72);font-size:13px;line-height:1.35}
.addr span{color:#E3C06B}
.cbot{position:absolute;left:0;right:0;bottom:0;height:140px;display:flex;align-items:center;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom,0px);background:linear-gradient(transparent,rgba(0,0,0,.7))}
.shut{width:80px;height:80px;border-radius:50%;border:5px solid #fff;background:#C9A24B;box-shadow:0 0 0 3px rgba(201,162,75,.4)}
.shut:disabled{opacity:.35}
.th{width:60px;height:60px;border-radius:14px;border:2px solid #fff;overflow:hidden;background:#10224b;transition:transform .25s}
.th img{width:100%;height:100%;object-fit:cover}
.rt{transition:transform .25s}
.nocam{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:30px;background:#0B1B3A;color:#cfd9f2}
.nocam button{margin-top:16px;padding:12px 28px;border-radius:12px;border:0;background:#C9A24B;color:#0B1B3A;font-weight:700;font-size:16px}
.view{position:fixed;inset:0;background:#000;z-index:30;display:flex;flex-direction:column}
.view .im{flex:1;display:grid;place-items:center;overflow:auto;touch-action:pan-x pan-y pinch-zoom}
.view img{max-width:100%;max-height:100%;object-fit:contain}
.info{padding:8px 16px;text-align:center;font-size:13px;color:#9db0d8;background:#0B1B3A}
`;

/* ================= CAMERA ================= */
function Camera({ folder, onBack, onSaved }: { folder: Folder; onBack: () => void; onSaved: (p: Photo) => void }) {
  const vref = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const orient = useRef<"up" | "ccw" | "cw" | "flip">("up");
  const [ori, setOri] = useState<"up" | "ccw" | "cw" | "flip">("up");
  const [err, setErr] = useState("");
  const [torch, setTorch] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [addr, setAddr] = useState("");
  const [addrOff, setAddrOff] = useState(false);
  const last = useRef<{ lat: number; lon: number; addr: string } | null>(null);
  const [lastThumb, setLastThumb] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let dead = false;
    (async () => {
      setErr("");
      try {
        let s: MediaStream;
        try {
          s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 4096 }, height: { ideal: 3072 } } });
        } catch (e) {
          s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } });
        }
        if (dead) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        if (vref.current) {
          vref.current.srcObject = s;
          await vref.current.play().catch(() => {});
        }
      } catch (e) {
        setErr("Camera is not available here. Install the APK on your phone and allow Camera permission.");
      }
    })();
    return () => {
      dead = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [tick]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        const lat = p.coords.latitude, lon = p.coords.longitude;
        setGps({ lat, lon, acc: p.coords.accuracy });
        const l = last.current;
        if (l && dist(l.lat, l.lon, lat, lon) < 30) {
          setAddr(l.addr);
          return;
        }
        try {
          const a = await reverse(lat, lon);
          last.current = { lat, lon, addr: a };
          setAddr(a);
          setAddrOff(false);
        } catch (e) {
          setAddrOff(true);
        }
      },
      () => setGps(null),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    let sx = 0, sy = 9.8;
    const h = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null) return;
      sx = sx * 0.8 + g.x * 0.2;
      sy = sy * 0.8 + g.y * 0.2;
      if (Math.abs(g.z || 0) > 8.5) return;
      const a = (Math.atan2(sx, sy) * 180) / Math.PI;
      const o = Math.abs(a) < 45 ? "up" : a >= 45 && a < 135 ? "ccw" : a <= -45 && a > -135 ? "cw" : "flip";
      if (o !== orient.current) {
        orient.current = o;
        setOri(o);
      }
    };
    window.addEventListener("devicemotion", h);
    return () => window.removeEventListener("devicemotion", h);
  }, []);

  const flash = async () => {
    const t: any = streamRef.current?.getVideoTracks()[0];
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch }] });
      setTorch(!torch);
    } catch (e) {
      setToast("Flash not supported");
      setTimeout(() => setToast(""), 1500);
    }
  };

  const shoot = async () => {
    const v = vref.current;
    if (!v || !v.videoWidth || busy) return;
    setBusy(true);
    try {
      const vw = v.videoWidth, vh = v.videoHeight;
      const base = window.innerHeight > window.innerWidth && vw > vh ? 90 : 0;
      const o = orient.current;
      const user = o === "ccw" ? -90 : o === "cw" ? 90 : o === "flip" ? 180 : 0;
      const tot = (((base + user) % 360) + 360) % 360;
      const sw = tot % 180 ? vh : vw, sh = tot % 180 ? vw : vh;
      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      const x = c.getContext("2d")!;
      x.translate(sw / 2, sh / 2);
      x.rotate((tot * Math.PI) / 180);
      x.drawImage(v, -vw / 2, -vh / 2, vw, vh);
      x.setTransform(1, 0, 0, 1, 0, 0);

      // ----- stamp -----
      const now = Date.now();
      const fs = Math.round(sw * 0.022), lh = fs * 1.32, pad = fs * 0.8;
      x.font = `600 ${fs}px sans-serif`;
      const maxW = sw - pad * 2 - fs * 1.6;
      const addrText = addr || (gps ? "Address unavailable (offline)" : "Location not available");
      const wrap = (t: string) => {
        const out: string[] = [];
        let cur = "";
        t.split(" ").forEach((w) => {
          const tr = cur ? cur + " " + w : w;
          if (x.measureText(tr).width > maxW && cur) {
            out.push(cur);
            cur = w;
          } else cur = tr;
        });
        if (cur) out.push(cur);
        return out;
      };
      let al = wrap(addrText).slice(0, 3);
      const coord = gps ? `Lat ${gps.lat.toFixed(6)}°   Long ${gps.lon.toFixed(6)}°` : "GPS not available";
      const timeL = fmtTime(now);
      let bh = (al.length + 2) * lh + pad * 2;
      while (bh > sh * 0.15 && al.length > 1) {
        al = al.slice(0, -1);
        bh = (al.length + 2) * lh + pad * 2;
      }
      const y0 = sh - bh;
      x.fillStyle = "rgba(8,16,36,0.74)";
      x.fillRect(0, y0, sw, bh);
      x.fillStyle = "#C9A24B";
      x.fillRect(0, y0, sw, Math.max(2, fs * 0.1));
      x.beginPath();
      x.arc(pad + fs * 0.5, y0 + pad + fs * 0.6, fs * 0.5, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#0B1B3A";
      x.beginPath();
      x.arc(pad + fs * 0.5, y0 + pad + fs * 0.6, fs * 0.2, 0, Math.PI * 2);
      x.fill();
      x.textBaseline = "top";
      const tx = pad + fs * 1.6;
      x.fillStyle = "#fff";
      al.forEach((l, i) => x.fillText(l, tx, y0 + pad + i * lh));
      x.fillStyle = "#E3C06B";
      x.fillText(coord, tx, y0 + pad + al.length * lh);
      x.fillStyle = "#fff";
      x.fillText(timeL, tx, y0 + pad + (al.length + 1) * lh);

      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.95));
      const tw = 320, tc = document.createElement("canvas");
      tc.width = tw;
      tc.height = Math.round((tw * sh) / sw);
      tc.getContext("2d")!.drawImage(c, 0, 0, tc.width, tc.height);
      const thumb: Blob = await new Promise((r) => tc.toBlob((b) => r(b!), "image/jpeg", 0.8));
      const p: Photo = { id: uid(), folderId: folder.id, blob, thumb, w: sw, h: sh, ts: now };
      await dbx("photos", "readwrite", (s) => s.put(p));
      setLastThumb(URL.createObjectURL(thumb));
      onSaved(p);
      setToast("Saved");
      setTimeout(() => setToast(""), 1200);
    } catch (e) {
      setToast("Could not save photo");
      setTimeout(() => setToast(""), 2000);
    }
    setBusy(false);
  };

  const rot = ori === "ccw" ? 90 : ori === "cw" ? -90 : ori === "flip" ? 180 : 0;
  const ok = !err && !!gps;
  return (
    <div className="cam">
      <video ref={vref} playsInline muted autoPlay />
      {err && (
        <div className="nocam">
          <div>
            {err}
            <br />
            <button onClick={() => setTick(tick + 1)}>Retry</button>
          </div>
        </div>
      )}
      <div className="ctop">
        <button className="ib" onClick={onBack}>←</button>
        <div className="chip">
          <span className="dot" style={{ background: gps ? "#1fbf75" : "#e0a030" }} />
          {gps ? `GPS locked (${Math.round(gps.acc)}m)` : "Searching GPS…"}
        </div>
        <div style={{ flex: 1 }} />
        <button className="ib rt" style={{ transform: `rotate(${rot}deg)`, background: torch ? "#C9A24B" : "#12285a" }} onClick={flash}>⚡</button>
      </div>
      {!err && (
        <div className="addr">
          {addr || (addrOff ? "Address unavailable (offline)" : "Finding address…")}
          <br />
          {gps && <span>Lat {gps.lat.toFixed(6)}°  Long {gps.lon.toFixed(6)}°</span>}
        </div>
      )}
      <div className="cbot">
        <div className="th" style={{ transform: `rotate(${rot}deg)` }}>{lastThumb && <img src={lastThumb} />}</div>
        <button className="shut" disabled={!!err || busy} onClick={shoot} title={ok ? "" : "Capture without GPS"} />
        <div style={{ width: 60 }} />
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ================= MAIN APP ================= */
export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [cur, setCur] = useState<Folder | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [screen, setScreen] = useState<"home" | "folder" | "camera">("home");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selMode, setSelMode] = useState(false);
  const [vi, setVi] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [dlg, setDlg] = useState<any>(null);
  const [val, setVal] = useState("");
  const timer = useRef<any>(null);
  const tsx = useRef(0);
  const thumbs = useUrls(photos, "thumb");
  const fulls = useUrls(vi !== null ? photos : [], "blob");

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 1800);
  };
  const loadFolders = async () => {
    const all: Folder[] = await dbx("folders", "readonly", (s) => s.getAll());
    setFolders(all.sort((a, b) => b.updated - a.updated));
  };
  const loadPhotos = async (f: Folder) => {
    const all: Photo[] = await dbx("photos", "readonly", (s) => s.index("f").getAll(f.id));
    setPhotos(all.sort((a, b) => b.ts - a.ts));
  };
  useEffect(() => {
    loadFolders();
  }, []);

  const openFolder = async (f: Folder) => {
    setCur(f);
    setSel(new Set());
    setSelMode(false);
    await loadPhotos(f);
    setScreen("folder");
  };
  const goHome = async () => {
    setScreen("home");
    setCur(null);
    setPhotos([]);
    await loadFolders();
  };
  const updateCount = async (f: Folder, n: number) => {
    const nf = { ...f, count: Math.max(0, n), updated: Date.now() };
    await dbx("folders", "readwrite", (s) => s.put(nf));
    setCur(nf);
    return nf;
  };

  const newFolder = () => {
    setVal("");
    setDlg({
      kind: "name",
      title: "New claim folder",
      ok: async (name: string) => {
        if (!name.trim()) return;
        const f: Folder = { id: uid(), name: name.trim(), created: Date.now(), updated: Date.now(), count: 0 };
        await dbx("folders", "readwrite", (s) => s.put(f));
        loadFolders();
      },
    });
  };
  const renameFolder = (f: Folder) => {
    setVal(f.name);
    setDlg({
      kind: "name",
      title: "Rename folder",
      ok: async (name: string) => {
        if (!name.trim()) return;
        await dbx("folders", "readwrite", (s) => s.put({ ...f, name: name.trim() }));
        loadFolders();
      },
    });
  };
  const deleteFolder = (f: Folder) =>
    setDlg({
      kind: "confirm",
      title: "Delete folder?",
      text: `"${f.name}" and all its photos will be deleted.`,
      ok: async () => {
        const ps: Photo[] = await dbx("photos", "readonly", (s) => s.index("f").getAll(f.id));
        for (const p of ps) await dbx("photos", "readwrite", (s) => s.delete(p.id));
        await dbx("folders", "readwrite", (s) => s.delete(f.id));
        loadFolders();
      },
    });

  const chosen = () => photos.filter((p) => sel.has(p.id));
  const toItems = (ps: Photo[]) => ps.map((p) => ({ blob: p.blob, name: `${safe(cur?.name || "claim")}_${p.ts}.jpg` }));
  const delPhotos = (ps: Photo[]) =>
    setDlg({
      kind: "confirm",
      title: `Delete ${ps.length} photo${ps.length > 1 ? "s" : ""}?`,
      text: "This cannot be undone.",
      ok: async () => {
        for (const p of ps) await dbx("photos", "readwrite", (s) => s.delete(p.id));
        const nf = await updateCount(cur!, cur!.count - ps.length);
        await loadPhotos(nf);
        setSel(new Set());
        setSelMode(false);
        setVi(null);
      },
    });

  const tStart = (id: string) => {
    timer.current = setTimeout(() => {
      timer.current = null;
      setSelMode(true);
      setSel(new Set([id]));
    }, 500);
  };
  const tEnd = (id: string, i: number) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      if (selMode) {
        const n = new Set(sel);
        n.has(id) ? n.delete(id) : n.add(id);
        setSel(n);
        if (n.size === 0) setSelMode(false);
      } else setVi(i);
    }
  };

  const list = folders.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="app">
      <style>{CSS}</style>

      {screen === "home" && (
        <>
          <div className="top">
            <div className="logo">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.6" /></svg>
            </div>
            <div>
              <div className="ttl">SurveyStamp</div>
              <div className="sub">GPS photo stamp for survey claims</div>
            </div>
          </div>
          <div className="body">
            <input className="search" placeholder="Search claim folders" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="gold" onClick={newFolder}>＋ New Claim Folder</button>
            {list.length === 0 && (
              <div className="empty"><b>No claim folders yet</b>Tap New Claim Folder above to start.</div>
            )}
            {list.map((f) => (
              <div className="card" key={f.id} onClick={() => openFolder(f)}>
                <div className="fi">▣</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fn">{f.name}</div>
                  <div className="fs">{f.count} photos • {fmtTime(f.updated)}</div>
                </div>
                <button className="sm" onClick={(e) => { e.stopPropagation(); renameFolder(f); }}>✎</button>
                <button className="sm" onClick={(e) => { e.stopPropagation(); deleteFolder(f); }}>🗑</button>
              </div>
            ))}
          </div>
        </>
      )}

      {screen === "folder" && cur && (
        <>
          <div className="top">
            <button className="ib" onClick={() => (selMode ? (setSelMode(false), setSel(new Set())) : goHome())}>←</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ttl" style={{ fontSize: 19 }}>{selMode ? `${sel.size} selected` : cur.name}</div>
              <div className="sub">{photos.length} photos</div>
            </div>
            {selMode && (
              <>
                <button className="sm" style={{ width: "auto", padding: "0 12px" }} onClick={() => setSel(new Set(photos.map((p) => p.id)))}>All</button>
                <button className="sm" style={{ width: "auto", padding: "0 12px" }} onClick={() => setSel(new Set())}>None</button>
              </>
            )}
          </div>
          <div className="body" style={{ padding: 6 }}>
            {photos.length === 0 && <div className="empty"><b>No photos yet</b>Tap the camera button to take the first photo.</div>}
            <div className="grid">
              {photos.map((p, i) => (
                <div
                  className="ph"
                  key={p.id}
                  onTouchStart={() => tStart(p.id)}
                  onTouchEnd={(e) => { e.preventDefault(); tEnd(p.id, i); }}
                  onTouchMove={() => { clearTimeout(timer.current); timer.current = null; }}
                  onClick={() => { if (!("ontouchstart" in window)) { timer.current = 1; tEnd(p.id, i); } }}
                >
                  {thumbs[p.id] && <img src={thumbs[p.id]} />}
                  {selMode && <div className={"chk" + (sel.has(p.id) ? " on" : "")}>{sel.has(p.id) ? "✓" : ""}</div>}
                </div>
              ))}
            </div>
            <div style={{ height: 110 }} />
          </div>
          {!selMode && <button className="fab" onClick={() => setScreen("camera")}>📷</button>}
          {selMode && (
            <div className="bar">
              <button onClick={() => sel.size && shareBlobs(toItems(chosen()))}>Share</button>
              <button onClick={async () => sel.size && say(await saveGallery(toItems(chosen()), cur.name))}>Save to phone</button>
              <button className="d" onClick={() => sel.size && delPhotos(chosen())}>Delete</button>
            </div>
          )}
        </>
      )}

      {screen === "camera" && cur && (
        <Camera
          folder={cur}
          onBack={async () => { await loadPhotos(cur); setScreen("folder"); }}
          onSaved={async (p) => { const nf = await updateCount(cur, cur.count + 1); setCur(nf); }}
        />
      )}

      {vi !== null && photos[vi] && (
        <div className="view">
          <div className="top" style={{ background: "#0B1B3A" }}>
            <button className="ib" onClick={() => setVi(null)}>←</button>
            <div style={{ flex: 1 }} />
            <button className="ib" onClick={() => shareBlobs(toItems([photos[vi]]))}>⇪</button>
            <button className="ib" onClick={() => delPhotos([photos[vi]])}>🗑</button>
          </div>
          <div
            className="im"
            onTouchStart={(e) => (tsx.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const d = e.changedTouches[0].clientX - tsx.current;
              if (d < -70 && vi < photos.length - 1) setVi(vi + 1);
              if (d > 70 && vi > 0) setVi(vi - 1);
            }}
          >
            {fulls[photos[vi].id] && <img src={fulls[photos[vi].id]} />}
          </div>
          <div className="info">
            {photos[vi].w}×{photos[vi].h} • {(photos[vi].blob.size / 1048576).toFixed(1)} MB • {vi + 1}/{photos.length}
          </div>
        </div>
      )}

      {dlg && (
        <div className="mod">
          <div className="mb">
            <h3>{dlg.title}</h3>
            {dlg.kind === "name" ? (
              <input autoFocus placeholder="Claim number / name" value={val} onChange={(e) => setVal(e.target.value)} />
            ) : (
              <p>{dlg.text}</p>
            )}
            <div className="mr">
              <button onClick={() => setDlg(null)}>Cancel</button>
              <button className="p" onClick={() => { const d = dlg; setDlg(null); d.ok(val); }}>{dlg.kind === "name" ? "Save" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
