import 'mocha';

import { readFileSync } from 'fs';
import { join } from 'path';

import { assert } from 'chai';
import { ESLint } from 'eslint';
import * as parser from 'forked-import-sort-parser-babylon';
import style from 'forked-import-sort-style-eslint';

import { sortImports } from '../../src';

describe('sortImports (babylon, eslint with ignore case) (issue #20)', () => {
  it('should have no errors', async () => {
    const file = join(__dirname, 'babylon_eslint.js.test');
    const code = readFileSync(file, 'utf-8');

    const result = sortImports(code, parser, style, file);

    const cli = new ESLint({
      cwd: __dirname,
      baseConfig: {
        parserOptions: {
          sourceType: 'module',
          ecmaVersion: 2015,
        },
        rules: {
          'sort-imports': [2, { ignoreCase: true }],
        },
      },
      useEslintrc: false,
    });

    const results = await cli.lintText(result.code, {
      filePath: file,
    });

    const errors = results.reduce((acc, res) => acc + res.errorCount, 0);

    assert.equal(errors, 0);
  });
});
