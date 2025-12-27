'use client';

import { useState, useEffect } from 'react';
import { Box, IconButton, Popover, Stack, Chip } from '@mui/material';
import { Add } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

const EMOJIS = [
  // Classic reactions
  '👍', '👎', '❤️', '🔥', '💯', '✨', '⭐', '💪', '🙌', '👏',
  
  // Happy faces
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  
  // Thinking/Neutral
  '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮',
  
  // Sad/Worried
  '😒', '😓', '😔', '😕', '🙁', '☹️', '😖', '😞', '😟', '😤',
  '😢', '😭', '😦', '😧', '😨', '😰', '😱', '😡',
  
  // Silly/Crazy
  '🤪', '😵', '🥴', '😲', '🤯', '🤠', '🥳', '😎', '🤓',
  '🧐', '😈', '👿', '👹', '👺', '💀', '☠️', '👻', '👽', '🤖',
  
  // Animals
  '🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧',
  
  // Food & Drink
  '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍕', '🍔', '🍟',
  '🌭', '🥪', '🌮', '🌯', '🍿', '☕', '🍺', '🍻', '🥂', '🍷',
  
  // Sports
  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
  '🏆', '🥇', '🥈', '🥉', '🏅',
];

type Reaction = {
  id: string;
  pick_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
  profile?: {
    display_name: string;
  } | {
    display_name: string;
  }[];
};

interface ReactionsProps {
  pickId: string;
  currentUserId: string;
}

export default function Reactions({ pickId, currentUserId }: ReactionsProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadReactions();
  }, [pickId]);

  const loadReactions = async () => {
    const { data } = await supabase
      .from('reactions_v2')
      .select(`
        id,
        pick_id,
        profile_id,
        emoji,
        created_at,
        profile:profiles(display_name)
      `)
      .eq('pick_id', pickId);

    if (data) {
      // Handle profile being returned as array from Supabase
      const formattedData = data.map(r => ({
        ...r,
        profile: Array.isArray(r.profile) ? r.profile[0] : r.profile
      }));
      setReactions(formattedData as Reaction[]);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEmojiSelect = async (emoji: string) => {
    // Check if user already reacted with this emoji
    const existingReaction = reactions.find(
      r => r.profile_id === currentUserId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction via API
      await fetch(`/api/reactions?pick_id=${pickId}`, {
        method: 'DELETE',
      });
    } else {
      // Add/update reaction via API (uses upsert to avoid conflicts)
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pick_id: pickId, emoji }),
      });
    }

    loadReactions();
    handleClose();
  };

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {/* Existing reactions */}
      {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => {
        const userReacted = emojiReactions.some(r => r.profile_id === currentUserId);
        
        return (
          <Chip
            key={emoji}
            label={`${emoji} ${emojiReactions.length}`}
            size="small"
            onClick={() => handleEmojiSelect(emoji)}
            sx={{
              cursor: 'pointer',
              bgcolor: userReacted ? 'primary.main' : 'action.hover',
              color: userReacted ? 'white' : 'inherit',
              '&:hover': {
                bgcolor: userReacted ? 'primary.dark' : 'action.selected',
              },
            }}
          />
        );
      })}

      {/* Add reaction button */}
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{ 
          width: 24, 
          height: 24,
          opacity: 0.7,
          '&:hover': { opacity: 1 }
        }}
      >
        <Add fontSize="small" />
      </IconButton>

      {/* Emoji picker */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 1, maxWidth: 320, maxHeight: 400, overflow: 'auto' }}>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {EMOJIS.map((emoji) => (
              <IconButton
                key={emoji}
                size="small"
                onClick={() => handleEmojiSelect(emoji)}
                sx={{ fontSize: 20 }}
              >
                {emoji}
              </IconButton>
            ))}
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
}
