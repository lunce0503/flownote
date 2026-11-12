import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { java } from '@codemirror/lang-java';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { StreamLanguage } from '@codemirror/language';
import { c, cpp, csharp, kotlin } from '@codemirror/legacy-modes/mode/clike';
import { go } from '@codemirror/legacy-modes/mode/go';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import type { Extension } from '@codemirror/state';
import type { CodeLanguage } from '@/entities/blog';

const languages: Record<CodeLanguage, () => Extension> = {
  plaintext: () => [],
  json,
  python,
  rust,
  typescript: () => javascript({ typescript: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  javascript,
  jsx: () => javascript({ jsx: true }),
  java,
  kotlin: () => StreamLanguage.define(kotlin),
  c: () => StreamLanguage.define(c),
  cpp: () => StreamLanguage.define(cpp),
  csharp: () => StreamLanguage.define(csharp),
  go: () => StreamLanguage.define(go),
  swift: () => StreamLanguage.define(swift),
  ruby: () => StreamLanguage.define(ruby),
  php,
  shell: () => StreamLanguage.define(shell),
  sql,
  yaml: () => StreamLanguage.define(yaml),
  toml: () => StreamLanguage.define(toml),
  html,
  css,
  xml,
  markdown,
};

export const codeLanguageExtension = (language: CodeLanguage): Extension => languages[language]();
