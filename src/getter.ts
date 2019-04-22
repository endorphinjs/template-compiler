import { Node, Literal, Identifier, ArrowFunctionExpression, ArrayExpression, MemberExpression } from "@endorphinjs/template-parser";
import { isIdentifier, isLiteral } from "./utils";

type GetterFragment = Literal | Identifier
    | ArrowFunctionExpression | ArrayExpression;
type GetterPathFragment = GetterFragment | GetterFragmentArray;
type GetterPath = GetterPathFragment[];
interface GetterFragmentArray extends Array<GetterFragment> {};

function isValidPathFragment(node: Node): node is GetterFragment {
    return isIdentifier(node) || isLiteral(node)
        || node.type === 'ArrowFunctionExpression'
        || node.type === 'ArrayExpression';
}

/**
 * Collects plain path for value getter, if possible
 */
function collectGetterPath(expr: MemberExpression, dest: GetterPath = []): GetterPath {
    if (isValidPathFragment(expr.property)) {
        dest.unshift(expr.property);

        if (expr.object.type === 'MemberExpression') {
            return collectGetterPath(expr.object, dest);
        }

        if (isIdentifier(expr.object)) {
            dest.unshift(expr.object);
            return dest;
        }
    } else if (expr.property.type === 'MemberExpression') {
        dest.unshift(collectGetterPath(expr.property) as GetterFragmentArray)
    }

    return null;
}
