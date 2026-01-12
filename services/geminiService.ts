
import { GoogleGenAI } from "@google/genai";
import { MedicalRecord } from "../types";

let ai: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!ai && import.meta.env.VITE_GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  }
  return ai;
};

/**
 * Generates a highly descriptive, medically-sound narrative for an individual clinical service.
 */
export async function generateServiceNote(taskName: string, sentiment: string, phrases: string[]) {
  try {
    const client = getAIClient();
    if (!client) {
      console.warn("Gemini API key not configured. Using fallback note.");
      return `During the ${taskName} procedure, the patient exhibited ${sentiment} responses. Key observations included: ${phrases.join(', ')}.`;
    }

    const prompt = `Convert these clinical observations into a professional, narrative-style medical note for a veterinary record.
    
    Service: ${taskName}
    Tone/Outcome: ${sentiment}
    Observations: ${phrases.join(', ')}
    
    Requirements:
    1. Write in a formal, clinical narrative style (not a list).
    2. Explain the significance of the observations for the pet's well-being.
    3. Ensure it sounds like it was written by a professional veterinarian.
    4. Keep it to one detailed paragraph.`;

    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert veterinary scribe. You transform keywords into comprehensive, accurate, and professional clinical narratives.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Task Note Error:", error);
    return `During the ${taskName} procedure, the patient exhibited ${sentiment} responses. Key observations included: ${phrases.join(', ')}.`;
  }
}

/**
 * Generates an exhaustive visit summary report.
 */
export async function generateFullVisitSummary(
  petName: string, 
  visitTime: string, 
  staffNames: string[], 
  servicesData: {name: string, notes: string, category: string}[],
  medications?: string[]
) {
  try {
    const client = getAIClient();
    if (!client) {
      console.warn("Gemini API key not configured. Using fallback report.");
      return "Diagnostic report synthesis failed. Please review individual nodes.";
    }

    const servicesText = servicesData.map(s => `[${s.category}] ${s.name}: ${s.notes}`).join('\n\n');
    const prompt = `Generate a Comprehensive Clinical Sequence Report for:
    Patient: ${petName}
    Visit Timestamp: ${visitTime}
    Attending Clinicians: ${staffNames.join(', ')}
    Medications Administered/Prescribed: ${medications?.join(', ') || 'None'}
    
    Detailed Service Data:
    ${servicesText}
    
    Structure the report with these specific headers:
    1. CLINICAL SUMMARY & VITAL ASSESSMENT: (A synthesis of the patient's state)
    2. PROCEDURAL NARRATIVE: (A combined flow of all services performed)
    3. DIAGNOSTIC IMPRESSIONS: (What the findings suggest)
    4. DISCHARGE INSTRUCTIONS & CARE PLAN: (Clear steps for the owner)
    
    The report should be thorough, authoritative, and medically exhaustive.`;

    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are the Medical Director of a high-end veterinary hospital. Your reports are exhaustive, clear, and extremely professional.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Visit Summary Error:", error);
    return "Diagnostic report synthesis failed. Please review individual nodes.";
  }
}

// Added generateMedicalSummary to fix the import error in App.tsx and provide pet health history analysis.
/**
 * Generates a concise medical summary for a pet's clinical history.
 */
export async function generateMedicalSummary(history: MedicalRecord[]) {
  try {
    const client = getAIClient();
    if (!client) {
      console.warn("Gemini API key not configured. Using fallback summary.");
      return "Medical history summary unavailable. Please review records directly.";
    }

    const historyText = history.map(h => `${h.date}: ${h.diagnosis} - ${h.treatment}`).join('\n');
    const prompt = `Review this patient's medical history and provide a concise, professional clinical summary of their health status, recurring issues, and overall trajectory.
    
    Medical History:
    ${historyText || 'No previous history recorded.'}
    
    Requirements:
    1. Professional, clinical tone.
    2. Focus on key health trends.
    3. Keep it to one paragraph.`;

    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a senior veterinary consultant summarizing complex medical histories for quick review by attending clinicians.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Medical Summary Error:", error);
    return "Analysis of historical nodes failed.";
  }
}
