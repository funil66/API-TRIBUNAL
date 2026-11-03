import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database.config';
import { redisClient } from '../config/redis.config';
import { User } from '../models/user.entity';
import { RefreshToken } from '../models/refresh-token.entity';
import { ApiError } from '../utils/api-error';
import { appConfig } from '../config/app.config';
import { 
  RegisterRequest, 
  LoginRequest, 
  AuthResponse, 
  JwtPayload 
} from '../types/api.types';

export class AuthController {
  private userRepository = AppDataSource.getRepository(User);
  private refreshTokenRepository = AppDataSource.getRepository(RefreshToken);

  public register = async (req: Request<{}, {}, RegisterRequest>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        return next(new ApiError(409, 'User with this email already exists'));
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = this.userRepository.create({
        name,
        email,
        password: hashedPassword,
        role: 'user',
        isActive: true
      });

      await this.userRepository.save(user);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request<{}, {}, LoginRequest>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await this.userRepository.findOne({ 
        where: { email },
        select: ['id', 'email', 'name', 'password', 'role', 'isActive']
      });

      if (!user) {
        return next(new ApiError(401, 'Invalid credentials'));
      }

      if (!user.isActive) {
        return next(new ApiError(401, 'Account is deactivated'));
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return next(new ApiError(401, 'Invalid credentials'));
      }

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      const response: AuthResponse = {
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          accessToken,
          refreshToken
        }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return next(new ApiError(401, 'Refresh token is required'));
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, appConfig.jwt.refresh_secret) as JwtPayload;
      
      // Check if refresh token exists in database
      const storedToken = await this.refreshTokenRepository.findOne({
        where: { 
          userId: decoded.userId,
          token: refreshToken,
          isRevoked: false
        }
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        return next(new ApiError(401, 'Invalid or expired refresh token'));
      }

      // Get user
      const user = await this.userRepository.findOne({
        where: { id: decoded.userId },
        select: ['id', 'email', 'name', 'role', 'isActive']
      });

      if (!user || !user.isActive) {
        return next(new ApiError(401, 'User not found or inactive'));
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Revoke old refresh token
      storedToken.isRevoked = true;
      await this.refreshTokenRepository.save(storedToken);

      // Store new refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new ApiError(401, 'Invalid refresh token'));
      }
      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return next(new ApiError(401, 'User not authenticated'));
      }

      // Revoke all refresh tokens for the user
      await this.refreshTokenRepository.update(
        { userId, isRevoked: false },
        { isRevoked: true }
      );

      // Add access token to blacklist in Redis
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.substring(7);
        const decoded = jwt.decode(accessToken) as JwtPayload;
        
        if (decoded && decoded.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redisClient.setEx(`blacklist_${accessToken}`, ttl, 'true');
          }
        }
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  public getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      
      if (!user) {
        return next(new ApiError(401, 'User not authenticated'));
      }

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  };

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(payload, appConfig.jwt.secret, {
      expiresIn: appConfig.jwt.expires_in
    });

    const refreshToken = jwt.sign(payload, appConfig.jwt.refresh_secret, {
      expiresIn: appConfig.jwt.refresh_expires_in
    });

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const decoded = jwt.decode(token) as JwtPayload;
    const expiresAt = new Date(decoded.exp! * 1000);

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId,
      token,
      expiresAt,
      isRevoked: false
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);
  }
}
