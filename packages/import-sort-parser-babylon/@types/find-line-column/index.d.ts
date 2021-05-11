declare module 'find-line-column' {
  declare function findLineColumn(
    text: string,
    offset: number
  ): {
    line: number;
    col: number;
  };
  export = findLineColumn;
}
