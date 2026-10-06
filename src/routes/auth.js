const express = require('express');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { findByEmail, findById, createUser } = require('../models/users');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Roles a person can self-assign at signup. "admin" is deliberately excluded —
// that should only ever be granted by an existing admin, not chosen at signup.
const SIGNUP_ROLES = ['student', 'instructor'];

function isValidEmail(email) {
  return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email);
}

router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'name, a valid email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  const resolvedRole = role || 'student';
  if (!SIGNUP_ROLES.includes(resolvedRole)) {
    return res.status(400).json({ error: `role must be one of: ${SIGNUP_ROLES.join(', ')}` });
  }

  try {
    const existing = await findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ name, email, passwordHash, role: resolvedRole });

    const token = signToken({ sub: user.id, role: user.role });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong creating the account' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'a valid email and password are required' });
  }

  try {
    const user = await findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordOk = await comparePassword(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({ sub: user.id, role: user.role });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong logging in' });
  }
});

// Returns the currently authenticated user - a simple way to verify a token works.
router.get('/me', requireAuth, async (req, res) => {
  const user = await findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

module.exports = router;
