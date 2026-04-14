import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { FanSchedule } from "../types";

const getApiKey = () => {
  const viteKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const processKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
  
  if (!viteKey && !processKey) {
    console.warn("Gemini API Key not found in VITE_GEMINI_API_KEY or GEMINI_API_KEY");
  }
  
  return viteKey || processKey || "";
};

export async function extractFanSchedule(
  input: string | { data: string; mimeType: string }
): Promise<FanSchedule> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    Extract ALL HVAC fan schedule data from the provided input. Do not skip any schedules or equipment lists.
    Organize the data into tabs by fan type (e.g., Wall Mount Propeller, Upblast Centrifugal, Toilet Exhaust, Inline Exhaust, Supply Fans).
    Within each tab, group fans that have the EXACT same CFM and ESP (Static Pressure).
    Extract any general spec notes or remarks for each fan type.
    
    CRITICAL EXTRACTION RULES:
    1. MANUFACTURER & MODEL: Look for "MFG", "MAKE", "MODEL NO". Split combined fields like "Greenheck SQ-120".
    2. RPM: Extract the fan speed. Look for "RPM" or "SPEED".
    3. VOLTAGE & PHASE: Extract electrical data. Look for "VOLTS", "V", "PH", "PHASE". 
       Example: "115/1" means Voltage: "115", Phase: 1. "208/3" means Voltage: "208", Phase: 3.
    4. HP: Extract horsepower. Look for "HP", "MOTOR HP", "BHP".
    
    If units are in metric (L/S for flow, Pa for pressure), include them and also calculate the imperial equivalents (CFM = L/S * 2.1189, in.WG = Pa / 248.84).
    
    Return the data in the specified JSON format. Ensure NO fans are missed.
  `;

  const contents = typeof input === 'string' 
    ? [prompt, input]
    : [prompt, { inlineData: input }];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tabs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                typeName: { type: Type.STRING },
                specNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                groups: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      cfm: { type: Type.NUMBER },
                      esp: { type: Type.NUMBER },
                      fans: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            tag: { type: Type.STRING },
                            type: { type: Type.STRING },
                            manufacturer: { type: Type.STRING },
                            model: { type: Type.STRING },
                            cfm: { type: Type.NUMBER },
                            esp: { type: Type.NUMBER },
                            rpm: { type: Type.NUMBER },
                            hp: { type: Type.NUMBER },
                            voltage: { type: Type.STRING },
                            phase: { type: Type.NUMBER },
                            notes: { type: Type.STRING },
                            metricCfm: { type: Type.NUMBER },
                            metricEsp: { type: Type.NUMBER }
                          },
                          required: ["tag", "cfm", "esp"]
                        }
                      }
                    },
                    required: ["name", "cfm", "esp", "fans"]
                  }
                }
              },
              required: ["typeName", "groups"]
            }
          }
        },
        required: ["tabs"]
      }
    }
  });

  return JSON.parse(response.text || '{"tabs": []}');
}
