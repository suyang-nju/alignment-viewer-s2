import type { TAlignment, TAlignmentSortParams } from '../lib/alignment'

import { expose } from 'threads/worker'
// const { expose } = require('threads/worker')

import { sortAlignment } from '../lib/alignment'

function sort(alignment: TAlignment, sortBy: TAlignmentSortParams[]) {
  return sortAlignment(alignment, sortBy)
}

expose(sort)
