import type { S2CellType, } from '@antv/s2'
import type { TConstructor } from './types'

import { RENDERER_TYPES } from './constants'
import {
  SequenceColCell, TextColCell, MinimapColCell, SequenceSeriesColCell, 
  SequenceDataCell, BarDataCell, SequenceSeriesCell, TextDataCell, 
  NumberDataCell, SequenceIdDataCell, LogoDataCell, DummyMinimapDataCell, 
} from './cell'

export const RENDERERS: Record<RENDERER_TYPES, TConstructor<S2CellType>> = {
  // colCell
  [RENDERER_TYPES.COL_TEXT]: TextColCell,
  [RENDERER_TYPES.COL_SEQUENCE_SERIES]: SequenceSeriesColCell,
  [RENDERER_TYPES.COL_SEQUENCE]: SequenceColCell,
  [RENDERER_TYPES.COL_MINIMAP]: MinimapColCell,
  // dataCell
  [RENDERER_TYPES.MINIMAP_DUMMY]: DummyMinimapDataCell,
  [RENDERER_TYPES.TEXT]: TextDataCell,
  [RENDERER_TYPES.NUMBER]: NumberDataCell,
  // [RENDERER_TYPES.BOOLEAN]: ,
  // [RENDERER_TYPES.COLORMAP]: ,
  [RENDERER_TYPES.SEQUENCE_SERIES]: SequenceSeriesCell,
  [RENDERER_TYPES.SEQUENCE_ID]: SequenceIdDataCell,
  [RENDERER_TYPES.SEQUENCE]: SequenceDataCell,
  [RENDERER_TYPES.SEUENCE_LOGO]: LogoDataCell,
  [RENDERER_TYPES.SEQUENCE_BAR]: BarDataCell,
  // [RENDERER_TYPES.HBAR]: ,
}
