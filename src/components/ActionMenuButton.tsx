import type { MenuProps } from 'antd'
import type { PropsWithChildren } from 'react'

import { theme as antdTheme, Button, Dropdown } from 'antd'
import { DownOutlined } from '@ant-design/icons'

export type TActionMenuButtonProps = PropsWithChildren<{
  menu: MenuProps,
  checked?: boolean | undefined | null,
  trigger?: Array<"click" | "hover" | "contextMenu">
}>

export default function ActionMenuButton({
  menu,
  checked = false,
  trigger = ["click"],
  children,
}: TActionMenuButtonProps) {
  const antdThemeToken = antdTheme.useToken().token
  return (
    <Dropdown menu={menu} trigger={trigger} disabled={menu.items?.length === 0}>
      <Button
        style={checked ? {background: antdThemeToken.colorInfoBgHover} : undefined}
      >
        {children} <DownOutlined style={{color: antdThemeToken.colorTextQuaternary}}/>
      </Button>
    </Dropdown>
  )
}
