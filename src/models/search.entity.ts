import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { IsString, IsNumber, IsArray, IsEnum, IsOptional, IsDate } from 'class-validator';
import { User } from './user.entity';
import { Publication } from './publication.entity';

export enum SearchType {
  NAME = 'name',
  CPF = 'cpf',
  OAB = 'oab',
}

export enum SearchStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('searches')
@Index(['userId', 'createdAt'])
@Index(['type', 'term'])
@Index(['status'])
export class Search {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: SearchType,
  })
  @IsEnum(SearchType)
  type: SearchType;

  @Column({ type: 'varchar', length: 255 })
  @IsString()
  term: string;

  @Column({ type: 'json' })
  @IsArray()
  sources: string[];

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  filters?: Record<string, any>;

  @Column({
    type: 'enum',
    enum: SearchStatus,
    default: SearchStatus.PENDING,
  })
  @IsEnum(SearchStatus)
  status: SearchStatus;

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  results?: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  @IsNumber()
  totalResults: number;

  @Column({ type: 'timestamp', nullable: true })
  @IsOptional()
  @IsDate()
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  @IsOptional()
  @IsDate()
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  error?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user: User) => user.searches)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Publication, (publication: Publication) => publication.search)
  publications: Publication[];
}
