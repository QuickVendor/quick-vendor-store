import { apiClient } from '../../core/api/client';

export interface Bank {
    name: string;
    code: string;
    active: boolean;
}

export interface VerifyAccountResponse {
    accountName: string;
}

export async function getBanks(): Promise<Bank[]> {
    const { data } = await apiClient.get<Bank[]>('/api/payments/banks');
    return data;
}

export async function verifyAccount(bankCode: string, accountNumber: string): Promise<VerifyAccountResponse> {
    const { data } = await apiClient.post<VerifyAccountResponse>('/api/payments/verify-account', {
        bankCode,
        accountNumber,
    });
    return data;
}

export async function setupPayment(bankCode: string, accountNumber: string): Promise<void> {
    await apiClient.post('/api/payments/setup', {
        bankCode,
        accountNumber,
    });
}
