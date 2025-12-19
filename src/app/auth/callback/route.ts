import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const redirectUrl = next.startsWith('/') ? `${origin}${next}` : next;
      return NextResponse.redirect(redirectUrl);
    }
    
    console.error('Auth error:', error);
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
