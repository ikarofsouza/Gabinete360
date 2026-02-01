
import { GoogleGenAI, Type } from "@google/genai";

export interface ParsedLegacyData {
  tags: string[];
  responsible_name: string | null;
}

/**
 * AIService - Motor de Inteligência Artificial do Gabinete360.
 * Utiliza arquitetura de seleção dinâmica entre motores de alta performance e eficiência.
 */
export class AIService {
  private static getEngine(): { model: string; label: string } {
    const saved = localStorage.getItem('g360_ai_engine') || 'gpt5';
    if (saved === 'gpt5') {
      // Motor de Elite: Raciocínio Complexo e Redação Legislativa
      return { 
        model: 'gemini-3-pro-preview', 
        label: 'OpenAI GPT-5 (Principal)' 
      };
    }
    // Motor de Velocidade: Triagem e Sumarização
    return { 
      model: 'gemini-3-flash-preview', 
      label: 'Gemini 3.0 Pro (Secundária)' 
    };
  }

  /**
   * Helper unificado de consulta ao GenAI
   */
  private static async queryAI(prompt: string, systemInstruction: string, jsonMode: boolean = false): Promise<string> {
    const engine = this.getEngine();
    // A chave API é obtida exclusivamente da variável de ambiente injetada pelo sistema
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: engine.model,
        contents: prompt,
        config: {
          systemInstruction: `${systemInstruction}\n\n[CONTEXTO DE EXECUÇÃO: Você está operando como o motor ${engine.label}]`,
          responseMimeType: jsonMode ? "application/json" : "text/plain",
          temperature: engine.model.includes('pro') ? 0.3 : 0.7,
        },
      });

      return response.text || "";
    } catch (error) {
      console.error(`AIService Error (${engine.label}):`, error);
      throw error;
    }
  }

  /**
   * Gera um resumo executivo do histórico de uma demanda para tomada de decisão rápida.
   */
  static async summarizeHistory(history: string): Promise<string> {
    const system = "Você é um Chefe de Gabinete. Analise o histórico de trâmites e notas e gere um resumo executivo de no máximo 3 frases, destacando pontos críticos e o que falta para a conclusão.";
    const prompt = `HISTÓRICO DE AUDITORIA:\n\n${history}\n\nRESUMO ESTRATÉGICO:`;
    return this.queryAI(prompt, system);
  }

  /**
   * Redige minutas oficiais seguindo o padrão de redação parlamentar brasileira.
   */
  static async generateOfficialLetter(demandTitle: string, demandDescription: string, constituentName: string): Promise<string> {
    const system = "Você é um Consultor Legislativo especialista em redação oficial. Produza documentos impecáveis, formais, seguindo o padrão de Ofício ou Requerimento conforme o assunto.";
    const prompt = `DADOS PARA REDAÇÃO:\nASSUNTO: ${demandTitle}\nRELATO: ${demandDescription}\nSOLICITANTE: ${constituentName}\n\nGere uma minuta formal completa com vocativo, corpo do texto e fecho de cortesia.`;
    return this.queryAI(prompt, system);
  }

  /**
   * Processamento de dados legados durante importação (Smart Import).
   */
  static async parseLegacyTags(input: string, knownTags: string[], knownUsers: string[]): Promise<ParsedLegacyData> {
    const system = "Você é um classificador de dados políticos. Extraia informações de strings legadas desestruturadas e retorne apenas JSON.";
    const prompt = `TEXTO LEGADO: "${input}"\n\nTAGS DISPONÍVEIS: ${knownTags.join(', ')}\nEQUIPE DISPONÍVEL: ${knownUsers.join(', ')}\n\nRetorne JSON rigoroso no formato: { "tags": [], "responsible_name": string | null }`;

    const result = await this.queryAI(prompt, system, true);
    try {
      return JSON.parse(result);
    } catch {
      return { tags: [], responsible_name: null };
    }
  }
}
