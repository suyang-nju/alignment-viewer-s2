import type { TColumnFilterProps, TTextColumnFilter, TNumberColumnFilter } from '../lib/types'

import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import {
  Popover, theme as antdTheme, Flex, Space, Select, Input, InputNumber, Button, Tag,
  Checkbox, Radio, Divider, 
} from 'antd'
import Icon, { CloseOutlined, DeleteOutlined } from '@ant-design/icons'
import { FaFilter } from "react-icons/fa"

const CaseSensitiveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="2 2 12 12"><path fill="currentColor" d="M8.854 11.702h-1l-.816-2.159H3.772l-.768 2.16H2L4.954 4h.935zm-2.111-2.97L5.534 5.45a3.142 3.142 0 0 1-.118-.515h-.021c-.036.218-.077.39-.124.515L4.073 8.732zm7.013 2.97h-.88v-.86h-.022c-.383.66-.947.99-1.692.99c-.548 0-.978-.146-1.29-.436c-.307-.29-.461-.675-.461-1.155c0-1.027.605-1.625 1.815-1.794l1.65-.23c0-.935-.379-1.403-1.134-1.403c-.663 0-1.26.226-1.794.677V6.59c.54-.344 1.164-.516 1.87-.516c1.292 0 1.938.684 1.938 2.052zm-.88-2.782l-1.327.183c-.409.057-.717.159-.924.306c-.208.143-.312.399-.312.768c0 .268.095.489.285.66c.193.169.45.253.768.253a1.41 1.41 0 0 0 1.08-.457c.286-.308.43-.696.43-1.165z"/></svg>
)

const WholeWordIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 2 16 12"><g fill="currentColor"><path d="M0 11h1v2h14v-2h1v3H0z"/><path d="M6.84 11h-.88v-.86h-.022c-.383.66-.947.989-1.692.989c-.548 0-.977-.145-1.289-.435c-.308-.29-.462-.675-.462-1.155c0-1.028.605-1.626 1.816-1.794l1.649-.23c0-.935-.378-1.403-1.134-1.403c-.662 0-1.26.226-1.794.677v-.902c.541-.344 1.164-.516 1.87-.516c1.292 0 1.938.684 1.938 2.052zm-.88-2.782L4.633 8.4c-.408.058-.716.16-.924.307c-.208.143-.311.399-.311.768c0 .268.095.488.284.66c.194.168.45.253.768.253a1.41 1.41 0 0 0 1.08-.457c.286-.308.43-.696.43-1.165zm3.388 1.987h-.022V11h-.88V2.857h.88v3.61h.021c.434-.73 1.068-1.096 1.902-1.096c.705 0 1.257.247 1.654.741c.401.49.602 1.15.602 1.977c0 .92-.224 1.658-.672 2.213c-.447.551-1.06.827-1.837.827c-.726 0-1.276-.308-1.649-.924m-.022-2.218v.768c0 .455.147.841.44 1.16c.298.315.674.473 1.128.473c.534 0 .951-.204 1.252-.613c.304-.408.456-.975.456-1.702c0-.613-.141-1.092-.424-1.44c-.283-.347-.666-.52-1.15-.52c-.511 0-.923.178-1.235.536c-.311.355-.467.8-.467 1.338"/></g></svg>
)

const RegexIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"><path fill="currentColor" d="M10.25 1.75a.75.75 0 0 0-1.5 0v3.451L5.761 3.475a.75.75 0 1 0-.75 1.3L8 6.5L5.011 8.225a.75.75 0 1 0 .75 1.3L8.75 7.799v3.451a.75.75 0 0 0 1.5 0V7.8l2.989 1.725a.75.75 0 1 0 .75-1.3L11 6.5l2.989-1.725a.75.75 0 1 0-.75-1.3L10.25 5.201zM3 15a2 2 0 1 0 0-4a2 2 0 0 0 0 4"/></svg>
)

const defaultTextColumnFilter: TTextColumnFilter = {
  connective: "and",
  operator: "equal",
  operand: undefined,
  isCaseSensitive: false,
  isWholeWordOnly: false,
  isRegex: false,
  in: undefined,
} 

const defaultNumberColumnFilter: TNumberColumnFilter = {
  connective: "and",
  operator: "equal",
  operand: undefined,
  in: undefined,
}

export default forwardRef(function ColumnFilter({
  filterBy,
  annotationFields,
  onChange,
}: TColumnFilterProps, ref) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<TTextColumnFilter[] | TNumberColumnFilter[]>([])
  
  // These refs below must only be updated in the `open()` function in the imperative handle
  const fieldRef = useRef<string>("")
  const isTextColumnRef = useRef(true)
  const defaultFilterRef = useRef<TTextColumnFilter | TNumberColumnFilter>(defaultTextColumnFilter)
  const xRef = useRef(0)
  const yRef = useRef(0)
  
  useImperativeHandle(ref, () => ({
    open(field: string, x: number, y: number) {
      fieldRef.current = field
      isTextColumnRef.current = (field === "$$sequence$$") ? true : (annotationFields[field].string > annotationFields[field].number)
      defaultFilterRef.current = isTextColumnRef.current ? defaultTextColumnFilter : defaultNumberColumnFilter
      xRef.current = x
      yRef.current = y

      setFilters(filterBy?.[field] ?? [{...defaultFilterRef.current}] as TTextColumnFilter[] | TNumberColumnFilter[])
      setOpen(true)
    }
  }), [annotationFields, filterBy])

  const token = antdTheme.useToken().token
  
  const com = []
  for (let i = 0; i < filters.length; ++i) {
    if (i === 0) {
      if (filters.length > 1) {
        com.push(<div key={3 * i} />)
      }
    } else {
      com.push(
        <Select 
          key={3 * i}
          value={filters[i].connective}
          options={[
            {value: "and", label: "AND"},
            {value: "or", label: "OR"},
          ]}
          popupMatchSelectWidth={false}
          onChange={(connective) => {
            const newFilters = filters.slice()
            newFilters[i].connective = connective
            setFilters(newFilters)
          }}
        />
      )
    }
    
    if (filters[i].in) {
      com.push(<div key={3 * i + 1}/>)
    } else if (isTextColumnRef.current) {
      com.push(
        <TextColumnFilter
          key={3 * i + 1}
          filter={filters[i] as TTextColumnFilter}
          onChange={(newFilter) => {
            const newFilters = filters.slice()
            newFilters[i] = newFilter
            setFilters(newFilters)
          }}
        /> 
      )
    } else {
      com.push(
        <NumberColumnFilter
          key={3 * i + 1}
          filter={filters[i] as TNumberColumnFilter}
          onChange={(newFilter) => {
            const newFilters = filters.slice()
            newFilters[i] = newFilter
            setFilters(newFilters)
          }}
        />
      )
    }

    if (i === 0) {
      if (filters.length > 1) {
        com.push(<div key={3 * i + 2}/>)
      }
    } else {
      com.push(
        <Button
          key={3 * i + 2}
          icon={<DeleteOutlined/>} // CloseOutlined
          type="text"
          // size="small"
          onClick={() => {setFilters(filters.slice(0, i).concat(filters.slice(i + 1)) as TTextColumnFilter[] | TNumberColumnFilter[])}}
        />
      )
    }
  }

  const handleCancel = useCallback(() => {
    setOpen(false)
  }, [])

  const handleOk = useCallback(() => {
    setOpen(false)
    onChange({
      ...filterBy,
      [fieldRef.current]: filters,
    })
  }, [filterBy, filters, onChange])

  const handleClearFilter = useCallback(() => {
    setOpen(false)
    const newFilterBy = {...filterBy}
    delete newFilterBy[fieldRef.current]
    onChange(newFilterBy)
  }, [filterBy, onChange])

  const handleAddFilter = useCallback(() => {
    setFilters([...filters, {...defaultFilterRef.current}] as TTextColumnFilter[] | TNumberColumnFilter[])
  }, [filters])

  const content = (
    <Flex vertical gap="middle" style={{marginTop: token.marginMD}} >
      <div className={(filters.length > 1) ? "body-multi" : "body-single"}>{com}</div>
      <div><Button onClick={handleAddFilter}>Add</Button></div>
      <Flex gap="small" className="footer" >
        <Button onClick={handleClearFilter}>Clear Filter</Button>
        <div style={{flexGrow: 1}} />
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleOk} type="primary">OK</Button>
      </Flex>
    </Flex>
  )

  return (
    <Popover
      title={<>
        <Icon 
          component={FaFilter} 
          style={{
            color: token.colorText,
            paddingRight: token.paddingXS,
          }} 
        /> 
        Filter by {(fieldRef.current === "$$sequence$$") ? "Sequence" : annotationFields[fieldRef.current]?.name}
      </>}
      open={open}
      content={content}
      overlayClassName="av-column-filter css-var-r1"
      // arrow={false}
      placement="bottom"
    >
      <div style={{position: "absolute", left: 0, top: 0, transform: `translate(${xRef.current}px, ${yRef.current}px)`}} />
    </Popover>
  )
})

function TextColumnFilter({
  filter, 
  onChange
}: {
  filter: TTextColumnFilter, 
  onChange: (newFilter: TTextColumnFilter) => void,
}) {
  const operations = [
    {value: "equal", label: "Equals"},
    {value: "not-equal", label: "Does Not Equal"},
    {key: "divider-1", label: <Divider/>, options: []},
    {value: "contain", label: "Contains"},
    {value: "not-contain", label: "Does Not Contain"},
    {key: "divider-2", label: <Divider/>, options: []},
    {value: "begin", label: "Begins With"},
    {value: "not-begin", label: "Does Not Begin With"},
    {key: "divider-3", label: <Divider/>, options: []},
    {value: "end", label: "Ends With"},
    {value: "not-end", label: "Does Not End With"},
  ]

  return (
    <>
      <Select
        value={filter.operator}
        options={operations} 
        popupClassName="av-column-filter-operator-dropdown"
        popupMatchSelectWidth={false}
        onChange={(op) => onChange({...filter, operator: op})}
      />
      <Input
        value={filter.operand}
        onChange={(event) => {
          onChange({...filter, operand: event.target.value})
        }}
        suffix={
          <Space size={4}>
            <Tag.CheckableTag
              checked={filter.isCaseSensitive}
              title="Case Sensitive"
              style={{margin: 0, paddingInline: 2, border: "none"}}
              onChange={(checked) => onChange({...filter, isCaseSensitive: checked})}
            >
              <Icon component={CaseSensitiveIcon} style={{fontSize: 16}} />
            </Tag.CheckableTag>
            <Tag.CheckableTag
              checked={filter.isWholeWordOnly}
              title="Whole Word"
              style={{margin: 0, paddingInline: 2, border: "none"}}
              onChange={(checked) => onChange({...filter, isWholeWordOnly: checked})}
            >
              <Icon component={WholeWordIcon}  style={{fontSize: 16}} />
            </Tag.CheckableTag>
            <Tag.CheckableTag
              checked={filter.isRegex}
              title="Regular Expression"
              style={{margin: 0, paddingInline: 2, border: "none"}}
              onChange={(checked) => onChange({...filter, isRegex: checked})}
            >
              <Icon component={RegexIcon} style={{fontSize: 16}} />
            </Tag.CheckableTag>
          </Space>
        }
      />
    </>
  )
}

function NumberColumnFilter({
  filter, 
  onChange
}: {
  filter: TNumberColumnFilter, 
  onChange: (newFilter: TNumberColumnFilter) => void
}) {
  const operations = [
    {value: "equal", label: "Equals"},
    {value: "not-equal", label: "Does Not Equal"},
    {value: "divider-1", label: <Divider/>, options: []},
    {value: "greater", label: "Greater Than"},
    {value: "not-less", label: "Greater Than Or Equal To"},
    {value: "divider-2", label: <Divider/>, options: []},
    {value: "less", label: "Less Than"},
    {value: "not-greater", label: "Less Than Or Equal To"},
  ]

  return (
    <>
      <Select
        value={filter.operator}
        options={operations} 
        popupClassName="av-column-filter-operator-dropdown"
        popupMatchSelectWidth={false}
        onChange={(op) => onChange({...filter, operator: op})}
      />
      <InputNumber
        value={filter.operand}
        style={{ width: '100%' }}
        onChange={(value) => {
          onChange({...filter, operand: (value === null) ? undefined : value})
        }}
      />
    </>
  )
}
