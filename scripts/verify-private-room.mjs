// Checks, against your real Supabase project, that the "play together" room is private.
//
//   node --env-file=scripts/verify.env scripts/verify-private-room.mjs
//
// scripts/verify.env (never commit it — it's in .gitignore):
//   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
//   SUPABASE_ANON_KEY=...            (the public anon key, or SUPABASE_PUBLISHABLE_KEY=sb_publishable_...)
//   OWNER_EMAIL=...   OWNER_PASSWORD=...
//   TARI_EMAIL=...    TARI_PASSWORD=...
//   OUTSIDER_EMAIL=...  OUTSIDER_PASSWORD=...   (optional: a third account that is NOT in couple_members)
//
// Without the outsider account those checks are skipped; the script still checks that
// nobody can sign up, that signed-out visitors get nothing, and that you two can't
// impersonate each other.
//
// It writes one test letter ("[test] …") from the owner to Tari. The website can't delete
// letters, so remove it afterwards in Dashboard → Table editor → bottles if you like.
import { createClient } from '@supabase/supabase-js'

const env = process.env
env.SUPABASE_ANON_KEY ||= env.SUPABASE_PUBLISHABLE_KEY
for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OWNER_EMAIL', 'OWNER_PASSWORD', 'TARI_EMAIL', 'TARI_PASSWORD']) {
  if (!env[k]) {
    console.error(`Missing ${k} (see the top of this file).`)
    process.exit(2)
  }
}

let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const client = () => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

async function login(email, password) {
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`could not sign in ${email}: ${error.message}`)
  await c.realtime.setAuth(data.session.access_token)
  return { c, id: data.user.id }
}

/** Join a private channel; resolves 'SUBSCRIBED' or the error status. */
function join(c, topic, onPose, isPrivate = true) {
  return new Promise((resolve) => {
    const ch = c.channel(topic, { config: { private: isPrivate, broadcast: { self: false, ack: true } } })
    if (onPose) ch.on('broadcast', { event: 'pose' }, ({ payload }) => onPose(payload))
    const t = setTimeout(() => resolve({ ch, status: 'TIMED_OUT' }), 8000)
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        clearTimeout(t)
        resolve({ ch, status: err?.message ? `${status} (${err.message})` : status })
      }
    })
  })
}

const owner = await login(env.OWNER_EMAIL, env.OWNER_PASSWORD)
const tari = await login(env.TARI_EMAIL, env.TARI_PASSWORD)
const outsider = env.OUTSIDER_EMAIL && env.OUTSIDER_PASSWORD ? await login(env.OUTSIDER_EMAIL, env.OUTSIDER_PASSWORD) : null
const anon = client()
const skip = (name) => console.log(`SKIP  ${name}  — no OUTSIDER_EMAIL / OUTSIDER_PASSWORD`)

console.log('\n── accounts')
// a "+verify" alias of the owner's address, so if sign-up were open the email lands with you
const [user, domain] = env.OWNER_EMAIL.split('@')
const signUp = await client().auth.signUp({ email: `${user}+verify${Date.now()}@${domain}`, password: `x-${Math.random().toString(36).slice(2)}-Verify9` })
check('strangers cannot create an account', Boolean(signUp.error) && /sign ?ups?|not allowed|disabled/i.test(signUp.error.message), signUp.error?.message || 'sign-up is OPEN — turn off "Allow new users to sign up"')

console.log('\n── membership')
const ownerSees = await owner.c.from('couple_members').select('user_id, role')
check('owner sees exactly two members', !ownerSees.error && ownerSees.data?.length === 2, JSON.stringify(ownerSees.data?.map((m) => m.role)))
check('owner and Tari are the two members', ownerSees.data?.some((m) => m.user_id === owner.id && m.role === 'owner') && ownerSees.data?.some((m) => m.user_id === tari.id && m.role === 'tari'))
if (outsider) {
  const outsiderSees = await outsider.c.from('couple_members').select('user_id')
  check('outsider sees no members', !outsiderSees.data?.length, outsiderSees.error?.message || `${outsiderSees.data?.length} rows`)
  const addSelf = await outsider.c.from('couple_members').insert({ user_id: outsider.id, role: 'tari' })
  check('outsider cannot add themselves', Boolean(addSelf.error), addSelf.error?.message)
} else skip('outsider sees no members / cannot add themselves')
const anonSees = await anon.from('couple_members').select('user_id')
check('signed-out visitor sees no members', !anonSees.data?.length, anonSees.error?.message || `${anonSees.data?.length} rows`)
const anonAdd = await anon.from('couple_members').insert({ user_id: tari.id, role: 'owner' })
check('signed-out visitor cannot add members', Boolean(anonAdd.error), anonAdd.error?.message)
const promote = await tari.c.from('couple_members').update({ role: 'owner' }).eq('user_id', tari.id).select()
check('members cannot change roles', Boolean(promote.error) || !promote.data?.length, promote.error?.message)

console.log('\n── realtime room')
const received = []
const tariHearsOwner = await join(tari.c, `couple-player:${owner.id}`, (p) => received.push(p))
check('Tari can listen to the owner', tariHearsOwner.status === 'SUBSCRIBED', tariHearsOwner.status)
const tariOwn = await join(tari.c, `couple-player:${tari.id}`)
check('Tari can open her own player channel', tariOwn.status === 'SUBSCRIBED', tariOwn.status)
const ownerHearsTari = await join(owner.c, `couple-player:${tari.id}`)
check('owner can listen to Tari', ownerHearsTari.status === 'SUBSCRIBED', ownerHearsTari.status)
const ownerOwn = await join(owner.c, `couple-player:${owner.id}`)
check('owner can open their own player channel', ownerOwn.status === 'SUBSCRIBED', ownerOwn.status)
const sendOwn = await ownerOwn.ch.send({ type: 'broadcast', event: 'pose', payload: { x: 1, marker: 'real' } })
await sleep(1500)
check('owner can move their own character', sendOwn === 'ok' && received.some((p) => p.marker === 'real'), `send=${sendOwn}, received=${received.length}`)
// spoofing: Tari pretends to be the owner on the owner's topic
const tariSpoof = await join(tari.c, `couple-player:${owner.id}`)
const spoof = await tariSpoof.ch.send({ type: 'broadcast', event: 'pose', payload: { x: 99, marker: 'spoof' } })
const ownerListens = []
await join(owner.c, `couple-player:${owner.id}`, (p) => ownerListens.push(p))
await sleep(1500)
check("Tari cannot move the owner's character", spoof !== 'ok' && !received.some((p) => p.marker === 'spoof') && !ownerListens.some((p) => p.marker === 'spoof'), `send=${spoof}`)
if (outsider) {
  const outsiderListen = await join(outsider.c, `couple-player:${owner.id}`)
  check('outsider cannot listen to the room', outsiderListen.status !== 'SUBSCRIBED', outsiderListen.status)
  const outsiderOwn = await join(outsider.c, `couple-player:${outsider.id}`)
  const outsiderSend = outsiderOwn.status === 'SUBSCRIBED' ? await outsiderOwn.ch.send({ type: 'broadcast', event: 'pose', payload: { x: 5 } }) : 'not joined'
  check('outsider cannot broadcast a character', outsiderSend !== 'ok', `${outsiderOwn.status} / ${outsiderSend}`)
} else skip('outsider cannot listen / broadcast')
const anonListen = await join(anon, `couple-player:${owner.id}`)
check('signed-out visitor cannot listen to the room', anonListen.status !== 'SUBSCRIBED', anonListen.status)
// the same topic name as a *public* channel must not leak anything (Realtime → "Allow public access" off)
const eavesdrop = []
const anonPublic = await join(client(), `couple-player:${owner.id}`, (p) => eavesdrop.push(p), false)
check('public channels are switched off', anonPublic.status !== 'SUBSCRIBED', anonPublic.status === 'SUBSCRIBED' ? 'turn off "Allow public access" in Realtime → Settings' : anonPublic.status)
await ownerOwn.ch.send({ type: 'broadcast', event: 'pose', payload: { x: 2, marker: 'secret' } })
await sleep(1500)
check('nobody can eavesdrop via a public channel', !eavesdrop.some((p) => p.marker === 'secret'), `${anonPublic.status}, heard ${eavesdrop.length}`)

console.log('\n── letters in a bottle')
const sent = await owner.c.from('bottles').insert({ body: `[test] ${new Date().toISOString()}` }).select('id, sender, recipient').single()
check('owner can send a letter', !sent.error && sent.data?.sender === owner.id && sent.data?.recipient === tari.id, sent.error?.message || JSON.stringify(sent.data))
const forged = await owner.c.from('bottles').insert({ body: '[test] forged', sender: tari.id, recipient: owner.id })
check('nobody can forge sender / recipient', Boolean(forged.error), forged.error?.message)
const tariReads = await tari.c.from('bottles').select('id, body').eq('id', sent.data?.id)
check('Tari can read the letter', tariReads.data?.length === 1, tariReads.error?.message)
if (outsider) {
  const outsiderReads = await outsider.c.from('bottles').select('id')
  check('outsider cannot read any letter', !outsiderReads.data?.length, outsiderReads.error?.message || `${outsiderReads.data?.length} rows`)
  const outsiderSends = await outsider.c.from('bottles').insert({ body: '[test] intruder' })
  check('outsider cannot send a letter', Boolean(outsiderSends.error), outsiderSends.error?.message)
} else skip('outsider cannot read / send letters')
const anonReads = await anon.from('bottles').select('id')
check('signed-out visitor cannot read any letter', !anonReads.data?.length, anonReads.error?.message || `${anonReads.data?.length} rows`)
const anonSends = await anon.from('bottles').insert({ body: '[test] intruder' })
check('signed-out visitor cannot send a letter', Boolean(anonSends.error), anonSends.error?.message)
const edit = await tari.c.from('bottles').update({ body: 'changed' }).eq('id', sent.data?.id).select()
check('letters cannot be rewritten', Boolean(edit.error) || !edit.data?.length, edit.error?.message)
const ownerOpens = await owner.c.from('bottles').update({ opened_at: new Date().toISOString() }).eq('id', sent.data?.id).select()
check('only the recipient can mark it opened (owner cannot)', !ownerOpens.data?.length, ownerOpens.error?.message)
const tariOpens = await tari.c.from('bottles').update({ opened_at: new Date().toISOString() }).eq('id', sent.data?.id).select()
check('Tari can mark it opened', tariOpens.data?.length === 1, tariOpens.error?.message)
const del = await owner.c.from('bottles').delete().eq('id', sent.data?.id).select()
check('letters cannot be deleted from the website', Boolean(del.error) || !del.data?.length, del.error?.message)

console.log(failures ? `\n${failures} check(s) FAILED — the room is NOT private yet.` : '\nAll checks passed: the room only lets the two of you in.')
process.exit(failures ? 1 : 0)
