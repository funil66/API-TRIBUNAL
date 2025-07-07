import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsString, IsDate, IsNumber, IsArray, IsOptional } from 'class-validator';
import { Search } from './search.entity';

@Entity('publications')
@Index(['tribunal', 'date'])
@Index(['processNumber'])
@Index(['date'])
export class Publication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @IsString()
  tribunal: string;

  @Column({ type: 'date' })
  @IsDate()
  date: Date;

  @Column({ type: 'text' })
  @IsString()
  content: string;

  @Column({ type: 'int' })
  @IsNumber()
  page: number;

  @Column({ type: 'varchar', length: 500 })
  @IsString()
  url: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @IsOptional()
  @IsString()
  processNumber?: string;

  @Column({ type: 'simple-array' })
  @IsArray()
  parties: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  @IsOptional()
  @IsString()
  judge?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsOptional()
  @IsString()
  category?: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  summary?: string;

  @Column({ type: 'uuid', nullable: true })
  searchId?: string;

  @ManyToOne(() => Search, (search: Search) => search.publications, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'searchId' })
  search?: Search;

  @CreateDateColumn()
  createdAt: Date;
}
