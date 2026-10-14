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

console.log('\n── our little home')
const house = await owner.c.from('house').select('stage, memory_date').eq('id', 1).maybeSingle()
check('owner can see the house', Boolean(house.data), house.error?.message || 'no house row — run supabase/migrations/002_our_home.sql')
if (house.data) {
  const anonHouse = await anon.from('house').select('stage')
  check('signed-out visitor cannot see the house', !anonHouse.data?.length, anonHouse.error?.message || `${anonHouse.data?.length} rows`)
  const anonItems = await anon.from('house_items').select('id')
  check('signed-out visitor cannot see the furniture', !anonItems.data?.length, anonItems.error?.message || `${anonItems.data?.length} rows`)
  const anonPlace = await anon.from('house_items').insert({ id: crypto.randomUUID(), kind: 'sofa', area: 'inside', x: 0, z: 0, rot: 0 })
  check('signed-out visitor cannot place furniture', Boolean(anonPlace.error), anonPlace.error?.message)
  const anonBuild = await anon.rpc('house_upgrade', { expected: house.data.stage })
  check('signed-out visitor cannot build', Boolean(anonBuild.error), anonBuild.error?.message)
  if (outsider) {
    const outsiderHouse = await outsider.c.from('house').select('stage')
    check('outsider cannot see the house', !outsiderHouse.data?.length, outsiderHouse.error?.message || `${outsiderHouse.data?.length} rows`)
    const outsiderBuild = await outsider.c.rpc('house_upgrade', { expected: house.data.stage })
    check('outsider cannot build', Boolean(outsiderBuild.error), outsiderBuild.error?.message)
  } else skip('outsider cannot see the house / build')
  const skipStage = await owner.c.from('house').update({ stage: 5 }).eq('id', 1).select('stage')
  check('nobody can skip building stages', Boolean(skipStage.error) || !skipStage.data?.length || skipStage.data[0].stage === house.data.stage, skipStage.error?.message)
  const tariDate = await tari.c.from('house').update({ memory_date: '2001-01-01' }).eq('id', 1).select('memory_date')
  check('only the owner picks the special date', Boolean(tariDate.error), tariDate.error?.message)
  if (!tariDate.error) await owner.c.from('house').update({ memory_date: house.data.memory_date }).eq('id', 1) // put it back
  const badKind = await owner.c.from('house_items').insert({ id: crypto.randomUUID(), kind: 'rocket', area: 'inside', x: 0, z: 0, rot: 0 })
  check('unknown furniture is refused', Boolean(badKind.error), badKind.error?.message)
  const outside = await owner.c.from('house_items').insert({ id: crypto.randomUUID(), kind: 'sofa', area: 'inside', x: 40, z: 0, rot: 0 })
  check('furniture outside the house is refused', Boolean(outside.error), outside.error?.message)

  if (house.data.stage >= 2) {
    const id = crypto.randomUUID()
    const placed = await owner.c.from('house_items').insert({ id, kind: 'teddy', area: 'inside', x: 2.5, z: 1.5, rot: 0 }).select('id, version, created_by').single()
    check('owner can place furniture (made by them)', !placed.error && placed.data?.created_by === owner.id, placed.error?.message)
    const again = await owner.c.from('house_items').insert({ id, kind: 'teddy', area: 'inside', x: 2.5, z: 1.5, rot: 0 })
    check('the same item can never be placed twice', again.error?.code === '23505', again.error?.message || 'second insert succeeded')
    const tariMoves = await tari.c.from('house_items').update({ x: 2.25 }).eq('id', id).eq('version', 1).select('version, updated_by').single()
    check('Tari can move it (version goes up)', tariMoves.data?.version === 2 && tariMoves.data?.updated_by === tari.id, tariMoves.error?.message)
    const stale = await owner.c.from('house_items').update({ x: 2.0 }).eq('id', id).eq('version', 1).select('id')
    check('a move based on an old version is not applied', !stale.error && stale.data?.length === 0, stale.error?.message)
    const forge = await owner.c.from('house_items').update({ version: 99, kind: 'bed' }).eq('id', id).select('id')
    check('nobody can change what an item is or its version', Boolean(forge.error), forge.error?.message)
    const anonDelete = await anon.from('house_items').delete().eq('id', id).select('id')
    check('signed-out visitor cannot remove furniture', Boolean(anonDelete.error) || !anonDelete.data?.length, anonDelete.error?.message)
    const removed = await owner.c.from('house_items').delete().eq('id', id).select('id')
    check('owner can remove furniture (test item cleaned up)', removed.data?.length === 1, removed.error?.message)
  } else {
    const early = await owner.c.from('house_items').insert({ id: crypto.randomUUID(), kind: 'sofa', area: 'inside', x: 0, z: 0, rot: 0 })
    check('no furniture before the cottage is built', Boolean(early.error), early.error?.message)
    console.log('SKIP  furniture checks  — build the cottage (stage 2) in the game, then run this again')
  }
}

console.log('\n── virtual dates')
const datesTable = await owner.c.from('date_sessions').select('id, status').in('status', ['pending', 'accepted', 'preparing', 'active', 'interrupted'])
if (datesTable.error) {
  check('date tables exist', false, `${datesTable.error.message} — run supabase/migrations/003_dates.sql`)
} else {
  const anonDates = await anon.from('date_sessions').select('id')
  check('signed-out visitor cannot see dates', !anonDates.data?.length, anonDates.error?.message || `${anonDates.data?.length} rows`)
  const anonInvite = await anon.rpc('date_invite', { p_id: crypto.randomUUID(), p_kind: 'lakeside' })
  check('signed-out visitor cannot send an invitation', Boolean(anonInvite.error), anonInvite.error?.message)
  const anonGift = await anon.from('keepsakes').select('kind')
  check('signed-out visitor cannot see keepsakes', !anonGift.data?.length, anonGift.error?.message || `${anonGift.data?.length} rows`)
  const forgeGift = await owner.c.from('keepsakes').insert({ kind: 'postcard' })
  check('nobody can give themselves a keepsake', Boolean(forgeGift.error), forgeGift.error?.message)
  const directDate = await owner.c.from('date_sessions').insert({ id: crypto.randomUUID(), kind: 'lakeside', initiator: owner.id, invitee: tari.id, status: 'active', expires_at: new Date().toISOString() })
  check('dates can only be made through the invitation flow', Boolean(directDate.error), directDate.error?.message)
  const anonLights = await anon.from('house').update({ lights_on: false }).eq('id', 1).select('id')
  check('signed-out visitor cannot switch the lights', Boolean(anonLights.error) || !anonLights.data?.length, anonLights.error?.message)
  if (outsider) {
    const outsiderInvite = await outsider.c.rpc('date_invite', { p_id: crypto.randomUUID(), p_kind: 'lakeside' })
    check('outsider cannot send an invitation', Boolean(outsiderInvite.error), outsiderInvite.error?.message)
  } else skip('outsider cannot send an invitation')

  if (datesTable.data.length) {
    console.log('SKIP  invitation flow  — a real date is open right now; finish it in the game, then run this again')
  } else {
    const id = crypto.randomUUID()
    const sent = await owner.c.rpc('date_invite', { p_id: id, p_kind: 'lakeside' })
    check('owner can invite (to Tari, decided by the server)', sent.data?.status === 'pending' && sent.data?.initiator === owner.id && sent.data?.invitee === tari.id, sent.error?.message)
    const again = await owner.c.rpc('date_invite', { p_id: id, p_kind: 'lakeside' })
    const openNow = await owner.c.from('date_sessions').select('id').in('status', ['pending', 'accepted', 'preparing', 'active', 'interrupted'])
    check('sending the same invitation twice makes only one', again.data?.id === id && openNow.data?.length === 1, again.error?.message)
    const second = await tari.c.rpc('date_invite', { p_id: crypto.randomUUID(), p_kind: 'camping' })
    check('only one date can be open at a time', Boolean(second.error), second.error?.message)
    const selfAccept = await owner.c.rpc('date_respond', { p_id: id, p_accept: true })
    check('the inviter cannot accept for the other person', Boolean(selfAccept.error), selfAccept.error?.message)
    const forceStatus = await owner.c.from('date_sessions').update({ status: 'active' }).eq('id', id).select('id')
    check('nobody can set a date\'s status directly', Boolean(forceStatus.error) || !forceStatus.data?.length, forceStatus.error?.message)
    const accepted = await tari.c.rpc('date_respond', { p_id: id, p_accept: true })
    check('Tari can accept', accepted.data?.status === 'accepted', accepted.error?.message)
    const ownerReady = await owner.c.rpc('date_ready', { p_id: id, p_ready: true })
    check('saying "Siap" only marks yourself', ownerReady.data?.initiator_ready === true && ownerReady.data?.invitee_ready === false && ownerReady.data?.status === 'preparing', ownerReady.error?.message)
    const tariReady = await tari.c.rpc('date_ready', { p_id: id, p_ready: true })
    check('the date begins only when both are ready', tariReady.data?.status === 'active' && Boolean(tariReady.data?.started_at), tariReady.error?.message)
    const early = await owner.c.rpc('date_finish', { p_id: id })
    check('a date ended right away is not saved as a memory', early.data?.status === 'cancelled' && early.data?.end_reason === 'ended_early' && !early.data?.keepsake, early.error?.message)
    console.log('      (this leaves one cancelled test date in date_sessions; it never shows in Kenangan Kita)')
  }
}

console.log('\n── the pet')
const petRow = await owner.c.from('pets').select('*').eq('id', 1).maybeSingle()
if (petRow.error) {
  check('pet table exists', false, `${petRow.error.message} — run supabase/migrations/004_pet.sql`)
} else {
  const anonPet = await anon.from('pets').select('id')
  check('signed-out visitor cannot see the pet', !anonPet.data?.length, anonPet.error?.message || `${anonPet.data?.length} rows`)
  const anonAdopt = await anon.rpc('pet_adopt', { p_kind: 'cat', p_name: 'test' })
  check('signed-out visitor cannot adopt', Boolean(anonAdopt.error), anonAdopt.error?.message)
  const directPet = await owner.c.from('pets').insert({ id: 1, kind: 'dog', name: 'test' })
  check('a pet can only be adopted through the adoption flow', Boolean(directPet.error), directPet.error?.message)
  if (outsider) {
    const outsiderAdopt = await outsider.c.rpc('pet_adopt', { p_kind: 'cat', p_name: 'test' })
    check('outsider cannot adopt', Boolean(outsiderAdopt.error), outsiderAdopt.error?.message)
  } else skip('outsider cannot adopt')
  if (!petRow.data) {
    console.log('SKIP  pet commands  — no pet adopted yet (adopt one in the game, then run this again)')
  } else {
    const before = petRow.data
    const twice = await tari.c.rpc('pet_adopt', { p_kind: before.kind === 'cat' ? 'dog' : 'cat', p_name: 'another one' })
    check('adopting again never makes a second pet', twice.data?.kind === before.kind && twice.data?.name === before.name, twice.error?.message)
    const steer = await owner.c.from('pets').update({ follow_target: tari.id, mode: 'follow' }).eq('id', 1).select('id')
    check('nobody can set whom the pet follows directly', Boolean(steer.error) || !steer.data?.length, steer.error?.message)
    const follow = await tari.c.rpc('pet_command', { p_mode: 'follow' })
    check('"Ajak Ikut" makes it follow the one who asked', follow.data?.follow_target === tari.id && follow.data?.mode === 'follow', follow.error?.message)
    // put it back the way it was
    if (before.mode === 'home') await owner.c.rpc('pet_command', { p_mode: 'home' })
    else if (before.follow_target === owner.id) await owner.c.rpc('pet_command', { p_mode: 'follow' })
  }
}

console.log('\n── sky island')
const skyRow = await owner.c.from('sky_progress').select('*').eq('id', 1).maybeSingle()
if (skyRow.error) {
  check('sky island tables exist', false, `${skyRow.error.message} — run supabase/migrations/005_sky_island.sql`)
} else {
  const anonSky = await anon.from('sky_progress').select('id')
  check('signed-out visitor cannot see sky progress', !anonSky.data?.length, anonSky.error?.message || `${anonSky.data?.length} rows`)
  const anonStar = await anon.rpc('sky_find_star', { p_id: 'obs1' })
  check('signed-out visitor cannot collect a star', Boolean(anonStar.error), anonStar.error?.message)
  const anonHop = await anon.rpc('hop_start', { p_id: crypto.randomUUID() })
  check('signed-out visitor cannot start Cloud Hop', Boolean(anonHop.error), anonHop.error?.message)
  const forgeStar = await owner.c.from('sky_stars').insert({ id: 'obs1' })
  check('stars can only be collected through the game', Boolean(forgeStar.error), forgeStar.error?.message)
  const fakeStar = await owner.c.rpc('sky_find_star', { p_id: 'obs99' })
  check('a star that doesn\'t exist is refused', Boolean(fakeStar.error), fakeStar.error?.message)
  const forgeProgress = await owner.c.from('sky_progress').update({ hop_completions: 99, moment_unlocked: true }).eq('id', 1).select('id')
  check('nobody can write progress directly', Boolean(forgeProgress.error) || !forgeProgress.data?.length, forgeProgress.error?.message)
  if (outsider) {
    const outsiderHop = await outsider.c.rpc('hop_start', { p_id: crypto.randomUUID() })
    check('outsider cannot start Cloud Hop', Boolean(outsiderHop.error), outsiderHop.error?.message)
  } else skip('outsider cannot start Cloud Hop')
  const active = await owner.c.from('hop_rounds').select('id').eq('status', 'active')
  if (active.data?.length) {
    console.log('SKIP  Cloud Hop round checks  — a real round is going on; finish or leave it in the game, then run this again')
  } else {
    const round = await owner.c.rpc('hop_start', { p_id: crypto.randomUUID() })
    check('owner can start a round (with Tari, decided by the server)', round.data?.status === 'active' && round.data?.player_a === owner.id && round.data?.player_b === tari.id, round.error?.message)
    const join = await tari.c.rpc('hop_start', { p_id: crypto.randomUUID() })
    check('starting again joins the same round (never two)', join.data?.id === round.data?.id, join.error?.message)
    const tariCp = await tari.c.rpc('hop_checkpoint', { p_round: round.data?.id, p_index: 1 })
    check('a checkpoint only moves your own progress', tariCp.data?.cp_b === 1 && tariCp.data?.cp_a === 0, tariCp.error?.message)
    const early = await owner.c.rpc('hop_finish', { p_round: round.data?.id })
    check('nobody finishes without reaching the goal', early.data?.done_a === false && early.data?.status === 'active', early.error?.message)
    const badStar = await owner.c.rpc('hop_star', { p_round: round.data?.id, p_star: 'h99' })
    check('a Cloud Hop star that doesn\'t exist is refused', Boolean(badStar.error), badStar.error?.message)
    const left = await owner.c.rpc('hop_leave', { p_round: round.data?.id })
    check('a round can be left (test round put away)', left.data?.status === 'abandoned', left.error?.message)
  }
}

console.log('\n── hot air balloon')
const balloonRow = await owner.c.from('balloon').select('*').eq('id', 1).maybeSingle()
if (balloonRow.error) {
  check('balloon table exists', false, `${balloonRow.error.message} — run supabase/migrations/006_balloon.sql`)
} else {
  const anonBalloon = await anon.from('balloon').select('id')
  check('signed-out visitor cannot see the balloon', !anonBalloon.data?.length, anonBalloon.error?.message || `${anonBalloon.data?.length} rows`)
  const anonBoard = await anon.rpc('balloon_board')
  check('signed-out visitor cannot board', Boolean(anonBoard.error), anonBoard.error?.message)
  const forgeFlight = await owner.c.from('balloon').update({ state: 'flying', dest: 'sky', departed_at: new Date().toISOString() }).eq('id', 1).select('id')
  check('nobody can fly the balloon by writing to it directly', Boolean(forgeFlight.error) || !forgeFlight.data?.length, forgeFlight.error?.message)
  const forgeSeat = await owner.c.from('balloon').update({ seat_b: tari.id }).eq('id', 1).select('id')
  check('nobody can put someone else in a seat', Boolean(forgeSeat.error) || !forgeSeat.data?.length, forgeSeat.error?.message)
  const badDock = await owner.c.rpc('balloon_call', { p_to: 'moon' })
  check('an unknown destination is refused', Boolean(badDock.error), badDock.error?.message)
  if (outsider) {
    const outsiderBoard = await outsider.c.rpc('balloon_board')
    check('outsider cannot board', Boolean(outsiderBoard.error), outsiderBoard.error?.message)
  } else skip('outsider cannot board')
  const b = balloonRow.data
  if (b.state !== 'docked' || b.seat_a || b.seat_b) {
    console.log('SKIP  boarding checks  — someone is in the balloon (or it is flying); get out in the game, then run this again')
  } else {
    const o1 = await owner.c.rpc('balloon_board')
    const o2 = await owner.c.rpc('balloon_board')
    check('boarding twice still takes only one seat', o2.data?.seat_a === owner.id && !o2.data?.seat_b, o1.error?.message || o2.error?.message)
    const t1 = await tari.c.rpc('balloon_board')
    check('Tari takes the other seat', t1.data?.seat_b === tari.id, t1.error?.message)
    const ownerReady = await owner.c.rpc('balloon_ready', { p_ready: true })
    check('it waits until everyone in the basket is ready', ownerReady.data?.state === 'docked' && ownerReady.data?.ready_a === true && ownerReady.data?.ready_b === false, ownerReady.error?.message)
    // put everything back without flying anywhere
    await owner.c.rpc('balloon_ready', { p_ready: false })
    const tLeave = await tari.c.rpc('balloon_leave')
    const oLeave = await owner.c.rpc('balloon_leave')
    check('both can get out again (test seats cleared)', !oLeave.data?.seat_a && !oLeave.data?.seat_b, tLeave.error?.message || oLeave.error?.message)
  }
}

console.log(failures ? `\n${failures} check(s) FAILED — the room is NOT private yet.` : '\nAll checks passed: the room only lets the two of you in.')
process.exit(failures ? 1 : 0)
