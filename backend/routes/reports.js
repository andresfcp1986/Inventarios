const express = require('express');
const { query, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// GET /api/reports/dashboard - Obtener datos del dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.reports) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver reportes'
      });
    }

    // Obtener estadísticas generales
    const [generalStats] = await executeQuery(
      `SELECT 
        COUNT(*) as total_productos,
        SUM(stock_actual) as stock_total,
        SUM(precio * stock_actual) as valor_total,
        COUNT(CASE WHEN stock_actual <= stock_minimo THEN 1 END) as productos_stock_bajo,
        COUNT(CASE WHEN stock_actual = 0 THEN 1 END) as productos_sin_stock,
        COUNT(DISTINCT categoria_id) as total_categorias
       FROM productos 
       WHERE activo = 1`
    );

    // Obtener estadísticas de usuarios
    const [userStats] = await executeQuery(
      `SELECT 
        COUNT(*) as total_usuarios,
        COUNT(CASE WHEN activo = 1 THEN 1 END) as usuarios_activos,
        COUNT(CASE WHEN ultimo_login >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as usuarios_activos_semana
       FROM usuarios`
    );

    // Obtener movimientos del día
    const [todayStats] = await executeQuery(
      `SELECT 
        COUNT(*) as total_movimientos,
        COUNT(CASE WHEN tipo = 'entrada' THEN 1 END) as entradas,
        COUNT(CASE WHEN tipo = 'salida' THEN 1 END) as salidas,
        COUNT(CASE WHEN tipo = 'ajuste' THEN 1 END) as ajustes
       FROM movimientos_inventario 
       WHERE DATE(fecha_movimiento) = CURDATE()`
    );

    // Obtener productos más movidos (últimos 7 días)
    const [topProducts] = await executeQuery(
      `SELECT p.nombre, p.codigo, COUNT(m.id) as movimientos
       FROM productos p
       JOIN movimientos_inventario m ON p.id = m.producto_id
       WHERE m.fecha_movimiento >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY p.id
       ORDER BY movimientos DESC
       LIMIT 5`
    );

    // Obtener categorías con más productos
    const [topCategories] = await executeQuery(
      `SELECT c.nombre, COUNT(p.id) as total_productos, SUM(p.stock_actual) as stock_total
       FROM categorias c
       JOIN productos p ON c.id = p.categoria_id
       WHERE c.activo = 1 AND p.activo = 1
       GROUP BY c.id
       ORDER BY total_productos DESC
       LIMIT 5`
    );

    // Obtener usuarios más activos (últimos 30 días)
    const [topUsers] = await executeQuery(
      `SELECT u.nombre, u.apellido, COUNT(m.id) as movimientos
       FROM usuarios u
       JOIN movimientos_inventario m ON u.id = m.usuario_id
       WHERE m.fecha_movimiento >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY u.id
       ORDER BY movimientos DESC
       LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        general: generalStats[0],
        usuarios: userStats[0],
        hoy: todayStats[0],
        top_productos: topProducts,
        top_categorias: topCategories,
        top_usuarios: topUsers
      }
    });

  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo los datos del dashboard'
    });
  }
});

// GET /api/reports/inventory - Reporte detallado de inventario
router.get('/inventory', [
  query('categoria_id').optional().isInt({ min: 1 }).withMessage('ID de categoría inválido'),
  query('stock_minimo').optional().isInt({ min: 0 }).withMessage('Stock mínimo inválido'),
  query('orden').optional().isIn(['nombre', 'stock', 'precio', 'categoria']).withMessage('Orden inválido')
], async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.reports) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver reportes'
      });
    }

    const { categoria_id, stock_minimo, orden = 'nombre' } = req.query;

    // Construir query base
    let whereClause = 'WHERE p.activo = 1';
    let params = [];

    if (categoria_id) {
      whereClause += ' AND p.categoria_id = ?';
      params.push(categoria_id);
    }

    if (stock_minimo !== undefined) {
      whereClause += ' AND p.stock_actual <= ?';
      params.push(parseInt(stock_minimo));
    }

    // Construir orden
    let orderClause = 'ORDER BY ';
    switch (orden) {
      case 'stock':
        orderClause += 'p.stock_actual ASC';
        break;
      case 'precio':
        orderClause += 'p.precio DESC';
        break;
      case 'categoria':
        orderClause += 'c.nombre, p.nombre';
        break;
      default:
        orderClause += 'p.nombre';
    }

    const [products] = await executeQuery(
      `SELECT p.*, c.nombre as categoria_nombre,
              (p.precio * p.stock_actual) as valor_stock,
              CASE 
                WHEN p.stock_actual = 0 THEN 'Sin stock'
                WHEN p.stock_actual <= p.stock_minimo THEN 'Stock bajo'
                ELSE 'Stock normal'
              END as estado_stock
       FROM productos p
       JOIN categorias c ON p.categoria_id = c.id
       ${whereClause}
       ${orderClause}`,
      params
    );

    // Obtener resumen por categoría
    const [categorySummary] = await executeQuery(
      `SELECT c.nombre as categoria,
              COUNT(p.id) as total_productos,
              SUM(p.stock_actual) as stock_total,
              SUM(p.precio * p.stock_actual) as valor_total,
              COUNT(CASE WHEN p.stock_actual <= p.stock_minimo THEN 1 END) as productos_stock_bajo
       FROM categorias c
       JOIN productos p ON c.id = p.categoria_id
       WHERE c.activo = 1 AND p.activo = 1
       GROUP BY c.id
       ORDER BY total_productos DESC`
    );

    res.json({
      success: true,
      data: {
        productos: products,
        resumen_categorias: categorySummary,
        total_productos: products.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo reporte de inventario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo el reporte de inventario'
    });
  }
});

// GET /api/reports/movements - Reporte de movimientos
router.get('/movements', [
  query('fecha_inicio').optional().isISO8601().withMessage('Fecha de inicio inválida'),
  query('fecha_fin').optional().isISO8601().withMessage('Fecha de fin inválida'),
  query('tipo').optional().isIn(['entrada', 'salida', 'ajuste']).withMessage('Tipo inválido'),
  query('usuario_id').optional().isInt({ min: 1 }).withMessage('ID de usuario inválido'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite inválido')
], async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.reports) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver reportes'
      });
    }

    const { fecha_inicio, fecha_fin, tipo, usuario_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Construir query base
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (fecha_inicio) {
      whereClause += ' AND DATE(m.fecha_movimiento) >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND DATE(m.fecha_movimiento) <= ?';
      params.push(fecha_fin);
    }

    if (tipo) {
      whereClause += ' AND m.tipo = ?';
      params.push(tipo);
    }

    if (usuario_id) {
      whereClause += ' AND m.usuario_id = ?';
      params.push(usuario_id);
    }

    // Query para contar total
    const [countResult] = await executeQuery(
      `SELECT COUNT(*) as total 
       FROM movimientos_inventario m
       JOIN productos p ON m.producto_id = p.id
       JOIN usuarios u ON m.usuario_id = u.id
       ${whereClause}`,
      params
    );

    const total = countResult[0].total;

    // Query para obtener movimientos
    const [movements] = await executeQuery(
      `SELECT m.*, p.nombre as producto_nombre, p.codigo as producto_codigo,
              u.nombre as usuario_nombre, u.apellido as usuario_apellido,
              c.nombre as categoria_nombre
       FROM movimientos_inventario m
       JOIN productos p ON m.producto_id = p.id
       JOIN usuarios u ON m.usuario_id = u.id
       JOIN categorias c ON p.categoria_id = c.id
       ${whereClause}
       ORDER BY m.fecha_movimiento DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Obtener resumen por tipo
    const [typeSummary] = await executeQuery(
      `SELECT tipo, COUNT(*) as total, SUM(cantidad) as cantidad_total
       FROM movimientos_inventario m
       ${whereClause}
       GROUP BY tipo`,
      params
    );

    // Obtener resumen por usuario
    const [userSummary] = await executeQuery(
      `SELECT u.nombre, u.apellido, COUNT(m.id) as total_movimientos
       FROM usuarios u
       JOIN movimientos_inventario m ON u.id = m.usuario_id
       ${whereClause}
       GROUP BY u.id
       ORDER BY total_movimientos DESC
       LIMIT 10`,
      params
    );

    res.json({
      success: true,
      data: {
        movimientos: movements,
        resumen_tipos: typeSummary,
        resumen_usuarios: userSummary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo reporte de movimientos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo el reporte de movimientos'
    });
  }
});

// GET /api/reports/trends - Tendencias y análisis
router.get('/trends', [
  query('periodo').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Período inválido')
], async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.reports) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver reportes'
      });
    }

    const { periodo = '30d' } = req.query;

    // Calcular fecha de inicio según período
    let dateInterval;
    switch (periodo) {
      case '7d':
        dateInterval = 'INTERVAL 7 DAY';
        break;
      case '90d':
        dateInterval = 'INTERVAL 90 DAY';
        break;
      case '1y':
        dateInterval = 'INTERVAL 1 YEAR';
        break;
      default:
        dateInterval = 'INTERVAL 30 DAY';
    }

    // Obtener tendencia de movimientos por día
    const [dailyTrends] = await executeQuery(
      `SELECT 
        DATE(m.fecha_movimiento) as fecha,
        COUNT(*) as total_movimientos,
        COUNT(CASE WHEN m.tipo = 'entrada' THEN 1 END) as entradas,
        COUNT(CASE WHEN m.tipo = 'salida' THEN 1 END) as salidas,
        COUNT(CASE WHEN m.tipo = 'ajuste' THEN 1 END) as ajustes
       FROM movimientos_inventario m
       WHERE m.fecha_movimiento >= DATE_SUB(CURDATE(), ${dateInterval})
       GROUP BY DATE(m.fecha_movimiento)
       ORDER BY fecha DESC`
    );

    // Obtener productos más movidos en el período
    const [topProducts] = await executeQuery(
      `SELECT p.nombre, p.codigo, 
              COUNT(m.id) as total_movimientos,
              SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) as entradas,
              SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END) as salidas
       FROM productos p
       JOIN movimientos_inventario m ON p.id = m.producto_id
       WHERE m.fecha_movimiento >= DATE_SUB(CURDATE(), ${dateInterval})
       GROUP BY p.id
       ORDER BY total_movimientos DESC
       LIMIT 10`
    );

    // Obtener evolución del stock total
    const [stockEvolution] = await executeQuery(
      `SELECT 
        DATE(m.fecha_movimiento) as fecha,
        SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) as entradas_totales,
        SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END) as salidas_totales,
        SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE -m.cantidad END) as balance
       FROM movimientos_inventario m
       WHERE m.fecha_movimiento >= DATE_SUB(CURDATE(), ${dateInterval})
       GROUP BY DATE(m.fecha_movimiento)
       ORDER BY fecha DESC`
    );

    // Obtener categorías más activas
    const [topCategories] = await executeQuery(
      `SELECT c.nombre,
              COUNT(m.id) as total_movimientos,
              SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) as entradas,
              SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END) as salidas
       FROM categorias c
       JOIN productos p ON c.id = p.categoria_id
       JOIN movimientos_inventario m ON p.id = m.producto_id
       WHERE m.fecha_movimiento >= DATE_SUB(CURDATE(), ${dateInterval})
       GROUP BY c.id
       ORDER BY total_movimientos DESC
       LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        periodo,
        tendencias_diarias: dailyTrends,
        top_productos: topProducts,
        evolucion_stock: stockEvolution,
        top_categorias: topCategories
      }
    });

  } catch (error) {
    console.error('Error obteniendo tendencias:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo las tendencias'
    });
  }
});

// GET /api/reports/export - Exportar reporte (simulado)
router.get('/export', [
  query('tipo').isIn(['inventario', 'movimientos', 'tendencias']).withMessage('Tipo de reporte inválido'),
  query('formato').optional().isIn(['json', 'csv']).withMessage('Formato inválido')
], async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.reports) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para exportar reportes'
      });
    }

    const { tipo, formato = 'json' } = req.query;

    // Simular exportación
    res.json({
      success: true,
      message: `Reporte de ${tipo} exportado exitosamente`,
      data: {
        tipo,
        formato,
        url_descarga: `/downloads/report_${tipo}_${Date.now()}.${formato}`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error exportando reporte:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error exportando el reporte'
    });
  }
});

module.exports = router;
