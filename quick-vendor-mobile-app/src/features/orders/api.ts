import { apiClient } from '../../core/api/client';
import type { Order } from '../../types';

/** Get all orders for the authenticated vendor (paginated). */
export async function getOrders(page = 1, limit = 20): Promise<Order[]> {
    const { data } = await apiClient.get<Order[]>('/api/orders/vendor', {
        params: { page, limit },
    });
    return data;
}

/** Get a single order by ID. */
export async function getOrder(id: string): Promise<Order> {
    const { data } = await apiClient.get<Order>(`/api/orders/vendor/${id}`);
    return data;
}

/** Confirm a paid order. */
export async function confirmOrder(id: string): Promise<Order> {
    const { data } = await apiClient.patch<Order>(
        `/api/orders/vendor/${id}/confirm`,
    );
    return data;
}

/** Mark an order as fulfilled. */
export async function fulfillOrder(id: string): Promise<Order> {
    const { data } = await apiClient.patch<Order>(
        `/api/orders/vendor/${id}/fulfill`,
    );
    return data;
}

/** Cancel an order. */
export async function cancelOrder(id: string): Promise<Order> {
    const { data } = await apiClient.patch<Order>(
        `/api/orders/vendor/${id}/cancel`,
    );
    return data;
}
