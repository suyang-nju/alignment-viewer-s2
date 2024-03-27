import type {
  TSequenceAnnotationFields,
} from './types'

export const PssmValuesArray = Int8Array
export const PssmIndicesArray = Uint8Array
export const PssmTalliesArray = Uint32Array

export const HIDDEN_ANNOTATION_FIELDS = [
  "__actualId__", 
  "__links__", 
  "sequence", 
  "__sequenceIndex__", 
  "__annotationFields__", 
  "__groupIndex__",
  "__formattedSequences__", 
  "$$minimap$$"
]

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

export const DEFAULT_GROUP_ANNOTATION_VALUES = {
  __groupIndex__: -1,
  __groupSize__: 1,
}

export const GAPS = "-."
export const GAP = GAPS[0]

export const ALIGNMENT_COLOR_MODES = ["With Background", "Letter Only"] as const

export const OVERVIEW_MODE_ZOOM = 5
export const SEQUENCE_LOGO_ROW_HEIGHT_RATIO = 3
export const SEQUENCE_LOGO_BAR_STACK_ZOOM = 10

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

export enum RENDERER_TYPES {
  // colCell
  COL_TEXT,
  COL_SEQUENCE_SERIES,
  COL_SEQUENCE,
  COL_MINIMAP,
  // dataCell
  MINIMAP_DUMMY,
  TEXT,
  NUMBER,
  // BOOLEAN,
  // COLORMAP,
  SEQUENCE_ID,
  SEQUENCE_SERIES,
  SEQUENCE,
  SEUENCE_LOGO,
  SEQUENCE_BAR,
  // HBAR,
}

export const SPECIAL_ROWS: Record<string, {
  label: string,
  height: number,
  renderer: RENDERER_TYPES,
  defaultVisible: boolean,
}> = {
  "$$reference$$": {
    label: "Reference",
    height: 2.5,
    renderer: RENDERER_TYPES.SEQUENCE,
    defaultVisible: true,
  }, 
  "$$consensus$$": {
    label: "Consensus",
    height: 1,
    renderer: RENDERER_TYPES.SEQUENCE,
    defaultVisible: true,
  }, 
  "$$sequence logo$$": {
    label: "Sequence Logo",
    height: SEQUENCE_LOGO_ROW_HEIGHT_RATIO,
    renderer: RENDERER_TYPES.SEUENCE_LOGO,
    defaultVisible: true,
  }, 
  "$$coverage$$": {
    label: "Coverage",
    height: 1.5,
    renderer: RENDERER_TYPES.SEQUENCE_BAR,
    defaultVisible: true,
  }, 
  "$$conservation$$": {
    label: "Conservation",
    height: 1.5,
    renderer: RENDERER_TYPES.SEQUENCE_BAR,
    defaultVisible: true,
  }, 
  "$$entropy$$": {
    label: "Entropy",
    height: 1.5,
    renderer: RENDERER_TYPES.SEQUENCE_BAR,
    defaultVisible: false,
  }, 
  "$$kl divergence$$": {
    label: "KL Divergence",
    height: 1.5,
    renderer: RENDERER_TYPES.SEQUENCE_BAR,
    defaultVisible: false,
  }, 
}
