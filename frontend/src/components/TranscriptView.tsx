import React from "react";

interface TranscriptViewProps {
  content: string;
}

function parseDialogue(content: string): Array<{ speaker: "Doctor" | "Patient" | "Family Member"; text: string }>
{
  const items: Array<{ speaker: "Doctor" | "Patient" | "Family Member"; text: string }> = [];
  const raw = content || "";

  // 1) Try to extract ordered pairs via regex even if JSON has duplicate keys
  // This preserves order when LLM returns an object like { "Doctor": "..", "Patient": "..", "Doctor": ".." }
  // It also works on pretty-printed strings.
  const pairRe = /"(Doctor|Patient|Family Member)"\s*:\s*"([\s\S]*?)"\s*(?:,|\}|$)/g;
  try {
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(raw)) !== null) {
      const role = (m[1] === "Doctor" || m[1] === "Family Member") ? (m[1] as any) : "Patient";
      // Unescape common JSON escapes
      const text = m[2]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\\"/g, '"');
      items.push({ speaker: role, text });
    }
    if (items.length > 0) return items;
  } catch {
    // continue to JSON parse fallback
  }

  // 2) JSON parse (works when response is an array like [{"Doctor": ".."}, {"Patient": ".."}])
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item === "object") {
          for (const [k, v] of Object.entries(item)) {
            const key = k.trim();
            if ((key === "Doctor" || key === "Patient" || key === "Family Member") && typeof v === "string") {
              items.push({ speaker: key as "Doctor" | "Patient" | "Family Member", text: v });
            }
          }
        }
      }
      if (items.length > 0) return items;
    }
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        const key = k.trim();
        if ((key === "Doctor" || key === "Patient" || key === "Family Member") && typeof v === "string") {
          items.push({ speaker: key as "Doctor" | "Patient" | "Family Member", text: v });
        }
      }
      if (items.length > 0) return items;
    }
  } catch {
    // not valid JSON; continue
  }

  // 3) Fallback: split plain text into lines, alternate speakers heuristically
  const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const out: Array<{ speaker: "Doctor" | "Patient" | "Family Member"; text: string }> = [];
  let next: "Doctor" | "Patient" | "Family Member" = "Doctor";
  for (const line of lines) {
    const m = line.match(/^\s*(Doctor|Patient|Family Member)\s*:\s*(.*)$/i);
    if (m) {
      const low = m[1].toLowerCase();
      const sp = low === "doctor" ? "Doctor" : (low === "family member" ? "Family Member" : "Patient");
      out.push({ speaker: sp, text: m[2] });
      next = sp === "Doctor" ? "Patient" : "Doctor";
    } else {
      out.push({ speaker: next, text: line });
      next = next === "Doctor" ? "Patient" : "Doctor";
    }
  }
  return out;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({ content }) => {
  const dialogue = React.useMemo(() => parseDialogue(content), [content]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {dialogue.length === 0 && (
        <div className="text-sm text-gray-500">No transcript available.</div>
      )}
      {dialogue.map((turn, idx) => (
        <div key={idx} className="mb-6">
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-3 ${
              turn.speaker === "Patient" ? "bg-green-500" : turn.speaker === "Family Member" ? "bg-amber-500" : "bg-blue-500"
            }`} />
            <div className="flex-1 min-w-0">
              <div className={`text-lg font-bold mb-2 ${
                turn.speaker === "Patient" ? "text-green-700" : turn.speaker === "Family Member" ? "text-amber-700" : "text-blue-700"
              }`}>
                {turn.speaker}
              </div>
              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {turn.text}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TranscriptView;
