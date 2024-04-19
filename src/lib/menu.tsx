import type { MenuProps } from 'antd'
import type {
  TSequenceAnnotationFields, 
  TAlignmentSortParams, 
  TSequenceRecord, 
  TAVMouseEventInfo,
  TAlignment,
  TAlignmentFilters,
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
import { FaFilter } from "react-icons/fa"
import { isNil, find, isNumber } from 'lodash'

import {
  HIDDEN_ANNOTATION_FIELDS,
  GROUP_ANNOTATION_FIELDS,
} from '../lib/constants'


type TContextMenuProps = {
  isOverviewMode: boolean,
  // alignment: TAlignment | undefined,
  referenceSequenceIndex: number | undefined, 
  annotationFields: TSequenceAnnotationFields | undefined,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  pinnedColumns: string[] | undefined,
  otherVisibleColumns: string[] | undefined, 
  sortBy: TAlignmentSortParams[] | undefined, 
  groupBy: string | number | false | undefined,
  filterBy: TAlignmentFilters | undefined,
  contextMenuEventInfo?: TAVMouseEventInfo, 
  paddingXS: number,
  setOtherVisibleColumns: React.Dispatch<React.SetStateAction<string[] | undefined>>,
  setPinnedColumns: React.Dispatch<React.SetStateAction<string[] | undefined>>,
  showArrangeColumns: () => void,
  setSortBy: React.Dispatch<React.SetStateAction<TAlignmentSortParams[] | undefined>>,
  showSortByColumns: () => void,
  // setGroupBy: (by: string | number | false | undefined) => void,
  setGroupBy: React.Dispatch<React.SetStateAction<string | number | false | undefined>>,
  setFilterBy: React.Dispatch<React.SetStateAction<TAlignmentFilters | undefined>>,
  onOpenColumnFilter: (field: string) => void,
  // setReferenceSequenceIndex: (referenceSequenceIndex: number) => void,
  setReferenceSequenceIndex: React.Dispatch<React.SetStateAction<number | undefined>>,
  showImportAnnotations: () => void,
}

export function createContextMenu(props: TContextMenuProps): MenuProps {
  const {
    isOverviewMode,
    // alignment,
    referenceSequenceIndex,
    annotationFields = {}, 
    availableColumnsImported, 
    availableColumnsDerived, 
    pinnedColumns,
    sortBy, 
    groupBy, 
    contextMenuEventInfo, 
    paddingXS,
  } = props

  const contextMenuItems: MenuProps["items"] = []
  if (
    // (alignment !== undefined) && 
    (pinnedColumns !== undefined) &&
    (sortBy !== undefined) &&
    (groupBy !== undefined)
  ) {
    const { Text } = Typography
    let currentField: string
    if (contextMenuEventInfo?.cell?.cellType === CellTypes.COL_CELL) {
      currentField = contextMenuEventInfo?.viewMeta.field as string
    } else {
      currentField = contextMenuEventInfo?.viewMeta.valueField as string
    }
    const currentFieldName = annotationFields[currentField]?.name

    if ((contextMenuEventInfo?.cell?.cellType === CellTypes.COL_CELL) && (!isOverviewMode)) { // can't customize visible columns in overview mode
      // Show / hide columns
      if (availableColumnsImported.includes(currentField) || availableColumnsDerived.includes(currentField)) {
        contextMenuItems.push({
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


    // Sort by columns
    if (contextMenuEventInfo?.cell?.cellType === CellTypes.COL_CELL) {
      // contextMenuItems.push({
      //   key: "show-hide-column-divider",
      //   type: "divider"
      // })

      let isSortedByCurrentField: "asc" | "desc" | "no" = "no"
      if (sortBy.length > 0) {
        for (const by of sortBy) {
          if (currentField === by.field) {
            isSortedByCurrentField = by.order
          }
        }
      }

      const sortSubmenuItems: MenuProps['items'] = []
      if (!HIDDEN_ANNOTATION_FIELDS.includes(currentField)) {
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
      
      contextMenuItems.push({
        key: "sort-column-divider",
        type: "divider"
      }, {
        key: "sort-submenu",
        label: "Sort sequences by",
        children: sortSubmenuItems.concat(createSortMenu({
          // alignment,
          annotationFields,
          availableColumnsImported, 
          availableColumnsDerived, 
          sortBy, 
          groupBy,
          paddingXS,
        }) ?? []),
      })
    }

    // Group by column
    if (contextMenuEventInfo?.cell?.cellType === CellTypes.COL_CELL) {
      contextMenuItems.push({
        key: "group-by-column-divider",
        type: "divider"
      })
  
      if (availableColumnsImported.includes(currentField) || availableColumnsDerived.includes(currentField)) {
        contextMenuItems.push({
          key: "group-ungroup-by-" + currentField,
          label: <>{(groupBy === currentField) ? "Ungroup by" : "Group by"} <Text italic>{currentFieldName}</Text></>,
          icon: (groupBy === currentField) ? <BsTextCenter /> : <BsDistributeVertical/>,
        })
      }
    }

    const currentResidueIndex = contextMenuEventInfo?.sequencePosition
    if (currentResidueIndex !== -1) {
      contextMenuItems.push({
        key: "group-ungroup-by-sequence-position",
        label: (groupBy === currentResidueIndex) ? "Ungroup by this position" : "Group by this position",
        icon: (groupBy === currentResidueIndex) ? <BsTextCenter /> : <BsDistributeVertical/>,
      })
    }

    if (contextMenuEventInfo?.cell?.cellType === CellTypes.COL_CELL) {
      contextMenuItems.push({
        key: "group-by",
        label: "Group by",
        children: createGroupByMenu(props)
      })
    }

    // Filter by column
    if (contextMenuEventInfo?.cell?.cellType === CellTypes.COL_CELL) {
      if (
        availableColumnsImported.includes(currentField) || 
        availableColumnsDerived.includes(currentField) || 
        (currentField === "__sequenceIndex__")
      ) {
        contextMenuItems.push({
          key: "filter-divider",
          type: "divider"
        }, {
          key: "filter-unfilter-by-" + currentField,
          label: <>Filter by <Text italic>{(currentField === "__sequenceIndex__")? "Sequence" : currentFieldName}</Text></>,
          icon: <FaFilter/>,
        }, {
            key: "filter-by",
            label: "Filter by",
            children: createFilterByMenu(props)
        })
      }
    }

    const currentSequenceIndex = contextMenuEventInfo?.sequenceIndex
    if (Number.isInteger(currentSequenceIndex)) {
      if (referenceSequenceIndex !== currentSequenceIndex) {
        contextMenuItems.push({
          key: "set-reference-sequence",
          label: "Set as reference sequence",
        })
      }
    }
    
    fixMenuIcons(contextMenuItems)
  }

  return ({
    items: contextMenuItems, 
    onClick: createContextMenuEventHandler(props),
  })
}

export function createSortMenu({
  // alignment,
  annotationFields = {},
  availableColumnsImported, 
  availableColumnsDerived, 
  sortBy, 
  groupBy,
  paddingXS,
}: {
  // alignment: TAlignment | undefined,
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  sortBy: TAlignmentSortParams[] | undefined, 
  groupBy: string | number | false | undefined,
  paddingXS: number,
}): MenuProps["items"] {
  const sortSubmenuItems: MenuProps['items'] = []
  if (
    // (alignment !== undefined) && 
    (sortBy !== undefined) &&
    (groupBy !== undefined)
  ) {
    const sortAscByOneColumnMenuItems: MenuProps['items'] = []
    const sortDescByOneColumnMenuItems: MenuProps['items'] = []
    for (const availableColumns of [availableColumnsImported, availableColumnsDerived]) {
      for (const column of availableColumns) {
        if ((column in GROUP_ANNOTATION_FIELDS) && (groupBy === false)) {
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
      key: "sort-submenu-divider-2",
      type: "divider",
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
  }

  return fixMenuIcons(sortSubmenuItems)
}

export function createShowHideColumnsMenu({
  isOverviewMode,
  // alignment,
  annotationFields = {},
  availableColumnsImported, 
  availableColumnsDerived, 
  otherVisibleColumns, 
  pinnedColumns,
  groupBy,
}: {
  isOverviewMode: boolean,
  // alignment: TAlignment | undefined,
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  otherVisibleColumns: string[] | undefined, 
  pinnedColumns: string[] | undefined,
  groupBy: string | number | false | undefined,
}): MenuProps["items"] {
  const showHideColumnsSubmenuItems: MenuProps['items'] = []
  if (
    // (alignment !== undefined) && 
    (otherVisibleColumns !== undefined) &&
    (pinnedColumns !== undefined) &&
    (groupBy !== undefined) &&
    !isOverviewMode
  ) {
    for (const availableColumns of [availableColumnsImported, availableColumnsDerived]) {
      for (const column of availableColumns) {
        if ((column in GROUP_ANNOTATION_FIELDS) && (groupBy === false)) {
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
      key: "show-hide-columns-advanced", 
      label: "More Options...",
    })

    showHideColumnsSubmenuItems.push({
      key: "show-hide-columns-divider-import-annotations",
      type: "divider"
    })
    
    showHideColumnsSubmenuItems.push({
      key: "import-annotations", 
      label: "Import Annotations...",
    })
  }

  return fixMenuIcons(showHideColumnsSubmenuItems)
}

export function createGroupByMenu({
  isOverviewMode,
  // alignment,
  annotationFields = {},
  availableColumnsImported, 
  availableColumnsDerived, 
  groupBy,
}: {
  isOverviewMode: boolean,
  // alignment: TAlignment | undefined,
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  groupBy: string | number | false | undefined,
}): MenuProps["items"] {
  const groupByMenuItems: MenuProps['items'] = []
  if (
    // (alignment !== undefined) && 
    (groupBy !== undefined) &&
    !isOverviewMode
  ) {
    groupByMenuItems.push({
      key: "do-not-group", 
      label: "Do not group",
      icon: (groupBy === false) ? <CheckOutlined/> : null,
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
  }

  return fixMenuIcons(groupByMenuItems)
}

export function createFilterByMenu({
  annotationFields = {},
  availableColumnsImported,
  availableColumnsDerived,
  groupBy,
  filterBy,
}: {
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  groupBy: string | number | false | undefined,
  filterBy: TAlignmentFilters | undefined,
}): MenuProps["items"] {
  const filterByMenuItems: MenuProps['items'] = []
  if (filterBy !== undefined) {
    filterByMenuItems.push({
      key: "do-not-filter", 
      label: "Do not filter",
      icon: (Object.keys(filterBy).length === 0) ? <CheckOutlined/> : null,
    })

    filterByMenuItems.push({
      key: "filter-by-column-divider-__sequenceIndex__",
      type: "divider"
    })

    filterByMenuItems.push({
      key: "filter-by-__sequenceIndex__", 
      label: "Sequence",
      icon: ("__sequenceIndex__" in filterBy) ? <CheckOutlined/> : null,
    })

    for (const availableColumns of [availableColumnsImported, availableColumnsDerived]) {
      filterByMenuItems.push({
        key: "filter-by-column-divider-" + availableColumns[0],
        type: "divider"
      })

      for (const column of availableColumns) {
        if ((column in GROUP_ANNOTATION_FIELDS) && (groupBy === false)) {
          continue
        }
  
        filterByMenuItems.push({
          key: "filter-by-" + column,
          label: annotationFields[column]?.name,
          icon: (column in filterBy) ? <CheckOutlined/> : null,
        })
      }
    }
  }

  return fixMenuIcons(filterByMenuItems)
}

export function fixMenuIcons(items: MenuProps["items"]): MenuProps["items"] {
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
    fixMenuIcons(submenu)
  }

  return items
}

function createContextMenuEventHandler(props: TContextMenuProps): Exclude<MenuProps["onClick"], undefined> {
  const {
    isOverviewMode,
    // alignment,
    referenceSequenceIndex, 
    availableColumnsImported, 
    availableColumnsDerived, 
    pinnedColumns,
    otherVisibleColumns, 
    sortBy, 
    groupBy, 
    filterBy,
    contextMenuEventInfo, 
    paddingXS,
    setOtherVisibleColumns,
    setPinnedColumns,
    showArrangeColumns,
    setSortBy,
    showSortByColumns,
    setGroupBy,
    setFilterBy,
    onOpenColumnFilter,
    setReferenceSequenceIndex,
    showImportAnnotations,
  } = props

  return function ({ key, keyPath, domEvent }) {
    if (
      // (alignment !== undefined) && 
      (pinnedColumns !== undefined) &&
      (otherVisibleColumns !== undefined) &&
      (sortBy !== undefined) &&
      (groupBy !== undefined) &&
      (filterBy !== undefined)
    ) {
      const currentField = contextMenuEventInfo?.viewMeta?.field
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
        setGroupBy(false)
      } else if (key === "group-ungroup-by-sequence-position") {
        const residueIndex = contextMenuEventInfo?.sequencePosition ?? false
        setGroupBy((residueIndex === groupBy) ? false : residueIndex)
      } else if (key.startsWith("group-ungroup-by-")) {
        const field = key.substring("group-ungroup-by-".length)
        setGroupBy((field === groupBy) ? false : field)
      } else if (key.startsWith("group-by-position-")) {
        // do nothing
      } else if (key.startsWith("group-by-")) {
        const field = key.substring("group-by-".length)
        if (field !== groupBy) {
          setGroupBy(field)
        }
      } else if (key === "do-not-filter") {
        if (Object.keys(filterBy).length > 0) {
          setFilterBy({})
        }
      } else if (key.startsWith("filter-unfilter-by-")) {
        let field = key.substring("filter-unfilter-by-".length)
        if (field === "__sequenceIndex__") {
          field = "$$sequence$$"
        }
        onOpenColumnFilter(field)
      } else if (key.startsWith("filter-by-")) {
        let field = key.substring("filter-by-".length)
        if (field === "__sequenceIndex__") {
          field = "$$sequence$$"
        }
        onOpenColumnFilter(field)
      } else if (key === "set-reference-sequence") {
        const referenceSequenceIndex = contextMenuEventInfo?.sequenceIndex
        if (Number.isInteger(referenceSequenceIndex)) {
          setReferenceSequenceIndex(referenceSequenceIndex as number)
        }
      }
    }
  }
}
