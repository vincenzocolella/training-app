import React, { useState, useEffect, useCallback, useMemo } from "react";

// --- TYPES & INTERFACES ---
interface ZoneSeg {
  z: string; // es. "Z2", "Z3–Z4"
  what: string; // a cosa si riferisce (km, blocco...)
}

interface Run {
  id: string;
  type: "Speed" | "Tempo" | "Long Run" | "Easy" | "Race";
  title: string;
  desc: string;
  targetKm: number;
  pace?: string; // ritmo da mantenere (sul Garmin)
  hr?: string; // frequenza cardiaca di controllo
  optional?: boolean; // uscita facoltativa (seconda uscita della settimana)
  zones?: ZoneSeg[]; // zone a cui correre
  why?: string; // scopo dell'uscita in una frase
}

interface Week {
  week: number;
  tag?: string; // etichetta (scarico, test, gara...)
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
  hr?: string; // FC media (bpm)
  rpe?: string; // sforzo percepito 1-10
  notes: string;
  runId: string;
}

interface AppState {
  completed: Record<string, boolean>;
  logs: LogEntry[];
}

// =========================================================
//  ⚠️ CAMBIA QUESTE DUE DATE SE LA TUA GARA È UN'ALTRA
//  (PLAN_START = lunedì della settimana 1, RACE_DATE = giorno e ora di gara)
//  Mesi in JavaScript: 0 = gennaio ... 10 = novembre
// =========================================================
const PLAN_START = new Date(2026, 10, 2); // lunedì 2 novembre 2026
const RACE_DATE = new Date(2027, 3, 4, 9, 0, 0); // domenica 4 aprile 2027, 09:00 (mesi: 3 = aprile)
const TARGET_PACE_MIN = 5 + 36 / 60; // ritmo obiettivo A sul Garmin: 5:36/km

// =========================================================
//  ⚠️ SECURE CLOUD STORAGE CONFIGURATION (OPTIONAL)
// =========================================================
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

// =========================================================
//  PIANO SUB-2:00 · 22 SETTIMANE · 1 USCITA CHIAVE A SETTIMANA
//  + 1 seconda uscita FACOLTATIVA a settimane alterne (circa 6 uscite al mese)
//  Ritmi in min/km SUL GARMIN (legge circa lo 0,6% di distanza in più del percorso).
//  FC calcolate su FCmax 195, FC a riposo 57, soglia ~180 (zone % FCR).
//  targetKm = distanza totale dell'uscita (riscaldamento e defaticamento inclusi).
// =========================================================
const run = (
  id: string, type: Run["type"], title: string, desc: string, targetKm: number,
  pace?: string, hr?: string, optional?: boolean
): Run => ({ id, type, title, desc, targetKm, pace, hr, optional });

const trainingPlan: Phase[] = [
  {
    phase: 1, phaseTitle: "Recupero e base di tenuta", weeks: [
      { week: 1, tag: "RECUPERO", runs: [
        run("w1r1", "Easy", "Ripartenza dopo il 10 km", "6 km facili e costanti, gambe libere. Dopo la mezza del 25 ottobre e il 10 km a tutta del 1° novembre è l'unica uscita: se le gambe sono pesanti o la FC a riposo è oltre 62, cammina e rimanda.", 6, "6:45–7:30/km", "≤ 150"),
      ] },
      { week: 2, runs: [
        run("w2r1", "Long Run", "Lungo di base", "12 km costanti a ritmo da chiacchierata (frasi complete). Obiettivo: rimettere chilometri nelle gambe senza stress.", 12, "6:30–7:10/km", "136–153"),
      ] },
      { week: 3, runs: [
        run("w3r1", "Tempo", "Tempo breve", "8 km: 2 km facili → 2 × 8 min a 5:28/km (“comodamente duro”, recupero 3 min di trotto) → facile fino a 8 km.", 8, "5:25–5:30/km nei blocchi", "172–180 nei blocchi", true),
        run("w3r2", "Long Run", "Lungo", "13 km facili e costanti.", 13, "6:30–7:10/km", "136–153"),
      ] },
      { week: 4, runs: [
        run("w4r1", "Tempo", "Tempo continuo", "9 km: 2 km facili → 20 min a 5:28/km → facile fino a 9 km.", 9, "5:25–5:30/km nel blocco", "172–180 nel blocco", true),
        run("w4r2", "Long Run", "Lungo con finale", "14 km: 11 km facili → 3 km a 6:00/km (Z3, ancora in controllo).", 14, "6:30–7:10/km → 6:00/km", "≤ 153 → ≤ 165"),
      ] },
      { week: 5, tag: "SCARICO", runs: [
        run("w5r1", "Easy", "Scarico con allunghi", "10 km facili. Alla fine 4 allunghi da 20 s (≈4:50/km, veloci ma rilassati) camminando 40 s tra uno e l'altro.", 10, "6:30–7:15/km", "≤ 153"),
      ] },
      { week: 6, runs: [
        run("w6r1", "Long Run", "Lungo progressivo e gel", "15 km: 11 km facili → 4 km a 5:50/km. Prova il fueling: gel ai minuti 30, 60 e 90, ognuno con acqua.", 15, "6:30–7:10/km → 5:50/km", "≤ 153 → ≤ 168"),
      ] },
      { week: 7, runs: [
        run("w7r1", "Tempo", "Tempo spezzato", "9 km: 2 km facili → 3 × 8 min a 5:28/km (recupero 2 min di trotto) → facile.", 9, "5:25–5:30/km nei blocchi", "172–180 nei blocchi", true),
        run("w7r2", "Long Run", "Lungo con ritmo", "16 km: 12 km facili → 4 km a 5:45/km. Gel ai minuti 30, 60 e 90.", 16, "6:30–7:10/km → 5:45/km", "≤ 153 → ≤ 170"),
      ] },
      { week: 8, tag: "FESTE: FLESSIBILE", runs: [
        run("w8r1", "Speed", "Fartlek 1 min/1 min", "8 km: 3 km facili → 8 × 1 min a 5:00/km con 1 min facile in mezzo → facile fino a 8 km.", 8, "≈ 5:00/km nelle ripetute", "leggila a fine ripetuta", true),
        run("w8r2", "Long Run", "Lungo con ritmo", "17 km: 12 km facili → 5 km a 5:40/km. Gel ai minuti 30, 60 e 90.", 17, "6:30–7:10/km → 5:40/km", "≤ 153 → ≤ 172"),
      ] },
      { week: 9, tag: "SCARICO + CONTROLLO", runs: [
        run("w9r1", "Tempo", "Controllo ritmo gara", "12 km: 3 km facili → 6 km a 5:36/km (ritmo gara sub-2) → 3 km facili. Gel al minuto 30. Esito (FC e sforzo negli ultimi 2 km del blocco): FC ≤ 175 e ≤ 7/10 → A in rotta · FC 176–178 o 8/10 → punta al B (2:03) · FC > 178 o ≥ 9/10 → punta al C (2:10).", 12, "5:36/km nel blocco", "controllo ≤ 175"),
      ] },
    ]
  },
  {
    phase: 2, phaseTitle: "Costruzione della resistenza", weeks: [
      { week: 10, runs: [
        run("w10r1", "Long Run", "Lungo con ritmo gara", "18 km: 12 km facili → 6 km a 5:38/km. Gel ai minuti 30, 60 e 90.", 18, "6:30–7:10/km → 5:38/km", "≤ 153 → ≤ 175"),
      ] },
      { week: 11, runs: [
        run("w11r1", "Tempo", "Doppio tempo", "10 km: 2 km facili → 2 × 15 min a 5:28/km (recupero 3 min di trotto) → facile.", 10, "5:25–5:30/km nei blocchi", "172–180 nei blocchi", true),
        run("w11r2", "Long Run", "Lungo facile", "16 km facili con gel ai minuti 30, 60 e 90. Settimana di accumulo: nessun ritmo da inseguire.", 16, "6:30–7:10/km", "136–153"),
      ] },
      { week: 12, runs: [
        run("w12r1", "Speed", "Ripetute da 1000", "10 km: 2 km facili → 5 × 1000 m a 4:58/km (recupero 2 min di trotto) → facile.", 10, "4:58–5:03/km nelle ripetute", "leggila a fine ripetuta", true),
        run("w12r2", "Long Run", "Lungo con 8 km a ritmo gara", "18 km: 10 km facili → 8 km a 5:36/km. Gel ai minuti 30, 60 e 90.", 18, "6:30–7:10/km → 5:36/km", "≤ 153 → ≤ 175"),
      ] },
      { week: 13, tag: "SCARICO + TEST 10 KM", runs: [
        run("w13r1", "Speed", "TEST 10 KM", "13 km totali: 2 km di riscaldamento + 4 allunghi → 10 km al massimo regolare (primi 2 km a 5:25, poi libero) → 1 km di defaticamento. Mattina, colazione e scarpe di gara. Riferimento: 53:27 del 1° novembre. Esito: ≤ 53:00 → A · 53:00–54:30 → B · oltre 54:30 → C (e controlla stanchezza o fastidi).", 13, "≈ 5:15/km", "180+ nel finale"),
      ] },
      { week: 14, runs: [
        run("w14r1", "Long Run", "Lungo con ritmo gara", "19 km: 11 km facili → 8 km a 5:36/km. Gel ai minuti 30, 60 e 90.", 19, "6:30–7:10/km → 5:36/km", "≤ 153 → ≤ 175"),
      ] },
      { week: 15, runs: [
        run("w15r1", "Tempo", "Tempo 25 min", "10 km: 2 km facili → 25 min a 5:28/km → facile.", 10, "5:25–5:30/km nel blocco", "172–180 nel blocco", true),
        run("w15r2", "Long Run", "SIMULATORE 1 (20 km)", "20 km: 10 km facili → 10 km a 5:36/km. Stessa colazione e stessi gel della gara (minuti 30, 60, 90). Annota FC e sforzo (1–10) agli ultimi 3 km: FC ≤ 175 e ≤ 7/10 → A in rotta · FC 176–178 o 8/10 → B · FC > 178 o ≥ 9/10 → C.", 20, "6:30–7:10/km → 5:36/km", "≤ 153 → ≤ 175"),
      ] },
      { week: 16, runs: [
        run("w16r1", "Speed", "Ripetute da 800", "9 km: 2 km facili → 6 × 800 m a 4:55/km (recupero 400 m di trotto) → facile.", 9, "4:55–5:00/km nelle ripetute", "leggila a fine ripetuta", true),
        run("w16r2", "Long Run", "Lungo di recupero con finale", "18 km: 14 km facili → 4 km a 5:36/km.", 18, "6:30–7:10/km → 5:36/km", "≤ 153 → ≤ 175"),
      ] },
    ]
  },
  {
    phase: 3, phaseTitle: "Ritmo gara", weeks: [
      { week: 17, tag: "SCARICO", runs: [
        run("w17r1", "Tempo", "3 × 2 km a ritmo gara", "12 km: 3 km facili → 3 × 2 km a 5:36/km (recupero 2 min di trotto) → facile.", 12, "5:36/km nei blocchi", "≤ 175 nei blocchi"),
      ] },
      { week: 18, runs: [
        run("w18r1", "Tempo", "Soglia lunga", "10 km: 2 km facili → 2 × 12 min a 5:28/km (recupero 3 min di trotto) → facile.", 10, "5:25–5:30/km nei blocchi", "172–180 nei blocchi", true),
        run("w18r2", "Long Run", "SIMULATORE 2 (20 km, picco)", "20 km: 8 km facili → 12 km a 5:36/km. Colazione e gel come in gara. È la prova finale: FC ≤ 175 e sforzo ≤ 7/10 agli ultimi 3 km → A · altrimenti scegli B o C. Se arrivi stanco, riduci il blocco a 8 km.", 20, "6:30–7:10/km → 5:36/km", "≤ 153 → ≤ 175"),
      ] },
      { week: 19, runs: [
        run("w19r1", "Tempo", "2 × 4 km a ritmo gara", "11 km: 2 km facili → 2 × 4 km a 5:36/km (recupero 3 min di trotto) → facile.", 11, "5:36/km nei blocchi", "≤ 175 nei blocchi", true),
        run("w19r2", "Long Run", "Lungo con finale", "16 km: 12 km facili → 4 km a 5:36/km.", 16, "6:30–7:10/km → 5:36/km", "≤ 153 → ≤ 175"),
      ] },
      { week: 20, runs: [
        run("w20r1", "Long Run", "Rifinitura", "14 km: 9 km facili → 5 km a 5:36/km. Da qui in poi si scarica.", 14, "6:30–7:10/km → 5:36/km", "≤ 153 → ≤ 175"),
      ] },
    ]
  },
  {
    phase: 4, phaseTitle: "Scarico e gara", weeks: [
      { week: 21, tag: "TAPER", runs: [
        run("w21r1", "Tempo", "Richiamo ritmo gara", "10 km: 2 km facili → 3 × 1,5 km a 5:36/km (recupero 2 min di trotto) → facile.", 10, "5:36/km nei blocchi", "≤ 175 nei blocchi"),
      ] },
      { week: 22, tag: "SETTIMANA DI GARA", runs: [
        run("w22r1", "Easy", "Scarico pre-gara", "5 km: 2 km facili → 3 × 1 min a 5:36/km (recupero 2 min) → facile. Poi riposo, carboidrati e sonno.", 5, "5:36/km nelle ripetute", "≤ 153 facile", true),
        run("w22r2", "Race", "🏁 GIORNO DI GARA — Mezza maratona", "Km 1–5: 5:41 → Km 6–16: 5:36 → Km 17–21,1: tieni, accelera dal 19 se hai gambe. Gel ai minuti 30, 60 e 90. Nessun km sotto 5:31 prima del km 16.", 21.1, "5:36/km sul Garmin (obiettivo 1:59)", "controllo ≤ 178 nei km 6–15"),
      ] },
    ]
  }
];

// =========================================================
//  ZONE E SCOPO DI OGNI USCITA
//  Zone (% FCR): Z1 ≤135 · Z2 136–153 · Z3 154–165 · Z4 166–180 · Z5 ≥181 bpm.
//  Negli allunghi e nelle ripetute brevi la FC non fa in tempo a salire: guida il ritmo.
// =========================================================
const RUN_INFO: Record<string, { zones: ZoneSeg[]; why: string }> = {
  w1r1: { zones: [{ z: "Z2", what: "6 km facili" }], why: "Smaltire la fatica di mezza e 10 km a tutta, senza aggiungere stress." },
  w2r1: { zones: [{ z: "Z2", what: "12 km" }], why: "Rimette chilometri nelle gambe e ricostruisce la base aerobica." },
  w3r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "2 × 8 min a 5:28" }], why: "Alza la soglia: il ritmo che reggi a lungo senza accumulare fatica." },
  w3r2: { zones: [{ z: "Z2", what: "13 km" }], why: "Allunga la tenuta aerobica di un chilometro alla volta." },
  w4r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "20 min a 5:28" }], why: "Un blocco unico a soglia: impari a reggere lo sforzo costante." },
  w4r2: { zones: [{ z: "Z2", what: "11 km" }, { z: "Z3", what: "ultimi 3 km a 6:00" }], why: "Finire più veloce abitua le gambe a spingere da stanche." },
  w5r1: { zones: [{ z: "Z2", what: "10 km" }, { z: "Z5", what: "4 allunghi da 20 s" }], why: "Settimana di scarico: gambe fresche e allunghi per restare brillante." },
  w6r1: { zones: [{ z: "Z2", what: "11 km" }, { z: "Z3–Z4", what: "ultimi 4 km a 5:50" }], why: "Prova insieme finale veloce e gel, i due punti deboli della mezza." },
  w7r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "3 × 8 min a 5:28" }], why: "Più minuti a soglia in blocchi brevi, con meno fatica." },
  w7r2: { zones: [{ z: "Z2", what: "12 km" }, { z: "Z3–Z4", what: "ultimi 4 km a 5:45" }], why: "Spingere a gambe già stanche: è il tuo punto debole." },
  w8r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z5", what: "8 × 1 min a 5:00" }], why: "Ripetute brevi per mantenere velocità e meccanica di corsa." },
  w8r2: { zones: [{ z: "Z2", what: "12 km" }, { z: "Z4", what: "ultimi 5 km a 5:40" }], why: "Il blocco veloce cresce: 5 km ormai vicini al ritmo gara." },
  w9r1: { zones: [{ z: "Z2", what: "3 km iniziali e 3 km finali" }, { z: "Z4", what: "6 km a 5:36" }], why: "Primo controllo: capisci se il 5:36 è sostenibile e scegli tra A, B e C." },
  w10r1: { zones: [{ z: "Z2", what: "12 km" }, { z: "Z4", what: "6 km a 5:38" }], why: "Il blocco a ritmo gara si allunga: allena la resistenza dopo i 12 km." },
  w11r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "2 × 15 min a 5:28" }], why: "Trenta minuti a soglia in due blocchi: alzano il ritmo che reggi a lungo." },
  w11r2: { zones: [{ z: "Z2", what: "16 km con gel" }], why: "Settimana di accumulo: chilometri facili e prova dei gel, senza ritmi." },
  w12r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z5", what: "5 × 1000 m a 4:58" }], why: "Ripetute più lunghe per spingere in alto la velocità aerobica massima." },
  w12r2: { zones: [{ z: "Z2", what: "10 km" }, { z: "Z4", what: "8 km a 5:36" }], why: "Otto km a ritmo gara con le gambe già cariche: allena la tenuta." },
  w13r1: { zones: [{ z: "Z2", what: "2 km + 1 km" }, { z: "Z4–Z5", what: "10 km a tutta, regolare" }], why: "Test: misura la tua velocità e conferma se resti sull'obiettivo A." },
  w14r1: { zones: [{ z: "Z2", what: "11 km" }, { z: "Z4", what: "8 km a 5:36" }], why: "Lungo più lungo con lo stesso blocco: allunga la resistenza." },
  w15r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "25 min a 5:28" }], why: "Tiene alta la soglia nella settimana del primo simulatore." },
  w15r2: { zones: [{ z: "Z2", what: "10 km" }, { z: "Z4", what: "10 km a 5:36" }], why: "Simulatore: mezza gara a ritmo gara dopo 10 km, con colazione e gel di gara." },
  w16r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z5", what: "6 × 800 m a 4:55" }], why: "Ripetute brevi per tenere vivace la velocità dopo il simulatore." },
  w16r2: { zones: [{ z: "Z2", what: "14 km" }, { z: "Z4", what: "4 km a 5:36" }], why: "Lungo di recupero con finale a ritmo gara: scarichi senza perdere il passo." },
  w17r1: { zones: [{ z: "Z2", what: "3 km iniziali e finali" }, { z: "Z4", what: "3 × 2 km a 5:36" }], why: "Settimana di scarico: ritmo gara in blocchi corti per abituarti al passo." },
  w18r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "2 × 12 min a 5:28" }], why: "Soglia lunga prima del simulatore finale." },
  w18r2: { zones: [{ z: "Z2", what: "8 km" }, { z: "Z4", what: "12 km a 5:36" }], why: "Prova finale: 12 km a ritmo gara dopo 8 facili, come in gara." },
  w19r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "2 × 4 km a 5:36" }], why: "Blocchi a ritmo gara con recupero: consolidano il passo." },
  w19r2: { zones: [{ z: "Z2", what: "12 km" }, { z: "Z4", what: "4 km a 5:36" }], why: "Lungo più corto dopo il picco, con un finale a ritmo gara." },
  w20r1: { zones: [{ z: "Z2", what: "9 km" }, { z: "Z4", what: "5 km a 5:36" }], why: "Ultima prova lunga di ritmo prima di scaricare." },
  w21r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "3 × 1,5 km a 5:36" }], why: "Taper: ritmo gara in piccole dosi per restare brillante senza fatica." },
  w22r1: { zones: [{ z: "Z2", what: "riscaldamento e resto" }, { z: "Z4", what: "3 × 1 min a 5:36" }], why: "Ultimo richiamo: sveglia le gambe prima della gara." },
  w22r2: { zones: [{ z: "Z4", what: "km 1–16: 5:41 poi 5:36" }, { z: "Z4–Z5", what: "km 17–21: tieni, volata nell'ultimo" }], why: "È il giorno: parti prudente, tieni 5:36 e accelera solo dal km 19." },
};

trainingPlan.forEach(p => p.weeks.forEach(w => w.runs.forEach(r => {
  const info = RUN_INFO[r.id];
  if (info) { r.zones = info.zones; r.why = info.why; }
})));

// Colori e limiti delle zone (per le etichette)
const ZONE_COLORS: Record<string, string> = { Z1: "#6B8EFF", Z2: "#00C4A7", Z3: "#D4A017", Z4: "#FF4B00", Z5: "#E23B3B" };
const ZONE_BPM: Record<string, string> = { Z1: "≤ 135", Z2: "136–153", Z3: "154–165", Z4: "166–180", Z5: "≥ 181" };
const zoneColor = (z: string): string => {
  const parts = z.match(/Z\d/g);
  return ZONE_COLORS[parts ? parts[parts.length - 1] : "Z2"] || "#888";
};

const TOTAL_WEEKS = trainingPlan.reduce((a, p) => a + p.weeks.length, 0);

const TYPE_COLORS: Record<string, { bg: string; light: string; text: string }> = {
  "Speed": { bg: "#FF4B00", light: "rgba(255,75,0,0.12)", text: "#FF4B00" },
  "Tempo": { bg: "#D4A017", light: "rgba(212,160,23,0.12)", text: "#D4A017" },
  "Long Run": { bg: "#00C4A7", light: "rgba(0,196,167,0.12)", text: "#00C4A7" },
  "Easy": { bg: "#6B8EFF", light: "rgba(107,142,255,0.12)", text: "#6B8EFF" },
  "Race": { bg: "#CC2A2A", light: "rgba(204,42,42,0.15)", text: "#FF4444" },
};

const TYPE_LABELS: Record<string, string> = {
  "Speed": "Veloce",
  "Tempo": "Soglia",
  "Long Run": "Lungo",
  "Easy": "Facile",
  "Race": "Gara",
};

// --- DATI PER LE SCHEDE "GARA" E "RITMI E ZONE" ---
const RACE_GOALS = [
  { label: "A (sub-2)", time: "1:59", real: "5:38", garmin: "5:36", note: "Il tuo 10 km del 1° novembre (53:27) vale una mezza in 1:58:27: serve la resistenza per tenerlo." },
  { label: "B", time: "2:03", real: "5:50", garmin: "5:48", note: "Se i controlli (sett. 9, 13, 15, 18) sono a metà strada." },
  { label: "C", time: "2:10", real: "6:10", garmin: "6:07", note: "Se salti molte uscite chiave o i controlli sono deboli: resta un miglioramento sui 2:12:02." },
];

const PASSAGES = [
  { goal: "A · 1:59", k5: "28:10", k10: "56:20", k15: "1:24:30", k20: "1:52:40", fin: "1:58:51" },
  { goal: "B · 2:03", k5: "29:10", k10: "58:20", k15: "1:27:30", k20: "1:56:40", fin: "2:03:04" },
  { goal: "C · 2:10", k5: "30:50", k10: "1:01:40", k15: "1:32:30", k20: "2:03:20", fin: "2:10:06" },
];

const GATES = [
  { when: "Sett. 9 · 6 km a 5:36 (in 12 km)", a: "FC ≤ 175 e sforzo ≤ 7/10", b: "FC 176–178 o 8/10", c: "FC > 178 o ≥ 9/10" },
  { when: "Sett. 13 · test 10 km", a: "≤ 53:00", b: "53:00–54:30", c: "oltre 54:30" },
  { when: "Sett. 15 · 10 km a 5:36 (in 20 km)", a: "FC ≤ 175 e ≤ 7/10 agli ultimi 3 km", b: "FC 176–178 o 8/10", c: "FC > 178 o ≥ 9/10" },
  { when: "Sett. 18 · 12 km a 5:36 (in 20 km)", a: "FC ≤ 175 e ≤ 7/10 agli ultimi 3 km", b: "FC 176–178 o 8/10", c: "FC > 178 o ≥ 9/10" },
];

const PACE_TABLE = [
  { t: "Facile / lungo (parte facile)", pace: "6:30–7:10", hr: "≤ 153", feel: "Frasi complete" },
  { t: "Progressivo (Z3)", pace: "5:50–6:10", hr: "154–165", feel: "Frasi brevi" },
  { t: "Tempo (soglia)", pace: "5:25–5:30", hr: "172–180", feel: "Comodamente duro" },
  { t: "Ritmo gara A (sub-2)", pace: "5:36", hr: "172–178", feel: "Sforzo 6–7 su 10" },
  { t: "Ripetute da 800–1000 m", pace: "4:55–5:03", hr: "a fine ripetuta", feel: "Duro ma controllato" },
  { t: "Allunghi da 20 s", pace: "≈ 4:50", hr: "—", feel: "Veloci ma rilassati" },
];

const HR_ZONES = [
  { z: "Z1", bpm: "≤ 135", pct: "30–57% FCR", use: "Riscaldamento, camminata" },
  { z: "Z2", bpm: "136–153", pct: "57–70%", use: "Facili e parte facile dei lunghi" },
  { z: "Z3", bpm: "154–165", pct: "70–79%", use: "Progressivi" },
  { z: "Z4", bpm: "166–180", pct: "79–90%", use: "Ritmo gara e soglia" },
  { z: "Z5", bpm: "≥ 181", pct: "90–100%", use: "Ripetute, volata finale" },
];

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
  let mins = Math.floor(paceMin);
  let secs = Math.round((paceMin - mins) * 60);
  if (secs === 60) { mins += 1; secs = 0; }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function parseDuration(h: string, m: string, s: string): number {
  return parseInt(h || "0") * 60 + parseInt(m || "0") + parseInt(s || "0") / 60;
}

// accetta sia la virgola sia il punto ("10,5" e "10.5")
function parseKm(v: string): number {
  const n = parseFloat(String(v || "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function formatDuration(h: string, m: string, s: string): string {
  const hh = parseInt(h || "0"), mm = parseInt(m || "0"), ss = parseInt(s || "0");
  const base = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return hh > 0 ? `${hh}:${base}` : base;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

function weekRange(w: number): string {
  const s = new Date(PLAN_START.getTime() + (w - 1) * 7 * 86400000);
  const e = new Date(s.getTime() + 6 * 86400000);
  const f = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  return `${f(s)} – ${f(e)}`;
}

// aggiunge "bpm" solo ai valori puramente numerici (es. "≤ 150"), non ai testi (es. "172–180 nei blocchi")
function hrText(hr: string): string {
  return /[A-Za-zÀ-ÿ]/.test(hr) ? hr : `${hr} bpm`;
}

// solo cifre, con tetto massimo; stringa vuota se non c'è nulla
function clampInt(v: string, max: number): string {
  const d = v.replace(/\D/g, "");
  return d === "" ? "" : String(Math.min(max, parseInt(d)));
}

// Chiave nuova: i dati dei vecchi piani non si mescolano con questo.
const LS_KEY = "sub2_v1";
const LS_SYNC_KEY = "sub2_sync_id";

const baselineRun: LogEntry = {
  id: "pre_populated_baseline",
  date: "2026-10-25",
  km: "21.1",
  hh: "2",
  mm: "12",
  ss: "2",
  hr: "177",
  notes: "Mezza maratona di partenza: 6:15/km reali, FC media 177 (soglia stimata ~180). Calo ai km 17–20 (+17 s/km a FC invariata). Gel solo a ~km 7 e ~km 15.",
  runId: ""
};

const baselineTT: LogEntry = {
  id: "pre_populated_tt",
  date: "2026-11-01",
  km: "10.01",
  hh: "0",
  mm: "53",
  ss: "27",
  hr: "174",
  notes: "10 km a tutta: 5:20/km, FC media 174 (max 190), split negativo 27:27 / 26:00. Equivale a una mezza in 1:58:27 (VDOT ≈ 37). Partenza senza riscaldamento.",
  runId: ""
};

const baselines: LogEntry[] = [baselineTT, baselineRun]; // dal più recente

function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.logs) {
        baselines.forEach(b => {
          if (!parsed.logs.some(l => l.id === b.id)) parsed.logs.push(b);
        });
      }
      return parsed;
    }
  } catch {}
  return { completed: {}, logs: [...baselines] };
}

// --- STILI CONDIVISI ---
const CARD = "bg-[#12121B] border border-[#2A2A3D] rounded-2xl";
const H3 = "text-sm font-extrabold text-white uppercase tracking-wider";
const LABEL = "text-[11px] font-bold uppercase tracking-wider text-gray-400";
const INPUT = "w-full bg-[#0A0A0F] border border-[#34344C] rounded-xl px-3.5 py-3 text-base text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25";
const BTN_PRIMARY = "bg-orange-500 hover:bg-orange-400 text-[#150800] font-extrabold rounded-xl border-none cursor-pointer";
const BTN_GHOST = "bg-[#1C1C2B] hover:bg-[#242438] text-gray-100 font-bold rounded-xl border border-[#34344C] cursor-pointer";

function ZoneChip({ z, what }: { z: string; what: string }) {
  const c = zoneColor(z);
  return (
    <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-md" style={{ backgroundColor: `${c}24`, color: c, border: `1px solid ${c}55` }}>
      {z} · {what}
    </span>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={`${LABEL} block mb-1.5`}>{label}</label>
      {children}
      {error && <p className="text-xs font-semibold text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

function UnitInput({ unit, ...props }: { unit: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input {...props} className={`${INPUT} pr-12`} />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{unit}</span>
    </div>
  );
}

type FormState = { date: string; km: string; hh: string; mm: string; ss: string; hr: string; rpe: string; notes: string; runId: string };
const EMPTY_FORM: FormState = { date: "", km: "", hh: "", mm: "", ss: "", hr: "", rpe: "", notes: "", runId: "" };

export default function App() {
  const [countdown, setCountdown] = useState(getCountdown());
  const [state, setState] = useState<AppState>({ completed: {}, logs: [...baselines] });
  const [syncId, setSyncId] = useState<string>(() => localStorage.getItem(LS_SYNC_KEY) || "sub2_runner");
  const [cloudStatus, setCloudStatus] = useState<"local" | "synced" | "saving" | "error" | "checking">("checking");

  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({ 1: true, 2: true });
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({ 1: true, 2: false, 3: false, 4: false });
  const [activeTab, setActiveTab] = useState<string>("plan");
  const [modal, setModal] = useState<"log" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<{ km?: string; time?: string }>({});
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

  // Esc chiude la finestra; blocca lo scroll della pagina mentre è aperta
  useEffect(() => {
    if (!modal && !deleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setModal(null); setDeleteConfirm(null); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [modal, deleteConfirm]);

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
    localStorage.setItem(LS_SYNC_KEY, cleanVal);
    setSyncId(cleanVal);
  };

  const allRuns = useMemo(() => trainingPlan.flatMap(p => p.weeks).flatMap(w => w.runs), []);
  const coreRuns = useMemo(() => allRuns.filter(r => !r.optional), [allRuns]);
  const totalPlanKm = useMemo(() => coreRuns.reduce((a, r) => a + r.targetKm, 0), [coreRuns]);

  const loggedKm = useMemo(() =>
    state.logs.reduce((a, l) => a + parseKm(l.km), 0), [state.logs]);

  const completedCount = useMemo(() => coreRuns.filter(r => state.completed[r.id]).length, [coreRuns, state.completed]);
  const totalRuns = coreRuns.length;

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
    const targetRun = allRuns.find(r => r.id === runId);
    setForm({
      ...EMPTY_FORM,
      date: new Date().toISOString().slice(0, 10),
      km: targetRun ? String(targetRun.targetKm).replace(".", ",") : "",
      runId
    });
    setFormErrors({});
    setEditingLog(null);
    setModal("log");
  };

  const openNewFree = () => {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setFormErrors({});
    setEditingLog(null);
    setModal("log");
  };

  const openEdit = (log: LogEntry) => {
    setForm({
      date: log.date,
      km: String(log.km).replace(".", ","),
      hh: log.hh && log.hh !== "0" ? log.hh : "",
      mm: log.mm || "",
      ss: log.ss && log.ss !== "0" ? log.ss : "",
      hr: log.hr || "",
      rpe: log.rpe || "",
      notes: log.notes || "",
      runId: log.runId || ""
    });
    setFormErrors({});
    setEditingLog(log.id);
    setModal("log");
  };

  const submitLog = () => {
    const km = parseKm(form.km);
    const mins = parseDuration(form.hh, form.mm, form.ss);
    const errors: { km?: string; time?: string } = {};
    if (!km || km <= 0) errors.km = "Inserisci la distanza, per esempio 10,5";
    else if (km > 100) errors.km = "Distanza troppo alta: controlla il valore";
    if (!mins || mins <= 0) errors.time = "Inserisci il tempo (almeno i minuti)";
    setFormErrors(errors);
    if (errors.km || errors.time || !form.date) return;

    const entry: LogEntry = {
      id: editingLog || `log_${Date.now()}`,
      date: form.date,
      km: String(km),
      hh: form.hh || "0",
      mm: form.mm || "0",
      ss: form.ss || "0",
      hr: form.hr,
      rpe: form.rpe,
      notes: form.notes.trim(),
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
    const km = parseKm(form.km);
    const mins = parseDuration(form.hh, form.mm, form.ss);
    return formatPace(mins, km);
  }, [form.km, form.hh, form.mm, form.ss]);

  const linkedRunForForm = useMemo(() => allRuns.find(r => r.id === form.runId), [allRuns, form.runId]);

  const progressPct = Math.min(100, Math.round((completedCount / totalRuns) * 100));

  const chartsData = useMemo(() => {
    const planWeeksKm = Array(TOTAL_WEEKS + 1).fill(0);
    const planWeeksDuration = Array(TOTAL_WEEKS + 1).fill(0);

    state.logs.forEach(log => {
      const logDate = new Date(log.date);
      const km = parseKm(log.km);
      const duration = parseDuration(log.hh, log.mm, log.ss);

      let weekIndex = 0;
      if (logDate >= PLAN_START) {
        const diffDays = Math.floor((logDate.getTime() - PLAN_START.getTime()) / (1000 * 60 * 60 * 24));
        weekIndex = Math.min(TOTAL_WEEKS, Math.floor(diffDays / 7) + 1);
      }
      planWeeksKm[weekIndex] += km;
      planWeeksDuration[weekIndex] += duration;
    });

    const planWeeksAvgPaceDecimal = planWeeksKm.map((km, i) => km === 0 ? 0 : planWeeksDuration[i] / km);
    const planTargets = Array(TOTAL_WEEKS + 1).fill(0);
    trainingPlan.forEach(phase => {
      phase.weeks.forEach(w => { planTargets[w.week] = w.runs.reduce((sum, r) => sum + r.targetKm, 0); });
    });

    const typesKm: Record<string, number> = { Speed: 0, Tempo: 0, "Long Run": 0, Easy: 0, Race: 0, "Other": 0 };
    let maxDistance = 0;
    let minPaceDecimal = Infinity;

    state.logs.forEach(log => {
      const km = parseKm(log.km);
      if (km > maxDistance) maxDistance = km;
      const duration = parseDuration(log.hh, log.mm, log.ss);
      const paceDecimal = km > 0 ? duration / km : 0;
      if (paceDecimal > 0 && paceDecimal < minPaceDecimal) minPaceDecimal = paceDecimal;

      const linkedRun = allRuns.find(r => r.id === log.runId);
      const type = linkedRun ? linkedRun.type : (log.id.startsWith("pre_populated") ? "Long Run" : "Other");
      typesKm[type] = (typesKm[type] || 0) + km;
    });

    return {
      planWeeksKm,
      planWeeksAvgPaceDecimal,
      planTargets,
      typesKm,
      maxDistance,
      preKm: planWeeksKm[0],
      fastestPace: minPaceDecimal === Infinity ? "—" : formatPace(minPaceDecimal, 1)
    };
  }, [state.logs, allRuns]);

  // geometria dei grafici (viewBox 330 x 150, si adatta alla larghezza dello schermo)
  const CH_W = 330, CH_LEFT = 14, CH_RIGHT = 8;
  const chartStep = (CH_W - CH_LEFT - CH_RIGHT) / TOTAL_WEEKS;
  const colCenter = (w: number) => CH_LEFT + (w - 0.5) * chartStep;
  const barW = Math.min(11, chartStep * 0.62);
  const maxChartKm = Math.max(...chartsData.planTargets.slice(1), ...chartsData.planWeeksKm.slice(1), 1);
  const targetLineY = 130 - (8.0 - TARGET_PACE_MIN) * 30;

  const tabs = [
    { id: "plan", label: "Piano" },
    { id: "zones", label: "Ritmi" },
    { id: "history", label: "Diario" },
    { id: "charts", label: "Analisi" },
    { id: "race", label: "Gara" }
  ];

  return (
    <div className="bg-[#0A0A0F] min-h-screen text-gray-100 antialiased" style={{ fontFamily: "'Barlow', sans-serif" }}>

      {/* STATO DEL SALVATAGGIO */}
      <div className="bg-[#08080D] border-b border-[#1C1C2B] py-2 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              {isCloudEnabled ? `Database cloud collegato (${syncId}) · ${cloudStatus}` : "Salvataggio locale nel browser attivo"}
            </span>
          </div>
          {isCloudEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-bold">ID SINCRONIZZAZIONE:</span>
              <input
                type="text"
                value={syncId}
                onChange={(e) => handleSyncIdChange(e.target.value)}
                className="bg-[#11111A] text-xs font-semibold border border-[#34344C] rounded px-2 py-1 text-orange-400 focus:outline-none focus:border-orange-500 w-28 text-center"
              />
            </div>
          )}
        </div>
      </div>

      {/* INTESTAZIONE */}
      <div className="bg-gradient-to-b from-orange-500/10 to-transparent border-b border-[#1C1C2B] pt-6 pb-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div>
            <div className="inline-flex items-center px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-lg text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-orange-300 mb-3">
              🏁 Mezza maratona · 22 settimane · 1–2 uscite/sett.
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              IL PIANO SUB-2:00
            </h1>
            <div className="flex flex-wrap gap-2 mt-3">
              {["Gara · 4 aprile 2027", "A · 1:59 (5:36/km)", "B · 2:03", "C · 2:10"].map(t => (
                <span key={t} className="text-xs font-semibold text-gray-200 bg-[#12121B] border border-[#2A2A3D] rounded-md px-2.5 py-1">{t}</span>
              ))}
            </div>
          </div>

          <div className={`${CARD} px-4 py-3 grid grid-cols-4 gap-2 text-center w-full md:w-auto md:min-w-[300px]`}>
            {[
              { val: countdown.days, label: "Giorni" },
              { val: countdown.hours, label: "Ore" },
              { val: countdown.minutes, label: "Min" },
              { val: countdown.seconds, label: "Sec" }
            ].map((col, idx) => (
              <div key={idx}>
                <div className="text-3xl md:text-4xl font-extrabold text-orange-400 leading-none tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {String(col.val).padStart(2, "0")}
                </div>
                <div className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mt-1">{col.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {[
            { label: "Piano completato", val: `${progressPct}%`, sub: `${completedCount}/${totalRuns} uscite chiave`, color: "border-orange-500/30" },
            { label: "Volume registrato", val: `${loggedKm.toFixed(1)} km`, sub: `Piano: ~${totalPlanKm.toFixed(0)} km chiave`, color: "border-teal-500/30" },
            { label: "Ritmo medio", val: avgPace, sub: "min/km registrato", color: "border-yellow-500/30" },
            { label: "Corse registrate", val: state.logs.length, sub: "Attività nel diario", color: "border-blue-500/30" }
          ].map((stat, idx) => (
            <div key={idx} className={`bg-[#12121B] border ${stat.color} p-4 rounded-xl flex flex-col`}>
              <div className="text-[11px] text-gray-400 uppercase font-extrabold tracking-wider">{stat.label}</div>
              <div className="text-3xl font-extrabold text-white leading-tight mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{stat.val}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto w-full h-2 bg-[#1C1C2B] rounded-full overflow-hidden mt-4">
          <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
        </div>
      </div>

      {/* SCHEDE */}
      <div className="bg-[#0A0A0F]/95 backdrop-blur border-b border-[#1C1C2B] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto grid grid-cols-5 gap-1 px-2 py-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wide border-none cursor-pointer ${
                activeTab === tab.id
                  ? "bg-orange-500 text-[#150800]"
                  : "text-gray-300 hover:text-white hover:bg-[#161622] bg-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENUTO */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4 md:py-8 pb-32">

        {/* SCHEDA PIANO */}
        {activeTab === "plan" && (
          <div className="space-y-4">
            <div className={`${CARD} p-4`}>
              <div className={`${LABEL} mb-2`}>Le tue zone cardiache</div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(ZONE_BPM).map(z => <ZoneChip key={z} z={z} what={`${ZONE_BPM[z]} bpm`} />)}
              </div>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed">Ogni uscita indica le zone da usare e perché. Negli allunghi e nelle ripetute brevi la FC non fa in tempo a salire: guida il ritmo.</p>
            </div>

            {trainingPlan.map(phase => {
              const isOpen = expandedPhases[phase.phase];
              const phaseCore = phase.weeks.flatMap(w => w.runs).filter(r => !r.optional);
              const phaseCompleted = phaseCore.filter(r => state.completed[r.id]).length;
              const pc = ["#FF4B00", "#D4A017", "#00C4A7", "#6B8EFF"][phase.phase - 1];

              return (
                <div key={phase.phase} className={`${CARD} overflow-hidden`}>
                  <div
                    onClick={() => setExpandedPhases(prev => ({ ...prev, [phase.phase]: !isOpen }))}
                    className="p-3 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#171724] transition-colors select-none"
                    role="button" aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div
                        className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-lg"
                        style={{ backgroundColor: `${pc}22`, border: `1px solid ${pc}55`, color: pc, fontFamily: "'Barlow Condensed', sans-serif" }}
                      >
                        {phase.phase}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base md:text-lg font-extrabold text-white leading-tight">Fase {phase.phase}: {phase.phaseTitle}</h2>
                        <p className="text-xs text-gray-400 mt-1">Settimane {phase.weeks[0].week}–{phase.weeks[phase.weeks.length - 1].week} · {phaseCompleted}/{phaseCore.length} uscite chiave completate</p>
                      </div>
                    </div>
                    <span className={`text-lg shrink-0 transition-transform duration-300 text-gray-300 ${isOpen ? "rotate-180" : "rotate-0"}`}>▾</span>
                  </div>

                  {isOpen && (
                    <div className="border-t border-[#2A2A3D] p-2 sm:p-4 bg-[#0D0D14]/60 space-y-3">
                      {phase.weeks.map(week => {
                        const isWeekOpen = expandedWeeks[week.week];
                        const weekCore = week.runs.filter(r => !r.optional);
                        const weekCompleted = weekCore.filter(r => state.completed[r.id]).length;
                        const weekKm = Math.round(weekCore.reduce((a, r) => a + r.targetKm, 0));
                        const weekOptKm = Math.round(week.runs.filter(r => r.optional).reduce((a, r) => a + r.targetKm, 0));

                        return (
                          <div key={week.week} className="border border-[#2A2A3D] rounded-xl bg-[#0B0B11]">
                            <div
                              onClick={() => setExpandedWeeks(prev => ({ ...prev, [week.week]: !isWeekOpen }))}
                              className="p-3 flex justify-between items-center gap-3 cursor-pointer hover:bg-[#12121B] rounded-xl"
                              role="button" aria-expanded={!!isWeekOpen}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-black text-base text-white tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>SETTIMANA {week.week}</span>
                                  {week.tag && <span className="text-[11px] font-bold text-yellow-300 bg-yellow-500/15 px-2 py-0.5 rounded-full">{week.tag}</span>}
                                  {weekCompleted === weekCore.length ? (
                                    <span className="text-[11px] font-bold text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded-full">✓ COMPLETATA</span>
                                  ) : weekCompleted > 0 ? (
                                    <span className="text-[11px] font-bold text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded-full">{weekCompleted}/{weekCore.length} COMPLETATE</span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">{weekRange(week.week)} · {weekKm} km{weekOptKm > 0 ? ` (+${weekOptKm} facoltativi)` : ""}</div>
                              </div>
                              <span className={`text-base shrink-0 text-gray-300 transition-transform ${isWeekOpen ? "rotate-180" : ""}`}>▾</span>
                            </div>

                            {isWeekOpen && (
                              <div className="p-2 sm:p-3 border-t border-[#2A2A3D] space-y-3">
                                {week.runs.map(run => {
                                  const completed = state.completed[run.id];
                                  const linkedLog = state.logs.find(l => l.runId === run.id);
                                  const theme = TYPE_COLORS[run.type] || TYPE_COLORS["Easy"];

                                  return (
                                    <div key={run.id} className={`p-3 sm:p-4 rounded-xl border transition-all ${completed ? "bg-[#0E1F1A]/70 border-teal-500/30" : "bg-[#12121B] border-[#2A2A3D]"}`}>
                                      {/* riga alta: spunta + etichette a sinistra, km a destra */}
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => toggleComplete(run.id)}
                                          aria-label={completed ? "Segna come non fatta" : "Segna come fatta"}
                                          className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                                            completed ? "bg-teal-400 border-teal-400 text-black font-extrabold" : "border-gray-500 hover:border-gray-300 bg-transparent"
                                          }`}
                                        >
                                          {completed && <span className="text-sm leading-none">✓</span>}
                                        </button>
                                        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase" style={{ backgroundColor: theme.light, color: theme.text }}>
                                            {TYPE_LABELS[run.type] || run.type}
                                          </span>
                                          {run.optional && (
                                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase bg-[#1C1C2B] text-gray-300 border border-[#34344C]">Facoltativa</span>
                                          )}
                                        </div>
                                        <span className="shrink-0 text-xl font-black text-white tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                          {run.targetKm} <span className="text-sm font-bold text-gray-400">km</span>
                                        </span>
                                      </div>

                                      <h3 className="font-extrabold text-white text-base leading-snug mt-2.5">{run.title}</h3>

                                      {run.why && (
                                        <p className="text-sm text-orange-200 italic mt-1.5">💡 {run.why}</p>
                                      )}
                                      <p className="text-sm text-gray-300 leading-relaxed mt-2">{run.desc}</p>

                                      {/* griglia etichetta/valore: tutto allineato */}
                                      <dl className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-2 items-start mt-3 text-sm">
                                        {run.zones && run.zones.length > 0 && (
                                          <>
                                            <dt className={`${LABEL} pt-1.5`}>Zone</dt>
                                            <dd className="flex flex-wrap gap-1.5 m-0">
                                              {run.zones.map((zs, zi) => <ZoneChip key={zi} z={zs.z} what={zs.what} />)}
                                            </dd>
                                          </>
                                        )}
                                        {run.pace && (
                                          <>
                                            <dt className={`${LABEL} pt-0.5`}>Ritmo</dt>
                                            <dd className="m-0 font-bold" style={{ color: theme.text }}>⏱ {run.pace}</dd>
                                          </>
                                        )}
                                        {run.hr && (
                                          <>
                                            <dt className={`${LABEL} pt-0.5`}>FC</dt>
                                            <dd className="m-0 font-bold text-gray-100">❤ {hrText(run.hr)}</dd>
                                          </>
                                        )}
                                      </dl>

                                      {linkedLog && (
                                        <div className="mt-3 p-3 rounded-lg bg-[#08100D] border border-teal-500/25 flex flex-wrap gap-x-4 gap-y-1 text-sm text-teal-300 font-semibold">
                                          <span>📍 {linkedLog.km} km</span>
                                          <span>⏱ {formatDuration(linkedLog.hh, linkedLog.mm, linkedLog.ss)}</span>
                                          <span>📈 {formatPace(parseDuration(linkedLog.hh, linkedLog.mm, linkedLog.ss), parseKm(linkedLog.km))}/km</span>
                                          {linkedLog.hr && <span>❤ {linkedLog.hr} bpm</span>}
                                          {linkedLog.rpe && <span>💪 {linkedLog.rpe}/10</span>}
                                        </div>
                                      )}

                                      <div className="mt-3 flex sm:justify-end">
                                        <button
                                          onClick={() => linkedLog ? openEdit(linkedLog) : openLog(run.id)}
                                          className={`${BTN_GHOST} w-full sm:w-auto px-4 py-2.5 text-sm`}
                                        >
                                          {linkedLog ? "✎ Modifica registrazione" : "📥 Registra la corsa"}
                                        </button>
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

        {/* SCHEDA RITMI E ZONE */}
        {activeTab === "zones" && (
          <div className="space-y-5">
            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-1`}>Ritmi da mantenere</h3>
              <p className="text-sm text-gray-300 mb-3 leading-relaxed">Ritmi in min/km sul Garmin (legge circa lo 0,6% di distanza in più del percorso), calibrati sul tuo 10 km in 53:27 (VDOT ≈ 37). La guida è lo sforzo: la FC serve da controllo.</p>
              <div>
                {PACE_TABLE.map(r => (
                  <div key={r.t} className="py-3 border-t border-[#2A2A3D]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold text-white">{r.t}</span>
                      <span className="font-black text-lg text-orange-400 tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{r.pace}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-sm text-gray-300 mt-0.5">
                      <span>{r.feel}</span>
                      <span className="text-gray-400 shrink-0">FC {r.hr}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed border-t border-[#2A2A3D] pt-3">Mappa ritmo-FC misurata il 1° novembre: 5:35 ≈ 171–175 bpm · 5:22 ≈ 176 · 5:01 ≈ 183 · 4:33 ≈ 187–189. Nelle prime uscite facili annota la FC a 6:45–7:00: non ho dati a ritmi lenti, quindi i ritmi facili sono una stima.</p>
            </div>

            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-1`}>Zone cardiache (% FCR)</h3>
              <p className="text-sm text-gray-300 mb-3">Basate su FCmax 195, FC a riposo 57 e soglia stimata ~180 bpm.</p>
              <div>
                {HR_ZONES.map(r => (
                  <div key={r.z} className="py-3 border-t border-[#2A2A3D] grid grid-cols-[3rem_1fr] gap-x-3 items-center">
                    <span className="text-center text-sm font-extrabold rounded-md py-1" style={{ backgroundColor: `${zoneColor(r.z)}24`, color: zoneColor(r.z), border: `1px solid ${zoneColor(r.z)}55` }}>{r.z}</span>
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-bold text-white">{r.bpm} bpm</span>
                        <span className="text-xs text-gray-400">{r.pct}</span>
                      </div>
                      <div className="text-sm text-gray-300">{r.use}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-3`}>Come funziona il piano</h3>
              <ul className="space-y-2.5 text-sm text-gray-300 leading-relaxed list-disc pl-5">
                <li><span className="text-white font-bold">1 uscita chiave a settimana</span> (il lungo). La seconda uscita, una qualità breve, è <span className="text-white font-bold">facoltativa</span> e capita a settimane alterne: in tutto circa 6 uscite al mese. Saltarla non compromette il piano.</li>
                <li><span className="text-white font-bold">Se salti un'uscita chiave,</span> ripeti la settimana. Se ne salti due di fila, rivedi l'obiettivo (B o C).</li>
                <li><span className="text-white font-bold">Il lavoro che conta è dentro i lunghi:</span> blocchi a ritmo gara da 4 → 6 → 8 → 10 → 12 km. Allenano la resistenza che ti è mancata nella mezza (calo ai km 17–20).</li>
                <li><span className="text-white font-bold">Pesi:</span> li gestisci tu. Unico consiglio di calendario: niente gambe pesanti nelle 48 ore prima delle uscite chiave.</li>
                <li><span className="text-white font-bold">Gel:</span> ai minuti 30, 60 e 90 già dai lunghi della settimana 6, sempre lo stesso prodotto della gara.</li>
                <li><span className="text-white font-bold">Freddo o ghiaccio:</span> sposta l'uscita di un giorno o usa il tapis roulant. Con il freddo il sensore ottico peggiora: fidati della sensazione.</li>
                <li><span className="text-white font-bold">Dolore:</span> oltre 3/10 o che cambia l'appoggio, salta la corsa. Se dura 7 giorni, vai da un fisioterapista.</li>
                <li><span className="text-white font-bold">FC a riposo:</span> la tua è 56–57. Se resta +5 bpm per 3 giorni, alleggerisci. Hai fatto tre sforzi da effetto 4,7–5,0 in 12 giorni: la settimana 1 è solo recupero.</li>
              </ul>
            </div>
          </div>
        )}

        {/* SCHEDA DIARIO */}
        {activeTab === "history" && (
          <div>
            <div className="flex justify-between items-center gap-3 mb-4">
              <h2 className="text-2xl font-black text-white tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>DIARIO DELLE CORSE</h2>
              <button onClick={openNewFree} className={`${BTN_PRIMARY} text-sm px-4 py-2.5 shrink-0`}>+ Registra</button>
            </div>

            <div className="space-y-3">
              {state.logs.map(log => {
                const mins = parseDuration(log.hh, log.mm, log.ss);
                const km = parseKm(log.km);
                const linked = allRuns.find(r => r.id === log.runId);
                return (
                  <div key={log.id} className={`${CARD} p-4`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-200">{formatDate(log.date)}</div>
                        {linked && <div className="text-xs text-gray-400 mt-0.5">{linked.title}</div>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openEdit(log)} className={`${BTN_GHOST} px-3 py-1.5 text-xs`}>Modifica</button>
                        <button onClick={() => setDeleteConfirm(log.id)} className="px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer bg-[#2A1414] hover:bg-[#3A1A1A] border border-[#5A2424] text-red-300">Elimina</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <div className={LABEL}>Distanza</div>
                        <div className="text-3xl font-black text-white leading-tight tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{log.km}<span className="text-sm font-bold text-gray-400 ml-1">km</span></div>
                      </div>
                      <div>
                        <div className={LABEL}>Tempo</div>
                        <div className="text-3xl font-black text-white leading-tight tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{formatDuration(log.hh, log.mm, log.ss)}</div>
                      </div>
                      <div>
                        <div className={LABEL}>Ritmo</div>
                        <div className="text-3xl font-black text-orange-400 leading-tight tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{formatPace(mins, km)}<span className="text-sm font-bold text-gray-400 ml-1">/km</span></div>
                      </div>
                    </div>

                    {(log.hr || log.rpe) && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {log.hr && <span className="text-xs font-bold text-gray-100 bg-[#1C1C2B] border border-[#34344C] rounded-md px-2.5 py-1">❤ FC media {log.hr} bpm</span>}
                        {log.rpe && <span className="text-xs font-bold text-gray-100 bg-[#1C1C2B] border border-[#34344C] rounded-md px-2.5 py-1">💪 Sforzo {log.rpe}/10</span>}
                      </div>
                    )}

                    {log.notes && (
                      <div className="mt-3 text-sm text-gray-300 leading-relaxed bg-[#0A0A0F] p-3 rounded-lg border-l-2 border-orange-500/70">
                        {log.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SCHEDA ANALISI */}
        {activeTab === "charts" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className={`${CARD} p-4`}>
                <span className={LABEL}>Ritmo medio più veloce</span>
                <div className="text-3xl font-black text-teal-300 mt-1 tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{chartsData.fastestPace}<span className="text-sm font-bold text-gray-400 ml-1">/km</span></div>
              </div>
              <div className={`${CARD} p-4`}>
                <span className={LABEL}>Uscita più lunga</span>
                <div className="text-3xl font-black text-orange-400 mt-1 tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{chartsData.maxDistance}<span className="text-sm font-bold text-gray-400 ml-1">km</span></div>
              </div>
            </div>
            <div className={`${CARD} p-4`}>
              <span className={LABEL}>Km per tipo</span>
              <div className="text-sm text-gray-300 mt-2 space-y-1">
                {Object.entries(chartsData.typesKm).filter(([, v]) => v > 0).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span>{TYPE_LABELS[k] || "Altro"}</span><span className="text-white font-bold tabular-nums">{v.toFixed(1)} km</span></div>
                ))}
              </div>
            </div>

            {/* GRAFICO 1 */}
            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-1`}>Km a settimana</h3>
              <p className="text-xs text-gray-400 mb-3">Barra grigia = km previsti (chiave + facoltative) · barra verde = km corsi. Prima del piano: {chartsData.preKm.toFixed(1)} km.</p>
              <svg viewBox={`0 0 ${CH_W} 150`} className="w-full h-auto" role="img" aria-label="Km a settimana">
                <line x1={CH_LEFT - 4} y1="120" x2={CH_W - CH_RIGHT + 4} y2="120" stroke="#34344C" />
                {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => {
                  const x = colCenter(w);
                  const doneH = (chartsData.planWeeksKm[w] / maxChartKm) * 95;
                  const planH = (chartsData.planTargets[w] / maxChartKm) * 95;
                  return (
                    <g key={w}>
                      {planH > 0 && <rect x={x - barW / 2} y={120 - planH} width={barW} height={planH} fill="#3A3A55" rx="2" />}
                      {doneH > 0 && <rect x={x - barW / 2} y={120 - Math.min(doneH, 100)} width={barW} height={Math.min(doneH, 100)} fill="#2DD4BF" rx="2" />}
                      {(w - 1) % 3 === 0 && <text x={x} y="136" fill="#9CA3AF" fontSize="9" textAnchor="middle">{w}</text>}
                    </g>
                  );
                })}
                <text x={CH_W / 2} y="148" fill="#9CA3AF" fontSize="8" textAnchor="middle">settimana del piano</text>
              </svg>
            </div>

            {/* GRAFICO 2 */}
            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-1`}>Ritmo medio a settimana</h3>
              <p className="text-xs text-gray-400 mb-3">I facili sono lenti per scelta: guarda come scendono i ritmi nei blocchi a ritmo gara e nella gara.</p>
              <svg viewBox={`0 0 ${CH_W} 150`} className="w-full h-auto" role="img" aria-label="Ritmo medio a settimana">
                <line x1={CH_LEFT - 4} y1={targetLineY} x2={CH_W - CH_RIGHT + 4} y2={targetLineY} stroke="#FBBF24" strokeDasharray="5 3" />
                <text x={CH_W - CH_RIGHT} y={targetLineY - 5} fill="#FBBF24" fontSize="9" textAnchor="end">Ritmo gara obiettivo (5:36)</text>
                {(() => {
                  const pts: { x: number, y: number }[] = [];
                  chartsData.planWeeksAvgPaceDecimal.forEach((pace, i) => {
                    if (i > 0 && pace > 0) {
                      pts.push({ x: colCenter(i), y: Math.max(10, Math.min(135, 130 - (8.0 - pace) * 30)) });
                    }
                  });
                  return (
                    <g>
                      {pts.length > 1 && <path d={pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")} fill="none" stroke="#2DD4BF" strokeWidth="2" />}
                      {pts.map((pt, idx) => <circle key={idx} cx={pt.x} cy={pt.y} r="3.5" fill="#0A0A0F" stroke="#2DD4BF" strokeWidth="2" />)}
                    </g>
                  );
                })()}
                {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).filter(w => (w - 1) % 3 === 0).map(w => (
                  <text key={w} x={colCenter(w)} y="146" fill="#9CA3AF" fontSize="9" textAnchor="middle">{w}</text>
                ))}
              </svg>
              {chartsData.planWeeksAvgPaceDecimal.slice(1).every(p => p === 0) && (
                <p className="text-xs text-gray-400 mt-2">Il grafico si riempie quando registri le corse del piano (dal 2 novembre).</p>
              )}
            </div>
          </div>
        )}

        {/* SCHEDA GARA */}
        {activeTab === "race" && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="bg-gradient-to-r from-orange-500/15 to-yellow-500/10 border border-orange-500/30 p-5 rounded-2xl text-center">
              <h3 className="text-2xl font-extrabold text-orange-300 leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>OBIETTIVO: SUB-2:00 · MEZZA IN 1:59</h3>
              <p className="text-sm text-gray-200 mt-2 leading-relaxed">21,1 km a 5:38/km reali (5:36 sul Garmin). B (2:03) e C (2:10) restano le uscite di sicurezza se i controlli non ti danno via libera.</p>
            </div>

            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-3`}>Da dove parti</h3>
              <ul className="space-y-2.5 text-sm text-gray-300 leading-relaxed list-disc pl-5">
                <li><span className="text-white font-bold">Velocità:</span> 10 km in 53:27 (1° novembre) = mezza equivalente in 1:58:27 (VDOT ≈ 37).</li>
                <li><span className="text-white font-bold">Resistenza:</span> mezza del 25 ottobre in 2:12:02, 13:35 più lenta (+11,5%). Rapporto mezza/10 km: 2,47 contro 2,22 atteso; per il sub-2 serve ≤ 2,25.</li>
                <li><span className="text-white font-bold">Il gap è di tenuta,</span> non di velocità: calo ai km 17–20, passo −5% a FC invariata, gel presi tardi e pochi.</li>
                <li><span className="text-white font-bold">Con 1–2 uscite a settimana la strada è stretta:</span> per questo il piano concentra il lavoro nei lunghi con blocchi a ritmo gara e usa quattro controlli per decidere tra A, B e C.</li>
              </ul>
            </div>

            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-3`}>Obiettivi</h3>
              <div>
                {RACE_GOALS.map(g => (
                  <div key={g.label} className="py-3 border-t border-[#2A2A3D] first:border-t-0 first:pt-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-3">
                        <span className="font-extrabold text-white w-20">{g.label}</span>
                        <span className="text-3xl font-black text-orange-400 leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{g.time}</span>
                      </div>
                      <span className="text-sm text-gray-200 text-right">{g.real}/km reali<br /><span className="text-gray-400">{g.garmin} sul Garmin</span></span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{g.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-1`}>Passaggi ai cartelli km</h3>
              <p className="text-xs text-gray-400 mb-3">Riferiti ai cartelli ufficiali, non ai km del Garmin.</p>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-gray-400 uppercase tracking-wider text-[11px]">
                    <th className="pb-2 font-bold">Cartello</th>
                    {PASSAGES.map(p => <th key={p.goal} className="pb-2 font-bold text-right">{p.goal}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {([["km 5", "k5"], ["km 10", "k10"], ["km 15", "k15"], ["km 20", "k20"], ["Arrivo", "fin"]] as const).map(([lab, key]) => (
                    <tr key={key} className="border-t border-[#2A2A3D]">
                      <td className="py-2.5 font-bold text-white">{lab}</td>
                      {PASSAGES.map(p => (
                        <td key={p.goal} className={`py-2.5 text-right ${key === "fin" ? "text-orange-400 font-bold" : "text-gray-200"}`}>{p[key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-[#12121B] border border-orange-500/30 p-4 sm:p-5 rounded-2xl">
              <h3 className="text-sm font-extrabold text-orange-300 uppercase tracking-wider mb-1">Controlli e decisioni</h3>
              <p className="text-xs text-gray-400 mb-3">Annota nel diario FC media degli ultimi 3 km e sforzo (1–10) di ogni controllo.</p>
              <div className="space-y-3">
                {GATES.map(g => (
                  <div key={g.when} className="rounded-xl border border-[#2A2A3D] bg-[#0E0E15] p-3">
                    <div className="font-bold text-white text-sm mb-2">{g.when}</div>
                    <div className="grid grid-cols-[2.4rem_1fr] gap-x-3 gap-y-1.5 text-sm items-start">
                      <span className="text-center text-xs font-extrabold rounded-md py-0.5 bg-teal-500/15 text-teal-300 border border-teal-500/40">A</span>
                      <span className="text-gray-100">{g.a}</span>
                      <span className="text-center text-xs font-extrabold rounded-md py-0.5 bg-yellow-500/15 text-yellow-300 border border-yellow-500/40">B</span>
                      <span className="text-gray-100">{g.b}</span>
                      <span className="text-center text-xs font-extrabold rounded-md py-0.5 bg-gray-500/15 text-gray-200 border border-gray-500/40">C</span>
                      <span className="text-gray-100">{g.c}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-300 mt-3">Se hai dovuto fermarti o camminare in un controllo, vai direttamente al C.</p>
            </div>

            <div className={`${CARD} p-4 sm:p-5`}>
              <h3 className={`${H3} mb-3`}>Strategia (obiettivo A, sul Garmin)</h3>
              <ul className="space-y-2.5 text-sm text-gray-300 leading-relaxed list-disc pl-5">
                <li><span className="text-white font-bold">Km 1–5: 5:41/km.</span> Mai più veloce. La FC salirà subito per l'adrenalina: ignorala.</li>
                <li><span className="text-white font-bold">Km 6–16: 5:36/km.</span> Sforzo 6–7 su 10. FC di controllo ≤ 178; se tocchi 180 prima del km 10 hai già pagato troppo.</li>
                <li><span className="text-white font-bold">Km 17–21,1:</span> tieni il ritmo. Se le gambe rispondono, accelera dal km 19; volata solo nell'ultimo km.</li>
                <li><span className="text-white font-bold">Regola unica:</span> nessun km sotto 5:31 prima del km 16. Nella tua ultima mezza i primi 5 km a 6:05 hanno preceduto il calo dei km 17–20.</li>
                <li><span className="text-white font-bold">Gel:</span> ai minuti 30, 60 e 90, subito prima dei ristori e con acqua. Solo prodotti già provati nei lunghi.</li>
                <li><span className="text-white font-bold">Colazione:</span> circa 3 ore prima, 80–100 g di carboidrati (pane bianco con marmellata e banana, oppure avena). Provala nei simulatori delle settimane 15 e 18.</li>
                <li><span className="text-white font-bold">Giorno prima:</span> 5–7 g di carboidrati per kg, pasto grande a pranzo, cena leggera. Niente fibre, fritti, alcol o novità.</li>
                <li><span className="text-white font-bold">Riscaldamento:</span> 8–10 minuti facili e 3 allunghi da 20 s. Nel test del 1° novembre sei partito a 5:09/km senza riscaldamento: non ripeterlo.</li>
                <li><span className="text-white font-bold">Garmin:</span> auto-lap a 1 km, schermata con ritmo del giro, FC media a 30 s, distanza e tempo.</li>
                <li><span className="text-white font-bold">Piano B:</span> se al km 10 sei già a 7–8 su 10, passa al ritmo dell'obiettivo B (5:48).</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* FORM REGISTRA CORSA */}
      {modal === "log" && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="log-title">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h3 id="log-title" className="text-xl font-black text-white uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {editingLog ? "Modifica la corsa" : "Registra la corsa"}
                </h3>
                {linkedRunForForm && (
                  <p className="text-sm text-gray-300 mt-1">{linkedRunForForm.title} · {linkedRunForForm.targetKm} km previsti</p>
                )}
              </div>
              <button onClick={() => setModal(null)} aria-label="Chiudi" className="shrink-0 w-9 h-9 rounded-lg text-gray-300 hover:text-white hover:bg-[#1C1C2B] bg-transparent border-none cursor-pointer text-lg">✕</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data">
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={INPUT} style={{ colorScheme: "dark" }} />
                </Field>
                <Field label="Distanza" error={formErrors.km}>
                  <UnitInput unit="km" type="text" inputMode="decimal" placeholder="10,5" autoFocus value={form.km}
                    onChange={e => setForm(p => ({ ...p, km: e.target.value.replace(/[^0-9.,]/g, "") }))} />
                </Field>
              </div>

              <Field label="Tempo" error={formErrors.time}>
                <div className="grid grid-cols-3 gap-2">
                  <UnitInput unit="ore" type="text" inputMode="numeric" maxLength={2} placeholder="0" value={form.hh}
                    onChange={e => setForm(p => ({ ...p, hh: clampInt(e.target.value, 9) }))} />
                  <UnitInput unit="min" type="text" inputMode="numeric" maxLength={3} placeholder="53" value={form.mm}
                    onChange={e => setForm(p => ({ ...p, mm: clampInt(e.target.value, 999) }))} />
                  <UnitInput unit="sec" type="text" inputMode="numeric" maxLength={2} placeholder="27" value={form.ss}
                    onChange={e => setForm(p => ({ ...p, ss: clampInt(e.target.value, 59) }))} />
                </div>
              </Field>

              <div className="flex items-baseline justify-between rounded-xl border border-[#34344C] bg-[#0E0E15] px-4 py-3">
                <span className={LABEL}>Ritmo medio</span>
                <span className="text-2xl font-black text-orange-400 tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {pacePreview}<span className="text-sm font-bold text-gray-400 ml-1">min/km</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="FC media (facoltativa)">
                  <UnitInput unit="bpm" type="text" inputMode="numeric" maxLength={3} placeholder="175" value={form.hr}
                    onChange={e => setForm(p => ({ ...p, hr: clampInt(e.target.value, 230) }))} />
                </Field>
                <Field label="Sforzo (facoltativo)">
                  <UnitInput unit="/10" type="text" inputMode="numeric" maxLength={2} placeholder="7" value={form.rpe}
                    onChange={e => setForm(p => ({ ...p, rpe: clampInt(e.target.value, 10) }))} />
                </Field>
              </div>

              <Field label="Note (facoltative)">
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                  placeholder="Gel (a che minuto), sensazioni, meteo, percorso…" className={`${INPUT} resize-y min-h-[84px]`} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <button onClick={() => setModal(null)} className={`${BTN_GHOST} py-3 text-base`}>Annulla</button>
              <button onClick={submitLog} className={`${BTN_PRIMARY} col-span-2 py-3 text-base`}>Salva corsa</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal max-w-sm text-center" role="dialog" aria-modal="true">
            <h4 className="text-lg font-bold text-white mb-1">Eliminare questa registrazione?</h4>
            <p className="text-sm text-gray-300 mb-5">L'azione non si può annullare.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteConfirm(null)} className={`${BTN_GHOST} py-3 text-base`}>Tieni</button>
              <button onClick={() => deleteLog(deleteConfirm)} className="bg-red-500 hover:bg-red-400 text-white font-extrabold py-3 text-base rounded-xl border-none cursor-pointer">Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
