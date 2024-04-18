import type { TSequenceAnnotationFields, TAlignmentSortParams } from '../lib/types'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import type { CSSProperties, PropsWithChildren, Ref, ReactNode } from 'react'
import type { MenuProps } from 'antd'

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import {
  Modal, Flex, Switch, Typography, Button, theme as antdTheme, 
} from 'antd'
import { CloseOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  closestCenter, 
  DndContext, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  MeasuringStrategy,
} from '@dnd-kit/core'
import {
  arrayMove,
  verticalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'


import MenuButton from './MenuButton'


type TSortByColumnsProps = {
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  sortBy: TAlignmentSortParams[], 
  onSetSortBy: React.Dispatch<React.SetStateAction<TAlignmentSortParams[] | undefined>>,
}

type TSortItemProps = PropsWithChildren & {
  index: number,
  field: string,
  order: "asc" | "desc",
  label: string,
  style?: Record<string, any>,  // eslint-disable-line @typescript-eslint/no-explicit-any
  onOrderChange?: (field: string, order: "asc" | "desc") => void,
  onClose?: (field: string) => void,
}

const SortItem = forwardRef(function SortItem(props: TSortItemProps, ref: Ref<HTMLDivElement>) {
  const { token } = antdTheme.useToken()
  const wrapperStyle: CSSProperties = {
  }
  const style: CSSProperties = {
    cursor: 'move',
    transition: 'unset', // Prevent element from shaking after drag
    padding: `${token.paddingXS}px ${token.paddingSM}px`,
    backgroundColor: token.colorFillSecondary,
    borderRadius: token.borderRadius,
  }

  const { style: extraStyle, index, field, order, label, onOrderChange, onClose, ...restProps } = props
  if (extraStyle) {
    Object.assign(style, extraStyle)
  }

  // const options: Array<{ value: "asc" | "desc", label: string}> = [
  //   { value: "asc", label: "Ascending" },
  //   { value: "desc", label: "Descending" },
  // ]

  function handleOrderChange(checked: boolean) {
    onOrderChange?.(field, checked ? "asc" : "desc")
  }

  return (
    <div style={wrapperStyle} >
      <Typography.Text type="secondary">
        <small>
          {(index < 0) ? "" : (index === 0) ? "Sort by" : "Then by"}
        </small>
      </Typography.Text>
      <Flex gap="small" align="center" style={style} ref={ref} {...restProps}>
        <div style={{flexGrow: 1}}>{label}</div>
        <Switch
          checked={order === "asc"} 
          // size="small" 
          checkedChildren="Ascending" 
          unCheckedChildren="Descending" 
          onChange={handleOrderChange}
        />
        {/* <Segmented
          value={order} 
          options={options} 
          // size="small" 
          onChange={(value: "asc"|"desc") => onOrderChange?.(field, value)}
        /> */}
        <Button
          icon={<DeleteOutlined/>} 
          type="text" 
          size="small"
          onClick={() => {onClose?.(field)}}
        />
      </Flex>
    </div>
  )
})

function DraggableSortItem({
  index, field, order, label, onClose, onOrderChange
}: TSortItemProps
) {
  const { listeners, transform, transition, isDragging, setNodeRef } = useSortable({ id: field })
  const style: CSSProperties = transform ? {
    // visibility: isDragging ? "hidden" : "visible",
    opacity: isDragging ? 0.25 : 1,
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    transition: isDragging ? 'unset' : transition, // Improve performance/visual effect when dragging
  } : {}

  return (
    <SortItem
      ref={setNodeRef} 
      {...listeners} 
      index={index}
      field={field} 
      order={order} 
      label={label} 
      onClose={onClose} 
      onOrderChange={onOrderChange} 
      style={style} 
    />
  )
}

function columnsToElements(
  sortBy: TAlignmentSortParams[], 
  annotationFields: TSequenceAnnotationFields | undefined,
  onClose: (field: string) => void,
  onOrderChange: (field: string, order: "asc" | "desc") => void,
) {
  const elements = []
  for (let i = 0; i < sortBy.length; ++i) {
    const by = sortBy[i]
    elements.push(
      <DraggableSortItem
        key={by.field} 
        index={i}
        field={by.field} 
        order={by.order}
        label={annotationFields?.[by.field]?.name ?? ""} 
        onClose={onClose}
        onOrderChange={onOrderChange}
      />
    )
  }

  return elements
}

export default forwardRef(function SortByColumns(props: TSortByColumnsProps, ref) {
  const [isOpen, setIsOpen] = useState(false)

  useImperativeHandle(ref, () => ({
    open() {
      setIsOpen(true)
    }
  }), [])

  const {
    annotationFields,
    availableColumnsImported, 
    availableColumnsDerived, 
    onSetSortBy,
  } = props

  const [sortBy, setSortBy] = useState<TAlignmentSortParams[]>([])
  const [initialSortBy, setInitialSortBy] = useState<TAlignmentSortParams[]>([])
  const [propsSortBy, setPropsSortBy] = useState<TAlignmentSortParams[]>([])

  useEffect(() => {
    const newSortBy = [...props.sortBy]
    setSortBy(newSortBy)
    setInitialSortBy(newSortBy)
    setPropsSortBy(props.sortBy)
  }, [
    props.sortBy,
    propsSortBy, 
  ])

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }))

  const sortedOnColumns = []
  for (const by of sortBy) {
    sortedOnColumns.push(by.field)
  }

  const options: MenuProps["items"] = []
  for (const availableColumns of [availableColumnsImported, availableColumnsDerived]) {
    for (const column of availableColumns) {
      if (sortedOnColumns.includes(column)) {
        continue
      }

      options.push({
        key: column,
        label: annotationFields?.[column].name ?? "",
      })
    }
  }

  function handleDeleteColumnTag(field: string) {
    setSortBy(sortBy => (sortBy.filter((by) => (by.field !== field))))
  }

  function handleOrderChange(field: string, order: "asc" | "desc") {
    setSortBy(sortBy => {
      const newSortBy = [...sortBy]
      newSortBy.find((by) => (by.field === field))!.order = order
      return newSortBy
    })
  }

  const elements = columnsToElements(sortBy, annotationFields, handleDeleteColumnTag, handleOrderChange)

  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  let activeIndex: number | undefined = 0
  let activeOrder: "asc" | "desc" = "asc"
  let activeLabel = ""
  if (activeId) {
    activeIndex = sortBy.findIndex((by) => (by.field === activeId))
    activeOrder = sortBy[activeIndex].order
    activeLabel = annotationFields?.[activeId]?.name ?? ""
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (active.id !== over?.id) {
      setSortBy((sortBy) => {
        const oldIndex = sortBy.findIndex((by) => (by.field === active.id))
        const newIndex = sortBy.findIndex((by) => (by.field === over?.id))
        return arrayMove(sortBy, oldIndex, newIndex);
      })
    }

    setActiveId(undefined)
  }

  function handleOk() {
    setIsOpen(false)
    onSetSortBy(sortBy)
    setInitialSortBy([])
  }

  function handleCancel() {
    setIsOpen(false)
    setSortBy(initialSortBy)
    setInitialSortBy([])
  }

  function footer(originNode: ReactNode) {
    return (
      <Flex gap="small">
        <MenuButton
          menuItems={options} 
          onMenuItemClick={(info) => {setSortBy([...sortBy, {field: info.key, order: "asc"}])}}
        >
          Add Column to Sort
        </MenuButton>
        <div style={{flexGrow: 1}}/>
        {originNode}
      </Flex>
    )
  }

  // const { token } = antdTheme.useToken()
  // console.log(token.colorPrimary, token.colorTextQuaternary)
  // const theme ={
  //   token: {
  //     colorPrimary: token.colorTextQuaternary,
  //     colorPrimaryHover: token.colorTextTertiary,
  //   },
  // }

  return (
    <Modal
      title="Sort by Columns"
      open={isOpen}
      destroyOnClose={true}
      closable={false}
      footer={footer}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      {/* <ConfigProvider theme={theme}> */}
        <Flex vertical gap="small" style={{maxHeight: "50vh", overflow: "auto"}}>
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            // onDragOver={handleDragOver} 
            onDragEnd={handleDragEnd} 
            collisionDetection={closestCenter}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
          >
            <SortableContext items={sortBy.map(by => by.field)} strategy={verticalListSortingStrategy}>
              {elements.length ? elements : <Typography.Text type="secondary">Not sorted</Typography.Text>}
            </SortableContext>
            <DragOverlay>
              {activeId ? <SortItem index={-1} field={activeId} order={activeOrder} label={activeLabel} /> : null}
            </DragOverlay>
          </DndContext>
        </Flex>
      {/* </ConfigProvider> */}
    </Modal>
  )
})
