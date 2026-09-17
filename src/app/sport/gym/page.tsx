"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TrackingMode = "weight_reps" | "bodyweight" | "time";

type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  baseline_weight_kg: number | null;
  baseline_reps: number | null;
  baseline_note: string | null;
  baseline_duration_seconds: number | null;
  tracking_mode: TrackingMode;
};

type GymSet = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  is_warmup: boolean;
  created_at: string;
};

type GymSession = {
  id: string;
  started_at: string;
  duration_minutes: number | null;
};

type SessionExercise = {
  id: string;
  session_id: string;
  exercise_id: string;
  completed_at: string | null;
};

type WorkoutSummary = {
  duration: number;
  exerciseCount: number;
  completedCount: number;
  workSetCount: number;
  warmupSetCount: number;
  prCount: number;
};

const STORAGE_KEY = "finn-os-active-gym-session";

const WORKOUT_TEMPLATES = [
  {
    key: "chest-tricep",
    label: "Chest + Tricep",
    description: "Borst en triceps",
    muscleGroups: ["Borst", "Triceps"],
  },
  {
    key: "rug-bicep",
    label: "Rug + Bicep",
    description: "Rug en biceps",
    muscleGroups: ["Rug", "Biceps"],
  },
  {
    key: "schouder-buik-overig",
    label: "Schouder + Buik + Overig",
    description: "Schouders, core, benen en overige oefeningen",
    muscleGroups: ["Schouders", "Core", "Benen", "Overig"],
  },
] as const;

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return Number(value);
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining === 0 ? `${minutes} min` : `${minutes}m ${remaining}s`;
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours}u` : `${hours}u ${remaining}m`;
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function GymPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sets, setSets] = useState<GymSet[]>([]);
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [activeSession, setActiveSession] = useState<GymSession | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [prMessage, setPrMessage] = useState("");
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setWeight, setSetWeight] = useState("");
  const [setReps, setSetReps] = useState("");
  const [setDuration, setSetDuration] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [lastSummary, setLastSummary] = useState<WorkoutSummary | null>(null);
  const [sessionPrCount, setSessionPrCount] = useState(0);

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [exerciseResult, setResult, sessionResult, sessionExerciseResult] = await Promise.all([
        supabase
          .from("gym_exercises")
          .select("id,name,muscle_group,baseline_weight_kg,baseline_reps,baseline_note,baseline_duration_seconds,tracking_mode")
          .order("muscle_group")
          .order("name"),
        supabase
          .from("gym_sets")
          .select("id,session_id,exercise_id,exercise_name,set_number,reps,weight_kg,duration_seconds,is_warmup,created_at")
          .order("created_at", { ascending: false })
          .limit(1500),
        supabase
          .from("sport_sessions")
          .select("id,started_at,duration_minutes")
          .eq("sport_type", "gym")
          .order("started_at", { ascending: false })
          .limit(100),
        supabase
          .from("gym_session_exercises")
          .select("id,session_id,exercise_id,completed_at")
          .order("created_at", { ascending: true }),
      ]);

      if (exerciseResult.error) throw exerciseResult.error;
      if (setResult.error) throw setResult.error;
      if (sessionResult.error) throw sessionResult.error;
      if (sessionExerciseResult.error) throw sessionExerciseResult.error;

      const exerciseRows = (exerciseResult.data ?? []).map((item) => ({
        ...item,
        baseline_weight_kg: numberOrNull(item.baseline_weight_kg),
        baseline_reps: numberOrNull(item.baseline_reps),
        baseline_duration_seconds: numberOrNull(item.baseline_duration_seconds),
      })) as Exercise[];

      const setRows = (setResult.data ?? []).map((item) => ({
        ...item,
        reps: numberOrNull(item.reps),
        weight_kg: numberOrNull(item.weight_kg),
        duration_seconds: numberOrNull(item.duration_seconds),
        is_warmup: Boolean(item.is_warmup),
      })) as GymSet[];

      const sessionRows = (sessionResult.data ?? []).map((item) => ({
        ...item,
        duration_minutes: numberOrNull(item.duration_minutes),
      })) as GymSession[];

      setExercises(exerciseRows);
      setSets(setRows);
      setSessions(sessionRows);
      setSessionExercises((sessionExerciseResult.data ?? []) as SessionExercise[]);

      const storedSessionId = localStorage.getItem(STORAGE_KEY);
      if (storedSessionId) {
        const session = sessionRows.find((item) => item.id === storedSessionId);
        if (session) setActiveSession(session);
        else {
          localStorage.removeItem(STORAGE_KEY);
          setActiveSession(null);
        }
      }

      setSelectedExerciseId((current) => {
        if (current && exerciseRows.some((exercise) => exercise.id === current)) return current;
        return exerciseRows[0]?.id ?? "";
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gym Pro laden mislukt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  useEffect(() => {
    if (restSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRestSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [restSeconds]);

  const selectedExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === selectedExerciseId) ?? null,
    [exercises, selectedExerciseId]
  );

  const currentSessionSets = useMemo(() => {
    if (!activeSession) return [];
    return sets
      .filter((set) => set.session_id === activeSession.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [sets, activeSession]);

  const currentSessionExerciseRows = useMemo(() => {
    if (!activeSession) return [];
    return sessionExercises.filter((item) => item.session_id === activeSession.id);
  }, [sessionExercises, activeSession]);

  const currentExerciseIds = useMemo(
    () => new Set(currentSessionExerciseRows.map((item) => item.exercise_id)),
    [currentSessionExerciseRows]
  );

  const completedExerciseIds = useMemo(
    () => new Set(currentSessionExerciseRows.filter((item) => item.completed_at).map((item) => item.exercise_id)),
    [currentSessionExerciseRows]
  );

  const selectedExercises = useMemo(
    () => exercises.filter((exercise) => currentExerciseIds.has(exercise.id)),
    [exercises, currentExerciseIds]
  );

  const groupedExercises = useMemo(() => {
    return exercises.reduce<Record<string, Exercise[]>>((groups, exercise) => {
      if (!groups[exercise.muscle_group]) groups[exercise.muscle_group] = [];
      groups[exercise.muscle_group].push(exercise);
      return groups;
    }, {});
  }, [exercises]);

  const workSetCount = currentSessionSets.filter((set) => !set.is_warmup).length;
  const warmupSetCount = currentSessionSets.filter((set) => set.is_warmup).length;
  const completedCount = completedExerciseIds.size;
  const progressPct = currentExerciseIds.size > 0 ? Math.round((completedCount / currentExerciseIds.size) * 100) : 0;
  const elapsedMs = activeSession ? nowTick - new Date(activeSession.started_at).getTime() : 0;

  function getExerciseSets(exercise: Exercise, excludeSetId?: string) {
    return sets.filter(
      (set) =>
        set.id !== excludeSetId &&
        !set.is_warmup &&
        (set.exercise_id === exercise.id || set.exercise_name === exercise.name)
    );
  }

  function getCurrentExerciseSets(exercise: Exercise) {
    if (!activeSession) return [];
    return currentSessionSets.filter(
      (set) => set.exercise_id === exercise.id || set.exercise_name === exercise.name
    );
  }

  function getPreviousSets(exercise: Exercise) {
    const history = getExerciseSets(exercise).filter(
      (set) => !activeSession || set.session_id !== activeSession.id
    );
    if (history.length === 0) return [];
    const previousSessionId = history[0].session_id;
    return history
      .filter((set) => set.session_id === previousSessionId)
      .sort((a, b) => a.set_number - b.set_number);
  }

  function getLastReferenceSet(exercise: Exercise) {
    const current = getCurrentExerciseSets(exercise);
    if (current.length > 0) return current[current.length - 1];
    const previous = getPreviousSets(exercise);
    if (previous.length > 0) return previous[previous.length - 1];
    return null;
  }

  function getPR(exercise: Exercise, excludeSetId?: string) {
    const history = getExerciseSets(exercise, excludeSetId);

    if (exercise.tracking_mode === "time") {
      const best = Math.max(
        exercise.baseline_duration_seconds ?? 0,
        ...history.map((set) => set.duration_seconds ?? 0)
      );
      return best > 0 ? formatSeconds(best) : "Nog geen PR";
    }

    if (exercise.tracking_mode === "bodyweight") {
      const best = Math.max(
        exercise.baseline_reps ?? 0,
        ...history.map((set) => set.reps ?? 0)
      );
      return best > 0 ? `${best} reps` : exercise.baseline_note || "Nog geen PR";
    }

    let bestWeight = exercise.baseline_weight_kg ?? 0;
    let bestReps = exercise.baseline_reps ?? 0;

    history.forEach((set) => {
      const weight = set.weight_kg ?? 0;
      const reps = set.reps ?? 0;
      if (weight > bestWeight || (weight === bestWeight && reps > bestReps)) {
        bestWeight = weight;
        bestReps = reps;
      }
    });

    if (bestWeight === 0) return exercise.baseline_note || "Nog geen PR";
    return bestReps > 0 ? `${bestWeight} kg × ${bestReps}` : `${bestWeight} kg`;
  }

  function isNewPR(
    exercise: Exercise,
    weight: number | null,
    reps: number | null,
    duration: number | null,
    warmup: boolean,
    excludeSetId?: string
  ) {
    if (warmup) return false;
    const history = getExerciseSets(exercise, excludeSetId);

    if (exercise.tracking_mode === "time") {
      if (duration === null) return false;
      const oldBest = Math.max(
        exercise.baseline_duration_seconds ?? 0,
        ...history.map((set) => set.duration_seconds ?? 0)
      );
      return duration > oldBest;
    }

    if (exercise.tracking_mode === "bodyweight") {
      if (reps === null) return false;
      const oldBest = Math.max(
        exercise.baseline_reps ?? 0,
        ...history.map((set) => set.reps ?? 0)
      );
      return reps > oldBest;
    }

    if (weight === null) return false;
    let bestWeight = exercise.baseline_weight_kg ?? 0;
    let bestReps = exercise.baseline_reps ?? 0;
    history.forEach((set) => {
      const oldWeight = set.weight_kg ?? 0;
      const oldReps = set.reps ?? 0;
      if (oldWeight > bestWeight || (oldWeight === bestWeight && oldReps > bestReps)) {
        bestWeight = oldWeight;
        bestReps = oldReps;
      }
    });
    return weight > bestWeight || (weight === bestWeight && (reps ?? 0) > bestReps);
  }

  function getProgressSuggestion(exercise: Exercise) {
    const previous = getPreviousSets(exercise);
    if (previous.length === 0) {
      if (exercise.tracking_mode === "time" && exercise.baseline_duration_seconds) {
        return `Start rond ${formatSeconds(exercise.baseline_duration_seconds)} en probeer +5 sec.`;
      }
      if (exercise.tracking_mode === "bodyweight" && exercise.baseline_reps) {
        return `Richt je op ${exercise.baseline_reps + 1} reps.`;
      }
      if (exercise.baseline_weight_kg) {
        return `Bouw gecontroleerd op richting je huidige PR van ${getPR(exercise)}.`;
      }
      return "Log eerst een training; daarna krijg je hier automatisch een doel.";
    }

    if (exercise.tracking_mode === "time") {
      const best = Math.max(...previous.map((set) => set.duration_seconds ?? 0));
      return `Vorige keer ${formatSeconds(best)}. Probeer vandaag ${formatSeconds(best + 5)}.`;
    }

    if (exercise.tracking_mode === "bodyweight") {
      const best = Math.max(...previous.map((set) => set.reps ?? 0));
      return `Vorige keer max ${best} reps. Probeer vandaag ${best + 1}.`;
    }

    let bestWeight = 0;
    let bestReps = 0;
    previous.forEach((set) => {
      const weight = set.weight_kg ?? 0;
      const reps = set.reps ?? 0;
      if (weight > bestWeight || (weight === bestWeight && reps > bestReps)) {
        bestWeight = weight;
        bestReps = reps;
      }
    });

    if (bestWeight === 0) return "Log eerst een bruikbare werkset.";
    if (bestReps >= 10) {
      return `Vorige beste set: ${bestWeight} kg × ${bestReps}. Probeer ${bestWeight + 2.5} kg voor 6–8 reps.`;
    }
    return `Vorige beste set: ${bestWeight} kg × ${bestReps}. Probeer ${bestWeight} kg × ${bestReps + 1}.`;
  }

  function fillFromReference(exercise: Exercise) {
    setEditingSetId(null);
    setIsWarmup(false);
    const reference = getLastReferenceSet(exercise);
    if (!reference) {
      setSetWeight("");
      setSetReps("");
      setSetDuration("");
      return;
    }
    setSetWeight(reference.weight_kg !== null ? String(reference.weight_kg) : "");
    setSetReps(reference.reps !== null ? String(reference.reps) : "");
    setSetDuration(reference.duration_seconds !== null ? String(reference.duration_seconds) : "");
  }

  function selectExercise(exercise: Exercise) {
    setSelectedExerciseId(exercise.id);
    fillFromReference(exercise);
    setPrMessage("");
  }

  async function startTraining() {
    setSaving(true);
    setMessage("");
    setPrMessage("");
    setLastSummary(null);
    setSessionPrCount(0);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Je bent niet ingelogd.");

      const { data, error } = await supabase
        .from("sport_sessions")
        .insert({ user_id: user.id, sport_type: "gym", started_at: new Date().toISOString() })
        .select("id,started_at,duration_minutes")
        .single();
      if (error) throw error;

      const session: GymSession = { id: data.id, started_at: data.started_at, duration_minutes: null };
      localStorage.setItem(STORAGE_KEY, session.id);
      setActiveSession(session);
      setNowTick(Date.now());
      setMessage("Gymtraining gestart 🔥");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Training starten mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function finishTraining() {
    if (!activeSession) return;
    setSaving(true);
    setMessage("");
    try {
      const duration = Math.max(1, Math.round((Date.now() - new Date(activeSession.started_at).getTime()) / 60000));
      const supabase = createClient();
      const { error } = await supabase
        .from("sport_sessions")
        .update({ duration_minutes: duration })
        .eq("id", activeSession.id);
      if (error) throw error;

      setLastSummary({
        duration,
        exerciseCount: currentExerciseIds.size,
        completedCount,
        workSetCount,
        warmupSetCount,
        prCount: sessionPrCount,
      });

      localStorage.removeItem(STORAGE_KEY);
      setActiveSession(null);
      setRestSeconds(0);
      setEditingSetId(null);
      setMessage("Training afgerond ✓");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Training afronden mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(session: GymSession) {
    const confirmed = window.confirm(
      activeSession?.id === session.id
        ? "Deze actieve gymsessie verwijderen? Alle geselecteerde oefeningen en sets uit deze sessie worden verwijderd."
        : "Deze gymsessie verwijderen? Alle sets uit deze sessie worden ook verwijderd."
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("sport_sessions").delete().eq("id", session.id);
      if (error) throw error;
      if (activeSession?.id === session.id) {
        localStorage.removeItem(STORAGE_KEY);
        setActiveSession(null);
        setRestSeconds(0);
      }
      setMessage("Gymsessie verwijderd.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verwijderen mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleExercise(exercise: Exercise) {
    if (!activeSession) return;
    setSelectedExerciseId(exercise.id);
    const supabase = createClient();
    const existing = currentSessionExerciseRows.find((item) => item.exercise_id === exercise.id);

    if (existing) {
      const hasSets = getCurrentExerciseSets(exercise).length > 0;
      if (hasSets) {
        setMessage(`${exercise.name} heeft al sets. Verwijder eerst die sets als je de oefening wilt weghalen.`);
        return;
      }
      const { error } = await supabase.from("gym_session_exercises").delete().eq("id", existing.id);
      if (error) {
        setMessage(error.message);
        return;
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage("Je bent niet ingelogd.");
        return;
      }
      const { error } = await supabase.from("gym_session_exercises").insert({
        user_id: user.id,
        session_id: activeSession.id,
        exercise_id: exercise.id,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      fillFromReference(exercise);
    }

    setMessage("");
    await loadData();
  }

  async function applyTemplate(template: (typeof WORKOUT_TEMPLATES)[number]) {
    if (!activeSession) return;
    setSaving(true);
    setMessage("");
    try {
      const templateExercises = exercises.filter((exercise) =>
        template.muscleGroups.some((group) => group === exercise.muscle_group)
      );
      if (templateExercises.length === 0) throw new Error("Geen oefeningen gevonden voor deze template.");

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Je bent niet ingelogd.");

      const exercisesToAdd = templateExercises.filter((exercise) => !currentExerciseIds.has(exercise.id));
      if (exercisesToAdd.length > 0) {
        const { error } = await supabase.from("gym_session_exercises").insert(
          exercisesToAdd.map((exercise) => ({
            user_id: user.id,
            session_id: activeSession.id,
            exercise_id: exercise.id,
          }))
        );
        if (error) throw error;
      }

      selectExercise(templateExercises[0]);
      setMessage(`${template.label} geselecteerd ✓ · ${templateExercises.length} oefeningen`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template selecteren mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function clearExerciseSelection() {
    if (!activeSession) return;
    if (currentSessionSets.length > 0) {
      setMessage("Je hebt al sets gelogd. Verwijder oefeningen daarom nu afzonderlijk.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("gym_session_exercises").delete().eq("session_id", activeSession.id);
      if (error) throw error;
      setMessage("Oefeningselectie leeggemaakt.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Selectie leegmaken mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleExerciseDone(exercise: Exercise) {
    if (!activeSession) return;
    const row = currentSessionExerciseRows.find((item) => item.exercise_id === exercise.id);
    if (!row) return;
    const nextValue = row.completed_at ? null : new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase.from("gym_session_exercises").update({ completed_at: nextValue }).eq("id", row.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadData();
  }

  async function ensureExerciseSelected(exercise: Exercise) {
    if (!activeSession || currentExerciseIds.has(exercise.id)) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Je bent niet ingelogd.");
    const { error } = await supabase.from("gym_session_exercises").insert({
      user_id: user.id,
      session_id: activeSession.id,
      exercise_id: exercise.id,
    });
    if (error) throw error;
  }

  function validateSetValues(exercise: Exercise, weight: number | null, reps: number | null, duration: number | null) {
    if (exercise.tracking_mode === "time" && (!duration || duration <= 0)) return "Vul een geldige tijd in.";
    if (exercise.tracking_mode === "bodyweight" && (reps === null || reps < 0)) return "Vul reps in.";
    if (exercise.tracking_mode === "weight_reps" && (weight === null || reps === null)) return "Vul gewicht en reps in.";
    return null;
  }

  async function saveSetValues(
    exercise: Exercise,
    weight: number | null,
    reps: number | null,
    duration: number | null,
    warmup: boolean,
    editId?: string
  ) {
    if (!activeSession) return;
    const validation = validateSetValues(exercise, weight, reps, duration);
    if (validation) throw new Error(validation);

    const newPR = isNewPR(exercise, weight, reps, duration, warmup, editId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Je bent niet ingelogd.");

    await ensureExerciseSelected(exercise);

    if (editId) {
      const { error } = await supabase
        .from("gym_sets")
        .update({ reps, weight_kg: weight, duration_seconds: duration, is_warmup: warmup })
        .eq("id", editId);
      if (error) throw error;
    } else {
      const number = Math.max(0, ...getCurrentExerciseSets(exercise).map((set) => set.set_number)) + 1;
      const { error } = await supabase.from("gym_sets").insert({
        user_id: user.id,
        session_id: activeSession.id,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        set_number: number,
        reps,
        weight_kg: weight,
        duration_seconds: duration,
        is_warmup: warmup,
      });
      if (error) throw error;
    }

    if (newPR) {
      setPrMessage(`🏆 NIEUWE PR — ${exercise.name}`);
      setSessionPrCount((current) => current + 1);
    } else {
      setPrMessage("");
    }

    if (!warmup) setRestSeconds(90);
  }

  async function addSet(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSession || !selectedExercise) return;
    setSaving(true);
    setMessage("");
    try {
      const weight = numberOrNull(setWeight);
      const reps = numberOrNull(setReps);
      const duration = numberOrNull(setDuration);
      await saveSetValues(selectedExercise, weight, reps, duration, isWarmup, editingSetId ?? undefined);
      setEditingSetId(null);
      setIsWarmup(false);
      await loadData();
      fillFromReference(selectedExercise);
      setMessage(editingSetId ? "Set aangepast ✓" : "Set opgeslagen ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Set opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function repeatLastSet() {
    if (!activeSession || !selectedExercise) return;
    const reference = getLastReferenceSet(selectedExercise);
    if (!reference) {
      setMessage("Er is nog geen vorige set om te herhalen.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await saveSetValues(
        selectedExercise,
        reference.weight_kg,
        reference.reps,
        reference.duration_seconds,
        reference.is_warmup
      );
      await loadData();
      setMessage("Vorige set herhaald ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Set herhalen mislukt.");
    } finally {
      setSaving(false);
    }
  }

  function beginEditSet(set: GymSet) {
    const exercise = exercises.find((item) => item.id === set.exercise_id || item.name === set.exercise_name);
    if (exercise) setSelectedExerciseId(exercise.id);
    setEditingSetId(set.id);
    setSetWeight(set.weight_kg !== null ? String(set.weight_kg) : "");
    setSetReps(set.reps !== null ? String(set.reps) : "");
    setSetDuration(set.duration_seconds !== null ? String(set.duration_seconds) : "");
    setIsWarmup(set.is_warmup);
    setMessage("Je bewerkt nu deze set.");
  }

  function cancelEdit() {
    setEditingSetId(null);
    setIsWarmup(false);
    if (selectedExercise) fillFromReference(selectedExercise);
    setMessage("");
  }

  async function deleteSet(set: GymSet) {
    const confirmed = window.confirm("Deze set verwijderen?");
    if (!confirmed) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("gym_sets").delete().eq("id", set.id);
      if (error) throw error;
      if (editingSetId === set.id) cancelEdit();
      setMessage("Set verwijderd.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Set verwijderen mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function addExercise(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const muscleGroup = String(form.get("muscle_group") || "Overig");
    const trackingMode = String(form.get("tracking_mode") || "weight_reps") as TrackingMode;
    const weight = numberOrNull(form.get("baseline_weight"));
    const reps = numberOrNull(form.get("baseline_reps"));
    const duration = numberOrNull(form.get("baseline_duration"));
    const note = String(form.get("baseline_note") || "").trim();
    if (!name) {
      setMessage("Vul een naam in.");
      setSaving(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Je bent niet ingelogd.");
      const { data, error } = await supabase
        .from("gym_exercises")
        .insert({
          user_id: user.id,
          name,
          muscle_group: muscleGroup,
          tracking_mode: trackingMode,
          baseline_weight_kg: weight,
          baseline_reps: reps,
          baseline_duration_seconds: duration,
          baseline_note: note || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      formElement.reset();
      setShowExerciseForm(false);
      setSelectedExerciseId(data.id);
      setMessage(`${name} toegevoegd ✓`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Oefening toevoegen mislukt.");
    } finally {
      setSaving(false);
    }
  }

  const previousSets = selectedExercise ? getPreviousSets(selectedExercise) : [];
  const selectedCurrentSets = selectedExercise ? getCurrentExerciseSets(selectedExercise) : [];
  const lastReferenceSet = selectedExercise ? getLastReferenceSet(selectedExercise) : null;

  return (
    <>
      <div className="section-title">
        <div>
          <div className="subtle">Training tracker</div>
          <h1>Gym Pro</h1>
        </div>
        <Link href="/sport" className="btn">← Sport</Link>
      </div>

      {message && <div className="notice" style={{ marginBottom: 16 }}>{message}</div>}
      {prMessage && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="big" style={{ fontSize: "1.5rem" }}>{prMessage}</div>
        </div>
      )}

      {lastSummary && !activeSession && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="subtle">Laatste workout</div>
          <h2>Training afgerond 🎉</h2>
          <div className="grid">
            <div><strong>{lastSummary.duration} min</strong><div className="subtle">duur</div></div>
            <div><strong>{lastSummary.completedCount}/{lastSummary.exerciseCount}</strong><div className="subtle">oefeningen klaar</div></div>
            <div><strong>{lastSummary.workSetCount}</strong><div className="subtle">werksets</div></div>
            <div><strong>{lastSummary.prCount}</strong><div className="subtle">PR&apos;s</div></div>
          </div>
        </div>
      )}

      <section className="grid two">
        <div className="card">
          <div className="subtle">Training</div>
          {activeSession ? (
            <>
              <div className="metric">
                <div>
                  <h2>Bezig 🟢</h2>
                  <div className="big">{formatElapsed(elapsedMs)}</div>
                </div>
                <span className="pill">{progressPct}% klaar</span>
              </div>
              <div style={{ height: 8, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", margin: "12px 0 16px" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", background: "#111827" }} />
              </div>
              <div className="list">
                <div className="row"><span>Oefeningen</span><strong>{completedCount}/{currentExerciseIds.size}</strong></div>
                <div className="row"><span>Werksets</span><strong>{workSetCount}</strong></div>
                <div className="row"><span>Warm-up sets</span><strong>{warmupSetCount}</strong></div>
                <div className="row"><span>PR&apos;s deze sessie</span><strong>{sessionPrCount}</strong></div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <button className="btn" onClick={finishTraining} disabled={saving}>Training afronden</button>
                <button className="btn" onClick={() => deleteSession(activeSession)} disabled={saving}>Sessie verwijderen</button>
              </div>
            </>
          ) : (
            <>
              <h2>Klaar om te trainen?</h2>
              <p className="subtle">Start je sessie, kies je template en log je sets zo snel mogelijk.</p>
              <button className="btn" onClick={startTraining} disabled={saving || loading}>+ Start gymtraining</button>
            </>
          )}
        </div>

        <div className="card">
          <div className="subtle">Jouw bibliotheek</div>
          <div className="big">{loading ? "..." : exercises.length}</div>
          <p className="subtle">oefeningen</p>
          <div className="list">
            <div className="row"><span>Geloggede sets</span><strong>{sets.length}</strong></div>
            <div className="row"><span>Gymtrainingen</span><strong>{sessions.length}</strong></div>
          </div>
        </div>
      </section>

      {activeSession && (
        <>
          {restSeconds > 0 && (
            <div className="card" style={{ marginTop: 18, position: "sticky", top: 10, zIndex: 5 }}>
              <div className="metric">
                <div>
                  <div className="subtle">Rusttimer</div>
                  <div className="big">{formatSeconds(restSeconds)}</div>
                </div>
                <button className="btn" onClick={() => setRestSeconds(0)}>Stop</button>
              </div>
            </div>
          )}

          <div className="section-title">
            <div>
              <h2>1. Kies je workout</h2>
              <div className="subtle">Eén tik selecteert alle oefeningen uit die template. Daarna kun je losse oefeningen aanpassen.</div>
            </div>
          </div>

          <section className="grid">
            {WORKOUT_TEMPLATES.map((template) => {
              const templateExercises = exercises.filter((exercise) =>
                template.muscleGroups.some((group) => group === exercise.muscle_group)
              );
              const selectedCount = templateExercises.filter((exercise) => currentExerciseIds.has(exercise.id)).length;
              return (
                <button
                  key={template.key}
                  type="button"
                  className="card"
                  onClick={() => applyTemplate(template)}
                  disabled={saving}
                  style={{ textAlign: "left", cursor: "pointer" }}
                >
                  <div className="metric">
                    <div>
                      <div className="subtle">Template</div>
                      <h3>{template.label}</h3>
                    </div>
                    <span className="pill">{selectedCount}/{templateExercises.length}</span>
                  </div>
                  <p className="subtle">{template.description}</p>
                </button>
              );
            })}
          </section>

          {currentExerciseIds.size > 0 && currentSessionSets.length === 0 && (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={clearExerciseSelection} disabled={saving}>Selectie leegmaken</button>
            </div>
          )}

          <div className="section-title">
            <div>
              <h2>2. Jouw oefeningen</h2>
              <div className="subtle">Selecteer een oefening om sets te loggen. Markeer hem klaar wanneer je ermee klaar bent.</div>
            </div>
          </div>

          {selectedExercises.length === 0 ? (
            <div className="card"><p className="subtle">Kies eerst een template of voeg hieronder losse oefeningen toe.</p></div>
          ) : (
            <div className="card" style={{ display: "grid", gap: 10 }}>
              {selectedExercises.map((exercise) => {
                const done = completedExerciseIds.has(exercise.id);
                const exerciseSets = getCurrentExerciseSets(exercise);
                const workSets = exerciseSets.filter((set) => !set.is_warmup).length;
                const active = selectedExerciseId === exercise.id;
                return (
                  <div key={exercise.id} style={{ border: active ? "2px solid #111827" : "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}>
                    <button
                      type="button"
                      onClick={() => selectExercise(exercise)}
                      style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
                    >
                      <div className="metric">
                        <div>
                          <strong>{done ? "✓ " : ""}{exercise.name}</strong>
                          <div className="subtle">{workSets} werksets · PR {getPR(exercise)}</div>
                        </div>
                        <span className="pill">{active ? "Actief" : "Open"}</span>
                      </div>
                    </button>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button type="button" className="btn" onClick={() => selectExercise(exercise)}>Log set</button>
                      <button type="button" className="btn" onClick={() => toggleExerciseDone(exercise)}>{done ? "Heropen" : "Klaar ✓"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="section-title">
            <div>
              <h2>3. Fast Set Logger</h2>
              <div className="subtle">Vorige waarden worden automatisch klaargezet.</div>
            </div>
          </div>

          <div className="card">
            {!selectedExercise ? (
              <p className="subtle">Selecteer eerst een oefening.</p>
            ) : (
              <>
                <div className="metric">
                  <div>
                    <div className="subtle">Actieve oefening</div>
                    <h2>{selectedExercise.name}</h2>
                  </div>
                  <Link href={`/sport/gym/${selectedExercise.id}`} className="btn">Historie →</Link>
                </div>

                <div className="notice" style={{ marginBottom: 14 }}>
                  <strong>PR: {getPR(selectedExercise, editingSetId ?? undefined)}</strong>
                  <br />
                  <span className="subtle">🎯 {getProgressSuggestion(selectedExercise)}</span>
                  {previousSets.length > 0 && (
                    <>
                      <br /><br />
                      <strong>Vorige training</strong><br />
                      <span className="subtle">
                        {previousSets.map((set) => {
                          if (set.duration_seconds !== null) return formatSeconds(set.duration_seconds);
                          if (selectedExercise.tracking_mode === "bodyweight") {
                            return `${set.reps ?? 0} reps${set.weight_kg ? ` + ${set.weight_kg} kg` : ""}`;
                          }
                          return `${set.weight_kg ?? 0} kg × ${set.reps ?? "—"}`;
                        }).join(" · ")}
                      </span>
                    </>
                  )}
                </div>

                <form className="form" onSubmit={addSet}>
                  {selectedExercise.tracking_mode === "time" ? (
                    <div className="field">
                      <label>Tijd in seconden</label>
                      <input value={setDuration} onChange={(e) => setSetDuration(e.target.value)} type="number" min="1" inputMode="numeric" placeholder="Bijv. 75" required />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <button type="button" className="btn" onClick={() => setSetDuration(String(Math.max(1, Number(setDuration || 0) - 5)))}>−5 sec</button>
                        <button type="button" className="btn" onClick={() => setSetDuration(String(Number(setDuration || 0) + 5))}>+5 sec</button>
                      </div>
                    </div>
                  ) : selectedExercise.tracking_mode === "bodyweight" ? (
                    <>
                      <div className="field">
                        <label>Reps</label>
                        <input value={setReps} onChange={(e) => setSetReps(e.target.value)} type="number" min="0" inputMode="numeric" required />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          <button type="button" className="btn" onClick={() => setSetReps(String(Math.max(0, Number(setReps || 0) - 1)))}>−1 rep</button>
                          <button type="button" className="btn" onClick={() => setSetReps(String(Number(setReps || 0) + 1))}>+1 rep</button>
                        </div>
                      </div>
                      <div className="field">
                        <label>Extra gewicht (optioneel)</label>
                        <input value={setWeight} onChange={(e) => setSetWeight(e.target.value)} type="number" step="0.5" min="0" inputMode="decimal" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label>Gewicht (kg)</label>
                        <input value={setWeight} onChange={(e) => setSetWeight(e.target.value)} type="number" step="0.5" min="0" inputMode="decimal" required />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          <button type="button" className="btn" onClick={() => setSetWeight(String(Math.max(0, Number(setWeight || 0) - 2.5)))}>−2,5 kg</button>
                          <button type="button" className="btn" onClick={() => setSetWeight(String(Number(setWeight || 0) + 2.5))}>+2,5 kg</button>
                        </div>
                      </div>
                      <div className="field">
                        <label>Reps</label>
                        <input value={setReps} onChange={(e) => setSetReps(e.target.value)} type="number" min="0" inputMode="numeric" required />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          <button type="button" className="btn" onClick={() => setSetReps(String(Math.max(0, Number(setReps || 0) - 1)))}>−1 rep</button>
                          <button type="button" className="btn" onClick={() => setSetReps(String(Number(setReps || 0) + 1))}>+1 rep</button>
                        </div>
                      </div>
                    </>
                  )}

                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" checked={isWarmup} onChange={(e) => setIsWarmup(e.target.checked)} />
                    Warm-up set — telt niet mee voor PR
                  </label>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn" type="submit" disabled={saving}>{saving ? "Opslaan..." : editingSetId ? "Wijzig set" : "+ Set opslaan"}</button>
                    {lastReferenceSet && !editingSetId && (
                      <button type="button" className="btn" onClick={repeatLastSet} disabled={saving}>↻ Herhaal laatste set</button>
                    )}
                    {editingSetId && <button type="button" className="btn" onClick={cancelEdit}>Annuleren</button>}
                  </div>
                </form>

                <div style={{ marginTop: 18 }}>
                  <div className="subtle">Rusttimer starten</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {[60, 90, 120, 180].map((seconds) => (
                      <button key={seconds} type="button" className="btn" onClick={() => setRestSeconds(seconds)}>{seconds < 60 ? `${seconds}s` : `${seconds / 60} min`}</button>
                    ))}
                  </div>
                </div>

                <div className="section-title" style={{ marginTop: 22 }}>
                  <h3>Sets deze training</h3>
                </div>

                {selectedCurrentSets.length === 0 ? (
                  <p className="subtle">Nog geen sets voor deze oefening.</p>
                ) : (
                  <div className="list">
                    {selectedCurrentSets.map((set, index) => (
                      <div className="row" key={set.id}>
                        <span>
                          <strong>{set.is_warmup ? "Warm-up" : `Set ${index + 1}`}</strong><br />
                          <span className="subtle">
                            {set.duration_seconds !== null
                              ? formatSeconds(set.duration_seconds)
                              : selectedExercise.tracking_mode === "bodyweight"
                                ? `${set.reps ?? 0} reps${set.weight_kg ? ` + ${set.weight_kg} kg` : ""}`
                                : `${set.weight_kg ?? 0} kg × ${set.reps ?? "—"}`}
                          </span>
                        </span>
                        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="btn" onClick={() => beginEditSet(set)}>Wijzig</button>
                          <button type="button" className="btn" onClick={() => deleteSet(set)}>Verwijder</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="section-title">
            <div>
              <h2>Losse oefeningen aanpassen</h2>
              <div className="subtle">Alleen nodig als je template vandaag net anders is.</div>
            </div>
            <button className="btn" type="button" onClick={() => setShowAllExercises((value) => !value)}>{showAllExercises ? "Verbergen" : "Toon alle oefeningen"}</button>
          </div>

          {showAllExercises && Object.entries(groupedExercises).map(([group, items]) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <h3>{group}</h3>
              <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {items.map((exercise) => {
                  const selected = currentExerciseIds.has(exercise.id);
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => toggleExercise(exercise)}
                      style={{
                        border: selected ? "2px solid #111827" : "1px solid #d7dce3",
                        borderRadius: 999,
                        padding: "10px 14px",
                        cursor: "pointer",
                        fontWeight: 600,
                        background: selected ? "#111827" : "white",
                        color: selected ? "white" : "#111827",
                      }}
                    >
                      {selected ? "✓ " : "+ "}{exercise.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-title"><h2>Recente gymsessies</h2></div>
      <div className="card">
        {sessions.length === 0 ? (
          <p className="subtle">Nog geen gymsessies.</p>
        ) : (
          <div className="list">
            {sessions.slice(0, 20).map((session) => {
              const sessionSets = sets.filter((set) => set.session_id === session.id);
              const exerciseCount = sessionExercises.filter((item) => item.session_id === session.id).length;
              const workSets = sessionSets.filter((set) => !set.is_warmup).length;
              return (
                <div className="row" key={session.id}>
                  <span>
                    <strong>{new Date(session.started_at).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}</strong><br />
                    <span className="subtle">{formatDuration(session.duration_minutes)} · {exerciseCount} oefeningen · {workSets} werksets</span>
                  </span>
                  <button type="button" className="btn" onClick={() => deleteSession(session)} disabled={saving}>Verwijder</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="section-title">
        <div>
          <h2>Oefeningenbibliotheek</h2>
          <div className="subtle">PR&apos;s, historie en eigen oefeningen.</div>
        </div>
        <button className="btn" onClick={() => setShowExerciseForm((value) => !value)}>{showExerciseForm ? "Annuleren" : "+ Oefening"}</button>
      </div>

      {showExerciseForm && (
        <div className="card" style={{ marginBottom: 22 }}>
          <form className="form" onSubmit={addExercise}>
            <div className="field"><label>Naam</label><input name="name" required placeholder="Bijv. Chest supported row" /></div>
            <div className="field">
              <label>Spiergroep</label>
              <select name="muscle_group" defaultValue="Overig">
                <option>Borst</option><option>Rug</option><option>Schouders</option><option>Biceps</option><option>Triceps</option><option>Benen</option><option>Core</option><option>Overig</option>
              </select>
            </div>
            <div className="field">
              <label>Hoe tracken?</label>
              <select name="tracking_mode" defaultValue="weight_reps">
                <option value="weight_reps">Gewicht + reps</option><option value="bodyweight">Lichaamsgewicht + reps</option><option value="time">Tijd</option>
              </select>
            </div>
            <div className="field"><label>Huidige PR gewicht (optioneel)</label><input name="baseline_weight" type="number" step="0.5" min="0" /></div>
            <div className="field"><label>Huidige PR reps (optioneel)</label><input name="baseline_reps" type="number" min="0" /></div>
            <div className="field"><label>Huidige PR tijd in seconden (optioneel)</label><input name="baseline_duration" type="number" min="1" /></div>
            <div className="field"><label>Notitie (optioneel)</label><input name="baseline_note" placeholder="Bijv. 24 kg per hand" /></div>
            <button className="btn" type="submit" disabled={saving}>{saving ? "Opslaan..." : "Oefening toevoegen"}</button>
          </form>
        </div>
      )}

      {Object.entries(groupedExercises).map(([group, items]) => (
        <div key={group} style={{ marginBottom: 22 }}>
          <h3>{group}</h3>
          <div className="card">
            <div className="list">
              {items.map((exercise) => (
                <Link href={`/sport/gym/${exercise.id}`} className="row" key={exercise.id}>
                  <span>{exercise.name}</span>
                  <strong>{getPR(exercise)} →</strong>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
