import type { TSequenceAnnotationFields } from '../lib/types'
import type { DragStartEvent, DragEndEvent, DragOverEvent, CollisionDetection } from '@dnd-kit/core'
import type { CSSProperties, PropsWithChildren, Ref } from 'react'

import { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback } from 'react'
import {
  Modal, Flex, Card, Typography, Tag, theme as antdTheme,
} from 'antd'
import {
  closestCenter, 
  // closestCorners, 
  DndContext, 
  useDroppable, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  MeasuringStrategy,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  // rectSortingStrategy,
  // rectSwappingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'

import MenuButton from './MenuButton'

type TArrangeColumnsProps = {
  annotationFields?: TSequenceAnnotationFields,
  availableColumnsImported: string[], 
  availableColumnsDerived: string[], 
  otherVisibleColumns: string[], 
  pinnedColumns: string[],
  onSetOtherVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>,
  onSetPinnedColumns: React.Dispatch<React.SetStateAction<string[]>>,
}

type TColumnTagProps = PropsWithChildren & {
  id: string,
  label: string,
  style?: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  onClose?: (id: string) => void,
}

function DropableContainer(
  {id, children, ...restProps}: 
  PropsWithChildren & { id: string } & Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <Card {...restProps}>
      <Flex ref={setNodeRef} gap="small" wrap="wrap" /*style={{overflow: "auto"}}*/ >
        {children}
      </Flex>
    </Card>
  )
}

const ColumnTag = forwardRef(function ColumnTag(props: TColumnTagProps, ref: Ref<HTMLElement>) {
  const { token } = antdTheme.useToken()
  const style: CSSProperties = {
    margin: 0,
    backgroundColor: token.colorFillSecondary,
    cursor: 'move',
    transition: 'unset', // Prevent element from shaking after drag
  }

  const { style: extraStyle, id, label, onClose, ...restProps } = props
  if (extraStyle) {
    Object.assign(style, extraStyle)
  }

  return (
    <Tag ref={ref} {...restProps} bordered={true} style={style} closable onClose={() => {onClose?.(id)}} >
      {label}
    </Tag>
  )
})

function DraggableColumnTag({
  id, label, onClose
}: TColumnTagProps
) {
  const { listeners, transform, transition, isDragging, setNodeRef } = useSortable({ id })
  const style: CSSProperties = transform ? {
    // visibility: isDragging ? "hidden" : "visible",
    opacity: isDragging ? 0.25 : 1,
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    transition: isDragging ? 'unset' : transition, // Improve performance/visual effect when dragging
  } : {}

  return (
    <ColumnTag id={id} label={label} onClose={onClose} ref={setNodeRef} {...listeners} style={style} />
  )
}

function columnsToElements(
  columns: string[], 
  annotationFields: TSequenceAnnotationFields | undefined,
  onClose: (id: string) => void,
) {
  const elements = []
  for (const col of columns) {
    elements.push(
      <DraggableColumnTag
        key={col} 
        id={col} 
        label={annotationFields?.[col]?.name ?? ""} 
        onClose={onClose}
      />
    )
  }

  return elements
}

const ArrangeColumns = forwardRef(function ArrangeColumns(props: TArrangeColumnsProps, ref) {
  const [isOpen, setIsOpen] = useState(false)

  useImperativeHandle(ref, () => ({
    open() {
      setIsOpen(true)
    }
  }), [])

  const [items, setItems] = useState<Record<string, string[]>>({
    pinned: [],
    columns: [],
  })
  const [initialItems, setInitialItems] = useState<Record<string, string[]> | undefined>(undefined)

  function findContainer(id: string) {
    return Object.keys(items).find((key) => items[key].includes(id)) ?? id
  }

  const [propsShowColumns, setPropsShowColumns] = useState<string[]>([])
  const [propsPinnedColumns, setPropsPinnedColumns] = useState<string[]>([])

  useEffect(() => {
    const newItems = {
      pinned: [...props.pinnedColumns],
      columns: [...props.otherVisibleColumns]
    }
    setItems(newItems)
    setInitialItems(newItems)
    setPropsPinnedColumns(props.pinnedColumns)
    setPropsShowColumns(props.otherVisibleColumns)
  }, [
    props.otherVisibleColumns,
    propsShowColumns, 
    props.pinnedColumns,
    propsPinnedColumns,
  ])

  const {
    annotationFields,
    availableColumnsImported, 
    availableColumnsDerived, 
    onSetOtherVisibleColumns,
    onSetPinnedColumns,  
  } = props

  function handleDeleteColumnTag(id: string) {
    const container = findContainer(id)
    setItems(items => ({
      ...items,
      [container]: items[container].filter((col) => (col !== id))
    }))
  }

  const pinnedElements = columnsToElements(items.pinned, annotationFields, handleDeleteColumnTag)
  const columnsElements = columnsToElements(items.columns, annotationFields, handleDeleteColumnTag)
  const options = []
  for (const availableColumns of [availableColumnsImported, availableColumnsDerived]) {
    for (const column of availableColumns) {
      if (items.pinned.includes(column) || items.columns.includes(column)) {
        continue
      }

      options.push({
        key: column,
        label: annotationFields?.[column].name ?? "",
      })
    }
  }

  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  const [activeLabel, setActiveLabel] = useState<string>("")
  const lastOverId = useRef<string | undefined>(undefined)
  const recentlyMovedToNewContainer = useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }))

  /**
   * Custom collision detection strategy optimized for multiple containers
   *
   * - First, find any droppable containers intersecting with the pointer.
   * - If there are none, find intersecting containers with the active draggable.
   * - If there are no intersecting containers, return the last matched intersection
   *
   */
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      // Start by finding any intersecting droppable
      const pointerIntersections = pointerWithin(args)
      // If there are droppables intersecting with the pointer, return those
      const intersections = (pointerIntersections.length > 0) ? pointerIntersections : rectIntersection(args)
      let overId = getFirstCollision(intersections, 'id')

      if (overId != null) {
        if (overId in items) {
          const containerItems = items[overId]

          // If a container is matched and it contains items
          if (containerItems.length > 0) {
            // Return the closest droppable within that container
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (container) =>
                  container.id !== overId &&
                  containerItems.includes(container.id as string)
              ),
            })[0]?.id
          }
        }

        lastOverId.current = overId as string
        return [{id: overId}]
      }

      // When a draggable item moves to a new container, the layout may shift
      // and the `overId` may become `null`. We manually set the cached `lastOverId`
      // to the id of the draggable item that was moved to the new container, otherwise
      // the previous `overId` will be returned which can cause items to incorrectly shift positions
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeId
      }

      // If no droppable is matched, return the last match
      return lastOverId.current ? [{id: lastOverId.current}] : []
    },
    [activeId, items]
  )

  function handleOk() {
    setIsOpen(false)
    onSetPinnedColumns(items.pinned)
    onSetOtherVisibleColumns(items.columns)
    if (initialItems) {
      setInitialItems(undefined)
    }
  }

  function handleCancel() {
    setIsOpen(false)
    if (initialItems) {
      setItems(initialItems)
      setInitialItems(undefined)
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
    setActiveLabel(annotationFields?.[active.id]?.name ?? "")
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const overId = over?.id as string

    if ((overId == null) || (active.id in items)) {
      return
    }

    const overContainer = findContainer(overId);
    const activeContainer = findContainer(active.id as string)

    if (!overContainer || !activeContainer) {
      return
    }

    if (activeContainer !== overContainer) {
      setItems((items) => {
        const activeItems = items[activeContainer]
        const overItems = items[overContainer]
        const overIndex = overItems.indexOf(overId)
        const activeIndex = activeItems.indexOf(active.id as string)

        let newIndex: number

        if (overId in items) {
          newIndex = overItems.length + 1
        } else {
          const isBelowOverItem = (
            over &&
            active.rect.current.translated &&
            (active.rect.current.translated.top > over.rect.top + over.rect.height)
          )
          const modifier = isBelowOverItem ? 1 : 0
          newIndex = (overIndex >= 0) ? overIndex + modifier : overItems.length + 1
        }

        recentlyMovedToNewContainer.current = true
        return {
          ...items,
          [activeContainer]: items[activeContainer].filter((col) => col !== active.id),
          [overContainer]: [
            ...items[overContainer].slice(0, newIndex),
            items[activeContainer][activeIndex],
            ...items[overContainer].slice(newIndex, items[overContainer].length),
          ],
        }
      })
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const activeContainer = findContainer(active.id as string)
    if (!activeContainer) {
      setActiveId(undefined)
      return
    }

    const overId = over?.id
    if (overId == null) {
      setActiveId(undefined)
      return
    }

    const overContainer = findContainer(overId as string)
    if (overContainer) {
      const activeIndex = items[activeContainer].indexOf(active.id as string)
      const overIndex = items[overContainer].indexOf(overId as string)
      if (activeIndex !== overIndex) {
        setItems((items) => ({
          ...items,
          [overContainer]: arrayMove(items[overContainer], activeIndex, overIndex),
        }))
      }
    }

    setActiveId(undefined)
  }

  function addColumnToContainer(col: string, container: string) {
    setItems({...items, [container]: [...items[container], col]})
  }

  return (
    <Modal
      open={isOpen}
      destroyOnClose={true}
      closable={false}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      <Flex vertical gap="small">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver} 
          onDragEnd={handleDragEnd} 
          collisionDetection={collisionDetectionStrategy}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
        >
          <SortableContext items={items.pinned} strategy={horizontalListSortingStrategy}>
            <DropableContainer
              id="pinned"
              title="Pinned Columns"
              size="small"
              // type="inner"
              styles={{header: {border: "none"}}}
              extra={
                <MenuButton
                  shape="round" 
                  size="small" 
                  menuItems={options} 
                  onMenuItemClick={(info) => {addColumnToContainer(info.key, "pinned")}}
                >
                  Add
                </MenuButton>
              }
            >
              {pinnedElements.length ? pinnedElements : <Typography.Text type="secondary">None</Typography.Text>}
            </DropableContainer>
          </SortableContext>
          <div/>
          <SortableContext items={items.columns} strategy={horizontalListSortingStrategy}>
            <DropableContainer
              id="columns"
              title="Other Displayed Columns"
              size="small"
              // type="inner"
              styles={{header: {border: "none"}}}
              extra={
                <MenuButton
                  shape="round" 
                  size="small" 
                  menuItems={options} 
                  onMenuItemClick={(info) => {addColumnToContainer(info.key, "columns")}}
                >
                  Add
                </MenuButton>
              }
            >
              {columnsElements.length ? columnsElements : <Typography.Text type="secondary">None</Typography.Text>}
            </DropableContainer>
          </SortableContext>
          <DragOverlay>
            {activeId ? <ColumnTag id={activeId} label={activeLabel} /> : null}
          </DragOverlay>
          <div/>
        </DndContext>
      </Flex>
    </Modal>
  )
})

export default ArrangeColumns
