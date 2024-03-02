import { range } from 'lodash'
import getBlosum62Score from './blosum62'

export const AA1to3 = {
  A: 'Ala',
  C: 'Cys',
  D: 'Asp', 
  E: 'Glu', 
  F: 'Phe',
  G: 'Gly',
  H: 'His',
  I: 'Ile',
  K: 'Lys',
  L: 'Leu',
  M: 'Met',
  N: 'Asn',
  P: 'Pro',
  Q: 'Gln',
  R: 'Arg',
  S: 'Ser',
  T: 'Thr',
  U: 'SeCys',
  V: 'Val',
  W: 'Trp',
  Y: 'Tyr',
}

export const HIDDEN_ANNOTATION_FIELDS = [
  "__actualId__", 
  "__links__", 
  "sequence", 
  "__sequenceIndex__", 
  "__annotationFields__", 
  "__formattedSequences__", 
  "$$minimap$$"
]

export type TSequenceAnnotationFields = {
  [field: string]: {
    name: string,
    string: number,
    number: number,
  }
}

export const GROUP_ANNOTATION_FIELDS: TSequenceAnnotationFields = {
  __groupIndex__: {
    name: "Group Index",
    string: 0,
    number: 1,
  },
  __groupSize__: {
    name: "Group Size",
    string: 0,
    number: 1,
  },
}

const DEFAULT_GROUP_ANNOTATION_VALUES = {
  __groupIndex__: -1,
  __groupSize__: 0,
}

type TAnnotationParser = {
  pattern: RegExp, 
  name: string, 
  toUrl: (actualId: string, matches: RegExpMatchArray) => string,
  parseAnnotations: (actualId: string, desc: string) => { 
    annotations: {[key: string]: string | number},
    annotationFields: TSequenceAnnotationFields
  },
}

export type TAlignmentPositionsToStyle = "all" | "differentFromReference" | "sameAsReference" | "differentFromConsensus" | "sameAsConsensus"
export type TFormattedSequences = Record<TAlignmentPositionsToStyle, string>

type TBaseSequence = (typeof DEFAULT_GROUP_ANNOTATION_VALUES) & {
  id: string,
  sequence: string,
  __annotationFields__: TSequenceAnnotationFields,
  __sequenceIndex__: number | string,
  __actualId__: string,
  __begin__: number,
  __end__: number,
  __realLength__: number,
  __alignedLength__: number,
  __leftGapCount__: number,
  __internalGapCount__: number,
  __rightGapCount__: number,
  __links__: {name: string, url: string}[],
  __hammingDistanceToReference__: number,
  __hammingDistanceToConsensus__: number,
  __blosum62ScoreToReference__: number,
  __blosum62ScoreToConsensus__: number,
  // formattedSequences?: TFormattedSequences
}

export type TSequence = TBaseSequence & Record<string, string | number>

const PssmValuesArray = Int8Array
const PssmSortedIndicesArray = Uint8Array
const PssmTalliesArray = Uint32Array
export type TPssmValues = Int8Array
export type TPssmSortedIndices = Uint8Array
type TPssmTallies = Uint32Array
export type TPssm = {
  alphabet: string,
  values: TPssmValues,
  sortedIndices: TPssmSortedIndices,
  length: number,
  numSymbols: number,
}

export type TSequenceGroup = {
  members: number[],
  pssm: TPssm,
}

export type TAlignment = {
  name: string,
  uuid: string,
  alphabet: string,
  isNucleotde: boolean,
  length: number,
  depth: number,
  sequences: TSequence[],
  consensusSequence: TSequence,
  referenceSequenceIndex: number,
  referenceSequence: TSequence,
  annotationFields: TSequenceAnnotationFields,
  groupBy: string | undefined,
  groups: TSequenceGroup[],
  // --- per-position properties ---
  positionalCoverage: number[],
  pssm: TPssm,
  entropy: number[],
  maxEntropy: number,
  conservation: number[],
  klDivergence: number[],
  maxKlDivergence: number,
}

export type TAlignmentSortParams = {
  field: keyof TSequence, 
  order: "asc" | "desc"
}

function generateUUIDv4() {
  const x = (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11) as string;
  return x.replace(/[018]/g, function (c: string) {
    return (
      parseInt(c) ^
      (self.crypto.getRandomValues(new Uint8Array(1))[0] /*Math.floor(Math.random() * 256)*/ &
        (15 >> (parseInt(c) / 4)))
    ).toString(16);
  });
}

function assert(condition: boolean) {
  if (!condition) {
    throw Error("assertion failed")
  }
}

export const ALPHABET = "ACDEFGHIKLMNPQRSTVWY"
export const GAPS = "-."
export const GAP = GAPS[0]

const PARSERS: ((text: string) => TSequence[])[] = [
  parseFasta,
  parseStockholm,
]

function parseFasta(text: string): TSequence[] {
  const sequences: TSequence[] = []

  const trimmedText = text.trim()
  if (trimmedText.length === 0 || trimmedText[0] !== ">") {
    throw Error()
  }

  const records = trimmedText.split("\n>")
  records[0] = records[0].substring(1)
  let sequenceIndex = 0
  for (const rec of records) {
    const lines = rec.split(/[\r\n]+/)
    const sequenceString = lines.slice(1).join("").replace(/\s/g, "")
    
    let id: string, description: string
    const i = lines[0].search(/\s/)
    if (i === -1) {
      id = lines[0]
      description = ""
    } else {
      id = lines[0].slice(0, i)
      description = lines[0].slice(i + 1).trim()
    }
    
    sequences.push(createSequence(sequenceIndex, id, description, sequenceString))
    ++sequenceIndex
  }

  return sequences
}

function parseStockholm(text: string): TSequence[] {
  const sequences: TSequence[] = []

  const trimmedText = text.trim()
  if (trimmedText.length === 0 || trimmedText[0] !== ">") {
    throw Error()
  }

  return sequences
}

function detectAlphabet(sequences: TSequence[]) {
  return ALPHABET
}

function createSequence(sequenceIndex: number | string, id: string, desc: string, sequenceString: string): TSequence {
  const { 
    realLength: __realLength__, 
    alignedLength: __alignedLength__,
    leftGapCount: __leftGapCount__,
    internalGapCount: __internalGapCount__,
    rightGapCount: __rightGapCount__,
  } = calcSequenceLength(sequenceString)

  let {
    actualId: __actualId__, 
    begin: __begin__, 
    end: __end__, 
    links: __links__,
    annotations,
    annotationFields: __annotationFields__,
  } = parseSequenceIdDescription(id, desc)
  
  if (__begin__ === undefined) {
    __begin__ = 1
  }

  if (__end__ === undefined) {
    __end__ = __begin__ + __realLength__ - 1
  }

  __annotationFields__ = {
    id: {
      name: "ID",
      string: 1,
      number: 0,
    }, 
    ...__annotationFields__, 
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
    ...GROUP_ANNOTATION_FIELDS,
  }

  const result: TSequence = {
    sequence: sequenceString,
    id,
    ...annotations,
    __annotationFields__,
    __sequenceIndex__: sequenceIndex,
    __actualId__,
    __realLength__,
    __alignedLength__,
    __leftGapCount__,
    __internalGapCount__,
    __rightGapCount__,
    __begin__,
    __end__,
      __links__,
    // --- will be calculated in the context of alignment ---
    __hammingDistanceToReference__: -1,
    __hammingDistanceToConsensus__: -1,
    __blosum62ScoreToReference__: -1,
    __blosum62ScoreToConsensus__: -1,
    ...DEFAULT_GROUP_ANNOTATION_VALUES
  }

  return result
}

function calcSequenceLength(sequenceString: string) {
  let realLength = 0, gapCount = 0, leftGapCount = 0, internalGapCount = 0, rightGapCount = 0
  let internal = false
  for (let i = 0; i < sequenceString.length; ++i) {
    if (GAPS.includes(sequenceString[i])) {
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
    realLength, 
    alignedLength,
    leftGapCount,
    internalGapCount,
    rightGapCount,
  }
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

export function formatFieldName(fieldName: string): string {
  let formattedFieldName: string = fieldName.replaceAll("_", " ").trim()
  formattedFieldName = formattedFieldName.charAt(0).toUpperCase() + formattedFieldName.slice(1)
  formattedFieldName = formattedFieldName.replace(/([a-z])([A-Z])/g, '$1 $2');
  formattedFieldName = formattedFieldName.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
  return formattedFieldName
}

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
    const fieldName = UNIPROT_FIELD_NAMES[field] ?? formatFieldName(field)
    let valueString: string = m[2]
    if (field === "PE") {
      valueString = UNIPROT_PROTEIN_EXISTENCE[valueString]
    }
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
      name: fieldName, 
      string,
      number,
    }
  }

  return { annotations, annotationFields }
}

function parseSequenceIdDescription(id: string, desc: string) {
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

  const links: {name: string, url: string}[] = []
  let annotations: {[key: string]: string | number} = {}
  let annotationFields: TSequenceAnnotationFields = {}
  let parserMatched = false
  for (const parser of SEQUENCE_ANNOTATION_PARSERS) {
    const m = actualId.match(parser.pattern)
    if (!m) {
      continue
    }

    parserMatched = true
    links.push({
      name: parser.name, 
      url: parser.toUrl(actualId, m)
    })

    ;({ annotations, annotationFields } = parser.parseAnnotations(actualId, desc))
  }

  if (!parserMatched) {
    ({ annotations, annotationFields } = parseAnnotationFieldsDefault(actualId, desc))
  }

  return {
    actualId,
    begin,
    end,
    links,
    annotations,
    annotationFields,
  }
}

export function createAlingmentFromText(name: string, text: string): TAlignment | undefined {
  let sequences: TSequence[] = []
  for (const parser of PARSERS) {
    try {
      sequences = parser(text)
      if (sequences.length > 0) {
        break
      }
    } catch(e) {}
  }

  if (sequences.length === 0) {
    return undefined
  }

  return createAlingmentFromSequences(name, sequences)
}

export function createAlingmentFromSequences(name: string, sequences: TSequence[]): TAlignment {
  const referenceSequenceIndex = 0
  const referenceSequence = sequences[referenceSequenceIndex]

  const {
    length, 
    depth, 
    alphabet, 
    positionalCoverage, 
    pssm, 
    consensusSequence, 
    entropy, 
    maxEntropy,
    conservation, 
    klDivergence, 
    maxKlDivergence,
  } = calcAlignmentStats(sequences)

  sequences = calculateDistances(sequences, referenceSequence, consensusSequence)

  const annotationFields: TSequenceAnnotationFields = {}
  for (const rec of sequences) {
    for (const field of Object.keys(rec.__annotationFields__)) {
      if (Object.prototype.hasOwnProperty.call(annotationFields, field)) {
        annotationFields[field].name = rec.__annotationFields__[field].name
        annotationFields[field].string += rec.__annotationFields__[field].string
        annotationFields[field].number += rec.__annotationFields__[field].number
      } else {
        annotationFields[field] = { ...rec.__annotationFields__[field] }
      }
    }
  }

  return {
    name,
    uuid: generateUUIDv4(),
    alphabet,
    isNucleotde: false,
    length,
    depth,
    sequences,
    consensusSequence,
    referenceSequenceIndex,
    referenceSequence,
    annotationFields,
    positionalCoverage,
    pssm,
    entropy,
    maxEntropy,
    conservation,
    klDivergence,
    maxKlDivergence,
    groupBy: undefined,
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

      if (field.startsWith("__") && field.endsWith("__")) {
        derivedFields.push(field)
      } else {
        importedFields.push(field)
      }
    }  
  }
  return { importedFields, derivedFields }
}

function calcPSSM(sequences: TSequence[], length: number, alphabet: string): [TPssm, TPssmTallies] {
  const numSymbols = alphabet.length + 1
  const pssmValues = new PssmValuesArray(numSymbols * length)
  const pssmSortedIndices = new PssmSortedIndicesArray(pssmValues.length)
  const tallies = new PssmTalliesArray(pssmValues.length)
  let k = 0

  for (const rec of sequences) {
    k = 0
    for (let i = 0; i < rec.sequence.length; ++i) {
      let a = alphabet.indexOf(rec.sequence[i].toUpperCase())
      if (a < 0) { // not in alphabet: gap, etc 
        a = alphabet.length
      }
      ++tallies[k + a]
      k += numSymbols
    }
  }

  const argsortHelperValues = new Uint32Array(numSymbols)
  const argsortHelperIndices = new Uint32Array(numSymbols)
  const compareFn = (a: number, b: number) => (argsortHelperValues[a] - argsortHelperValues[b]) // ascending
  k = 0
  for (let i = 0; i < length; ++i) {
    for (let j = 0; j <= alphabet.length; ++j) {
      argsortHelperIndices[j] = j
      argsortHelperValues[j] = tallies[k + j]
    }
    argsortHelperIndices.sort(compareFn)
    pssmSortedIndices.set(argsortHelperIndices, k)
    k += numSymbols
  }

  const depth = sequences.length
  for (let i = 0; i < tallies.length; ++i) {
    // special-case true 0 as -1 because < 0.5% will be rounded to 0
    pssmValues[i] = tallies[i] === 0 ? -1 : Math.round(tallies[i] / depth * 100)
  }

  return [
    {
      alphabet,
      values: pssmValues, 
      sortedIndices: pssmSortedIndices,
      length,
      numSymbols,
    }, 
    tallies
  ]
}

function calcAlignmentStats(sequences: TSequence[]) {
  const depth = sequences.length
  let length = sequences[0].sequence.length
  for (let i = 1; i < depth; ++i) {
    if (sequences[i].sequence.length > length) {
      length = sequences[i].sequence.length
    }
  }

  const alphabet = detectAlphabet(sequences)
  const [ pssm, tallies ] = calcPSSM(sequences, length, alphabet)
  const { numSymbols } = pssm
  let k = 0  

  const q = new PssmTalliesArray(numSymbols) // for KL divergence
  k = 0  
  for (let i = 0; i < length; ++i) {
    for (let j = 0; j <= alphabet.length; ++j) {
      q[j] += tallies[k + j]
    }
    k += numSymbols
  }


  const positionalCoverage = new Array<number>(length)
  const entropy = new Array<number>(length)
  const klDivergence = new Array<number>(length)
  let maxEntropy = 0
  let maxKlDivergence = 0
  k = 0
  for (let i = 0; i < length; ++i) {
    positionalCoverage[i] = 1.0 - (tallies[k + alphabet.length] / depth)
    
    entropy[i] = 0
    klDivergence[i] = 0
    for (let j = 0; j <= alphabet.length; ++j) {
      if (tallies[k + j] > 0) {
        const p = tallies[k + j] / depth
        entropy[i] -= p * Math.log2(p)
        if (q[j] > 0) {
          klDivergence[i] += p * Math.log2(p / (q[j] / depth / length))
        }
      }
    }

    if (maxEntropy < entropy[i]) {
      maxEntropy = entropy[i]
    }

    if (maxKlDivergence < klDivergence[i]) {
      maxKlDivergence = klDivergence[i]
    }

    k += numSymbols
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
  k = alphabet.length
  for (let i = 0; i < length; ++i) {
    // TODO: what if tied?
    const j = pssm.sortedIndices[k]
    consensus[i] = (j == alphabet.length) ? GAP : alphabet[j]
    k += numSymbols
  }
  const consensusSequence = createSequence("$$consensus$$", "consensus", "consensus", consensus.join(""))

  return {
    length, 
    depth, 
    alphabet, 
    positionalCoverage, 
    pssm, 
    consensusSequence, 
    entropy, 
    maxEntropy,
    conservation, 
    klDivergence, 
    maxKlDivergence,
  }
}

function calculateDistances(
  sequences: TSequence[], 
  referenceSequence: TSequence,
  consensusSequence: TSequence,
): TSequence[] {
  // Normally these should be immutable updates (create new copies of each rec),
  // but because this function will be called in a worker thread, a new copy of
  // everything will be made when returning to the main thread
  for (const rec of sequences) {
    rec.__hammingDistanceToReference__ = hammingDistance(rec, referenceSequence)
    rec.__hammingDistanceToConsensus__ = hammingDistance(rec, consensusSequence)
    rec.__blosum62ScoreToReference__ = sequenceBlosum62Score(rec, referenceSequence)
    rec.__blosum62ScoreToConsensus__ = sequenceBlosum62Score(rec, consensusSequence)
  }
  return sequences
}

function hammingDistance(sequence1: TSequence, sequence2: TSequence): number {
  const leftGapsCount = Math.min(sequence1.__leftGapCount__, sequence2.__leftGapCount__)
  const len1 = sequence1.__leftGapCount__ + sequence1.__alignedLength__
  const len2 = sequence2.__leftGapCount__ + sequence2.__alignedLength__
  let sequenceString1: string, sequenceString2: string, distance: number
  //if they are not the same length, those extra positions in one
  //sequence count as differences to the other sequence
  if (len1 < len2) {
    sequenceString1 = sequence1.sequence.substring(leftGapsCount, len1)
    sequenceString2 = sequence2.sequence.substring(leftGapsCount, len1)
    distance = len2 - len1
  } else {
    sequenceString1 = sequence1.sequence.substring(leftGapsCount, len2)
    sequenceString2 = sequence2.sequence.substring(leftGapsCount, len2)
    distance = len1 - len2
  }
  sequenceString1 = sequenceString1.toUpperCase().replaceAll(".", "-")
  sequenceString2 = sequenceString2.toUpperCase().replaceAll(".", "-")

  for (let i = 0; i < sequenceString1.length; i++) {
    if (sequenceString1[i] !== sequenceString2[i]) {
      ++distance
    }
  }
  return distance
}

function sequenceBlosum62Score(sequence1: TSequence, sequence2: TSequence): number {
  const leftGapsCount = Math.min(sequence1.__leftGapCount__, sequence2.__leftGapCount__)
  const len1 = sequence1.__leftGapCount__ + sequence1.__alignedLength__
  const len2 = sequence2.__leftGapCount__ + sequence2.__alignedLength__
  const len = Math.min(len1, len2)

  let score = 0
  for (let i = leftGapsCount; i < len; ++i) {
    score += getBlosum62Score(sequence1.sequence[i], sequence2.sequence[i])
  }
  return score
}

export function formatSequence(
  source: string, 
  style: TAlignmentPositionsToStyle, 
  reference: string, 
  consensus: string,
  caseSensitive = false
): boolean[] {
  const result = new Array<boolean>(source.length)
  for (let i = 0; i < result.length; ++i) {
    result[i] = true
  }

  if (style === "all") {
    return result
  }

  const target = caseSensitive ? source : source.toUpperCase()
  let comparedTo: string, method: "same" | "different"
  switch (style) {
    case "sameAsReference":
      comparedTo = reference
      method = "same"
      break
    case "differentFromReference":
      comparedTo = reference
      method = "different"
      break
    case "sameAsConsensus":
      comparedTo = consensus
      method = "same"
      break
    case "differentFromConsensus":
      comparedTo = consensus
      method = "different"
      break
  }

  if (!caseSensitive) {
    comparedTo = comparedTo.toUpperCase()
  }

  if (method === "same") {
    for (let i = 0; i < source.length; ++i) {
      if (target[i] !== comparedTo[i]) {
        result[i] = false
      }
    }
  } else { // "different"
    for (let i = 0; i < source.length; ++i) {
      if (target[i] === comparedTo[i]) {
        result[i] = false
      }
    }
  }

  return result
}

export function sortAlignment(alignment: TAlignment, sortBy?: TAlignmentSortParams[]): number[] {
  let sortedIndices: number[]
  if (!sortBy || (sortBy.length === 0)) {
    if (alignment.groupBy === undefined) {
      sortedIndices = range(0, alignment.depth)
    } else { // sort by group index
      sortedIndices = []
      for (const group of alignment.groups) {
        for (const sequenceIndex of group.members) {
          sortedIndices.push(sequenceIndex)
        }
      }
    }
    return sortedIndices
  }

  let actualSortBy: TAlignmentSortParams[]
  if (alignment.groupBy) {
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
      let value_a = alignment.sequences[a][by.field]
      if (value_a === undefined) {
        value_a = ""
      }

      let value_b = alignment.sequences[b][by.field]
      if (value_b === undefined) {
        value_b = ""
      }

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
  
  sortedIndices = range(0, alignment.depth)
  sortedIndices.sort(cmp)
  return sortedIndices
}

export function setReferenceSequence(alignment: TAlignment, referenceSequenceIndex: number): TAlignment {
  if ((referenceSequenceIndex >= 0) && (referenceSequenceIndex < alignment.depth)) {
    alignment.referenceSequenceIndex = referenceSequenceIndex
    alignment.referenceSequence = alignment.sequences[referenceSequenceIndex]
    alignment.sequences = calculateDistances(
      alignment.sequences,
      alignment.referenceSequence,
      alignment.consensusSequence,
    )  
  }
  return alignment
}

export function groupByField(alignment: TAlignment, groupBy?: string): TAlignment {
  alignment.groupBy = groupBy
  alignment.groups = []
  if (groupBy === undefined) {
    for (const rec of alignment.sequences) {
      for (const [k, v] of Object.entries(DEFAULT_GROUP_ANNOTATION_VALUES)) {
        rec[k] = v
      }      
    }
    return alignment
  }

  const groups = new Map<string | number, number[]>()
  for (const rec of alignment.sequences) {
    const groupKey = rec[groupBy]
    if (groups.has(groupKey)) {
      groups.get(groupKey)?.push(rec.__sequenceIndex__ as number)
    } else {
      groups.set(groupKey, [rec.__sequenceIndex__ as number])
    }
  }

  let groupIndex = -1
  const sequencesForPssm: TSequence[] = []
  for (const members of groups.values()) {
    ++groupIndex
    for (const sequenceIndex of members) {
      alignment.sequences[sequenceIndex].__groupIndex__ = groupIndex
      alignment.sequences[sequenceIndex].__groupSize__ = members.length
      sequencesForPssm.push(alignment.sequences[sequenceIndex])
    }
    const [ pssm ] = calcPSSM(sequencesForPssm, alignment.length, alignment.alphabet)
    alignment.groups.push({ members, pssm })
    sequencesForPssm.length = 0
  }

  return alignment
}
