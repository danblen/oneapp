import {AppBskyGraphDefs} from '@atproto/api'

export {
  /**
   * Renamed to clarify source of this util, but directly aliases the original.
   * {@link AppBskyGraphDefs.isStarterPackViewBasic}
   */
  isStarterPackViewBasic as isBasicView,
  /**
   * Renamed to clarify source of this util, but directly aliases the original.
   * {@link AppBskyGraphDefs.isStarterPackView}
   */
  isStarterPackView as isView,
} from '@atproto/api/dist/client/types/app/bsky/graph/defs'

/**
 * Matches any starter pack view exported by our SDK
 */
export type AnyStarterPackView =
  | AppBskyGraphDefs.StarterPackViewBasic
  | AppBskyGraphDefs.StarterPackView