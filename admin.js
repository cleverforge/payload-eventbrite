'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { createElement, useState } from 'react'

const buttonStyle = {
  background: 'var(--theme-elevation-100)',
  border: '1px solid var(--theme-elevation-300)',
  borderRadius: '4px',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  padding: '8px 10px',
}

export function EventbriteEventActions({ inboundAllowed = true, outboundAllowed = true }) {
  const { id } = useDocumentInfo()
  const [state, setState] = useState({})

  const run = async (action, method = 'POST') => {
    if (!id || state.loading) return
    setState({ loading: true })
    try {
      const response = await fetch(`/api/eventbrite/${action}/${id}`, {
        method,
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error || body?.message || `Eventbrite request failed (${response.status})`)
      }
      const message = body?.message || (
        action === 'readiness'
          ? body?.ready ? 'Event is ready to publish.' : `Missing: ${(body?.missing || []).join(', ')}`
          : `Eventbrite ${action} completed.`
      )
      setState({ message })
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (!id) return null

  const buttons = []

  if (inboundAllowed) {
    buttons.push(createElement('button', {
      key: 'sync',
      type: 'button',
      disabled: state.loading,
      style: buttonStyle,
      onClick: () => void run('sync'),
    }, 'Sync Now'))
  }

  if (outboundAllowed) {
    buttons.push(
      createElement('button', {
        key: 'push',
        type: 'button',
        disabled: state.loading,
        style: buttonStyle,
        onClick: () => void run('push'),
      }, 'Push to Eventbrite'),
      createElement('button', {
        key: 'readiness',
        type: 'button',
        disabled: state.loading,
        style: buttonStyle,
        onClick: () => void run('readiness', 'GET'),
      }, 'Check Readiness'),
      createElement('button', {
        key: 'publish',
        type: 'button',
        disabled: state.loading,
        style: buttonStyle,
        onClick: () => void run('publish'),
      }, 'Publish'),
      createElement('button', {
        key: 'unpublish',
        type: 'button',
        disabled: state.loading,
        style: buttonStyle,
        onClick: () => void run('unpublish'),
      }, 'Unpublish'),
    )
  }

  return createElement(
    'div',
    { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
    ...buttons,
    state.error
      ? createElement('span', { style: { color: 'var(--theme-error-500)', fontSize: '12px' } }, state.error)
      : null,
    state.message
      ? createElement('span', { style: { color: 'var(--theme-success-500)', fontSize: '12px' } }, state.message)
      : null,
  )
}
