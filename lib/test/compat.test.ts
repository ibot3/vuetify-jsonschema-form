import { describe, it, assert } from 'vitest'
import Ajv from 'ajv'
import { v2compat } from '../src/compat/v2'
import { compile as compileLayout } from '@json-layout/core'

describe('schema compatibility function', () => {
  it('should transform simple schemas', () => {
    const schema = v2compat({ type: 'string', 'x-display': 'textarea' }, new Ajv())
    assert.deepEqual(schema, { type: 'string', $id: '_jl', layout: 'textarea' })
    assert.ok(compileLayout(schema))
  })

  it('should transform a complex select', () => {
    const schema = v2compat({
      type: 'object',
      properties: {
        objectContext: {
          type: 'object',
          title: 'I\'m an object with values from the context',
          'x-fromData': 'context.objectItems',
          'x-itemKey': 'val',
          'x-itemTitle': 'label'
        }
      }
    })
    assert.equal(schema.properties.objectContext.layout.comp, 'select')
    assert.ok(schema.properties.objectContext.layout.getItems)
    assert.equal(schema.properties.objectContext.layout.getItems.expr, 'context.objectItems')
    assert.ok(compileLayout(schema))
  })

  it('should transform an actual example from data-fair processing', () => {
    const schema = v2compat({
      type: 'object',
      'x-display': 'tabs',
      required: ['datasetMode', 'message'],
      allOf: [{
        title: 'Jeu de données',
        oneOf: [{
          title: 'Créer un jeu de données',
          required: ['dataset'],
          properties: {
            datasetMode: { type: 'string', const: 'create', title: 'Action' },
            dataset: {
              type: 'object',
              required: ['title'],
              properties: {
                id: { type: 'string', title: 'Identifiant (laissez vide pour calculer un identifiant à partir du titre)' },
                title: { type: 'string', title: 'Titre', default: 'Hello world ' }
              }
            }
          }
        }, {
          title: 'Mettre à jour un jeu de données',
          required: ['dataset'],
          properties: {
            datasetMode: { type: 'string', const: 'update' },
            dataset: {
              type: 'object',
              'x-fromUrl': '{context.dataFairUrl}/api/v1/datasets?q={q}&select=id,title&{context.ownerFilter}',
              'x-itemsProp': 'results',
              'x-itemTitle': 'title',
              'x-itemKey': 'id',
              properties: {
                id: { type: 'string', title: 'Identifiant' },
                title: { type: 'string', title: 'Titre' }
              }
            }
          }
        }]
      }, {
        title: 'Contenu',
        properties: {
          message: { type: 'string', title: 'Message', default: 'world !' },
          delay: { type: 'integer', title: "Délai en secondes (utilisé pour tester l'interruption de tâche)", default: 1 },
          ignoreStop: { type: 'boolean', title: "Ignorer l'instruction de stop (utilisé pour tester l'interruption brutale de tâche)", default: false }
        }
      }, {
        title: 'Email',
        properties: {
          email: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' }
            }
          }
        }
      }]
    })

    assert.equal(schema.allOf?.[0]?.oneOfLayout?.label, 'Action')
    // eslint-disable-next-line no-template-curly-in-string
    assert.deepEqual(schema.allOf?.[0]?.oneOf?.[1]?.properties?.dataset?.layout?.getItems.url, { expr: '${context.dataFairUrl}/api/v1/datasets?q={q}&select=id,title&${context.ownerFilter}', type: 'js-tpl', pure: true })
  })

  it('should transform an example with recursion', () => {
    const schema = v2compat({
      type: 'object',
      'x-display': 'tabs',
      required: ['block'],

      properties: {
        block: { $ref: '#/definitions/block' },
        separator: {
          'x-if': 'parent.value.multivalued == true',
          type: 'string',
          title: 'Séparateur',
          default: ';'
        }
      },
      definitions: {
        block: {
          type: 'object',
          properties: {
            mapping: {
              type: 'array',
              title: 'Champs à récupérer',
              description: 'Les colonnes qui seront récupéré depuis ce niveau',
              'x-itemTitle': 'key',
              items: {
                type: 'object',
                required: ['key', 'path'],
                properties: {
                  key: {
                    type: 'string',
                    title: 'Identifiant de la colonne',
                    description: 'Clé de la colonne'
                  },
                  path: {
                    type: 'string',
                    title: 'Chemin de la colonne',
                    description: "Chemin d'accès dans le json à partir de cette position"
                  }
                }
              }
            },
            expand: {
              title: "Données en profondeur d'un tableau",
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  title: 'Chemin de la colonne',
                  description: "Chemin d'accès dans le json à partir de cette position"
                }
              },
              dependencies: {
                path: {
                  properties: {
                    block: { $ref: '#/definitions/block', 'x-display': 'card' }
                  }
                }
              }
            }
          }
        }
      }
    })

    // assert.equal(schema.allOf?.[0]?.oneOfLayout?.label, 'Action')
    // eslint-disable-next-line no-template-curly-in-string
    // assert.deepEqual(schema.allOf?.[0]?.oneOf?.[1]?.properties?.dataset?.layout?.getItems.url, { expr: '${context.dataFairUrl}/api/v1/datasets?q={q}&select=id,title&${context.ownerFilter}', type: 'js-tpl', pure: true })
  })
})
