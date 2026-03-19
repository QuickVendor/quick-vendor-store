import { apiClient } from '../../core/api/client';
import type {
    Product,
    CreateProductRequest,
    UpdateProductRequest,
} from '../../types';

/** Get all products for the authenticated vendor. */
export async function getProducts(): Promise<Product[]> {
    const { data } = await apiClient.get<Product[]>('/api/products');
    return data;
}

/** Get a single product by ID. */
export async function getProduct(id: string): Promise<Product> {
    const { data } = await apiClient.get<Product>(`/api/products/${id}`);
    return data;
}

/** Create a new product (JSON body, no images). */
export async function createProduct(payload: CreateProductRequest): Promise<Product> {
    const { data } = await apiClient.post<Product>('/api/products', payload);
    return data;
}

/** Update a product. */
export async function updateProduct(id: string, payload: UpdateProductRequest): Promise<Product> {
    const { data } = await apiClient.put<Product>(`/api/products/${id}`, payload);
    return data;
}

/** Delete a product. */
export async function deleteProduct(id: string): Promise<void> {
    await apiClient.delete(`/api/products/${id}`);
}
