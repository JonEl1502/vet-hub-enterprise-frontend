
import { MedicalRecord } from "../types";
import { API_BASE_URL } from "./api/config";

let clinicAIConfig: { provider: string; apiKey?: string; model?: string } | null = null;

export const setClinicAIConfig = (config: { provider: string; apiKey?: string; model?: string } | null) => {
  clinicAIConfig = config;
};

// Re-exported as a no-op to avoid breaking the import in App.tsx
// The model and provider are now controlled server-side.
export { clinicAIConfig };

// ---------------------------------------------------------------------------
// Internal helper — calls the backend AI proxy with auth token
// ---------------------------------------------------------------------------
const aiPost = async (endpoint: string, body: object): Promise<any> => {
  const token = localStorage.getItem('authToken') || '';

  const res = await fetch(`${API_BASE_URL}/ai/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  const json = await res.json();
  return json.data;
};

// ---------------------------------------------------------------------------
// Public API — same signatures as before so no other files need changing
// ---------------------------------------------------------------------------

/**
 * Generates a highly descriptive, medically-sound narrative for an individual clinical service.
 */
export async function generateServiceNote(taskName: string, sentiment: string, phrases: string[]) {
  try {
    const data = await aiPost('service-note', { taskName, sentiment, phrases });
    return data?.note ?? `During the ${taskName} procedure, the patient exhibited ${sentiment} responses. Observations: ${phrases.join(', ')}.`;
  } catch (error) {
    console.error("AI Service Note Error:", error);
    return `During the ${taskName} procedure, the patient exhibited ${sentiment} responses. Observations: ${phrases.join(', ')}.`;
  }
}

/**
 * Generates an exhaustive visit summary report.
 */
export async function generateFullVisitSummary(
  petName: string,
  visitTime: string,
  staffNames: string[],
  servicesData: { name: string; notes: string; category: string; sentiment?: string; observations?: string }[],
  medications?: string[]
) {
  try {
    const data = await aiPost('visit-summary', {
      petName,
      visitTime,
      staffNames,
      services: servicesData,
      medications,
    });
    return data?.summary ?? 'Diagnostic report synthesis failed. Please review individual services.';
  } catch (error) {
    console.error("AI Visit Summary Error:", error);
    return 'Diagnostic report synthesis failed. Please review individual services.';
  }
}

/**
 * AI Assistant for individual services — analyzes observations and provides diagnostic suggestions.
 */
export async function analyzeServiceObservations(
  serviceName: string,
  serviceCategory: string,
  observations: string,
  petSpecies?: string,
  petAge?: number,
  _imageData?: string
) {
  try {
    const data = await aiPost('analyze', {
      serviceName,
      serviceCategory,
      observations,
      petSpecies,
      petAge,
    });

    const fullAnalysis = data?.fullAnalysis ?? 'Analysis unavailable.';
    return {
      fullAnalysis,
      diagnosticSuggestions: extractSection(fullAnalysis, "DIAGNOSTIC SUGGESTIONS"),
      treatmentRecommendations: extractSection(fullAnalysis, "TREATMENT RECOMMENDATIONS"),
      clinicalInsights: extractSection(fullAnalysis, "CLINICAL INSIGHTS").join('\n') || '',
    };
  } catch (error) {
    console.error("AI Analyze Error:", error);
    return {
      diagnosticSuggestions: ["Error analyzing observations. Please try again."],
      treatmentRecommendations: ["Error generating recommendations. Please try again."],
      clinicalInsights: "Analysis failed. Please review observations manually.",
      fullAnalysis: "Analysis failed.",
    };
  }
}

/**
 * Generates a concise medical summary for a pet's clinical history.
 */
export async function generateMedicalSummary(history: MedicalRecord[]) {
  // Re-use the visit-summary endpoint with adapted data
  try {
    const services = history.map(h => ({
      name: h.diagnosis,
      notes: h.treatment,
      category: 'History',
    }));
    const data = await aiPost('visit-summary', {
      petName: 'Patient',
      visitTime: 'Historical review',
      staffNames: [],
      services,
    });
    return data?.summary ?? 'Medical history summary unavailable.';
  } catch (error) {
    console.error("AI Medical Summary Error:", error);
    return "Analysis of historical records failed.";
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function extractSection(text: string, sectionName: string): string[] {
  const lines = text.split('\n');
  const sectionStart = lines.findIndex(line => line.toUpperCase().includes(sectionName));
  if (sectionStart === -1) return [];

  const suggestions: string[] = [];
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^\d+\.|^-|^•|^\*/)) {
      suggestions.push(line.replace(/^\d+\.|^-|^•|^\*/, '').trim());
    } else if (
      line.toUpperCase().includes('RECOMMENDATIONS') ||
      line.toUpperCase().includes('INSIGHTS') ||
      line.toUpperCase().includes('SUGGESTIONS')
    ) {
      if (suggestions.length > 0) break;
    }
  }
  return suggestions.length > 0 ? suggestions : [text];
}
