import React, { useEffect, useState } from "react";
import {
  getDoctorPreferences,
  saveDoctorPreferences,
  DoctorPreferencesResponse,
  PreVisitSectionConfig,
} from "../services/patientService";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PRE_VISIT_SECTIONS = [
  { key: "chief_complaint", label: "Chief Complaint", fields: [] },
  { key: "hpi", label: "HPI", fields: ["Onset", "Location", "Duration", "Characterization/quality", "Aggravating factors", "Relieving factors", "Radiation", "Temporal pattern", "Severity", "Associated symptoms", "Relevant negatives"] },
  { key: "history", label: "History", fields: ["Medical", "Surgical", "Family", "Lifestyle"] },
  { key: "review_of_systems", label: "Review of Systems", fields: [] },
  { key: "current_medication", label: "Current Medication", fields: [] },
];

const SOAP_LABELS: Record<string, string> = {
  subjective: "Subjective",
  objective: "Objective",
  assessment: "Assessment",
  plan: "Plan",
};

interface SortableItemProps {
  id: string;
  label: string;
}

function SortableItem({ id, label }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-4 bg-white border rounded-md cursor-move hover:bg-gray-50 ${isDragging ? "shadow-lg" : "shadow-sm"
        }`}
    >
      <div className="flex items-center gap-3">
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
        <span className="font-medium">{label}</span>
      </div>
    </div>
  );
}

const DoctorPreferences: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [doctorId, setDoctorId] = useState<string>("");
  const [soapOrder, setSoapOrder] = useState<string[]>(["subjective", "objective", "assessment", "plan"]);
  const [preVisitConfig, setPreVisitConfig] = useState<PreVisitSectionConfig[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const pref: DoctorPreferencesResponse = await getDoctorPreferences();
        if (!mounted) return;
        setDoctorId(pref.doctor_id);
        setSoapOrder(pref.soap_order || ["subjective", "objective", "assessment", "plan"]);

        // Ensure we populate config from backend or defaults if empty
        if (pref.pre_visit_config && pref.pre_visit_config.length > 0) {
          setPreVisitConfig(pref.pre_visit_config);
        } else {
          // Fallback default structure if backend sends empty
          setPreVisitConfig(PRE_VISIT_SECTIONS.map(s => ({
            section_key: s.key,
            enabled: true,
            selected_fields: s.fields,
          })));
        }
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSoapOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveDoctorPreferences({
        soap_order: soapOrder,
        pre_visit_config: preVisitConfig,
      });
      setSuccess("Preferences saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (sectionKey: string) => {
    const nextConfig = preVisitConfig.map(c => {
      if (c.section_key === sectionKey) {
        return { ...c, enabled: !c.enabled };
      }
      return c;
    });
    setPreVisitConfig(nextConfig);
  };

  const toggleField = (sectionKey: string, field: string) => {
    const nextConfig = preVisitConfig.map(c => {
      if (c.section_key === sectionKey) {
        const currentFields = new Set(c.selected_fields);
        if (currentFields.has(field)) currentFields.delete(field);
        else currentFields.add(field);
        return { ...c, selected_fields: Array.from(currentFields) };
      }
      return c;
    });
    setPreVisitConfig(nextConfig);
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
          <h2 className="text-lg font-semibold mb-3">SOAP Note Order</h2>
          <p className="text-sm text-gray-500 mb-4">
            Drag and drop to reorder the SOAP note sections as they will appear in the generated note.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={soapOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {soapOrder.map((key) => (
                  <SortableItem
                    key={key}
                    id={key}
                    label={SOAP_LABELS[key] || key}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <section className="medical-card">
          <h2 className="text-lg font-semibold mb-3">Pre-Visit Summary Configuration</h2>
          <p className="text-sm text-gray-500 mb-4">Select which sections and fields to include in the generated pre-visit summary.</p>
          <div className="space-y-4">
            {PRE_VISIT_SECTIONS.map((sectionDef) => {
              const currentConfig = preVisitConfig.find(c => c.section_key === sectionDef.key) || {
                section_key: sectionDef.key,
                enabled: true,
                selected_fields: sectionDef.fields
              };

              const isEnabled = currentConfig.enabled;

              return (
                <div key={sectionDef.key} className="border rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleSection(sectionDef.key)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="font-medium">{sectionDef.label}</span>
                  </div>

                  {isEnabled && sectionDef.fields.length > 0 && (
                    <div className="ml-6 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {sectionDef.fields.map(field => (
                        <label key={field} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentConfig.selected_fields.includes(field)}
                            onChange={() => toggleField(sectionDef.key, field)}
                            className="w-3.5 h-3.5 text-blue-500 rounded focus:ring-blue-400"
                          />
                          {field}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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