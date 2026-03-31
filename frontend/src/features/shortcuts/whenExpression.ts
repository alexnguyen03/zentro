export type ShortcutWhenContext = Record<string, boolean>;

type TokenType = 'ident' | 'and' | 'or' | 'not' | 'lparen' | 'rparen';

interface Token {
    type: TokenType;
    value?: string;
}

interface ParseState {
    tokens: Token[];
    index: number;
}

type ExprNode =
    | { type: 'ident'; name: string }
    | { type: 'not'; child: ExprNode }
    | { type: 'and'; left: ExprNode; right: ExprNode }
    | { type: 'or'; left: ExprNode; right: ExprNode };

function tokenize(expression: string): Token[] {
    const out: Token[] = [];
    let i = 0;
    while (i < expression.length) {
        const ch = expression[i];
        if (/\s/.test(ch)) {
            i += 1;
            continue;
        }
        if (ch === '&' && expression[i + 1] === '&') {
            out.push({ type: 'and' });
            i += 2;
            continue;
        }
        if (ch === '|' && expression[i + 1] === '|') {
            out.push({ type: 'or' });
            i += 2;
            continue;
        }
        if (ch === '!') {
            out.push({ type: 'not' });
            i += 1;
            continue;
        }
        if (ch === '(') {
            out.push({ type: 'lparen' });
            i += 1;
            continue;
        }
        if (ch === ')') {
            out.push({ type: 'rparen' });
            i += 1;
            continue;
        }
        const identMatch = expression.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_.-]*/);
        if (!identMatch) {
            throw new Error(`Invalid token near "${expression.slice(i, Math.min(i + 12, expression.length))}"`);
        }
        out.push({ type: 'ident', value: identMatch[0] });
        i += identMatch[0].length;
    }
    return out;
}

function peek(state: ParseState): Token | undefined {
    return state.tokens[state.index];
}

function consume(state: ParseState, type?: TokenType): Token {
    const token = state.tokens[state.index];
    if (!token) {
        throw new Error('Unexpected end of expression');
    }
    if (type && token.type !== type) {
        throw new Error(`Expected ${type}, got ${token.type}`);
    }
    state.index += 1;
    return token;
}

function parsePrimary(state: ParseState): ExprNode {
    const token = peek(state);
    if (!token) throw new Error('Unexpected end of expression');

    if (token.type === 'ident') {
        consume(state);
        return { type: 'ident', name: token.value || '' };
    }

    if (token.type === 'lparen') {
        consume(state, 'lparen');
        const node = parseOr(state);
        consume(state, 'rparen');
        return node;
    }

    if (token.type === 'not') {
        consume(state, 'not');
        return { type: 'not', child: parsePrimary(state) };
    }

    throw new Error(`Unexpected token: ${token.type}`);
}

function parseAnd(state: ParseState): ExprNode {
    let left = parsePrimary(state);
    while (peek(state)?.type === 'and') {
        consume(state, 'and');
        const right = parsePrimary(state);
        left = { type: 'and', left, right };
    }
    return left;
}

function parseOr(state: ParseState): ExprNode {
    let left = parseAnd(state);
    while (peek(state)?.type === 'or') {
        consume(state, 'or');
        const right = parseAnd(state);
        left = { type: 'or', left, right };
    }
    return left;
}

function parseExpression(expression: string): ExprNode {
    const state: ParseState = { tokens: tokenize(expression), index: 0 };
    if (state.tokens.length === 0) {
        throw new Error('Empty expression');
    }
    const root = parseOr(state);
    if (state.index < state.tokens.length) {
        throw new Error(`Unexpected token: ${state.tokens[state.index].type}`);
    }
    return root;
}

function evaluateNode(node: ExprNode, context: ShortcutWhenContext): boolean {
    if (node.type === 'ident') {
        return context[node.name] === true;
    }
    if (node.type === 'not') {
        return !evaluateNode(node.child, context);
    }
    if (node.type === 'and') {
        return evaluateNode(node.left, context) && evaluateNode(node.right, context);
    }
    return evaluateNode(node.left, context) || evaluateNode(node.right, context);
}

export function evaluateWhenExpression(expression: string | undefined, context: ShortcutWhenContext): boolean {
    const src = (expression || '').trim();
    if (!src) return true;
    try {
        const ast = parseExpression(src);
        return evaluateNode(ast, context);
    } catch {
        return false;
    }
}
