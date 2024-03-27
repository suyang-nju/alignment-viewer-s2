import type { MenuProps } from 'antd'
import type { PropsWithChildren } from 'react'
import { Button, Dropdown } from 'antd'


export type  TMenuButtonProps = PropsWithChildren & Record<string, any> & {
  menuItems: MenuProps["items"], 
  onMenuItemClick: MenuProps["onClick"]
}

export default function MenuButton({ 
  children, menuItems, onMenuItemClick, ...restProps
}: TMenuButtonProps) {
  return (
    <Dropdown menu={{items: menuItems, onClick: onMenuItemClick}}>
      <Button disabled={!menuItems?.length} {...restProps}>{children}</Button>
    </Dropdown>
  )
}

