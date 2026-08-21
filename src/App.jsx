bash

cat > /home/claude/ot-flow-app/src/App.jsx << 'ENDOFFILE'
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Package,
  FileWarning, ShieldCheck, ChevronRight, X, Radio, RefreshCw, WifiOff, ScrollText, Camera, Download, LogOut, Lock,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

// ---- Supabase client ---------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ---- Static config ---------------------------------------------------

const STAGES = ["Waiting", "Prep", "Incision", "Closing", "Cleaning"];

const STAGE_COLOR = {
  Waiting: "bg-slate-300",
  Prep: "bg-amber-400",
  Incision: "bg-rose-500",
  Closing: "bg-teal-500",
  Cleaning: "bg-sky-500",
};

const CATEGORY_LABEL = {
  stage: "Stage Changes",
  consent: "Consent Signed",
  warn: "Consent Alerts",
  scan: "Pack Scans",
  info: "Readiness Updates",
};

// ---- Small UI atoms ---------------------------------------------------

function Eyebrow({ children }) {
  return (
    <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-indigo-500 mb-1.5">
      {children}
    </div>
  );
}

function StatusPill({ tone, children }) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function OTBay({ room, pack, onAdvance, busy, accent }) {
  const packMissing = !pack || pack.status === "expired";
  const blocked = packMissing || !room.consent;

  return (
    <div className={`relative bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-sm border border-slate-200 border-t-4 ${accent}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-xs text-slate-400 tracking-wide">{room.id}</div>
          <div className="text-lg font-bold text-slate-800">{room.patient_name}</div>
        </div>
        <StatusPill tone={blocked ? "bad" : "ok"}>
          {blocked ? <AlertTriangle size={12} /> : <Radio size={12} />}
          {blocked ? "Blocked" : "Live"}
        </StatusPill>
      </div>

      <div className="flex items-center gap-1 mt-1">
        {STAGES.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`h-2 w-full rounded-full ${i <= room.stage ? STAGE_COLOR[s] : "bg-slate-150 bg-slate-200"} ${
                i === room.stage ? "animate-pulse" : ""
              }`}
            />
            <span className={`text-[9px] font-semibold uppercase ${i === room.stage ? "text-slate-700" : "text-slate-300"}`}>
              {s}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1"><Clock size={12} /> {room.started_min} min elapsed</span>
        <span className="flex items-center gap-1">
          <Package size={12} /> {room.pack_id}
        </span>
      </div>

      {blocked && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2 flex items-center gap-1.5">
          <FileWarning size={13} className="shrink-0" />
          {!room.consent ? "Consent not signed — surgery cannot proceed." : "Assigned pack expired or unavailable."}
        </div>
      )}

      <button
        onClick={() => onAdvance(room.id, room.stage)}
        disabled={room.stage >= STAGES.length - 1 || blocked || busy}
        className="text-xs font-semibold flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-800 text-white hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
      >
        Advance stage <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ---- QR Scanner modal (real webcam scanning via html5-qrcode) --------

function QRScannerModal({ onScan, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 220 }, false);
    let active = true;
    scanner.render(
      (decodedText) => {
        if (!active) return;
        active = false;
        scanner.clear().catch(() => {});
        onScan(decodedText);
      },
      () => {}
    );
    return () => {
      active = false;
      scanner.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Camera size={16} className="text-teal-500" /> Scan Pack QR Code
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div id="qr-reader" className="rounded-xl overflow-hidden" />
        <p className="text-[11px] text-slate-400 mt-3">
          Point the camera at a pack's QR code below to mark it received/sterile at point of use.
        </p>
      </div>
    </div>
  );
}

// ---- Login screen ---------------------------------------------------

function LoginScreen({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      onSuccess(data.session);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl border border-slate-100">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center shadow-sm">
            <Activity size={19} className="text-white" />
          </div>
          <div className="text-xl font-bold text-slate-800">OT-Flow</div>
        </div>
        <div className="text-xs text-slate-400 mb-6">Admin login required</div>

        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 mb-4 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          placeholder="admin@otflow.com"
        />

        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 mb-4 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          placeholder="••••••••"
        />

        {error && (
          <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-gradient-to-r from-indigo-600 to-teal-500 text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 shadow-sm transition-opacity disabled:opacity-50"
        >
          <Lock size={14} /> {busy ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

// ---- Main app -----------------------------------------------------

const ROOM_ACCENTS = ["border-t-indigo-400", "border-t-teal-400", "border-t-violet-400", "border-t-sky-400"];

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [patients, setPatients] = useState([]);
  const [packs, setPacks] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [log, setLog] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);

  const loadAll = useCallback(async () => {
    const [roomsRes, patientsRes, packsRes] = await Promise.all([
      supabase.from("ot_rooms").select("*"),
      supabase.from("patients").select("*"),
      supabase.from("sterile_packs").select("*"),
    ]);

    const firstError = roomsRes.error || patientsRes.error || packsRes.error;
    if (firstError) {
      setConnectionError(firstError.message);
    } else {
      setConnectionError(null);
      setRooms(roomsRes.data);
      setPatients(patientsRes.data);
      setPacks(packsRes.data);
      setLastSync(new Date());
    }
    setLoading(false);
  }, []);

  const loadLog = useCallback(async () => {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) setLog(data);
  }, []);

  const logActivity = useCallback(async (message, category = "info") => {
    await supabase.from("activity_log").insert({ message, category });
    loadLog();
  }, [loadLog]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadAll();
    loadLog();
  }, [loadAll, loadLog]);

  useEffect(() => {
    const channel = supabase
      .channel("ot-flow-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ot_rooms" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "sterile_packs" }, loadAll)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, loadLog)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadAll, loadLog]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const packById = useMemo(() => Object.fromEntries(packs.map((p) => [p.id, p])), [packs]);

  const advanceStage = async (roomId, currentStage) => {
    const newStage = Math.min(currentStage + 1, STAGES.length - 1);
    setSyncing(true);
    const { error } = await supabase.from("ot_rooms").update({ stage: newStage }).eq("id", roomId);
    if (!error) {
      setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, stage: newStage } : r)));
      setLastSync(new Date());
      logActivity(`${roomId} moved to stage "${STAGES[newStage]}"`, "stage");
    }
    setSyncing(false);
  };

  const toggleConsent = async (patientId) => {
    const patient = patients.find((p) => p.id === patientId);
    const newVal = !patient.consent;
    setSyncing(true);
    await supabase.from("patients").update({ consent: newVal }).eq("id", patientId);
    if (patient.room_id) {
      await supabase.from("ot_rooms").update({ consent: newVal }).eq("id", patient.room_id);
    }
    setPatients((ps) => ps.map((p) => (p.id === patientId ? { ...p, consent: newVal } : p)));
    setRooms((rs) => rs.map((r) => (r.id === patient.room_id ? { ...r, consent: newVal } : r)));
    setLastSync(new Date());
    logActivity(`Consent ${newVal ? "signed" : "revoked"} for ${patient.name} (${patient.id})`, newVal ? "consent" : "warn");
    setSyncing(false);
  };

  const toggleReady = async (patientId) => {
    const patient = patients.find((p) => p.id === patientId);
    const newVal = !patient.ready;
    setSyncing(true);
    await supabase.from("patients").update({ ready: newVal }).eq("id", patientId);
    setPatients((ps) => ps.map((p) => (p.id === patientId ? { ...p, ready: newVal } : p)));
    setLastSync(new Date());
    logActivity(`${patient.name} marked as ${newVal ? "ready" : "not ready"}`, "info");
    setSyncing(false);
  };

  const handleScan = async (decodedText) => {
    setScannerOpen(false);
    const packId = decodedText.trim();
    const pack = packs.find((p) => p.id === packId);
    if (!pack) {
      setScanMsg({ tone: "bad", text: `Scanned code "${packId}" doesn't match any known pack.` });
      logActivity(`Unrecognized pack scan: "${packId}"`, "warn");
      return;
    }
    const { error } = await supabase
      .from("sterile_packs")
      .update({ status: "sterile", in_use: true })
      .eq("id", packId);
    if (!error) {
      setPacks((ps) => ps.map((p) => (p.id === packId ? { ...p, status: "sterile", in_use: true } : p)));
      setScanMsg({ tone: "ok", text: `${packId} scanned and marked sterile / in use.` });
      logActivity(`Pack ${packId} scanned at point of use — marked sterile`, "scan");
    } else {
      setScanMsg({ tone: "bad", text: `Failed to update ${packId}: ${error.message}` });
    }
  };

  const alerts = useMemo(() => {
    const out = [];
    rooms.forEach((r) => {
      if (!r.consent) out.push({ id: `c-${r.id}`, tone: "bad", text: `${r.id} — consent missing for ${r.patient_name}` });
      const pack = packById[r.pack_id];
      if (pack && pack.status === "expired") out.push({ id: `p-${r.id}`, tone: "bad", text: `${r.id} — assigned pack ${pack.id} is expired` });
      if (pack && pack.status === "expiring") out.push({ id: `pe-${r.id}`, tone: "warn", text: `${r.id} — pack ${pack.id} expires in ${pack.expires_in_hrs}h` });
      if (r.started_min > 90) out.push({ id: `t-${r.id}`, tone: "warn", text: `${r.id} — turnover exceeding 90 min` });
    });
    patients.forEach((p) => {
      if (!p.consent) out.push({ id: `pc-${p.id}`, tone: "bad", text: `${p.name} (${p.ward}) — consent form not signed` });
    });
    return out;
  }, [rooms, patients, packById]);

  const utilNow = rooms.length ? Math.round((rooms.filter((r) => r.stage > 0 && r.stage < 4).length / rooms.length) * 100) : 0;

  const downloadReport = () => {
    const now = new Date();
    const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const lines = [
      "OT-Flow Workflow Report",
      `Generated,${esc(now.toLocaleString())}`,
      "",
      "Summary",
      `OT Utilization,${utilNow}%`,
      `Active Bays,${rooms.length}`,
      `Sterile Packs Ready,${packs.filter((p) => p.status === "sterile").length} of ${packs.length}`,
      `Open Alerts,${alerts.length}`,
      "",
      "Current Alerts",
      "Severity,Message",
      ...alerts.map((a) => `${a.tone === "bad" ? "Critical" : "Warning"},${esc(a.text)}`),
      "",
      "Activity Log (most recent first)",
      "Timestamp,Category,Message",
      ...log.map((entry) => `${esc(new Date(entry.created_at).toLocaleString())},${esc(entry.category)},${esc(entry.message)}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ot-flow-report-${now.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logActivity("Performance report exported (CSV)", "info");
  };

  const eventBreakdown = useMemo(() => {
    const counts = {};
    log.forEach((entry) => {
      const label = CATEGORY_LABEL[entry.category] || "Other";
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [log]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 text-slate-500 flex items-center justify-center gap-2 text-sm">
        <RefreshCw size={16} className="animate-spin" /> Checking session...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSuccess={setSession} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 text-slate-500 flex items-center justify-center gap-2 text-sm">
        <RefreshCw size={16} className="animate-spin" /> Connecting to database...
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 text-slate-600 flex flex-col items-center justify-center gap-3 text-sm p-6 text-center">
        <WifiOff size={24} className="text-rose-400" />
        <div>Could not connect to Supabase.</div>
        <div className="text-slate-400 text-xs max-w-md">{connectionError}</div>
        <div className="text-slate-400 text-xs max-w-md">
          Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly in your environment variables.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/60 via-white to-teal-50/60 text-slate-800 font-sans">
      <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center shadow-sm">
            <Activity size={17} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-800 leading-tight">OT-Flow</div>
            <div className="text-[11px] text-slate-400 leading-tight">Hospital Workflow Console</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadReport}
            className="text-[11px] font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <Download size={13} /> Download Report
          </button>
          <StatusPill tone="ok">
            {syncing ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Live · Supabase
          </StatusPill>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-slate-400 hover:text-rose-500 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-700">{clock.toLocaleTimeString()}</div>
            <div className="text-[11px] text-slate-400">{clock.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</div>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-8 max-w-7xl mx-auto">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "OT Utilization", value: `${utilNow}%`, icon: Activity, chip: "bg-indigo-100 text-indigo-600", text: "text-indigo-600" },
            { label: "Active Bays", value: `${rooms.length}`, icon: Radio, chip: "bg-sky-100 text-sky-600", text: "text-sky-600" },
            { label: "Sterile Packs", value: `${packs.filter((p) => p.status === "sterile").length}/${packs.length}`, icon: ShieldCheck, chip: "bg-emerald-100 text-emerald-600", text: "text-emerald-600" },
            { label: "Open Alerts", value: `${alerts.length}`, icon: AlertTriangle, chip: alerts.length ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500", text: alerts.length ? "text-rose-600" : "text-slate-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <Eyebrow>{s.label}</Eyebrow>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.chip}`}>
                  <s.icon size={15} />
                </div>
              </div>
              <div className={`text-3xl font-bold ${s.text}`}>{s.value}</div>
            </div>
          ))}
        </section>

        <section>
          <Eyebrow>Live Operating Theatres</Eyebrow>
          <div className="grid md:grid-cols-3 gap-4 mt-2">
            {rooms.map((r, i) => (
              <OTBay key={r.id} room={r} pack={packById[r.pack_id]} onAdvance={advanceStage} busy={syncing} accent={ROOM_ACCENTS[i % ROOM_ACCENTS.length]} />
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-8">
          <section>
            <Eyebrow>Admissions &amp; Readiness</Eyebrow>
            <div className="bg-white rounded-2xl divide-y divide-slate-100 mt-2 shadow-sm border border-slate-200">
              {patients.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{p.id} · {p.ward}{p.room_id ? ` · ${p.room_id}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleConsent(p.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        p.consent ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {p.consent ? "Consent ✓" : "No Consent"}
                    </button>
                    <button
                      onClick={() => toggleReady(p.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        p.ready ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {p.ready ? "Ready" : "Not Ready"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <Eyebrow>CSSD Sterile Pack Tracking</Eyebrow>
              <button
                onClick={() => { setScanMsg(null); setScannerOpen(true); }}
                className="text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-teal-500 text-white hover:opacity-90 transition-opacity mb-1 shadow-sm"
              >
                <Camera size={12} /> Scan Pack
              </button>
            </div>
            {scanMsg && (
              <div className={`text-[11px] rounded-lg px-3 py-2 mb-2 border ${scanMsg.tone === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                {scanMsg.text}
              </div>
            )}
            <div className="bg-white rounded-2xl divide-y divide-slate-100 shadow-sm border border-slate-200">
              {packs.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=44x44&margin=0&data=${encodeURIComponent(p.id)}`}
                    alt={`QR ${p.id}`}
                    className="w-9 h-9 rounded-md bg-white p-0.5 shrink-0 border border-slate-100"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Package size={13} className="text-slate-400 shrink-0" /> {p.id}
                    </div>
                    <div className="text-[11px] text-slate-400">{p.type} · {p.cycles_left} cycles left</div>
                  </div>
                  <StatusPill tone={p.status === "sterile" ? "ok" : p.status === "expiring" ? "warn" : "bad"}>
                    {p.status === "sterile" && <CheckCircle2 size={12} />}
                    {p.status === "expiring" && <Clock size={12} />}
                    {p.status === "expired" && <X size={12} />}
                    {p.status === "expired" ? "Expired" : `${p.expires_in_hrs}h left`}
                  </StatusPill>
                </div>
              ))}
            </div>
          </section>
          {scannerOpen && <QRScannerModal onScan={handleScan} onClose={() => setScannerOpen(false)} />}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <section>
            <Eyebrow>Live Alerts</Eyebrow>
            <div className="bg-white rounded-2xl mt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto shadow-sm border border-slate-200">
              {alerts.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-400" />
                  No active workflow issues.
                </div>
              )}
              {alerts.map((a) => (
                <div key={a.id} className={`px-4 py-2.5 flex items-center gap-2 text-sm border-l-4 ${a.tone === "bad" ? "border-l-rose-400" : "border-l-amber-400"}`}>
                  <AlertTriangle size={14} className={a.tone === "bad" ? "text-rose-500" : "text-amber-500"} />
                  <span className={a.tone === "bad" ? "text-rose-700" : "text-amber-700"}>{a.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <Eyebrow>Workflow Events — Live (from Activity Log)</Eyebrow>
            <div className="bg-white rounded-2xl mt-2 p-4 h-64 shadow-sm border border-slate-200">
              {eventBreakdown.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No events logged yet — this chart fills in as actions happen.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#1e293b" }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>

        <section>
          <Eyebrow>Activity Log · Audit Trail</Eyebrow>
          <div className="bg-white rounded-2xl mt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto shadow-sm border border-slate-200">
            {log.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                <ScrollText size={20} className="text-slate-300" />
                No activity recorded yet — actions you take will appear here.
              </div>
            )}
            {log.map((entry) => (
              <div key={entry.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="text-[10px] text-slate-400 w-16 shrink-0 font-medium">
                  {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-slate-600">{entry.message}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="text-center text-[11px] text-slate-400 pt-4 pb-8">
          Connected to Supabase · last synced {lastSync ? lastSync.toLocaleTimeString() : "—"}
        </footer>
      </main>
    </div>
  );
}
ENDOFFILE
echo "File rewritten"
