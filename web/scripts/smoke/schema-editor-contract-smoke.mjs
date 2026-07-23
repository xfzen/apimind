import {
  parseSchema,
  serializeSchema
} from '../../client/components/JsonSchemaEditor/schemaContract.mjs';

const schema = {
  type: 'object',
  properties: {
    id: {
      type: 'integer',
      description: '用户 ID',
      mock: {
        mock: '@integer(1, 100)'
      }
    },
    name: {
      type: 'string',
      description: '用户名',
      mock: {
        mock: '@name'
      }
    }
  },
  required: ['id']
};

const schemaText = serializeSchema(schema);
const parsed = parseSchema(schemaText);
const roundTrip = parseSchema(serializeSchema(parsed));

if (roundTrip.type !== 'object') {
  throw new Error('schema root type must be preserved');
}

if (roundTrip.properties.id.description !== '用户 ID') {
  throw new Error('schema description must be preserved');
}

if (roundTrip.properties.id.mock.mock !== '@integer(1, 100)') {
  throw new Error('YApi mock metadata must be preserved');
}

if (!roundTrip.required.includes('id')) {
  throw new Error('required fields must be preserved');
}

console.log('schema editor contract smoke passed');
