const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult, query } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Validaciones para usuarios
const userValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('El nombre de usuario debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos'),
  body('email')
    .isEmail()
    .withMessage('El email debe ser válido')
    .normalizeEmail(),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('nombre')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ max: 100 })
    .withMessage('El nombre no puede exceder 100 caracteres'),
  body('apellido')
    .notEmpty()
    .withMessage('El apellido es requerido')
    .isLength({ max: 100 })
    .withMessage('El apellido no puede exceder 100 caracteres'),
  body('rol_id')
    .isInt({ min: 1 })
    .withMessage('El rol es requerido')
];

// GET /api/users - Obtener usuarios con paginación y filtros
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe estar entre 1 y 100'),
  query('search').optional().isLength({ max: 100 }).withMessage('La búsqueda no puede exceder 100 caracteres'),
  query('rol_id').optional().isInt({ min: 1 }).withMessage('ID de rol inválido'),
  query('activo').optional().isBoolean().withMessage('El estado activo debe ser true o false')
], checkRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, rol_id, activo } = req.query;
    const offset = (page - 1) * limit;

    // Construir query base
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (search) {
      whereClause += ' AND (u.username LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (rol_id) {
      whereClause += ' AND u.rol_id = ?';
      params.push(rol_id);
    }

    if (activo !== undefined) {
      whereClause += ' AND u.activo = ?';
      params.push(activo === 'true');
    }

    // Query para contar total
    const [countResult] = await executeQuery(
      `SELECT COUNT(*) as total 
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       ${whereClause}`,
      params
    );

    const total = countResult[0].total;

    // Query para obtener usuarios
    const [users] = await executeQuery(
      `SELECT u.id, u.username, u.email, u.nombre, u.apellido, u.activo, u.ultimo_login, u.created_at, u.updated_at,
              r.nombre as rol_nombre, r.descripcion as rol_descripcion
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       ${whereClause}
       ORDER BY u.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Obtener roles para filtros
    const [roles] = await executeQuery(
      'SELECT id, nombre FROM roles WHERE activo = 1 ORDER BY nombre'
    );

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        filters: {
          roles
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la lista de usuarios'
    });
  }
});

// GET /api/users/:id - Obtener usuario por ID
router.get('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await executeQuery(
      `SELECT u.id, u.username, u.email, u.nombre, u.apellido, u.activo, u.ultimo_login, u.created_at, u.updated_at,
              r.nombre as rol_nombre, r.descripcion as rol_descripcion, r.permisos
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       WHERE u.id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    const user = users[0];

    // Parsear permisos JSON
    try {
      user.permisos = JSON.parse(user.permisos);
    } catch (e) {
      user.permisos = {};
    }

    res.json({
      success: true,
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo el usuario'
    });
  }
});

// POST /api/users - Crear nuevo usuario
router.post('/', userValidation, checkRole(['admin']), async (req, res) => {
  try {
    // Verificar validaciones
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { username, email, password, nombre, apellido, rol_id } = req.body;

    // Verificar si el username ya existe
    const [existingUsers] = await executeQuery(
      'SELECT id FROM usuarios WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        error: 'Usuario ya existe',
        message: 'El nombre de usuario ya está en uso'
      });
    }

    // Verificar si el email ya existe
    const [existingEmails] = await executeQuery(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingEmails.length > 0) {
      return res.status(400).json({
        error: 'Email ya existe',
        message: 'El email ya está registrado'
      });
    }

    // Verificar si el rol existe
    const [roles] = await executeQuery(
      'SELECT id FROM roles WHERE id = ? AND activo = 1',
      [rol_id]
    );

    if (roles.length === 0) {
      return res.status(400).json({
        error: 'Rol inválido',
        message: 'El rol especificado no existe'
      });
    }

    // Hashear contraseña
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear usuario
    const [result] = await executeQuery(
      `INSERT INTO usuarios (username, email, password, nombre, apellido, rol_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, nombre, apellido, rol_id]
    );

    // Obtener usuario creado
    const [newUsers] = await executeQuery(
      `SELECT u.id, u.username, u.email, u.nombre, u.apellido, u.activo, u.created_at,
              r.nombre as rol_nombre, r.descripcion as rol_descripcion
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       WHERE u.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        user: newUsers[0]
      }
    });

  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error creando el usuario'
    });
  }
});

// PUT /api/users/:id - Actualizar usuario
router.put('/:id', userValidation, checkRole(['admin']), async (req, res) => {
  try {
    // Verificar validaciones
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { username, email, password, nombre, apellido, rol_id } = req.body;

    // Verificar si el usuario existe
    const [existingUsers] = await executeQuery(
      'SELECT id FROM usuarios WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario a actualizar no existe'
      });
    }

    // Verificar si el username ya existe en otro usuario
    const [duplicateUsernames] = await executeQuery(
      'SELECT id FROM usuarios WHERE username = ? AND id != ?',
      [username, id]
    );

    if (duplicateUsernames.length > 0) {
      return res.status(400).json({
        error: 'Usuario ya existe',
        message: 'Ya existe otro usuario con este nombre de usuario'
      });
    }

    // Verificar si el email ya existe en otro usuario
    const [duplicateEmails] = await executeQuery(
      'SELECT id FROM usuarios WHERE email = ? AND id != ?',
      [email, id]
    );

    if (duplicateEmails.length > 0) {
      return res.status(400).json({
        error: 'Email ya existe',
        message: 'Ya existe otro usuario con este email'
      });
    }

    // Verificar si el rol existe
    const [roles] = await executeQuery(
      'SELECT id FROM roles WHERE id = ? AND activo = 1',
      [rol_id]
    );

    if (roles.length === 0) {
      return res.status(400).json({
        error: 'Rol inválido',
        message: 'El rol especificado no existe'
      });
    }

    // Construir query de actualización
    let updateQuery = 'UPDATE usuarios SET username = ?, email = ?, nombre = ?, apellido = ?, rol_id = ?, updated_at = CURRENT_TIMESTAMP';
    let updateParams = [username, email, nombre, apellido, rol_id];

    // Si se proporciona contraseña, actualizarla también
    if (password) {
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updateQuery += ', password = ?';
      updateParams.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    // Actualizar usuario
    await executeQuery(updateQuery, updateParams);

    // Obtener usuario actualizado
    const [updatedUsers] = await executeQuery(
      `SELECT u.id, u.username, u.email, u.nombre, u.apellido, u.activo, u.updated_at,
              r.nombre as rol_nombre, r.descripcion as rol_descripcion
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       WHERE u.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: {
        user: updatedUsers[0]
      }
    });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error actualizando el usuario'
    });
  }
});

// DELETE /api/users/:id - Eliminar usuario (soft delete)
router.delete('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const [existingUsers] = await executeQuery(
      'SELECT id, username, nombre, apellido FROM usuarios WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario a eliminar no existe'
      });
    }

    // No permitir eliminar el usuario administrador principal
    if (id == 1) {
      return res.status(400).json({
        error: 'Operación no permitida',
        message: 'No se puede eliminar el usuario administrador principal'
      });
    }

    // Soft delete - marcar como inactivo
    await executeQuery(
      'UPDATE usuarios SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      data: {
        user: {
          id: parseInt(id),
          username: existingUsers[0].username,
          nombre: existingUsers[0].nombre,
          apellido: existingUsers[0].apellido
        }
      }
    });

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error eliminando el usuario'
    });
  }
});

// PUT /api/users/:id/status - Cambiar estado del usuario
router.put('/:id/status', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({
        error: 'Estado inválido',
        message: 'El estado debe ser true o false'
      });
    }

    // Verificar si el usuario existe
    const [existingUsers] = await executeQuery(
      'SELECT id, username, nombre, apellido FROM usuarios WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    // No permitir desactivar el usuario administrador principal
    if (id == 1 && !activo) {
      return res.status(400).json({
        error: 'Operación no permitida',
        message: 'No se puede desactivar el usuario administrador principal'
      });
    }

    // Actualizar estado
    await executeQuery(
      'UPDATE usuarios SET activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [activo, id]
    );

    res.json({
      success: true,
      message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`,
      data: {
        user: {
          id: parseInt(id),
          username: existingUsers[0].username,
          nombre: existingUsers[0].nombre,
          apellido: existingUsers[0].apellido,
          activo
        }
      }
    });

  } catch (error) {
    console.error('Error cambiando estado del usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error cambiando el estado del usuario'
    });
  }
});

// GET /api/users/:id/activity - Obtener actividad del usuario
router.get('/:id/activity', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Verificar si el usuario existe
    const [users] = await executeQuery(
      'SELECT id, username, nombre, apellido FROM usuarios WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    // Obtener movimientos de inventario del usuario
    const [movements] = await executeQuery(
      `SELECT m.*, p.nombre as producto_nombre, p.codigo as producto_codigo
       FROM movimientos_inventario m
       JOIN productos p ON m.producto_id = p.id
       WHERE m.usuario_id = ?
       ORDER BY m.fecha_movimiento DESC
       LIMIT ?`,
      [id, parseInt(limit)]
    );

    res.json({
      success: true,
      data: {
        user: users[0],
        activity: {
          movements
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo actividad del usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la actividad del usuario'
    });
  }
});

module.exports = router;
