import type {
  TSequenceAnnotations,
  TSequenceAnnotationFields,
  TSequenceRecord,
  TAlignmentPositionalAnnotations,
} from './types'

import {
  parseSequenceIdDescription,
  calcSequenceLength,
} from './sequence'
import { formatFieldName } from './utils'

import { DefaultMap } from './utils'

const GS_FIELD_NAMES: Record<string, string> = {
  AC: "Accession",
  DE: "Description",
  DR: "Database",
  OS: "Organism",
  OC: "Organism Classification",
  LO: "Look",
}

export function parseStockholm(text: string): {
  sequenceRecords: TSequenceRecord[],
  positionalAnnotations: Partial<TAlignmentPositionalAnnotations>,
} {
  const sequenceLines = new DefaultMap<string, string[]>(Array)

  // Generic per-File annotation, free text
  const GF = new DefaultMap<string, string[]>(Array)

  // Generic per-Column annotation, exactly 1 char per column
  const GC = new DefaultMap<string, string[]>(Array)

  const factory = () => new DefaultMap<string, string[]>(Array)

  // Generic per-Sequence annotation, free text
  const GS = new DefaultMap<string, DefaultMap<string, string[]>>(factory)

  // Generic per-Residue annotation, exactly 1 char per residue
  const GR = new DefaultMap<string, DefaultMap<string, string[]>>(factory)

  const lines = text.split("\n")
  let match: RegExpMatchArray | null
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i].trim()
    if ((i === 0) && (line !== "# STOCKHOLM 1.0")) {
      throw Error()
    }

    if (line === "//") {
      break
    }

    if (line[0] !== "#") {
      match = line.match(/(\S+)\s+(\S+)/)
      if (match) {
        sequenceLines.get(match[1]).push(match[2])
      }
      continue
    }

    match = line.match(/#=GF\s+(\S+)\s+(.*\S)/)
    if (match) {
      GF.get(match[1]).push(match[2])
      continue
    }

    match = line.match(/#=GC\s+(\S+)\s+(.*\S)/)
    if (match) {
      GC.get(match[1]).push(match[2])
      continue
    }

    match = line.match(/#=GS\s+(\S+)\s+(\S+)\s+(.*\S)/)
    if (match) {
      GS.get(match[1]).get(match[2]).push(match[3])
      continue
    }
    
    match = line.match(/#=GR\s+(\S+)\s+(\S+)\s+(.*\S)/)
    if (match) {
      GR.get(match[1]).get(match[2]).push(match[3])
      continue
    }
  }

  const sequenceRecords: TSequenceRecord[] = []
  let sequenceIndex = 0
  for (const sequenceId of sequenceLines.keys()) {
    sequenceRecords.push(createSequenceRecord(
      sequenceIndex,
      sequenceId, 
      sequenceLines.get(sequenceId), 
      GS.get(sequenceId), 
      GR.get(sequenceId),
    ))
    ++sequenceIndex
  }

  return {
    sequenceRecords,
    positionalAnnotations: {},
  }
}

function createSequenceRecord(
  sequenceIndex: number,
  sequenceId: string,
  sequenceLines: string[], 
  GS: Map<string, string[]>,
  GR: Map<string, string[]>,
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
    
    let desc = ""
    if (GS.has("DE")) {
      desc = GS.get("DE")!.join("")
      GS.delete("DE")
    }

    let _annotations
    let _annotationFields
    
    ;({
      annotations: _annotations,
      annotationFields: _annotationFields,
    } = parseSequenceIdDescription(sequenceId, desc))
    Object.assign(annotations, _annotations)
    Object.assign(__annotationFields__, _annotationFields)

    const sequence = sequenceLines.join("")
    ;({
      annotations: _annotations,
      annotationFields: _annotationFields,
    } = calcSequenceLength(sequence))
    Object.assign(annotations, _annotations)
    Object.assign(__annotationFields__, _annotationFields)
    if (annotations.__end__ === 0) {
      annotations.__end__ = annotations.__begin__ + annotations.__realLength__ - 1
    }
    
    for (const [field, lines] of GS.entries()) {
      const valueString = lines.join(" ")
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
      __annotationFields__[field] = {
        name: GS_FIELD_NAMES[field] ?? formatFieldName(field), 
        string,
        number,
      }
    }
    
  return { sequence, annotations, __annotationFields__}
}
  