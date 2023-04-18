import { Knex } from 'knex';

const config: Knex.Config = {
  client: 'pg',
  connection: {
    user: 'all-used',
    password: 'all-used',
    database: 'all-used',
    host: '192.168.1.10',
    timezone: 'utc',
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: 'migrations',
  },
};

export default config;
