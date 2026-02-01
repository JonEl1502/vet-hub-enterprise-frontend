
import { GoogleGenAI } from "@google/genai";
import { MedicalRecord } from "../types";

let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

// Store clinic AI config globally (can be set from clinic context)
let clinicAIConfig: { provider: string; apiKey?: string; model?: string } | null = null;

export const setClinicAIConfig = (config: { provider: string; apiKey?: string; model?: string } | null) => {
  clinicAIConfig = config;
  // Reset AI client when config changes
  ai = null;
  currentApiKey = null;
};

const getAIClient = () => {
  // Priority: 1. Clinic config, 2. Environment variable
  const apiKey = clinicAIConfig?.apiKey || import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  // Reinitialize if API key changed
  if (!ai || currentApiKey !== apiKey) {
    try {
      ai = new GoogleGenAI({ apiKey });
      currentApiKey = apiKey;
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      return null;
    }
  }

  return ai;
};

const getModelName = () => {
  // Use clinic-configured model or default
  return clinicAIConfig?.model || "gemini-2.0-flash-exp";
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
      model: getModelName(),
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
 * Enhanced to include sentiment and observations for comprehensive clinical narrative.
 */
export async function generateFullVisitSummary(
  petName: string,
  visitTime: string,
  staffNames: string[],
  servicesData: {name: string, notes: string, category: string, sentiment?: string, observations?: string}[],
  medications?: string[]
) {
  try {
    const client = getAIClient();
    if (!client) {
      console.warn("Gemini API key not configured. Using fallback report.");
      return "Diagnostic report synthesis failed. Please review individual services.";
    }

    // Enhanced service text with sentiment and observations
    const servicesText = servicesData.map(s => {
      let text = `[${s.category}] ${s.name}: ${s.notes}`;
      if (s.sentiment) text += `\n  Outcome/Sentiment: ${s.sentiment}`;
      if (s.observations) text += `\n  Clinical Observations: ${s.observations}`;
      return text;
    }).join('\n\n');

    const prompt = `Generate a Comprehensive Clinical Narrative for:
    Patient: ${petName}
    Visit Timestamp: ${visitTime}
    Attending Clinicians: ${staffNames.join(', ')}
    Medications Administered/Prescribed: ${medications?.join(', ') || 'None'}

    Detailed Service Data:
    ${servicesText}

    Structure the report with these specific headers:
    1. CLINICAL SUMMARY & VITAL ASSESSMENT: (A synthesis of the patient's state, vital signs, and overall condition)
    2. PROCEDURAL NARRATIVE: (A cohesive, chronological flow of all services performed, integrating examinations, diagnostics, treatments, and surgeries)
    3. DIAGNOSTIC IMPRESSIONS: (What the findings suggest, including differential diagnoses and clinical significance)
    4. TREATMENT ADMINISTERED: (Detailed account of all treatments, medications, and procedures performed)
    5. DISCHARGE INSTRUCTIONS & CARE PLAN: (Clear, actionable steps for the owner including medication schedules, follow-up care, and warning signs)

    Requirements:
    - Consolidate ALL service notes into a single, flowing narrative
    - Use professional veterinary medical terminology
    - Ensure the narrative reads as a cohesive medical record, not a list
    - Include specific details from observations and sentiment
    - Make it thorough, authoritative, and medically exhaustive
    - Write in past tense as this is a completed visit record`;

    const response = await client.models.generateContent({
      model: getModelName(),
      contents: prompt,
      config: {
        systemInstruction: "You are the Medical Director of a high-end veterinary hospital. Your clinical narratives are exhaustive, clear, and extremely professional. You consolidate all service notes into comprehensive, flowing medical records that meet the highest standards of veterinary documentation.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Visit Summary Error:", error);
    return "Diagnostic report synthesis failed. Please review individual services.";
  }
}

/**
 * AI Assistant for individual services - analyzes observations and provides diagnostic suggestions
 */
export async function analyzeServiceObservations(
  serviceName: string,
  serviceCategory: string,
  observations: string,
  petSpecies?: string,
  petAge?: number,
  imageData?: string // Base64 encoded image
) {
  try {
    const client = getAIClient();
    if (!client) {
      console.warn("Gemini API key not configured. Using fallback analysis.");
      return {
        diagnosticSuggestions: ["AI analysis unavailable. Please review observations manually."],
        treatmentRecommendations: ["Consult with senior veterinarian for treatment plan."],
        clinicalInsights: "AI assistant is not configured. Please add VITE_GEMINI_API_KEY to your environment."
      };
    }

    const petContext = petSpecies ? `\nPatient: ${petSpecies}${petAge ? `, ${petAge} years old` : ''}` : '';

    const prompt = `You are an expert veterinary consultant analyzing clinical observations for a specific service.

Service: ${serviceName}
Category: ${serviceCategory}${petContext}

Clinical Observations:
${observations}

Based on these observations, provide:

1. DIAGNOSTIC SUGGESTIONS:
   - List potential diagnoses or conditions that could explain these observations
   - Include differential diagnoses if applicable
   - Rate likelihood (High/Medium/Low) for each suggestion

2. TREATMENT RECOMMENDATIONS:
   - Suggest appropriate treatments or interventions
   - Include medication recommendations if applicable
   - Specify any additional tests or procedures that may be needed

3. CLINICAL INSIGHTS:
   - Important considerations for this case
   - Warning signs to monitor
   - Prognosis indicators

Format your response in clear sections with bullet points for easy reading.`;

    const response = await client.models.generateContent({
      model: getModelName(),
      contents: prompt,
      config: {
        systemInstruction: "You are a senior veterinary consultant with expertise in diagnostics and treatment planning. Provide evidence-based, practical recommendations that help veterinarians make informed clinical decisions.",
      },
    });

    return {
      fullAnalysis: response.text,
      diagnosticSuggestions: extractSection(response.text, "DIAGNOSTIC SUGGESTIONS"),
      treatmentRecommendations: extractSection(response.text, "TREATMENT RECOMMENDATIONS"),
      clinicalInsights: extractSection(response.text, "CLINICAL INSIGHTS")
    };
  } catch (error) {
    console.error("Gemini Service Analysis Error:", error);
    return {
      diagnosticSuggestions: ["Error analyzing observations. Please try again."],
      treatmentRecommendations: ["Error generating recommendations. Please try again."],
      clinicalInsights: "Analysis failed. Please review observations manually."
    };
  }
}

/**
 * Helper function to extract sections from AI response
 */
function extractSection(text: string, sectionName: string): string[] {
  const lines = text.split('\n');
  const sectionStart = lines.findIndex(line => line.toUpperCase().includes(sectionName));

  if (sectionStart === -1) return [];

  const suggestions: string[] = [];
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^\d+\.|^-|^•|^\*/)) {
      suggestions.push(line.replace(/^\d+\.|^-|^•|^\*/, '').trim());
    } else if (line.toUpperCase().includes('RECOMMENDATIONS') || line.toUpperCase().includes('INSIGHTS')) {
      break;
    }
  }

  return suggestions.length > 0 ? suggestions : [text];
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
      model: getModelName(),
      contents: prompt,
      config: {
        systemInstruction: "You are a senior veterinary consultant summarizing complex medical histories for quick review by attending clinicians.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Medical Summary Error:", error);
    return "Analysis of historical records failed.";
  }
}
