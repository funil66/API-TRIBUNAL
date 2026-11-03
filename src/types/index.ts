export interface User {
    id: string;
    name: string;
    email: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Lawyer {
    id: string;
    name: string;
    cpf: string;
    oabNumber: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Subscription {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    status: 'active' | 'inactive';
}

export interface SearchResult {
    id: string;
    lawyerId: string;
    publicationDate: Date;
    content: string;
}

export interface SearchQuery {
    name?: string;
    cpf?: string;
    oabNumber?: string;
}