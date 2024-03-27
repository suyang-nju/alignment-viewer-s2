import type {
  TSequenceAnnotations,
  TSequenceAnnotationFields,
  TSequenceRecord,
  TAlignmentPositionalAnnotations,
} from './types'

import { parseSequenceIdDescription, calcSequenceLength } from './sequence'

export function parseFasta(text: string): {
  sequenceRecords: TSequenceRecord[],
  positionalAnnotations: Partial<TAlignmentPositionalAnnotations>,
} {
  if (text[0] !== ">") {
    throw Error()
  }

  const sequenceRecords: TSequenceRecord[] = []
  const rawRecords = text.split("\n>")
  rawRecords[0] = rawRecords[0].substring(1)
  let sequenceIndex = 0
  for (const rec of rawRecords) {
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
    
    sequenceRecords.push(createSequenceRecord(sequenceIndex, id, description, sequenceString))
    ++sequenceIndex
  }

  return {
    sequenceRecords,
    positionalAnnotations: {},
  }
}

export function createSequenceRecord(
  sequenceIndex: number, 
  id: string, 
  desc: string, 
  sequenceString: string
): TSequenceRecord {
  const annotations = {
    __sequenceIndex__: sequenceIndex,
  } as TSequenceAnnotations

  const __annotationFields__ = {
    __sequenceIndex__: {
      name: "Sequence Index",
      string: 0,
      number: 0,
    },
  } as TSequenceAnnotationFields

  let _annotations
  let _annotationFields
  
  ;({
    annotations: _annotations,
    annotationFields: _annotationFields,
  } = parseSequenceIdDescription(id, desc))
  Object.assign(annotations, _annotations)
  Object.assign(__annotationFields__, _annotationFields)

  ;({ 
    annotations: _annotations,
    annotationFields: _annotationFields,
  } = calcSequenceLength(sequenceString))
  Object.assign(annotations, _annotations)
  Object.assign(__annotationFields__, _annotationFields)
  if (annotations.__end__ === 0) {
    annotations.__end__ = annotations.__begin__ + annotations.__realLength__ - 1
  }
  
  return {
    sequence: sequenceString,
    annotations,
    __annotationFields__,
  }
}



