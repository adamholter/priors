/**
 * Reads data written as JavaScript object literals in a site's minified bundle (unquoted keys, `!0` for true, template strings),
 * without running the script: the source is parsed with TypeScript and only literal values are accepted.
 */
import * as ts from "typescript";

type Data = string | number | boolean | null | undefined | Data[] | { [key: string]: Data };

function keyOf(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  return undefined;
}

/** The value of a literal expression; anything else (a call, a variable, a template with `${}`) throws. */
export function readJsLiteral(node: ts.Expression): Data {
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node) && node.text === "undefined") return undefined;
  if (ts.isVoidExpression(node)) return undefined;
  if (ts.isPrefixUnaryExpression(node)) {
    if (node.operator === ts.SyntaxKind.ExclamationToken && ts.isNumericLiteral(node.operand)) return !Number(node.operand.text);
    if (node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((e) => {
    if (ts.isSpreadElement(e) || ts.isOmittedExpression(e)) throw new Error("JS literal: unsupported array element");
    return readJsLiteral(e);
  });
  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, Data> = {};
    for (const p of node.properties) {
      const key = ts.isPropertyAssignment(p) ? keyOf(p.name) : undefined;
      if (!ts.isPropertyAssignment(p) || key === undefined) throw new Error("JS literal: unsupported object property");
      out[key] = readJsLiteral(p.initializer);
    }
    return out;
  }
  throw new Error(`JS literal: unsupported value ${ts.SyntaxKind[node.kind]}`);
}

/** The first object literal in the source, outermost first, whose own keys include every one of `keys`. */
export function findJsObject(source: string, keys: string[]): Record<string, Data> | undefined {
  const file = ts.createSourceFile("bundle.js", source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  let found: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isObjectLiteralExpression(node)) {
      const own = new Set(node.properties.map((p) => (p.name ? keyOf(p.name as ts.PropertyName) : undefined)));
      if (keys.every((k) => own.has(k))) { found = node; return; }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found ? readJsLiteral(found) as Record<string, Data> : undefined;
}
