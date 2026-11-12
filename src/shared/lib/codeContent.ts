export const CODE_LANGUAGES = [
  { id: 'plaintext', label: '일반 텍스트', extensions: ['txt', 'text', 'log', 'csv'] },
  { id: 'json', label: 'JSON', extensions: ['json', 'jsonc'] },
  { id: 'python', label: 'Python', extensions: ['py', 'pyi', 'pyw'] },
  { id: 'rust', label: 'Rust', extensions: ['rs'] },
  { id: 'typescript', label: 'TypeScript', extensions: ['ts', 'mts', 'cts'] },
  { id: 'tsx', label: 'TypeScript JSX', extensions: ['tsx'] },
  { id: 'javascript', label: 'JavaScript', extensions: ['js', 'mjs', 'cjs'] },
  { id: 'jsx', label: 'JavaScript JSX', extensions: ['jsx'] },
  { id: 'java', label: 'Java', extensions: ['java'] },
  { id: 'kotlin', label: 'Kotlin', extensions: ['kt', 'kts'] },
  { id: 'c', label: 'C', extensions: ['c', 'h'] },
  { id: 'cpp', label: 'C++', extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'] },
  { id: 'csharp', label: 'C#', extensions: ['cs'] },
  { id: 'go', label: 'Go', extensions: ['go'] },
  { id: 'swift', label: 'Swift', extensions: ['swift'] },
  { id: 'ruby', label: 'Ruby', extensions: ['rb', 'rake'] },
  { id: 'php', label: 'PHP', extensions: ['php'] },
  { id: 'shell', label: 'Shell', extensions: ['sh', 'bash', 'zsh'] },
  { id: 'sql', label: 'SQL', extensions: ['sql'] },
  { id: 'yaml', label: 'YAML', extensions: ['yaml', 'yml'] },
  { id: 'toml', label: 'TOML', extensions: ['toml', 'ini', 'conf'] },
  { id: 'html', label: 'HTML', extensions: ['html', 'htm'] },
  { id: 'css', label: 'CSS', extensions: ['css', 'scss', 'less'] },
  { id: 'xml', label: 'XML', extensions: ['xml', 'svg'] },
  { id: 'markdown', label: 'Markdown 원문', extensions: ['md', 'markdown'] },
] as const;

export type CodeLanguage = typeof CODE_LANGUAGES[number]['id'];
export type CodeEncoding = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be';
export type CodeContent = {
  format: 'code';
  version: 1;
  text: string;
  language: CodeLanguage;
  encoding?: CodeEncoding;
};

const encodings = new Set(['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be']);
export function isCodeContent(value: unknown): value is CodeContent {
  if (!value || typeof value !== 'object') return false;
  const content = value as Partial<CodeContent>;
  return content.format === 'code' && content.version === 1 && typeof content.text === 'string'
    && CODE_LANGUAGES.some(language => language.id === content.language)
    && (content.encoding === undefined || encodings.has(content.encoding));
}

