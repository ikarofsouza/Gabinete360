
import { DemandService } from './api';

export class WhatsAppService {
  /**
   * Gera um link do WhatsApp e opcionalmente registra a interação na timeline de uma demanda.
   */
  static async sendDemandUpdate(
    phone: string, 
    text: string, 
    demandId?: string, 
    userId?: string
  ): Promise<string> {
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/${phone}?text=${encodedText}`;
    
    if (demandId && userId) {
      // Registrar log de contato na timeline
      await DemandService.addTimelineEvent(demandId, userId, {
        type: 'CONTACT',
        description: `Iniciado contato via WhatsApp: "${text.substring(0, 50)}..."`,
        metadata: { channel: 'whatsapp', direction: 'outbound' }
      });
    }
    
    return url;
  }
}
