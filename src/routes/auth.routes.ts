import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { 
  loginSchema, 
  registerSchema, 
  refreshTokenSchema 
} from '../validators/auth.validator';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/refresh', validateRequest(refreshTokenSchema), authController.refreshToken);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getProfile);

export default router;