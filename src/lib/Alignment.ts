import type {
  TSequenceAnnotationFields,
  TAlignmentPositionsToStyle,
  TAlignmentSortParams,
  TSequenceRecord,
  TPssmTallies,
  TPssm,
  TAlignment,
  TAlignmentAnnotations,
  TAlignmentPositionalAnnotations,
  THammingDistanceCompareFunction,
  TAlignmentFilters,
} from './types'

import {
  PssmValuesArray,
  PssmIndicesArray,
  PssmTalliesArray,
  HIDDEN_ANNOTATION_FIELDS,
  DEFAULT_GROUP_ANNOTATION_VALUES,
  GROUP_ANNOTATION_FIELDS,
} from './constants'

import {
  isGapChar,
  detectAlphabet,
} from './sequence'
import { parseFasta } from './fasta'
import { parseStockholm } from './stockholm'
import getBlosum62Score from './blosum62'
import { getObjectKeys, formatFieldName } from './utils'

import { isNil, isNumber, range } from 'lodash'
import { v4 as uuid4 } from 'uuid'

type TAlignmentTextParser = (text: string) => {
  sequenceRecords: TSequenceRecord[],
  positionalAnnotations: Partial<TAlignmentPositionalAnnotations>,
}

const PARSERS: TAlignmentTextParser[] = [
  parseFasta,
  parseStockholm,
]

export function createAlingmentFromText(name: string, text: string): TAlignment | null {
  let sequenceRecords: TSequenceRecord[] = []
  const positionalAnnotations = {} as TAlignmentPositionalAnnotations

  let _positionalAnnotations
  for (const parser of PARSERS) {
    try {
      ({
        sequenceRecords, 
        positionalAnnotations: _positionalAnnotations,
      } = parser(text))

      if (sequenceRecords.length > 0) {
        break
      }
    } catch(e) {
      // do nothing
    }
  }

  if (sequenceRecords.length === 0) {
    return null
  }

  Object.assign(positionalAnnotations, _positionalAnnotations)

  return createAlingmentFromSequenceRecords(name, sequenceRecords, positionalAnnotations)
}

export function createAlingmentFromSequenceRecords(
  name: string, 
  sequenceRecords: TSequenceRecord[],
  positionalAnnotations: TAlignmentPositionalAnnotations,
): TAlignment | null {
  const sequences: string[] = new Array(sequenceRecords.length)
  const annotationFields = {} as TSequenceAnnotationFields
  for (let i = 0; i < sequenceRecords.length; ++i) {
    sequences[i] = sequenceRecords[i].sequence

    for (const [k, v] of Object.entries(sequenceRecords[i].__annotationFields__)) {
      if (k in annotationFields) {
        annotationFields[k].name = v.name
        annotationFields[k].string += v.string
        annotationFields[k].number += v.number
      } else {
        annotationFields[k] = {...v}
      }
    }
  }

  const annotations = {} as TAlignmentAnnotations
  for (const k of getObjectKeys(annotationFields)) {
    annotations[k] = new Array(sequenceRecords.length).fill(null)
  }

  for (let i = 0; i < sequenceRecords.length; ++i) {
    for (const [k, v] of Object.entries(sequenceRecords[i].annotations)) {
      annotations[k][i] = v
    }
  }

  const stats = calcAlignmentStats(sequences)
  const {
    length, 
    depth, 
    alphabet, 
    pssmAlphabet, 
    pssmGapIndex, 
    alphabetToPssmIndex,
  } = stats
  Object.assign(positionalAnnotations, stats.positionalAnnotations)

  Object.assign(annotations, {
    __hammingDistanceToReference__: new Array(depth).fill(null),
    __hammingDistanceToConsensus__: new Array(depth).fill(null),
    __blosum62ScoreToReference__: new Array(depth).fill(null),
    __blosum62ScoreToConsensus__: new Array(depth).fill(null),
  })

  Object.assign(annotationFields, {
    __hammingDistanceToReference__: {
      name: "Hamming Distance to Reference",
      string: 0,
      number: 1,
    }, 
    __hammingDistanceToConsensus__: {
      name: "Hamming Distance to Consensus",
      string: 0,
      number: 1,
    }, 
    __blosum62ScoreToReference__: {
      name: "Blosum62 Score to Reference",
      string: 0,
      number: 1,
    }, 
    __blosum62ScoreToConsensus__: {
      name: "Blosum62 Score to Consensus",
      string: 0,
      number: 1,
    },
  })

  for (const [k, v] of Object.entries(DEFAULT_GROUP_ANNOTATION_VALUES)) {
    annotations[k] = new Array(depth).fill(null)
    for (let i = 0; i < depth; ++i) {
      annotations[k][i] = v
    }
  }

  Object.assign(annotationFields, GROUP_ANNOTATION_FIELDS)
  
  const referenceSequenceIndex = 0
  calculateDistances(
    sequences, 
    annotations,
    referenceSequenceIndex, 
    positionalAnnotations.consensus, 
    getHammingDistanceCompareFunction(alphabetToPssmIndex),
  )

  return {
    name,
    uuid: uuid4(),
    length,
    depth,
    alphabet,
    pssmAlphabet, 
    pssmGapIndex, 
    alphabetToPssmIndex,
    sequences,
    referenceSequenceIndex,
    annotations,
    positionalAnnotations,
    annotationFields,
    groupBy: false,
    groups: [],
  }
}

export function getAlignmentAnnotationFields(alignment: TAlignment) {
  const importedFields: string[] = []
  const derivedFields: string[] = []
  if (alignment?.annotationFields) {
    for (const field of Object.keys(alignment.annotationFields)) {
      if (HIDDEN_ANNOTATION_FIELDS.includes(field)) {
        continue
      }

      if ((field !== "__id__") && field.startsWith("__") && field.endsWith("__")) {
        derivedFields.push(field)
      } else {
        importedFields.push(field)
      }
    }  
  }
  return { importedFields, derivedFields }
}

export function updateAnnotations(
  annotations: TAlignmentAnnotations, 
  annotationFields: TSequenceAnnotationFields,
  matchOnField: string, 
  data: Record<string, string | null>[],
): [TAlignmentAnnotations | undefined, TSequenceAnnotationFields | undefined, number] {
  const updatedAnnotations: TAlignmentAnnotations = {...annotations}
  const updatedAnnotationFields: TSequenceAnnotationFields = {...annotationFields}
  let updatedCount = 0

  for (const row of data) {
    const id = row[matchOnField]
    if (!id) {
      continue
    }

    const sequenceIndex = updatedAnnotations.__id__.indexOf(id)
    if (sequenceIndex === -1) {
      continue
    }

    ++updatedCount
    for (const field of getObjectKeys(row)) {
      if (field === matchOnField) {
        continue
      }

      let number = 0, string = 0
      const valueString = row[field]
      let fieldValue: string | number | null = null
      if (valueString) {
        const valueNumber = parseFloat(valueString)
        if (isNaN(valueNumber)) {
          string = 1
          fieldValue = valueString
        } else {
          number = 1
          fieldValue = valueNumber
        }
      }
  
      if (field in updatedAnnotationFields) {
        const oldValue = updatedAnnotations[field][sequenceIndex]
        if (oldValue === null) {
          //
        } else if (isNumber(oldValue)) {
          --updatedAnnotationFields[field].number
        } else {
          --updatedAnnotationFields[field].string
        }
        updatedAnnotations[field][sequenceIndex] = fieldValue
        updatedAnnotationFields[field].string += string
        updatedAnnotationFields[field].number += number
      } else {
        updatedAnnotationFields[field] = {
          name: formatFieldName(field), 
          string,
          number,
        }
        updatedAnnotations[field] = new Array(updatedAnnotations.__id__.length).fill(null)
        updatedAnnotations[field][sequenceIndex] = fieldValue
      }
    }
  }

  return [
    (updatedCount > 0) ? updatedAnnotations : undefined, 
    (updatedCount > 0) ? updatedAnnotationFields : undefined, 
    updatedCount
  ]
}

function calcPSSM(
  sequences: string[], 
  length: number, 
  pssmAlphabet: string, 
  pssmGapIndex: number, 
  alphabetToPssmIndex: Record<string, number>,
): [TPssm, TPssmTallies] {
  const pssmValues = new PssmValuesArray(pssmAlphabet.length * length)
  const pssmSortedIndices = new PssmIndicesArray(pssmValues.length)
  const tallies = new PssmTalliesArray(pssmValues.length)
  let k = 0

  for (const seq of sequences) {
    k = 0
    for (let i = 0; i < seq.length; ++i) {
      const pssmIndex = alphabetToPssmIndex[seq[i]]
      ++tallies[k + pssmIndex]
      k += pssmAlphabet.length
    }
  }

  const argsortHelperIndices = new PssmIndicesArray(pssmAlphabet.length)
  k = 0
  for (let i = 0; i < length; ++i) {
    for (let j = 0; j < pssmAlphabet.length; ++j) {
      argsortHelperIndices[j] = j
    }
    const compareFn = (a: number, b: number) => (tallies[k + a] - tallies[k + b]) // ascending
    argsortHelperIndices.sort(compareFn)
    pssmSortedIndices.set(argsortHelperIndices, k)
    k += pssmAlphabet.length
  }

  const depth = sequences.length
  for (let i = 0; i < tallies.length; ++i) {
    // special-case true 0 as -1 because < 0.5% will be rounded to 0
    pssmValues[i] = (tallies[i] === 0) ? -1 : Math.round(tallies[i] / depth * 100)
  }

  return [
    {
      alphabet: pssmAlphabet,
      values: pssmValues, 
      sortedIndices: pssmSortedIndices,
      length,
      gapIndex: pssmGapIndex,
    }, 
    tallies
  ]
}

function calcAlignmentStats(sequences: string[]) {
  const depth = sequences.length
  let length = 0
  for (let i = 0; i < depth; ++i) {
    if (sequences[i].length > length) {
      length = sequences[i].length
    }
  }

  const {alphabet, pssmAlphabet, pssmGapIndex, alphabetToPssmIndex} = detectAlphabet(sequences)
  const [ pssm, tallies ] = calcPSSM(sequences, length, pssmAlphabet, pssmGapIndex, alphabetToPssmIndex)
  let k = 0  

  const q = new PssmTalliesArray(pssm.alphabet.length) // for KL divergence
  k = 0  
  for (let i = 0; i < length; ++i) {
    for (let j = 0; j < pssm.alphabet.length; ++j) {
      q[j] += tallies[k + j]
    }
    k += pssm.alphabet.length
  }


  const coverage = new Array<number>(length)
  const entropy = new Array<number>(length)
  const klDivergence = new Array<number>(length)
  let maxEntropy = 0
  let maxKlDivergence = 0
  k = 0
  for (let i = 0; i < length; ++i) {
    // pssmGapIndex < 0: no gap in PSSM
    coverage[i] = 1.0 - ((pssmGapIndex < 0) ? 0 : tallies[k + pssmGapIndex] / depth)
    
    entropy[i] = 0
    klDivergence[i] = 0
    for (let j = 0; j < pssm.alphabet.length; ++j) {
      if (tallies[k + j] > 0) {
        const p = tallies[k + j] / depth
        entropy[i] -= p * Math.log2(p)
        if (q[j] > 0) {
          klDivergence[i] += p * Math.log2(tallies[k + j] / q[j] * length)
        }
      }
    }

    if (maxEntropy < entropy[i]) {
      maxEntropy = entropy[i]
    }

    if (maxKlDivergence < klDivergence[i]) {
      maxKlDivergence = klDivergence[i]
    }

    k += pssm.alphabet.length
  }

  const conservation = new Array<number>(length)
  if (maxEntropy > 0) {
    for (let i = 0; i < length; ++i) {
      conservation[i] = 1.0 - entropy[i] / maxEntropy
    }
  } else {
    for (let i = 0; i < length; ++i) {
      conservation[i] = 1.0
    }
  }

  const consensus = new Array<string>(length)
  k = pssm.alphabet.length - 1
  for (let i = 0; i < length; ++i) {
    // TODO: what if tied?
    consensus[i] = pssm.alphabet[pssm.sortedIndices[k]]
    k += pssm.alphabet.length
  }

  return {
    length, 
    depth, 
    alphabet, 
    pssmAlphabet, 
    pssmGapIndex, 
    alphabetToPssmIndex,
    positionalAnnotations: {
      coverage, 
      pssm, 
      consensus: consensus.join(""), 
      conservation, 
      entropy: {
        values: entropy,
        max: maxEntropy,
      }, 
      klDivergence: {
        values: klDivergence,
        max: maxKlDivergence, 
      }, 
    }
  }
}

export function getHammingDistanceCompareFunction(alphabetToPssmIndex: Record<string, number>) {
  return (a: string, b: string) => ((alphabetToPssmIndex[a] === alphabetToPssmIndex[b]) ? 0 : 1)
}

function calculateDistances(
  sequences: string[],
  annotations: TAlignmentAnnotations, 
  referenceSequenceIndex: number,
  consensusSequence: string,
  hammingDistanceCompareFunction: THammingDistanceCompareFunction,
): TAlignmentAnnotations {
  // Normally these should be immutable updates (create new copies of each rec),
  // but because this function will be called in a worker thread, a new copy of
  // everything will be made when returning to the main thread
  const referenceSequence = sequences[referenceSequenceIndex]
  for (let i = 0; i < sequences.length; ++i) {
    annotations.__hammingDistanceToReference__[i] = hammingDistance(sequences[i], referenceSequence, hammingDistanceCompareFunction)
    annotations.__hammingDistanceToConsensus__[i] = hammingDistance(sequences[i], consensusSequence, hammingDistanceCompareFunction)
    annotations.__blosum62ScoreToReference__[i] = sequenceBlosum62Score(sequences[i], referenceSequence)
    annotations.__blosum62ScoreToConsensus__[i] = sequenceBlosum62Score(sequences[i], consensusSequence)
  }
  return annotations
}

function hammingDistance(
  sequence1: string, 
  sequence2: string, 
  hammingDistanceCompareFunction: THammingDistanceCompareFunction,
): number {
  //if they are not the same length, those extra positions in one
  //sequence count as differences to the other sequence
  let length: number, distance: number
  if (sequence1.length < sequence2.length) {
    length = sequence1.length
    distance = sequence2.length - sequence1.length
  } else {
    length = sequence2.length
    distance = sequence1.length - sequence2.length
  }

  for (let i = 0; i < length; i++) {
    const d = hammingDistanceCompareFunction(sequence1[i], sequence2[i])
    if ((d === 1) && (!isGapChar(sequence1[i]))) {
      distance += d
    }
  }

  return distance
}

function sequenceBlosum62Score(sequence1: string, sequence2: string): number {
  const length = (sequence1.length < sequence2.length) ? sequence1.length : sequence2.length
  let score = 0
  for (let i = 0; i < length; ++i) {
    score += getBlosum62Score(sequence1[i], sequence2[i])
  }
  return score
}

export function shouldBeStyledFactory(
  positionsToStyle: TAlignmentPositionsToStyle, 
  referenceSequence: string, 
  consensusSequence: string,
  alphabetToPssmIndex: Record<string, number>,
) {
  if (positionsToStyle === "all") {
    return (residue: string, position: number) => true
  }

  let compareToSequence: string
  let truthValue: number
  switch (positionsToStyle) {
    case "sameAsReference":
      compareToSequence = referenceSequence
      truthValue = 0
      break
    case "differentFromReference":
      compareToSequence = referenceSequence
      truthValue = 1
      break
    case "sameAsConsensus":
      compareToSequence = consensusSequence
      truthValue = 0
      break
    case "differentFromConsensus":
      compareToSequence = consensusSequence
      truthValue = 1
      break
  }

  const compareFn = getHammingDistanceCompareFunction(alphabetToPssmIndex)
  return (residue: string, position: number) => (compareFn(residue, compareToSequence[position]) === truthValue)
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegExp(regexString: string) {
  return regexString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
}

export function filterAlignment(alignment: TAlignment, filterBy?: TAlignmentFilters): number[] {
  if ((filterBy === undefined) || (Object.keys(filterBy).length === 0)) {
    return range(0, alignment.depth)
  }

  const filterFunctions: {[field: string]: Array<(annotation: string | number | null) => boolean>} = {}
  for (const field of Object.keys(filterBy)) {
    filterFunctions[field] = []
    for (const f of filterBy[field]) {
      let func: ((annotation: string | number | null) => boolean)
      if (f.operator === "missing") {
        func = (annotation) => isNil(annotation)
      } else if (f.operator === "in") {
        if (f.type === "text") {
          func = (annotation) => (!isNil(annotation) && f.operand.includes(isNumber(annotation) ? `${annotation}` : annotation))
        } else {
          func = (annotation) => (isNumber(annotation) && (f.operand.includes(annotation)))
        }
      } else if (f.type === "number") {
        switch (f.operator) {
          case "equal":
            func = (annotation) => (annotation === f.operand)
            break
          case "greater":
            func = (annotation) => (isNumber(annotation) && (annotation > f.operand!))
            break
          case "less":
            func = (annotation) => (isNumber(annotation) && (annotation < f.operand!))
            break
        }
      } else { // f.type === "text"
        const regexFlags = f.isCaseSensitive ? undefined : "i"
        let corePattern = f.isRegex ? f.operand! : escapeRegExp(f.operand!)
        if (f.isWholeWordOnly) {
          corePattern = "\\b" + corePattern + "\\b"
        }

        let regex: RegExp
        switch (f.operator) {
          case "equal":
            regex = new RegExp("^" + corePattern + "$", regexFlags)
            break
          case "contain":
            regex = new RegExp(corePattern, regexFlags)
            break
          case "begin":
            regex = new RegExp("^" + corePattern, regexFlags)
            break
          case "end":
            regex = new RegExp(corePattern + "$", regexFlags)
            break
        }

        func = (annotation) => ((annotation !== null) && regex.test(`${annotation}`))
      }
      
      filterFunctions[field].push(func)
    }
  }

  const filteredIndices: number[] = []
  for (let i = 0; i < alignment.depth; ++i) {
    let matched = true
    for (const field of Object.keys(filterBy)) {
      const annotation = (field === "$$sequence$$") ? alignment.sequences[i] : alignment.annotations[field][i]
      for (let j = 0; j < filterFunctions[field].length; ++j) {
        const func = filterFunctions[field][j]
        const f = filterBy[field][j]
        
        // @ts-expect-error type
        let m = func(annotation)
        if (f.not) {
          m = !m
        }

        matched = (j === 0) ? m : (f.connective === "and") ? (matched && m) : (matched || m)
      }
      
      if (!matched) {
        break
      }
    }

    if (matched) {
      filteredIndices.push(i)
    }
  }

  return filteredIndices
}

export function sortAlignment(alignment: TAlignment, sortBy?: TAlignmentSortParams[], filteredIndices?: number[]): number[] {
  if (filteredIndices === undefined) {
    filteredIndices = filterAlignment(alignment) // range(0, alignment.depth)
  }

  if (!sortBy || (sortBy.length === 0)) {
    if (alignment.groupBy === false) {
      // sortedIndices = range(0, alignment.depth)
      return filteredIndices
    } else { // sort by group index
      const filteredIndicesSet = new Set(filteredIndices)
      const filteredSortedIndices: number[] = []
      for (const group of alignment.groups) {
        for (const sequenceIndex of group.members) {
          if (filteredIndicesSet.has(sequenceIndex)) {
            filteredSortedIndices.push(sequenceIndex)
          }
        }
      }
      return filteredSortedIndices
    }
  }

  let actualSortBy: TAlignmentSortParams[]
  if (alignment.groupBy !== false) {
    const groupSortBy: TAlignmentSortParams[] = []
    const otherSortBy: TAlignmentSortParams[] = []
    let sortByGroupIndex = false
    for (const by of sortBy) {
      if ([alignment.groupBy, "__groupIndex__", "__groupSize__"].includes(by.field)) {
        if (by.field === "__groupIndex__") {
          sortByGroupIndex = true
        }
        groupSortBy.push(by)
      } else {
        otherSortBy.push(by)
      }
    }

    if (!sortByGroupIndex) {
      groupSortBy.push({
        field: "__groupIndex__",
        order: "asc"
      })
    }

    actualSortBy = groupSortBy.concat(otherSortBy)
  } else {
    actualSortBy = sortBy
  }  

  function cmp(a: number, b: number): 1 | 0 | -1 {
    for (const by of actualSortBy) {
      const value_a = alignment.annotations[by.field][a] ?? ""
      const value_b = alignment.annotations[by.field][b] ?? ""
      if (value_a !== value_b) {
        if (by.order === "asc") {
          return (value_a < value_b) ? -1 : 1
        } else { // by.order === "desc"
          return (value_a > value_b) ? -1 : 1
        }
      }
    }
    return 0
  }
  
  const filteredSortedIndices = filteredIndices.slice() // range(0, alignment.depth)
  filteredSortedIndices.sort(cmp)
  return filteredSortedIndices
}

export function setReferenceSequence(alignment: TAlignment, referenceSequenceIndex: number): TAlignment {
  if (referenceSequenceIndex === alignment.referenceSequenceIndex) {
    return alignment
  }

  if ((referenceSequenceIndex >= 0) && (referenceSequenceIndex < alignment.depth)) {
    alignment.referenceSequenceIndex = referenceSequenceIndex
    calculateDistances(
      alignment.sequences,
      alignment.annotations,
      alignment.referenceSequenceIndex,
      alignment.positionalAnnotations.consensus,
      getHammingDistanceCompareFunction(alignment.alphabetToPssmIndex),
    )
  }
  return alignment
}

export function groupByField(alignment: TAlignment, groupBy: string | number | false): TAlignment {
  alignment.groupBy = groupBy
  alignment.groups = []
  if (groupBy === false) {
    for (const [k, v] of Object.entries(DEFAULT_GROUP_ANNOTATION_VALUES)) {
      for (let i = 0; i < alignment.depth; ++i) {
        alignment.annotations[k][i] = v
      }
    }
    return alignment
  }

  const groups = new Map<string | number, number[]>()
  for (let i = 0; i < alignment.depth; ++i) {
    const groupKey = isNumber(groupBy) ? alignment.sequences[i][groupBy] : alignment.annotations[groupBy][i]
    if (groups.has(groupKey)) {
      groups.get(groupKey)?.push(alignment.annotations.__sequenceIndex__[i])
    } else {
      groups.set(groupKey, [alignment.annotations.__sequenceIndex__[i]])
    }
  }

  let groupIndex = -1
  const sequencesForPssm: string[] = []
  for (const members of groups.values()) {
    ++groupIndex
    for (const sequenceIndex of members) {
      alignment.annotations.__groupIndex__[sequenceIndex] = groupIndex
      alignment.annotations.__groupSize__[sequenceIndex] = members.length
      sequencesForPssm.push(alignment.sequences[sequenceIndex])
    }
    const [ pssm ] = calcPSSM(
      sequencesForPssm, 
      alignment.length, 
      alignment.pssmAlphabet, 
      alignment.pssmGapIndex, 
      alignment.alphabetToPssmIndex
    )
    alignment.groups.push({ members, pssm })
    sequencesForPssm.length = 0
  }

  return alignment
}
