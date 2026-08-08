import { codeLanguages } from '@shared/utils/codeLanguages'

export const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
export const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv']
export const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac']
export const documentExts = ['.pdf', '.doc', '.docx', '.pptx', '.xlsx', '.xls', '.odt', '.odp', '.ods']
export const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz'] as const
export const knowledgeSupportedFileExts = [
  '.txt',
  '.markdown',
  '.md',
  '.mdx',
  '.pdf',
  '.html',
  '.htm',
  '.xlsx',
  '.xls',
  '.docx',
  '.csv',
  '.doc',
  '.pptx',
  '.ppt',
  '.epub',
  '.draftsexport'
] as const
export const knowledgeFileProcessingExts = ['.pdf', '.doc', '.docx', '.pptx', '.xlsx', '.xls'] as const

/**
 * A flat array of all file extensions known by the linguist database.
 * This is the primary source for identifying code files.
 */
const linguistExtSet = new Set<string>()
for (const lang of Object.values(codeLanguages)) {
  if (lang.extensions) {
    for (const ext of lang.extensions) {
      linguistExtSet.add(ext)
    }
  }
}
export const codeLangExts = Array.from(linguistExtSet)

/**
 * A categorized map of custom text-based file extensions that are NOT included
 * in the linguist database. This is for special cases or project-specific files.
 */
export const customTextExts = new Map([
  [
    'language',
    [
      '.R', // R
      '.ets', // OpenHarmony,
      '.uniswap', // DeFi
      '.usf', // Unreal shader format
      '.ush' // Unreal shader header
    ]
  ],
  [
    'template',
    [
      '.vm' // Velocity
    ]
  ],
  [
    'config',
    [
      '.babelrc', // Babel
      '.bashrc',
      '.browserslistrc',
      '.conf',
      '.config', // 
      '.dockerignore', // Docker ignore
      '.eslintignore',
      '.eslintrc', // ESLint
      '.fishrc', // Fish shell
      '.htaccess', // Apache
      '.npmignore',
      '.npmrc', // npm
      '.prettierignore',
      '.prettierrc', // Prettier
      '.rc',
      '.robots', // robots.txt
      '.yarnrc',
      '.zshrc'
    ]
  ],
  [
    'document',
    [
      '.authors', // 
      '.changelog', // 
      '.license', // 
      '.nfo', // 
      '.readme',
      '.text' // 
    ]
  ],
  [
    'data',
    [
      '.atom', // Feed
      '.ldif',
      '.map',
      '.ndjson' // JSON
    ]
  ],
  [
    'build',
    [
      '.bazel', // Bazel
      '.build', // Meson
      '.pom'
    ]
  ],
  [
    'database',
    [
      '.dml', // DDL/DML
      '.psql' // PostgreSQL
    ]
  ],
  [
    'web',
    [
      '.openapi', // API
      '.swagger'
    ]
  ],
  [
    'version',
    [
      '.bzrignore', // Bazaar ignore
      '.gitattributes', // Git attributes
      '.githistory', // Git history
      '.hgignore', // Mercurial ignore
      '.svnignore' // SVN ignore
    ]
  ],
  [
    'subtitle',
    [
      '.ass', // 
      '.sub'
    ]
  ],
  [
    'log',
    [
      '.log',
      '.rpt' //  (.out)
    ]
  ],
  [
    'eda',
    [
      '.cir',
      '.def', // LEF/DEF
      '.edif', // EDIF
      '.il',
      '.ils', // SKILL
      '.lef',
      '.net',
      '.scs', // Spectre
      '.sdf', // SDF
      '.spi'
    ]
  ]
])

/**
 * A comprehensive list of all text-based file extensions, combining the
 * extensive list from the linguist database with our custom additions.
 * The Set ensures there are no duplicates.
 */
export const textExts = [...new Set([...Array.from(customTextExts.values()).flat(), ...codeLangExts])]
