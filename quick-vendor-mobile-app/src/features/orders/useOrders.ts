import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getOrders,
    getOrder,
    confirmOrder,
    fulfillOrder,
    cancelOrder,
} from './api';

const ORDERS_QUERY_KEY = ['orders'];

export function useOrders() {
    return useQuery({
        queryKey: ORDERS_QUERY_KEY,
        queryFn: () => getOrders(),
    });
}

export function useOrder(id: string) {
    return useQuery({
        queryKey: [...ORDERS_QUERY_KEY, id],
        queryFn: () => getOrder(id),
        enabled: !!id,
    });
}

export function useConfirmOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => confirmOrder(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
        },
    });
}

export function useFulfillOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => fulfillOrder(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
        },
    });
}

export function useCancelOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => cancelOrder(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
        },
    });
}
