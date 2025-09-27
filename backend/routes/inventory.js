const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { executeQuery, executeTransaction } = require('../config/database');
const { authenticateToken, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Validaciones para movimientos de inventario
const inventoryValidation = [
  body('producto_id')
    .isInt({ min: 1 })
    .withMessage('El ID del producto es requerido'),
  body('tipo')
    .isIn(['entrada', 'salida', 'ajuste'])
    .withMessage('El tipo debe ser entrada, salida o ajuste'),
  body('cantidad')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número entero positivo'),
  body('motivo')
    .optional()
    .isLength({ max: 500 })
    .withMessage('El motivo no puede exceder 500 caracteres')
];

// GET /api/inventory - Obtener movimientos de inventario
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe estar entre 1 y 100'),
  query('tipo').optional().isIn(['entrada', 'salida', 'ajuste']).withMessage('Tipo de movimiento inválido'),
  query('producto_id').optional().isInt({ min: 1 }).withMessage('ID de producto inválido'),
  query('fecha_inicio').optional().isISO8601().withMessage('Fecha de inicio inválida'),
  query('fecha_fin').optional().isISO8601().withMessage('Fecha de fin inválida')
], async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.inventory) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver movimientos de inventario'
      });
    }

    const { page = 1, limit = 10, tipo, producto_id, fecha_inicio, fecha_fin } = req.query;
    const offset = (page - 1) * limit;

    // Construir query base
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (tipo) {
      whereClause += ' AND m.tipo = ?';
      params.push(tipo);
    }

    if (producto_id) {
      whereClause += ' AND m.producto_id = ?';
      params.push(producto_id);
    }

    if (fecha_inicio) {
      whereClause += ' AND DATE(m.fecha_movimiento) >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND DATE(m.fecha_movimiento) <= ?';
      params.push(fecha_fin);
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
      `SELECT m.*, p.nombre as producto_nombre, p.codigo as producto_codigo, p.stock_actual,
              u.nombre as usuario_nombre, u.apellido as usuario_apellido
       FROM movimientos_inventario m
       JOIN productos p ON m.producto_id = p.id
       JOIN usuarios u ON m.usuario_id = u.id
       ${whereClause}
       ORDER BY m.fecha_movimiento DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        movements,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo movimientos de inventario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo los movimientos de inventario'
    });
  }
});

// POST /api/inventory/entrada - Registrar entrada de inventario
router.post('/entrada', inventoryValidation, async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.inventory) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para registrar entradas de inventario'
      });
    }

    // Verificar validaciones
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { producto_id, cantidad, motivo } = req.body;
    const usuario_id = req.user.id;

    // Verificar si el producto existe y está activo
    const [products] = await executeQuery(
      'SELECT id, nombre, stock_actual FROM productos WHERE id = ? AND activo = 1',
      [producto_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe o está inactivo'
      });
    }

    const producto = products[0];
    const cantidad_anterior = producto.stock_actual;
    const cantidad_nueva = cantidad_anterior + cantidad;

    // Ejecutar transacción para registrar entrada y actualizar stock
    const queries = [
      {
        query: `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, cantidad_anterior, cantidad_nueva, motivo, usuario_id) 
                VALUES (?, 'entrada', ?, ?, ?, ?, ?)`,
        params: [producto_id, cantidad, cantidad_anterior, cantidad_nueva, motivo, usuario_id]
      },
      {
        query: 'UPDATE productos SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        params: [cantidad_nueva, producto_id]
      }
    ];

    await executeTransaction(queries);

    res.status(201).json({
      success: true,
      message: 'Entrada de inventario registrada exitosamente',
      data: {
        movimiento: {
          producto_id: parseInt(producto_id),
          producto_nombre: producto.nombre,
          tipo: 'entrada',
          cantidad: parseInt(cantidad),
          cantidad_anterior,
          cantidad_nueva,
          motivo,
          usuario_id: parseInt(usuario_id)
        }
      }
    });

  } catch (error) {
    console.error('Error registrando entrada de inventario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error registrando la entrada de inventario'
    });
  }
});

// POST /api/inventory/salida - Registrar salida de inventario
router.post('/salida', inventoryValidation, async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.inventory) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para registrar salidas de inventario'
      });
    }

    // Verificar validaciones
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { producto_id, cantidad, motivo } = req.body;
    const usuario_id = req.user.id;

    // Verificar si el producto existe y está activo
    const [products] = await executeQuery(
      'SELECT id, nombre, stock_actual FROM productos WHERE id = ? AND activo = 1',
      [producto_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe o está inactivo'
      });
    }

    const producto = products[0];
    const cantidad_anterior = producto.stock_actual;

    // Verificar si hay suficiente stock
    if (cantidad_anterior < cantidad) {
      return res.status(400).json({
        error: 'Stock insuficiente',
        message: `No hay suficiente stock. Disponible: ${cantidad_anterior}, Solicitado: ${cantidad}`
      });
    }

    const cantidad_nueva = cantidad_anterior - cantidad;

    // Ejecutar transacción para registrar salida y actualizar stock
    const queries = [
      {
        query: `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, cantidad_anterior, cantidad_nueva, motivo, usuario_id) 
                VALUES (?, 'salida', ?, ?, ?, ?, ?)`,
        params: [producto_id, cantidad, cantidad_anterior, cantidad_nueva, motivo, usuario_id]
      },
      {
        query: 'UPDATE productos SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        params: [cantidad_nueva, producto_id]
      }
    ];

    await executeTransaction(queries);

    res.status(201).json({
      success: true,
      message: 'Salida de inventario registrada exitosamente',
      data: {
        movimiento: {
          producto_id: parseInt(producto_id),
          producto_nombre: producto.nombre,
          tipo: 'salida',
          cantidad: parseInt(cantidad),
          cantidad_anterior,
          cantidad_nueva,
          motivo,
          usuario_id: parseInt(usuario_id)
        }
      }
    });

  } catch (error) {
    console.error('Error registrando salida de inventario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error registrando la salida de inventario'
    });
  }
});

// POST /api/inventory/ajuste - Registrar ajuste de inventario
router.post('/ajuste', inventoryValidation, async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.inventory) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para registrar ajustes de inventario'
      });
    }

    // Verificar validaciones
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { producto_id, cantidad, motivo } = req.body;
    const usuario_id = req.user.id;

    // Verificar si el producto existe y está activo
    const [products] = await executeQuery(
      'SELECT id, nombre, stock_actual FROM productos WHERE id = ? AND activo = 1',
      [producto_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe o está inactivo'
      });
    }

    const producto = products[0];
    const cantidad_anterior = producto.stock_actual;
    const cantidad_nueva = cantidad;

    // Ejecutar transacción para registrar ajuste y actualizar stock
    const queries = [
      {
        query: `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, cantidad_anterior, cantidad_nueva, motivo, usuario_id) 
                VALUES (?, 'ajuste', ?, ?, ?, ?, ?)`,
        params: [producto_id, Math.abs(cantidad_nueva - cantidad_anterior), cantidad_anterior, cantidad_nueva, motivo, usuario_id]
      },
      {
        query: 'UPDATE productos SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        params: [cantidad_nueva, producto_id]
      }
    ];

    await executeTransaction(queries);

    res.status(201).json({
      success: true,
      message: 'Ajuste de inventario registrado exitosamente',
      data: {
        movimiento: {
          producto_id: parseInt(producto_id),
          producto_nombre: producto.nombre,
          tipo: 'ajuste',
          cantidad: Math.abs(cantidad_nueva - cantidad_anterior),
          cantidad_anterior,
          cantidad_nueva,
          motivo,
          usuario_id: parseInt(usuario_id)
        }
      }
    });

  } catch (error) {
    console.error('Error registrando ajuste de inventario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error registrando el ajuste de inventario'
    });
  }
});

// GET /api/inventory/stock-bajo - Obtener productos con stock bajo
router.get('/stock-bajo', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.inventory) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver productos con stock bajo'
      });
    }

    const [products] = await executeQuery(
      `SELECT p.*, c.nombre as categoria_nombre
       FROM productos p
       JOIN categorias c ON p.categoria_id = c.id
       WHERE p.activo = 1 AND p.stock_actual <= p.stock_minimo
       ORDER BY (p.stock_minimo - p.stock_actual) DESC, p.nombre`
    );

    res.json({
      success: true,
      data: {
        products,
        total: products.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo productos con stock bajo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo productos con stock bajo'
    });
  }
});

// GET /api/inventory/resumen - Obtener resumen del inventario
router.get('/resumen', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.inventory) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver el resumen del inventario'
      });
    }

    // Obtener estadísticas generales
    const [stats] = await executeQuery(
      `SELECT 
        COUNT(*) as total_productos,
        SUM(stock_actual) as stock_total,
        SUM(precio * stock_actual) as valor_total,
        COUNT(CASE WHEN stock_actual <= stock_minimo THEN 1 END) as productos_stock_bajo,
        COUNT(CASE WHEN stock_actual = 0 THEN 1 END) as productos_sin_stock
       FROM productos 
       WHERE activo = 1`
    );

    // Obtener movimientos del día
    const [todayMovements] = await executeQuery(
      `SELECT COUNT(*) as total_movimientos
       FROM movimientos_inventario 
       WHERE DATE(fecha_movimiento) = CURDATE()`
    );

    // Obtener productos más movidos (últimos 30 días)
    const [topProducts] = await executeQuery(
      `SELECT p.nombre, p.codigo, COUNT(m.id) as movimientos
       FROM productos p
       JOIN movimientos_inventario m ON p.id = m.producto_id
       WHERE m.fecha_movimiento >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY p.id
       ORDER BY movimientos DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        resumen: {
          ...stats[0],
          movimientos_hoy: todayMovements[0].total_movimientos
        },
        top_productos: topProducts
      }
    });

  } catch (error) {
    console.error('Error obteniendo resumen del inventario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo el resumen del inventario'
    });
  }
});

// GET /api/inventory/:id - Obtener movimiento específico
router.get('/:id', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.inventory) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver movimientos de inventario'
      });
    }

    const { id } = req.params;

    const [movements] = await executeQuery(
      `SELECT m.*, p.nombre as producto_nombre, p.codigo as producto_codigo,
              u.nombre as usuario_nombre, u.apellido as usuario_apellido
       FROM movimientos_inventario m
       JOIN productos p ON m.producto_id = p.id
       JOIN usuarios u ON m.usuario_id = u.id
       WHERE m.id = ?`,
      [id]
    );

    if (movements.length === 0) {
      return res.status(404).json({
        error: 'Movimiento no encontrado',
        message: 'El movimiento solicitado no existe'
      });
    }

    res.json({
      success: true,
      data: {
        movement: movements[0]
      }
    });

  } catch (error) {
    console.error('Error obteniendo movimiento:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo el movimiento'
    });
  }
});

module.exports = router;
