export type DetectedLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'sql'
  | 'html'
  | 'css'
  | 'json'
  | 'yaml'
  | 'bash'
  | 'unknown';

export interface CodeProblem {
  id: string;
  line: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'security' | 'bug' | 'performance' | 'style' | 'logic' | 'syntax';
  title: string;
  description: string;
  suggestedFix: string;
}

export interface CodeAnalysisResult {
  language: DetectedLanguage;
  languageLabel: string;
  problems: CodeProblem[];
  healthScore: number;      // 0–100, higher = healthier
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  lineCount: number;
  charCount: number;
}

// ─── Language Detection ────────────────────────────────────────────────────

const LANGUAGE_SIGNATURES: { lang: DetectedLanguage; patterns: RegExp[] }[] = [
  {
    lang: 'python',
    patterns: [/^\s*def\s+\w+\s*\(/m, /^\s*import\s+\w/m, /^\s*from\s+\w+\s+import/m, /^\s*class\s+\w+[:(]/m, /print\s*\(/m, /:\s*$(?=\n\s{4})/m],
  },
  {
    lang: 'typescript',
    patterns: [/:\s*(string|number|boolean|any|void|never|unknown)\b/, /interface\s+\w+/, /type\s+\w+\s*=/, /<[A-Z]\w+>/, /import\s+type\s+/],
  },
  {
    lang: 'javascript',
    patterns: [/^\s*const\s+\w+\s*=/m, /=>\s*{/, /function\s+\w+\s*\(/, /require\s*\(/, /module\.exports/, /console\.(log|error|warn)\s*\(/],
  },
  {
    lang: 'java',
    patterns: [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\.print/, /import\s+java\./, /\bvoid\b.*\(.*\)\s*\{/],
  },
  {
    lang: 'cpp',
    patterns: [/#include\s*</, /std::/, /cout\s*<</, /cin\s*>>/, /int\s+main\s*\(/, /->/, /nullptr/],
  },
  {
    lang: 'csharp',
    patterns: [/using\s+System;/, /namespace\s+\w+/, /Console\.Write/, /public\s+class\s+\w+\s*:/, /\[.*\]\s*\n.*class/],
  },
  {
    lang: 'go',
    patterns: [/^package\s+\w+/m, /func\s+\w+\s*\(/, /fmt\.(Print|Println|Sprintf)/, /import\s*\(/, /:=\s*/],
  },
  {
    lang: 'rust',
    patterns: [/fn\s+\w+\s*\(/, /let\s+mut\s+/, /println!\s*\(/, /use\s+std::/, /impl\s+\w+/, /->.*\{/],
  },
  {
    lang: 'php',
    patterns: [/<\?php/, /\$\w+\s*=/, /echo\s+/, /->/, /function\s+\w+\s*\(/],
  },
  {
    lang: 'ruby',
    patterns: [/^\s*def\s+\w+/m, /puts\s+/, /\.each\s+do/, /require\s+'/, /end\s*$/m],
  },
  {
    lang: 'swift',
    patterns: [/import\s+Foundation/, /var\s+\w+\s*:\s*\w+/, /func\s+\w+\s*\(/, /guard\s+let/, /let\s+\w+\s*=/],
  },
  {
    lang: 'kotlin',
    patterns: [/fun\s+\w+\s*\(/, /val\s+\w+\s*=/, /var\s+\w+\s*:/, /println\s*\(/, /data\s+class/],
  },
  {
    lang: 'sql',
    patterns: [/SELECT\s+.+FROM/i, /INSERT\s+INTO/i, /UPDATE\s+\w+\s+SET/i, /CREATE\s+TABLE/i, /WHERE\s+/i],
  },
  {
    lang: 'html',
    patterns: [/<!DOCTYPE\s+html>/i, /<html[\s>]/, /<div[\s>]/, /<script[\s>]/, /<\/\w+>/],
  },
  {
    lang: 'css',
    patterns: [/\w+\s*\{[\s\S]*?\}/, /:\s*(block|flex|grid|none|absolute|relative)/, /margin|padding|font-size|border/],
  },
  {
    lang: 'yaml',
    patterns: [/^---/m, /^\w[\w-]*:\s/m, /^-\s+\w/m, /:\s*\|/, /:\s*>/],
  },
  {
    lang: 'bash',
    patterns: [/^#!/m, /\$\(/, /if\s+\[/, /echo\s+/, /export\s+\w+=/],
  },
  {
    lang: 'json',
    patterns: [/^\s*\{/, /"\w+":\s*/, /^\s*\[/],
  },
];

const LANGUAGE_LABELS: Record<DetectedLanguage, string> = {
  python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript',
  java: 'Java', cpp: 'C++', csharp: 'C#', go: 'Go', rust: 'Rust',
  php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin',
  sql: 'SQL', html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML',
  bash: 'Shell/Bash', unknown: 'Unknown',
};

export function detectLanguage(code: string): DetectedLanguage {
  const scores: Partial<Record<DetectedLanguage, number>> = {};

  for (const { lang, patterns } of LANGUAGE_SIGNATURES) {
    const hits = patterns.filter((p) => p.test(code)).length;
    if (hits > 0) scores[lang] = hits;
  }

  if (Object.keys(scores).length === 0) return 'unknown';

  return Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0] as DetectedLanguage;
}

// ─── Problem Patterns Per Language ────────────────────────────────────────

interface ProblemPattern {
  regex: RegExp;
  severity: CodeProblem['severity'];
  category: CodeProblem['category'];
  title: string;
  description: string;
  suggestedFix: string;
}

const UNIVERSAL_PATTERNS: ProblemPattern[] = [
  {
    regex: /password\s*=\s*["'][^"']{1,}/i,
    severity: 'critical', category: 'security',
    title: 'Hardcoded Password Detected',
    description: 'A plaintext password is embedded directly in source code.',
    suggestedFix: 'Use environment variables or a secrets manager (e.g. process.env.DB_PASS).',
  },
  {
    regex: /api_?key\s*=\s*["'][A-Za-z0-9_\-]{10,}/i,
    severity: 'critical', category: 'security',
    title: 'Hardcoded API Key Detected',
    description: 'An API key is committed to source code and may be leaked in version control.',
    suggestedFix: 'Move to environment variables and add to .gitignore.',
  },
  {
    regex: /secret\s*=\s*["'][^"']{4,}/i,
    severity: 'high', category: 'security',
    title: 'Hardcoded Secret Value',
    description: 'A secret or token is hardcoded in the source.',
    suggestedFix: 'Replace with environment variable reference.',
  },
  {
    regex: /TODO|FIXME|HACK|XXX/,
    severity: 'low', category: 'style',
    title: 'Unresolved TODO / FIXME Comment',
    description: 'Deferred work is marked but not tracked.',
    suggestedFix: 'Create a formal issue ticket and remove inline TODO.',
  },
];

const LANGUAGE_PATTERNS: Partial<Record<DetectedLanguage, ProblemPattern[]>> = {
  python: [
    { regex: /except\s*:/,            severity: 'high',   category: 'bug',         title: 'Bare except clause',         description: 'Catches all exceptions including SystemExit and KeyboardInterrupt.',                 suggestedFix: 'Use `except Exception as e:` to catch specific errors.' },
    { regex: /eval\s*\(/,             severity: 'critical', category: 'security',   title: 'Use of eval()',              description: 'eval() executes arbitrary code; a major injection vector.',                          suggestedFix: 'Parse structured data with json.loads() or ast.literal_eval().' },
    { regex: /==\s*True|==\s*False/,  severity: 'low',    category: 'style',       title: 'Comparison to True/False',   description: 'PEP8: use truthiness checks instead of == True.',                                    suggestedFix: 'Use `if condition:` instead of `if condition == True:`.' },
    { regex: /print\s*\(/,            severity: 'info',   category: 'style',       title: 'Debug print() left in code', description: 'print() calls should be replaced with proper logging.',                             suggestedFix: 'Use the `logging` module for production output.' },
    { regex: /open\s*\((?![^)]*with)/, severity: 'medium', category: 'bug',        title: 'File opened without context manager', description: 'File handle may not be closed on exceptions.',                           suggestedFix: 'Use `with open(...) as f:` to ensure file closure.' },
    { regex: /import \*/,             severity: 'medium', category: 'style',       title: 'Wildcard import',            description: '`from module import *` pollutes namespace and hides dependencies.',                  suggestedFix: 'Import only what you need: `from module import func`.' },
  ],
  javascript: [
    { regex: /var\s+\w+/,            severity: 'medium', category: 'style',       title: 'Use of var (function scope)', description: '`var` has function scope and hoisting issues.',                                    suggestedFix: 'Replace with `const` or `let` for block-scoped variables.' },
    { regex: /eval\s*\(/,            severity: 'critical', category: 'security',  title: 'Use of eval()',               description: 'eval() executes arbitrary code strings; dangerous in any context.',                  suggestedFix: 'Use JSON.parse() for data or restructure to avoid eval.' },
    { regex: /==(?!=)/,              severity: 'medium', category: 'bug',         title: 'Loose equality (==)',         description: 'Loose equality coerces types and causes subtle bugs.',                               suggestedFix: 'Use strict equality `===` instead.' },
    { regex: /console\.(log|debug|info)\s*\(/, severity: 'low', category: 'style', title: 'console.log left in code', description: 'Debug logging should not reach production.',                                        suggestedFix: 'Remove or replace with a proper logging library.' },
    { regex: /innerHTML\s*=/,        severity: 'high',   category: 'security',    title: 'innerHTML assignment (XSS)', description: 'Setting innerHTML with user input opens XSS vulnerabilities.',                      suggestedFix: 'Use textContent or sanitize input with DOMPurify.' },
    { regex: /catch\s*\(\w+\)\s*\{\s*\}/, severity: 'high', category: 'bug',     title: 'Empty catch block',          description: 'Errors are silently swallowed, making debugging impossible.',                         suggestedFix: 'Log the error or re-throw it with context.' },
    { regex: /new\s+Promise\s*\([\s\S]*?resolve\s*\([\s\S]*?reject/, severity: 'low', category: 'style', title: 'Promise constructor antipattern', description: 'Wrapping existing promises in new Promise() is an antipattern.', suggestedFix: 'Return the existing promise directly instead.' },
  ],
  typescript: [
    { regex: /:\s*any\b/,            severity: 'medium', category: 'style',       title: 'TypeScript any type usage',  description: '`any` disables type checking; defeats the purpose of TypeScript.',                  suggestedFix: 'Replace with a proper type or use `unknown` with type guards.' },
    { regex: /!\./,                  severity: 'medium', category: 'bug',         title: 'Non-null assertion (!)',      description: 'The `!` operator may cause runtime errors if value is null/undefined.',              suggestedFix: 'Add a proper null check or optional chaining (?.).' },
    { regex: /as\s+any/,             severity: 'high',   category: 'bug',         title: 'Type cast to any',           description: 'Casting to `any` bypasses compile-time safety.',                                    suggestedFix: 'Use a specific type or a type guard instead of `as any`.' },
    { regex: /console\.(log|debug)\s*\(/, severity: 'low', category: 'style',    title: 'console.log in TypeScript',  description: 'Debug statements should not reach production code.',                                 suggestedFix: 'Use a structured logger (e.g. winston, pino).' },
  ],
  java: [
    { regex: /catch\s*\(\s*Exception\s+/,  severity: 'medium', category: 'bug',  title: 'Overly broad catch clause',  description: 'Catching base Exception hides root cause.',                                          suggestedFix: 'Catch specific exception types (e.g. IOException, SQLException).' },
    { regex: /System\.out\.print/,         severity: 'low',    category: 'style', title: 'System.out used for logging', description: 'Direct console output should use a logging framework.',                            suggestedFix: 'Use SLF4J + Logback or java.util.logging.' },
    { regex: /==\s*"[^"]*"/,               severity: 'high',   category: 'bug',  title: 'String compared with ==',    description: '`==` checks reference equality for Strings, not value equality.',                   suggestedFix: 'Use `.equals()` for String value comparison.' },
    { regex: /\.printStackTrace\(\)/,      severity: 'medium', category: 'style', title: 'printStackTrace() called',  description: 'Printing stack traces exposes internals; not suitable for production.',               suggestedFix: 'Use a logger: `log.error("Error:", e);`' },
  ],
  go: [
    { regex: /err\s*!=\s*nil\s*\{[\s\S]*?panic\s*\(/m, severity: 'high', category: 'bug', title: 'panic() on recoverable error', description: 'Panicking on non-fatal errors crashes the service.', suggestedFix: 'Return the error up the call stack instead of panicking.' },
    { regex: /fmt\.Println\s*\(/,      severity: 'low',    category: 'style',  title: 'fmt.Println for logging',   description: 'fmt.Println is not structured and lacks log levels.',                                   suggestedFix: 'Use log/slog or zerolog for structured logging.' },
  ],
  sql: [
    { regex: /SELECT\s+\*/i,           severity: 'medium', category: 'performance', title: 'SELECT * usage',          description: 'Selecting all columns transfers unnecessary data and hides schema dependencies.',      suggestedFix: 'Select only the columns you need: SELECT id, name FROM ...' },
    { regex: /WHERE\s+1\s*=\s*1/i,     severity: 'low',    category: 'style',       title: 'WHERE 1=1 condition',     description: 'Tautological WHERE clause is a code smell from dynamic query builders.',               suggestedFix: 'Build queries conditionally and remove WHERE 1=1.' },
    { regex: /DROP\s+TABLE/i,          severity: 'critical', category: 'security',  title: 'DROP TABLE in code',      description: 'Destructive DDL statement found in application code.',                                suggestedFix: 'Ensure this is intentional and add IF EXISTS guard.' },
    { regex: /'\s*\+\s*\w+\s*\+\s*'/,  severity: 'critical', category: 'security', title: 'SQL string concatenation', description: 'String concatenation in SQL queries is a classic SQL Injection vector.',               suggestedFix: 'Use parameterized queries or prepared statements.' },
  ],
};

// ─── Main Analyzer ─────────────────────────────────────────────────────────

export function analyzeCode(code: string, fileName?: string): CodeAnalysisResult {
  const lang = fileName
    ? detectFromFileName(fileName) || detectLanguage(code)
    : detectLanguage(code);

  const lines = code.split('\n');
  const problems: CodeProblem[] = [];
  let idCounter = 1;

  const addProblem = (pattern: ProblemPattern, match: RegExpExecArray | null) => {
    // Find line number
    let lineNum: number | null = null;
    if (match) {
      const before = code.substring(0, match.index);
      lineNum = before.split('\n').length;
    }

    problems.push({
      id: `P${String(idCounter++).padStart(3, '0')}`,
      line: lineNum,
      severity: pattern.severity,
      category: pattern.category,
      title: pattern.title,
      description: pattern.description,
      suggestedFix: pattern.suggestedFix,
    });
  };

  // Check universal patterns
  for (const pattern of UNIVERSAL_PATTERNS) {
    const match = pattern.regex.exec(code);
    if (match) addProblem(pattern, match);
  }

  // Check language-specific patterns
  const langPatterns = LANGUAGE_PATTERNS[lang] ?? [];
  for (const pattern of langPatterns) {
    const match = pattern.regex.exec(code);
    if (match) addProblem(pattern, match);
  }

  // Compute health score
  const penalty =
    problems.reduce((sum, p) => {
      const w = { critical: 25, high: 15, medium: 8, low: 3, info: 1 }[p.severity];
      return sum + w;
    }, 0);
  const healthScore = Math.max(0, 100 - penalty);

  const riskLevel: CodeAnalysisResult['riskLevel'] =
    healthScore >= 80 ? 'low' : healthScore >= 60 ? 'medium' : healthScore >= 35 ? 'high' : 'critical';

  const critical = problems.filter((p) => p.severity === 'critical').length;
  const high = problems.filter((p) => p.severity === 'high').length;

  const summary =
    problems.length === 0
      ? `No issues detected. Code health is excellent (${healthScore}/100).`
      : `Found ${problems.length} issue(s): ${critical} critical, ${high} high severity. Health: ${healthScore}/100.`;

  return {
    language: lang,
    languageLabel: LANGUAGE_LABELS[lang],
    problems,
    healthScore,
    riskLevel,
    summary,
    lineCount: lines.length,
    charCount: code.length,
  };
}

function detectFromFileName(fileName: string): DetectedLanguage | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const extMap: Record<string, DetectedLanguage> = {
    py: 'python', js: 'javascript', ts: 'typescript', jsx: 'javascript',
    tsx: 'typescript', java: 'java', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    cs: 'csharp', go: 'go', rs: 'rust', php: 'php', rb: 'ruby',
    swift: 'swift', kt: 'kotlin', sql: 'sql', html: 'html', htm: 'html',
    css: 'css', json: 'json', yaml: 'yaml', yml: 'yaml', sh: 'bash',
  };
  return ext ? extMap[ext] ?? null : null;
}
