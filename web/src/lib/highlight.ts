import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki'

const EXT_TO_LANG: Record<string, BundledLanguage> = {
  // Web
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  mts: 'typescript',
  cts: 'typescript',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',

  // Systems
  rs: 'rust',
  go: 'go',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  zig: 'zig',

  // Scripting
  py: 'python',
  rb: 'ruby',
  lua: 'lua',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  pl: 'perl',
  php: 'php',
  ex: 'elixir',
  exs: 'elixir',

  // JVM
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  groovy: 'groovy',
  gradle: 'groovy',
  clj: 'clojure',

  // .NET
  cs: 'csharp',
  fs: 'fsharp',

  // Data / config
  json: 'json',
  jsonc: 'jsonc',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  ini: 'ini',
  env: 'dotenv',

  // Markup / docs
  md: 'markdown',
  mdx: 'mdx',
  tex: 'latex',
  typ: 'typst',

  // Query
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',

  // Infra
  tf: 'hcl',
  hcl: 'hcl',
  nix: 'nix',

  // Other
  swift: 'swift',
  dart: 'dart',
  r: 'r',
  R: 'r',
  elm: 'elm',
  hs: 'haskell',
  ml: 'ocaml',
  mli: 'ocaml',
  proto: 'proto',

  // Shell / config files
  dockerfile: 'dockerfile',
  makefile: 'makefile',
}

// Special filenames that map to languages
const NAME_TO_LANG: Record<string, BundledLanguage> = {
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  Containerfile: 'dockerfile',
  Justfile: 'just',
  '.gitignore': 'shellscript' as BundledLanguage,
}

export function fileExtToLang(filePath: string): BundledLanguage | null {
  const basename = filePath.split('/').pop() ?? ''
  if (NAME_TO_LANG[basename]) return NAME_TO_LANG[basename]

  const ext = basename.includes('.') ? basename.split('.').pop()! : ''
  return EXT_TO_LANG[ext] ?? null
}

let _highlighter: Promise<Highlighter> | null = null

function getHighlighterInstance(): Promise<Highlighter> {
  if (!_highlighter) {
    _highlighter = createHighlighter({
      themes: ['vitesse-dark', 'vitesse-light'],
      langs: ['bash'],
    })
  }
  return _highlighter
}

export async function highlight(code: string, lang: BundledLanguage): Promise<string> {
  const hl = await getHighlighterInstance()
  const loaded = hl.getLoadedLanguages()
  if (!loaded.includes(lang)) {
    await hl.loadLanguage(lang)
  }
  return hl.codeToHtml(code, {
    lang,
    themes: { dark: 'vitesse-dark', light: 'vitesse-light' },
    defaultColor: false,
  })
}

export async function highlightBash(code: string): Promise<string> {
  return highlight(code, 'bash')
}
