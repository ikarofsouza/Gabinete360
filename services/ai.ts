import { GoogleGenAI } from "@google/genai";

export interface ParsedLegacyData {
  tags: string[];
  responsible_name: string | null;
}

export class AIService {
  private static getEngine(): { model: string; label: string } {
    const saved = localStorage.getItem('g360_ai_engine') || 'pro';
    if (saved === 'pro') {
      return { 
        model: 'gemini-3-pro-preview', 
        label: 'Gemini 3.0 Pro' 
      };
    }
    return { 
      model: 'gemini-3-flash-preview', 
      label: 'Gemini 3.0 Flash' 
    };
  }

  private static async queryAI(prompt: string, systemInstruction: string, jsonMode: boolean = false): Promise<string> {
    const engine = this.getEngine();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    try {
      const response = await ai.models.generateContent({
        model: engine.model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction + `\n\n[ENGINE: ${engine.label}]`,
          responseMimeType: jsonMode ? "application/json" : "text/plain",
          temperature: engine.model.includes('pro') ? 0.3 : 0.7,
        },
      });

      return response.text || "";
    } catch (error) {
      console.error(`AIService Error:`, error);
      throw error;
    }
  }

  static async summarizeHistory(history: string): Promise<string> {
    const system = "Você é um Chefe de Gabinete experiente. Resuma o histórico em 3 frases táticas.";
    const prompt = `HISTÓRICO:\n\n${history}\n\nRESUMO:`;
    return this.queryAI(prompt, system);
  }

  static async parseLegacyTags(input: string, knownTags: string[], knownUsers: string[]): Promise<ParsedLegacyData> {
    const system = "Extraia tags e responsáveis de textos legados. Retorne apenas JSON.";
    const prompt = `TEXTO: "${input}"\nTAGS: ${knownTags.join(',')}\nUSUÁRIOS: ${knownUsers.join(',')}\nFORMATO: {"tags":[], "responsible_name": null}`;

    const result = await this.queryAI(prompt, system, true);
    try {
      return JSON.parse(result);
    } catch {
      return { tags: [], responsible_name: null };
    }
  }
}