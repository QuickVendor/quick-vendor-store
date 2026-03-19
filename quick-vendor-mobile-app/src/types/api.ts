/**
 * API request/response types aligned with NestJS backend endpoints.
 */
import type { User, Product } from './models';

// ── Auth ──────────────────────────────────────────────────

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    whatsapp_number?: string;
    store_name?: string;
}

/**
 * Register response shape from NestJS backend.
 * Returns token + user profile for auto-login after registration.
 */
export interface RegisterResponse {
    access_token: string;
    token_type: string;
    user: User;
}

// ── Products ──────────────────────────────────────────────

export interface CreateProductRequest {
    name: string;
    description?: string;
    price: number;
    is_available?: boolean;
}

export interface UpdateProductRequest {
    name?: string;
    description?: string;
    price?: number;
    is_available?: boolean;
}

export interface ProductListResponse {
    products: Product[];
}

// ── Store Settings ────────────────────────────────────────

export interface UpdateStoreRequest {
    store_name?: string;
    store_slug?: string;
    whatsapp_number?: string;
}

// ── Common ────────────────────────────────────────────────

export interface ApiError {
    detail: string | { msg: string; type: string }[];
}

export type { User, Product };
