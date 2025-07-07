import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { IsEmail, IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Search } from './search.entity';
import { Monitor } from './monitor.entity';
import { RefreshToken } from './refresh-token.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['cpf'], { unique: true, where: 'cpf IS NOT NULL' })
@Index(['oab'], { unique: true, where: 'oab IS NOT NULL' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @IsEmail()
  email: string;

  @Column({ type: 'varchar', length: 255 })
  @IsString()
  password: string;

  @Column({ type: 'varchar', length: 255 })
  @IsString()
  name: string;

  @Column({ type: 'varchar', length: 11, nullable: true, unique: true })
  @IsOptional()
  @IsString()
  cpf?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  @IsOptional()
  @IsString()
  oab?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  @IsEnum(UserRole)
  role: UserRole;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @Column({ type: 'boolean', default: true })
  @IsBoolean()
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  @IsBoolean()
  isEmailVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Search, (search) => search.user)
  searches: Search[];

  @OneToMany(() => Monitor, (monitor) => monitor.user)
  monitors: Monitor[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];
}
