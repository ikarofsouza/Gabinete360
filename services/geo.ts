
export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export class GeoService {
  static async getAddressByCep(cep: string): Promise<ViaCEPResponse | null> {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return null;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return null;
      return data;
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      return null;
    }
  }

  /**
   * Busca o CEP baseado no endereço (UF, Cidade, Logradouro)
   * Formato: viacep.com.br/ws/RS/Porto Alegre/Domingos/json/
   */
  static async getCepByAddress(uf: string, city: string, street: string): Promise<ViaCEPResponse[]> {
    if (!uf || !city || !street || street.length < 3) return [];

    try {
      const encodedUf = encodeURIComponent(uf.trim());
      const encodedCity = encodeURIComponent(city.trim());
      const encodedStreet = encodeURIComponent(street.trim());
      
      const response = await fetch(`https://viacep.com.br/ws/${encodedUf}/${encodedCity}/${encodedStreet}/json/`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (error) {
      console.error("Erro ao buscar CEP por endereço:", error);
      return [];
    }
  }
}
