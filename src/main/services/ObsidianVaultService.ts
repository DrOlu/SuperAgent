import { application } from '@application'
import { loggerService } from '@logger'
import { isMac, isWin } from '@main/core/platform'
import fs from 'fs'
import path from 'path'

const logger = loggerService.withContext('ObsidianVaultService')
interface VaultInfo {
  path: string
  name: string
}

interface FileInfo {
  path: string
  type: 'folder' | 'markdown'
  name: string
}

class ObsidianVaultService {
  private obsidianConfigPath?: string

  private getObsidianConfigPath(): string {
    if (this.obsidianConfigPath === undefined) {
      if (isWin) {
        this.obsidianConfigPath = path.join(application.getPath('sys.appdata'), 'obsidian', 'obsidian.json')
      } else if (isMac) {
        this.obsidianConfigPath = path.join(
          application.getPath('sys.home'),
          'Library',
          'Application Support',
          'obsidian',
          'obsidian.json'
        )
      } else {
        // Linux
        this.obsidianConfigPath = this.resolveLinuxObsidianConfigPath()
        logger.debug(`Resolved Obsidian config path (linux): ${this.obsidianConfigPath}`)
      }
    }
    return this.obsidianConfigPath
  }

  /**
   * Obsidian Vault
   */
  getVaults(): VaultInfo[] {
    try {
      const obsidianConfigPath = this.getObsidianConfigPath()
      if (!fs.existsSync(obsidianConfigPath)) {
        return []
      }

      const configContent = fs.readFileSync(obsidianConfigPath, 'utf8')
      const config = JSON.parse(configContent)

      if (!config.vaults) {
        return []
      }

      return Object.entries(config.vaults).map(([, vault]: [string, any]) => ({
        path: vault.path,
        name: vault.name || path.basename(vault.path)
      }))
    } catch (error) {
      logger.error('Failed to get Obsidian Vault:', error as Error)
      return []
    }
  }

  /**
   * VaultMarkdown
   */
  async getVaultStructure(vaultPath: string): Promise<FileInfo[]> {
    const results: FileInfo[] = []

    try {
      // vault
      let stats: fs.Stats
      try {
        stats = await fs.promises.stat(vaultPath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          logger.error(`Vault path does not exist: ${vaultPath}`)
          return []
        }
        throw error
      }

      // 
      if (!stats.isDirectory()) {
        logger.error(`Vault path is not a directory: ${vaultPath}`)
        return []
      }

      await this.traverseDirectory(vaultPath, '', results)
    } catch (error) {
      logger.error('Failed to read Vault folder structure:', error as Error)
    }

    return results
  }

  /**
   * Markdown
   */
  private async traverseDirectory(dirPath: string, relativePath: string, results: FileInfo[]): Promise<void> {
    try {
      // 
      if (relativePath) {
        results.push({
          path: relativePath,
          type: 'folder',
          name: path.basename(relativePath)
        })
      }

      let items
      try {
        items = await fs.promises.readdir(dirPath, { withFileTypes: true })
      } catch (err) {
        logger.error(`Failed to read directory ${dirPath}:`, err as Error)
        return
      }

      for (const item of items) {
        // .
        if (item.name.startsWith('.')) {
          continue
        }

        const newRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name
        const fullPath = path.join(dirPath, item.name)

        if (item.isDirectory()) {
          await this.traverseDirectory(fullPath, newRelativePath, results)
        } else if (item.isFile() && item.name.endsWith('.md')) {
          // .md
          results.push({
            path: newRelativePath,
            type: 'markdown',
            name: item.name
          })
        }
      }
    } catch (error) {
      logger.error(`Failed to traverse directory ${dirPath}:`, error as Error)
    }
  }

  /**
   * VaultMarkdown
   * @param vaultName vault
   */
  async getFilesByVaultName(vaultName: string): Promise<FileInfo[]> {
    try {
      const vaults = this.getVaults()
      const vault = vaults.find((v) => v.name === vaultName)

      if (!vault) {
        logger.error(`Vault not found: ${vaultName}`)
        return []
      }

      logger.debug(`Get Vault file structure: ${vault.name} ${vault.path}`)
      return await this.getVaultStructure(vault.path)
    } catch (error) {
      logger.error('Failed to get Vault file structure:', error as Error)
      return []
    }
  }

  /**
   *  Linux  Obsidian 
   *  XDG 
   */
  private resolveLinuxObsidianConfigPath(): string {
    const home = application.getPath('sys.home')
    const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config')

    // 
    const configDirs = ['obsidian', 'Obsidian']
    const fileNames = ['obsidian.json', 'Obsidian.json']

    const candidates: string[] = []

    // 1) AppImage/DEBXDG 
    for (const dir of configDirs) {
      for (const file of fileNames) {
        candidates.push(path.join(xdgConfigHome, dir, file))
      }
    }

    // 2) Snap 
    // - ~/snap/obsidian/current/.config/obsidian/obsidian.json
    // - ~/snap/obsidian/common/.config/obsidian/obsidian.json
    for (const dir of configDirs) {
      for (const file of fileNames) {
        candidates.push(path.join(home, 'snap', 'obsidian', 'current', '.config', dir, file))
        candidates.push(path.join(home, 'snap', 'obsidian', 'common', '.config', dir, file))
      }
    }

    // 3) Flatpak ~/.var/app/md.obsidian.Obsidian/config/obsidian/obsidian.json
    for (const dir of configDirs) {
      for (const file of fileNames) {
        candidates.push(path.join(home, '.var', 'app', 'md.obsidian.Obsidian', 'config', dir, file))
      }
    }

    const existing = candidates.find((p) => {
      try {
        return fs.existsSync(p)
      } catch {
        return false
      }
    })

    if (existing) return existing

    return path.join(xdgConfigHome, 'obsidian', 'obsidian.json')
  }
}

export default ObsidianVaultService
