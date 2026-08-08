import { loggerService } from '@logger'
import type { Tab } from '@shared/data/cache/cacheValueTypes'

const logger = loggerService.withContext('TabLRU')

/**
 * Tab LRU limits configuration
 *
 * Controls when inactive tabs should be hibernated to save memory.
 * TODO: 
 */
export const TAB_LIMITS = {
  /**
   *  LRU 
   *  10
   */
  softCap: 10,

  /**
   *  runaway
   * 
   */
  hardCap: 22
}

export type TabLimits = typeof TAB_LIMITS

/**
 * TabLruManager -  LRU 
 *
 * 
 * -  LRU 
 * - 
 * - 
 */
export class TabLruManager {
  private softCap: number
  private hardCap: number

  constructor(limits: TabLimits = TAB_LIMITS) {
    this.softCap = limits.softCap
    this.hardCap = limits.hardCap
  }

  /**
   *  ID 
   *
   * 
   * -  softCap softCap
   * -  hardCap softCap+
   *
   * @param tabs 
   * @param activeTabId  ID
   * @returns  ID 
   */
  checkAndGetDormantCandidates(tabs: Tab[], activeTabId: string): string[] {
    const activeTabs = tabs.filter((t) => !t.isDormant)
    const activeCount = activeTabs.length

    // 
    if (activeCount <= this.softCap) {
      return []
    }

    const isHardCapTriggered = activeCount > this.hardCap

    // 
    // +
    const candidates = isHardCapTriggered
      ? this.getHardCapCandidates(activeTabs, activeTabId)
      : this.getLRUCandidates(activeTabs, activeTabId)

    //  softCap
    let toHibernateCount = activeCount - this.softCap

    if (isHardCapTriggered) {
      logger.warn('Hard cap triggered - using relaxed exemption rules', {
        activeCount,
        hardCap: this.hardCap,
        softCap: this.softCap,
        toHibernate: toHibernateCount
      })
    }

    // 
    toHibernateCount = Math.min(toHibernateCount, candidates.length)

    // 
    const afterHibernation = activeCount - toHibernateCount
    if (isHardCapTriggered && afterHibernation > this.hardCap) {
      //  hardCap 
      logger.error('Cannot guarantee hard cap - insufficient candidates', {
        activeCount,
        candidatesAvailable: candidates.length,
        willHibernate: toHibernateCount,
        afterHibernation,
        hardCap: this.hardCap
      })
    } else if (afterHibernation > this.softCap) {
      //  softCap hardCap 
      logger.warn('Cannot reach soft cap - limited by available candidates', {
        activeCount,
        candidatesAvailable: candidates.length,
        willHibernate: toHibernateCount,
        afterHibernation,
        softCap: this.softCap
      })
    }

    const result = candidates.slice(0, toHibernateCount).map((t) => t.id)

    if (result.length > 0) {
      logger.info('Tabs selected for hibernation', {
        count: result.length,
        ids: result,
        activeCount,
        softCap: this.softCap,
        hardCapTriggered: isHardCapTriggered
      })
    }

    return result
  }

  /**
   * 
   */
  private getHardCapCandidates(tabs: Tab[], activeTabId: string): Tab[] {
    return tabs
      .filter((tab) => !this.isHardExempt(tab, activeTabId))
      .sort((a, b) => (a.lastAccessTime ?? 0) - (b.lastAccessTime ?? 0))
  }

  /**
   * +
   */
  private isHardExempt(tab: Tab, activeTabId: string): boolean {
    return (
      tab.id === activeTabId || // 
      tab.id === 'home' || //  TabsContext  DEFAULT_TAB.id 
      tab.isDormant === true // 
    )
    // isPinned 
  }

  /**
   *  LRU 
   */
  private getLRUCandidates(tabs: Tab[], activeTabId: string): Tab[] {
    return tabs
      .filter((tab) => !this.isExempt(tab, activeTabId))
      .sort((a, b) => (a.lastAccessTime ?? 0) - (b.lastAccessTime ?? 0))
  }

  /**
   * 
   *
   * 
   * - 
   * -  (id === 'home')
   * -  (isPinned)
   * - 
   */
  private isExempt(tab: Tab, activeTabId: string): boolean {
    return (
      tab.id === activeTabId || // 
      tab.id === 'home' || //  TabsContext  DEFAULT_TAB.id 
      tab.isPinned === true || // 
      tab.isDormant === true // 
    )
  }

  /**
   * 
   */
  updateSoftCap(newSoftCap: number): void {
    this.softCap = newSoftCap
    logger.info('SoftCap updated', { newSoftCap })
  }

  /**
   * 
   */
  updateHardCap(newHardCap: number): void {
    this.hardCap = newHardCap
    logger.info('HardCap updated', { newHardCap })
  }

  /**
   * 
   */
  getLimits(): TabLimits {
    return {
      softCap: this.softCap,
      hardCap: this.hardCap
    }
  }
}
