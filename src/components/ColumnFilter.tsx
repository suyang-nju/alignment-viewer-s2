import type { TColumnFilterProps, TTextColumnFilterRule, TNumberColumnFilterRule, TMissingDataColumnFilterRule, TColumnFilter } from '../lib/types'
import type { ReactNode } from 'react'
import type { SelectProps } from 'antd'

import { useState, useMemo, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { isNil } from 'lodash'
import {
  Modal, Flex, Space, Select, Input, InputNumber, Button, Tag,
  Radio, Divider, Typography, Tooltip,
} from 'antd'
import Icon, { CloseOutlined, DeleteOutlined } from '@ant-design/icons'
import { FaFilter } from "react-icons/fa"

import ActionMenuButton from './ActionMenuButton'

const CaseSensitiveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="2 2 12 12"><path fill="currentColor" d="M8.854 11.702h-1l-.816-2.159H3.772l-.768 2.16H2L4.954 4h.935zm-2.111-2.97L5.534 5.45a3.142 3.142 0 0 1-.118-.515h-.021c-.036.218-.077.39-.124.515L4.073 8.732zm7.013 2.97h-.88v-.86h-.022c-.383.66-.947.99-1.692.99c-.548 0-.978-.146-1.29-.436c-.307-.29-.461-.675-.461-1.155c0-1.027.605-1.625 1.815-1.794l1.65-.23c0-.935-.379-1.403-1.134-1.403c-.663 0-1.26.226-1.794.677V6.59c.54-.344 1.164-.516 1.87-.516c1.292 0 1.938.684 1.938 2.052zm-.88-2.782l-1.327.183c-.409.057-.717.159-.924.306c-.208.143-.312.399-.312.768c0 .268.095.489.285.66c.193.169.45.253.768.253a1.41 1.41 0 0 0 1.08-.457c.286-.308.43-.696.43-1.165z"/></svg>
)

const WholeWordIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 2 16 12"><g fill="currentColor"><path d="M0 11h1v2h14v-2h1v3H0z"/><path d="M6.84 11h-.88v-.86h-.022c-.383.66-.947.989-1.692.989c-.548 0-.977-.145-1.289-.435c-.308-.29-.462-.675-.462-1.155c0-1.028.605-1.626 1.816-1.794l1.649-.23c0-.935-.378-1.403-1.134-1.403c-.662 0-1.26.226-1.794.677v-.902c.541-.344 1.164-.516 1.87-.516c1.292 0 1.938.684 1.938 2.052zm-.88-2.782L4.633 8.4c-.408.058-.716.16-.924.307c-.208.143-.311.399-.311.768c0 .268.095.488.284.66c.194.168.45.253.768.253a1.41 1.41 0 0 0 1.08-.457c.286-.308.43-.696.43-1.165zm3.388 1.987h-.022V11h-.88V2.857h.88v3.61h.021c.434-.73 1.068-1.096 1.902-1.096c.705 0 1.257.247 1.654.741c.401.49.602 1.15.602 1.977c0 .92-.224 1.658-.672 2.213c-.447.551-1.06.827-1.837.827c-.726 0-1.276-.308-1.649-.924m-.022-2.218v.768c0 .455.147.841.44 1.16c.298.315.674.473 1.128.473c.534 0 .951-.204 1.252-.613c.304-.408.456-.975.456-1.702c0-.613-.141-1.092-.424-1.44c-.283-.347-.666-.52-1.15-.52c-.511 0-.923.178-1.235.536c-.311.355-.467.8-.467 1.338"/></g></svg>
)

const RegexIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"><path fill="currentColor" d="M10.25 1.75a.75.75 0 0 0-1.5 0v3.451L5.761 3.475a.75.75 0 1 0-.75 1.3L8 6.5L5.011 8.225a.75.75 0 1 0 .75 1.3L8.75 7.799v3.451a.75.75 0 0 0 1.5 0V7.8l2.989 1.725a.75.75 0 1 0 .75-1.3L11 6.5l2.989-1.725a.75.75 0 1 0-.75-1.3L10.25 5.201zM3 15a2 2 0 1 0 0-4a2 2 0 0 0 0 4"/></svg>
)

const defaultTextColumnFilterRule: TTextColumnFilterRule = {
  type: "text",
  connective: "and",
  not: false,
  operator: "equal",
  operand: undefined,
  isCaseSensitive: false,
  isWholeWordOnly: false,
  isRegex: false,
} 

const defaultNumberColumnFilterRule: TNumberColumnFilterRule = {
  type: "number",
  connective: "and",
  not: false,
  operator: "equal",
  operand: undefined,
}

const defaultMissingDataColumnFilterRule: TMissingDataColumnFilterRule = {
  type: "missing",
  connective: "and",
  not: false,
  operator: "missing",
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
  const [filterRules, setFilterRules] = useState<TColumnFilter>([])
  const [uniqueFieldValues, setUniqueFieldValues] = useState<NonNullable<SelectProps["options"]>>([])

  // const uniqueFieldValues = useMemo(() => {
  //   const uniqueFieldValues = []
  //   if (annotations?.[field]) {
  //     const u = Array.from(new Set(annotations[field]))
  //     if (u.length <= 100) { // limit categorical type size
  //       for (const v of u) {
  //         uniqueFieldValues.push({value: v ?? MISSING_VALUE, label: v ?? <Typography.Text type="secondary">N/A</Typography.Text>})
  //       }
  //     }
  //   }
  //   return uniqueFieldValues as NonNullable<SelectProps["options"]>
  // }, [annotations, field])
    
  useImperativeHandle(ref, () => ({
    open(field: string) {
      const uniqueFieldValues = []
      if (annotations?.[field]) {
        const u = Array.from(new Set(annotations[field]))
        if (u.length <= 200) { // limit categorical type size
          for (const v of u) {
            if (!isNil(v)) {
              uniqueFieldValues.push({value: v, label: v}) // <Typography.Text italic type="secondary">N/A</Typography.Text>
            }
          }
        }
      }
      setUniqueFieldValues(uniqueFieldValues as NonNullable<SelectProps["options"]>)

      const isTextField = ((field === "$$sequence$$") || (annotationFields[field].string > annotationFields[field].number))
      const defaultFilterRule = Object.assign(
        {}, 
        isTextField ? defaultTextColumnFilterRule : defaultNumberColumnFilterRule
      )

      if (uniqueFieldValues.length > 0) {
        Object.assign(defaultFilterRule, {operator: "in", operand: []})
      }
      
      setField(field)
      const rules = filterBy?.[field]
      const filterRules: TColumnFilter = rules ? rules.slice() : [defaultFilterRule]
      setFilterRules(filterRules)
      // console.log("in open", filterRules)
      // setFilterRules(filterBy?.[field] ?? [defaultFilterRule] as TTextColumnFilterRule[] | TNumberColumnFilterRule[])
      setOpen(true)
    }
  }), [annotationFields, annotations, filterBy, /*uniqueFieldValues.length*/])

  const handleCancel = useCallback(() => {
    setOpen(false)
  }, [])

  const handleOk = useCallback(() => {
    setOpen(false)
    const newFilters = []
    for (const f of filterRules) {
      if (
        (f.operator === "missing") || 
        ((f.operator === "in") && (f.operand.length > 0)) ||
        (f.operand !== undefined)
      ) {
        newFilters.push(f)
      }
    }

    if (newFilters.length > 0) {
      const newFilterBy = filterBy ? {...filterBy} : {}
      newFilterBy[field] = newFilters
      onChange(newFilterBy)  
    } else if ((filterBy !== undefined) && (field in filterBy)) {
      const newFilterBy = {...filterBy}
      delete newFilterBy[field]
      onChange(newFilterBy)
    }
  }, [field, filterBy, filterRules, onChange])

  const handleRemoveFilter = useCallback(() => {
    setOpen(false)
    const newFilterBy = {...filterBy}
    delete newFilterBy[field]
    onChange(newFilterBy)
  }, [field, filterBy, onChange])

  const handleAddFilter = useCallback((filter: TTextColumnFilterRule | TNumberColumnFilterRule | TMissingDataColumnFilterRule) => {
    setFilterRules([...filterRules, filter])
  }, [filterRules])

  const title = (
    <>
      {/* <Icon 
        component={FaFilter} 
        style={{
          color: token.colorText,
          paddingRight: token.paddingXS,
        }} 
      />  */}
      Filter by column
    </>
  )

  function footer(originNode: ReactNode) {
    return (
      <Flex gap="small" className="footer" >
        <AddFilterRule onClick={handleAddFilter} />
        <Button onClick={handleRemoveFilter}>Remove Filter</Button>
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
      <FilterRulesGrid
        fieldName={(field === "$$sequence$$") ? "Sequence" : annotationFields[field]?.name}
        filterRules={filterRules}
        uniqueFieldValues={uniqueFieldValues}
        onFilterChange={setFilterRules}
      />
    </Modal>
  )
})

function FilterRulesGrid({
  fieldName,
  filterRules,
  uniqueFieldValues,
  onFilterChange,
}: {
  fieldName: string,
  filterRules: TColumnFilter,
  uniqueFieldValues: NonNullable<SelectProps["options"]>,
  onFilterChange: (filter: TColumnFilter) => void
}) {
  const content = []
  if (filterRules.length === 0) {
    content.push(
      <div key="no-filter-rules" className="column-name">
        <Typography.Text type='secondary'>No filter rules</Typography.Text>
      </div>
    )
  } else {
    for (let i = 0; i < filterRules.length; ++i) {
      let columnFilterOperatorOptions: NonNullable<SelectProps["options"]>
      switch (filterRules[i].type) {
        case "text":
          columnFilterOperatorOptions = [
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
            {value: "in", label: "Is Any Of", disabled: (uniqueFieldValues.length === 0)},
            {value: "not-in", label: "Is None Of", disabled: (uniqueFieldValues.length === 0)},
          ]
          break
        case "number":
          columnFilterOperatorOptions = [
            {value: "equal", label: "Equals"},
            {value: "not-equal", label: "Does Not Equal"},
            {value: "divider-1", label: <Divider/>, options: []},
            {value: "greater", label: "Greater Than"},
            {value: "not-less", label: "Greater Than Or Equal To"},
            {value: "divider-2", label: <Divider/>, options: []},
            {value: "less", label: "Less Than"},
            {value: "not-greater", label: "Less Than Or Equal To"},
            {key: "divider-3", label: <Divider/>, options: []},
            {value: "in", label: "Is Any Of", disabled: (uniqueFieldValues.length === 0)},
            {value: "not-in", label: "Is None Of", disabled: (uniqueFieldValues.length === 0)},
          ]
          break
        case "missing":
          columnFilterOperatorOptions = [
            {value: "missing", label: <Typography.Text>Is <Typography.Text type="secondary" italic>N/A</Typography.Text></Typography.Text>},
            {value: "not-missing", label: <Typography.Text>Is Not <Typography.Text type="secondary" italic>N/A</Typography.Text></Typography.Text>},
          ]
          break
      }

      const updateFilters = (newFilter: TTextColumnFilterRule | TNumberColumnFilterRule | TMissingDataColumnFilterRule | undefined) => {
        const newFilterRules = filterRules.slice()
        if (newFilter === undefined) {
          newFilterRules.splice(i, 1)
        } else {
          newFilterRules[i] = newFilter
        }
        onFilterChange(newFilterRules)
      }  
  
      if (i === 0) {
        content.push(
          <div key={`${i} connective`} className='column-name'>{fieldName}</div>
        )
      } else {
        content.push(
          <ColumnFilterConnective 
            key={`${i} connective`}
            filter={filterRules[i]}
            onChange={updateFilters}
          />
        )
      }
  
      content.push(
        <ColumnFilterOperator
          key={`${i} operator`}
          filter={filterRules[i]}
          options={columnFilterOperatorOptions}
          onChange={updateFilters}
        />
      )
  
      if (filterRules[i].type === "missing") {
        content.push(<div key={`${i} operand`}/>)
      } else if (filterRules[i].operator === "in") {
        content.push(
          <ColumnFilterSelect
            key={`${i} operand`}
            filter={filterRules[i]}
            uniqueFieldValues={uniqueFieldValues}
            autoFocus={i === 0}
            onChange={updateFilters}
          />
        )
      } else if (filterRules[i].type === "text") {
        content.push(
          <TextColumnFilterInput
            key={`${i} operand`}
            filter={filterRules[i] as TTextColumnFilterRule}
            autoFocus={i === 0}
            onChange={updateFilters}
          />
        )
      } else if (filterRules[i].type === "number") {
        content.push(
          <NumberColumnFilterInput
            key={`${i} operand`}
            filter={filterRules[i] as TNumberColumnFilterRule}
            autoFocus={i === 0}
            onChange={updateFilters}
          />
        )
      }
      
      if (filterRules.length > 0) {
        content.push(
          <Button
            key={`${i} remove`}
            className="remove"
            icon={<DeleteOutlined/>} // CloseOutlined
            title="Remove Rule"
            // type="text"
            // size="small"
            onClick={() => {updateFilters(undefined)}}
          />
        )
      }
    }
  }

  return (<div className="filter-rules-grid">{content}</div>)
}

function AddFilterRule({
  onClick
}: {
  onClick: (filter: TTextColumnFilterRule | TNumberColumnFilterRule | TMissingDataColumnFilterRule) => void,
}) {
  const menu = useMemo(() => ({
    items: [{
      key: "text",
      label: "Textual Data Rule",
    }, {
      key: "number",
      label: "Numeric Data Rule",
    }, {
      key: "missing",
      label: <Typography.Text>Missing Data (<Typography.Text type="secondary" italic>N/A</Typography.Text>) Rule</Typography.Text>,
    }],
    onClick: ({key}: {key: string}) => {
      switch (key) {
        case "text":
          onClick(Object.assign({}, defaultTextColumnFilterRule))
          break
        case "number":
          onClick(Object.assign({}, defaultNumberColumnFilterRule))
          break
        case "missing":
          onClick(Object.assign({}, defaultMissingDataColumnFilterRule))
          break
      }
    },
  }), [onClick])

  return (
    <ActionMenuButton menu={menu} trigger={["hover"]}>Add Rule</ActionMenuButton>
  )
}

function ColumnFilterConnective<T extends TTextColumnFilterRule | TNumberColumnFilterRule | TMissingDataColumnFilterRule>({
  filter, 
  onChange,
}: {
  filter: T, 
  onChange: (newFilter: T) => void,
}) {
  return (
    <Select 
      value={filter.connective}
      options={[
        {value: "and", label: "AND"},
        {value: "or", label: "OR"},
      ]}
      className="connective"
      popupMatchSelectWidth={false}
      onChange={(connective) => {
        onChange({...filter, connective})
      }}
    />
  )

  // return (
  //   <Radio.Group
  //     value={filter.connective}
  //     className="connective"
  //     onChange={(event) => {
  //       onChange({...filter, connective: event.target.value})
  //     }}
  //   >
  //     <Radio value="and">AND</Radio>
  //     <Radio value="or">OR</Radio>
  //   </Radio.Group>
  // )
}

function ColumnFilterOperator<T extends TTextColumnFilterRule | TNumberColumnFilterRule | TMissingDataColumnFilterRule>({
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

        const newFilter = {
          ...filter, 
          operator, 
          not,
          // operand: (operator === "in") ? [] : undefined,
        }

        if ((operator === "in") && (filter.operator !== "in")) {
          newFilter.operand = []
        } else if ((operator !== "in") && (filter.operator === "in")) {
          newFilter.operand = undefined
        }

        onChange(newFilter)
      }}
    />
  )
}

function TextColumnFilterInput({
  filter, 
  autoFocus,
  onChange,
}: {
  filter: TTextColumnFilterRule, 
  autoFocus: boolean,
  onChange: (newFilter: TTextColumnFilterRule) => void,
}) {
  if (filter.operator === "in") {
    return null
  }

  return (
    <Input
      value={filter.operand}
      autoFocus={autoFocus}
      className="operand"
      onChange={(event) => {
        onChange({...filter, operand: event.target.value})
      }}
      suffix={
        <Space size={4}>
          <Tag.CheckableTag
            checked={filter.isCaseSensitive}
            // @ts-expect-error type
            title="Case Sensitive"
            style={{margin: 0, paddingInline: 2, border: "none"}}
            onChange={(checked) => onChange({...filter, isCaseSensitive: checked})}
          >
            <Icon component={CaseSensitiveIcon} style={{fontSize: 16}} />
          </Tag.CheckableTag>
          <Tag.CheckableTag
            checked={filter.isWholeWordOnly}
            // @ts-expect-error type
            title="Whole Word Only"
            style={{margin: 0, paddingInline: 2, border: "none"}}
            onChange={(checked) => onChange({...filter, isWholeWordOnly: checked})}
          >
            <Icon component={WholeWordIcon}  style={{fontSize: 16}} />
          </Tag.CheckableTag>
          <Tag.CheckableTag
            checked={filter.isRegex}
            // @ts-expect-error type
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

function NumberColumnFilterInput({
  filter, 
  autoFocus,
  onChange,
}: {
  filter: TNumberColumnFilterRule, 
  autoFocus: boolean,
  onChange: (newFilter: TNumberColumnFilterRule) => void,
}) {
  if (filter.operator === "in") {
    return null
  }

  return (
    <InputNumber
      value={filter.operand}
      autoFocus={autoFocus}
      className="operand"
      style={{width: "100%"}}
      onChange={(value) => {
        onChange({...filter, operand: (value === null) ? undefined : value})
      }}
    />
  )
}

function ColumnFilterSelect<T extends TTextColumnFilterRule | TNumberColumnFilterRule | TMissingDataColumnFilterRule>({
  filter, 
  uniqueFieldValues,
  autoFocus,
  onChange,
}: {
  filter: T, 
  uniqueFieldValues: NonNullable<SelectProps["options"]>,
  autoFocus: boolean,
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
      autoFocus={autoFocus}
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

