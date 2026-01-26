const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth } = require('../middleware/auth');
const {
  register,
  login,
  verifyEmail,
  getMe,
  updatePassword,
} = require('../controllers/authController');

const router = express.Router();


router.post('/register', validate(schemas.register), register);
router.post('/login', validate(schemas.login), login);
router.post('/verify-email', verifyEmail);
router.get('/me', auth, getMe);
router.put('/password', auth, validate(schemas.updatePassword), updatePassword);

module.exports = router;
