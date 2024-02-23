import React from 'react'
import {View} from 'react-native'
import {useFocusEffect} from '@react-navigation/native'
import {ComAtprotoLabelDefs, LabelPreference, LABELS} from '@atproto/api'
import {Trans, msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {LabelGroupDefinition, AppBskyModerationDefs} from '@atproto/api'
import {useSafeAreaFrame} from 'react-native-safe-area-context'

import {NativeStackScreenProps, CommonNavigatorParams} from '#/lib/routes/types'
import {CenteredView} from '#/view/com/util/Views'
import {ViewHeader} from '#/view/com/util/ViewHeader'
import {useAnalytics} from 'lib/analytics/analytics'
import {useSetMinimalShellMode} from '#/state/shell'
import {useSession} from '#/state/session'
import {
  useProfileQuery,
  useProfileUpdateMutation,
} from '#/state/queries/profile'
import {ScrollView} from '#/view/com/util/Views'
import {logger} from '#/logger'

import {
  UsePreferencesQueryResponse,
  usePreferencesQuery,
  useSetContentLabelMutation,
  usePreferencesSetAdultContentMutation,
} from '#/state/queries/preferences'
import {useModServicesDetailedInfoQuery} from '#/state/queries/modservice'
import {useModServiceLabelGroupEnableMutation} from '#/state/queries/modservice'

import {useTheme, atoms as a, useBreakpoints, native} from '#/alf'
import {Divider} from '#/components/Divider'
import {CircleBanSign_Stroke2_Corner0_Rounded as CircleBanSign} from '#/components/icons/CircleBanSign'
import {Group3_Stroke2_Corner0_Rounded as Group} from '#/components/icons/Group'
import {Person_Stroke2_Corner0_Rounded as Person} from '#/components/icons/Person'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRight} from '#/components/icons/Chevron'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDown} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import * as Toggle from '#/components/forms/Toggle'
import * as ToggleButton from '#/components/forms/ToggleButton'
import {InlineLink, Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {useLabelGroupStrings} from '#/lib/moderation/useLabelGroupStrings'
import * as Dialog from '#/components/Dialog'
import {Button} from '#/components/Button'
import {
  getModerationServiceTitle,
  useConfigurableLabelGroups,
  getLabelGroupToLabelerMap,
} from '#/lib/moderation'
import * as ModerationServiceCard from '#/components/ModerationServiceCard'

import {
  SettingsDialog,
  SettingsDialogProps,
} from '#/screens/Moderation/SettingsDialog'

function ErrorState({error}: {error: string}) {
  const t = useTheme()
  return (
    <View style={[a.p_xl]}>
      <Text
        style={[
          a.text_md,
          a.leading_normal,
          a.pb_md,
          t.atoms.text_contrast_medium,
        ]}>
        <Trans>
          Hmmmm, it seems we're having trouble loading this data. See below for
          more details. If this issue persists, please contact us.
        </Trans>
      </Text>
      <View
        style={[
          a.relative,
          a.py_md,
          a.px_lg,
          a.rounded_md,
          a.mb_2xl,
          t.atoms.bg_contrast_25,
        ]}>
        <Text style={[a.text_md, a.leading_normal]}>{error}</Text>
      </View>
    </View>
  )
}

export function ModerationScreen(
  _props: NativeStackScreenProps<CommonNavigatorParams, 'Moderation'>,
) {
  const t = useTheme()
  const {_} = useLingui()
  const {
    isLoading: isPreferencesLoading,
    error: preferencesError,
    data: preferences,
  } = usePreferencesQuery()
  const {
    isLoading: isModServicesLoading,
    data: modservices,
    error: modservicesError,
  } = useModServicesDetailedInfoQuery({
    dids: preferences ? preferences.moderationOpts.mods.map(m => m.did) : [],
  })
  const {gtMobile} = useBreakpoints()
  const {height} = useSafeAreaFrame()

  const isLoading = isPreferencesLoading || isModServicesLoading
  const error = preferencesError || modservicesError

  return (
    <CenteredView
      testID="moderationScreen"
      style={[
        t.atoms.border_contrast_low,
        t.atoms.bg,
        {minHeight: height},
        ...(gtMobile ? [a.border_l, a.border_r] : []),
      ]}>
      <ViewHeader title={_(msg`Moderation`)} showOnDesktop />

      {isLoading ? (
        <View style={[a.w_full, a.align_center, a.pt_2xl]}>
          <Loader size="xl" fill={t.atoms.text.color} />
        </View>
      ) : error || !(preferences && modservices) ? (
        <ErrorState
          error={
            preferencesError?.toString() ||
            _(msg`Something went wrong, please try again.`)
          }
        />
      ) : (
        <ModerationScreenInner
          preferences={preferences}
          modservices={modservices}
        />
      )}
    </CenteredView>
  )
}

export function ModerationScreenInner({
  preferences,
  modservices,
}: {
  preferences: UsePreferencesQueryResponse
  modservices: AppBskyModerationDefs.ModServiceViewDetailed[]
}) {
  const t = useTheme()
  const setMinimalShellMode = useSetMinimalShellMode()
  const {screen} = useAnalytics()
  const {gtMobile} = useBreakpoints()
  const modSettingsDialogControl = Dialog.useDialogControl()
  const [settingsDialogProps, setSettingsDialogProps] =
    React.useState<SettingsDialogProps>({
      // prefill with valid value to appease TS
      labelGroup: 'intolerance',
      modservices: [],
    })
  const groups = useConfigurableLabelGroups()
  const labelGroupToLabelerMap = React.useMemo(() => {
    return getLabelGroupToLabelerMap(modservices)
  }, [modservices])

  useFocusEffect(
    React.useCallback(() => {
      screen('Moderation')
      setMinimalShellMode(false)
    }, [screen, setMinimalShellMode]),
  )

  const openModSettingsDialog = React.useCallback(
    ({labelGroup, modservices}: Omit<SettingsDialogProps, 'onComplete'>) => {
      setSettingsDialogProps({
        labelGroup,
        modservices,
      })
      modSettingsDialogControl.open()
    },
    [modSettingsDialogControl],
  )

  const {mutateAsync: setAdultContentPref, variables: optimisticAdultContent} =
    usePreferencesSetAdultContentMutation()
  const adultContentEnabled = !!(
    (optimisticAdultContent && optimisticAdultContent.enabled) ||
    (!optimisticAdultContent && preferences.moderationOpts.adultContentEnabled)
  )

  const onToggleAdultContentEnabled = React.useCallback(
    async (selected: boolean) => {
      try {
        await setAdultContentPref({
          enabled: selected,
        })
      } catch (e) {
        // TODO
        console.error(e)
      }
    },
    [setAdultContentPref],
  )

  return (
    <View>
      <Dialog.Outer control={modSettingsDialogControl}>
        <Dialog.Handle />
        <SettingsDialog {...settingsDialogProps} preferences={preferences} />
      </Dialog.Outer>

      <ScrollView
        contentContainerStyle={[
          a.border_0,
          a.pt_2xl,
          a.px_lg,
          gtMobile && a.px_2xl,
        ]}>
        <Text
          style={[a.text_md, a.font_bold, a.pb_md, t.atoms.text_contrast_high]}>
          <Trans>Moderation tools</Trans>
        </Text>

        <View
          style={[
            a.w_full,
            a.rounded_md,
            a.overflow_hidden,
            t.atoms.bg_contrast_25,
          ]}>
          <Link
            testID="moderationlistsBtn"
            style={[
              a.flex_row,
              a.align_center,
              a.justify_between,
              a.p_lg,
              a.gap_sm,
            ]}
            to="/moderation/modlists">
            <View style={[a.flex_row, a.align_center, a.gap_md]}>
              <Group size="md" style={[t.atoms.text_contrast_medium]} />
              <Text style={[a.text_md]}>
                <Trans>Moderation lists</Trans>
              </Text>
            </View>
            <ChevronRight
              size="sm"
              style={[t.atoms.text_contrast_low, a.self_end]}
            />
          </Link>
          <Divider />
          <Link
            testID="mutedAccountsBtn"
            style={[
              a.flex_row,
              a.align_center,
              a.justify_between,
              a.p_lg,
              a.gap_sm,
            ]}
            to="/moderation/muted-accounts">
            <View style={[a.flex_row, a.align_center, a.gap_md]}>
              <Person size="md" style={[t.atoms.text_contrast_medium]} />
              <Text style={[a.text_md]}>
                <Trans>Muted accounts</Trans>
              </Text>
            </View>
            <ChevronRight
              size="sm"
              style={[t.atoms.text_contrast_low, a.self_end]}
            />
          </Link>
          <Divider />
          <Link
            testID="blockedAccountsBtn"
            style={[
              a.flex_row,
              a.align_center,
              a.justify_between,
              a.p_lg,
              a.gap_sm,
            ]}
            to="/moderation/blocked-accounts">
            <View style={[a.flex_row, a.align_center, a.gap_md]}>
              <CircleBanSign size="md" style={[t.atoms.text_contrast_medium]} />
              <Text style={[a.text_md]}>
                <Trans>Blocked accounts</Trans>
              </Text>
            </View>
            <ChevronRight
              size="sm"
              style={[t.atoms.text_contrast_low, a.self_end]}
            />
          </Link>
        </View>

        <Text
          style={[
            a.pt_2xl,
            a.pb_md,
            a.text_md,
            a.font_bold,
            t.atoms.text_contrast_high,
          ]}>
          <Trans>Content filters</Trans>
        </Text>
        <View
          style={[
            a.w_full,
            a.rounded_md,
            a.overflow_hidden,
            t.atoms.bg_contrast_25,
          ]}>
          <View
            style={[a.pt_lg, a.pb_md, a.px_lg, a.flex_row, a.justify_between]}>
            <Text
              style={[a.text_md, a.font_semibold, t.atoms.text_contrast_high]}>
              <Trans>Enable adult content</Trans>
            </Text>
            <Toggle.Item
              label={'Toggle adult content'}
              name="adultContent"
              value={adultContentEnabled}
              onChange={onToggleAdultContentEnabled}>
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <Text style={[t.atoms.text_contrast_medium]}>
                  {adultContentEnabled ? (
                    <Trans>Enabled</Trans>
                  ) : (
                    <Trans>Disabled</Trans>
                  )}
                </Text>
                <Toggle.Switch />
              </View>
            </Toggle.Item>
          </View>
          {adultContentEnabled && (
            <>
              <Divider />
              <LabelGroup
                labelGroup={groups.find(g => g.id === 'porn')!.id}
                labelers={[]}
                preferences={preferences}
                openModSettingsDialog={openModSettingsDialog}
              />
              <Divider />
              <LabelGroup
                labelGroup={groups.find(g => g.id === 'suggestive')!.id}
                labelers={[]}
                preferences={preferences}
                openModSettingsDialog={openModSettingsDialog}
              />
              <Divider />
              <LabelGroup
                labelGroup={groups.find(g => g.id === 'nudity')!.id}
                labelers={[]}
                preferences={preferences}
                openModSettingsDialog={openModSettingsDialog}
              />
              <Divider />
              <LabelGroup
                labelGroup={groups.find(g => g.id === 'violence')!.id}
                labelers={[]}
                preferences={preferences}
                openModSettingsDialog={openModSettingsDialog}
              />
            </>
          )}
          <Divider />
          <View
            style={[a.pt_lg, a.pb_md, a.px_lg, a.flex_row, a.justify_between]}>
            <View style={[a.flex_wrap, a.flex_1]}>
              <Text
                style={[
                  a.text_md,
                  a.font_semibold,
                  t.atoms.text_contrast_high,
                  a.pb_xs,
                ]}>
                <Trans>Hide posts by bots</Trans>
              </Text>
              <Text style={[t.atoms.text_contrast_medium]}>
                <Trans>Bots are automated users which follow the rules.</Trans>
              </Text>
            </View>
            <Toggle.Item
              label={'Toggle hiding posts by bots'}
              name="hideBots"
              value={false}
              onChange={undefined}>
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <Text style={[t.atoms.text_contrast_medium]}>
                  {false ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>}
                </Text>
                <Toggle.Switch />
              </View>
            </Toggle.Item>
          </View>
        </View>

        <Text
          style={[
            a.text_md,
            a.font_bold,
            a.pt_2xl,
            a.pb_md,
            t.atoms.text_contrast_high,
          ]}>
          <Trans>Advanced</Trans>
        </Text>
        <View style={[a.rounded_sm, t.atoms.bg_contrast_25]}>
          <ModerationServiceCard.Link
            modservice={{
              uri: '',
              cid: '',
              policies: {},
              creator: {
                did: '',
                handle: 'safety.bsky.app',
                displayName: 'Bluesky Safety',
              },
              indexedAt: new Date().toISOString(),
            }}>
            <ModerationServiceCard.Card.Outer>
              <ModerationServiceCard.Card.Avatar avatar={undefined} />
              <ModerationServiceCard.Card.Content
                title={getModerationServiceTitle({
                  displayName: 'Bluesky Safety',
                  handle: 'safety.bsky.app',
                })}
                handle={'safety.bsky.app'}
                description={'Official moderation team'}
              />
            </ModerationServiceCard.Card.Outer>
          </ModerationServiceCard.Link>
          <Divider />
          {modservices.map(mod => {
            return (
              <ModerationServiceCard.Link
                modservice={mod}
                key={mod.creator.did}>
                <ModerationServiceCard.Card.Outer>
                  <ModerationServiceCard.Card.Avatar
                    avatar={mod.creator.avatar}
                  />
                  <ModerationServiceCard.Card.Content
                    title={getModerationServiceTitle({
                      displayName: mod.creator.displayName,
                      handle: mod.creator.handle,
                    })}
                    handle={mod.creator.handle}
                    description={mod.description}
                  />
                </ModerationServiceCard.Card.Outer>
              </ModerationServiceCard.Link>
            )
          })}
        </View>

        {
          undefined /*<Text
          style={[
            a.text_md,
            a.font_bold,
            a.pt_2xl,
            a.pb_md,
            t.atoms.text_contrast_high,
          ]}>
          <Trans>Bluesky Safety</Trans>{' '}
          <Text style={[a.text_sm, a.pb_md, t.atoms.text_contrast_medium]}>
            @safety.bsky.app
          </Text>
        </Text>
        <View
          style={[
            a.w_full,
            a.rounded_md,
            a.overflow_hidden,
            t.atoms.bg_contrast_25,
          ]}>
          <LabelGroup
            labelGroup={groups.find(g => g.id === 'intolerance')!.id}
            labelers={[]}
            preferences={preferences}
            openModSettingsDialog={openModSettingsDialog}
          />
          <Divider />
          <LabelGroup
            labelGroup={groups.find(g => g.id === 'misrepresentation')!.id}
            labelers={[]}
            preferences={preferences}
            openModSettingsDialog={openModSettingsDialog}
          />
          <Divider />
          <LabelGroup
            labelGroup={groups.find(g => g.id === 'security')!.id}
            labelers={[]}
            preferences={preferences}
            openModSettingsDialog={openModSettingsDialog}
          />
          <Divider />
          <LabelGroup
            labelGroup={groups.find(g => g.id === 'spam')!.id}
            labelers={[]}
            preferences={preferences}
            openModSettingsDialog={openModSettingsDialog}
          />
        </View>

        {modservices.map(mod => {
          return (
            <>
              <Text
                style={[
                  a.text_md,
                  a.font_bold,
                  a.pt_2xl,
                  a.pb_md,
                  t.atoms.text_contrast_high,
                ]}>
                {mod.creator.displayName}{' '}
                <Text
                  style={[a.text_sm, a.pb_md, t.atoms.text_contrast_medium]}>
                  @{mod.creator.handle}
                </Text>
              </Text>
              <View
                style={[
                  a.w_full,
                  a.rounded_md,
                  a.overflow_hidden,
                  t.atoms.bg_contrast_25,
                ]}>
                {mod.policies.labelValues
                  .filter(label => !label.startsWith('!'))
                  .map((label, i) => {
                    return (
                      <React.Fragment key={mod.did + '-' + label}>
                        {i !== 0 && <Divider />}
                        <LabelGroup
                          labelGroup={LABELS[label].groupId}
                          labelers={[]}
                          preferences={preferences}
                          openModSettingsDialog={openModSettingsDialog}
                        />
                      </React.Fragment>
                    )
                  })}
              </View>
            </>
          )
        })}

        <Text
          style={[
            a.text_md,
            a.font_bold,
            a.pt_2xl,
            a.pb_md,
            t.atoms.text_contrast_high,
          ]}>
          <Trans>Other</Trans>
        </Text>
        <View
          style={[
            a.w_full,
            a.rounded_md,
            a.overflow_hidden,
            t.atoms.bg_contrast_25,
          ]}>
          <LabelGroup
            labelGroup={groups.find(g => g.id === 'bot')!.id}
            labelers={[]}
            preferences={preferences}
            openModSettingsDialog={openModSettingsDialog}
          />
        </View>

        <Text
          style={[
            a.text_md,
            a.font_bold,
            a.pt_2xl,
            a.pb_md,
            t.atoms.text_contrast_high,
          ]}>
          <Trans>Content filtering</Trans>
        </Text>

        <View
          style={[
            a.w_full,
            a.rounded_md,
            a.overflow_hidden,
            t.atoms.bg_contrast_25,
          ]}>
          {groups.map((def, i) => {
            const labelers = labelGroupToLabelerMap[def.id] || []
            return (
              <React.Fragment key={def.id}>
                {i !== 0 && <Divider />}
                <LabelGroup
                  labelGroup={def.id}
                  labelers={labelers}
                  preferences={preferences}
                  openModSettingsDialog={openModSettingsDialog}
                />
              </React.Fragment>
            )
          })}
        </View>*/
        }

        <Text
          style={[
            a.text_md,
            a.font_bold,
            a.pt_2xl,
            a.pb_md,
            t.atoms.text_contrast_high,
          ]}>
          <Trans>Logged-out visibility</Trans>
        </Text>

        <PwiOptOut />

        <View style={{height: 200}} />
      </ScrollView>
    </View>
  )
}

function LabelGroup({
  labelGroup,
  labelers: mods,
  preferences,
}: // openModSettingsDialog,
{
  labelGroup: LabelGroupDefinition['id']
  labelers: AppBskyModerationDefs.ModServiceViewDetailed[]
  preferences: UsePreferencesQueryResponse
  openModSettingsDialog: (props: SettingsDialogProps) => void
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()
  const labelGroupStrings = useLabelGroupStrings()
  const {mutateAsync: setContentLabelPref, variables: optimisticContentLabel} =
    useSetContentLabelMutation()
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const onChangeVisibility = React.useCallback(
    async (values: string[]) => {
      try {
        await setContentLabelPref({
          labelGroup,
          visibility: values[0] as LabelPreference,
        })
      } catch (e) {
        // TODO
        console.error(e)
      }
    },
    [labelGroup, setContentLabelPref],
  )

  const {name, description} = labelGroupStrings[labelGroup]
  const value =
    optimisticContentLabel?.visibility ??
    preferences.moderationOpts.labelGroups[labelGroup]
  const labelOptions = {
    hide: _(msg`Hide`),
    warn: _(msg`Warn`),
    // show: _(msg`Show`),
  }

  return (
    <View style={[a.px_lg, a.pr_md, gtMobile && a.px_lg]}>
      <View
        style={[
          a.py_md,
          a.flex_row,
          a.justify_between,
          a.gap_sm,
          a.align_center,
        ]}>
        <View style={[a.gap_xs, {width: '50%'}]}>
          <Text style={[a.font_semibold, t.atoms.text_contrast_high]}>
            {name}
          </Text>
          <Text style={[a.leading_tight, {maxWidth: 400}]}>{description}</Text>
        </View>

        <View>
          <ToggleButton.Group
            label={_(
              msg`Configure content filtering setting for category: ${name.toLowerCase()}`,
            )}
            values={[value]}
            onChange={onChangeVisibility}>
            <ToggleButton.Button name="warn" label={labelOptions.warn}>
              {labelOptions.warn}
            </ToggleButton.Button>
            <ToggleButton.Button name="hide" label={labelOptions.hide}>
              {labelOptions.hide}
            </ToggleButton.Button>
            {
              undefined /*<ToggleButton.Button name="ignore" label={labelOptions.show}>
              {labelOptions.show}
            </ToggleButton.Button>*/
            }
          </ToggleButton.Group>
        </View>
      </View>

      {!!mods.length && (
        <View style={[a.mb_md, a.rounded_sm, t.atoms.bg]}>
          <Button
            label="Expand to configure labelers"
            onPress={() => setSettingsOpen(!settingsOpen)}>
            <View
              style={[
                a.w_full,
                a.flex_row,
                a.align_center,
                a.justify_between,
                a.p_md,
              ]}>
              <View style={[a.flex_row, a.align_center, a.flex_1, a.gap_xs]}>
                {mods.map(mod => {
                  const modservicePreferences =
                    preferences.moderationOpts.mods.find(
                      ({did}) => did === mod.creator.did,
                    )
                  const labelGroupEnabled =
                    !modservicePreferences?.disabledLabelGroups?.includes(
                      labelGroup,
                    )
                  const isLabelerEnabled = modservicePreferences?.enabled
                  const enabled = labelGroupEnabled && isLabelerEnabled
                  return (
                    <View
                      key={mod.creator.did}
                      style={[
                        a.flex_row,
                        a.align_center,
                        a.gap_xs,
                        a.py_xs,
                        a.px_sm,
                        a.rounded_xs,
                        t.atoms.bg_contrast_600,
                        enabled && t.atoms.bg_contrast_800,
                      ]}>
                      <View
                        style={[
                          a.rounded_full,
                          t.atoms.bg_contrast_300,
                          {
                            height: 6,
                            width: 6,
                          },
                          enabled && {
                            backgroundColor: t.palette.positive_500,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          a.text_xs,
                          a.font_bold,
                          native({
                            top: 1,
                          }),
                          t.atoms.text_inverted,
                        ]}>
                        {getModerationServiceTitle({
                          displayName: mod.creator.displayName,
                          handle: mod.creator.handle,
                        })}
                      </Text>
                    </View>
                  )
                })}
              </View>

              <ChevronDown size="sm" />
            </View>
          </Button>

          {settingsOpen && (
            <View style={[a.px_md]}>
              <Divider />

              {mods.map((mod, i) => {
                return (
                  <React.Fragment key={mod.creator.did}>
                    {i !== 0 && <Divider />}

                    <LabelerToggle
                      labelGroup={labelGroup}
                      labeler={mod}
                      preferences={preferences}
                    />
                  </React.Fragment>
                )
              })}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function LabelerToggle({
  labelGroup,
  labeler,
  preferences,
}: {
  labelGroup: LabelGroupDefinition['id']
  labeler: AppBskyModerationDefs.ModServiceViewDetailed
  preferences: UsePreferencesQueryResponse
}) {
  const t = useTheme()
  const {
    mutateAsync: toggleGroupEnabled,
    variables: optimisticToggleGroupEnabled,
  } = useModServiceLabelGroupEnableMutation()

  const labelerPrefs = React.useMemo(
    () =>
      preferences.moderationOpts.mods.find(
        ({did}) => did === labeler.creator.did,
      ),
    [preferences.moderationOpts.mods, labeler.creator.did],
  )
  const isLabelerEnabled = !!labelerPrefs?.enabled
  const isEnabled = isLabelerEnabled
    ? optimisticToggleGroupEnabled?.enabled ??
      !labelerPrefs?.disabledLabelGroups?.includes(labelGroup)
    : false
  const title = getModerationServiceTitle({
    displayName: labeler.creator.displayName,
    handle: labeler.creator.handle,
  })

  const onToggleEnabled = React.useCallback(async () => {
    try {
      if (!labelerPrefs) throw new Error(`labelerPrefs not found`)

      await toggleGroupEnabled({
        did: labelerPrefs.did,
        group: labelGroup,
        enabled: !isEnabled,
      })
    } catch (e: any) {
      logger.error(`Failed to toggle label group enabled`, {
        message: e.message,
        labelGroup,
      })
    }
  }, [toggleGroupEnabled, isEnabled, labelerPrefs, labelGroup])

  return (
    <Toggle.Item
      disabled={!isLabelerEnabled}
      label={'Toggle label'}
      name={labeler.creator.did}
      value={isEnabled}
      onChange={onToggleEnabled}>
      <View
        style={[
          a.w_full,
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.py_md,
        ]}>
        <Text style={[a.font_bold]}>
          {title}{' '}
          <Text style={[t.atoms.text_contrast_low]}>
            {isLabelerEnabled ? '' : '(labeler disabled)'}
          </Text>
        </Text>
        <Toggle.Switch />
      </View>
    </Toggle.Item>
  )
}

function PwiOptOut() {
  const t = useTheme()
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const updateProfile = useProfileUpdateMutation()

  const isOptedOut =
    profile?.labels?.some(l => l.val === '!no-unauthenticated') || false
  const canToggle = profile && !updateProfile.isPending

  const onToggleOptOut = React.useCallback(() => {
    if (!profile) {
      return
    }
    let wasAdded = false
    updateProfile.mutate({
      profile,
      updates: existing => {
        // create labels attr if needed
        existing.labels = ComAtprotoLabelDefs.isSelfLabels(existing.labels)
          ? existing.labels
          : {
              $type: 'com.atproto.label.defs#selfLabels',
              values: [],
            }

        // toggle the label
        const hasLabel = existing.labels.values.some(
          l => l.val === '!no-unauthenticated',
        )
        if (hasLabel) {
          wasAdded = false
          existing.labels.values = existing.labels.values.filter(
            l => l.val !== '!no-unauthenticated',
          )
        } else {
          wasAdded = true
          existing.labels.values.push({val: '!no-unauthenticated'})
        }

        // delete if no longer needed
        if (existing.labels.values.length === 0) {
          delete existing.labels
        }
        return existing
      },
      checkCommitted: res => {
        const exists = !!res.data.labels?.some(
          l => l.val === '!no-unauthenticated',
        )
        return exists === wasAdded
      },
    })
  }, [updateProfile, profile])

  return (
    <View style={[a.pt_sm]}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_lg]}>
        <Toggle.Item
          disabled={!canToggle}
          value={isOptedOut}
          onChange={onToggleOptOut}
          name="logged_out_visibility"
          label={_(
            msg`Discourage apps from showing my account to logged-out users`,
          )}>
          <Toggle.Switch />
          <Toggle.Label style={[a.text_md]}>
            Discourage apps from showing my account to logged-out users
          </Toggle.Label>
        </Toggle.Item>

        {updateProfile.isPending && <Loader />}
      </View>

      <View style={[a.pt_md, a.gap_md, {paddingLeft: 38}]}>
        <Text style={[a.leading_snug, t.atoms.text_contrast_high]}>
          <Trans>
            Bluesky will not show your profile and posts to logged-out users.
            Other apps may not honor this request. This does not make your
            account private.
          </Trans>
        </Text>
        <Text style={[a.font_bold, a.leading_snug, t.atoms.text_contrast_high]}>
          <Trans>
            Note: Bluesky is an open and public network. This setting only
            limits the visibility of your content on the Bluesky app and
            website, and other apps may not respect this setting. Your content
            may still be shown to logged-out users by other apps and websites.
          </Trans>
        </Text>

        <InlineLink to="https://blueskyweb.zendesk.com/hc/en-us/articles/15835264007693-Data-Privacy">
          <Trans>Learn more about what is public on Bluesky.</Trans>
        </InlineLink>
      </View>
    </View>
  )
}
