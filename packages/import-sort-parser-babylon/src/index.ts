import { extname } from 'path';

import {
  ParseResult,
  TransformOptions,
  loadOptions as babelLoadOptions,
  loadPartialConfig as babelLoadPartialOptions,
  parse as babelParse,
} from '@babel/core';
import { ParserOptions, ParserPlugin, parse as babelParserParse } from '@babel/parser';
import traverse from '@babel/traverse';
import { isImportDefaultSpecifier, isImportNamespaceSpecifier, isImportSpecifier } from '@babel/types';
import findLineColumn from 'find-line-column';
import { IImport, IParserOptions, NamedMember } from 'forked-import-sort-parser';

const logDebug = (...args: unknown[]) => {
  if (!process.env.IMPORT_SORT_DEBUG) {
    return;
  }

  console.log('[forked-import-sort-parser-babylon]', ...args);
}

const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx'];
const JSX_EXTENSIONS = ['.jsx', '.tsx'];

const COMMON_PARSER_PLUGINS = [
  'doExpressions',
  'exportDefaultFrom',
  'functionBind',
  'importMeta',
  'throwExpressions',
  ['decorators', { decoratorsBeforeExport: true }],
  ['pipelineOperator', { proposal: 'minimal' }],
] as ParserPlugin[];

const FLOW_PARSER_PLUGINS = [
  ...COMMON_PARSER_PLUGINS,
  'flow',
  'flowComments',
] as ParserPlugin[];

const FLOW_PARSER_OPTIONS: ParserOptions = {
  sourceType: 'module',
  plugins: FLOW_PARSER_PLUGINS,
};

const TYPESCRIPT_PARSER_PLUGINS = [
  ...COMMON_PARSER_PLUGINS,
  'typescript',
] as ParserPlugin[];

const TYPESCRIPT_PARSER_OPTIONS: ParserOptions = {
  sourceType: 'module',
  plugins: TYPESCRIPT_PARSER_PLUGINS,
};

const babelParseWithOptions = (code: string, options: IParserOptions = {}): ParseResult | null => {
  const babelPartialOptions = babelLoadPartialOptions({ filename: options.file });
  logDebug('babelPartialOptions', babelPartialOptions);

  // We always prefer .babelrc (or similar) if one was found
  if (babelPartialOptions?.hasFilesystemConfig()) {
    const babelOptions = babelLoadOptions({ filename: options.file }) as TransformOptions;
    logDebug('babelOptions', babelOptions);
    return babelParse(code, babelOptions );
  }

  const { file } = options;
  const fileExt = extname(file ?? '');

  const isTypeScript = TYPESCRIPT_EXTENSIONS.includes(fileExt);
  const isJsx = JSX_EXTENSIONS.includes(fileExt);

  const parserOptions = isTypeScript ? TYPESCRIPT_PARSER_OPTIONS : FLOW_PARSER_OPTIONS;
  if (isJsx) {
    parserOptions.plugins?.push('jsx');
  }

  return babelParserParse(code, parserOptions);
}

export function parseImports(code: string, options: IParserOptions = {}): IImport[] {
  const imports: IImport[] = [];
  const parsed = babelParseWithOptions(code, options);

  if (!parsed) {
    console.error('Failed to parse.');
    return imports;
  }

  if (parsed.type === "Program") {
    console.error('Parsed as Program, IDK what to do.');
    return imports;
  }

  const ignore = (parsed.comments ?? []).some((comment) => {
    return comment.value.includes('import-sort-ignore');
  });

  if (ignore) {
    return imports;
  }

  traverse(parsed, {
    ImportDeclaration(path) {
      const { node } = path;

      const importStart = node.start;
      const importEnd = node.end;

      let start = importStart;
      let end = importEnd;

      if (node.leadingComments) {
        const comments = node.leadingComments;

        let current = node.leadingComments.length - 1;
        let previous: number | undefined;

        while (comments[current] && comments[current].end + 1 === start) {
          if (code.substring(comments[current].start, comments[current].end).indexOf('#!') === 0) {
            break;
          }

          // TODO: Improve this so that comments with leading whitespace are allowed
          if (findLineColumn(code, comments[current].start).col !== 0) {
            break;
          }

          previous = current;
          ({ start } = comments[previous]);
          current -= 1;
        }
      }

      if (node.trailingComments) {
        const comments = node.trailingComments;

        let current = 0;
        let previous: number | undefined;

        while (comments[current] && comments[current].start - 1 === end) {
          if (comments[current].loc.start.line !== node.loc?.start.line) {
            break;
          }

          previous = current;
          ({ end } = comments[previous]);
          current += 1;
        }
      }

      const imported: IImport = {
        start: start ?? 0,
        end: end ?? 0,

        importStart: importStart ?? undefined,
        importEnd: importEnd ?? undefined,

        moduleName: node.source.value,

        type: node.importKind === 'type' ? 'import-type' : 'import',
        namedMembers: [],
      };

      if (node.specifiers) {
        node.specifiers.forEach((specifier) => {
          if (isImportSpecifier(specifier)) {
            const type = specifier.importKind === 'type' ? { type: true } : {};

            imported.namedMembers.push({
              name: specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value,
              alias: specifier.local.name,
              ...type,
            });
          } else if (isImportDefaultSpecifier(specifier)) {
            imported.defaultMember = specifier.local.name;
          } else if (isImportNamespaceSpecifier(specifier)) {
            imported.namespaceMember = specifier.local.name;
          }
        });
      }

      imports.push(imported);
    },
  });

  return imports;
}

export function formatImport(code: string, imported: IImport, eol = '\n'): string {
  const importStart = imported.importStart || imported.start;
  const importEnd = imported.importEnd || imported.end;

  const importCode = code.substring(importStart, importEnd);

  const { namedMembers } = imported;

  if (namedMembers.length === 0) {
    return code.substring(imported.start, imported.end);
  }

  const newImportCode = importCode.replace(/\{[\s\S]*\}/g, (namedMembersString) => {
    const useMultipleLines = namedMembersString.indexOf(eol) !== -1;

    let prefix: string | undefined;

    if (useMultipleLines) {
      [prefix] = namedMembersString.split(eol)[1].match(/^\s*/) as RegExpMatchArray;
    }

    const useSpaces = namedMembersString.charAt(1) === ' ';

    const userTrailingComma = namedMembersString.replace('}', '').trim().endsWith(',');

    return formatNamedMembers(namedMembers, useMultipleLines, useSpaces, userTrailingComma, prefix, eol);
  });

  return (
    code.substring(imported.start, importStart) +
    newImportCode +
    code.substring(importEnd, importEnd + (imported.end - importEnd))
  );
}

function formatNamedMembers(
  namedMembers: NamedMember[],
  useMultipleLines: boolean,
  useSpaces: boolean,
  useTrailingComma: boolean,
  prefix: string | undefined,
  eol = '\n'
): string {
  if (useMultipleLines) {
    return (
      '{' +
      eol +
      namedMembers
        .map(({ name, alias, type }, index) => {
          const lastImport = index === namedMembers.length - 1;
          const comma = !useTrailingComma && lastImport ? '' : ',';
          const typeModifier = type ? 'type ' : '';

          if (name === alias) {
            return `${prefix}${typeModifier}${name}${comma}` + eol;
          }

          return `${prefix}${typeModifier}${name} as ${alias}${comma}` + eol;
        })
        .join('') +
      '}'
    );
  }

  const space = useSpaces ? ' ' : '';
  const comma = useTrailingComma ? ',' : '';

  return (
    '{' +
    space +
    namedMembers
      .map(({ name, alias, type }) => {
        const typeModifier = type ? 'type ' : '';

        if (name === alias) {
          return `${typeModifier}${name}`;
        }

        return `${typeModifier}${name} as ${alias}`;
      })
      .join(', ') +
    comma +
    space +
    '}'
  );
}
