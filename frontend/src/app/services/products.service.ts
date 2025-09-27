import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Product {
  id?: number;
  codigo?: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precio_compra?: number;
  stock_actual: number;
  stock_minimo: number;
  categoria_id: number;
  categoria_nombre?: string;
  imagen?: string;
  activo?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Productos
  getProducts(): Observable<ApiResponse<Product[]>> {
    return this.http.get<ApiResponse<Product[]>>(`${this.apiUrl}/products`, {
      headers: this.getHeaders()
    });
  }

  getProduct(id: number): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`${this.apiUrl}/products/${id}`, {
      headers: this.getHeaders()
    });
  }

  createProduct(product: Product): Observable<ApiResponse<Product>> {
    // Mapear stock_actual a stock para el backend
    const productData = {
      ...product,
      stock: product.stock_actual
    };
    return this.http.post<ApiResponse<Product>>(`${this.apiUrl}/products`, productData, {
      headers: this.getHeaders()
    });
  }

  updateProduct(id: number, product: Product): Observable<ApiResponse<Product>> {
    // Mapear stock_actual a stock para el backend
    const productData = {
      ...product,
      stock: product.stock_actual
    };
    return this.http.put<ApiResponse<Product>>(`${this.apiUrl}/products/${id}`, productData, {
      headers: this.getHeaders()
    });
  }

  deleteProduct(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/products/${id}`, {
      headers: this.getHeaders()
    });
  }

  // Categorías
  getCategories(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(`${this.apiUrl}/categories`, {
      headers: this.getHeaders()
    });
  }

  createCategory(category: Omit<Category, 'id'>): Observable<ApiResponse<Category>> {
    return this.http.post<ApiResponse<Category>>(`${this.apiUrl}/categories`, category, {
      headers: this.getHeaders()
    });
  }
}
