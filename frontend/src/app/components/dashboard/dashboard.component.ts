import { Component, OnInit } from '@angular/core';
import { AuthService, User } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div class="header-content">
          <div class="welcome-section">
            <h1>¡Bienvenido, {{currentUser?.nombre}}! 👋</h1>
            <p>Sistema de Inventarios - Panel de Control</p>
          </div>
          <button class="logout-btn" (click)="logout()">
            Cerrar Sesión
          </button>
        </div>
      </header>
      
      <main class="dashboard-main">
        <div class="user-info-card">
          <h2>Información del Usuario</h2>
          <div class="user-details">
            <div class="detail-item">
              <span class="label">Usuario:</span>
              <span class="value">{{currentUser?.username}}</span>
            </div>
            <div class="detail-item">
              <span class="label">Nombre:</span>
              <span class="value">{{currentUser?.nombre}} {{currentUser?.apellido}}</span>
            </div>
            <div class="detail-item">
              <span class="label">Email:</span>
              <span class="value">{{currentUser?.email}}</span>
            </div>
            <div class="detail-item">
              <span class="label">Rol:</span>
              <span class="value role">{{currentUser?.rol}}</span>
            </div>
          </div>
        </div>
        
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">📦</div>
            <h3>Productos</h3>
            <p>Gestiona tu catálogo de productos</p>
            <button class="feature-btn" (click)="goToProducts()">Ver Productos</button>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">📊</div>
            <h3>Inventario</h3>
            <p>Control de stock y movimientos</p>
            <button class="feature-btn" disabled>Próximamente</button>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>Usuarios</h3>
            <p>Administra usuarios del sistema</p>
            <button class="feature-btn" disabled>Próximamente</button>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">📈</div>
            <h3>Reportes</h3>
            <p>Estadísticas y análisis</p>
            <button class="feature-btn" disabled>Próximamente</button>
          </div>
        </div>
        
        <div class="system-status">
          <h2>Estado del Sistema</h2>
          <div class="status-grid">
            <div class="status-item success">
              <span class="status-icon">✅</span>
              <span>Frontend: Funcionando</span>
            </div>
            <div class="status-item success">
              <span class="status-icon">✅</span>
              <span>Backend: Conectado</span>
            </div>
            <div class="status-item success">
              <span class="status-icon">✅</span>
              <span>Base de datos: Activa</span>
            </div>
            <div class="status-item success">
              <span class="status-icon">✅</span>
              <span>Autenticación: OK</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .dashboard-container {
      min-height: 100vh;
      background: #f5f5f5;
      font-family: 'Roboto', sans-serif;
    }
    
    .dashboard-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1.5rem 2rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .welcome-section h1 {
      margin: 0 0 0.5rem;
      font-size: 1.8rem;
      font-weight: 500;
    }
    
    .welcome-section p {
      margin: 0;
      opacity: 0.9;
      font-size: 1rem;
    }
    
    .logout-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.3s ease;
    }
    
    .logout-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    .dashboard-main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    
    .user-info-card {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .user-info-card h2 {
      margin: 0 0 1rem;
      color: #333;
      font-size: 1.3rem;
    }
    
    .user-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }
    
    .detail-item {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid #eee;
    }
    
    .label {
      font-weight: 500;
      color: #666;
    }
    
    .value {
      color: #333;
    }
    
    .role {
      background: #667eea;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      text-transform: uppercase;
    }
    
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }
    
    .feature-card {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      text-align: center;
      transition: transform 0.3s ease;
    }
    
    .feature-card:hover {
      transform: translateY(-2px);
    }
    
    .feature-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    
    .feature-card h3 {
      margin: 0 0 0.5rem;
      color: #333;
      font-size: 1.2rem;
    }
    
    .feature-card p {
      margin: 0 0 1rem;
      color: #666;
      font-size: 0.9rem;
    }
    
    .feature-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.3s ease;
    }
    
    .feature-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .feature-btn:not(:disabled):hover {
      background: #5a67d8;
    }
    
    .system-status {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .system-status h2 {
      margin: 0 0 1rem;
      color: #333;
      font-size: 1.3rem;
    }
    
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    
    .status-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    
    .status-item.success {
      background: #e8f5e8;
      color: #2e7d32;
    }
    
    .status-icon {
      font-size: 1.1rem;
    }
    
    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }
      
      .dashboard-main {
        padding: 1rem;
      }
      
      .user-details {
        grid-template-columns: 1fr;
      }
      
      .features-grid {
        grid-template-columns: 1fr;
      }
      
      .status-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Verificar autenticación
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goToProducts(): void {
    this.router.navigate(['/products']);
  }
}
