const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getUser
} = require('../controllers/userController');

const router = express.Router();

// All routes are protected
router.use(auth);

// Profile routes (Any authenticated user)
router.get('/profile', getProfile);
router.put('/profile', validate(schemas.updateProfile), updateProfile);

// Management routes (Admin and Owner only)
router.get('/', authorize('ADMIN', 'OWNER'), getUsers);
router.get('/:id', authorize('ADMIN', 'OWNER'), getUser);
router.post('/', authorize('ADMIN', 'OWNER'), validate(schemas.createUser), createUser);
router.put('/:id', authorize('ADMIN', 'OWNER'), validate(schemas.updateUser), updateUser);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteUser);

module.exports = router;
