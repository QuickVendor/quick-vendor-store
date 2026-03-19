import { useQuery } from '@tanstack/react-query';
import { getProfile } from './api';
import { getProducts } from '../products/api';
import type { User, Product } from '../../types';

export interface StoreSummary {
    profile: User;
    productCount: number;
    totalClicks: number;
}

/**
 * Fetches profile + product list in parallel.
 * Derives aggregate stats for the dashboard.
 */
export function useStoreSummary() {
    return useQuery<StoreSummary>({
        queryKey: ['storeSummary'],
        queryFn: async (): Promise<StoreSummary> => {
            const [profile, products] = await Promise.all([
                getProfile(),
                getProducts(),
            ]);

            const totalClicks = products.reduce(
                (sum: number, p: Product) => sum + p.click_count,
                0,
            );

            return { profile, productCount: products.length, totalClicks };
        },
        staleTime: 1000 * 60 * 2, // 2 min
    });
}
