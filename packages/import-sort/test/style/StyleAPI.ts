import 'mocha';

import { assert } from 'chai';
import { IImport } from 'forked-import-sort-parser';
import { IComparatorFunction, IPredicateFunction } from 'forked-import-sort-style';

import StyleAPI from '../../src/style/StyleAPI';
import stubImport from '../stubImport';

describe('StyleAPI', () => {
  it('member matcher', () => {
    const predicate: IPredicateFunction = (member) => {
      return member === 'foo';
    };

    const imported: IImport = stubImport({ defaultMember: 'foo' });

    assert.isTrue(StyleAPI.member(predicate)(imported));
  });

  it('member sorter', () => {
    const comparator: IComparatorFunction = (firstMember, secondMember) => {
      return firstMember.localeCompare(secondMember);
    };

    const firstImport: IImport = stubImport({ defaultMember: 'a' });
    const secondImport: IImport = stubImport({ defaultMember: 'b' });

    assert.isBelow(StyleAPI.member(comparator)(firstImport, secondImport), 0);
  });

  it('should detect Node modules', () => {
    const imported: IImport = stubImport({ moduleName: 'fs' });
    assert.isTrue(StyleAPI.isNodeModule(imported));
  });

  it('should detect non-Node modules', () => {
    const imported: IImport = stubImport({ moduleName: 'foo' });
    assert.isFalse(StyleAPI.isNodeModule(imported));
  });

  it('should detect scoped modules', () => {
    const imported: IImport = stubImport({ moduleName: '@foo/bar' });
    assert.isTrue(StyleAPI.isScopedModule(imported));
  });

  it('should detect non-scoped modules', () => {
    const imported: IImport = stubImport({ moduleName: 'foo' });
    assert.isFalse(StyleAPI.isScopedModule(imported));
  });

  it('should sort by dot segment count', () => {
    let firstImport: IImport = stubImport({ moduleName: './a' });
    let secondImport: IImport = stubImport({ moduleName: './b' });

    assert.equal(StyleAPI.dotSegmentCount(firstImport, secondImport), 0);

    firstImport = stubImport({ moduleName: '../a' });
    secondImport = stubImport({ moduleName: './b' });

    assert.isBelow(StyleAPI.dotSegmentCount(firstImport, secondImport), 0);

    firstImport = stubImport({ moduleName: './a' });
    secondImport = stubImport({ moduleName: '../b' });

    assert.isAbove(StyleAPI.dotSegmentCount(firstImport, secondImport), 0);

    firstImport = stubImport({ moduleName: '../../a' });
    secondImport = stubImport({ moduleName: '../b' });

    assert.isBelow(StyleAPI.dotSegmentCount(firstImport, secondImport), 0);
  });

  it('should match module names by prefix', () => {
    const imported: IImport = stubImport({ moduleName: 'foo/bar' });
    assert.isTrue(StyleAPI.moduleName(StyleAPI.startsWith('foo'))(imported));
  });

  it('should not match module names by prefix', () => {
    const imported: IImport = stubImport({ moduleName: 'foo/bar' });
    assert.isFalse(StyleAPI.moduleName(StyleAPI.startsWith('baz'))(imported));
  });

  it('should match installed modules', () => {
    const imported: IImport = stubImport({ moduleName: 'typescript' });
    assert.isTrue(StyleAPI.isInstalledModule(__filename)(imported));
  });

  it('should match relative modules as non-installed modules', () => {
    const imported: IImport = stubImport({ moduleName: `./${__filename}` });
    assert.isFalse(StyleAPI.isInstalledModule(__filename)(imported));
  });

  it('should match relative non-resolvable modules as non-installed modules', () => {
    const imported: IImport = stubImport({ moduleName: `./foo` });
    assert.isFalse(StyleAPI.isInstalledModule(__filename)(imported));
  });

  it('should match absolute non-resolvable modules as non-installed modules', () => {
    const imported: IImport = stubImport({ moduleName: `foo` });
    assert.isFalse(StyleAPI.isInstalledModule(__filename)(imported));
  });
});
