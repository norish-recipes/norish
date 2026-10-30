-- realtimePublish: append to the Resume Buffer and publish, atomically.
--
-- KEYS[1] stream key   (norish:stream:...)
-- KEYS[2] channel      (norish:...)
-- ARGV[1] envelope     (superjson string carrying the "$ID$" placeholder)
-- ARGV[2] maxlen       (approximate stream trim)
-- ARGV[3] ttl seconds  (refreshed on every write)
--
-- The stream entry id becomes the envelope's eventId, so a live event and its
-- buffered copy carry the same id. Because append and publish happen in one
-- script, a live event can never be observed before its buffered copy exists.

local id = redis.call('XADD', KEYS[1], 'MAXLEN', '~', ARGV[2], '*', 'e', ARGV[1])

local envelope = ARGV[1]
local placeholder = '"eventId":"$ID$"'
-- Plain find: the placeholder contains '$', which is magic in Lua patterns.
local first, last = string.find(envelope, placeholder, 1, true)

if first then
  envelope = string.sub(envelope, 1, first - 1)
    .. '"eventId":"' .. id .. '"'
    .. string.sub(envelope, last + 1)
end

redis.call('PUBLISH', KEYS[2], envelope)
redis.call('EXPIRE', KEYS[1], ARGV[3])

return id
