'use client'
import { useState } from 'react'
import { Container, Paper, Typography, TextField, Button, Box, Alert } from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'

export default function ScheduleSyncPage() {
  const router = useRouter()
  const [season, setSeason] = useState<number>(2025)
  const [weeks, setWeeks] = useState<string>('1')
  const [result, setResult] = useState<any>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function run() {
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch('/api/admin/schedule/espn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ season, weeks }),
      })
      const data = await res.json().catch(() => null)
      setResult({ http: res.status, ...data })
      setStatus(res.ok && data?.ok !== false ? 'ok' : 'error')
    } catch (e: any) {
      setStatus('error')
      setResult({ http: 0, error: e?.message || String(e) })
    }
  }

  return (
    <AppShell>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => router.push('/admin')}
          sx={{ mb: 2 }}
        >
          Back to Admin
        </Button>

        <Typography variant="h4" gutterBottom>
          Schedule Sync (ESPN)
        </Typography>

        <Paper sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Pulls regular season (seasontype=2) schedule from ESPN. Week 18 times are
            fluid—re-run to update. Dates are stored in UTC.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-end' }}>
            <TextField
              label="Season"
              type="number"
              size="small"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              sx={{ width: 120 }}
            />
            <TextField
              label="Weeks"
              size="small"
              placeholder="e.g. 1,2 or 2-5 or all"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              onClick={run}
              disabled={status === 'loading'}
              sx={{ minWidth: 150 }}
            >
              {status === 'loading' ? 'Syncing…' : 'Sync from ESPN'}
            </Button>
          </Box>

          {status === 'ok' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Sync complete
            </Alert>
          )}
          {status === 'error' && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Sync failed
            </Alert>
          )}

          {result && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                maxHeight: 400,
                overflow: 'auto',
              }}
            >
              <pre style={{ margin: 0, fontSize: '12px' }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </Paper>
          )}
        </Paper>
      </Container>
    </AppShell>
  )
}
