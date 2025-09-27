# Sistema de Inventarios

Sistema de gestión de inventarios desarrollado con **Angular 17**, **Express.js** y **MySQL**.

## Características

- **Autenticación JWT** con roles y permisos
- **Sistema de usuarios** con diferentes niveles de acceso
- **Gestión de productos** completa (CRUD)
- **Categorías** organizadas y flexibles
- **Dashboard** con métricas y estadísticas
- **Reportes** detallados y exportables
- **Movimientos de inventario** (entradas, salidas, ajustes)
- **Responsive design** para móviles y tablets

## 🛠️ Tecnologías

### Frontend
- **Angular 17** - Framework principal
- **TypeScript** - Lenguaje de programación
- **SCSS** - Estilos avanzados
- **RxJS** - Programación reactiva
- **Chart.js** - Gráficos y visualizaciones

### Backend
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **MySQL** - Base de datos relacional
- **JWT** - Autenticación
- **bcrypt** - Encriptación de contraseñas

## 📋 Requisitos Previos

- **Node.js** 18+ 
- **MySQL** 8.0+
- **npm** o **yarn**
- **Git**

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone [URL_DE_TU_REPOSITORIO]
cd proyecto-inventario-2
```

### 2. Instalar dependencias

```bash
# Instalar dependencias del proyecto principal
npm install

# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install
```

### 3. Configurar base de datos

1. Crear una base de datos MySQL llamada `inventario_db`
2. Ejecutar el script SQL en `backend/database/schema.sql`
3. Crear el archivo `backend/config.env` con las configuraciones de base de datos

### 4. Ejecutar la aplicación

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
ng serve
```

## 🌐 Acceso

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3000/api
- **Usuario por defecto**: 
  - Username: `admin`
  - Password: `admin123`

## 🔧 Configuración

### Variables de Entorno

Configura el archivo `backend/config.env` con tus credenciales de base de datos y configuraciones del servidor.

## Funcionalidades

### Autenticación y Autorización
- Login con JWT
- Roles: Admin, Supervisor, Usuario
- Permisos granulares por funcionalidad
- Refresh tokens automático

### Gestión de Productos
- CRUD completo de productos
- Categorías organizadas
- Imágenes y descripciones
- Control de stock
- Precios y costos

### Inventario
- Entradas de stock
- Salidas de inventario
- Ajustes de inventario
- Historial de movimientos
- Alertas de stock bajo

### Gestión de Usuarios
- Crear y editar usuarios
- Asignar roles
- Activar/desactivar usuarios
- Historial de actividad

### Reportes
- Dashboard con métricas
- Reportes de inventario
- Análisis de movimientos
- Tendencias y estadísticas
- Exportación de datos