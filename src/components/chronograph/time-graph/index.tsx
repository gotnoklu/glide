import type { Chronograph } from '../../../stores/chronographs'
import { IconButton, Stack, SvgIcon, Typography, Box, InputBase, styled, Fab } from '@suid/material'
import { createSignal, createMemo, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { fromMilliseconds, toMilliseconds } from '../../../utilities'
import TimeGraphCard from './card'
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconRestore,
  IconPencilCheck,
  IconPencil,
  IconX,
} from '@tabler/icons-solidjs'
import { userSettings } from '../../../stores/settings'
import { sendNotification } from '../../../stores/notifications'
import { updateChronograph } from '../../../stores/chronographs'
import type { ChangeEvent } from '@suid/types'
import type { DOMElement } from 'solid-js/jsx-runtime'
import { currentWorkspace } from '../../../stores/workspaces'

export interface TimeGraphProps extends Omit<Chronograph, 'created_at' | 'modified_at'> {
  enlarged?: boolean
  onClose?(): void
}

const StyledInput = styled('input')(({ theme }) => ({
  border: 'none',
  outline: 'none',
  maxWidth: '132px',
  textAlign: 'center',
  fontFamily: theme.typography.monospace?.fontFamily,
  color: theme.palette.text.primary,
  backgroundColor: 'transparent',
  transition: theme.transitions.create(['background-color'], {
    duration: theme.transitions.duration.shortest,
  }),
  '&:hover': {
    backgroundColor: 'rgba(159, 159, 159, 0.2)',
  },
}))

export default function TimeGraph(props: TimeGraphProps) {
  let baseTimeDuration = fromMilliseconds(props.duration)

  const [graph, setGraph] = createStore({
    name: props.name,
    hours: Math.min(Math.max(baseTimeDuration.hours, 0), 99),
    minutes: Math.min(Math.max(baseTimeDuration.minutes, 0), 59),
    seconds: Math.min(Math.max(baseTimeDuration.seconds, 0), 59),
    milliseconds: 0,
  })

  const [isRunning, setIsRunning] = createSignal(false)
  const [isEditingName, setIsEditingName] = createSignal(false)

  let nameInput!: HTMLInputElement
  let timer: number | undefined = undefined
  let startTime = 0
  let elapsedTime = props.duration

  const isTimer = createMemo(() => props.kind === 'timer')
  const fontSize = createMemo(() => (props.enlarged ? 'h6.fontSize' : 'body1.fontSize'))

  function updateTimeGraph() {
    if (isTimer()) {
      elapsedTime = elapsedTime - 1000

      if (elapsedTime <= 0) {
        if (userSettings.notify_on_timer_complete) {
          sendNotification({ title: 'Completed!', body: `"${props.name}" is done.` })
        }

        clearInterval(timer)
        setIsRunning(false)

        updateChronograph({
          workspace_id: currentWorkspace()?.id as number,
          id: props.id,
          chronograph: {
            name: graph.name,
            kind: props.kind,
            state: isRunning() ? 'active' : 'paused',
            duration: elapsedTime,
            is_favourite: props.is_favourite,
          },
        })
      }
    } else {
      elapsedTime = Date.now() - startTime
    }

    setGraph(fromMilliseconds(elapsedTime))
  }

  function resetTimeGraph() {
    clearInterval(timer)

    if (isTimer()) {
      elapsedTime = toMilliseconds(
        baseTimeDuration.hours,
        baseTimeDuration.minutes,
        baseTimeDuration.seconds
      )

      setGraph({
        hours: Math.min(Math.max(baseTimeDuration.hours, 0), 99),
        minutes: Math.min(Math.max(baseTimeDuration.minutes, 0), 59),
        seconds: Math.min(Math.max(baseTimeDuration.seconds, 0), 59),
        milliseconds: 0,
      })
    } else {
      startTime = 0
      elapsedTime = 0
      setGraph({ hours: 0, minutes: 0, seconds: 0, milliseconds: 0 })
    }

    setIsRunning(false)
  }

  function triggerTimeGraph() {
    if (isRunning()) {
      clearInterval(timer)
      setIsRunning(false)

      updateChronograph({
        workspace_id: currentWorkspace()?.id as number,
        id: props.id,
        chronograph: {
          name: graph.name,
          kind: props.kind,
          state: 'paused',
          duration: elapsedTime,
          is_favourite: props.is_favourite,
        },
      })
    } else {
      if (isTimer()) {
        timer = setInterval(updateTimeGraph, 1000)
      } else {
        startTime = Date.now() - elapsedTime
        timer = setInterval(updateTimeGraph, 10)
      }

      setIsRunning(true)

      updateChronograph({
        workspace_id: currentWorkspace()?.id as number,
        id: props.id,
        chronograph: {
          name: graph.name,
          kind: props.kind,
          state: 'active',
          duration: elapsedTime,
          is_favourite: props.is_favourite,
        },
      })
    }
  }

  function calculateTimerValue(
    event: KeyboardEvent & { target: Element; currentTarget: HTMLInputElement },
    max = 59
  ) {
    const { value } = event.currentTarget
    let currentValueAsNumber = Math.min(Math.max(Number.parseInt(value), 0), max)

    if (/[0-9]/.test(event.key)) {
      let currentValue
      if (event.currentTarget.selectionEnd === 0) {
        currentValue = `${event.key}${value[value.length - 1]}`
      } else if (event.currentTarget.selectionEnd === 1) {
        currentValue = `${value[0]}${event.key}`
      } else {
        currentValue = `${value[value.length - 1]}${event.key}`
      }

      currentValueAsNumber = Math.min(Math.max(Number.parseInt(currentValue), 0), max)

      if (Number.isNaN(currentValueAsNumber)) currentValueAsNumber = max

      event.preventDefault()
    } else if (event.key === 'Backspace') {
      event.preventDefault()

      let currentValue
      if (event.currentTarget.selectionEnd === 0) {
        currentValue = `${value}`
      } else if (event.currentTarget.selectionEnd === 1) {
        currentValue = `0${value[value.length - 1]}`
      } else {
        currentValue = `${value[0]}0`
      }

      currentValueAsNumber = Math.min(Math.max(Number.parseInt(currentValue), 0), max)

      if (Number.isNaN(currentValueAsNumber)) currentValueAsNumber = max
    }

    return currentValueAsNumber
  }

  function updateHours(
    event: KeyboardEvent & { target: Element; currentTarget: HTMLInputElement }
  ) {
    const isNumberKey = /[0-9]/.test(event.key)
    const isBackspaceKey = event.key === 'Backspace'
    const isEnterKey = event.key === 'Enter'
    const isArrowKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight'

    const isAcceptedKey = isNumberKey || isBackspaceKey || isEnterKey || isArrowKey
    if (!isAcceptedKey) return event.preventDefault()

    if (isNumberKey || isBackspaceKey) {
      const hours = calculateTimerValue(event, 99)
      setGraph('hours', hours)
      elapsedTime = toMilliseconds(hours, graph.minutes, graph.seconds)
      baseTimeDuration = {
        hours,
        minutes: graph.minutes,
        seconds: graph.seconds,
        milliseconds: graph.milliseconds,
      }
    }
  }

  function updateMinutes(
    event: KeyboardEvent & { target: Element; currentTarget: HTMLInputElement }
  ) {
    const isNumberKey = /[0-9]/.test(event.key)
    const isBackspaceKey = event.key === 'Backspace'
    const isEnterKey = event.key === 'Enter'
    const isArrowKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight'

    const isAcceptedKey = isNumberKey || isBackspaceKey || isEnterKey || isArrowKey
    if (!isAcceptedKey) return event.preventDefault()

    if (isNumberKey || isBackspaceKey) {
      const minutes = calculateTimerValue(event)
      setGraph('minutes', minutes)
      elapsedTime = toMilliseconds(graph.hours, minutes, graph.seconds)
      baseTimeDuration = {
        hours: graph.hours,
        minutes,
        seconds: graph.seconds,
        milliseconds: graph.milliseconds,
      }
    }
  }

  function updateSeconds(
    event: KeyboardEvent & { target: Element; currentTarget: HTMLInputElement }
  ) {
    const isNumberKey = /[0-9]/.test(event.key)
    const isBackspaceKey = event.key === 'Backspace'
    const isEnterKey = event.key === 'Enter'
    const isArrowKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight'

    const isAcceptedKey = isNumberKey || isBackspaceKey || isEnterKey || isArrowKey
    if (!isAcceptedKey) return event.preventDefault()

    if (isNumberKey || isBackspaceKey) {
      const seconds = calculateTimerValue(event)
      setGraph('seconds', seconds)
      elapsedTime = toMilliseconds(graph.hours, graph.minutes, seconds)
      baseTimeDuration = {
        hours: graph.hours,
        minutes: graph.minutes,
        seconds,
        milliseconds: graph.milliseconds,
      }
    }
  }

  function showEditButton(
    event: MouseEvent & {
      currentTarget: HTMLDivElement
      target: DOMElement
    }
  ) {
    const editButton = event.currentTarget.querySelector<HTMLButtonElement>('button#edit-btn')
    if (editButton) editButton.style.display = 'inline-flex'
  }

  function hideEditButton(
    event: MouseEvent & {
      currentTarget: HTMLDivElement
      target: DOMElement
    }
  ) {
    if (!isEditingName()) {
      const editButton = event.currentTarget.querySelector<HTMLButtonElement>('button#edit-btn')
      if (editButton) editButton.style.display = 'none'
    }
  }

  function toggleNameInput() {
    if (isEditingName()) {
      setIsEditingName(false)
    } else {
      setIsEditingName(true)
      nameInput.focus()
    }
  }

  function updateName(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setGraph((prev) => ({ ...prev, name: event.target.value }))
  }

  async function saveNameOnEnter(
    event: KeyboardEvent & {
      currentTarget: HTMLInputElement
      target: DOMElement
    }
  ) {
    if (event.key === 'Enter') {
      setIsEditingName(false)
      await updateChronograph({
        workspace_id: currentWorkspace()?.id as number,
        id: props.id,
        chronograph: {
          name: graph.name,
          kind: props.kind,
          state: isRunning() ? 'active' : 'paused',
          duration: elapsedTime,
          is_favourite: props.is_favourite,
        },
      })
    }
  }

  return (
    <TimeGraphCard running={isRunning} enlarged={props.enlarged}>
      <Stack
        component="div"
        direction="row"
        alignItems="center"
        gap={1}
        sx={{
          inlineSize: '100%',
          paddingX: 2,
          ...(props.enlarged
            ? {
                height: 56,
              }
            : {
                height: 48,
              }),
        }}
      >
        <Box flex={1}>
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            onMouseOver={showEditButton}
            onMouseLeave={hideEditButton}
          >
            <Show
              when={isEditingName()}
              fallback={
                <Typography
                  color="text.secondary"
                  fontSize={fontSize()}
                  fontWeight="medium"
                  textAlign={props.enlarged ? 'center' : 'left'}
                  sx={{ flex: 1, maxInlineSize: props.enlarged ? '100%' : '250px' }}
                  onClick={toggleNameInput}
                  noWrap
                >
                  {graph.name}
                </Typography>
              }
            >
              <InputBase
                placeholder="Enter Name"
                sx={{
                  fontSize: fontSize,
                  fontWeight: 'medium',
                  maxInlineSize: props.enlarged ? '100%' : '250px',
                  flex: 1,
                }}
                inputComponent={(props) => <input {...props} ref={nameInput} />}
                inputProps={{
                  onKeyPress: saveNameOnEnter,
                }}
                value={graph.name}
                onChange={updateName}
              />
            </Show>
            <IconButton
              id="edit-btn"
              component="button"
              size="small"
              style={{ display: 'none', width: 'max-content', height: 'max-content' }}
              onClick={toggleNameInput}
            >
              <Show
                when={isEditingName()}
                fallback={
                  <SvgIcon fontSize="small">
                    <IconPencil />
                  </SvgIcon>
                }
              >
                <SvgIcon fontSize="small" color="success">
                  <IconPencilCheck />
                </SvgIcon>
              </Show>
            </IconButton>
          </Stack>
        </Box>
        <Show when={typeof props.onClose === 'function'}>
          <IconButton
            component="button"
            size="small"
            onClick={props.onClose}
            sx={{ justifySelf: 'flex-end' }}
          >
            <SvgIcon fontSize="small">
              <IconX />
            </SvgIcon>
          </IconButton>
        </Show>
      </Stack>
      <Stack gap={2} paddingX={6} paddingY={3}>
        <Stack direction="row" alignItems="baseline">
          <Show
            when={isRunning() || !isTimer()}
            fallback={
              <StyledInput
                minlength="2"
                maxlength="2"
                sx={{
                  fontSize: props.enlarged ? 'h1.fontSize' : 'h4.fontSize',
                  width: props.enlarged ? 'calc(6rem * 1.3)' : 'calc(2.125rem * 1.3)',
                  borderRadius: props.enlarged ? 7 : 3,
                }}
                value={graph.hours.toString().padStart(2, '0')}
                onKeyDown={updateHours}
              />
            }
          >
            <Typography
              component="span"
              variant="monospace"
              fontSize={props.enlarged ? 'h1.fontSize' : 'h4.fontSize'}
              sx={{
                width: !props.enlarged ? 'calc(2.125rem * 1.3)' : 'calc(6rem * 1.3)',
                textAlign: 'center',
              }}
            >
              {graph.hours.toString().padStart(2, '0')}
            </Typography>
          </Show>
          <Typography
            component="span"
            variant="monospace"
            fontSize={props.enlarged ? 'h1.fontSize' : 'h4.fontSize'}
          >
            :
          </Typography>
          <Show
            when={isRunning() || !isTimer()}
            fallback={
              <StyledInput
                minlength="2"
                maxlength="2"
                sx={{
                  fontSize: props.enlarged ? 'h1.fontSize' : 'h4.fontSize',
                  width: props.enlarged ? 'calc(6rem * 1.3)' : 'calc(2.125rem * 1.3)',
                  borderRadius: props.enlarged ? 7 : 3,
                }}
                value={graph.minutes.toString().padStart(2, '0')}
                onKeyDown={updateMinutes}
              />
            }
          >
            <Typography
              component="span"
              variant="monospace"
              fontSize={props.enlarged ? 'h1.fontSize' : 'h4.fontSize'}
              sx={{
                width: !props.enlarged ? 'calc(2.125rem * 1.3)' : 'calc(6rem * 1.3)',
                textAlign: 'center',
              }}
            >
              {graph.minutes.toString().padStart(2, '0')}
            </Typography>
          </Show>
          <Typography
            component="span"
            variant="monospace"
            fontSize={props.enlarged ? 'h1.fontSize' : 'h4.fontSize'}
          >
            :
          </Typography>
          <Show
            when={isRunning() || !isTimer()}
            fallback={
              <StyledInput
                minlength="2"
                maxlength="2"
                sx={{
                  fontSize: props.enlarged ? 'h1.fontSize' : 'h4.fontSize',
                  width: props.enlarged ? 'calc(6rem * 1.3)' : 'calc(2.125rem * 1.3)',
                  borderRadius: props.enlarged ? 7 : 3,
                }}
                value={graph.seconds.toString().padStart(2, '0')}
                onKeyDown={updateSeconds}
              />
            }
          >
            <Typography
              component="span"
              variant="monospace"
              fontSize={props.enlarged ? 'h1.fontSize' : 'h4.fontSize'}
              sx={{
                width: !props.enlarged ? 'calc(2.125rem * 1.3)' : 'calc(6rem * 1.3)',
                textAlign: 'center',
              }}
            >
              {graph.seconds.toString().padStart(2, '0')}
            </Typography>
          </Show>
          <Show when={!isTimer()}>
            <Typography
              component="span"
              variant="monospace"
              color="text.secondary"
              fontSize={props.enlarged ? 'h4.fontSize' : 'body1.fontSize'}
            >
              .{graph.milliseconds.toString().padStart(2, '0')}
            </Typography>
          </Show>
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="center" flex={1} gap={1}>
          <IconButton onClick={resetTimeGraph}>
            <SvgIcon>
              <IconRestore />
            </SvgIcon>
          </IconButton>
          <Fab
            color="primary"
            size="small"
            sx={{ boxShadow: 'none' }}
            onClick={triggerTimeGraph}
            disabled={toMilliseconds(graph.hours, graph.minutes, graph.seconds) === 0 && isTimer()}
          >
            <Show
              when={isRunning()}
              fallback={
                <SvgIcon fontSize="small">
                  <IconPlayerPlay />
                </SvgIcon>
              }
            >
              <SvgIcon fontSize="small">
                <IconPlayerPause />
              </SvgIcon>
            </Show>
          </Fab>
        </Stack>
      </Stack>
    </TimeGraphCard>
  )
}
