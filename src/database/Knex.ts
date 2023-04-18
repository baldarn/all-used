import Knex from 'knex';
import config from './knexfile';

// Set environment from `.env`
const knex = Knex(config);

export default knex;
