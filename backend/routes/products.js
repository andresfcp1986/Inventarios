const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación
router.use(authenticateToken);

// GET /api/products - Obtener productos
router.get('/', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver productos'
      });
    }

    // Query con JOIN para obtener nombre de categoría
    const products = await executeQuery(`
      SELECT 
        p.id,
        p.codigo,
        p.nombre,
        p.descripcion,
        p.precio,
        p.precio_compra,
        p.stock_minimo,
        p.stock_actual,
        p.categoria_id,
        p.imagen,
        p.activo,
        p.created_at,
        p.updated_at,
        c.nombre as categoria_nombre
      FROM productos p 
      LEFT JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.activo = 1 
      ORDER BY p.created_at DESC
    `);

    // Query para categorías
    const categories = await executeQuery('SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre');

    const response = {
      success: true,
      data: Array.isArray(products) ? products : (products ? [products] : []),
      categories: Array.isArray(categories) ? categories : (categories ? [categories] : [])
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error en productos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la lista de productos'
    });
  }
});

// POST /api/products - Crear producto
router.post('/', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para crear productos'
      });
    }

    const { nombre, descripcion, precio, stock, stock_minimo, categoria_id } = req.body;

    // Generar código único para el producto
    const codigo = `PROD-${Date.now()}`;

    // Insertar producto
    const result = await executeQuery(
      'INSERT INTO productos (codigo, nombre, descripcion, precio, stock_actual, stock_minimo, categoria_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [codigo, nombre, descripcion || '', precio, stock_actual, stock_minimo, categoria_id]
    );


    res.json({
      success: true,
      message: 'Producto creado exitosamente',
      data: {
        id: result.insertId,
        codigo,
        nombre,
        descripcion,
        precio,
        stock,
        stock_minimo,
        categoria_id
      }
    });

  } catch (error) {
    console.error('❌ Error creando producto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error creando el producto'
    });
  }
});

// PUT /api/products/:id - Actualizar producto
router.put('/:id', async (req, res) => {
  try {
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para actualizar productos'
      });
    }

    const { id } = req.params;
    const { nombre, descripcion, precio, stock_actual, stock_minimo, categoria_id } = req.body;

    const result = await executeQuery(
      'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock_actual = ?, stock_minimo = ?, categoria_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND activo = 1',
      [nombre, descripcion || '', precio, stock, stock_minimo, categoria_id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto no existe o ya fue eliminado'
      });
    }

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: { id, nombre, descripcion, precio, stock, stock_minimo, categoria_id }
    });

  } catch (error) {
    console.error('❌ Error actualizando producto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error actualizando el producto'
    });
  }
});

// DELETE /api/products/:id - Eliminar producto (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para eliminar productos'
      });
    }

    const { id } = req.params;

    const result = await executeQuery(
      'UPDATE productos SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND activo = 1',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto no existe o ya fue eliminado'
      });
    }

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando producto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error eliminando el producto'
    });
  }
});

module.exports = router;