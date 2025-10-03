import React, { useEffect, useMemo, useState } from "react";
import {
  getDoctorPreferences,
  saveDoctorPreferences,
  DoctorPreferencesResponse,
} from "../services/patientService";
import { Slider } from "../components/ui/slider";

const MIN_Q = 1;
const MAX_Q = 10;

const DoctorPreferences: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [doctorId, setDoctorId] = useState<string>("");
  const [globalCategories, setGlobalCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [maxQuestions, setMaxQuestions] = useState<number>(6);
  const [newCategory, setNewCategory] = useState<string>("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const pref: DoctorPreferencesResponse = await getDoctorPreferences();
        if (!mounted) return;
        setDoctorId(pref.doctor_id);
        setGlobalCategories(pref.global_categories || []);
        setSelectedCategories(new Set(pref.selected_categories || []));
        setMaxQuestions(
          Math.max(MIN_Q, Math.min(MAX_Q, Number(pref.max_questions) || 6))
        );
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load preferences.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const categoriesSorted = useMemo(() => {
    return [...globalCategories].sort((a, b) => a.localeCompare(b));
  }, [globalCategories]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const persist = async (cats: string[], maxQ: number, globals?: string[]) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveDoctorPreferences({ categories: cats, max_questions: maxQ, global_categories: globals });
      setSuccess("Preferences saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    const raw = newCategory.trim();
    if (!raw) return;
    const cat = raw.toLowerCase();
    if (globalCategories.includes(cat)) {
      // just select if already exists
      setSelectedCategories((prev) => new Set(prev).add(cat));
      setNewCategory("");
      await persist(Array.from(new Set([...selectedCategories, cat] as any)), maxQuestions);
      return;
    }
    const nextGlobals = [...globalCategories, cat];
    setGlobalCategories(nextGlobals);
    const nextSelected = new Set(selectedCategories);
    nextSelected.add(cat);
    setSelectedCategories(nextSelected);
    setNewCategory("");
    await persist(Array.from(nextSelected), maxQuestions, nextGlobals);
  };

  const handleSave = async () => {
    await persist(Array.from(selectedCategories), maxQuestions, globalCategories);
  };

  const handleRemoveCategory = async (cat: string) => {
    const nextGlobals = globalCategories.filter((c) => c !== cat);
    setGlobalCategories(nextGlobals);
    const nextSelected = new Set(selectedCategories);
    if (nextSelected.has(cat)) nextSelected.delete(cat);
    setSelectedCategories(nextSelected);
    await persist(Array.from(nextSelected), maxQuestions, nextGlobals);
  };

  const startEditCategory = (cat: string) => {
    setEditingCat(cat);
    setEditingValue(cat);
  };

  const cancelEdit = () => {
    setEditingCat(null);
    setEditingValue("");
  };

  const confirmEditCategory = async () => {
    if (!editingCat) return;
    const newRaw = editingValue.trim();
    if (!newRaw) {
      cancelEdit();
      return;
    }
    const newCat = newRaw.toLowerCase();
    if (newCat === editingCat) {
      cancelEdit();
      return;
    }
    // If target name already exists, just remove old and select existing
    let nextGlobals = globalCategories;
    if (!globalCategories.includes(newCat)) {
      nextGlobals = globalCategories.map((c) => (c === editingCat ? newCat : c));
    } else {
      nextGlobals = globalCategories.filter((c) => c !== editingCat);
    }
    setGlobalCategories(nextGlobals);

    const nextSelected = new Set(selectedCategories);
    if (nextSelected.has(editingCat)) {
      nextSelected.delete(editingCat);
      nextSelected.add(newCat);
    }
    setSelectedCategories(nextSelected);
    cancelEdit();
    await persist(Array.from(nextSelected), maxQuestions, nextGlobals);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="medical-card max-w-xl w-full text-center">Loading preferences…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold">Doctor Preferences</h1>
          {doctorId && (
            <p className="text-xs text-gray-500 mt-1">Doctor ID: {doctorId}</p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {error && (
          <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>
        )}
        {success && (
          <div className="p-3 rounded border border-green-200 bg-green-50 text-green-800 text-sm">{success}</div>
        )}

        <section className="medical-card">
          <h2 className="text-lg font-semibold mb-3">Categories</h2>
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Add new category (e.g., diet)"
              className="medical-input flex-1"
            />
            <button
              onClick={handleAddCategory}
              disabled={saving || !newCategory.trim()}
              className="medical-button whitespace-nowrap"
            >
              Add
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {categoriesSorted.map((cat) => (
              <div key={cat} className="flex items-center gap-2 text-sm border rounded-md p-2 bg-white">
                <input
                  type="checkbox"
                  checked={selectedCategories.has(cat)}
                  onChange={() => toggleCategory(cat)}
                />
                {editingCat === cat ? (
                  <>
                    <input
                      className="medical-input flex-1"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmEditCategory();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <button
                      className="px-2 py-1 bg-emerald-600 text-white rounded"
                      onClick={confirmEditCategory}
                      disabled={saving}
                    >
                      Save
                    </button>
                    <button
                      className="px-2 py-1 bg-gray-200 rounded"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="capitalize flex-1 truncate">{cat}</span>
                    <button
                      className="px-2 py-1 bg-blue-600 text-white rounded"
                      onClick={() => startEditCategory(cat)}
                      disabled={saving}
                    >
                      Edit
                    </button>
                    <button
                      className="h-7 w-7 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 disabled:opacity-60"
                      onClick={() => handleRemoveCategory(cat)}
                      disabled={saving}
                      aria-label={`Remove ${cat}`}
                      title="Remove"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="medical-card">
          <h2 className="text-lg font-semibold mb-3">Max Questions</h2>
          <div className="space-y-4">
            <div className="relative px-2 pt-6">
              <Slider
                value={[maxQuestions]}
                min={MIN_Q}
                max={MAX_Q}
                step={1}
                onValueChange={(vals) => {
                  const v = Number(vals?.[0] ?? MIN_Q);
                  setMaxQuestions(Math.max(MIN_Q, Math.min(MAX_Q, v)));
                }}
              />
              {/* Tick numbers along the track */}
              <div className="relative mt-3 h-5 select-none">
                {[...Array(MAX_Q - MIN_Q + 1)].map((_, idx) => {
                  const v = MIN_Q + idx;
                  const pct = ((v - MIN_Q) / (MAX_Q - MIN_Q)) * 100;
                  const active = v === maxQuestions;
                  return (
                    <span
                      key={v}
                      className={`absolute -translate-x-1/2 text-[10px] leading-none ${active ? "font-semibold text-gray-900" : "text-gray-500"}`}
                      style={{ left: `${pct}%` }}
                    >
                      {v}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={MIN_Q}
                max={MAX_Q}
                className="w-20 medical-input"
                value={maxQuestions}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setMaxQuestions(Math.max(MIN_Q, Math.min(MAX_Q, n)));
                }}
              />
              <span className="text-sm text-gray-500">questions</span>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="medical-button"
          >
            {saving ? "Saving…" : "Save Preferences"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default DoctorPreferences;