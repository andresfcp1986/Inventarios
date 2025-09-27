const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Validaciones para categorías
const categoryValidation = [
  body('nombre')
    .notEmpty()
    .withMessage('El nombre de la categoría es requerido')
    .isLength({ max: 100 })
    .withMessage('El nombre no puede exceder 100 caracteres'),
  body('descripcion')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('imagen')
    .optional()
    .isURL()
    .withMessage('La imagen debe ser una URL válida')
];

// GET /api/categories - Obtener todas las categorías
router.get('/', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver categorías'
      });
    }

    const categories = await executeQuery(
      'SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre'
    );

    // Asegurar que categories es un array
    const categoryList = Array.isArray(categories) ? categories : [categories];

    res.json({
      success: true,
      data: categoryList
    });

  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la lista de categorías'
    });
  }
});

// GET /api/categories/:id - Obtener categoría por ID
router.get('/:id', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver categorías'
      });
    }

    const { id } = req.params;

    const [categories] = await executeQuery(
      'SELECT * FROM categorias WHERE id = ? AND activo = 1',
      [id]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        message: 'La categoría solicitada no existe'
      });
    }

    res.json({
      success: true,
      data: {
        category: categories[0]
      }
    });

  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la categoría'
    });
  }
});

// POST /api/categories - Crear nueva categoría
router.post('/', categoryValidation, async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para crear categorías'
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

    const { nombre, descripcion, imagen } = req.body;

    // Verificar si el nombre ya existe
    const [existingCategories] = await executeQuery(
      'SELECT id FROM categorias WHERE nombre = ? AND activo = 1',
      [nombre]
    );

    if (existingCategories.length > 0) {
      return res.status(400).json({
        error: 'Nombre duplicado',
        message: 'Ya existe una categoría con este nombre'
      });
    }

    // Crear categoría
    const [result] = await executeQuery(
      'INSERT INTO categorias (nombre, descripcion, imagen) VALUES (?, ?, ?)',
      [nombre, descripcion, imagen]
    );

    // Obtener categoría creada
    const [newCategories] = await executeQuery(
      'SELECT * FROM categorias WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: {
        category: newCategories[0]
      }
    });

  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error creando la categoría'
    });
  }
});

// PUT /api/categories/:id - Actualizar categoría
router.put('/:id', categoryValidation, async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para actualizar categorías'
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

    const { id } = req.params;
    const { nombre, descripcion, imagen } = req.body;

    // Verificar si la categoría existe
    const [existingCategories] = await executeQuery(
      'SELECT id FROM categorias WHERE id = ? AND activo = 1',
      [id]
    );

    if (existingCategories.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        message: 'La categoría a actualizar no existe'
      });
    }

    // Verificar si el nombre ya existe en otra categoría
    const [duplicateNames] = await executeQuery(
      'SELECT id FROM categorias WHERE nombre = ? AND id != ? AND activo = 1',
      [nombre, id]
    );

    if (duplicateNames.length > 0) {
      return res.status(400).json({
        error: 'Nombre duplicado',
        message: 'Ya existe otra categoría con este nombre'
      });
    }

    // Actualizar categoría
    await executeQuery(
      'UPDATE categorias SET nombre = ?, descripcion = ?, imagen = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nombre, descripcion, imagen, id]
    );

    // Obtener categoría actualizada
    const [updatedCategories] = await executeQuery(
      'SELECT * FROM categorias WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: {
        category: updatedCategories[0]
      }
    });

  } catch (error) {
    console.error('Error actualizando categoría:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error actualizando la categoría'
    });
  }
});

// DELETE /api/categories/:id - Eliminar categoría (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para eliminar categorías'
      });
    }

    const { id } = req.params;

    // Verificar si la categoría existe
    const [existingCategories] = await executeQuery(
      'SELECT id, nombre FROM categorias WHERE id = ? AND activo = 1',
      [id]
    );

    if (existingCategories.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        message: 'La categoría a eliminar no existe'
      });
    }

    // Verificar si hay productos usando esta categoría
    const [productsUsingCategory] = await executeQuery(
      'SELECT COUNT(*) as count FROM productos WHERE categoria_id = ? AND activo = 1',
      [id]
    );

    if (productsUsingCategory[0].count > 0) {
      return res.status(400).json({
        error: 'Categoría en uso',
        message: 'No se puede eliminar la categoría porque tiene productos asociados'
      });
    }

    // Soft delete - marcar como inactiva
    await executeQuery(
      'UPDATE categorias SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Categoría eliminada exitosamente',
      data: {
        category: {
          id: parseInt(id),
          nombre: existingCategories[0].nombre
        }
      }
    });

  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error eliminando la categoría'
    });
  }
});

// GET /api/categories/:id/products - Obtener productos de una categoría
router.get('/:id/products', async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user.permisos.all && !req.user.permisos.products) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ver productos'
      });
    }

    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Verificar si la categoría existe
    const [categories] = await executeQuery(
      'SELECT id, nombre FROM categorias WHERE id = ? AND activo = 1',
      [id]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        message: 'La categoría solicitada no existe'
      });
    }

    // Contar productos en la categoría
    const [countResult] = await executeQuery(
      'SELECT COUNT(*) as total FROM productos WHERE categoria_id = ? AND activo = 1',
      [id]
    );

    const total = countResult[0].total;

    // Obtener productos de la categoría
    const [products] = await executeQuery(
      `SELECT p.*, c.nombre as categoria_nombre 
       FROM productos p 
       JOIN categorias c ON p.categoria_id = c.id 
       WHERE p.categoria_id = ? AND p.activo = 1
       ORDER BY p.nombre 
       LIMIT ? OFFSET ?`,
      [id, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        category: categories[0],
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo productos de categoría:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo los productos de la categoría'
    });
  }
});

module.exports = router;
