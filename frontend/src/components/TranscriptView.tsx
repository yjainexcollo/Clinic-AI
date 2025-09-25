import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { FileText, User, Stethoscope } from "lucide-react";

interface TranscriptViewProps {
  content: string;
}

function parseDialogue(content: string): Array<{ speaker: "Doctor" | "Patient"; text: string }>
{
  const items: Array<{ speaker: "Doctor" | "Patient"; text: string }> = [];
  const raw = content || "";
  
  console.log("Raw transcript content:", raw.substring(0, 500) + "...");

  // 1) Handle nested JSON format like {"text": "{\"Doctor\": \"...\", \"Patient\": \"...\"}"}
  try {
    // First, try to parse the outer JSON to get the "text" field
    const outerData = JSON.parse(raw);
    console.log("Outer JSON parsed successfully");
    
    if (outerData && typeof outerData === "object" && outerData.text) {
      console.log("Found text field in outer JSON");
      // Then parse the inner JSON string
      const innerData = JSON.parse(outerData.text);
      console.log("Inner JSON parsed successfully, keys:", Object.keys(innerData));
      
      if (innerData && typeof innerData === "object") {
        // Extract all Doctor and Patient entries in order
        for (const [key, value] of Object.entries(innerData)) {
          const speaker = key.trim();
          if ((speaker === "Doctor" || speaker === "Patient") && typeof value === "string") {
            items.push({ speaker: speaker as "Doctor" | "Patient", text: value.trim() });
          }
        }
        console.log("Parsed items from nested JSON:", items.length);
        if (items.length > 0) return items;
      }
    }
  } catch (error) {
    console.log("Nested JSON parsing failed:", error);
    // continue to other parsing methods
  }

  // 2) Try to extract ordered pairs via regex even if JSON has duplicate keys
  // This preserves order when LLM returns an object like { "Doctor": "..", "Patient": "..", "Doctor": ".." }
  const pairRe = /"(Doctor|Patient)"\s*:\s*"([\s\S]*?)"\s*(?:,|\}|$)/g;
  try {
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(raw)) !== null) {
      const role = m[1] === "Doctor" ? "Doctor" : "Patient";
      // Unescape common JSON escapes and handle multiline text
      const text = m[2]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\\"/g, '"')
        .replace(/\\r/g, "\r")
        .trim();
      if (text) {
        items.push({ speaker: role, text });
      }
    }
    if (items.length > 0) return items;
  } catch {
    // continue to JSON parse fallback
  }

  // 3) JSON parse (works when response is an array like [{"Doctor": ".."}, {"Patient": ".."}])
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item === "object") {
          for (const [k, v] of Object.entries(item)) {
            const key = k.trim();
            if ((key === "Doctor" || key === "Patient") && typeof v === "string") {
              items.push({ speaker: key as "Doctor" | "Patient", text: v.trim() });
            }
          }
        }
      }
      if (items.length > 0) return items;
    }
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        const key = k.trim();
        if ((key === "Doctor" || key === "Patient") && typeof v === "string") {
          items.push({ speaker: key as "Doctor" | "Patient", text: v.trim() });
        }
      }
      if (items.length > 0) return items;
    }
  } catch {
    // not valid JSON; continue
  }

  // 4) Fallback: split plain text into lines, alternate speakers heuristically
  const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const out: Array<{ speaker: "Doctor" | "Patient"; text: string }> = [];
  let next: "Doctor" | "Patient" = "Doctor";
  for (const line of lines) {
    const m = line.match(/^\s*(Doctor|Patient)\s*:\s*(.*)$/i);
    if (m) {
      const sp = m[1].toLowerCase() === "doctor" ? "Doctor" : "Patient";
      out.push({ speaker: sp, text: m[2].trim() });
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

  // Get speaker statistics
  const doctorLines = dialogue.filter(line => line.speaker === 'Doctor').length;
  const patientLines = dialogue.filter(line => line.speaker === 'Patient').length;

  return (
    <Card className="w-full">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-green-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-xl">
            <FileText className="h-6 w-6 mr-2 text-blue-600" />
            Medical Transcript
          </CardTitle>
          <div className="flex space-x-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
              <Stethoscope className="h-3 w-3 mr-1" />
              Doctor: {doctorLines}
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              <User className="h-3 w-3 mr-1" />
              Patient: {patientLines}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {dialogue.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No transcript content available</p>
            </div>
          )}
          {dialogue.map((turn, idx) => (
            <div
              key={idx}
              className="flex items-start space-x-3 p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex-shrink-0">
                {turn.speaker === 'Doctor' ? (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Stethoscope className="h-4 w-4 text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <span
                    className={`font-bold text-base px-3 py-1 rounded-full ${
                      turn.speaker === 'Doctor' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-green-600 text-white shadow-md'
                    }`}
                  >
                    {turn.speaker}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-lg border-l-4 leading-relaxed whitespace-pre-wrap ${
                    turn.speaker === 'Doctor' 
                      ? 'bg-blue-50 border-blue-400 text-blue-900' 
                      : 'bg-green-50 border-green-400 text-green-900'
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TranscriptView;
