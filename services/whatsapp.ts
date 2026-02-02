
import { DemandService } from './api';
import { User } from '../types';

export class WhatsAppService {
  /**
   * Gera um link do WhatsApp e opcionalmente registra a interação na timeline de uma demanda.
   */
  static async sendDemandUpdate(
    phone: string, 
    text: string, 
    demandId?: string, 
    user?: User
  ): Promise<string> {
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/${phone}?text=${encodedText}`;
    
    // Fix: Using User object instead of string ID to match DemandService.addTimelineEvent signature
    if (demandId && user) {
      // Registrar log de contato na timeline
      await DemandService.addTimelineEvent(demandId, user, {
        type: 'CONTACT',
        description: `Iniciado contato via WhatsApp: "${text.substring(0, 50)}..."`,
        metadata: { channel: 'whatsapp', direction: 'outbound' }
      });
    }
    
    return url;
  }
}
