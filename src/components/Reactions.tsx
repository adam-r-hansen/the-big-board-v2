'use client';

import { useState, useEffect } from 'react';
import { Box, IconButton, Typography, Popover } from '@mui/material';
import { AddReaction } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

type Reaction = {
  id: string;
  emoji: string;
  profile_id: string;
  profile?: {
    display_name: string;
  };
};

type ReactionsProps = {
  pickId: string;
  currentUserId: string;
};

// Comprehensive emoji grid - organized by category
const EMOJI_GRID = [
  // Thumbs & hands
  '👍', '👎', '👏', '🙌', '💪', '🤝', '✌️', '🤘',
  // Hearts & emotions
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  // Happy faces
  '😀', '😃', '😄', '😁', '😆', '😂', '🤣', '😊',
  '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗',
  // Thinking & neutral
  '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😬',
  // Sad & concerned
  '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺',
  '😢', '😭', '😤', '😠', '😡', '🤬', '😱', '😨',
  // Cool & special
  '😎', '🤓', '🧐', '🤩', '🥳', '😵', '🤯', '🤪',
  // Other faces
  '🤐', '🤫', '🤭', '🥱', '😴', '🤤', '😪', '😷',
  // Creatures
  '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖', '💩',
  // Symbols & objects
  '🔥', '⚡', '💥', '✨', '⭐', '🌟', '💫', '💯',
  '🎯', '🎉', '🎊', '🏆', '🥇', '🥈', '🥉', '🏅',
  // More symbols
  '🚀', '💰', '💸', '💵', '🎰', '🎲', '🎮', '⚽',
  '🏈', '🏀', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓',
];

export default function Reactions({ pickId, currentUserId }: ReactionsProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadReactions();
  }, [pickId]);

  const loadReactions = async () => {
    const { data } = await supabase
      .from('reactions_v2')
      .select('id, emoji, profile_id, profile:profiles(display_name)')
      .eq('pick_id', pickId);

    if (data) {
      setReactions(data as unknown as Reaction[]);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const addReaction = async (emoji: string) => {
    setLoading(true);
    handleClose(); // Close immediately for snappy feel
    
    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pick_id: pickId, emoji }),
    });

    if (res.ok) {
      await loadReactions();
    }
    setLoading(false);
  };

  const removeReaction = async () => {
    setLoading(true);
    const res = await fetch(`/api/reactions?pick_id=${pickId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      await loadReactions();
    }
    setLoading(false);
  };

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const userReaction = reactions.find(r => r.profile_id === currentUserId);
  const open = Boolean(anchorEl);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {/* Display existing reactions */}
      {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => {
        const isUserReaction = emojiReactions.some(r => r.profile_id === currentUserId);
        return (
          <Box
            key={emoji}
            onClick={() => isUserReaction ? removeReaction() : addReaction(emoji)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: isUserReaction ? 'primary.main' : 'background.paper',
              color: isUserReaction ? 'white' : 'text.primary',
              border: 1,
              borderColor: isUserReaction ? 'primary.main' : 'divider',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: isUserReaction ? 'primary.dark' : 'action.hover',
                transform: 'scale(1.05)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 16 }}>{emoji}</Typography>
            <Typography variant="caption" fontWeight={600}>{emojiReactions.length}</Typography>
          </Box>
        );
      })}

      {/* Add reaction button */}
      {!userReaction && (
        <IconButton size="small" onClick={handleClick} disabled={loading}>
          <AddReaction fontSize="small" />
        </IconButton>
      )}

      {/* Emoji picker popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              maxHeight: 400,
              overflow: 'auto',
            }
          }
        }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Tap an emoji to react
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 0.5,
            }}
          >
            {EMOJI_GRID.map((emoji, idx) => (
              <Box
                key={`${emoji}-${idx}`}
                onClick={() => addReaction(emoji)}
                sx={{
                  fontSize: 28,
                  cursor: 'pointer',
                  textAlign: 'center',
                  p: 0.5,
                  borderRadius: 1,
                  transition: 'all 0.15s',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    transform: 'scale(1.2)',
                  },
                  '&:active': {
                    transform: 'scale(1.0)',
                  },
                }}
              >
                {emoji}
              </Box>
            ))}
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
