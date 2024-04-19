import type { TColumnFilterProps, TTextColumnFilter, TNumberColumnFilter } from '../lib/types'
import type { ReactNode } from 'react'
import type { SelectProps } from 'antd'

import { useState, useMemo, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import {
  Modal, Flex, Space, Select, Input, InputNumber, Button, Tag,
  Radio, Divider, Typography, Tooltip,
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

const textColumnFilterOperatorOptions: SelectProps["options"] = [
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
  {key: "divider-4", label: <Divider/>, options: []},
  {value: "in", label: "Any Of"},
  {value: "not-in", label: "None of"},
]

const numberColumnFilterOperatorOptions: SelectProps["options"] = [
  {value: "equal", label: "Equals"},
  {value: "not-equal", label: "Does Not Equal"},
  {value: "divider-1", label: <Divider/>, options: []},
  {value: "greater", label: "Greater Than"},
  {value: "not-less", label: "Greater Than Or Equal To"},
  {value: "divider-2", label: <Divider/>, options: []},
  {value: "less", label: "Less Than"},
  {value: "not-greater", label: "Less Than Or Equal To"},
  {key: "divider-3", label: <Divider/>, options: []},
  {value: "in", label: "Any Of"},
  {value: "not-in", label: "None Of"},
]

const defaultTextColumnFilter: TTextColumnFilter = {
  type: "text",
  connective: "and",
  not: false,
  operator: "equal",
  operand: undefined,
  isCaseSensitive: false,
  isWholeWordOnly: false,
  isRegex: false,
} 

const defaultNumberColumnFilter: TNumberColumnFilter = {
  type: "number",
  connective: "and",
  not: false,
  operator: "equal",
  operand: undefined,
}

export default forwardRef(function ColumnFilter({
  filterBy,
  annotations,
  annotationFields,
  onChange,
}: TColumnFilterProps, ref) {
  const [open, setOpen] = useState(false)
  const [field, setField] = useState("")
  const [filters, setFilters] = useState<TTextColumnFilter[] | TNumberColumnFilter[]>([])

  const uniqueFieldValues = useMemo(() => {
    const uniqueFieldValues = []
    if (annotations?.[field]) {
      const u = Array.from(new Set(annotations[field]))
      if (u.length <= 100) { // limit categorical type size
        for (const v of u) {
          uniqueFieldValues.push({value: v ?? "$$undefined$$", label: v ?? <Typography.Text type="secondary">N/A</Typography.Text>})
        }
      }
    }
    return uniqueFieldValues as NonNullable<SelectProps["options"]>
  }, [annotations, field])
  
  // The ref below must only be updated in the `open()` function in the imperative handle
  const defaultFilterRef = useRef<TTextColumnFilter | TNumberColumnFilter>(defaultTextColumnFilter)
  
  useImperativeHandle(ref, () => ({
    open(field: string) {
      defaultFilterRef.current = (
        (field === "$$sequence$$") || 
        (annotationFields[field].string > annotationFields[field].number)
      ) ? defaultTextColumnFilter : defaultNumberColumnFilter
      
      setField(field)
      setFilters(filterBy?.[field] ?? [{...defaultFilterRef.current}] as TTextColumnFilter[] | TNumberColumnFilter[])
      setOpen(true)
    }
  }), [annotationFields, filterBy])

  const content = []
  for (let i = 0; i < filters.length; ++i) {
    const updateFilters = (newFilter: TTextColumnFilter | TNumberColumnFilter | undefined) => {
      const newFilters = filters.slice()
      if (newFilter === undefined) {
        newFilters.splice(i, 1)
      } else {
        newFilters[i] = newFilter
      }
      setFilters(newFilters)
    }  

    if (i > 0) {
      content.push(
        <ColumnFilterConnective 
          key={`${i} connective`}
          filter={filters[i]}
          onChange={updateFilters}
        />
      )
    }

    content.push(
      <ColumnFilterOperator
        key={`${i} operator`}
        filter={filters[i]}
        options={(filters[i].type === "text") ? textColumnFilterOperatorOptions : numberColumnFilterOperatorOptions}
        onChange={updateFilters}
      />
    )

    if (filters[i].operator === "in") {
      content.push(
        <ColumnFilterSelect
          key={`${i} operand`}
          filter={filters[i]}
          uniqueFieldValues={uniqueFieldValues}
          onChange={updateFilters}
        />
      )
    } else if (filters[i].type === "text") {
      content.push(
        <TextColumnFilterInput
          key={`${i} operand`}
          filter={filters[i] as TTextColumnFilter}
          onChange={updateFilters}
        />
      )
    } else {
      content.push(
        <NumberColumnFilterInput
          key={`${i} operand`}
          filter={filters[i] as TNumberColumnFilter}
          onChange={updateFilters}
        />
      )
    }
    
    if (filters.length > 1) {
      content.push(
        <Button
          key={`${i} remove`}
          className="remove"
          icon={<DeleteOutlined/>} // CloseOutlined
          // type="text"
          // size="small"
          onClick={() => {updateFilters(undefined)}}
        />
      )
    }
  }

  const handleCancel = useCallback(() => {
    setOpen(false)
  }, [])

  const handleOk = useCallback(() => {
    setOpen(false)
    const newFilters = []
    for (const f of filters) {
      if (f.operator === "in") {
        if (f.operand.length > 0) {
          for (let i = 0; i < f.operand.length; ++i) {
            if (f.operand[i] === "$$undefined$$") {
              f.operand[i] = undefined
            }
          }
          newFilters.push(f)
        }
      } else {
        if (f.operand !== undefined) {
          newFilters.push(f)
        }
      }
    }

    if (newFilters.length > 0) {
      const newFilterBy = filterBy ? {...filterBy} : {}
      newFilterBy[field] = newFilters as TTextColumnFilter[] | TNumberColumnFilter[]
      onChange(newFilterBy)  
    } else if ((filterBy !== undefined) && (field in filterBy)) {
      const newFilterBy = {...filterBy}
      delete newFilterBy[field]
      onChange(newFilterBy)
    }
  }, [field, filterBy, filters, onChange])

  const handleClearFilter = useCallback(() => {
    setOpen(false)
    const newFilterBy = {...filterBy}
    delete newFilterBy[field]
    onChange(newFilterBy)
  }, [field, filterBy, onChange])

  const handleAddFilter = useCallback(() => {
    setFilters([...filters, {...defaultFilterRef.current}] as TTextColumnFilter[] | TNumberColumnFilter[])
  }, [filters])

  const title = (
    <>
      {/* <Icon 
        component={FaFilter} 
        style={{
          color: token.colorText,
          paddingRight: token.paddingXS,
        }} 
      />  */}
      Filter by {(field === "$$sequence$$") ? "Sequence" : annotationFields[field]?.name}
    </>
  )

  function footer(originNode: ReactNode) {
    return (
      <Flex gap="small" className="footer" >
        <Button onClick={handleAddFilter}>Add Rule</Button>
        <Button onClick={handleClearFilter}>Clear Filter</Button>
        <div style={{flexGrow: 1}} />
        {originNode}
      </Flex>
    )
  }

  return (
    <Modal
      title={title}
      open={open}
      // destroyOnClose={true} // ?
      classNames={{body: "av-column-filter"}}
      closable={false}
      footer={footer}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      {content}
    </Modal>
  )
})

function ColumnFilterConnective<T extends TTextColumnFilter | TNumberColumnFilter>({
  filter, 
  onChange,
}: {
  filter: T, 
  onChange: (newFilter: T) => void,
}) {
  // return (
  //   <Select 
  //     value={filter.connective}
  //     options={[
  //       {value: "and", label: "AND"},
  //       {value: "or", label: "OR"},
  //     ]}
  //     className="connective"
  //     popupMatchSelectWidth={false}
  //     onChange={(connective) => {
  //       onChange({...filter, connective})
  //     }}
  //   />
  // )

  return (
    <Radio.Group
      value={filter.connective}
      className="connective"
      onChange={(event) => {
        onChange({...filter, connective: event.target.value})
      }}
    >
      <Radio value="and">AND</Radio>
      <Radio value="or">OR</Radio>
    </Radio.Group>
  )
}

function ColumnFilterOperator<T extends TTextColumnFilter | TNumberColumnFilter>({
  filter, 
  options,
  onChange,
}: {
  filter: T, 
  options: NonNullable<SelectProps["options"]>,
  onChange: (newFilter: T) => void,
}) {
  return (
    <Select
      value={filter.not ? "not-" + filter.operator : filter.operator}
      options={options} 
      className="operator"
      popupClassName="av-column-filter-operator-dropdown"
      popupMatchSelectWidth={false}
      onChange={(value) => {
        let operator = value, not = false
        if (value.startsWith("not-")) {
          operator = value.substring("not-".length)
          not = true
        }

        onChange({
          ...filter, 
          operator, 
          not,
          operand: (operator === "in") ? [] : undefined,
        })
      }}
    />
  )
}

function TextColumnFilterInput({
  filter, 
  onChange,
}: {
  filter: TTextColumnFilter, 
  onChange: (newFilter: TTextColumnFilter) => void,
}) {
  if (filter.operator === "in") {
    return null
  }

  return (
    <Input
      value={filter.operand}
      className="operand"
      onChange={(event) => {
        onChange({...filter, operand: event.target.value})
      }}
      suffix={
        <Space size={4}>
          <Tag.CheckableTag
            checked={filter.isCaseSensitive}
            // title="Case Sensitive"
            style={{margin: 0, paddingInline: 2, border: "none"}}
            onChange={(checked) => onChange({...filter, isCaseSensitive: checked})}
          >
            <Icon component={CaseSensitiveIcon} style={{fontSize: 16}} />
          </Tag.CheckableTag>
          <Tag.CheckableTag
            checked={filter.isWholeWordOnly}
            title="Whole Word Only"
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
  )
}

// function TextColumnFilterInput({
//   filter, 
//   onChange,
// }: {
//   filter: TTextColumnFilter, 
//   onChange: (newFilter: TTextColumnFilter) => void,
// }) {
//   return (
//     <Input
//       value={filter.operand}
//       className="operand"
//       onChange={(event) => {
//         onChange({...filter, operand: event.target.value})
//       }}
//       suffix={
//         <Space size={4}>
//           <Button
//             // checked={filter.isCaseSensitive}
//             icon={<Icon component={CaseSensitiveIcon} style={{fontSize: 16}} />}
//             title="Case Sensitive"
//             type="text"
//             size="small"
//             className="text-input-addon"
//             // style={{margin: 0, paddingInline: 2, border: "none"}}
//             // onChange={(checked) => onChange({...filter, isCaseSensitive: checked})}
//           />
//           <Tag.CheckableTag
//             checked={filter.isWholeWordOnly}
//             title="Whole Word Only"
//             style={{margin: 0, paddingInline: 2, border: "none"}}
//             onChange={(checked) => onChange({...filter, isWholeWordOnly: checked})}
//           >
//             <Icon component={WholeWordIcon}  style={{fontSize: 16}} />
//           </Tag.CheckableTag>
//           <Tag.CheckableTag
//             checked={filter.isRegex}
//             title="Regular Expression"
//             style={{margin: 0, paddingInline: 2, border: "none"}}
//             onChange={(checked) => onChange({...filter, isRegex: checked})}
//           >
//             <Icon component={RegexIcon} style={{fontSize: 16}} />
//           </Tag.CheckableTag>
//         </Space>
//       }
//     />
//   )
// }

function NumberColumnFilterInput({
  filter, 
  onChange,
}: {
  filter: TNumberColumnFilter, 
  onChange: (newFilter: TNumberColumnFilter) => void,
}) {
  if (filter.operator === "in") {
    return null
  }

  return (
    <InputNumber
      value={filter.operand}
      className="operand"
      style={{width: "100%"}}
      onChange={(value) => {
        onChange({...filter, operand: (value === null) ? undefined : value})
      }}
    />
  )
}

function ColumnFilterSelect<T extends TTextColumnFilter | TNumberColumnFilter>({
  filter, 
  uniqueFieldValues,
  onChange,
}: {
  filter: T, 
  uniqueFieldValues: NonNullable<SelectProps["options"]>,
  onChange: (value: T) => void,
}) {
  if (filter.operator !== "in") {
    return null
  }

  return (
    <Select
      value={filter.operand}
      disabled={uniqueFieldValues.length === 0}
      options={uniqueFieldValues}
      mode="multiple"
      allowClear
      className="operand"
      // placeholder="Please select"
      popupMatchSelectWidth={false}
      onChange={(value) => {
        onChange({...filter, operand: value})
      }}
    />
  )
}

