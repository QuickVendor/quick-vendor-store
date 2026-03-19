import axios from 'axios';
import { env } from '../config/env';
import {
    authRequestInterceptor,
    loggingRequestInterceptor,
    responseSuccessInterceptor,
    responseErrorInterceptor,
} from './interceptors';

/**
 * Centralized Axios instance.
 * All API modules import this — never create ad-hoc Axios instances.
 */
export const apiClient = axios.create({
    baseURL: env.apiUrl,
    timeout: env.apiTimeout,
    headers: { 'Content-Type': 'application/json' },
});

// Request interceptors (order matters — auth first, then logging)
apiClient.interceptors.request.use(authRequestInterceptor);
apiClient.interceptors.request.use(loggingRequestInterceptor);

// Response interceptors
apiClient.interceptors.response.use(responseSuccessInterceptor, responseErrorInterceptor);
