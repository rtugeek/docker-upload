import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  stylistic: {
    indent: 2,
    quotes: 'single',
  },
  typescript: true,
  vue: false,
  jsonc: false,
  yaml: false,
  ignores: [
    '**/fixtures',
  ],
  rules: {
    'curly': ['error', 'multi-line'],
    'ts/no-use-before-define': 'off',
    'no-restricted-globals': 'off',
    'unused-imports/no-unused-vars': 'warn',
    'ts/explicit-function-return-type': 'off',
    'ts/ban-ts-comment': 'off',
    'ts/consistent-type-imports': 'off',
    'node/prefer-global/process': 'off',
    'no-console': 'off',
    'eqeqeq': 'off',
  },
})
