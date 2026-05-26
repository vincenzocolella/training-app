import React, { useState, useEffect, useCallback, useMemo } from "react";

// --- TYPES & INTERFACES ---
interface Run {
  id: string;
  type: "Speed" | "Tempo" | "Long Run" | "Easy" | "Race";
  title: string;
  desc: string;
  targetKm: number;
}

interface Week {
  week: number;
  runs: Run[];
}

interface Phase {
  phase: number;
  phaseTitle: string;
  weeks: Week[];
}

interface LogEntry {
  id: string;
  date: string;
  km: string;
  hh: string;
  mm: string;
  ss: string;
  notes: string;
  runId: string;
}

interface AppState {
  completed: Record<string, boolean>;
  logs: LogEntry[];
}

const RACE_DATE = new Date("2026-10-18T08:00:00");
const PLAN_START = new Date("2026-06-01");

// =========================================================
//  ⚠️ SECURE CLOUD STORAGE CONFIGURATION (OPTIONAL)
// =========================================================
const SUPABASE_URL = ""; 
const SUPABASE_ANON_KEY = "";

const trainingPlan: Phase[] = [
  {
    phase: 1, phaseTitle: "Neuromuscular Speed & Base Tuning", weeks: [
      {
        week: 1, runs: [
          { id: "w1r1", type: "Speed", title: "Track 400s", desc: "6× 400m @ 5:15/km — Rest: 90s walk", targetKm: 4.0 },
          { id: "w1r2", type: "Tempo", title: "Linear Threshold", desc: "20 min continuous @ 5:35/km", targetKm: 3.6 },
          { id: "w1r3", type: "Long Run", title: "Aerobic Base", desc: "10 km steady @ 6:50/km", targetKm: 10 },
        ]
      },
      {
        week: 2, runs: [
          { id: "w2r1", type: "Speed", title: "Ascending Ladder", desc: "200m, 400m, 600m, 800m @ 5:10/km — Equal time rest", targetKm: 3.0 },
          { id: "w2r2", type: "Tempo", title: "Cruise Intervals", desc: "3× 2 km @ 5:35/km — Rest: 2 min jog", targetKm: 6 },
          { id: "w2r3", type: "Long Run", title: "3-Step Progression", desc: "12 km: 4 km @ 7:00 → 4 km @ 6:45 → 4 km @ 6:30", targetKm: 12 },
        ]
      },
      {
        week: 3, runs: [
          { id: "w3r1", type: "Speed", title: "Yasso Prep", desc: "5× 800m @ 5:20/km — Rest: 2 min jog", targetKm: 5.0 },
          { id: "w3r2", type: "Tempo", title: "The Squeeze", desc: "25 min: 5:50 → 5:30/km (–5 sec every 5 min)", targetKm: 4.5 },
          { id: "w3r3", type: "Long Run", title: "Endurance Extension", desc: "13 km steady @ 6:45/km", targetKm: 13 },
        ]
      },
      {
        week: 4, runs: [
          { id: "w4r1", type: "Speed", title: "Mona Fartlek", desc: "20 min: 1 min fast (5:00/km) / 1 min recovery × 10", targetKm: 3.5 },
          { id: "w4r2", type: "Tempo", title: "Light Tempo", desc: "15 min @ 5:40/km — Race Pace simulation", targetKm: 2.7 },
          { id: "w4r3", type: "Long Run", title: "Decompression Run", desc: "8 km very easy @ 7:00/km", targetKm: 8 },
        ]
      },
      {
        week: 5, runs: [
          { id: "w5r1", type: "Speed", title: "Kilometer Repeats", desc: "3× 1 km @ 5:10/km — Rest: 2:30 walk", targetKm: 4.0 },
          { id: "w5r2", type: "Tempo", title: "Wave Tempo", desc: "6 km: 1 km @ 5:30 / 1 km @ 6:00 alternating", targetKm: 6 },
          { id: "w5r3", type: "Long Run", title: "Fast Finish", desc: "14 km: 12 km @ 6:45 → 2 km @ 5:40 (Race Pace)", targetKm: 14 },
        ]
      },
    ]
  },
  {
    phase: 2, phaseTitle: "Lactate Threshold Enhancement", weeks: [
      {
        week: 6, runs: [
          { id: "w6r1", type: "Speed", title: "Turnover Sprints", desc: "8× 300m @ 5:00/km — Rest: 100m walk", targetKm: 3.5 },
          { id: "w6r2", type: "Tempo", title: "Sustained Threshold", desc: "30 min flat @ 5:30/km", targetKm: 5.5 },
          { id: "w6r3", type: "Long Run", title: "Aerobic Compression", desc: "15 km steady @ 6:35/km", targetKm: 15 },
        ]
      },
      {
        week: 7, runs: [
          { id: "w7r1", type: "Speed", title: "Classic Pyramid", desc: "400m, 800m, 1200m, 800m, 400m @ 5:15/km", targetKm: 5.0 },
          { id: "w7r2", type: "Tempo", title: "Broken Threshold", desc: "4× 1.5 km @ 5:25/km — Rest: 90s slow walk", targetKm: 6 },
          { id: "w7r3", type: "Long Run", title: "Mid-Run Race Block", desc: "16 km: 6 km easy → 4 km RP (5:40) → 6 km easy", targetKm: 16 },
        ]
      },
      {
        week: 8, runs: [
          { id: "w8r1", type: "Speed", title: "Light Strides", desc: "5× 400m @ 5:05/km — Rest: 2 min complete rest", targetKm: 3.0 },
          { id: "w8r2", type: "Tempo", title: "Flush Tempo", desc: "20 min @ 5:45/km", targetKm: 3.5 },
          { id: "w8r3", type: "Long Run", title: "System Reset", desc: "10 km easy @ 6:50/km", targetKm: 10 },
        ]
      },
      {
        week: 9, runs: [
          { id: "w9r1", type: "Speed", title: "Sustained Intervals", desc: "5× 800m @ 5:10/km — Rest: 90s walk", targetKm: 5.5 },
          { id: "w9r2", type: "Tempo", title: "The Long Squeeze", desc: "35 min: 5:45 → 5:25/km (–5 sec every 7 min)", targetKm: 6.2 },
          { id: "w9r3", type: "Long Run", title: "Continuous Progression", desc: "16 km: start 6:40, drop 5 sec/km every 4 km", targetKm: 16 },
        ]
      },
      {
        week: 10, runs: [
          { id: "w10r1", type: "Speed", title: "Engine Builder", desc: "4× 1 km @ 5:05/km — Rest: 2:30 walk", targetKm: 5.0 },
          { id: "w10r2", type: "Tempo", title: "Advanced Wave Tempo", desc: "8 km: 2 km @ 5:30 / 2 km @ 5:55 alternating", targetKm: 8 },
          { id: "w10r3", type: "Long Run", title: "The Shift", desc: "17 km steady @ 6:25/km — Fuel at km 6 & 12", targetKm: 17 },
        ]
      },
    ]
  },
  {
    phase: 3, phaseTitle: "Peak Aerobic Volume & Specificity", weeks: [
      {
        week: 11, runs: [
          { id: "w11r1", type: "Speed", title: "Lactate Monster", desc: "3× 1.5 km @ 5:10/km — Rest: 3 min slow jog", targetKm: 6.0 },
          { id: "w11r2", type: "Tempo", title: "Sub-2 Lock", desc: "40 min continuous @ 5:30/km", targetKm: 7.3 },
          { id: "w11r3", type: "Long Run", title: "Double Race Block", desc: "18 km: 6 easy → 3 RP → 3 easy → 3 RP → 3 easy", targetKm: 18 },
        ]
      },
      {
        week: 12, runs: [
          { id: "w12r1", type: "Speed", title: "Hill Strides", desc: "6× 30-sec explosive climbs — Walk down for recovery", targetKm: 3.0 },
          { id: "w12r2", type: "Tempo", title: "Comfort Tempo", desc: "25 min @ 5:40/km", targetKm: 4.4 },
          { id: "w12r3", type: "Long Run", title: "Easy Volume", desc: "12 km @ 6:40/km", targetKm: 12 },
        ]
      },
      {
        week: 13, runs: [
          { id: "w13r1", type: "Speed", title: "Deep Ladder", desc: "400m, 800m, 1600m, 800m @ 5:10/km — Rest: 2 min", targetKm: 5.5 },
          { id: "w13r2", type: "Tempo", title: "The Burn", desc: "45 min: 5:40 → 5:30/km (–5 sec every 15 min)", targetKm: 8.0 },
          { id: "w13r3", type: "Long Run", title: "Fast Aerobic", desc: "18 km steady @ 6:20/km — Fuel at km 5, 10, 15", targetKm: 18 },
        ]
      },
      {
        week: 14, runs: [
          { id: "w14r1", type: "Speed", title: "The Cruel Two's", desc: "2× 2 km @ 5:15/km — Rest: 4 min walk", targetKm: 5.0 },
          { id: "w14r2", type: "Tempo", title: "Interval Cruise", desc: "3× 3 km @ 5:25/km — Rest: 2 min walk", targetKm: 9 },
          { id: "w14r3", type: "Long Run", title: "High-Floor Long Run", desc: "19 km steady @ 6:15/km", targetKm: 19 },
        ]
      },
      {
        week: 15, runs: [
          { id: "w15r1", type: "Speed", title: "Sharpeners", desc: "4× 400m @ 4:55/km — Rest: 90s walk. Pure speed!", targetKm: 2.5 },
          // 🏛️ Locate Phase 3 -> Week 15 -> Second Run entry and change it to:
{ 
  id: "w15r2", 
  type: "Tempo", 
  title: "Light Wave", 
  desc: "30 min: 5 min @ 5:35 / 5 min @ 6:00 alternating", 
  targetKm: 5.4 
},
          { id: "w15r3", type: "Long Run", title: "Chilled Distance", desc: "12 km @ 6:40/km", targetKm: 12 },
        ]
      },
      {
        week: 16, runs: [
          { id: "w16r1", type: "Speed", title: "The Centurion", desc: "10× 400m @ 5:00/km — Strictly 60s walk rest", targetKm: 5.5 },
          { id: "w16r2", type: "Tempo", title: "Executive Tempo", desc: "50 min: 30 min @ 5:40 → 20 min @ 5:25", targetKm: 9.0 },
          { id: "w16r3", type: "Long Run", title: "20 km Simulator", desc: "20 km: 15 km @ 6:15 → 5 km @ 5:40 Race Pace", targetKm: 20 },
        ]
      },
      {
        week: 17, runs: [
          { id: "w17r1", type: "Speed", title: "Post-Peak Metric", desc: "5× 1 km @ 5:10/km — Rest: 2 min walk", targetKm: 6.5 },
          { id: "w17r2", type: "Tempo", title: "Lactate Hold", desc: "35 min flat @ 5:25/km", targetKm: 6.4 },
          { id: "w17r3", type: "Long Run", title: "Cruising 16", desc: "16 km effortless @ 6:10/km", targetKm: 16 },
        ]
      },
    ]
  },
  {
    phase: 4, phaseTitle: "Strategic Taper & Launch", weeks: [
      {
        week: 18, runs: [
          { id: "w18r1", type: "Speed", title: "Sharp 600s", desc: "6× 600m @ 5:10/km — Rest: 90s walk", targetKm: 4.8 },
          { id: "w18r2", type: "Tempo", title: "Smooth Thirty", desc: "30 min sharp @ 5:35/km", targetKm: 5.4 },
          { id: "w18r3", type: "Long Run", title: "Step Down", desc: "12 km smooth @ 6:15/km", targetKm: 12 },
        ]
      },
      {
        week: 19, runs: [
          { id: "w19r1", type: "Speed", title: "Stored Energy 400s", desc: "4× 400m @ 5:10/km — Do not exceed target pace", targetKm: 2.5 },
          { id: "w19r2", type: "Tempo", title: "Confidence Jog", desc: "20 min easy @ 5:40/km", targetKm: 3.5 },
          { id: "w19r3", type: "Long Run", title: "Final Long Spin", desc: "8 km relaxed @ 6:30/km", targetKm: 8 },
        ]
      },
      {
        week: 20, runs: [
          { id: "w20r1", type: "Speed", title: "Shakeout", desc: "3 km easy @ 7:15/km + 3× 100m quick strides", targetKm: 3.3 },
          { id: "w20r2", type: "Easy", title: "The Awakening", desc: "15 min ultra-light jog @ 7:15/km", targetKm: 2.1 },
          { id: "w20r3", type: "Race", title: "🏁 RACE DAY — Rome Half Marathon", desc: "Km 1–3: 5:45/km → Km 4–18: 5:40/km → Km 19–21.1: Empty the tank!", targetKm: 21.1 },
        ]
      },
    ]
  }
];

const TYPE_COLORS: Record<string, { bg: string; light: string; text: string }> = {
  "Speed": { bg: "#FF4B00", light: "rgba(255,75,0,0.12)", text: "#FF4B00" },
  "Tempo": { bg: "#D4A017", light: "rgba(212,160,23,0.12)", text: "#D4A017" },
  "Long Run": { bg: "#00C4A7", light: "rgba(0,196,167,0.12)", text: "#00C4A7" },
  "Easy": { bg: "#6B8EFF", light: "rgba(107,142,255,0.12)", text: "#6B8EFF" },
  "Race": { bg: "#CC2A2A", light: "rgba(204,42,42,0.15)", text: "#FF4444" },
};

function getCountdown() {
  const now = new Date();
  const diff = RACE_DATE.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, done: false };
}

function formatPace(totalMinutes: number, km: number): string {
  if (!km || km <= 0 || !totalMinutes || totalMinutes <= 0) return "—";
  const paceMin = totalMinutes / km;
  const mins = Math.floor(paceMin);
  const secs = Math.round((paceMin - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function parseDuration(h: string, m: string, s: string): number {
  return parseInt(h || "0") * 60 + parseInt(m || "0") + parseInt(s || "0") / 60;
}

const LS_KEY = "rome_marathon_v3";

const baselineRun: LogEntry = {
  id: "pre_populated_baseline",
  date: "2026-05-20", 
  km: "12",
  hh: "1",
  mm: "26",
  ss: "48", 
  notes: "First baseline activity logged last week. Feeling strong and ready for the plan to officially begin on June 1st!",
  runId: ""
};

function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.logs && !parsed.logs.some(l => l.id === "pre_populated_baseline")) {
        parsed.logs.unshift(baselineRun);
      }
      return parsed;
    }
  } catch {}
  return { completed: {}, logs: [baselineRun] };
}

export default function App() {
  const [countdown, setCountdown] = useState(getCountdown());
  const [state, setState] = useState<AppState>({ completed: {}, logs: [baselineRun] });
  const [syncId, setSyncId] = useState<string>(() => localStorage.getItem("rome_sync_id") || "rome_runner_777");
  const [cloudStatus, setCloudStatus] = useState<"local" | "synced" | "saving" | "error" | "checking">("checking");
  
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({ 1: true });
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({ 1: true, 2: false, 3: false, 4: false });
  const [activeTab, setActiveTab] = useState<string>("plan");
  const [modal, setModal] = useState<"log" | null>(null);
  const [form, setForm] = useState({ date: "", km: "", hh: "", mm: "", ss: "", notes: "", runId: "" });
  const [editingLog, setEditingLog] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isCloudEnabled = useMemo(() => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY), []);

  const pushToCloud = async (targetId: string, stateToSend: AppState) => {
    if (!isCloudEnabled) return;
    setCloudStatus("saving");
    try {
      const url = `${SUPABASE_URL}/rest/v1/rome_marathon_sync`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          id: targetId,
          state_json: stateToSend,
          updated_at: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error("Could not save remote table data");
      setCloudStatus("synced");
    } catch (e) {
      console.error(e);
      setCloudStatus("error");
    }
  };

  const pullFromCloud = useCallback(async (targetId: string) => {
    if (!isCloudEnabled) {
      setState(loadLocalState());
      setCloudStatus("local");
      return;
    }
    setCloudStatus("checking");
    try {
      const url = `${SUPABASE_URL}/rest/v1/rome_marathon_sync?id=eq.${targetId}`;
      const response = await fetch(url, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (!response.ok) throw new Error("Could not fetch remote table");
      const data = await response.json();
      
      if (data && data.length > 0 && data[0].state_json) {
        setState(data[0].state_json);
        setCloudStatus("synced");
      } else {
        const local = loadLocalState();
        setState(local);
        await pushToCloud(targetId, local);
      }
    } catch (e) {
      console.warn("Using local backup: ", e);
      setCloudStatus("error");
      setState(loadLocalState());
    }
  }, [isCloudEnabled]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(getCountdown()), 1000);
    pullFromCloud(syncId);
    return () => clearInterval(t);
  }, [syncId, pullFromCloud]);

  const updateAndSyncState = (updaterFn: AppState | ((prev: AppState) => AppState)) => {
    setState(prev => {
      const next = typeof updaterFn === "function" ? updaterFn(prev) : updaterFn;
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      if (isCloudEnabled) {
        pushToCloud(syncId, next);
      }
      return next;
    });
  };

  const handleSyncIdChange = (newVal: string) => {
    const cleanVal = newVal.trim();
    if (!cleanVal) return;
    localStorage.setItem("rome_sync_id", cleanVal);
    setSyncId(cleanVal);
  };

  const totalPlanKm = useMemo(() =>
    trainingPlan.flatMap(p => p.weeks).flatMap(w => w.runs).reduce((a, r) => a + r.targetKm, 0), []);

  const loggedKm = useMemo(() =>
    state.logs.reduce((a, l) => a + parseFloat(l.km || "0"), 0), [state.logs]);

  const completedCount = useMemo(() => Object.values(state.completed).filter(Boolean).length, [state.completed]);
  const totalRuns = trainingPlan.flatMap(p => p.weeks).flatMap(w => w.runs).length;

  const avgPace = useMemo(() => {
    const totalMins = state.logs.reduce((a, l) => a + parseDuration(l.hh, l.mm, l.ss), 0);
    return formatPace(totalMins, loggedKm);
  }, [state.logs, loggedKm]);

  const toggleComplete = (runId: string) => {
    updateAndSyncState(s => ({
      ...s,
      completed: { ...s.completed, [runId]: !s.completed[runId] }
    }));
  };

  const openLog = (runId: string) => {
    const targetRun = trainingPlan.flatMap(p => p.weeks).flatMap(w => w.runs).find(r => r.id === runId);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      km: targetRun ? String(targetRun.targetKm) : "",
      hh: "0",
      mm: "",
      ss: "0",
      notes: "",
      runId
    });
    setEditingLog(null);
    setModal("log");
  };

  const openEdit = (log: LogEntry) => {
    setForm({
      date: log.date,
      km: log.km,
      hh: log.hh || "0",
      mm: log.mm || "",
      ss: log.ss || "0",
      notes: log.notes || "",
      runId: log.runId || ""
    });
    setEditingLog(log.id);
    setModal("log");
  };

  const submitLog = () => {
    const km = parseFloat(form.km);
    if (!form.date || !km || !form.mm) return;
    const entry: LogEntry = {
      id: editingLog || `log_${Date.now()}`,
      date: form.date,
      km: String(km),
      hh: form.hh || "0",
      mm: form.mm,
      ss: form.ss || "0",
      notes: form.notes,
      runId: form.runId
    };

    updateAndSyncState(s => {
      const logs = editingLog
        ? s.logs.map(l => l.id === editingLog ? entry : l)
        : [entry, ...s.logs];
      const completed = form.runId ? { ...s.completed, [form.runId]: true } : s.completed;
      return { ...s, logs, completed };
    });
    setModal(null);
  };

  const deleteLog = (id: string) => {
    updateAndSyncState(s => ({
      ...s,
      logs: s.logs.filter(l => l.id !== id)
    }));
    setDeleteConfirm(null);
  };

  const pacePreview = useMemo(() => {
    const km = parseFloat(form.km);
    const mins = parseDuration(form.hh, form.mm, form.ss);
    return formatPace(mins, km);
  }, [form.km, form.hh, form.mm, form.ss]);

  const progressPct = Math.min(100, Math.round((completedCount / totalRuns) * 100));

  const chartsData = useMemo(() => {
    const planWeeksKm = Array(21).fill(0);
    const planWeeksDuration = Array(21).fill(0);

    state.logs.forEach(log => {
      const logDate = new Date(log.date);
      const km = parseFloat(log.km || "0");
      const duration = parseDuration(log.hh, log.mm, log.ss);
      
      let weekIndex = 0; 
      if (logDate >= PLAN_START) {
        const diffDays = Math.floor((logDate.getTime() - PLAN_START.getTime()) / (1000 * 60 * 60 * 24));
        weekIndex = Math.min(20, Math.floor(diffDays / 7) + 1);
      }
      if (weekIndex >= 0 && weekIndex <= 20) {
        planWeeksKm[weekIndex] += km;
        planWeeksDuration[weekIndex] += duration;
      }
    });

    const planWeeksAvgPaceDecimal = planWeeksKm.map((km, i) => km === 0 ? 0 : planWeeksDuration[i] / km);
    const planTargets = Array(21).fill(0);
    trainingPlan.forEach(phase => {
      phase.weeks.forEach(w => { planTargets[w.week] = w.runs.reduce((sum, r) => sum + r.targetKm, 0); });
    });

    const typesKm: Record<string, number> = { Speed: 0, Tempo: 0, "Long Run": 0, Easy: 0, Race: 0, "Other": 0 };
    let maxDistance = 0;
    let minPaceDecimal = Infinity;

    state.logs.forEach(log => {
      const km = parseFloat(log.km || "0");
      if (km > maxDistance) maxDistance = km;
      const duration = parseDuration(log.hh, log.mm, log.ss);
      const paceDecimal = km > 0 ? duration / km : 0;
      if (paceDecimal > 0 && paceDecimal < minPaceDecimal) minPaceDecimal = paceDecimal;

      const linkedRun = trainingPlan.flatMap(p => p.weeks).flatMap(w => w.runs).find(r => r.id === log.runId);
      const type = linkedRun ? linkedRun.type : (log.id === "pre_populated_baseline" ? "Long Run" : "Other");
      typesKm[type] = (typesKm[type] || 0) + km;
    });

    return {
      planWeeksKm,
      planWeeksAvgPaceDecimal,
      planTargets,
      typesKm,
      maxDistance,
      fastestPace: minPaceDecimal === Infinity ? "—" : `${Math.floor(minPaceDecimal)}:${String(Math.round((minPaceDecimal - Math.floor(minPaceDecimal)) * 60)).padStart(2, "0")}`
    };
  }, [state.logs]);

  return (
    <div className="bg-[#0A0A0F] min-h-screen text-[#E8E6E1] antialiased" style={{ fontFamily: "'Barlow', sans-serif" }}>
      
      {/* CLOUD CONNECTION STATUS HEADER */}
      <div className="bg-[#08080D] border-b border-[#151522] py-2 px-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full animate-pulse bg-emerald-400"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {isCloudEnabled ? `Cloud Database Connected (${syncId})` : "Local Browser Storage Active"}
            </span>
          </div>
          {isCloudEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#555] font-bold">DEVICE SYNC ID:</span>
              <input 
                type="text" 
                value={syncId}
                onChange={(e) => handleSyncIdChange(e.target.value)}
                className="bg-[#11111A] text-xs font-semibold border border-[#222] rounded px-2 py-0.5 text-orange-500 focus:outline-none focus:border-orange-500 w-28 text-center"
              />
            </div>
          )}
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="bg-gradient-to-b from-orange-500/10 to-transparent border-b border-[#151522] py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full text-xs font-extrabold uppercase tracking-widest text-orange-500 mb-3">
              🏛️ Rome Half Marathon Plan
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              THE SUB-2:00 PLAN
            </h1>
            <p className="text-sm text-gray-500 font-medium">October 18, 2026 · Target Average Pace: 5:40 min/km</p>
          </div>

          <div className="bg-[#11111A] border border-[#1E1E2D] p-4 rounded-2xl flex gap-4 text-center w-full md:w-auto md:min-w-[280px]">
            {[
              { val: countdown.days, label: "Days" },
              { val: countdown.hours, label: "Hrs" },
              { val: countdown.minutes, label: "Min" },
              { val: countdown.seconds, label: "Sec" }
            ].map((col, idx) => (
              <div key={idx} className="flex-1">
                <div className="text-3xl md:text-4xl font-extrabold text-orange-500 leading-none tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {String(col.val).padStart(2, "0")}
                </div>
                <div className="text-[10px] text-gray-600 uppercase font-bold tracking-wider mt-1">{col.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          {[
            { label: "Plan Completion", val: `${progressPct}%`, sub: `${completedCount}/${totalRuns} runs`, color: "border-orange-500/20" },
            { label: "Total Volume", val: `${loggedKm.toFixed(1)} km`, sub: `Target volume: ~${totalPlanKm.toFixed(0)} km`, color: "border-teal-500/20" },
            { label: "Overall Pace", val: avgPace, sub: "min/km avg logged", color: "border-yellow-500/20" },
            { label: "Logged Activities", val: state.logs.length, sub: "Total completed files", color: "border-blue-500/20" }
          ].map((stat, idx) => (
            <div key={idx} className={`bg-[#111118]/80 border ${stat.color} p-4 rounded-xl flex flex-col justify-between`}>
              <div className="text-[10px] text-gray-500 uppercase font-extrabold tracking-widest mb-1">{stat.label}</div>
              <div className="text-2xl md:text-3xl font-extrabold text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{stat.val}</div>
              <div className="text-xs text-gray-600 mt-1">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto w-full h-1.5 bg-[#171725] rounded-full overflow-hidden mt-4">
          <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
        </div>
      </div>

      {/* TAB NAVIGATION BAR */}
      <div className="bg-[#0A0A0F] border-b border-[#14141F] sticky top-0 z-10 px-4 py-2">
        <div className="max-w-4xl mx-auto flex gap-1 overflow-x-auto whitespace-nowrap py-1 scrollbar-none">
          {[
            { id: "plan", label: "Training Plan" },
            { id: "history", label: "Run History & Logs" },
            { id: "charts", label: "Analytics & Charts" },
            { id: "race", label: "Race Day Strategy" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider border-none cursor-pointer ${
                activeTab === tab.id 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/15" 
                  : "text-gray-500 hover:text-white bg-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CORE WRAPPER */}
      <div className="max-w-4xl mx-auto p-4 md:py-8 pb-32">

        {/* PLANS TAB */}
        {activeTab === "plan" && (
          <div className="space-y-4">
            {trainingPlan.map(phase => {
              const isOpen = expandedPhases[phase.phase];
              const phaseCompleted = phase.weeks.flatMap(w => w.runs).filter(r => state.completed[r.id]).length;
              const phaseTotal = phase.weeks.flatMap(w => w.runs).length;
              const pc = ["#FF4B00", "#D4A017", "#00C4A7", "#6B8EFF"][phase.phase - 1];

              return (
                <div key={phase.phase} className="bg-[#111118]/60 border border-[#1A1A2A] rounded-2xl overflow-hidden transition-all duration-300">
                  <div 
                    onClick={() => setExpandedPhases(prev => ({ ...prev, [phase.phase]: !isOpen }))}
                    className="p-4 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#151522] transition-colors select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" 
                        style={{ backgroundColor: `${pc}15`, border: `1px solid ${pc}30`, color: pc, fontFamily: "'Barlow Condensed', sans-serif" }}
                      >
                        {phase.phase}
                      </div>
                      <div>
                        <h2 className="text-base md:text-lg font-extrabold text-white">Phase {phase.phase}: {phase.phaseTitle}</h2>
                        <p className="text-xs text-gray-500 mt-1">Weeks {phase.weeks[0].week}–{phase.weeks[phase.weeks.length - 1].week} · {phaseCompleted}/{phaseTotal} runs completed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xl transition-transform duration-300 text-gray-600 ${isOpen ? "rotate-180" : "rotate-0"}`}>▾</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-[#181829] p-4 bg-[#0D0D14]/50 space-y-4">
                      {phase.weeks.map(week => {
                        const isWeekOpen = expandedWeeks[week.week];
                        const weekCompleted = week.runs.filter(r => state.completed[r.id]).length;

                        return (
                          <div key={week.week} className="border border-[#181829]/65 rounded-xl bg-[#09090E]/80">
                            <div 
                              onClick={() => setExpandedWeeks(prev => ({ ...prev, [week.week]: !isWeekOpen }))}
                              className="p-3 px-4 flex justify-between items-center cursor-pointer hover:bg-[#11111C]/40"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-black text-sm text-gray-500" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>WEEK {week.week}</span>
                                {weekCompleted === 3 ? (
                                  <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">✓ ALL COMPLETED</span>
                                ) : weekCompleted > 0 ? (
                                  <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">{weekCompleted}/3 COMPLETED</span>
                                ) : null}
                              </div>
                              <span className={`text-sm text-gray-600 transition-transform ${isWeekOpen ? "rotate-180" : ""}`}>▾</span>
                            </div>

                            {isWeekOpen && (
                              <div className="p-3 border-t border-[#151522] space-y-3">
                                {week.runs.map(run => {
                                  const completed = state.completed[run.id];
                                  const linkedLog = state.logs.find(l => l.runId === run.id);
                                  const theme = TYPE_COLORS[run.type] || TYPE_COLORS["Easy"];

                                  return (
                                    <div key={run.id} className={`p-4 rounded-xl border transition-all ${completed ? "bg-[#0E1F1A]/50 border-teal-500/20" : "bg-[#11111A] border-[#1E1E2F] hover:border-[#2C2C3D]"}`}>
                                      <div className="flex items-start gap-4">
                                        <div 
                                          onClick={() => toggleComplete(run.id)}
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors mt-0.5 flex-shrink-0 ${
                                            completed ? "bg-teal-500 border-teal-500 text-black font-extrabold" : "border-gray-700 hover:border-gray-500"
                                          }`}
                                        >
                                          {completed && <span className="text-xs">✓</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase" style={{ backgroundColor: theme.light, color: theme.text }}>
                                              {run.type}
                                            </span>
                                            <h3 className="font-extrabold text-white text-sm md:text-base leading-tight">{run.title}</h3>
                                            <span className="ml-auto text-sm font-black text-gray-500" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                              {run.targetKm} km
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-400 leading-relaxed mb-3">{run.desc}</p>

                                          {linkedLog && (
                                            <div className="p-3 rounded-lg bg-[#080D0B] border border-teal-500/10 flex flex-wrap gap-4 text-xs text-teal-400 font-semibold">
                                              <span>📍 Completed: {linkedLog.km} km</span>
                                              <span>⏱ Time: {linkedLog.hh}:{String(linkedLog.mm).padStart(2, "0")}:{String(linkedLog.ss || 0).padStart(2, "0")}</span>
                                              <span>📈 Pace: {formatPace(parseDuration(linkedLog.hh, linkedLog.mm, linkedLog.ss), parseFloat(linkedLog.km))}/km</span>
                                            </div>
                                          )}

                                          <div className="flex justify-end gap-2 mt-2">
                                            <button 
                                              onClick={() => openLog(run.id)}
                                              className="px-3 py-1 bg-[#1A1A2E] text-gray-300 border border-[#2A2A3E] text-[11px] font-bold rounded-lg cursor-pointer hover:text-white"
                                            >
                                              {linkedLog ? "✎ Edit Run Log" : "📥 Save Run Stats"}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* RUN HISTORY TAB */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>RUNNING JOURNAL</h2>
              </div>
              <button 
                onClick={() => {
                  setForm({ date: new Date().toISOString().slice(0, 10), km: "", hh: "0", mm: "", ss: "0", notes: "", runId: "" });
                  setEditingLog(null);
                  setModal("log");
                }}
                className="bg-orange-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border-none cursor-pointer shadow-lg"
              >
                + Log Custom Run
              </button>
            </div>

            <div className="space-y-3">
              {state.logs.map(log => {
                const calculatedPace = formatPace(parseDuration(log.hh, log.mm, log.ss), parseFloat(log.km));
                const originalPlanItem = trainingPlan.flatMap(p => p.weeks).flatMap(w => w.runs).find(r => r.id === log.runId);

                return (
                  <div key={log.id} className="bg-[#111118] border border-[#1E1E2F] p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <div className="text-xs font-bold text-gray-600 uppercase tracking-widest">{log.date}</div>
                        <div className="text-3xl font-black text-white leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {log.km} <span className="text-sm font-normal text-gray-500">km</span>
                        </div>
                      </div>
                      <div className="h-10 w-px bg-[#1F1F2F]"></div>
                      <div>
                        <div className="text-xs font-bold text-gray-600 uppercase tracking-widest">AVG PACE</div>
                        <div className="text-xl font-bold text-orange-500 leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {calculatedPace} <span className="text-xs font-normal text-gray-600">min/km</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(log)} className="px-3 py-1.5 bg-[#1C1C2D] border border-[#2E2E3E] text-xs font-semibold rounded-lg text-gray-300">Edit</button>
                      <button onClick={() => setDeleteConfirm(log.id)} className="px-3 py-1.5 bg-[#2A1414] border border-[#441C1C] text-xs font-semibold rounded-lg text-red-400">Delete</button>
                    </div>

                    {log.notes && (
                      <div className="w-full text-xs text-gray-500 italic bg-[#0A0A0F] p-3 rounded-lg border-l-2 border-orange-500/50">
                        "{log.notes}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHARTS TAB */}
        {activeTab === "charts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#111118] border border-[#1E1E2F] p-5 rounded-xl">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Fastest Paced Workout</span>
                <div className="text-3xl font-black text-teal-400 mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{chartsData.fastestPace}</div>
              </div>
              <div className="bg-[#111118] border border-[#1E1E2F] p-5 rounded-xl">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Peak Long Distance Run</span>
                <div className="text-3xl font-black text-orange-500 mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{chartsData.maxDistance} <span className="text-sm font-normal">km</span></div>
              </div>
            </div>

            {/* CHART 1 */}
            <div className="bg-[#111118] border border-[#1E1E2F] p-5 rounded-2xl">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4">WEEKLY COMPLETED MILEAGE</h3>
              <div className="w-full overflow-x-auto scrollbar-none">
                <div className="min-w-[500px] h-[150px]">
                  <svg viewBox="0 0 540 150" className="w-full h-full">
                    {chartsData.planWeeksKm.map((kmVal, wIdx) => {
                      const colX = 30 + wIdx * 23.5;
                      const colH = kmVal * 1.5;
                      return (
                        <g key={wIdx}>
                          {kmVal > 0 && <rect x={colX - 4} y={120 - colH} width="8" height={colH} className="fill-teal-400" rx="2" />}
                          <text x={colX} y="135" fill="#555" fontSize="8" textAnchor="middle">{wIdx === 0 ? "Pre" : `W${wIdx}`}</text>
                        </g>
                      );
                    })}
                    <line x1="20" y1="120" x2="530" y2="120" stroke="#1A1A28" />
                  </svg>
                </div>
              </div>
            </div>

            {/* CHART 2 */}
            <div className="bg-[#111118] border border-[#1E1E2F] p-5 rounded-2xl">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4">INVERTED TEMPO PROGRESSION (SPEED GRAPH)</h3>
              <div className="w-full overflow-x-auto scrollbar-none">
                <div className="min-w-[500px] h-[150px]">
                  <svg viewBox="0 0 540 150" className="w-full h-full">
                    <line x1="30" y1="70" x2="520" y2="70" stroke="#D4A017" strokeDasharray="5 3" />
                    <text x="440" y="65" fill="#D4A017" fontSize="8">Target line (5:40)</text>
                    {(() => {
                      const trendPoints: {x: number, y: number}[] = [];
                      chartsData.planWeeksAvgPaceDecimal.forEach((pace, i) => {
                        if (pace > 0) {
                          trendPoints.push({ x: 30 + i * 23.5, y: 130 - (8.0 - pace) * 30 });
                        }
                      });
                      return (
                        <g>
                          {trendPoints.length > 1 && <path d={trendPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")} fill="none" stroke="#00C4A7" strokeWidth="2" />}
                          {trendPoints.map((pt, idx) => <circle key={idx} cx={pt.x} cy={pt.y} r="4" className="fill-[#0A0A0F] stroke-teal-400" strokeWidth="2" />)}
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STRATEGY TAB */}
        {activeTab === "race" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 p-6 rounded-2xl text-center">
              <h3 className="text-xl font-extrabold text-orange-500" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>TARGET STRATEGY TIME: 1:59:XX</h3>
              <p className="text-xs text-gray-500 mt-1">21.1 km at an overall average race pace of 5:40 min/km or lower.</p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL WINDOWS */}
      {modal === "log" && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3 className="text-lg font-black text-white uppercase mb-5">Log Activity Metrics</h3>
            <div className="space-y-4">
              <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Distance (km)" value={form.km} onChange={e => setForm(prev => ({ ...prev, km: e.target.value }))} />
              <div className="grid grid-cols-3 gap-2">
                <input type="number" placeholder="HH" value={form.hh} onChange={e => setForm(prev => ({ ...prev, hh: e.target.value }))} className="text-center" />
                <input type="number" placeholder="MM" value={form.mm} onChange={e => setForm(prev => ({ ...prev, mm: e.target.value }))} className="text-center" />
                <input type="number" placeholder="SS" value={form.ss} onChange={e => setForm(prev => ({ ...prev, ss: e.target.value }))} className="text-center" />
              </div>
              <textarea placeholder="Workout notes..." value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-6">
              <button onClick={() => setModal(null)} className="bg-[#1A1A2A] text-gray-400 py-3 rounded-xl border border-[#2E2E3E]">Cancel</button>
              <button onClick={submitLog} className="col-span-2 bg-orange-500 text-white font-bold py-3 rounded-xl border-none">Save Workout</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-bg">
          <div className="modal max-w-sm text-center">
            <h4 className="text-base font-bold text-white mb-6">Delete completed log?</h4>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="bg-[#1A1A2A] text-xs font-bold py-2.5 rounded-xl text-gray-400 border border-[#2E2E3E]">Keep Log</button>
              <button onClick={() => deleteLog(deleteConfirm)} className="bg-red-500 text-white font-bold py-2.5 rounded-xl border-none">Delete Log</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
