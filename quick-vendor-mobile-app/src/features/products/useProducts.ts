import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, createProduct, updateProduct, deleteProduct } from './api';
import type { CreateProductRequest, UpdateProductRequest, Product } from '../../types';

const PRODUCTS_QUERY_KEY = ['products'];

export function useProducts() {
    return useQuery({
        queryKey: PRODUCTS_QUERY_KEY,
        queryFn: getProducts,
    });
}

/**
 * Fetch a single product from the cached list query.
 * The backend has no GET /api/products/:id endpoint,
 * so we select from the already-fetched list instead.
 */
export function useProduct(id: string) {
    return useQuery({
        queryKey: PRODUCTS_QUERY_KEY,
        queryFn: getProducts,
        enabled: !!id,
        select: (products: Product[]) => products.find((p) => p.id === id) ?? null,
    });
}

export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateProductRequest) => createProduct(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
        },
    });
}

export function useUpdateProduct(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateProductRequest) => updateProduct(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
        },
    });
}

export function useDeleteProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteProduct(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
        },
    });
}
