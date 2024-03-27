import type { MenuProps } from 'antd'
import type {
  TSequenceAnnotationFields, 
  TAlignmentSortParams, 
  TSequenceRecord, 
  TAVMouseEventInfo,
} from '../lib/types'
import type { ReactNode } from 'react'

import { CellTypes } from '@antv/s2'
import { 
  ConfigProvider, theme as antdTheme, Flex, Space, Button, 
  Tooltip, Tag, Typography, Layout, Spin, Dropdown, Empty,
} from 'antd'
import { 
  CheckOutlined, 
  PushpinOutlined, 
  PushpinFilled, 
  CaretUpFilled, 
  CaretDownFilled, 
  EyeInvisibleOutlined, 
  PicCenterOutlined,
} from '@ant-design/icons'
import { BsTextCenter, BsDistributeVertical } from "react-icons/bs"
import { isNil, find, isNumber } from 'lodash'

import {
  HIDDEN_ANNOTATION_FIELDS,
  GROUP_ANNOTATION_FIELDS,
} from '../lib/constants'


type TContextMenuProps = {
  isOverviewMode: boolean,
  referenceSequenceIndex?: number, 
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  pinnedColumns: string[],
  otherVisibleColumns: string[], 
  sortBy: TAlignmentSortParams[], 
  groupBy: string | number | undefined,
  contextMenuTarget?: TAVMouseEventInfo, 
  paddingXS: number,
  setOtherVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>,
  setPinnedColumns: React.Dispatch<React.SetStateAction<string[]>>,
  showArrangeColumns: () => void,
  setSortBy: React.Dispatch<React.SetStateAction<TAlignmentSortParams[]>>,
  showSortByColumns: () => void,
  setGroupBy: (by: string | number | undefined) => void,
  setReferenceSequenceIndex: (referenceSequenceIndex: number) => void,
  showImportAnnotations: () => void,
}

export function createContextMenu(props: TContextMenuProps): MenuProps {
  const {
    isOverviewMode,
    referenceSequenceIndex,
    annotationFields = {}, 
    availableColumnsImported, 
    availableColumnsDerived, 
    pinnedColumns,
    sortBy, 
    groupBy, 
    contextMenuTarget, 
    paddingXS,
  } = props

  const contextMenuItems: MenuProps["items"] = []

  if (contextMenuTarget?.target?.cellType === CellTypes.COL_CELL) {
    const { Text } = Typography
    const currentField = contextMenuTarget?.viewMeta.field
    const currentFieldName = currentField ? annotationFields[currentField]?.name : undefined

    let isSortedByCurrentField: "asc" | "desc" | "no" = "no"
    if (sortBy.length > 0) {
      for (const by of sortBy) {
        if (contextMenuTarget?.viewMeta.field === by.field) {
          isSortedByCurrentField = by.order
        }
      }
    }

    const sortSubmenuItems: MenuProps['items'] = []
    if (contextMenuTarget.viewMeta.field && !HIDDEN_ANNOTATION_FIELDS.includes(contextMenuTarget.viewMeta.field)) {
      sortSubmenuItems.push({
        key: "sort-asc",
        label: <>Ascending <Text italic>{currentFieldName}</Text></>,
        icon: (isSortedByCurrentField === "asc") ? <CheckOutlined /> : null,
      }, {
        key: "sort-desc",
        label: <>Descending <Text italic>{currentFieldName}</Text></>,
        icon: (isSortedByCurrentField === "desc") ? <CheckOutlined /> : null,
      })
    }
    
    // Sort by columns
    contextMenuItems.push({
      key: "sort-submenu",
      label: "Sort sequences by",
      children: sortSubmenuItems.concat(createSortMenu({
        annotationFields,
        availableColumnsImported, 
        availableColumnsDerived, 
        sortBy, 
        groupBy,
        paddingXS,
      }) ?? []),
    })

    if (!isOverviewMode) { // can't customize visible columns in overview mode
      // Show / hide columns
      if (currentField && (availableColumnsImported.includes(currentField) || availableColumnsDerived.includes(currentField))) {
        contextMenuItems.push({
          key: "show-hide-column-divider",
          type: "divider"
        }, {
          key: "pin-unpin-" + currentField,
          label: <>{pinnedColumns.includes(currentField) ? "Unpin" : "Pin"} <Text italic>{currentFieldName}</Text></>,
          icon: pinnedColumns.includes(currentField) ? <PushpinOutlined/> : <PushpinFilled/>,
        }, {
          key: "hide-column-" + currentField,
          label: <>Hide <Text italic>{currentFieldName}</Text></>,
          icon: <EyeInvisibleOutlined/>
        })
      }

      contextMenuItems.push({
        key: "show-hide-columns",
        label: "Show / hide columns",
        children: createShowHideColumnsMenu(props)
      })
    }

    // Group by column
    if (currentField && (availableColumnsImported.includes(currentField) || availableColumnsDerived.includes(currentField))) {
      contextMenuItems.push({
        key: "group-by-column-divider",
        type: "divider"
      }, {
        key: "group-ungroup-by-" + currentField,
        label: <>{(groupBy === currentField) ? "Ungroup by" : "Group by"} <Text italic>{currentFieldName}</Text></>,
        icon: (groupBy === currentField) ? <BsTextCenter /> : <BsDistributeVertical/>,
      })
    }

    contextMenuItems.push({
      key: "group-by",
      label: "Group by",
      children: createGroupByMenu(props)
    })    
  }

  const currentResidueIndex = contextMenuTarget?.contextualInfo?.residueIndex
  if (currentResidueIndex !== undefined) {
    contextMenuItems.push({
      key: "group-ungroup-by-sequence-position",
      label: (groupBy === currentResidueIndex) ? "Ungroup by this position" : "Group by this position",
      icon: (groupBy === currentResidueIndex) ? <BsTextCenter /> : <BsDistributeVertical/>,
    })
  }

  const currentSequenceIndex = contextMenuTarget?.contextualInfo?.sequenceIndex
  if (Number.isInteger(currentSequenceIndex)) {
    if (referenceSequenceIndex !== currentSequenceIndex) {
      contextMenuItems.push({
        key: "set-reference-sequence",
        label: "Set as reference sequence",
      })
    }
  }
  
  fixIcons(contextMenuItems)

  return ({
    items: contextMenuItems, 
    onClick: createContextMenuEventHandler(props),
  })
}

export function createSortMenu({
  annotationFields = {},
  availableColumnsImported, 
  availableColumnsDerived, 
  sortBy, 
  groupBy,
  paddingXS,
}: {
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  sortBy: TAlignmentSortParams[], 
  groupBy: string | number | undefined,
  paddingXS: number,
}): MenuProps["items"] {
  if ((availableColumnsImported.length === 0) && (availableColumnsDerived.length === 0)) {
    return []
  }

  const sortAscByOneColumnMenuItems: MenuProps['items'] = []
  const sortDescByOneColumnMenuItems: MenuProps['items'] = []
  for (const availableColumns of [availableColumnsImported, availableColumnsDerived]) {
    for (const column of availableColumns) {
      if ((column in GROUP_ANNOTATION_FIELDS) && (groupBy === undefined)) {
        continue
      }

      const formattedFieldName = annotationFields[column]?.name
      // console.log(annotationFields)
      const by = find(sortBy, { field: column }) as TAlignmentSortParams | undefined
      
      sortAscByOneColumnMenuItems.push({
        key: "sort-submenu-asc-" + column,
        label: formattedFieldName,
        icon: (by?.order === "asc") ? <CheckOutlined/> : null,
      })

      sortDescByOneColumnMenuItems.push({
        key: "sort-submenu-desc-" + column,
        label: formattedFieldName,
        icon: (by?.order === "desc") ? <CheckOutlined/> : null,
      })
    }

    sortAscByOneColumnMenuItems.push({ key: "divider", type: "divider" })
    sortDescByOneColumnMenuItems.push({ key: "divider", type: "divider" })
  }
  sortAscByOneColumnMenuItems.pop()
  sortDescByOneColumnMenuItems.pop()

  const sortSubmenuItems: MenuProps['items'] = []
  sortSubmenuItems.push({
    key: "do-not-sort",
    label: "Do not sort",
    icon: (sortBy.length === 0) ? <CheckOutlined /> : null,
  }, {
    key: "sort-submenu-divider-1",
    type: "divider",
  }, {
    key: "sort-submenu-asc",
    label: "Ascending",
    children: sortAscByOneColumnMenuItems,
  }, {
    key: "sort-submenu-desc",
    label: "Descending",
    children: sortDescByOneColumnMenuItems,
  }, {
    key: "sort-advanced",
    label: "More Options...",
    icon: (sortBy.length > 1) ? <CheckOutlined /> : null,
  })

  if (sortBy.length > 0) {
    const sortedFields: ReactNode[] = []
    for (const by of sortBy) {
      sortedFields.push(
        <Space key={by.field} size="small">
          <div>{by.order === "asc" ? <CaretUpFilled/> : <CaretDownFilled/>}</div>
          <div>{annotationFields[by.field]?.name}</div>
        </Space>
      )
    }
  
    sortSubmenuItems.push({
      key: "sort-submenu-divider-2",
      type: "divider",
    }, {
      key: "sorted-fields",
      type: "group",
      label: (
        <>
          <small>Current order</small>
          <Flex vertical gap="small">
            {sortedFields}
          </Flex>
        </>
      ),
    })
  }
  
  return fixIcons(sortSubmenuItems)
}

export function createShowHideColumnsMenu({
  isOverviewMode,
  annotationFields = {},
  availableColumnsImported, 
  availableColumnsDerived, 
  otherVisibleColumns, 
  pinnedColumns,
  groupBy,
}: {
  isOverviewMode: boolean,
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  otherVisibleColumns: string[], 
  pinnedColumns: string[],
  groupBy: string | number | undefined,
}): MenuProps["items"] {
  if ((availableColumnsImported.length === 0) && (availableColumnsDerived.length === 0)) {
    return []
  }

  if (isOverviewMode) {
    return []
  }

  const showHideColumnsSubmenuItems: MenuProps['items'] = []
  for (const availableColumns of [availableColumnsImported, availableColumnsDerived]) {
    for (const column of availableColumns) {
      if ((column in GROUP_ANNOTATION_FIELDS) && (groupBy === undefined)) {
        continue
      }

      showHideColumnsSubmenuItems.push({
        key: "show-hide-columns-" + column,
        label: annotationFields[column]?.name,
        icon: pinnedColumns.includes(column) ? <PushpinFilled/> : otherVisibleColumns.includes(column) ? <CheckOutlined/> : null,
      })
    }

    showHideColumnsSubmenuItems.push({
      key: "show-hide-columns-divider-" + availableColumns[0],
      type: "divider"
    })
  }

  showHideColumnsSubmenuItems.push({
    key: "import-annotations", 
    label: "Import annotations...",
  })

  showHideColumnsSubmenuItems.push({
    key: "show-hide-columns-divider-import-annotations",
    type: "divider"
  })
  
  showHideColumnsSubmenuItems.push({
    key: "show-hide-columns-advanced", 
    label: "More options...",
  })

  return fixIcons(showHideColumnsSubmenuItems)
}

export function createGroupByMenu({
  isOverviewMode,
  annotationFields = {},
  availableColumnsImported, 
  availableColumnsDerived, 
  groupBy,
}: {
  isOverviewMode: boolean,
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  groupBy: string | number | undefined,
}): MenuProps["items"] {
  if ((availableColumnsImported.length === 0) && (availableColumnsDerived.length === 0)) {
    return []
  }

  if (isOverviewMode) {
    return []
  }

  const groupByMenuItems: MenuProps['items'] = []
  groupByMenuItems.push({
    key: "do-not-group", 
    label: "Do not group",
    icon: (groupBy === undefined) ? <CheckOutlined/> : null,
  })

  for (const availableColumns of [availableColumnsImported, availableColumnsDerived]) {
    groupByMenuItems.push({
      key: "group-by-column-divider-" + availableColumns[0],
      type: "divider"
    })

    for (const column of availableColumns) {
      if (column in GROUP_ANNOTATION_FIELDS) {
        continue
      }

      groupByMenuItems.push({
        key: "group-by-" + column,
        label: annotationFields[column]?.name,
        icon: (groupBy === column) ? <CheckOutlined/> : null,
      })
    }
  }

  if (isNumber(groupBy)) {
    groupByMenuItems.push({
      key: "group-by-column-divider-position",
      type: "divider"
    })

    groupByMenuItems.push({
      key: `group-by-position-${groupBy}`,
      label: `Sequence Position ${groupBy + 1}`,
      icon: <CheckOutlined/>,
    })
  }

  return fixIcons(groupByMenuItems)
}

function fixIcons(items: MenuProps["items"]): MenuProps["items"] {
  if (isNil(items)) {
    return
  }

  let hasIcons = false
  const submenus = []
  for (const item of items) {
    if (!isNil(item?.icon)) {
      hasIcons = true
    }

    if (item?.children) {
      submenus.push(item.children)
    }
  }

  if (hasIcons) {
    const emptyIcon = <CheckOutlined style={{color: "transparent"}}/>
    for (const item of items) {
      if ((item?.type === "group") || (item?.type === "divider")) {
        continue
      }

      if (item && isNil(item?.icon)) {
        item.icon = emptyIcon
      }
    }
  }

  for (const submenu of submenus) {
    fixIcons(submenu)
  }

  return items
}

function createContextMenuEventHandler(props: TContextMenuProps): Exclude<MenuProps["onClick"], undefined> {
  const {
    isOverviewMode,
    referenceSequenceIndex, 
    availableColumnsImported, 
    availableColumnsDerived, 
    otherVisibleColumns, 
    pinnedColumns,
    sortBy, 
    groupBy, 
    contextMenuTarget, 
    paddingXS,
    setOtherVisibleColumns,
    setPinnedColumns,
    showArrangeColumns,
    setSortBy,
    showSortByColumns,
    setGroupBy,
    setReferenceSequenceIndex,
    showImportAnnotations,
  } = props

  return function ({ key, keyPath, domEvent }) {
    const currentField = contextMenuTarget?.viewMeta?.field
    if (key === "do-not-sort") {
      if (sortBy.length > 0) {
        setSortBy([])
      }
    } else if ((key === "sort-asc") && currentField) {
      if ((sortBy.length !== 1) || (sortBy[0].field !== currentField) || (sortBy[0].order !== "asc")) {
        setSortBy([{
          field: currentField, 
          order: "asc"
        }])  
      }
    } else if ((key === "sort-desc") && currentField) {
      if ((sortBy.length !== 1) || (sortBy[0].field !== currentField) || (sortBy[0].order !== "desc")) {
        setSortBy([{
          field: currentField, 
          order: "desc"
        }])
      }
    } else if (key.startsWith("sort-submenu-asc-")) {
      const field = key.substring("sort-submenu-asc-".length)
      if ((sortBy.length !== 1) || (sortBy[0].field !== field) || (sortBy[0].order !== "asc")) {
        setSortBy([{ field, order: "asc" }])  
      }
    } else if (key.startsWith("sort-submenu-desc-")) {
      const field = key.substring("sort-submenu-desc-".length)
      if ((sortBy.length !== 1) || (sortBy[0].field !== field) || (sortBy[0].order !== "desc")) {
        setSortBy([{ field, order: "desc" }])  
      }
    } else if (key === "sort-advanced") {
      showSortByColumns()
    } else if (key.startsWith("pin-unpin-")) {
      const field = key.substring("pin-unpin-".length)
      if (pinnedColumns.includes(field)) { // unpin
        setPinnedColumns(pinnedColumns => pinnedColumns.filter((col) => (field !== col)))
        setOtherVisibleColumns(otherVisibleColumns =>[field, ...otherVisibleColumns])
      } else { // pin
        setPinnedColumns(pinnedColumns => [...pinnedColumns, field])
        setOtherVisibleColumns(otherVisibleColumns => otherVisibleColumns.filter((col) => (field !== col)))
      }
    } else if (key.startsWith("hide-column-")) {
      const field = key.substring("hide-column-".length)
      if (pinnedColumns.includes(field)) {
        setPinnedColumns(pinnedColumns.filter((col) => (field !== col)))
      } else if (otherVisibleColumns.includes(field)) {
        setOtherVisibleColumns(otherVisibleColumns.filter((col) => (field !== col)))
      }
    } else if (key === "import-annotations") {
      showImportAnnotations()
    } else if (key === "show-hide-columns-advanced") {
      showArrangeColumns()
    } else if (key.startsWith("show-hide-columns-")) {
      const field = key.substring("show-hide-columns-".length)
      if (pinnedColumns.includes(field)) { // hide
        setPinnedColumns(pinnedColumns => pinnedColumns.filter((col) => (field !== col)))
      } else if (otherVisibleColumns.includes(field)) { // hide
        setOtherVisibleColumns(otherVisibleColumns => otherVisibleColumns.filter((col) => (field !== col)))
      } else { // show
        setOtherVisibleColumns(otherVisibleColumns => [...otherVisibleColumns, field])
      }
    } else if (key === "do-not-group") {
      setGroupBy(undefined)
    } else if (key === "group-ungroup-by-sequence-position") {
      const residueIndex = contextMenuTarget?.contextualInfo?.residueIndex
      setGroupBy((residueIndex === groupBy) ? undefined : residueIndex)
    } else if (key.startsWith("group-ungroup-by-")) {
      const field = key.substring("group-ungroup-by-".length)
      setGroupBy((field === groupBy) ? undefined : field)
    } else if (key.startsWith("group-by-position-")) {
      // do nothing
    } else if (key.startsWith("group-by-")) {
      const field = key.substring("group-by-".length)
      if (field !== groupBy) {
        setGroupBy(field)
      }
    } else if (key === "set-reference-sequence") {
      const referenceSequenceIndex = contextMenuTarget?.contextualInfo?.sequenceIndex
      if (Number.isInteger(referenceSequenceIndex)) {
        setReferenceSequenceIndex(referenceSequenceIndex as number)
      }
    }
  }
}
