import type { TAlignment, TAlignmentSortParams } from '../lib/Alignment'

import { expose } from 'threads/worker'
// const { expose } = require('threads/worker')

import { sortAlignment } from '../lib/Alignment'

function sort(alignment: TAlignment, sortBy: TAlignmentSortParams[]) {
  return sortAlignment(alignment, sortBy)
}

expose(sort)
