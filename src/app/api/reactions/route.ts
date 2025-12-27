import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// POST - Add or update reaction
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pick_id, emoji } = await request.json();

    if (!pick_id || !emoji) {
      return NextResponse.json({ error: 'pick_id and emoji required' }, { status: 400 });
    }

    // Upsert reaction (insert or update if exists)
    const { data, error } = await supabase
      .from('reactions_v2')
      .upsert(
        {
          pick_id,
          profile_id: user.id,
          emoji,
        },
        {
          onConflict: 'pick_id,profile_id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Reaction upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, reaction: data });

  } catch (error: any) {
    console.error('Reaction POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove reaction
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pick_id = searchParams.get('pick_id');

    if (!pick_id) {
      return NextResponse.json({ error: 'pick_id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('reactions_v2')
      .delete()
      .eq('pick_id', pick_id)
      .eq('profile_id', user.id);

    if (error) {
      console.error('Reaction delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Reaction DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
