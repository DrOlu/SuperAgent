import { Flex, MenuDivider, MenuItem, MenuList, PageHeader } from '@cherrystudio/ui'
import { McpLogo } from '@renderer/components/icons/SvgIcon'
import Scrollbar from '@renderer/components/Scrollbar'
import {
  settingsSubmenuDividerClassName,
  settingsSubmenuItemClassName,
  settingsSubmenuItemLabelClassName,
  settingsSubmenuListClassName,
  settingsSubmenuScrollClassName,
  settingsSubmenuSectionTitleClassName
} from '@renderer/pages/settings/settingsStyles'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { FolderCog, Server, ShoppingBag } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import { getMcpProviderLogo, getProviderDisplayName, providers } from './providers/config'

const McpSettings: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // 
  const getActiveView = () => {
    const path = location.pathname

    // 
    if (path === '/settings/mcp/builtin') return 'builtin'
    if (path === '/settings/mcp/marketplaces') return 'marketplaces'

    //  - 
    for (const provider of providers) {
      if (path === `/settings/mcp/${provider.key}`) {
        return provider.key
      }
    }

    //  serverssettings/:serverIdnpx-searchmcp-install servers
    return 'servers'
  }

  const activeView = getActiveView()

  return (
    <Flex className="min-w-0 flex-1">
      <div className="flex h-[calc(100vh-var(--navbar-height)-6px)] w-full min-w-0 flex-1 flex-row overflow-hidden">
        <div className={`flex flex-col ${settingsSubmenuScrollClassName}`}>
          <PageHeader title={t('settings.mcp.shortTitle')} />
          <Scrollbar className="min-h-0 flex-1">
            <MenuList className={settingsSubmenuListClassName}>
              <MenuItem
                label={t('settings.mcp.title')}
                active={activeView === 'servers'}
                onClick={() => navigate({ to: '/settings/mcp/servers' })}
                icon={<McpLogo width={18} height={18} className="text-foreground" />}
                className={settingsSubmenuItemClassName}
                labelClassName={settingsSubmenuItemLabelClassName}
              />
              <MenuDivider className={settingsSubmenuDividerClassName} />
              <div className={settingsSubmenuSectionTitleClassName}>{t('settings.mcp.discover', 'Discover')}</div>
              <MenuItem
                label={t('settings.mcp.builtinServers', 'Built-in Servers')}
                active={activeView === 'builtin'}
                onClick={() => navigate({ to: '/settings/mcp/builtin' })}
                icon={<Server size={18} />}
                className={settingsSubmenuItemClassName}
                labelClassName={settingsSubmenuItemLabelClassName}
              />
              <MenuItem
                label={t('settings.mcp.marketplaces', 'Marketplaces')}
                active={activeView === 'marketplaces'}
                onClick={() => navigate({ to: '/settings/mcp/marketplaces' })}
                icon={<ShoppingBag size={18} />}
                className={settingsSubmenuItemClassName}
                labelClassName={settingsSubmenuItemLabelClassName}
              />
              <MenuDivider className={settingsSubmenuDividerClassName} />
              <div className={settingsSubmenuSectionTitleClassName}>{t('settings.mcp.providers', 'Providers')}</div>
              {providers.map((provider) => (
                <MenuItem
                  key={provider.key}
                  label={getProviderDisplayName(provider, t)}
                  active={activeView === provider.key}
                  onClick={() => navigate({ to: `/settings/mcp/${provider.key}` })}
                  icon={(() => {
                    const logo = getMcpProviderLogo(provider.key)
                    return logo ? <logo.Avatar size={16} shape="circle" /> : <FolderCog size={16} />
                  })()}
                  className={settingsSubmenuItemClassName}
                  labelClassName={settingsSubmenuItemLabelClassName}
                />
              ))}
            </MenuList>
          </Scrollbar>
        </div>
        <div className="relative flex min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </Flex>
  )
}

export default McpSettings
