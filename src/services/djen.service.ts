import axios from 'axios';
import { SearchResult } from '../models/searchResult.model';

export class DjenService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = 'https://api.djen.example.com'; // URL do serviço DJEN
    }

    public async searchByName(name: string): Promise<SearchResult[]> {
        const response = await axios.get(`${this.baseUrl}/search/name`, {
            params: { name }
        });
        return response.data;
    }

    public async searchByCpf(cpf: string): Promise<SearchResult[]> {
        const response = await axios.get(`${this.baseUrl}/search/cpf`, {
            params: { cpf }
        });
        return response.data;
    }

    public async searchByOab(oab: string): Promise<SearchResult[]> {
        const response = await axios.get(`${this.baseUrl}/search/oab`, {
            params: { oab }
        });
        return response.data;
    }
}