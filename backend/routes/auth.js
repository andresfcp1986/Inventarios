const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validaciones para login
const loginValidation = [
  body('username').notEmpty().withMessage('El nombre de usuario es requerido'),
  body('password').notEmpty().withMessage('La contraseña es requerida')
];

// Validaciones para registro
const registerValidation = [
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

// POST /api/auth/login
router.post('/login', loginValidation, async (req, res) => {
  try {
    // Verificar validaciones
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { username, password } = req.body;

    // Debug: verificar qué estamos buscando
    // Buscar usuario
    const users = await executeQuery(
      `SELECT u.id, u.username, u.email, u.password, u.nombre, u.apellido, u.rol_id, u.activo,
              r.nombre as rol_nombre, r.permisos 
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       WHERE u.username = ? AND u.activo = 1`,
      [username]
    );

    // Verificar si encontramos usuarios
    if (!users || (Array.isArray(users) && users.length === 0) || (!Array.isArray(users) && !users.id)) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Obtener el usuario (puede ser un array o un objeto directo)
    const user = Array.isArray(users) ? users[0] : users;

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Parsear permisos
    let permisos = {};
    try {
      permisos = JSON.parse(user.permisos);
    } catch (e) {
      permisos = {};
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        rol: user.rol_nombre
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Actualizar último login
    await executeQuery(
      'UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Enviar respuesta
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol_nombre,
          permisos
        }
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error procesando la solicitud de login'
    });
  }
});

// POST /api/auth/register
router.post('/register', registerValidation, async (req, res) => {
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
      `SELECT u.*, r.nombre as rol_nombre, r.permisos 
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       WHERE u.id = ?`,
      [result.insertId]
    );

    const newUser = newUsers[0];

    // Parsear permisos
    let permisos = {};
    try {
      permisos = JSON.parse(newUser.permisos);
    } catch (e) {
      permisos = {};
    }

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          nombre: newUser.nombre,
          apellido: newUser.apellido,
          rol: newUser.rol_nombre,
          permisos
        }
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error procesando el registro'
    });
  }
});

// GET /api/auth/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await executeQuery(
      `SELECT u.*, r.nombre as rol_nombre, r.permisos 
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       WHERE u.id = ? AND u.activo = 1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario no existe o está inactivo'
      });
    }

    const user = users[0];

    // Parsear permisos
    let permisos = {};
    try {
      permisos = JSON.parse(user.permisos);
    } catch (e) {
      permisos = {};
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol_nombre,
          permisos,
          ultimo_login: user.ultimo_login,
          created_at: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo el perfil del usuario'
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Generar nuevo token
    const newToken = jwt.sign(
      { 
        userId: req.user.id, 
        username: req.user.username,
        rol: req.user.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Token renovado exitosamente',
      data: {
        token: newToken
      }
    });

  } catch (error) {
    console.error('Error renovando token:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error renovando el token'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // En una implementación real, aquí podrías invalidar el token
    // Por ahora solo enviamos una respuesta exitosa
    res.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error procesando el logout'
    });
  }
});

module.exports = router;
