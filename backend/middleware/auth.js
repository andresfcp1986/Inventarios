const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Token de acceso requerido',
        message: 'Debe proporcionar un token de autenticación'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener información del usuario
    const users = await executeQuery(
      'SELECT u.*, r.nombre as rol_nombre, r.permisos FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = ? AND u.activo = 1',
      [decoded.userId]
    );

    // Verificar si encontramos el usuario
    if (!users || (Array.isArray(users) && users.length === 0) || (!Array.isArray(users) && !users.id)) {
      return res.status(401).json({ 
        error: 'Usuario no válido',
        message: 'El usuario no existe o está inactivo'
      });
    }

    // Obtener el usuario (puede ser un array o un objeto directo)
    const user = Array.isArray(users) ? users[0] : users;
    
    // Parsear permisos JSON
    try {
      // Si ya es un objeto, no parsear
      if (typeof user.permisos === 'object' && user.permisos !== null) {
        // Los permisos ya están como objeto
      } else {
        // Si es string, parsear como JSON
        user.permisos = JSON.parse(user.permisos);
      }
    } catch (e) {
      user.permisos = {};
    }

    // Agregar información del usuario al request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol_nombre,
      rol_id: user.rol_id,
      permisos: user.permisos
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Token inválido',
        message: 'El token proporcionado no es válido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado',
        message: 'El token ha expirado, inicie sesión nuevamente'
      });
    }

    console.error('Error en autenticación:', error);
    return res.status(500).json({ 
      error: 'Error de autenticación',
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para verificar permisos específicos
const checkPermission = (permission) => {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        error: 'No autenticado',
        message: 'Debe iniciar sesión para acceder a este recurso'
      });
    }

    // Admin tiene acceso completo
    if (user.permisos.all === true) {
      return next();
    }

    // Verificar permiso específico
    if (user.permisos[permission] === true || 
        (typeof user.permisos[permission] === 'object' && user.permisos[permission].read === true)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'No tiene permisos para acceder a este recurso'
    });
  };
};

// Middleware para verificar rol específico
const checkRole = (roles) => {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        error: 'No autenticado',
        message: 'Debe iniciar sesión para acceder a este recurso'
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (allowedRoles.includes(user.rol)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'Su rol no tiene permisos para acceder a este recurso'
    });
  };
};

// Middleware para verificar si es el propietario o admin
const checkOwnership = (tableName, idField = 'id') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ 
          error: 'No autenticado',
          message: 'Debe iniciar sesión para acceder a este recurso'
        });
      }

      // Admin puede acceder a todo
      if (user.permisos.all === true) {
        return next();
      }

      const resourceId = req.params[idField];
      
      if (!resourceId) {
        return res.status(400).json({ 
          error: 'ID requerido',
          message: 'Se requiere el ID del recurso'
        });
      }

      // Verificar si el usuario es propietario del recurso
      const [resources] = await executeQuery(
        `SELECT usuario_id FROM ${tableName} WHERE id = ?`,
        [resourceId]
      );

      if (resources.length === 0) {
        return res.status(404).json({ 
          error: 'Recurso no encontrado',
          message: 'El recurso solicitado no existe'
        });
      }

      if (resources[0].usuario_id === user.id) {
        return next();
      }

      return res.status(403).json({ 
        error: 'Acceso denegado',
        message: 'Solo puede acceder a sus propios recursos'
      });

    } catch (error) {
      console.error('Error verificando propiedad:', error);
      return res.status(500).json({ 
        error: 'Error interno',
        message: 'Error verificando permisos de propiedad'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  checkPermission,
  checkRole,
  checkOwnership
};
