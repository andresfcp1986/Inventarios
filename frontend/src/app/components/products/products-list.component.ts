import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService, Product, Category } from '../../services/products.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-products-list',
  template: `
    <div class="products-container">
      <header class="page-header">
        <div class="header-content">
          <h1>📦 Gestión de Productos</h1>
          <button class="add-btn" (click)="openAddProduct()">
            ➕ Agregar Producto
          </button>
        </div>
      </header>

      <div class="filters-section">
        <div class="search-box">
          <input 
            type="text" 
            placeholder="🔍 Buscar productos..."
            [(ngModel)]="searchTerm"
            (input)="filterProducts()"
          >
        </div>
        <div class="filter-select">
          <select [(ngModel)]="selectedCategory" (change)="filterProducts()">
            <option value="">Todas las categorías</option>
            <option *ngFor="let category of categories" [value]="category.id">
              {{category.nombre}}
            </option>
          </select>
        </div>
      </div>

      <div class="products-grid" *ngIf="!isLoading">
        <div class="product-card" *ngFor="let product of filteredProducts">
          <div class="product-header">
            <h3>{{product.nombre}}</h3>
            <div class="product-actions">
              <button class="edit-btn" (click)="editProduct(product)" title="Editar">
                ✏️
              </button>
              <button class="delete-btn" (click)="deleteProduct(product)" title="Eliminar">
                🗑️
              </button>
            </div>
          </div>
          
          <div class="product-info">
            <p class="description">{{product.descripcion}}</p>
            <div class="product-details">
              <div class="detail-item">
                <span class="label">Precio:</span>
                <span class="value price">\${{product.precio | number:'1.2-2'}}</span>
              </div>
              <div class="detail-item">
                <span class="label">Stock:</span>
                <span class="value" [class.low-stock]="product.stock_actual <= product.stock_minimo">
                  {{product.stock_actual}} unidades
                </span>
              </div>
              <div class="detail-item">
                <span class="label">Stock Mínimo:</span>
                <span class="value">{{product.stock_minimo}}</span>
              </div>
              <div class="detail-item">
                <span class="label">Categoría:</span>
                <span class="value category">{{product.categoria_nombre}}</span>
              </div>
            </div>
          </div>
          
          <div class="stock-indicator" [class.low-stock]="product.stock_actual <= product.stock_minimo">
            <span *ngIf="product.stock_actual <= product.stock_minimo">⚠️ Stock Bajo</span>
            <span *ngIf="product.stock_actual > product.stock_minimo">✅ Stock OK</span>
          </div>
        </div>
      </div>

      <div class="loading" *ngIf="isLoading">
        <div class="spinner">🔄</div>
        <p>Cargando productos...</p>
      </div>

      <div class="empty-state" *ngIf="!isLoading && filteredProducts.length === 0">
        <div class="empty-icon">📦</div>
        <h3>No se encontraron productos</h3>
        <p>{{products.length === 0 ? 'Agrega tu primer producto para comenzar' : 'Intenta ajustar los filtros'}}</p>
        <button class="add-btn" (click)="openAddProduct()" *ngIf="products.length === 0">
          ➕ Agregar Primer Producto
        </button>
      </div>

      <!-- Modal para agregar/editar producto -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{editingProduct ? '✏️ Editar Producto' : '➕ Agregar Producto'}}</h2>
            <button class="close-btn" (click)="closeModal()">✖️</button>
          </div>
          
          <form class="product-form" (ngSubmit)="saveProduct()" #productForm="ngForm">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre *</label>
                <input 
                  type="text" 
                  [(ngModel)]="currentProduct.nombre"
                  name="nombre"
                  required
                  placeholder="Nombre del producto"
                >
              </div>
              <div class="form-group">
                <label>Categoría *</label>
                <select 
                  [(ngModel)]="currentProduct.categoria_id"
                  name="categoria_id"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  <option *ngFor="let category of categories" [value]="category.id">
                    {{category.nombre}}
                  </option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label>Descripción</label>
              <textarea 
                [(ngModel)]="currentProduct.descripcion"
                name="descripcion"
                placeholder="Descripción del producto"
                rows="3"
              ></textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Precio *</label>
                <input 
                  type="number" 
                  [(ngModel)]="currentProduct.precio"
                  name="precio"
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                >
              </div>
              <div class="form-group">
                <label>Stock Actual *</label>
                <input 
                  type="number" 
                  [(ngModel)]="currentProduct.stock_actual"
                  name="stock"
                  required
                  min="0"
                  placeholder="0"
                >
              </div>
              <div class="form-group">
                <label>Stock Mínimo *</label>
                <input 
                  type="number" 
                  [(ngModel)]="currentProduct.stock_minimo"
                  name="stock_minimo"
                  required
                  min="0"
                  placeholder="0"
                >
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="cancel-btn" (click)="closeModal()">
                Cancelar
              </button>
              <button type="submit" class="save-btn" [disabled]="!productForm.valid || isSaving">
                {{isSaving ? 'Guardando...' : (editingProduct ? 'Actualizar' : 'Guardar')}}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .products-container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
      font-family: 'Roboto', sans-serif;
    }
    
    .page-header {
      margin-bottom: 30px;
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
    }
    
    .header-content h1 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 500;
    }
    
    .add-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.3s ease;
    }
    
    .add-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }
    
    .filters-section {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    
    .search-box {
      flex: 1;
      min-width: 300px;
    }
    
    .search-box input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.3s ease;
    }
    
    .search-box input:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .filter-select select {
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      min-width: 200px;
    }
    
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }
    
    .product-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      padding: 20px;
      transition: all 0.3s ease;
      border: 1px solid #f0f0f0;
    }
    
    .product-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }
    
    .product-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }
    
    .product-header h3 {
      margin: 0;
      font-size: 1.3rem;
      color: #333;
      flex: 1;
    }
    
    .product-actions {
      display: flex;
      gap: 8px;
    }
    
    .edit-btn, .delete-btn {
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 5px;
      border-radius: 4px;
      transition: background-color 0.3s ease;
    }
    
    .edit-btn:hover {
      background-color: #e3f2fd;
    }
    
    .delete-btn:hover {
      background-color: #ffebee;
    }
    
    .description {
      color: #666;
      margin: 0 0 15px;
      font-size: 0.95rem;
      line-height: 1.4;
    }
    
    .product-details {
      display: grid;
      gap: 8px;
    }
    
    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    
    .label {
      font-weight: 500;
      color: #555;
      font-size: 0.9rem;
    }
    
    .value {
      color: #333;
      font-weight: 500;
    }
    
    .price {
      color: #2e7d32;
      font-size: 1.1rem;
    }
    
    .low-stock {
      color: #d32f2f !important;
    }
    
    .category {
      background: #667eea;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8rem;
    }
    
    .stock-indicator {
      margin-top: 15px;
      padding: 8px 12px;
      border-radius: 6px;
      text-align: center;
      font-size: 0.9rem;
      font-weight: 500;
      background: #e8f5e8;
      color: #2e7d32;
    }
    
    .stock-indicator.low-stock {
      background: #ffebee;
      color: #d32f2f;
    }
    
    .loading, .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }
    
    .spinner {
      font-size: 3rem;
      animation: spin 2s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .empty-icon {
      font-size: 4rem;
      margin-bottom: 20px;
    }
    
    .empty-state h3 {
      margin: 0 0 10px;
      color: #333;
    }
    
    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
    }
    
    .modal-header h2 {
      margin: 0;
      color: #333;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #666;
    }
    
    .product-form {
      padding: 20px;
    }
    
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #333;
    }
    
    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.3s ease;
    }
    
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 15px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    
    .cancel-btn {
      background: #f5f5f5;
      color: #666;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
    }
    
    .save-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.3s ease;
    }
    
    .save-btn:hover:not(:disabled) {
      background: #5a67d8;
    }
    
    .save-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    @media (max-width: 768px) {
      .products-container {
        padding: 10px;
      }
      
      .header-content {
        flex-direction: column;
        gap: 15px;
        text-align: center;
      }
      
      .filters-section {
        flex-direction: column;
      }
      
      .products-grid {
        grid-template-columns: 1fr;
      }
      
      .form-row {
        grid-template-columns: 1fr;
      }
      
      .modal-content {
        width: 95%;
        margin: 20px;
      }
    }
  `]
})
export class ProductsListComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];
  isLoading = true;
  isSaving = false;
  
  // Filtros
  searchTerm = '';
  selectedCategory = '';
  
  // Modal
  showModal = false;
  editingProduct: Product | null = null;
  currentProduct: Product = this.getEmptyProduct();

  constructor(
    private productsService: ProductsService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    
    // Cargar productos y categorías en paralelo
    Promise.all([
      this.productsService.getProducts().toPromise(),
      this.productsService.getCategories().toPromise()
    ]).then(([productsResponse, categoriesResponse]) => {


      
      if (productsResponse?.success) {
        this.products = productsResponse.data;
        this.filteredProducts = [...this.products];

      }
      
      if (categoriesResponse?.success) {
        // Manejar tanto el formato nuevo como el viejo
        this.categories = (categoriesResponse as any).categories || categoriesResponse.data || [];

      } else {
        console.error('❌ Error en respuesta de categorías:', categoriesResponse);
      }
      
      this.isLoading = false;
    }).catch(error => {
      console.error('❌ Error cargando datos:', error);
      this.isLoading = false;
    });
  }

  filterProducts(): void {
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = !this.searchTerm || 
        product.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        product.descripcion.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesCategory = !this.selectedCategory || 
        product.categoria_id.toString() === this.selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }

  openAddProduct(): void {
    this.editingProduct = null;
    this.currentProduct = this.getEmptyProduct();
    this.showModal = true;
  }

  editProduct(product: Product): void {
    this.editingProduct = product;
    this.currentProduct = { ...product };
    this.showModal = true;
  }

  deleteProduct(product: Product): void {
    if (confirm(`¿Estás seguro de que quieres eliminar "${product.nombre}"?`)) {
      this.productsService.deleteProduct(product.id!).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadData();
            alert('Producto eliminado exitosamente');
          }
        },
        error: (error) => {
          console.error('Error eliminando producto:', error);
          alert('Error al eliminar el producto');
        }
      });
    }
  }

  saveProduct(): void {
    this.isSaving = true;
    
    const operation = this.editingProduct 
      ? this.productsService.updateProduct(this.editingProduct.id!, this.currentProduct)
      : this.productsService.createProduct(this.currentProduct);
    
    operation.subscribe({
      next: (response) => {
        this.isSaving = false;
        if (response.success) {
          this.closeModal();
          this.loadData();
          alert(this.editingProduct ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente');
        }
      },
      error: (error) => {
        this.isSaving = false;
        console.error('Error guardando producto:', error);
        alert('Error al guardar el producto');
      }
    });
  }

  closeModal(): void {
    this.showModal = false;
    this.editingProduct = null;
    this.currentProduct = this.getEmptyProduct();
  }

  private getEmptyProduct(): Product {
    return {
      nombre: '',
      descripcion: '',
      precio: 0,
      stock_actual: 0,
      stock_minimo: 0,
      categoria_id: 0
    };
  }
}
