import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('products', (table: Knex.TableBuilder) => {
    table.string('remoteId');
    table.string('vendor');
    table.string('link', 2083);
    table.string('thumbnail', 2083);
    table.string('title');
    table.text('description');
    table.string('createdAt').index('createdAtIndex');
    table.timestamp('updatedAt').index('updatedAtIndex');
    table.string('place');
    table.double('price').index('priceIndex');
    table.string('currency');
    table.specificType('images', 'varchar(2083)[]');
    table.specificType('attributes', 'jsonb');
    table.specificType('tags', 'varchar[]');

    table.primary(['remoteId', 'vendor']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('products');
}
