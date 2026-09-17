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
  if (value === null || value === undefined) return null;
  return Number(value);
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  if (remaining === 0) return `${minutes} min`;

  return `${minutes}m ${remaining}s`;
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "—";

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining === 0
    ? `${hours}u`
    : `${hours}u ${remaining}m`;
}

export default function GymPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sets, setSets] = useState<GymSet[]>([]);
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>(
    []
  );

  const [activeSession, setActiveSession] = useState<GymSession | null>(null);

  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const [showExerciseForm, setShowExerciseForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [prMessage, setPrMessage] = useState("");

  async function loadData() {
    setLoading(true);

    try {
      const supabase = createClient();

      const [
        exerciseResult,
        setResult,
        sessionResult,
        sessionExerciseResult,
      ] = await Promise.all([
        supabase
          .from("gym_exercises")
          .select(`
            id,
            name,
            muscle_group,
            baseline_weight_kg,
            baseline_reps,
            baseline_note,
            baseline_duration_seconds,
            tracking_mode
          `)
          .order("muscle_group")
          .order("name"),

        supabase
          .from("gym_sets")
          .select(`
            id,
            session_id,
            exercise_id,
            exercise_name,
            set_number,
            reps,
            weight_kg,
            duration_seconds,
            created_at
          `)
          .order("created_at", {
            ascending: false,
          })
          .limit(1000),

        supabase
          .from("sport_sessions")
          .select(`
            id,
            started_at,
            duration_minutes
          `)
          .eq("sport_type", "gym")
          .order("started_at", {
            ascending: false,
          })
          .limit(100),

        supabase
          .from("gym_session_exercises")
          .select(`
            id,
            session_id,
            exercise_id
          `),
      ]);

      if (exerciseResult.error) {
        throw exerciseResult.error;
      }

      if (setResult.error) {
        throw setResult.error;
      }

      if (sessionResult.error) {
        throw sessionResult.error;
      }

      if (sessionExerciseResult.error) {
        throw sessionExerciseResult.error;
      }

      const exerciseRows = (exerciseResult.data ?? []).map((item) => ({
        ...item,

        baseline_weight_kg: numberOrNull(
          item.baseline_weight_kg
        ),

        baseline_reps: numberOrNull(
          item.baseline_reps
        ),

        baseline_duration_seconds: numberOrNull(
          item.baseline_duration_seconds
        ),
      })) as Exercise[];

      const setRows = (setResult.data ?? []).map((item) => ({
        ...item,

        reps: numberOrNull(item.reps),

        weight_kg: numberOrNull(
          item.weight_kg
        ),

        duration_seconds: numberOrNull(
          item.duration_seconds
        ),
      })) as GymSet[];

      const sessionRows = (sessionResult.data ?? []).map((item) => ({
        ...item,

        duration_minutes: numberOrNull(
          item.duration_minutes
        ),
      })) as GymSession[];

      setExercises(exerciseRows);
      setSets(setRows);
      setSessions(sessionRows);

      setSessionExercises(
        (sessionExerciseResult.data ?? []) as SessionExercise[]
      );

      setSelectedExerciseId((current) => {
        if (current) return current;

        return exerciseRows.length > 0
          ? exerciseRows[0].id
          : "";
      });

      const storedSessionId = localStorage.getItem(
        STORAGE_KEY
      );

      if (storedSessionId) {
        const session = sessionRows.find(
          (item) => item.id === storedSessionId
        );

        if (session) {
          setActiveSession(session);
        } else {
          localStorage.removeItem(
            STORAGE_KEY
          );

          setActiveSession(null);
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Gym Pro laden mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedExercise = useMemo(() => {
    return (
      exercises.find(
        (exercise) =>
          exercise.id === selectedExerciseId
      ) ?? null
    );
  }, [
    exercises,
    selectedExerciseId,
  ]);

  const currentSessionSets = useMemo(() => {
    if (!activeSession) {
      return [];
    }

    return sets
      .filter(
        (set) =>
          set.session_id === activeSession.id
      )
      .sort(
        (a, b) =>
          new Date(
            a.created_at
          ).getTime() -
          new Date(
            b.created_at
          ).getTime()
      );
  }, [
    sets,
    activeSession,
  ]);

  const currentExerciseIds = useMemo(() => {
    if (!activeSession) {
      return new Set<string>();
    }

    return new Set(
      sessionExercises
        .filter(
          (item) =>
            item.session_id ===
            activeSession.id
        )
        .map(
          (item) =>
            item.exercise_id
        )
    );
  }, [
    sessionExercises,
    activeSession,
  ]);

  const groupedExercises = useMemo(() => {
    return exercises.reduce<
      Record<string, Exercise[]>
    >(
      (groups, exercise) => {
        if (
          !groups[
            exercise.muscle_group
          ]
        ) {
          groups[
            exercise.muscle_group
          ] = [];
        }

        groups[
          exercise.muscle_group
        ].push(exercise);

        return groups;
      },
      {}
    );
  }, [exercises]);

  function getExerciseSets(
    exercise: Exercise
  ) {
    return sets.filter(
      (set) =>
        set.exercise_id ===
          exercise.id ||
        set.exercise_name ===
          exercise.name
    );
  }

  function getPreviousSets(
    exercise: Exercise
  ) {
    const history =
      getExerciseSets(
        exercise
      ).filter(
        (set) =>
          !activeSession ||
          set.session_id !==
            activeSession.id
      );

    if (
      history.length === 0
    ) {
      return [];
    }

    const previousSessionId =
      history[0].session_id;

    return history
      .filter(
        (set) =>
          set.session_id ===
          previousSessionId
      )
      .sort(
        (a, b) =>
          a.set_number -
          b.set_number
      );
  }

  function getPR(
    exercise: Exercise
  ) {
    const history =
      getExerciseSets(
        exercise
      );

    if (
      exercise.tracking_mode ===
      "time"
    ) {
      const best = Math.max(
        exercise.baseline_duration_seconds ??
          0,

        ...history.map(
          (set) =>
            set.duration_seconds ??
            0
        )
      );

      if (best === 0) {
        return "Nog geen PR";
      }

      return formatSeconds(
        best
      );
    }

    if (
      exercise.tracking_mode ===
      "bodyweight"
    ) {
      const best = Math.max(
        exercise.baseline_reps ??
          0,

        ...history.map(
          (set) =>
            set.reps ?? 0
        )
      );

      if (best === 0) {
        return (
          exercise.baseline_note ||
          "Nog geen PR"
        );
      }

      return `${best} reps`;
    }

    let bestWeight =
      exercise.baseline_weight_kg ??
      0;

    let bestReps =
      exercise.baseline_reps ??
      0;

    history.forEach(
      (set) => {
        const weight =
          set.weight_kg ?? 0;

        const reps =
          set.reps ?? 0;

        if (
          weight >
            bestWeight ||
          (weight ===
            bestWeight &&
            reps >
              bestReps)
        ) {
          bestWeight =
            weight;

          bestReps =
            reps;
        }
      }
    );

    if (
      bestWeight === 0
    ) {
      return (
        exercise.baseline_note ||
        "Nog geen PR"
      );
    }

    if (bestReps > 0) {
      return `${bestWeight} kg × ${bestReps}`;
    }

    return `${bestWeight} kg`;
  }

  function isNewPR(
    exercise: Exercise,
    weight: number | null,
    reps: number | null,
    duration: number | null
  ) {
    const history =
      getExerciseSets(
        exercise
      );

    if (
      exercise.tracking_mode ===
      "time"
    ) {
      if (
        duration === null
      ) {
        return false;
      }

      const oldBest =
        Math.max(
          exercise.baseline_duration_seconds ??
            0,

          ...history.map(
            (set) =>
              set.duration_seconds ??
              0
          )
        );

      return (
        duration > oldBest
      );
    }

    if (
      exercise.tracking_mode ===
      "bodyweight"
    ) {
      if (
        reps === null
      ) {
        return false;
      }

      const oldBest =
        Math.max(
          exercise.baseline_reps ??
            0,

          ...history.map(
            (set) =>
              set.reps ?? 0
          )
        );

      return (
        reps > oldBest
      );
    }

    if (
      weight === null
    ) {
      return false;
    }

    let bestWeight =
      exercise.baseline_weight_kg ??
      0;

    let bestReps =
      exercise.baseline_reps ??
      0;

    history.forEach(
      (set) => {
        const oldWeight =
          set.weight_kg ?? 0;

        const oldReps =
          set.reps ?? 0;

        if (
          oldWeight >
            bestWeight ||
          (oldWeight ===
            bestWeight &&
            oldReps >
              bestReps)
        ) {
          bestWeight =
            oldWeight;

          bestReps =
            oldReps;
        }
      }
    );

    return (
      weight >
        bestWeight ||
      (weight ===
        bestWeight &&
        (reps ?? 0) >
          bestReps)
    );
  }

  async function startTraining() {
    setSaving(true);

    setMessage("");

    setPrMessage("");

    try {
      const supabase =
        createClient();

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Je bent niet ingelogd."
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          "sport_sessions"
        )
        .insert({
          user_id:
            user.id,

          sport_type:
            "gym",

          started_at:
            new Date().toISOString(),
        })
        .select(
          `
          id,
          started_at,
          duration_minutes
          `
        )
        .single();

      if (error) {
        throw error;
      }

      const session: GymSession =
        {
          id: data.id,

          started_at:
            data.started_at,

          duration_minutes:
            null,
        };

      localStorage.setItem(
        STORAGE_KEY,
        session.id
      );

      setActiveSession(
        session
      );

      setMessage(
        "Gymtraining gestart 🔥"
      );

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Training starten mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  async function finishTraining() {
    if (!activeSession) {
      return;
    }

    setSaving(true);

    setMessage("");

    try {
      const duration =
        Math.max(
          1,

          Math.round(
            (Date.now() -
              new Date(
                activeSession.started_at
              ).getTime()) /
              60000
          )
        );

      const supabase =
        createClient();

      const { error } =
        await supabase
          .from(
            "sport_sessions"
          )
          .update({
            duration_minutes:
              duration,
          })
          .eq(
            "id",
            activeSession.id
          );

      if (error) {
        throw error;
      }

      const totalSets =
        currentSessionSets.length;

      const exerciseCount =
        currentExerciseIds.size;

      localStorage.removeItem(
        STORAGE_KEY
      );

      setActiveSession(
        null
      );

      setMessage(
        `Training afgerond ✓ · ${duration} min · ${exerciseCount} oefeningen · ${totalSets} sets`
      );

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Training afronden mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleExercise(
    exercise: Exercise
  ) {
    if (!activeSession) {
      return;
    }

    setSelectedExerciseId(
      exercise.id
    );

    const supabase =
      createClient();

    const existing =
      sessionExercises.find(
        (item) =>
          item.session_id ===
            activeSession.id &&
          item.exercise_id ===
            exercise.id
      );

    if (existing) {
      const setsForExercise =
        currentSessionSets.filter(
          (set) =>
            set.exercise_id ===
              exercise.id ||
            set.exercise_name ===
              exercise.name
        );

      if (
        setsForExercise.length >
        0
      ) {
        setMessage(
          `${exercise.name} heeft al sets in deze training en kan daarom niet worden uitgezet.`
        );

        return;
      }

      const { error } =
        await supabase
          .from(
            "gym_session_exercises"
          )
          .delete()
          .eq(
            "id",
            existing.id
          );

      if (error) {
        setMessage(
          error.message
        );

        return;
      }
    } else {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setMessage(
          "Je bent niet ingelogd."
        );

        return;
      }

      const { error } =
        await supabase
          .from(
            "gym_session_exercises"
          )
          .insert({
            user_id:
              user.id,

            session_id:
              activeSession.id,

            exercise_id:
              exercise.id,
          });

      if (error) {
        setMessage(
          error.message
        );

        return;
      }
    }

    setMessage("");

    await loadData();
  }

  async function applyTemplate(
    template: (typeof WORKOUT_TEMPLATES)[number]
  ) {
    if (!activeSession) {
      return;
    }

    setSaving(true);

    setMessage("");

    try {
      const templateExercises =
        exercises.filter(
          (exercise) =>
            template.muscleGroups.some(
              (group) =>
                group ===
                exercise.muscle_group
            )
        );

      if (
        templateExercises.length ===
        0
      ) {
        setMessage(
          "Geen oefeningen gevonden voor deze template."
        );

        return;
      }

      const supabase =
        createClient();

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Je bent niet ingelogd."
        );
      }

      const alreadySelected =
        new Set(
          sessionExercises
            .filter(
              (item) =>
                item.session_id ===
                activeSession.id
            )
            .map(
              (item) =>
                item.exercise_id
            )
        );

      const exercisesToAdd =
        templateExercises.filter(
          (exercise) =>
            !alreadySelected.has(
              exercise.id
            )
        );

      if (
        exercisesToAdd.length >
        0
      ) {
        const { error } =
          await supabase
            .from(
              "gym_session_exercises"
            )
            .insert(
              exercisesToAdd.map(
                (exercise) => ({
                  user_id:
                    user.id,

                  session_id:
                    activeSession.id,

                  exercise_id:
                    exercise.id,
                })
              )
            );

        if (error) {
          throw error;
        }
      }

      setSelectedExerciseId(
        templateExercises[0].id
      );

      setMessage(
        `${template.label} geselecteerd ✓ · ${templateExercises.length} oefeningen`
      );

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Template selecteren mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  async function clearExerciseSelection() {
    if (!activeSession) {
      return;
    }

    if (
      currentSessionSets.length >
      0
    ) {
      setMessage(
        "Je hebt al sets gelogd. Verwijder oefeningen daarom nu afzonderlijk."
      );

      return;
    }

    setSaving(true);

    setMessage("");

    try {
      const supabase =
        createClient();

      const { error } =
        await supabase
          .from(
            "gym_session_exercises"
          )
          .delete()
          .eq(
            "session_id",
            activeSession.id
          );

      if (error) {
        throw error;
      }

      setMessage(
        "Oefeningselectie leeggemaakt."
      );

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Selectie leegmaken mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  async function ensureExerciseSelected(
    exercise: Exercise
  ) {
    if (!activeSession) {
      return;
    }

    const alreadySelected =
      sessionExercises.some(
        (item) =>
          item.session_id ===
            activeSession.id &&
          item.exercise_id ===
            exercise.id
      );

    if (
      alreadySelected
    ) {
      return;
    }

    const supabase =
      createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return;
    }

    await supabase
      .from(
        "gym_session_exercises"
      )
      .insert({
        user_id:
          user.id,

        session_id:
          activeSession.id,

        exercise_id:
          exercise.id,
      });
  }

  async function addSet(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (
      !activeSession ||
      !selectedExercise
    ) {
      return;
    }

    setSaving(true);

    setMessage("");

    setPrMessage("");

    const formElement =
      e.currentTarget;

    const form =
      new FormData(
        formElement
      );

    const weightRaw =
      String(
        form.get("weight") ||
          ""
      ).trim();

    const repsRaw =
      String(
        form.get("reps") ||
          ""
      ).trim();

    const durationRaw =
      String(
        form.get("duration") ||
          ""
      ).trim();

    const weight =
      weightRaw
        ? Number(weightRaw)
        : null;

    const reps =
      repsRaw
        ? Number(repsRaw)
        : null;

    const duration =
      durationRaw
        ? Number(durationRaw)
        : null;

    try {
      const newPR =
        isNewPR(
          selectedExercise,
          weight,
          reps,
          duration
        );

      const previousSetsThisSession =
        currentSessionSets.filter(
          (set) =>
            set.exercise_id ===
              selectedExercise.id ||
            set.exercise_name ===
              selectedExercise.name
        );

      const supabase =
        createClient();

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Je bent niet ingelogd."
        );
      }

      await ensureExerciseSelected(
        selectedExercise
      );

      const { error } =
        await supabase
          .from(
            "gym_sets"
          )
          .insert({
            user_id:
              user.id,

            session_id:
              activeSession.id,

            exercise_id:
              selectedExercise.id,

            exercise_name:
              selectedExercise.name,

            set_number:
              previousSetsThisSession.length +
              1,

            reps,

            weight_kg:
              weight,

            duration_seconds:
              duration,
          });

      if (error) {
        throw error;
      }

      formElement.reset();

      if (newPR) {
        setPrMessage(
          `🏆 NIEUWE PR — ${selectedExercise.name}`
        );
      }

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Set opslaan mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(
    session: GymSession
  ) {
    const confirmed =
      window.confirm(
        "Weet je zeker dat je deze gymsessie wilt verwijderen? Alle sets uit deze sessie worden ook verwijderd."
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    setMessage("");

    try {
      const supabase =
        createClient();

      const { error } =
        await supabase
          .from(
            "sport_sessions"
          )
          .delete()
          .eq(
            "id",
            session.id
          );

      if (error) {
        throw error;
      }

      if (
        activeSession?.id ===
        session.id
      ) {
        localStorage.removeItem(
          STORAGE_KEY
        );

        setActiveSession(
          null
        );
      }

      setMessage(
        "Gymsessie verwijderd."
      );

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Verwijderen mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  async function addExercise(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setSaving(true);

    setMessage("");

    const formElement =
      e.currentTarget;

    const form =
      new FormData(
        formElement
      );

    const name =
      String(
        form.get("name") ||
          ""
      ).trim();

    const muscleGroup =
      String(
        form.get(
          "muscle_group"
        ) || "Overig"
      );

    const trackingMode =
      String(
        form.get(
          "tracking_mode"
        ) || "weight_reps"
      ) as TrackingMode;

    const weightRaw =
      String(
        form.get(
          "baseline_weight"
        ) || ""
      ).trim();

    const repsRaw =
      String(
        form.get(
          "baseline_reps"
        ) || ""
      ).trim();

    const durationRaw =
      String(
        form.get(
          "baseline_duration"
        ) || ""
      ).trim();

    const note =
      String(
        form.get(
          "baseline_note"
        ) || ""
      ).trim();

    if (!name) {
      setMessage(
        "Vul een naam in."
      );

      setSaving(false);

      return;
    }

    try {
      const supabase =
        createClient();

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Je bent niet ingelogd."
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          "gym_exercises"
        )
        .insert({
          user_id:
            user.id,

          name,

          muscle_group:
            muscleGroup,

          tracking_mode:
            trackingMode,

          baseline_weight_kg:
            weightRaw
              ? Number(weightRaw)
              : null,

          baseline_reps:
            repsRaw
              ? Number(repsRaw)
              : null,

          baseline_duration_seconds:
            durationRaw
              ? Number(durationRaw)
              : null,

          baseline_note:
            note || null,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      formElement.reset();

      setShowExerciseForm(
        false
      );

      setSelectedExerciseId(
        data.id
      );

      setMessage(
        `${name} toegevoegd ✓`
      );

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Oefening toevoegen mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  const previousSets =
    selectedExercise
      ? getPreviousSets(
          selectedExercise
        )
      : [];

  return (
    <>
      <div className="section-title">
        <div>
          <div className="subtle">
            Training tracker
          </div>

          <h1>Gym Pro</h1>
        </div>

        <Link
          href="/sport"
          className="btn"
        >
          ← Sport
        </Link>
      </div>

      {message && (
        <div
          className="notice"
          style={{
            marginBottom: 20,
          }}
        >
          {message}
        </div>
      )}

      {prMessage && (
        <div
          className="card"
          style={{
            marginBottom: 20,
          }}
        >
          <div
            className="big"
            style={{
              fontSize:
                "1.7rem",
            }}
          >
            {prMessage}
          </div>
        </div>
      )}

      <section className="grid two">
        <div className="card">
          <div className="subtle">
            Training
          </div>

          {activeSession ? (
            <>
              <h2>
                Bezig 🟢
              </h2>

              <div className="big">
                {
                  currentExerciseIds.size
                }
              </div>

              <p className="subtle">
                oefeningen geselecteerd
              </p>

              <div className="row">
                <span>
                  Sets
                </span>

                <strong>
                  {
                    currentSessionSets.length
                  }
                </strong>
              </div>

              <button
                className="btn"
                onClick={
                  finishTraining
                }
                disabled={
                  saving
                }
                style={{
                  marginTop: 16,
                }}
              >
                Training afronden
              </button>
            </>
          ) : (
            <>
              <h2>
                Klaar om te trainen?
              </h2>

              <p className="subtle">
                Start je sessie en kies daarna je workout.
              </p>

              <button
                className="btn"
                onClick={
                  startTraining
                }
                disabled={
                  saving ||
                  loading
                }
              >
                + Start gymtraining
              </button>
            </>
          )}
        </div>

        <div className="card">
          <div className="subtle">
            Jouw bibliotheek
          </div>

          <div className="big">
            {loading
              ? "..."
              : exercises.length}
          </div>

          <p className="subtle">
            oefeningen
          </p>

          <div className="list">
            <div className="row">
              <span>
                Geloggede sets
              </span>

              <strong>
                {sets.length}
              </strong>
            </div>

            <div className="row">
              <span>
                Gymtrainingen
              </span>

              <strong>
                {
                  sessions.length
                }
              </strong>
            </div>
          </div>
        </div>
      </section>

      {activeSession && (
        <>
          <div className="section-title">
            <div>
              <h2>
                Kies je workout
              </h2>

              <div className="subtle">
                Eén tik selecteert alle oefeningen uit die template.
              </div>
            </div>
          </div>

          <section className="grid">
            {WORKOUT_TEMPLATES.map(
              (template) => {
                const templateExercises =
                  exercises.filter(
                    (exercise) =>
                      template.muscleGroups.some(
                        (
                          group
                        ) =>
                          group ===
                          exercise.muscle_group
                      )
                  );

                const selectedCount =
                  templateExercises.filter(
                    (
                      exercise
                    ) =>
                      currentExerciseIds.has(
                        exercise.id
                      )
                  ).length;

                const completelySelected =
                  templateExercises.length >
                    0 &&
                  selectedCount ===
                    templateExercises.length;

                return (
                  <button
                    key={
                      template.key
                    }
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        template
                      )
                    }
                    disabled={
                      saving
                    }
                    className="card"
                    style={{
                      textAlign:
                        "left",

                      cursor:
                        "pointer",

                      border:
                        completelySelected
                          ? "2px solid #111827"
                          : undefined,
                    }}
                  >
                    <div className="metric">
                      <div>
                        <div className="subtle">
                          Template
                        </div>

                        <h3>
                          {
                            template.label
                          }
                        </h3>
                      </div>

                      <span className="pill">
                        {
                          templateExercises.length
                        }{" "}
                        oefeningen
                      </span>
                    </div>

                    <p className="subtle">
                      {
                        template.description
                      }
                    </p>

                    {selectedCount >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            10,
                        }}
                      >
                        <strong>
                          ✓{" "}
                          {
                            selectedCount
                          }
                          /
                          {
                            templateExercises.length
                          }{" "}
                          geselecteerd
                        </strong>
                      </div>
                    )}
                  </button>
                );
              }
            )}
          </section>

          {currentExerciseIds.size >
            0 && (
            <div
              style={{
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={
                  clearExerciseSelection
                }
                disabled={
                  saving
                }
              >
                Selectie leegmaken
              </button>
            </div>
          )}

          <div className="section-title">
            <div>
              <h2>
                Oefeningen aanpassen
              </h2>

              <div className="subtle">
                Tik een oefening aan om hem toe te voegen of weg te halen.
              </div>
            </div>
          </div>

          {Object.entries(
            groupedExercises
          ).map(
            ([
              group,
              items,
            ]) => (
              <div
                key={group}
                style={{
                  marginBottom:
                    20,
                }}
              >
                <h3>
                  {group}
                </h3>

                <div
                  className="card"
                  style={{
                    display:
                      "flex",

                    flexWrap:
                      "wrap",

                    gap: 10,
                  }}
                >
                  {items.map(
                    (
                      exercise
                    ) => {
                      const selected =
                        currentExerciseIds.has(
                          exercise.id
                        );

                      return (
                        <button
                          key={
                            exercise.id
                          }
                          type="button"
                          onClick={() =>
                            toggleExercise(
                              exercise
                            )
                          }
                          style={{
                            border:
                              selected
                                ? "2px solid #111827"
                                : "1px solid #d7dce3",

                            borderRadius:
                              999,

                            padding:
                              "10px 14px",

                            cursor:
                              "pointer",

                            fontWeight:
                              600,

                            background:
                              selected
                                ? "#111827"
                                : "white",

                            color:
                              selected
                                ? "white"
                                : "#111827",
                          }}
                        >
                          {selected
                            ? "✓ "
                            : "+ "}

                          {
                            exercise.name
                          }
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )
          )}

          <div className="section-title">
            <h2>
              Set toevoegen
            </h2>
          </div>

          <div className="card">
            <form
              className="form"
              onSubmit={
                addSet
              }
            >
              <div className="field">
                <label>
                  Oefening
                </label>

                <select
                  value={
                    selectedExerciseId
                  }
                  onChange={(
                    e
                  ) =>
                    setSelectedExerciseId(
                      e.target
                        .value
                    )
                  }
                  required
                >
                  {Object.entries(
                    groupedExercises
                  ).map(
                    ([
                      group,
                      items,
                    ]) => (
                      <optgroup
                        key={
                          group
                        }
                        label={
                          group
                        }
                      >
                        {items.map(
                          (
                            exercise
                          ) => (
                            <option
                              key={
                                exercise.id
                              }
                              value={
                                exercise.id
                              }
                            >
                              {
                                exercise.name
                              }
                            </option>
                          )
                        )}
                      </optgroup>
                    )
                  )}
                </select>
              </div>

              {selectedExercise && (
                <div className="notice">
                  <strong>
                    Huidige PR:{" "}
                    {getPR(
                      selectedExercise
                    )}
                  </strong>

                  {selectedExercise.baseline_note && (
                    <>
                      <br />

                      <span className="subtle">
                        Startwaarde:{" "}
                        {
                          selectedExercise.baseline_note
                        }
                      </span>
                    </>
                  )}

                  {previousSets.length >
                    0 && (
                    <>
                      <br />
                      <br />

                      <strong>
                        Vorige training
                      </strong>

                      <br />

                      <span className="subtle">
                        {previousSets
                          .map(
                            (
                              set
                            ) => {
                              if (
                                set.duration_seconds !==
                                null
                              ) {
                                return formatSeconds(
                                  set.duration_seconds
                                );
                              }

                              if (
                                selectedExercise.tracking_mode ===
                                "bodyweight"
                              ) {
                                return `${set.reps ?? 0} reps`;
                              }

                              return `${set.weight_kg ?? 0} kg × ${set.reps ?? "—"}`;
                            }
                          )
                          .join(
                            " · "
                          )}
                      </span>
                    </>
                  )}
                </div>
              )}

              {selectedExercise?.tracking_mode ===
              "time" ? (
                <div className="field">
                  <label>
                    Tijd in seconden
                  </label>

                  <input
                    name="duration"
                    type="number"
                    min="1"
                    required
                    placeholder="Bijv. 75"
                  />
                </div>
              ) : selectedExercise?.tracking_mode ===
                "bodyweight" ? (
                <>
                  <div className="field">
                    <label>
                      Reps
                    </label>

                    <input
                      name="reps"
                      type="number"
                      min="0"
                      required
                      placeholder="Bijv. 10"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Extra gewicht (optioneel)
                    </label>

                    <input
                      name="weight"
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Bijv. 5"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label>
                      Gewicht (kg)
                    </label>

                    <input
                      name="weight"
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      placeholder="Bijv. 25"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Reps
                    </label>

                    <input
                      name="reps"
                      type="number"
                      min="0"
                      required
                      placeholder="Bijv. 10"
                    />
                  </div>
                </>
              )}

              <button
                className="btn"
                type="submit"
                disabled={
                  saving ||
                  !selectedExercise
                }
              >
                {saving
                  ? "Opslaan..."
                  : "+ Set opslaan"}
              </button>
            </form>
          </div>

          <div className="section-title">
            <h2>
              Deze training
            </h2>
          </div>

          <div className="card">
            {currentExerciseIds.size ===
            0 ? (
              <p className="subtle">
                Kies hierboven een template of tik losse oefeningen aan.
              </p>
            ) : (
              <div className="list">
                {exercises
                  .filter(
                    (
                      exercise
                    ) =>
                      currentExerciseIds.has(
                        exercise.id
                      )
                  )
                  .map(
                    (
                      exercise
                    ) => {
                      const exerciseSets =
                        currentSessionSets.filter(
                          (
                            set
                          ) =>
                            set.exercise_id ===
                              exercise.id ||
                            set.exercise_name ===
                              exercise.name
                        );

                      return (
                        <div
                          className="row"
                          key={
                            exercise.id
                          }
                        >
                          <span>
                            <strong>
                              {
                                exercise.name
                              }
                            </strong>

                            <br />

                            <span className="subtle">
                              {
                                exerciseSets.length
                              }{" "}
                              sets
                            </span>
                          </span>

                          <strong>
                            ✓
                          </strong>
                        </div>
                      );
                    }
                  )}
              </div>
            )}
          </div>
        </>
      )}

      <div className="section-title">
        <h2>
          Recente gymsessies
        </h2>
      </div>

      <div className="card">
        {sessions.length ===
        0 ? (
          <p className="subtle">
            Nog geen gymsessies.
          </p>
        ) : (
          <div className="list">
            {sessions
              .slice(
                0,
                20
              )
              .map(
                (
                  session
                ) => {
                  const sessionSetCount =
                    sets.filter(
                      (
                        set
                      ) =>
                        set.session_id ===
                        session.id
                    ).length;

                  const exerciseCount =
                    sessionExercises.filter(
                      (
                        item
                      ) =>
                        item.session_id ===
                        session.id
                    ).length;

                  return (
                    <div
                      className="row"
                      key={
                        session.id
                      }
                    >
                      <span>
                        <strong>
                          {new Date(
                            session.started_at
                          ).toLocaleDateString(
                            "nl-NL",
                            {
                              weekday:
                                "short",

                              day:
                                "numeric",

                              month:
                                "short",
                            }
                          )}
                        </strong>

                        <br />

                        <span className="subtle">
                          {formatDuration(
                            session.duration_minutes
                          )}{" "}
                          ·{" "}
                          {
                            exerciseCount
                          }{" "}
                          oefeningen ·{" "}
                          {
                            sessionSetCount
                          }{" "}
                          sets
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          deleteSession(
                            session
                          )
                        }
                        disabled={
                          saving
                        }
                        style={{
                          border:
                            "1px solid #d7dce3",

                          borderRadius:
                            10,

                          padding:
                            "8px 12px",

                          cursor:
                            "pointer",

                          background:
                            "white",
                        }}
                      >
                        Verwijder
                      </button>
                    </div>
                  );
                }
              )}
          </div>
        )}
      </div>

      <div className="section-title">
        <div>
          <h2>
            Oefeningenbibliotheek
          </h2>

          <div className="subtle">
            Klik een oefening aan voor PR&apos;s en historie.
          </div>
        </div>

        <button
          className="btn"
          onClick={() =>
            setShowExerciseForm(
              (
                value
              ) => !value
            )
          }
        >
          {showExerciseForm
            ? "Annuleren"
            : "+ Oefening"}
        </button>
      </div>

      {showExerciseForm && (
        <div
          className="card"
          style={{
            marginBottom: 22,
          }}
        >
          <form
            className="form"
            onSubmit={
              addExercise
            }
          >
            <div className="field">
              <label>
                Naam
              </label>

              <input
                name="name"
                required
                placeholder="Bijv. Chest supported row"
              />
            </div>

            <div className="field">
              <label>
                Spiergroep
              </label>

              <select
                name="muscle_group"
                defaultValue="Overig"
              >
                <option>
                  Borst
                </option>

                <option>
                  Rug
                </option>

                <option>
                  Schouders
                </option>

                <option>
                  Biceps
                </option>

                <option>
                  Triceps
                </option>

                <option>
                  Benen
                </option>

                <option>
                  Core
                </option>

                <option>
                  Overig
                </option>
              </select>
            </div>

            <div className="field">
              <label>
                Hoe tracken?
              </label>

              <select
                name="tracking_mode"
                defaultValue="weight_reps"
              >
                <option value="weight_reps">
                  Gewicht + reps
                </option>

                <option value="bodyweight">
                  Lichaamsgewicht + reps
                </option>

                <option value="time">
                  Tijd
                </option>
              </select>
            </div>

            <div className="field">
              <label>
                Huidige PR gewicht (optioneel)
              </label>

              <input
                name="baseline_weight"
                type="number"
                step="0.5"
                min="0"
              />
            </div>

            <div className="field">
              <label>
                Huidige PR reps (optioneel)
              </label>

              <input
                name="baseline_reps"
                type="number"
                min="0"
              />
            </div>

            <div className="field">
              <label>
                Huidige PR tijd in seconden (optioneel)
              </label>

              <input
                name="baseline_duration"
                type="number"
                min="1"
              />
            </div>

            <div className="field">
              <label>
                Notitie (optioneel)
              </label>

              <input
                name="baseline_note"
                placeholder="Bijv. 24 kg per hand"
              />
            </div>

            <button
              className="btn"
              type="submit"
              disabled={
                saving
              }
            >
              {saving
                ? "Opslaan..."
                : "Oefening toevoegen"}
            </button>
          </form>
        </div>
      )}

      {Object.entries(
        groupedExercises
      ).map(
        ([
          group,
          items,
        ]) => (
          <div
            key={group}
            style={{
              marginBottom:
                22,
            }}
          >
            <h3>
              {group}
            </h3>

            <div className="card">
              <div className="list">
                {items.map(
                  (
                    exercise
                  ) => (
                    <Link
                      href={`/sport/gym/${exercise.id}`}
                      className="row"
                      key={
                        exercise.id
                      }
                    >
                      <span>
                        {
                          exercise.name
                        }
                      </span>

                      <strong>
                        {getPR(
                          exercise
                        )}{" "}
                        →
                      </strong>
                    </Link>
                  )
                )}
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
}
