import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql')
    const content = fs.readFileSync(schemaPath, 'utf8')
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return new NextResponse(`-- Failed to read schema: ${err}`, { status: 500 })
  }
}
