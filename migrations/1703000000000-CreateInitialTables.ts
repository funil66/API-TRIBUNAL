import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateInitialTables1703000000000 implements MigrationInterface {
  name = 'CreateInitialTables1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['user', 'admin'],
            default: "'user'",
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Create refresh_tokens table
    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'token',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'isRevoked',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create searches table
    await queryRunner.createTable(
      new Table({
        name: 'searches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['name', 'cpf', 'oab'],
            isNullable: false,
          },
          {
            name: 'term',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'sources',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'filters',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'running', 'completed', 'failed'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'results',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'totalResults',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'startedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create publications table
    await queryRunner.createTable(
      new Table({
        name: 'publications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'searchId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'monitorId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'tribunal',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'section',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'publicationDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'hash',
            type: 'varchar',
            length: '64',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['searchId'],
            referencedTableName: 'searches',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true
    );

    // Create monitors table
    await queryRunner.createTable(
      new Table({
        name: 'monitors',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['name', 'cpf', 'oab'],
            isNullable: false,
          },
          {
            name: 'term',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'sources',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'filters',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'frequency',
            type: 'enum',
            enum: ['daily', 'weekly', 'monthly'],
            default: "'daily'",
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'lastRunAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'nextRunAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'totalMatches',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'notificationSettings',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Add foreign key for publications.monitorId
    await queryRunner.createForeignKey(
      'publications',
      {
        columnNames: ['monitorId'],
        referencedTableName: 'monitors',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }
    );

    // Create indexes
    await queryRunner.createIndex('users', new Index('IDX_users_email', ['email']));
    await queryRunner.createIndex('searches', new Index('IDX_searches_userId', ['userId']));
    await queryRunner.createIndex('searches', new Index('IDX_searches_status', ['status']));
    await queryRunner.createIndex('publications', new Index('IDX_publications_hash', ['hash']));
    await queryRunner.createIndex('publications', new Index('IDX_publications_tribunal', ['tribunal']));
    await queryRunner.createIndex('publications', new Index('IDX_publications_date', ['publicationDate']));
    await queryRunner.createIndex('monitors', new Index('IDX_monitors_userId', ['userId']));
    await queryRunner.createIndex('monitors', new Index('IDX_monitors_isActive', ['isActive']));
    await queryRunner.createIndex('refresh_tokens', new Index('IDX_refresh_tokens_userId', ['userId']));
    await queryRunner.createIndex('refresh_tokens', new Index('IDX_refresh_tokens_expiresAt', ['expiresAt']));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('refresh_tokens', 'IDX_refresh_tokens_expiresAt');
    await queryRunner.dropIndex('refresh_tokens', 'IDX_refresh_tokens_userId');
    await queryRunner.dropIndex('monitors', 'IDX_monitors_isActive');
    await queryRunner.dropIndex('monitors', 'IDX_monitors_userId');
    await queryRunner.dropIndex('publications', 'IDX_publications_date');
    await queryRunner.dropIndex('publications', 'IDX_publications_tribunal');
    await queryRunner.dropIndex('publications', 'IDX_publications_hash');
    await queryRunner.dropIndex('searches', 'IDX_searches_status');
    await queryRunner.dropIndex('searches', 'IDX_searches_userId');
    await queryRunner.dropIndex('users', 'IDX_users_email');

    // Drop tables in reverse order
    await queryRunner.dropTable('publications');
    await queryRunner.dropTable('monitors');
    await queryRunner.dropTable('searches');
    await queryRunner.dropTable('refresh_tokens');
    await queryRunner.dropTable('users');
  }
}
