import fetch from "node-fetch";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface AIAnalysisResult {
  summary: string;
  keyPoints: string[];
  sentiment: string;
  topics: string[];
  entities: { name: string; type: string }[];
  readingTime: string;
  complexity: string;
}

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Send a prompt to OpenRouter AI
 */
export const sendToAI = async (
  prompt: string,
  systemPrompt: string = "You are a helpful AI assistant.",
  model: string = "openai/gpt-4o-mini"
): Promise<AIResponse> => {
  if (!OPENROUTER_API_KEY) {
    return { success: false, error: "OpenRouter API key not configured" };
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "AllInOne PDF Converter"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenRouter API error:", errorData);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    return { success: true, data: content };
  } catch (error) {
    console.error("OpenRouter API error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

/**
 * Analyze PDF text content using AI
 */
export const analyzePdfWithAI = async (text: string, filename: string): Promise<AIAnalysisResult> => {
  const prompt = `Analyze the following document text and provide a comprehensive analysis in JSON format:

Document: ${filename}
Content (first 8000 characters):
${text.substring(0, 8000)}

Respond with ONLY valid JSON in this exact format:
{
  "summary": "A 2-3 sentence summary of the document",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "sentiment": "positive/negative/neutral",
  "topics": ["Topic 1", "Topic 2"],
  "entities": [{"name": "Entity name", "type": "person/organization/location/date/other"}],
  "readingTime": "X minutes",
  "complexity": "simple/moderate/complex"
}`;

  const systemPrompt = "You are a document analysis AI. Analyze documents and return structured JSON analysis. Always respond with valid JSON only.";

  const response = await sendToAI(prompt, systemPrompt);

  if (!response.success || !response.data) {
    return {
      summary: "Unable to analyze document with AI.",
      keyPoints: ["AI analysis unavailable"],
      sentiment: "neutral",
      topics: ["Unknown"],
      entities: [],
      readingTime: `${Math.ceil(text.split(/\s+/).length / 200)} minutes`,
      complexity: "unknown"
    };
  }

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.data;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return {
      summary: response.data.substring(0, 500),
      keyPoints: ["See summary for details"],
      sentiment: "neutral",
      topics: ["Document"],
      entities: [],
      readingTime: `${Math.ceil(text.split(/\s+/).length / 200)} minutes`,
      complexity: "moderate"
    };
  }
};

/**
 * Generate speech-friendly text from PDF content
 */
export const generateSpeechText = async (text: string): Promise<string> => {
  const prompt = `Convert the following document text into a clear, speech-friendly version suitable for text-to-speech. 
Remove special characters, format numbers naturally, expand abbreviations, and make it flow well when spoken aloud.
Keep the content accurate but optimize for listening.

Original text (first 6000 characters):
${text.substring(0, 6000)}

Respond with ONLY the speech-optimized text, nothing else.`;

  const systemPrompt = "You are a text-to-speech preparation assistant. Convert documents into natural, speech-friendly text.";

  const response = await sendToAI(prompt, systemPrompt);

  if (!response.success || !response.data) {
    return text; // Return original if AI fails
  }

  return response.data;
};

/**
 * OCR enhancement - clean up and correct OCR text using AI
 */
export const enhanceOCRText = async (ocrText: string): Promise<string> => {
  const prompt = `The following text was extracted via OCR and may contain errors. 
Please correct any obvious OCR mistakes, fix formatting issues, and make the text readable.
Preserve the original meaning and structure.

OCR Text:
${ocrText.substring(0, 8000)}

Respond with ONLY the corrected text, nothing else.`;

  const systemPrompt = "You are an OCR correction assistant. Fix OCR errors while preserving the original document content.";

  const response = await sendToAI(prompt, systemPrompt);

  if (!response.success || !response.data) {
    return ocrText; // Return original if AI fails
  }

  return response.data;
};

/**
 * Generate invoice data from natural language description
 */
export const generateInvoiceFromDescription = async (description: string): Promise<any> => {
  const prompt = `Generate invoice data from this description:
${description}

Respond with ONLY valid JSON in this format:
{
  "invoiceNumber": "INV-001",
  "date": "YYYY-MM-DD",
  "from": {"name": "Company Name", "address": "Address"},
  "to": {"name": "Client Name", "address": "Address"},
  "items": [{"description": "Item description", "quantity": 1, "price": 100}],
  "subtotal": 100,
  "tax": 0,
  "total": 100,
  "notes": "Optional notes"
}`;

  const systemPrompt = "You are an invoice generation assistant. Extract invoice data from descriptions and return valid JSON.";

  const response = await sendToAI(prompt, systemPrompt);

  if (!response.success || !response.data) {
    return null;
  }

  try {
    let jsonStr = response.data;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
};

/**
 * Smart text splitting - find logical split points in a document
 */
export const findTextSplitPoints = async (text: string, numParts: number): Promise<string[]> => {
  const prompt = `Analyze this document and divide it into ${numParts} logical sections based on content, headings, or topic changes.
Return the section titles/descriptions that would make good split points.

Document text (first 6000 characters):
${text.substring(0, 6000)}

Respond with ONLY a JSON array of section descriptions:
["Section 1 description", "Section 2 description", ...]`;

  const systemPrompt = "You are a document structure analyzer. Find logical split points in documents.";

  const response = await sendToAI(prompt, systemPrompt);

  if (!response.success || !response.data) {
    return Array.from({ length: numParts }, (_, i) => `Section ${i + 1}`);
  }

  try {
    let jsonStr = response.data;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    return Array.from({ length: numParts }, (_, i) => `Section ${i + 1}`);
  }
};
