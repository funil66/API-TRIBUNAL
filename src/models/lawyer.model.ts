export interface Lawyer {
    id: string;
    name: string;
    cpf: string;
    oabNumber: string;
    email: string;
    phone: string;
    createdAt: Date;
    updatedAt: Date;
}

export class LawyerModel {
    constructor(private lawyerData: Lawyer) {}

    public getLawyerData(): Lawyer {
        return this.lawyerData;
    }

    public updateLawyerData(updatedData: Partial<Lawyer>): void {
        this.lawyerData = { ...this.lawyerData, ...updatedData };
    }
}