declare function findLineColumn(
  text: string,
  offset: number
): {
  line: number;
  column: number;
};

export = findLineColumn;

declare module "find-line-column" {
    export = findLineColumn;
}
