import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: '../schema.graphql',
  generates: {
    './src/lib/generated/schema.ts': {
      plugins: ['typescript'],
      config: {
        scalars: {
          DateTime: 'string',
          JSON: 'unknown',
        },
        defaultScalarType: 'unknown',
        strictScalars: true,
        useTypeImports: true,
        enumsAsTypes: true,
        avoidOptionals: {
          field: true,
        },
      },
    },
  },
}

export default config
