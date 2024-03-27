import type {
  TSequenceAnnotations,
  TSequenceAnnotationFields,
} from './types'

import {
  GAPS,
} from './constants'

import { assert, formatFieldName } from './utils'

export function isGapChar(char: string): boolean {
  return GAPS.includes(char)
}

export function detectAlphabet(sequences: string[]) {
  const letters: Set<string> = new Set()
  for (const seq of sequences) {
    for (const char of seq) {
      letters.add(char)
    }
  }

  const alphabet = Array.from(letters).join("")
  const alphabetToPssmIndex: Record<string, number> = {}
  const pssmAlphabetArray: string[] = []
  let pssmGapIndex = -1
  let i = 0
  for (const char of alphabet) {
    const upperCaseChar = isGapChar(char) ? GAPS[0] : char.toUpperCase()
    if (!(upperCaseChar in alphabetToPssmIndex)) {
      pssmAlphabetArray.push(upperCaseChar)
      alphabetToPssmIndex[upperCaseChar] = i
      if (upperCaseChar === GAPS[0]) {
        pssmGapIndex = i
      }
      ++i
    }

    if (char !== upperCaseChar) {
      alphabetToPssmIndex[char] = alphabetToPssmIndex[upperCaseChar]
    }
  }
  
  const pssmAlphabet = pssmAlphabetArray.join("")
  return {alphabet, pssmAlphabet, pssmGapIndex, alphabetToPssmIndex}
}


export function calcSequenceLength(sequenceString: string) {
  let realLength = 0, gapCount = 0, leftGapCount = 0, internalGapCount = 0, rightGapCount = 0
  let internal = false
  for (let i = 0; i < sequenceString.length; ++i) {
    if (isGapChar(sequenceString[i])) {
      ++gapCount
    } else {
      ++realLength
      if (!internal) {
        internal = true
        leftGapCount = gapCount
        gapCount = 0
      } else if (gapCount > 0) {
        internalGapCount += gapCount
        gapCount = 0
      }
    }
  }
  rightGapCount = gapCount
  const alignedLength = sequenceString.length - leftGapCount - rightGapCount
  assert(realLength + internalGapCount === alignedLength)
  // const realLength = alignedLength - internalGapCount

  return {
    annotations: { 
      __realLength__: realLength,
      __alignedLength__: alignedLength,
      __leftGapCount__: leftGapCount,
      __internalGapCount__: internalGapCount,
      __rightGapCount__: rightGapCount,
    },
    annotationFields: {
      __realLength__: {
        name: "Real Length",
        string: 0,
        number: 1,
      }, 
      __alignedLength__: {
        name: "Aligned Length",
        string: 0,
        number: 1,
      }, 
      __leftGapCount__: {
        name: "Left Gaps Count",
        string: 0,
        number: 1,
      }, 
      __internalGapCount__: {
        name: "Internal Gaps Count",
        string: 0,
        number: 1,
      }, 
      __rightGapCount__: {
        name: "Right Gaps Count",
        string: 0,
        number: 1,
      }, 
    }
  }
}

type TAnnotationParser = {
  pattern: RegExp, 
  name: string, 
  toUrl: (actualId: string, matches: RegExpMatchArray) => string,
  parseAnnotations: (actualId: string, desc: string) => { 
    annotations: Partial<TSequenceAnnotations>,
    annotationFields: TSequenceAnnotationFields
  },
}

const SEQUENCE_ANNOTATION_PARSERS: TAnnotationParser[] = [{
  name: "UniProt",
  pattern: /^sp\|([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})\|([A-Z0-9]{1,5}_[A-Z0-9]{1,5})$/,
  toUrl: (actualId, m) => `https://www.uniprot.org/uniprotkb?query=${m[1]}`,
  parseAnnotations: parseAnnotationFieldsFromUniProtDescription,
}, {
  name: "UniProt",
  pattern: /^tr\|([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})\|\1_[A-Z0-9]{1,5}$/,
  toUrl: (actualId, m) => `https://www.uniprot.org/uniprotkb?query=${m[1]}`,
  parseAnnotations: parseAnnotationFieldsFromUniProtDescription,
}, {
  name: "UniProt",
  pattern: /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:\.(\d+))?$/,
  toUrl: (actualId, m) => `https://www.uniprot.org/uniprotkb?query=${m[1]}`,
  parseAnnotations: parseAnnotationFieldsFromUniProtDescription,
}, {
  name: "UniRef",
  pattern: /^(UniRef(?:100|90|50)_(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2}|UPI[A-Z0-9]+))(?:\.(\d+))?$/,
  toUrl: (actualId, m) => `https://www.uniprot.org/uniref?query=${m[1]}`,
  parseAnnotations: parseAnnotationFieldsFromUniProtDescription,
}, {
  name: "UniProt",
  pattern: /^([A-Z0-9]{1,5}_[A-Z0-9]{1,5})(?:\.(\d+))?$/,
  toUrl: (actualId, m) => `https://www.uniprot.org/uniprotkb?query=${m[1]}`,
  parseAnnotations: parseAnnotationFieldsFromUniProtDescription,
}, {
  name: "UniParc",
  pattern: /^(UPI[A-Z0-9]+)(?:\.(\d+))?$/,
  toUrl: (actualId, m) => `https://www.uniprot.org/uniparc?query=${m[1]}`,
  parseAnnotations: parseAnnotationFieldsDefault,
}, {
  name: "MGnify",
  pattern: /^(MGYS\d+)(?:\.(\d+))?$/,
  toUrl: (actualId, m) => `https://www.ebi.ac.uk/metagenomics/studies/${m[1]}`,
  parseAnnotations: parseAnnotationFieldsDefault,
}]

function parseAnnotationFieldsDefault(actualId: string, desc: string): {
  annotations: Record<string, string | number>,
  annotationFields: TSequenceAnnotationFields,
} {
  const annotations: Record<string, string | number> = {}
  const annotationFields: TSequenceAnnotationFields = {}
  if (desc) {
    annotations.description = desc
    annotationFields.description = {
      name: "Description",
      string: 1,
      number: 0,
    }
  }
  return {
    annotations,
    annotationFields,
  }
}

function parseAnnotationFieldsSimple(actualId: string, desc: string): {
  annotations: {[key: string]: string | number},
  annotationFields: TSequenceAnnotationFields,
} {
  const annotationFields: TSequenceAnnotationFields = {}
  const annotations: {[key: string]: string | number} = {}

  const matches = Array.from(desc.matchAll(/([^\s]+)=(.+?)(?=\s+[^\s]+=|$)/g))
  let description = desc
  if (matches.length > 0) {
    description = desc.substring(0, matches[0].index)
  }
  
  if (description) {
    annotations.description = description
    annotationFields.description = {
      name: "Description",
      string: 1,
      number: 0,
    }
  }

  for (const m of matches) {
    const field = m[1]
    const valueString: string = m[2]
    const valueNumber = parseFloat(valueString)
    let fieldValue: string | number
    let number = 0, string = 0
    if (isNaN(valueNumber)) {
      string = 1
      fieldValue = valueString
    } else {
      number = 1
      fieldValue = valueNumber
    }

    annotations[field] = fieldValue
    annotationFields[field] = {
      name: formatFieldName(field), 
      string,
      number,
    }
  }

  return { annotations, annotationFields }
}

const UNIPROT_FIELD_NAMES: Record<string, string> = {
  "OS": "Organism",
  "OX": "Organism ID",
  "GN": "Gene",
  "PE": "Evidence",
  "SV": "Ver",
  "n": "Members",
  "Tax": "Taxon",
  "TaxID": "Taxon ID",
  "RepID": "Representative",
  "status": "Status",
}

const UNIPROT_PROTEIN_EXISTENCE: Record<string, string> = {
  1: "Protein",
  2: "Transcript",
  3: "Homology",
  4: "Predicted",
  5: "Uncertain",
}

function parseAnnotationFieldsFromUniProtDescription(actualId: string, desc: string): {
  annotations: {[key: string]: string | number},
  annotationFields: TSequenceAnnotationFields,
} {
  const { annotations, annotationFields } = parseAnnotationFieldsSimple(actualId, desc)
  for (const field of Object.keys(annotations)) {
    if (field === "PE") {
      annotations["PE"] = UNIPROT_PROTEIN_EXISTENCE[annotations["PE"]]
      annotationFields["PE"].string = 1
      annotationFields["PE"].number = 0
    }
    
    if (field in UNIPROT_FIELD_NAMES) {
      annotationFields[field].name = UNIPROT_FIELD_NAMES[field]
    }
  }
  return { annotations, annotationFields }
}

export function parseSequenceIdDescription(id: string, desc: string) {
  const m = id.match(/^([^/]*)\/(\d+)-(\d+)$/)
  let actualId: string
  let begin: number | undefined, end: number | undefined
  if (m) {
    actualId = m[1]
    begin = Number(m[2])
    end = Number(m[3])
  } else {
    actualId = id
  }

  const annotations = {
    id,
    __actualId__: actualId,
    __begin__: begin ?? 1,
    __end__: end ?? 0, 
    __links__: [] as {name: string, url: string}[],
  }

  const annotationFields: TSequenceAnnotationFields = {
    id: {
      name: "ID",
      string: 1,
      number: 0,
    }, 
    __actualId__: {
      name: "Actual ID",
      string: 1,
      number: 0,
    }, 
    __begin__: {
      name: "Begin",
      string: 0,
      number: 1,
    }, 
    __end__: {
      name: "End",
      string: 0,
      number: 1,
    }, 
    __links__: {
      name: "Links",
      string: 0,
      number: 0,
    }, 
  }

  let parserMatched = false
  for (const parser of SEQUENCE_ANNOTATION_PARSERS) {
    const m = actualId.match(parser.pattern)
    if (!m) {
      continue
    }

    parserMatched = true
    annotations.__links__.push({
      name: parser.name, 
      url: parser.toUrl(actualId, m)
    })

    const { annotations: _annotations, annotationFields: _annotationFields } = parser.parseAnnotations(actualId, desc)
    Object.assign(annotations, _annotations)
    Object.assign(annotationFields, _annotationFields)
  }

  if (!parserMatched) {
    const { annotations: _annotations, annotationFields: _annotationFields } = parseAnnotationFieldsSimple(actualId, desc)
    Object.assign(annotations, _annotations)
    Object.assign(annotationFields, _annotationFields)
  }

  return {
    annotations,
    annotationFields,
  }
}

